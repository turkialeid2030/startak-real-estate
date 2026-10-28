import React,{useMemo,useState} from 'react';
const {SOURCES,importNationalSourcesCsv,mergeNationalResearch,filterNationalResearch,
 summarizeNationalResearch}=require('../market/saudi-national-intelligence-sources');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
const confidenceAr={HIGH:'مرتفعة',MEDIUM:'متوسطة',LOW:'منخفضة'};
const metricAr={estimated_value_sar:'القيمة المقدرة',sale_price_sar:'سعر بيع منشور',
 deal_count:'عدد الصفقات',deal_value_sar:'إجمالي قيمة الصفقات',
 avg_sqm_sar:'متوسط سعر المتر'};
const classLabel={
 OFFICIAL_AGGREGATE:'مؤشر حكومي مجمع',OFFICIAL_REPORTED_SALE:'صفقة منشورة بواجهة حكومية',
 THIRD_PARTY_AGGREGATE:'مؤشر خاص مجمع',THIRD_PARTY_REPORTED_SALE:'صفقة منقولة عن جهة ثالثة',
 EXTERNAL_AVM_ESTIMATE:'تقدير آلي خارجي',RESEARCH_NOTE:'مرجع بحثي بلا قيمة رقمية'
};
export default function SaudiNationalIntelligenceSourcesPanel({onResearchChange}){
 const [records,setRecords]=useState([]);
 const [sourceId,setSourceId]=useState(''),[city,setCity]=useState('');
 const [evidenceClass,setEvidenceClass]=useState('');
 const [observedOn,setObservedOn]=useState(()=>new Date().toISOString().slice(0,10));
 const [notice,setNotice]=useState('');
 const summary=useMemo(()=>summarizeNationalResearch(records),[records]);
 const filtered=useMemo(()=>filterNationalResearch(records,{sourceId,city,evidenceClass}),
  [records,sourceId,city,evidenceClass]);
 async function importFile(file){
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice('حجم الملف أكبر من الحد المسموح');return;}
  try{
   const fresh=importNationalSourcesCsv(await file.text(),{observedOn});
   const merged=mergeNationalResearch(records,fresh.records);
   setRecords(merged.records);onResearchChange?.(merged.records);setSourceId('');setCity('');setEvidenceClass('');
   setNotice('أضيف '+merged.added+'؛ مكرر '+merged.duplicates+
     '؛ متعارض '+merged.conflicts.length+'؛ مستبعد '+fresh.rejected.length+
     '. لا توجد صفقات منفذة مؤكدة أو تقييمات معتمدة.');
  }catch(e){setNotice('خطأ بالاستيراد: '+String(e.message||'UNKNOWN'));}
 }
 return <section dir="rtl" data-testid="national-intelligence-sources"
   className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-sky-800 bg-slate-950 p-4 text-slate-100">
  <h3 className="text-base font-bold">مصادر البيانات الرسمية والتقييم العقاري — بحث شخصي</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
   مصادر حكومية وتحليلية وتقديرات خارجية، ومنها بيوت تروڤاليو. رابط Manus محفوظ كمرجع غير مقروء.
   الأرقام المستوردة هنا معلومات بحثية غير محققة بشكل مستقل؛ لا تنتقل إلى نموذج القيمة أو التقارير المعتمدة.
  </p>
  <div data-testid="national-sources-links" className="mt-3 flex flex-wrap gap-2">
   {SOURCES.map(src=><a key={src.id} target="_blank" rel="noopener noreferrer"
    href={src.url} className="rounded border border-slate-600 px-3 py-2 text-xs text-sky-300">
    {src.label}</a>)}
  </div>
  <p className="mt-3 text-xs text-slate-300 break-all">
   صيغة CSV: source,city,district,kind,recordId,eventDate,periodStart,periodEnd,
   metricName,metricValue,unit,sourceUrl,assetType.
   ولتقديرات AVM: rangeLowSar,rangeHighSar,confidenceLabel,modelAsOf (اختيارية).
   مستوى الثقة المعلن ليس دقة مثبتة.
   أنواع kind مدعومة بحسب المصدر؛ المؤشرات تحتاج فترة ووحدة قياس،
   والصفقات المنشورة تحتاج معرفًا وتاريخًا، والتقدير الآلي لا يُعد صفقة.
  </p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">تاريخ الاطلاع
    <input type="date" data-testid="national-observed-on" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="rounded border border-slate-600 p-2 text-xs">استيراد CSV بحثي
    <input type="file" accept=".csv,text/csv" data-testid="national-import-csv"
     className="block max-w-[210px]" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';await importFile(file);}}/>
   </label>
   <label className="text-xs">المدينة
    <select data-testid="national-city-filter" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">كل المدن</option>
     {summary.cities.map(x=><option key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className="text-xs">المصدر
    <select data-testid="national-source-filter" value={sourceId} onChange={e=>setSourceId(e.target.value)}
     className="mt-1 block max-w-[220px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">جميع المصادر</option>
     {SOURCES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label className="text-xs">نوع الدليل
    <select data-testid="national-class-filter" value={evidenceClass}
     onChange={e=>setEvidenceClass(e.target.value)}
     className="mt-1 block max-w-[230px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">كل الأنواع</option>
     {Object.entries(classLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
   </label>
  </div>
  <p className="mt-3 text-xs text-slate-300" data-testid="national-summary">
   المصادر المسجلة: {summary.sources} | الصفوف المستوردة: {summary.imported} |
   المدن: {summary.cities.length} | الصفقات الفردية المثبتة: {summary.verifiedExecutedSales}
  </p>
  <div className="mt-3 w-full min-w-0 max-w-full overflow-x-auto">
   <table className="w-full min-w-[780px] text-right text-xs">
    <thead className="border-b border-slate-700 text-slate-300"><tr>
     <th className="p-2">المصدر</th><th className="p-2">المدينة</th><th className="p-2">الحي</th>
     <th className="p-2">النوع</th><th className="p-2">المؤشر</th>
     <th className="p-2">القيمة / الوحدة</th><th className="p-2">نطاق المزود / ثقته المعلنة</th><th className="p-2">المصدر</th>
    </tr></thead>
    <tbody>{filtered.slice(0,50).map((r,i)=><tr key={r.sourceId+'|'+r.observedOn+'|'+r.recordId+'|'+i}
     className="border-b border-slate-800">
      <td className="p-2">{SOURCES.find(x=>x.id===r.sourceId)?.label}</td>
      <td className="p-2">{r.city}</td><td className="p-2">{r.district}</td>
      <td className="p-2">{classLabel[r.evidenceClass]}</td><td className="p-2">{metricAr[r.metricName]||r.metricName||'—'}</td>
      <td className="p-2">{r.metricValue===null?'—':new Intl.NumberFormat('ar-SA').format(r.metricValue)+' '+r.metricUnit}</td>
      <td className="p-2">{r.providerRangeLowSar===null?'—':
       new Intl.NumberFormat('ar-SA').format(r.providerRangeLowSar)+' – '+
       new Intl.NumberFormat('ar-SA').format(r.providerRangeHighSar)}
       {r.providerStatedConfidence?' / ثقة المزود المعلنة: '+
        (confidenceAr[r.providerStatedConfidence]||r.providerStatedConfidence):''}</td>
      <td className="p-2"><a target="_blank" rel="noopener noreferrer"
       href={r.sourceUrl} className="text-sky-300 underline">فتح</a></td>
     </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">
   المعروض {Math.min(filtered.length,50)} من {filtered.length} سجل بحثي. لا يوجد ربط API حي
   مؤكد، ولا تحقق مستقل من صكوك أو أسعار الصفقات أو دقة أي نموذج تقييم خارجي.
  </p>
  {notice&&<p role="status" data-testid="national-import-status"
   className="mt-2 text-xs text-sky-200">{notice}</p>}
 </section>;
}