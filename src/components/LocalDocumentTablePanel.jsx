import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
const { useLocale } = require('../i18n/LocaleContext');
const { parseNumericText } = require('../validation/numeric-text');
const { layoutPages, reconstructDocumentTable, proposeDocumentTable, exportDocumentTable,
  restoreDocumentTable, appendDocumentTableCell, MAX_EXPORT_BYTES } = require('../document-intelligence/document-tables');

const messages = {
  TABLE_GRID_INVALID:['أدخل حدودًا متزايدة بين صفر و100؛ افصل الحدود بفاصلة منقوطة.','Enter increasing boundaries from 0 to 100, separated by semicolons.'],
  TABLE_NO_ALIGNED_GRID_PROPOSAL:['لم يظهر جدول ذو فواصل واضحة. حدّد الحدود يدويًا أمام الأصل.','No clearly aligned grid was found. Set boundaries manually against the original.'],
  TABLE_GEOMETRY_INCOMPLETE:['بعض النصوص بلا مواضع صالحة. راجع الصفحة ضوئيًا أو انقل القيمة يدويًا مع مرجعها.','Some text has no usable position. Try page OCR or a source-linked manual transcription.'],
  TABLE_REGION_EMPTY:['لا يوجد نص داخل الحدود المختارة.','There is no text inside the selected boundaries.'],
  TABLE_CELL_NOT_MAPPABLE:['الخلية فارغة أو الجدول ملتبس. أصلح الحدود أولًا.','The cell is empty or the grid is ambiguous. Correct the boundaries first.'],
  TABLE_SOURCE_OR_GRID_MISMATCH:['لا تطابق النسخة المستوردة هذا الملف والحالة والمواضع المستخرجة.','The imported copy does not match this file, case and extracted positions.'],
  TABLE_RESTORE_INVALID:['ملف الجدول غير صالح أو يتجاوز حد الاستعادة.','The table file is invalid or exceeds the restore limit.'],
  TABLE_LIMIT_EXCEEDED:['الجدول يتجاوز حدود المعالجة. اختر منطقة أصغر.','The table exceeds processing limits. Select a smaller region.'],
  TABLE_PROPOSAL_LIMIT_EXCEEDED:['الصفحة كثيفة للنموذج التلقائي. حدّد جدولًا أصغر يدويًا.','The page is too dense for automatic proposals. Define a smaller table manually.'],
};

function percentageEdges(text,dimension) {
  const parts=text.split(/[;؛\n]/).map(s=>s.trim());
  if(!text.trim()||parts.some(s=>!s))throw Object.assign(new Error('TABLE_GRID_INVALID'),{code:'TABLE_GRID_INVALID'});
  return parts.map(part=>{
    const n=parseNumericText(part);
    if(!n.ok||n.value<0||n.value>100)throw Object.assign(new Error('TABLE_GRID_INVALID'),{code:'TABLE_GRID_INVALID'});
    return n.value*dimension/100;
  });
}
const percentages=(edges,dimension)=>edges.map(n=>Number((n*100/dimension).toFixed(10))).join('; ');

export default function LocalDocumentTablePanel({ record, sourceBuffer, sourcePreviewUrl, onSelectionChange }) {
  const {locale}=useLocale(),ar=locale==='ar-SA';
  const [page,setPage]=useState(''),[direction,setDirection]=useState(ar?'rtl':'ltr');
  const [rows,setRows]=useState(''),[columns,setColumns]=useState(''),[table,setTable]=useState(null),[selected,setSelected]=useState(null);
  const [error,setError]=useState(null),[image,setImage]=useState(null),[loading,setLoading]=useState(false);
  const fileRef=useRef(),controller=useRef(),revision=useRef(0),notify=useRef(onSelectionChange);notify.current=onSelectionChange;
  const pages=useMemo(()=>{try{return layoutPages(record);}catch(_){return [];}},[record]);
  const identity=`${record.caseId}:${record.documentId}:${record.result.adapterId}`;
  const source=pages.find(p=>p.page===Number(page));
  useEffect(()=>{
    revision.current++;controller.current?.abort();setLoading(false);setPage(String(pages[0]?.page||''));
    setRows('');setColumns('');setTable(null);setSelected(null);setError(null);setImage(null);notify.current?.(null);
    return()=>{revision.current++;controller.current?.abort();};
  },[identity]);
  if(!pages.length)return null;
  function cancelPending(){revision.current++;controller.current?.abort();setLoading(false);}
  function invalidate(){cancelPending();setTable(null);setSelected(null);setError(null);notify.current?.(null);}
  function setResult(next){cancelPending();setTable(next);setRows(percentages(next.grid.rowEdges,next.height));setColumns(percentages(next.grid.columnEdges,next.width));setSelected(null);setError(null);notify.current?.(null);}
  function run(propose){try{
    if(!source)throw Object.assign(new Error('TABLE_GRID_INVALID'),{code:'TABLE_GRID_INVALID'});
    const next=propose?proposeDocumentTable({intakeRecord:record,page:source.page,direction})
      :reconstructDocumentTable({intakeRecord:record,page:source.page,direction,
        rowEdges:percentageEdges(rows,source.height),columnEdges:percentageEdges(columns,source.width)});
    setResult(next);
  }catch(e){invalidate();setError(e.code||'TABLE_GRID_INVALID');}}
  async function preview(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++revision.current;
    setLoading(true);setError(null);
    try{
      if(sourcePreviewUrl){setImage(sourcePreviewUrl);return;}
      const [{renderOcrPage},{loadPdfLibrary}]=await Promise.all([import('../document-intelligence/parsers/ocr-page-renderer.mjs'),import('../document-intelligence/parsers/pdf-browser-library.mjs')]);
      const raster=await renderOcrPage(new Uint8Array(sourceBuffer),{format:record.result.format,page:source.page,signal:abort.signal,loadPdfLibrary});
      if(id===revision.current&&!abort.signal.aborted)setImage(raster.previewUrl);
    }catch(e){if(id===revision.current&&!abort.signal.aborted)setError(e.code||'TABLE_PREVIEW_FAILED');}
    finally{if(id===revision.current)setLoading(false);}
  }
  function select(cell){try{
    const next=appendDocumentTableCell({intakeRecord:record,table,row:cell.row,column:cell.column});
    setSelected(`${cell.row}:${cell.column}`);setError(null);notify.current?.(next,next.result.atoms[0].atomId);
  }catch(e){setError(e.code||'TABLE_CELL_NOT_MAPPABLE');}}
  function download(){try{
    const payload=exportDocumentTable(record,table),url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='startak-document-table.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e.code||'TABLE_RESTORE_INVALID');}}
  async function restore(file){const id=revision.current;try{
    if(!file||file.size>MAX_EXPORT_BYTES)throw Object.assign(new Error('TABLE_RESTORE_INVALID'),{code:'TABLE_RESTORE_INVALID'});
    const text=await file.text();if(id!==revision.current)return;
    const next=restoreDocumentTable(record,text);setPage(String(next.page));setDirection(next.grid.direction);setResult(next);setImage(null);
  }catch(e){if(id===revision.current){invalidate();setError(e.code||'TABLE_RESTORE_INVALID');}}finally{if(fileRef.current)fileRef.current.value='';}}
  return <section data-testid="document-tables" className="mt-4 space-y-3 rounded-xl border border-sky-700/60 p-3 text-xs text-slate-200">
    <h3 className="text-sm font-semibold">{ar?'قراءة جدول من مواضع النص':'Read a table from text positions'}</h3>
    <p className="leading-6">{ar?'اقترح شبكة أو حدّد حدود الصفوف والأعمدة كنسب من الصفحة. قارنها بالأصل؛ لا تُستنتج العناوين والخلايا المدمجة أو معنى الأرقام. تبقى الخلية الفارغة فارغة، ويُمنع استخدام الجدول الملتبس في تأهيل الدليل.':'Propose a grid or set row and column boundaries as page percentages. Compare with the original. Headers, merged cells and numeric meaning are not inferred. Empty cells stay empty; an ambiguous grid cannot supply an evidence candidate.'}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>{ar?'صفحة الجدول':'Table page'}<span className="relative mt-1 block"><select data-testid="table-page" style={{colorScheme:'dark'}} className="block w-full appearance-none rounded border border-slate-700 bg-slate-950 p-2 pe-8 text-slate-200" value={page} onChange={e=>{revision.current++;controller.current?.abort();setLoading(false);setPage(e.target.value);setRows('');setColumns('');setImage(null);invalidate();}}>{pages.map(p=><option key={p.page} value={p.page}>{p.page}</option>)}</select><ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"/></span></label>
      <label>{ar?'ترتيب الأعمدة والنص داخل الخلية':'Column and within-cell reading order'}<span className="relative mt-1 block"><select data-testid="table-direction" style={{colorScheme:'dark'}} className="block w-full appearance-none rounded border border-slate-700 bg-slate-950 p-2 pe-8 text-slate-200" value={direction} onChange={e=>{setDirection(e.target.value);invalidate();}}><option value="rtl">{ar?'من اليمين إلى اليسار':'Right to left'}</option><option value="ltr">{ar?'من اليسار إلى اليمين':'Left to right'}</option></select><ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"/></span></label>
      <label>{ar?'حدود الصفوف % من أعلى الصفحة — افصل بـ ;':'Row boundaries % from page top — separate with ;'}<textarea data-testid="table-rows" dir="ltr" maxLength="2400" rows="2" className="mt-1 block w-full rounded bg-slate-950 p-2" placeholder="10; 20; 30" value={rows} onChange={e=>{setRows(e.target.value);invalidate();}}/></label>
      <label>{ar?'حدود الأعمدة % من يسار الصفحة — افصل بـ ;':'Column boundaries % from page left — separate with ;'}<textarea data-testid="table-columns" dir="ltr" maxLength="500" rows="2" className="mt-1 block w-full rounded bg-slate-950 p-2" placeholder="10; 50; 90" value={columns} onChange={e=>{setColumns(e.target.value);invalidate();}}/></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" data-testid="table-propose" onClick={()=>run(true)} className="rounded border border-sky-600 px-3 py-2">{ar?'اقتراح شبكة من المحاذاة':'Propose aligned grid'}</button>
      <button type="button" data-testid="table-build" onClick={()=>run(false)} className="rounded border border-amber-600 px-3 py-2">{ar?'استخراج الجدول بهذه الحدود':'Extract with these boundaries'}</button>
      <button type="button" data-testid="table-preview" disabled={loading||(!sourceBuffer&&!sourcePreviewUrl)} onClick={preview} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{loading?(ar?'جارٍ رسم الصفحة…':'Rendering page…'):(ar?'عرض الصفحة والحدود':'Show page and boundaries')}</button>
      <button type="button" data-testid="table-export" disabled={!table} onClick={download} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{ar?'تصدير الجدول ومراجع خلاياه':'Export table and cell references'}</button>
      <button type="button" data-testid="table-restore" onClick={()=>fileRef.current.click()} className="rounded border border-slate-600 px-3 py-2">{ar?'استعادة جدول لهذا المصدر':'Restore table for this source'}</button>
      <input ref={fileRef} data-testid="table-restore-file" type="file" hidden aria-hidden="true" tabIndex={-1} accept=".json" onChange={e=>restore(e.target.files?.[0])}/>
    </div>
    {error&&<p role="alert" data-testid="table-error" data-code={error} className="text-rose-200">{messages[error]?.[ar?0:1]||(ar?'تعذرت معالجة الجدول أو معاينة الصفحة. راجع الأصل والحدود.':'Table processing or source preview failed. Review the source and boundaries.')}</p>}
    {image&&source&&<figure data-testid="table-source-preview" className="mx-auto max-w-3xl overflow-hidden rounded bg-white text-slate-950">
      <figcaption className="p-2">{ar?'الأصل مع حدود الشبكة الزرقاء — المواضع تقريبية وغير متحققة':'Original with blue grid boundaries — positions are approximate and unverified'}</figcaption>
      <svg role="img" aria-label={ar?'الصفحة مع حدود الجدول':'Source page with table boundaries'} viewBox={`0 0 ${source.width} ${source.height}`} className="block w-full">
        <image href={image} width={source.width} height={source.height}/>
        {table&&<g fill="none" stroke="#0284c7" strokeWidth={source.width/350} opacity="0.85">
          {table.grid.rowEdges.map(y=><line key={'y'+y} x1={table.grid.columnEdges[0]} x2={table.grid.columnEdges.at(-1)} y1={y} y2={y}/>)}
          {table.grid.columnEdges.map(x=><line key={'x'+x} x1={x} x2={x} y1={table.grid.rowEdges[0]} y2={table.grid.rowEdges.at(-1)}/>)}
        </g>}
      </svg>
    </figure>}
    {table&&<div data-testid="document-table-result" data-status={table.status}>
      <p className="my-2 leading-6">{table.status==='AMBIGUOUS'?(ar?'توجد نصوص تتقاطع مع الحدود أو تتراكب أو تدور. راجع الأصل وعدّل الشبكة؛ اختيار الخلايا موقوف.':'Text crosses boundaries, overlaps or is rotated. Review the original and adjust the grid; cell selection is blocked.'):(ar?'شبكة مستخرجة للمراجعة. اختر خلية لربطها بمعناها ومصدرها أدناه. لا تُعتمد ماليًا تلقائيًا.':'Extracted grid for review. Choose a cell to map its meaning and source below. No automatic financial adoption.')}</p>
      <div className="max-h-[32rem] overflow-auto rounded border border-slate-600" tabIndex="0" role="region" aria-label={ar?'خلايا الجدول المستخرج':'Extracted table cells'}>
        <table dir={table.grid.direction} className="w-full border-collapse text-start">
          <caption className="p-2">{ar?`صفحة ${table.page} · ${table.rowCount} صفوف · ${table.columnCount} أعمدة`:`Page ${table.page} · ${table.rowCount} rows · ${table.columnCount} columns`}</caption>
          <thead><tr>{Array.from({length:table.columnCount},(_,i)=><th key={i} scope="col" className="border border-slate-600 p-2">{ar?'عمود':'Column'} {i+1}</th>)}</tr></thead>
          <tbody>{Array.from({length:table.rowCount},(_,r)=><tr key={r}>{table.cells.filter(c=>c.row===r+1).map(cell=><td key={cell.column} data-testid={`table-cell-${cell.row}-${cell.column}`} data-cell-status={cell.status} className={`max-w-80 border border-slate-600 p-2 align-top ${cell.status==='AMBIGUOUS'?'bg-rose-950/50':''}`}>
            {cell.status==='EMPTY'?<span>{ar?'فارغة':'Empty'}</span>:<button type="button" data-user-content translate="no" aria-pressed={selected===`${cell.row}:${cell.column}`} disabled={table.status==='AMBIGUOUS'||cell.status!=='PARSED_CONTENT'} onClick={()=>select(cell)} className="w-full whitespace-pre-wrap break-words rounded p-1 text-start hover:bg-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-60">{cell.rawValue||(ar?'نص يعبر الحدود':'Text crosses boundaries')}</button>}
          </td>)}</tr>)}</tbody>
        </table>
      </div>
      {selected&&<p role="status" data-testid="table-cell-selected" className="mt-2 text-sky-200">{ar?'أُرسلت الخلية إلى تأهيل الدليل مع صفحتها وحدودها والنصوص الأصلية وبصمة الشبكة. أكمل المراجعة أدناه.':'The cell is selected for evidence mapping with its page, bounds, source fragments and grid hash. Complete the review below.'}</p>}
    </div>}
    <p className="text-[11px] leading-5 text-slate-400">{ar?'الحدود: 100 صف و20 عمودًا و1000 خلية للجدول. قد يتضمن التصدير محتوى مستندك؛ الاستعادة تتطلب الملف نفسه ومعرّف الحالة نفسه. هذه قراءة هندسية للمواضع ولا تثبت دقة القراءة الضوئية أو صحة المصدر.':'Limits: 100 rows, 20 columns and 1000 cells per table. Exports may contain document content; restore requires the same file and case ID. Geometry reconstruction does not establish OCR accuracy or source authenticity.'}</p>
  </section>;
}
