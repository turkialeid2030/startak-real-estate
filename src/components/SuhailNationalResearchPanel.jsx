import React,{useMemo,useState} from 'react';
const {SOURCE_URL,toPublicSample,parseResearchCsv,mergeNeighborhoodResearch,selectNeighborhoodRows,researchSummary,MAX_BYTES}=
 require('../market/suhail-national-neighborhood-research');
const {useLocale}=require('../i18n/LocaleContext.js');
export default function SuhailNationalResearchPanel({onResearchChange}){
 const {locale}=useLocale();
 const en=locale==='en';
 const fmt=v=>Number.isFinite(v)?new Intl.NumberFormat(en?'en-US':'ar-SA').format(v):(en?'No data':'لا تتوفر بيانات');
 const [records,setRecords]=useState(()=>toPublicSample());
 const [city,setCity]=useState('');
 const [district,setDistrict]=useState('');
 const [note,setNote]=useState('');
 const [datasetUrl,setDatasetUrl]=useState(SOURCE_URL);
 const [observedOn,setObservedOn]=useState(()=>new Date().toISOString().slice(0,10));
 const summary=useMemo(()=>researchSummary(records),[records]);
 const visible=useMemo(()=>selectNeighborhoodRows(records,{city,district}),[records,city,district]);
 const importFile=async file=>{
  if(!file)return;
  if(file.size>MAX_BYTES){setNote(en?'CSV exceeds the import limit.':'حجم ملف البيانات أكبر من الحد البحثي المسموح');return;}
  try{
   const s=await file.text();
   const result=parseResearchCsv(s,{sourceUrl:datasetUrl,observedOn});
   const combined=mergeNeighborhoodResearch(records,result.records);
   setRecords(combined.records);onResearchChange?.(combined.records);setCity('');setDistrict('');
   setNote(en
 ?'Added '+combined.added+' research rows; duplicates '+combined.duplicates+'; conflicts '+combined.conflicts.length+
  '; rejected '+result.rejected.length+'. No independently confirmed individual property sales.'
 :'أضيف '+combined.added+' سجلًا بحثيًا؛ مكرر '+combined.duplicates+
     '؛ متعارض '+combined.conflicts.length+'؛ مرفوض '+result.rejected.length+
     '. تُحفظ البيانات السابقة ولا تُدرج أي صفقات فردية أو قيم عقارية تلقائيًا.');
  }catch(e){setNote((en?'CSV import failed: ':'تعذر استيراد CSV: ')+String(e.message||'UNKNOWN'));}
 };
 return <section data-testid="suhail-national-research" dir={en?'ltr':'rtl'}
  className="rounded-xl border border-sky-800 bg-slate-950 p-4 mt-5 text-slate-100">
  <h3 className="font-bold text-base">{en?'Suhail — Saudi neighborhood indicators (personal research)':'سهيل — مؤشرات الأحياء في مدن المملكة (بحث شخصي)'}</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
    {en?'Preliminary public-page sample observed on 28 October 2026 across multiple Saudi cities. Neighborhood figures have no independently proven reporting period and do not represent verified individual transactions or approved valuations.':
      'العينة المبدئية من صفحة عامة مفهرسة بتاريخ 28 أكتوبر 2026، وتشمل مدنًا مختلفة وليست الرياض فقط. الأرقام مؤشرات أحياء غير مثبتة الفترة، وليست صفقات فردية؛ لا تدخل تلقائيًا في التقييم.'}
  </p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">{en?'City':'المدينة'}
    <select data-testid="suhail-city" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block min-w-[140px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{en?'All cities in sample':'كل المدن المتاحة في العينة'}</option>
     {summary.cities.map(x=><option data-user-content translate="no" key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className="text-xs">{en?'District':'الحي'}
    <input data-testid="suhail-district-filter" value={district} onChange={e=>setDistrict(e.target.value)}
     placeholder={en?'Search for district':'بحث عن حي'} className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs">{en?'Source URL for this dataset':'رابط المصدر لهذه الدفعة'}
    <input data-testid="suhail-source-url" type="url" dir="ltr" value={datasetUrl}
     onChange={e=>setDatasetUrl(e.target.value)}
     className="mt-1 block w-[240px] rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs">{en?'Observation date (not sale date)':'تاريخ الاطلاع (ليس تاريخ الصفقة)'}
    <input data-testid="suhail-observed-on" type="date" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs rounded border border-slate-600 p-2">{en?'Import research CSV':'إضافة بيانات CSV البحثية'}
    <input data-testid="suhail-research-import" type="file" accept=".csv,text/csv" className="block max-w-[240px]"
     onChange={async e=>{const f=e.target.files?.[0];e.target.value='';await importFile(f);}}/>
   </label>
  </div>
  <p data-testid="suhail-scope" className="mt-3 text-xs text-slate-300">
    {en?'Cities in sample: ':'المدن في البيانات الحالية: '}{summary.cityCount} | {en?'Neighborhoods: ':'الأحياء: '}{summary.neighborhoodRows} |
    {en?'Independently confirmed individual transactions: 0. Counts describe this retrieved sample only, not the full provider coverage.':'الصفقات الفردية المؤكدة: 0. عدد المدن هنا يخص العينة المسترجعة فقط وليس نطاق تغطية سهيل الكامل.'}
  </p>
  <div className="mt-3 overflow-x-auto">
   <table className={'w-full text-xs min-w-[730px] '+(en?'text-left':'text-right')}>
    <thead className="border-b border-slate-700 text-slate-300">
     <tr><th className="p-2">{en?'City':'المدينة'}</th><th className="p-2">{en?'District':'الحي'}</th><th className="p-2">{en?'Reported transfers':'الإفراغات'}</th>
      <th className="p-2">{en?'Value (SAR)':'القيمة (ر.س)'}</th><th className="p-2">{en?'Residential SAR/sqm':'متر السكني'}</th>
      <th className="p-2">{en?'Commercial SAR/sqm':'متر التجاري'}</th><th className="p-2">{en?'Reported growth':'النمو المعلن'}</th></tr>
    </thead>
    <tbody>{visible.slice(0,50).map((r,i)=><tr key={r.city+'|'+r.district+'|'+i} className="border-b border-slate-800">
      <td data-user-content translate="no" className="p-2">{r.city}</td><td data-user-content translate="no" className="p-2">{r.district}</td>
      <td className="p-2">{fmt(r.transferCount)}</td><td className="p-2">{fmt(r.totalValueSar)}</td>
      <td className="p-2">{fmt(r.residentialSarSqm)}</td><td className="p-2">{fmt(r.commercialSarSqm)}</td>
      <td className="p-2">{Number.isFinite(r.growthPct)?r.growthPct+'%':'—'}</td>
     </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">{en?'Showing ':'المعروض: '}
    {Math.min(visible.length,50)} {en?'of ':'من '}{visible.length}
    {en?' filtered research rows. Financial comparables remain blocked; aggregates cannot be blended across periods or sources. Zero transfers with a nonzero sqm indicator is not evidence that a property is worthless.':' سجلات بعد التصفية. المقارنة المالية محجوبة؛ ولا تُدمج القيم المجمعة بين فترات أو مصادر مختلفة. صفر إفراغات مع متوسط متر غير صفري لا يعني عدم وجود قيمة للعقار.'}</p>
  <a className="mt-2 inline-block text-xs text-sky-300 underline" href={SOURCE_URL}
   target="_blank" rel="noopener noreferrer">{en?'Open Suhail source':'عرض المصدر الأصلي — سهيل'}</a>
  {note&&<p role="status" className="mt-3 text-xs" data-testid="suhail-import-status">{note}</p>}
 </section>;
}