import React,{useMemo,useState} from 'react';
const {FEATURES,importEarthResearchCsv,mergeEarthResearch,filterEarthResearch,
 earthResearchSummary}=require('../market/earth-national-research');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('ar-SA').format(n):'—';
const LABELS={REPORTED_SALE:'صفقة منشورة غير متحقق منها',
 REPORTED_RENT:'عقد إيجار منشور غير متحقق منه',
 ASKING_OFFER:'عرض معلن',VALUE_INDICATION:'قيمة استرشادية',
 PLANNING_CONTEXT:'معلومات مخطط',MARKET_AGGREGATE:'مؤشر مجمع',
 GEOGRAPHIC_CONTEXT:'معلومات مكانية',REGISTRY_CONTEXT:'بيانات سجل معروضة'};
export default function EarthNationalResearchPanel({onResearchChange}){
 const [records,setRecords]=useState([]);
 const [featureId,setFeatureId]=useState('TRANSACTION_TABLE');
 const [observedOn,setObservedOn]=useState(()=>new Date().toISOString().slice(0,10));
 const [city,setCity]=useState(''),[filterFeature,setFilterFeature]=useState('');
 const [notice,setNotice]=useState('');
 const summary=useMemo(()=>earthResearchSummary(records),[records]);
 const filtered=useMemo(()=>filterEarthResearch(records,{city,featureId:filterFeature}),[records,city,filterFeature]);
 const onImport=async file=>{
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice('الملف يتجاوز الحد البحثي');return;}
  try{
   const parsed=importEarthResearchCsv(await file.text(),{featureId,observedOn});
   const merged=mergeEarthResearch(records,parsed.records);
   setRecords(merged.records);onResearchChange?.(merged.records);setCity('');setFilterFeature('');
   setNotice('أضيف '+merged.added+' سجلًا؛ مكرر '+merged.duplicates+
     '؛ متعارض '+merged.conflicts.length+'؛ مستبعد '+parsed.rejected.length+
     '. لا توجد صفقات أو صكوك مؤكدة من هذا الاستيراد.');
  }catch(e){setNotice('تعذر الاستيراد: '+String(e.message||'UNKNOWN'));}
 };
 return <section dir="rtl" data-testid="earth-national-research"
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-sky-800 bg-slate-950 p-4 text-slate-100">
  <h3 className="font-bold text-base">أرض — صفقات وخرائط ومخططات ومؤشرات جميع مدن المملكة</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
   الروابط العشرة المعتمدة للبحث الشخصي. بعض الصفحات خرائط تفاعلية لا تعرض سجلاتها
   للقراءة المباشرة هنا. بيانات العرض أو التصدير المستوردة تبقى غير محققة من المصدر الرسمي.
  </p>
  <div data-testid="earth-links" className="mt-3 flex flex-wrap gap-2">
   {FEATURES.map(x=><a href={x.url} key={x.id} target="_blank" rel="noopener noreferrer"
    className="rounded border border-slate-600 px-3 py-2 text-xs text-sky-300">{x.label}</a>)}
  </div>
  <p className="mt-3 text-xs text-slate-300 break-all">
   ملف CSV بعد فتحه/تصديره بصيغة UTF-8: city,district,recordId,eventDate,amountSar,areaSqm,planNumber,parcelNumber,assetType.
   الحقول العربية الموازية مدعومة. تُحفظ صفة المصدر المختارة لكل دفعة.
  </p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">قسم أرض
    <select value={featureId} onChange={e=>setFeatureId(e.target.value)}
     data-testid="earth-feature" className="mt-1 block max-w-[220px] rounded border border-slate-600 bg-slate-900 p-2">
     {FEATURES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label className="text-xs">تاريخ الاطلاع
    <input type="date" data-testid="earth-observed-on" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs rounded border border-slate-600 p-2">استيراد CSV بحثي
    <input type="file" accept=".csv,text/csv" data-testid="earth-import-csv"
     className="block max-w-[200px]" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';await onImport(file);
     }}/>
   </label>
   <label className="text-xs">المدينة
    <select data-testid="earth-city-filter" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">جميع المدن المستوردة</option>
     {summary.cities.map(x=><option key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className="text-xs">نوع المصدر
    <select value={filterFeature} data-testid="earth-feature-filter"
     onChange={e=>setFilterFeature(e.target.value)}
     className="mt-1 block max-w-[220px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">جميع أقسام أرض</option>
     {FEATURES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
  </div>
  <p data-testid="earth-summary" className="mt-3 text-xs text-slate-300">
    أقسام المصدر: {summary.features} | سجلات بحثية مستوردة: {summary.rows} |
    مدن بالعينة: {summary.cities.length} | صفقات منفذة مؤكدة: 0
  </p>
  <div className="mt-3 w-full max-w-full min-w-0 overflow-x-auto">
   <table className="min-w-[700px] w-full text-right text-xs">
    <thead className="border-b border-slate-700 text-slate-300"><tr>
      <th className="p-2">المدينة</th><th className="p-2">الحي</th><th className="p-2">النوع</th>
      <th className="p-2">المرجع</th><th className="p-2">التاريخ المنشور</th>
      <th className="p-2">المبلغ (ر.س)</th><th className="p-2">رابط المصدر</th>
    </tr></thead>
    <tbody>{filtered.slice(0,75).map((r,i)=><tr className="border-b border-slate-800"
      key={r.sourceFeatureId+'|'+r.observedOn+'|'+r.recordId+'|'+i}>
      <td className="p-2">{r.city}</td><td className="p-2">{r.district}</td>
      <td className="p-2">{LABELS[r.evidenceKind]}</td><td className="p-2">{r.recordId||'—'}</td>
      <td className="p-2">{r.eventDate||'—'}</td><td className="p-2">{fmt(r.amountSar)}</td>
      <td className="p-2"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
       className="text-sky-300 underline">المصدر</a></td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">
    المعروض {Math.min(filtered.length,75)} من {filtered.length}. بيانات أرض المنشورة
    لا تثبت بذاتها صلاحية الصك أو اعتماد سعر صفقة في نموذج التقييم.
  </p>
  {notice&&<p data-testid="earth-import-status" role="status" className="mt-2 text-xs text-sky-200">{notice}</p>}
 </section>;
}