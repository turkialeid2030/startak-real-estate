import React,{useState} from 'react';
const {MODEL_IDS,parseChallengerCsv,evaluateChallengers}=
 require('../market/challenger-benchmark-research');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
const n=v=>Number.isFinite(v)?new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(v):'—';
export default function ChallengerBenchmarkResearchPanel(){
 const [result,setResult]=useState(()=>evaluateChallengers());
 const [notice,setNotice]=useState('');
 async function onFile(file){
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice('حجم الملف غير مسموح');return;}
  try{
   const parsed=parseChallengerCsv(await file.text());
   const evaluated=evaluateChallengers({observations:parsed.records});
   setResult(evaluated);
   setNotice('سجلات مقبولة '+parsed.records.length+'؛ مرفوضة '+parsed.rejected.length+
    '؛ حالة الموازنة: '+evaluated.status+'. النتائج رياضية بحثية وليست دقة سوقية معتمدة.');
  }catch(e){setNotice('تعذر احتساب مقارنة النماذج: '+String(e.message||e));}
 }
 return <section data-testid="challenger-benchmark-research" dir="rtl"
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100">
  <h3 className="font-bold">اختبار النماذج المتنافسة — عينة عقارات مشتركة</h3>
  <p className="mt-2 text-xs text-slate-300">المقارنة الرياضية تستخدم محرك التحقق التاريخي الموجود،
   وتشترط 30 عقارًا على الأقل والنطاق والتاريخ والصفقة المرجعية نفسها لجميع النماذج.
   بدون تحقق مستقل من أسعار التنفيذ، لا يجوز إعلان نسبة دقة حقيقية.</p>
  <p className="mt-2 text-xs text-slate-400">النماذج المدعومة:
   {MODEL_IDS.join('، ')}</p>
  <p className="mt-2 text-xs text-slate-300 break-all">
    CSV: modelId,propertyRef,assetType,city,district,predictedAsOf,predictedValueSar,
    executedPriceSar,executionDate,runCostSar (اختياري).
  </p>
  <label className="mt-3 inline-block rounded border border-slate-600 p-2 text-xs">
   بيانات المقارنة التجريبية CSV
   <input data-testid="challenger-csv" type="file" accept=".csv,text/csv"
    className="block max-w-[220px]" onChange={async e=>{
     const file=e.target.files?.[0];e.target.value='';await onFile(file);}}/>
  </label>
  <p data-testid="challenger-status" className="mt-3 text-xs text-amber-200">
    {result.status} | عينة مشتركة: {result.cohortSize} | الاعتماد الخارجي: غير متحقق</p>
  {result.status==='RESEARCH_MATH_ONLY_EXTERNAL_VERIFICATION_REQUIRED'&&
   <div className="mt-3 w-full min-w-0 overflow-x-auto">
    <table className="min-w-[650px] w-full text-right text-xs"><thead><tr>
     <th>النموذج</th><th>عدد الحالات</th><th>MAE ر.س</th><th>MdAPE %</th>
     <th>ضمن هامش 10%</th><th>تكلفة المهمة الناجحة ر.س</th>
    </tr></thead><tbody>
     {Object.entries(result.metricsByModel).map(([id,v])=><tr key={id}>
      <td>{id}</td><td>{n(v.sampleSize)}</td><td>{n(v.maeSar)}</td>
      <td>{n(v.medianApePct)}</td><td>{n(v.within10Pct)}%</td>
      <td>{n(v.costPerCorrectCompletedTaskSar)}</td>
     </tr>)}</tbody></table>
   </div>}
  {notice&&<p role="status" data-testid="challenger-import-status"
   className="mt-2 text-xs text-sky-200">{notice}</p>}
  <p className="mt-2 text-xs text-amber-200">لا يُسمح بتصنيف نموذج باعتباره الأدق أو تقديم توصية استثمارية
   حتى تتحقق جهة مستقلة من عينة الصفقات ومنع تسرب التدريب ومعايير المقارنة.</p>
 </section>;
}