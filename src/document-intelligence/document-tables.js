'use strict';

const { sha256Hex } = require('../crypto/sha256');
const { deepFreeze } = require('./contracts');
const { createParsedAtom, createParserResult } = require('./parsers/contracts');

const VERSION = 'LOCAL_DOCUMENT_TABLE_V1';
const MAX_EXPORT_BYTES = 2000000;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = data => sha256Hex(JSON.stringify(data));
const byteLength = text => new TextEncoder().encode(text).byteLength;
const intersects = (a,b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const contains = (a,b) => a.x0 <= b.x0 && a.x1 >= b.x1 && a.y0 <= b.y0 && a.y1 >= b.y1;

function layoutPages(intakeRecord) {
  if (!intakeRecord || !/^[a-f0-9]{64}$/.test(intakeRecord.digest || '')
    || intakeRecord.documentId !== `local-sha256:${intakeRecord.digest}` || !intakeRecord.caseId
    || intakeRecord.result?.status !== 'PARSED' || !Array.isArray(intakeRecord.result.atoms)
    || intakeRecord.result.atoms.length > 5001) fail('TABLE_SOURCE_INVALID');
  const pages = new Map(); let count = 0, characters = 0;
  for (const atom of intakeRecord.result.atoms) {
    if (atom.caseId !== intakeRecord.caseId || atom.documentId !== intakeRecord.documentId) fail('TABLE_SOURCE_INVALID');
    const layout = atom.metadata?.layoutFragments;
    if (!layout) continue;
    const page = atom.location?.page;
    if (!Number.isInteger(page) || page < 1 || page > 200 || layout.version !== 1
      || !['PDF_POINT','PIXEL'].includes(layout.units)
      || ![layout.width,layout.height].every(n=>Number.isFinite(n) && n>0 && n<=1000000)
      || !Array.isArray(layout.fragments) || layout.fragments.length > 10000) fail('TABLE_GEOMETRY_INVALID');
    let target = pages.get(page);
    if (!target) { target = { page,width:layout.width,height:layout.height,units:layout.units,fragments:[],complete:true }; pages.set(page,target); }
    if (target.width !== layout.width || target.height !== layout.height || target.units !== layout.units) fail('TABLE_GEOMETRY_INVALID');
    if (layout.missingGeometry || !layout.fragments.length) target.complete = false;
    layout.fragments.forEach((f,index)=>{
      const b = f.bounds;
      if (++count > 10000 || typeof f.text !== 'string' || (characters+=f.text.length)>1000000) fail('TABLE_LIMIT_EXCEEDED');
      if (!f.text.trim() || !b || !['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))
        || b.x1 <= b.x0 || b.y1 <= b.y0 || !['HORIZONTAL','OTHER'].includes(f.orientation)
        || !['TEXT_ITEM','WORD','LINE'].includes(f.granularity)
        || (f.confidence !== undefined && (!Number.isFinite(f.confidence) || f.confidence<0 || f.confidence>100))) fail('TABLE_GEOMETRY_INVALID');
      if (!contains({x0:0,y0:0,x1:target.width,y1:target.height},b)) target.complete = false;
      target.fragments.push({fragmentId:`${atom.atomId}:fragment:${index}`,sourceAtomId:atom.atomId,fragmentIndex:index,
        text:f.text,bounds:{x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1},orientation:f.orientation,
        granularity:f.granularity,confidence:f.confidence ?? null});
    });
  }
  return [...pages.values()].sort((a,b)=>a.page-b.page).map(page=>deepFreeze({...page,
    layoutHashSha256:hash({version:VERSION,caseId:intakeRecord.caseId,documentId:intakeRecord.documentId,
      sourceDigestSha256:intakeRecord.digest,...page})}));
}

function pageLayout(record,page) {
  const found = layoutPages(record).find(p=>p.page===page);
  if (!found) fail('TABLE_PAGE_HAS_NO_GEOMETRY');
  if (!found.complete) fail('TABLE_GEOMETRY_INCOMPLETE');
  return found;
}

function edges(values,max,limit) {
  if (!Array.isArray(values) || values.length<2 || values.length>limit+1
    || values.some((n,i)=>!Number.isFinite(n) || n<0 || n>max || (i && n<=values[i-1]))) fail('TABLE_GRID_INVALID');
  return [...values];
}

function orderedText(fragments,direction) {
  const lines=[];
  for (const f of [...fragments].sort((a,b)=>a.bounds.y0-b.bounds.y0 || a.bounds.x0-b.bounds.x0)) {
    const line=lines.find(row=>Math.min(row.y1,f.bounds.y1)-Math.max(row.y0,f.bounds.y0)
      >= 0.5*Math.min(row.y1-row.y0,f.bounds.y1-f.bounds.y0));
    if (line) { line.fragments.push(f); line.y0=Math.min(line.y0,f.bounds.y0); line.y1=Math.max(line.y1,f.bounds.y1); }
    else lines.push({y0:f.bounds.y0,y1:f.bounds.y1,fragments:[f]});
  }
  return lines.map(line=>line.fragments.sort((a,b)=>direction==='rtl'?b.bounds.x0-a.bounds.x0:a.bounds.x0-b.bounds.x0)
    .map(f=>f.text.trim()).join(' ')).join('\n');
}

function reconstructDocumentTable({intakeRecord,page,rowEdges,columnEdges,direction='rtl'}={}) {
  if (!['rtl','ltr'].includes(direction)) fail('TABLE_DIRECTION_INVALID');
  const source = pageLayout(intakeRecord,page);
  const ys=edges(rowEdges,source.height,100), xs=edges(columnEdges,source.width,20);
  if ((ys.length-1)*(xs.length-1)>1000) fail('TABLE_LIMIT_EXCEEDED');
  const bounds={x0:xs[0],y0:ys[0],x1:xs.at(-1),y1:ys.at(-1)};
  const fragments=source.fragments.filter(f=>intersects(bounds,f.bounds));
  if (!fragments.length) fail('TABLE_REGION_EMPTY');
  if (fragments.length>2000) fail('TABLE_LIMIT_EXCEEDED');
  if (fragments.reduce((n,f)=>n+f.text.length,0)>32000) fail('TABLE_LIMIT_EXCEEDED');
  const issues=[], cells=[]; let assignments=0;
  for (let row=1;row<ys.length;row++) {
    for (let column=1;column<xs.length;column++) {
      const physical=direction==='rtl'?xs.length-1-column:column-1;
      const cellBounds={x0:xs[physical],x1:xs[physical+1],y0:ys[row-1],y1:ys[row]};
      const touching=fragments.filter(f=>intersects(cellBounds,f.bounds));
      assignments+=touching.length;
      if(assignments>5000)fail('TABLE_LIMIT_EXCEEDED');
      const own=touching.filter(f=>contains(cellBounds,f.bounds));
      if (own.length>500) fail('TABLE_LIMIT_EXCEEDED');
      const reasons=[];
      if (touching.length!==own.length) reasons.push('TABLE_FRAGMENT_CROSSES_GRID_BOUNDARY');
      if (own.some(f=>f.orientation!=='HORIZONTAL')) reasons.push('TABLE_ROTATED_TEXT_UNSUPPORTED');
      let overlap=false;
      for (let i=0;i<own.length && !overlap;i++) for(let j=0;j<i;j++) {
        const a=own[i].bounds,b=own[j].bounds;
        const area=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
        if (area > 0.25*Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0))) { overlap=true;break; }
      }
      if(overlap) reasons.push('TABLE_SOURCE_FRAGMENTS_OVERLAP');
      const status=reasons.length?'AMBIGUOUS':own.length?'PARSED_CONTENT':'EMPTY';
      if(reasons.length)issues.push({row,column,reasons,fragmentIds:touching.map(f=>f.fragmentId)});
      cells.push({row,column,bounds:cellBounds,status,rawValue:own.length?orderedText(own,direction):null,
        sourceFragments:touching,reasons});
    }
  }
  const body={version:VERSION,caseId:intakeRecord.caseId,documentId:intakeRecord.documentId,
    sourceDigestSha256:intakeRecord.digest,page,width:source.width,height:source.height,units:source.units,
    pageLayoutHashSha256:source.layoutHashSha256,grid:{rowEdges:ys,columnEdges:xs,direction},
    rowCount:ys.length-1,columnCount:xs.length-1,cells,issues,
    status:issues.length?'AMBIGUOUS':'REVIEW_REQUIRED',headerInferred:false,mergedCellsInferred:false,
    numericValuesCoerced:false,sourceAuthenticated:false,independentlyVerified:false,financialInputEligible:false};
  if (byteLength(JSON.stringify(body))>MAX_EXPORT_BYTES-1000) fail('TABLE_LIMIT_EXCEEDED');
  return deepFreeze({...body,tableHashSha256:hash(body)});
}

// Suggest one rectangular run of aligned text. Common whitespace must exist
// across every proposed row; a full-width title breaks the run. This is a
// geometry proposal, never a claim that prose is semantically a table.
function proposeDocumentTable({intakeRecord,page,direction='rtl'}={}) {
  const source=pageLayout(intakeRecord,page);
  const eligible=source.fragments.filter(f=>f.orientation==='HORIZONTAL');
  if(eligible.length>2000)fail('TABLE_PROPOSAL_LIMIT_EXCEEDED');
  const lines=[];
  for(const f of [...eligible].sort((a,b)=>a.bounds.y0-b.bounds.y0)) {
    const last=lines.at(-1),b=f.bounds;
    if(last && Math.min(last.y1,b.y1)-Math.max(last.y0,b.y0)>=0.5*Math.min(last.y1-last.y0,b.y1-b.y0)){
      last.fragments.push(f);last.y0=Math.min(last.y0,b.y0);last.y1=Math.max(last.y1,b.y1);
    }else lines.push({y0:b.y0,y1:b.y1,fragments:[f]});
  }
  let best=null;
  if(lines.length>500)fail('TABLE_PROPOSAL_LIMIT_EXCEEDED');
  const gapsFor=rows=>{
    const spans=rows.flatMap(r=>r.fragments.map(f=>f.bounds)).sort((a,b)=>a.x0-b.x0);
    const minimumGap=Math.max(4,...rows.map(r=>(r.y1-r.y0)*0.9));
    const gaps=[];let right=spans[0].x1;
    for(const b of spans.slice(1)){if(b.x0-right>=minimumGap)gaps.push((b.x0+right)/2);right=Math.max(right,b.x1);}
    return gaps;
  };
  for(let start=0;start<lines.length;start++){
    const run=[];
    for(let end=start;end<Math.min(lines.length,start+100);end++){
      const current=lines[end],previous=run.at(-1);
      if(previous&&(current.y0<previous.y1 || current.y0-previous.y1>4*Math.max(current.y1-current.y0,previous.y1-previous.y0)))break;
      run.push(current);
      const gaps=gapsFor(run);
      if(!gaps.length)break;
      if(run.length<2 || gaps.length>19 || run.length*(gaps.length+1)>1000)continue;
      const score=run.length*(gaps.length+1);
      if(best&&best.score>=score)continue;
      const boxes=run.flatMap(r=>r.fragments.map(f=>f.bounds));
      best={score,rowEdges:[Math.max(0,run[0].y0-0.01),...run.slice(1).map((r,i)=>(run[i].y1+r.y0)/2),Math.min(source.height,run.at(-1).y1+0.01)],
        columnEdges:[Math.max(0,Math.min(...boxes.map(b=>b.x0))-0.01),...gaps,Math.min(source.width,Math.max(...boxes.map(b=>b.x1))+0.01)]};
    }
  }
  if(!best)fail('TABLE_NO_ALIGNED_GRID_PROPOSAL');
  return reconstructDocumentTable({intakeRecord,page,direction,rowEdges:best.rowEdges,columnEdges:best.columnEdges});
}

function verifyTable(intakeRecord,table) {
  if(!table || byteLength(JSON.stringify(table))>MAX_EXPORT_BYTES)fail('TABLE_RESTORE_INVALID');
  const rebuilt=reconstructDocumentTable({intakeRecord,page:table.page,...table.grid});
  if(JSON.stringify(rebuilt)!==JSON.stringify(table))fail('TABLE_SOURCE_OR_GRID_MISMATCH');
  return rebuilt;
}

function exportDocumentTable(intakeRecord,table) {
  return {format:VERSION,version:1,table:verifyTable(intakeRecord,table)};
}

function restoreDocumentTable(intakeRecord,text) {
  if(typeof text!=='string'||text.length>MAX_EXPORT_BYTES||byteLength(text)>MAX_EXPORT_BYTES)fail('TABLE_RESTORE_INVALID');
  let payload;try{payload=JSON.parse(text);}catch(_){fail('TABLE_RESTORE_INVALID');}
  if(payload?.format!==VERSION||payload.version!==1)fail('TABLE_RESTORE_INVALID');
  return verifyTable(intakeRecord,payload.table);
}

function tableCellAtom({intakeRecord,table,row,column}) {
  const rebuilt=verifyTable(intakeRecord,table);
  const cell=rebuilt.cells.find(c=>c.row===row&&c.column===column);
  if(rebuilt.status!=='REVIEW_REQUIRED'||cell?.status!=='PARSED_CONTENT')fail('TABLE_CELL_NOT_MAPPABLE');
  const confidence=cell.sourceFragments.every(f=>f.confidence!==null)
    ?Math.min(...cell.sourceFragments.map(f=>f.confidence))/100:null;
  return createParsedAtom({document:intakeRecord,adapterId:VERSION,kind:'CELL',valueType:'STRING',
    atomId:`${intakeRecord.documentId}:table:${rebuilt.tableHashSha256}:cell:r${row}c${column}`,rawValue:cell.rawValue,
    location:{kind:'PAGE',page:rebuilt.page,tableHashSha256:rebuilt.tableHashSha256,
      pageLayoutHashSha256:rebuilt.pageLayoutHashSha256,row,column,cellBounds:cell.bounds,units:rebuilt.units,
      grid:rebuilt.grid,sourceDigestSha256:intakeRecord.digest,sourceFragments:cell.sourceFragments},
    metadata:{extraction:'GEOMETRIC_TABLE_CELL_UNVERIFIED',sourceDigestSha256:intakeRecord.digest,
      sourceExtractionConfidence:confidence,confidenceIsAccuracy:false,financialInputEligible:false}});
}

function appendDocumentTableCell(options) {
  const {intakeRecord}=options, atom=tableCellAtom(options);
  const atoms=intakeRecord.result.atoms.filter(a=>a.adapterId!==VERSION);
  const result=createParserResult({document:intakeRecord,...intakeRecord.result,atoms:[atom,...atoms],
    warnings:[...new Set([...intakeRecord.result.warnings,'TABLE_LAYOUT_AND_READING_ORDER_REVIEW_REQUIRED'])]});
  return deepFreeze({...intakeRecord,result});
}

function assertTableCellMatchesSource(intakeRecord,atom) {
  const loc=atom?.location;
  const table=reconstructDocumentTable({intakeRecord,page:loc?.page,...loc?.grid});
  const expected=tableCellAtom({intakeRecord,table,row:loc?.row,column:loc?.column});
  if(JSON.stringify(atom)!==JSON.stringify(expected))fail('TABLE_SOURCE_OR_GRID_MISMATCH');
}

module.exports={VERSION,MAX_EXPORT_BYTES,layoutPages,reconstructDocumentTable,proposeDocumentTable,
  exportDocumentTable,restoreDocumentTable,tableCellAtom,appendDocumentTableCell,assertTableCellMatchesSource};
