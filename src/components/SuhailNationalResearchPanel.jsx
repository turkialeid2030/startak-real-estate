import React,{useMemo,useState} from 'react';
const {SOURCE_URL,toPublicSample,parseResearchCsv,mergeNeighborhoodResearch,selectNeighborhoodRows,researchSummary,MAX_BYTES}=
 require('../market/suhail-national-neighborhood-research');
const number=new Intl.NumberFormat('ar-SA');
const fmt=v=>Number.isFinite(v)?number.format(v):'لا تتوفر بيانات';
export default function SuhailNationalResearchPanel({onResearchChange}){
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
  if(file.size>MAX_BYTES){setNote('حجم ملف البيانات أكبر من الحد البحثي المسموح');return;}
  try{
   const s=await file.text();
   const result=parseResearchCsv(s,{sourceUrl:datasetUrl,observedOn});
   const combined=mergeNeighborhoodResearch(records,result.records);
   setRecords(combined.records);onResearchChange?.(combined.records);setCity('');setDistrict('');
   setNote('أضيف '+combined.added+' سجلًا بحثيًا؛ مكرر '+combined.duplicates+
     '؛ متعارض '+combined.conflicts.length+'؛ مرفوض '+result.rejected.length+
     '. تُحفظ البيانات السابقة ولا تُدرج أي صفقات فردية أو قيم عقارية تلقائيًا.');
  }catch(e){setNote('تعذر استيراد CSV: '+String(e.message||'UNKNOWN'));}
 };
 return <section data-testid="suhail-national-research" dir="rtl"
  className="rounded-xl border border-sky-800 bg-slate-950 p-4 mt-5 text-slate-100">
  <h3 className="font-bold text-base">سهيل — مؤشرات الأحياء في مدن المملكة (بحث شخصي)</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
    العينة المبدئية من صفحة عامة مفهرسة بتاريخ 28 أكتوبر 2026، وتشمل مدنًا مختلفة وليست الرياض فقط.
    الأرقام مؤشرات أحياء غير مثبتة الفترة، وليست صفقات فردية؛ لا تدخل تلقائيًا في التقييم.
  </p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">المدينة
    <select data-testid="suhail-city" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block min-w-[140px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">كل المدن المتاحة في العينة</option>
     {summary.cities.map(x=><option key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className="text-xs">الحي
    <input data-testid="suhail-district-filter" value={district} onChange={e=>setDistrict(e.target.value)}
     placeholder="بحث عن حي" className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs">رابط المصدر لهذه الدفعة
    <input data-testid="suhail-source-url" type="url" dir="ltr" value={datasetUrl}
     onChange={e=>setDatasetUrl(e.target.value)}
     className="mt-1 block w-[240px] rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs">تاريخ الاطلاع (ليس تاريخ الصفقة)
    <input data-testid="suhail-observed-on" type="date" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs rounded border border-slate-600 p-2">إضافة بيانات CSV البحثية
    <input data-testid="suhail-research-import" type="file" accept=".csv,text/csv" className="block max-w-[240px]"
     onChange={async e=>{const f=e.target.files?.[0];e.target.value='';await importFile(f);}}/>
   </label>
  </div>
  <p data-testid="suhail-scope" className="mt-3 text-xs text-slate-300">
    المدن في البيانات الحالية: {summary.cityCount} | الأحياء: {summary.neighborhoodRows} |
    الصفقات الفردية المؤكدة: 0. عدد المدن هنا يخص العينة المسترجعة فقط وليس نطاق تغطية سهيل الكامل.
  </p>
  <div className="mt-3 overflow-x-auto">
   <table className="w-full text-xs text-right min-w-[730px]">
    <thead className="border-b border-slate-700 text-slate-300">
     <tr><th className="p-2">المدينة</th><th className="p-2">الحي</th><th className="p-2">الإفراغات</th>
      <th className="p-2">القيمة (ر.س)</th><th className="p-2">متر السكني</th>
      <th className="p-2">متر التجاري</th><th className="p-2">النمو المعلن</th></tr>
    </thead>
    <tbody>{visible.slice(0,50).map((r,i)=><tr key={r.city+'|'+r.district+'|'+i} className="border-b border-slate-800">
      <td className="p-2">{r.city}</td><td className="p-2">{r.district}</td>
      <td className="p-2">{fmt(r.transferCount)}</td><td className="p-2">{fmt(r.totalValueSar)}</td>
      <td className="p-2">{fmt(r.residentialSarSqm)}</td><td className="p-2">{fmt(r.commercialSarSqm)}</td>
      <td className="p-2">{Number.isFinite(r.growthPct)?r.growthPct+'%':'—'}</td>
     </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">المعروض: {Math.min(visible.length,50)} من {visible.length} سجلات بعد التصفية.
    المقارنة المالية محجوبة؛ ولا تُدمج القيم المجمعة بين فترات أو مصادر مختلفة.
    صفر إفراغات مع متوسط متر غير صفري لا يعني عدم وجود قيمة للعقار.</p>
  <a className="mt-2 inline-block text-xs text-sky-300 underline" href={SOURCE_URL}
   target="_blank" rel="noopener noreferrer">عرض المصدر الأصلي — سهيل</a>
  {note&&<p role="status" className="mt-3 text-xs" data-testid="suhail-import-status">{note}</p>}
 </section>;
}