'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {nativeTablePdfFixture}=require('../fixtures/document-table');
const {parseDocument}=require('../../src/document-intelligence/parsers');
const {mapParsedAtomToEvidenceFact}=require('../../src/document-intelligence/parsers/evidence-mapper');
const {makeOcrResult}=require('../../src/document-intelligence/parsers/local-ocr');
const {buildParsedEvidenceCandidate}=require('../../src/document-intelligence/parsed-evidence-qualification');
const {createLocalReviewJournal,readLocalReviewJournal}=require('../../src/storage/local-review-journal');
const {layoutPages,reconstructDocumentTable,proposeDocumentTable,exportDocumentTable,restoreDocumentTable,
  appendDocumentTableCell,tableCellAtom}=require('../../src/document-intelligence/document-tables');
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const throws=(f,code)=>{assert.throws(f,e=>e.code===code);checks++;};
const copy=v=>JSON.parse(JSON.stringify(v));
async function intake(options={}){
  const bytes=nativeTablePdfFixture(options),digest=createHash('sha256').update(bytes).digest('hex');
  const record={fileName:'synthetic-table.pdf',size:bytes.length,mimeType:'application/pdf',digest,
    documentId:`local-sha256:${digest}`,caseId:'SYNTHETIC-TABLE-CASE',receivedAt:'2026-10-21T00:00:00Z'};
  return {...record,result:await parseDocument({document:record,content:bytes})};
}
const grid={page:1,rowEdges:[50,90,130,170],columnEdges:[40,220,400,560],direction:'ltr'};
const qualify=(record,atomId)=>buildParsedEvidenceCandidate({intakeRecord:record,atomId,semanticKey:'synthetic.unverified.amount',
  valueType:'STRING',sourceReference:'Synthetic source page',reviewerRef:'DECLARED-HUMAN',reviewerNote:'Unverified grid review',capturedAt:'2026-10-21T01:00:00Z'});
(async()=>{
  const record=await intake({pages:2});eq(record.result.status,'PARSED');
  const pages=layoutPages(record);eq(pages.map(p=>p.page),[1,2]);eq(pages[0].width,600);eq(pages[0].height,400);
  eq(pages[0].fragments.length,8);eq(pages[0].complete,true);
  const table=reconstructDocumentTable({intakeRecord:record,...grid});
  eq(table.status,'REVIEW_REQUIRED');eq(table.cells.map(c=>c.rawValue),['Item','Amount','Note','Synthetic A','1234.50',null,'Synthetic B','-50.00','SAR']);
  eq(table.cells[5].status,'EMPTY');eq(table.numericValuesCoerced,false);eq(table.financialInputEligible,false);
  eq(table.sourceAuthenticated,false);eq(table.independentlyVerified,false);eq(table.headerInferred,false);eq(table.mergedCellsInferred,false);
  const refs=table.cells.flatMap(c=>c.sourceFragments.map(f=>f.fragmentId));eq(new Set(refs).size,8);eq(refs.length,8);
  eq(table.cells.every(c=>c.sourceFragments.every(f=>f.sourceAtomId&&f.bounds&&f.granularity==='TEXT_ITEM')),true);
  eq(table.tableHashSha256,reconstructDocumentTable({intakeRecord:record,...grid}).tableHashSha256);
  const rtl=reconstructDocumentTable({intakeRecord:record,...grid,direction:'rtl'});
  eq(rtl.cells.map(c=>c.rawValue),['Note','Amount','Item',null,'1234.50','Synthetic A','SAR','-50.00','Synthetic B']);
  eq(rtl.tableHashSha256!==table.tableHashSha256,true);
  const second=reconstructDocumentTable({intakeRecord:record,...grid,page:2});eq(second.tableHashSha256!==table.tableHashSha256,true);
  const proposal=proposeDocumentTable({intakeRecord:record,page:1,direction:'ltr'});
  eq(proposal.status,'REVIEW_REQUIRED');eq(proposal.columnCount,3);eq(proposal.rowCount,3);eq(proposal.cells.map(c=>c.rawValue),table.cells.map(c=>c.rawValue));
  const exported=exportDocumentTable(record,table);eq(restoreDocumentTable(record,JSON.stringify(exported)),table);
  for(const mutate of [p=>p.table.cells[4].rawValue='999999',p=>p.table.cells[4].sourceFragments[0].text='999999',
    p=>p.table.grid.columnEdges[1]=230,p=>p.table.tableHashSha256='a'.repeat(64),p=>p.table.page=2,
    p=>p.table.caseId='OTHER',p=>p.table.documentId='OTHER',p=>p.table.sourceDigestSha256='a'.repeat(64),
    p=>p.table.financialInputEligible=true,p=>p.table.cells.pop()]){
    const tampered=copy(exported);mutate(tampered);throws(()=>restoreDocumentTable(record,JSON.stringify(tampered)),'TABLE_SOURCE_OR_GRID_MISMATCH');
  }
  throws(()=>restoreDocumentTable({...record,caseId:'OTHER'},JSON.stringify(exported)),'TABLE_SOURCE_INVALID');
  throws(()=>restoreDocumentTable(record,'{'),'TABLE_RESTORE_INVALID');
  throws(()=>restoreDocumentTable(record,'x'.repeat(2000001)),'TABLE_RESTORE_INVALID');
  throws(()=>restoreDocumentTable(record,'س'.repeat(1000001)),'TABLE_RESTORE_INVALID');
  throws(()=>reconstructDocumentTable({intakeRecord:record,...grid,columnEdges:[40,220,220,560]}),'TABLE_GRID_INVALID');
  for(const rowEdges of [[NaN,170],[-1,170],[170,50],[50],[50,401]])throws(()=>reconstructDocumentTable({intakeRecord:record,...grid,rowEdges}),'TABLE_GRID_INVALID');
  throws(()=>reconstructDocumentTable({intakeRecord:record,...grid,page:3}),'TABLE_PAGE_HAS_NO_GEOMETRY');
  throws(()=>reconstructDocumentTable({intakeRecord:record,...grid,direction:'UNKNOWN'}),'TABLE_DIRECTION_INVALID');
  throws(()=>reconstructDocumentTable({intakeRecord:record,...grid,rowEdges:[0,10]}),'TABLE_REGION_EMPTY');
  const boundary=reconstructDocumentTable({intakeRecord:record,...grid,columnEdges:[40,250,400,560]});
  eq(boundary.status,'AMBIGUOUS');eq(boundary.issues.some(i=>i.reasons.includes('TABLE_FRAGMENT_CROSSES_GRID_BOUNDARY')),true);
  throws(()=>tableCellAtom({intakeRecord:record,table:boundary,row:2,column:2}),'TABLE_CELL_NOT_MAPPABLE');
  throws(()=>tableCellAtom({intakeRecord:record,table,row:2,column:3}),'TABLE_CELL_NOT_MAPPABLE');
  const merged=await intake({merged:true}),rotated=await intake({rotated:true});
  eq(reconstructDocumentTable({intakeRecord:merged,...grid}).status,'AMBIGUOUS');
  eq(reconstructDocumentTable({intakeRecord:rotated,...grid}).issues.some(i=>i.reasons.includes('TABLE_ROTATED_TEXT_UNSUPPORTED')),true);
  const selected=appendDocumentTableCell({intakeRecord:record,table,row:2,column:2}),atom=selected.result.atoms[0];
  eq(atom.rawValue,'1234.50');eq(atom.location.row,2);eq(atom.location.column,2);eq(atom.location.tableHashSha256,table.tableHashSha256);
  eq(atom.location.pageLayoutHashSha256,pages[0].layoutHashSha256);eq(atom.location.sourceDigestSha256,record.digest);
  eq(selected.result.atoms.length,record.result.atoms.length+1);
  eq(appendDocumentTableCell({intakeRecord:selected,table,row:3,column:2}).result.atoms.length,selected.result.atoms.length);
  const candidate=qualify(selected,atom.atomId);eq(candidate.status,'CANDIDATE_REQUIRES_VERIFICATION');
  eq(candidate.fact.truthStatus,'EXTRACTED_EVIDENCE');eq(candidate.fact.verification.status,'NOT_VERIFIED');
  eq(candidate.financialEngineEligible,false);eq(candidate.authorityVerified,false);eq(candidate.fact.sourceLocator.sourceFragments,atom.location.sourceFragments);
  for(const confidence of [NaN,Infinity,-.01,1.01,undefined]){
    assert.throws(()=>mapParsedAtomToEvidenceFact({atom:{...atom,metadata:{...atom.metadata,sourceExtractionConfidence:confidence}},
      document:{documentId:record.documentId,caseId:record.caseId,contentHashSha256:record.digest},semanticKey:'synthetic'}),/TABLE_SOURCE_OR_GRID_MISMATCH/);checks++;
  }
  const another=appendDocumentTableCell({intakeRecord:record,table,row:3,column:2});
  eq(qualify(another,another.result.atoms[0].atomId).fact.factId!==candidate.fact.factId,true);
  for(const patch of [{rawValue:'9999'},{location:{...atom.location,row:1}},{metadata:{...atom.metadata,sourceExtractionConfidence:.99}}]){
    const forged=copy(selected);Object.assign(forged.result.atoms[0],patch);eq(qualify(forged,atom.atomId).status,'HOLD_ATOM');
  }
  const journal=createLocalReviewJournal({caseId:record.caseId,projectId:null,kind:'EVIDENCE',payload:{source:{digest:record.digest},candidate}});
  eq(readLocalReviewJournal(JSON.stringify(journal),{caseId:record.caseId,projectId:null,kind:'EVIDENCE'}).payload.candidate.fact.sourceLocator,atom.location);
  // OCR words, not a guessed split of a line, establish column membership.
  const ocrRecord={...record,result:{format:'IMAGE'}},raster={width:1000,height:250};
  const ocrData={text:'إيجار ١٢٣٤٫٥٠\nقيمة -50.00',blocks:[{paragraphs:[{lines:[
    {text:'إيجار ١٢٣٤٫٥٠',bbox:{x0:100,y0:20,x1:900,y1:60},confidence:90,words:[
      {text:'إيجار',bbox:{x0:700,y0:20,x1:900,y1:60},confidence:88},
      {text:'١٢٣٤٫٥٠',bbox:{x0:100,y0:20,x1:300,y1:60},confidence:82}]},
    {text:'قيمة -50.00',bbox:{x0:100,y0:120,x1:900,y1:160},confidence:91,words:[
      {text:'قيمة',bbox:{x0:700,y0:120,x1:900,y1:160},confidence:89},
      {text:'-50.00',bbox:{x0:100,y0:120,x1:300,y1:160},confidence:83}]}]}]}]};
  ocrRecord.result=makeOcrResult(ocrRecord,raster,ocrData,1);
  const ocrTable=reconstructDocumentTable({intakeRecord:ocrRecord,page:1,rowEdges:[0,100,200],columnEdges:[0,500,1000],direction:'rtl'});
  eq(ocrTable.cells.map(c=>c.rawValue),['إيجار','١٢٣٤٫٥٠','قيمة','-50.00']);eq(ocrTable.units,'PIXEL');
  const ocrSelected=appendDocumentTableCell({intakeRecord:ocrRecord,table:ocrTable,row:1,column:2});
  eq(qualify(ocrSelected,ocrSelected.result.atoms[0].atomId).fact.extraction.confidence,.82);
  const diacritics=copy(ocrData);
  diacritics.blocks[0].paragraphs[0].lines[0].words[0].bbox={x0:700,y0:16,x1:900,y1:64};
  const extended={...ocrRecord,result:makeOcrResult(ocrRecord,raster,diacritics,1)};
  eq(extended.result.atoms[0].metadata.layoutFragments.fragments[0].bounds,{x0:700,y0:16,x1:900,y1:64});
  const extendedTable=reconstructDocumentTable({intakeRecord:extended,page:1,rowEdges:[0,100,200],columnEdges:[0,500,1000],direction:'rtl'});
  eq(extendedTable.status,'REVIEW_REQUIRED');eq(extendedTable.cells[0].rawValue,'إيجار');
  eq(reconstructDocumentTable({intakeRecord:extended,page:1,rowEdges:[20,100,200],columnEdges:[0,500,1000]}).status,'AMBIGUOUS');
  for(const patch of [{bbox:{x0:700,y0:-1,x1:900,y1:60}},{bbox:{x0:700,y0:20,x1:1001,y1:60}},
    {bbox:{x0:700,y0:20,x1:900,y1:251}},{bbox:{x0:700,y0:20,x1:700,y1:60}},{confidence:NaN}]){
    const invalid=copy(ocrData);Object.assign(invalid.blocks[0].paragraphs[0].lines[0].words[0],patch);
    assert.throws(()=>makeOcrResult(ocrRecord,raster,invalid,1),/OCR_RESULT_INVALID/);checks++;
  }
  const fallback=copy(ocrData);fallback.blocks[0].paragraphs[0].lines.forEach(line=>delete line.words);
  const lineOnly={...ocrRecord,result:makeOcrResult(ocrRecord,raster,fallback,1)};
  eq(reconstructDocumentTable({intakeRecord:lineOnly,page:1,rowEdges:[0,100,200],columnEdges:[0,500,1000]}).status,'AMBIGUOUS');
  const overlap=copy(ocrRecord);overlap.result.atoms[0].metadata.layoutFragments.fragments.push(copy(overlap.result.atoms[0].metadata.layoutFragments.fragments[0]));
  eq(reconstructDocumentTable({intakeRecord:overlap,page:1,rowEdges:[0,100,200],columnEdges:[0,500,1000]}).issues.some(i=>i.reasons.includes('TABLE_SOURCE_FRAGMENTS_OVERLAP')),true);
  const incomplete=copy(record);incomplete.result.atoms[0].metadata.layoutFragments.missingGeometry=1;
  throws(()=>reconstructDocumentTable({intakeRecord:incomplete,...grid}),'TABLE_GEOMETRY_INCOMPLETE');
  console.log(`DOCUMENT_TABLES=PASS checks=${checks} (actual PDF text geometry, blank/RTL/negative cells, boundary abstention, source-bound restore and evidence gates)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
