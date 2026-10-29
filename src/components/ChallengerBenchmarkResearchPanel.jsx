import React,{useState} from 'react';
const {MODEL_IDS,parseChallengerCsv,evaluateChallengers}=
 require('../market/challenger-benchmark-research');
const {useLocale}=require('../i18n/LocaleContext.js');
const {researchSourceLabel,researchNumber}=require('../i18n/research-source-presentation');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
export default function ChallengerBenchmarkResearchPanel(){
 const {locale}=useLocale();const en=locale==='en';
 const L=value=>researchSourceLabel(value,locale);
 const fmt=value=>researchNumber(value,locale);
 const [result,setResult]=useState(()=>evaluateChallengers());
 const [notice,setNotice]=useState('');
 async function onFile(file){
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice({ar:'حجم الملف غير مسموح',en:'CSV exceeds the size limit'});return;}
  try{
   const parsed=parseChallengerCsv(await file.text());
   const evaluated=evaluateChallengers({observations:parsed.records});
   setResult(evaluated);
   setNotice({ar:'سجلات مقبولة '+parsed.records.length+'؛ مرفوضة '+parsed.rejected.length+'؛ حالة الموازنة: '+evaluated.status+'. النتائج رياضية بحثية وليست دقة سوقية معتمدة.',
    en:'Accepted '+parsed.records.length+'; rejected '+parsed.rejected.length+'; comparison status: '+evaluated.status+'. Research mathematics only; market accuracy is not independently validated.'});
  }catch(e){const code=String(e.message||e);setNotice({ar:'تعذر احتساب مقارنة النماذج: '+code,en:'Model comparison failed: '+code});}
 }
 return <section data-testid="challenger-benchmark-research" dir={en?'ltr':'rtl'}
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100">
  <h3 className="font-bold">{L("اختبار النماذج المتنافسة — عينة عقارات مشتركة")}</h3>
  <p className="mt-2 text-xs text-slate-300">{L("المقارنة الرياضية تستخدم محرك التحقق التاريخي الموجود، وتشترط 30 عقارًا على الأقل والنطاق والتاريخ والصفقة المرجعية نفسها لجميع النماذج. بدون تحقق مستقل من أسعار التنفيذ، لا يجوز إعلان نسبة دقة حقيقية.")}</p>
  <p className="mt-2 text-xs text-slate-400">{en?'Supported models: ':'النماذج المدعومة: '}
   {MODEL_IDS.join('، ')}</p>
  <p className="mt-2 text-xs text-slate-300 break-all">{en?'CSV: modelId,propertyRef,assetType,city,district,predictedAsOf,predictedValueSar,executedPriceSar,executionDate,runCostSar (optional).':'CSV: modelId,propertyRef,assetType,city,district,predictedAsOf,predictedValueSar,executedPriceSar,executionDate,runCostSar (اختياري).'}</p>
  <label className="mt-3 inline-block rounded border border-slate-600 p-2 text-xs">{L("بيانات المقارنة التجريبية CSV")}<input data-testid="challenger-csv" type="file" accept=".csv,text/csv"
    className="block max-w-[220px]" onChange={async e=>{
     const file=e.target.files?.[0];e.target.value='';await onFile(file);}}/>
  </label>
  <p data-testid="challenger-status" className="mt-3 text-xs text-amber-200">
    {result.status} | {en?'Common cohort: ':'عينة مشتركة: '}{result.cohortSize} | {en?'External verification: not established':'الاعتماد الخارجي: غير متحقق'}</p>
  {result.status==='RESEARCH_MATH_ONLY_EXTERNAL_VERIFICATION_REQUIRED'&&
   <div className="mt-3 w-full min-w-0 overflow-x-auto">
    <table className="min-w-[650px] w-full text-xs" style={{textAlign:en?'left':'right'}}><thead><tr>
     <th>{L("النموذج")}</th><th>{L("عدد الحالات")}</th><th>{L("MAE ر.س")}</th><th>MdAPE %</th>
     <th>{L("ضمن هامش 10%")}</th><th>{L("تكلفة المهمة الناجحة ر.س")}</th>
    </tr></thead><tbody>
     {Object.entries(result.metricsByModel).map(([id,v])=><tr key={id}>
      <td>{id}</td><td>{fmt(v.sampleSize)}</td><td>{fmt(v.maeSar)}</td>
      <td>{fmt(v.medianApePct)}</td><td>{fmt(v.within10Pct)}%</td>
      <td>{fmt(v.costPerCorrectCompletedTaskSar)}</td>
     </tr>)}</tbody></table>
   </div>}
  {notice&&<p role="status" data-testid="challenger-import-status"
   className="mt-2 text-xs text-sky-200">{en?notice.en:notice.ar}</p>}
  <p className="mt-2 text-xs text-amber-200">{L("لا يُسمح بتصنيف نموذج باعتباره الأدق أو تقديم توصية استثمارية حتى تتحقق جهة مستقلة من عينة الصفقات ومنع تسرب التدريب ومعايير المقارنة.")}</p>
 </section>;
}