import React,{useMemo,useState} from 'react';
const {buildUnifiedResearch,researchReportBundle,researchClaimsGate}=
 require('../market/research-evidence-fusion');
const {renderResearchBriefHtml}=require('../market/research-brief-html');
const {useLocale}=require('../i18n/LocaleContext.js');
export default function ResearchEvidenceFusionPanel({subject={},feeds={},asOf='2026-10-28',
 readinessStatus='NOT_TESTED',marketReport=null,readiness=null,publicNeighborhood=null,publicLoadMeta=null}){
 const {locale}=useLocale();
 const en=locale==='en';
 const [message,setMessage]=useState('');
 const result=useMemo(()=>buildUnifiedResearch({subject,feeds,asOf}),[subject,feeds,asOf]);
 const bundle=useMemo(()=>researchReportBundle(result,{
  marketReadinessStatus:readinessStatus,marketReport,readiness,
  publicNeighborhood,publicLoadMeta}),
  [result,readinessStatus,marketReport,readiness,publicNeighborhood,publicLoadMeta]);
 const safeMemo=researchClaimsGate({snapshot:result,claims:[
  {kind:'LIMITATION',text:'البيانات التي جُمعت عبر لوحات البحث لا تثبت بمفردها قيمة أو ملكية أو صفقة منفذة.',evidenceIds:[]},
  {kind:'REVIEW_TASK',text:'يلزم التحقق من الصفقات والموقع والحقوق ودراسة الدخل والمخاطر قبل اتخاذ قرار الشراء.',evidenceIds:[]}
 ]});
 const exportHtml=()=>{
  try{
   const html=renderResearchBriefHtml(bundle);
   const blob=new Blob([html],{type:'text/html;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');
   link.href=url;link.download='STARTAK_Arabic_Research_Investment_Brief.html';
   document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
   setMessage(en?'An Arabic research-only HTML report was exported; it is not a licensed valuation or purchase recommendation.':'تم تصدير تقرير عربي بحثي غير معتمد؛ لا يتضمن توصية شراء أو تقييمًا مرخصًا.');
  }catch(e){setMessage((en?'Could not export Arabic research HTML: ':'تعذر إصدار التقرير البحثي العربي: ')+String(e?.message||e));}
 };
 const exportJson=()=>{
  try{
   const blob=new Blob([JSON.stringify({...bundle,aiAdvisory:safeMemo},null,2)],
    {type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');
   link.href=url;link.download='STARTAK_Unified_Research_Brief.json';document.body.appendChild(link);
   link.click();link.remove();URL.revokeObjectURL(url);
   setMessage(en?'Research JSON exported with evidence limitations and no certified market value.':'تم تصدير تقرير بحثي مع حدود الثقة؛ لا يتضمن قيمة سوقية معتمدة.');
  }catch(e){setMessage((en?'Could not export research bundle: ':'تعذر تصدير التقرير البحثي: ')+String(e?.message||e));}
 };
 return <section data-testid="research-evidence-fusion" dir={en?'ltr':'rtl'}
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-amber-700 bg-slate-950 p-4 text-slate-100">
  <div className="flex flex-wrap justify-between gap-2">
   <div><h3 className="font-bold text-base">{en?'STARTAK — Multi-source market evidence':'STARTAK — ربط أدلة السوق متعددة المصادر'}</h3>
    <p className="mt-2 text-xs text-slate-300">{en?'Research evidence only; it does not issue a certified appraisal or purchase recommendation.':'عرض بحثي واحد؛ لا يصدر تقييمًا مهنيًا ولا توصية شراء دون أدلة.'}</p></div>
   <span data-testid="fusion-status" data-decision="HOLD" className="text-xs text-amber-200">
     {en?'Verification required — HOLD':'قيد التحقق — معلّق'}</span>
  </div>
  <p className="mt-3 text-xs text-slate-300" data-testid="fusion-subject">
   {en?'Property: ':'العقار: '}{subject.city||(en?'Unknown':'غير محدد')} / {subject.district||(en?'Unknown district':'الحي غير محدد')} |
   {en?'Date: ':'التاريخ: '}{asOf}</p>
  <div data-testid="fusion-statistics" className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
   <div className="rounded border border-slate-700 p-2">{en?'Research rows: ':'السجلات البحثية: '}{result.validResearchRows}</div>
   <div className="rounded border border-slate-700 p-2">{en?'Subject district rows: ':'سجلات نطاق الحي: '}{result.subjectAreaRows}</div>
   <div className="rounded border border-slate-700 p-2">
    {en?'Potential duplicates: ':'تكرارات محتملة: '}{result.possibleCrossSourceDuplicates.length+result.possibleRepeatedObservations}</div>
   <div className="rounded border border-slate-700 p-2">{en?'Independently verified executed sales: ':'صفقات منفذة مثبتة: '}{result.verifiedExecutedSales}</div>
  </div>
  <p className="mt-3 text-xs text-slate-300">{en?'District matching does not prove the subject property identity or title. An independently evidenced parcel/plot identifier is needed; neighborhood indicators must not be blended with asking listings.':'مطابقة الحي لا تثبت تطابق العقار أو ملكيته؛ يلزم معرّف عقاري أو مخطط وقطعة موثقان. كما لا تُمزج مؤشرات الأحياء بالقيم المعلنة.'}</p>
  <div data-testid="fusion-source-readiness" className="mt-2 text-xs text-slate-300">
   {result.feedReadiness.map(x=><p key={x.feed}>{x.feed}: {x.importedResearchRows} {en?'research rows; direct API not connected and individual source not verified':'سجل بحثي؛ API مباشر غير متصل، صحة المصدر الفردي غير مثبتة'}</p>)}
  </div>
  {result.sourceRefs.length>0?<p className="mt-2 text-xs break-words">
   {en?'Sources related to this district: ':'المصادر المتعلقة بالحي: '}{result.sourceRefs.join('، ')}</p>:null}
  <p data-testid="fusion-risk-codes" className="mt-2 text-xs text-amber-200">
    {en?'Evidence limitations: ':'قيود الفحص: '}{result.risks.join(' | ')}
  </p>
  <div className="mt-3 rounded border border-slate-700 p-3 text-xs">
   <p className="font-bold">{en?'Appraisal and investment review':'مراجعة التقييم والاستثمار'}</p>
   <p className="mt-1">{en?'Certified market value is unavailable from these research inputs.':'حسابات السوق المعتمدة: غير متاحة من هذه البيانات البحثية.'}</p>
   <p>{en?'Maximum purchase price not determined; requires evidenced cash flows, target return and verified inputs.':'سقف الشراء: غير محسوب؛ يحتاج نموذج التدفقات النقدية والعائد المستهدف وبيانات معتمدة.'}</p>
   <p>{en?'Investment decision on hold pending verification; internal simulations may continue.':'توصية الاستثمار: تعليق القرار لحين التحقق، مع استمرار المحاكاة الداخلية.'}</p>
   <p className="mt-1">{en?'Current appraisal engine status: ':'حالة محرك التقييم الحالي: '}{readinessStatus}</p>
   <p data-testid="fusion-open-data-annex" className="mt-2">
    {en?'Open historical Ministry of Justice dataset: ':'مرجع وزارة العدل التاريخي المفتوح: '}
    {bundle.openDataAnnex.status==='NOT_LOADED'?(en?' Not loaded':' لم يُحمّل بعد'):
    ' '+bundle.openDataAnnex.status}.
    {Number.isFinite(bundle.openDataAnnex.medianNeighborhoodSarSqm)?
     (en?' Historical district median ':' وسيط تاريخي للحي ')+new Intl.NumberFormat(en?'en-US':'ar-SA').format(
       bundle.openDataAnnex.medianNeighborhoodSarSqm)+(en?' SAR/sqm (not subject property value).':' ر.س/م² (ليس قيمة العقار).'):''}
   </p>
   <p data-testid="fusion-scenario-annex" className="mt-2">
    {en?'Current arithmetic scenario annex (unverified inputs):':'ملحق سيناريو الحسابات الحالية (مدخلات غير موثقة):'}
    {Number.isFinite(bundle.scenarioAnnex.previewValuesSar.todayValueScenarioSar)?
     (en?' Scenario amount ':' القيمة التصورية ')+new Intl.NumberFormat(en?'en-US':'ar-SA').format(
       bundle.scenarioAnnex.previewValuesSar.todayValueScenarioSar)+(en?' SAR':' ريال'):(en?' No complete scenario value':' لا توجد قيمة تصورية مكتملة')}.
    {en?'Not a certified market value or approved purchase cap.':'لا تعادل القيمة السوقية المعتمدة ولا سقف شراء.'}
   </p>
  </div>
  <div data-testid="fusion-review-actions" className="mt-3 rounded border border-amber-800 p-3 text-xs">
   <h4 className="font-bold">{en?'Advisory council evidence review — outstanding requirements':'خطة فحص مجلس تركي الاستشاري — متطلبات معلّقة'}</h4>
   <p className="mt-1 text-amber-200">{en?'These are evidence-bound review tasks, not a purchase recommendation or certified professional appraisal.':'هذه مهام مراجعة مستندة إلى نواقص الأدلة، وليست توصية شراء أو تقييمًا مهنيًا معتمدًا.'}</p>
   {en&&<p data-testid="fusion-language-scope" className="mt-1 text-amber-200">
     Individual audit task labels and reasons may remain in Arabic. The HTML export is Arabic only; do not interpret interface translation as certified or independently verified evidence.
   </p>}
   <ol className="mt-2 list-decimal pr-5">
    {bundle.reviewerActionPlan.tasks.map(x=><li key={x.id} className="mb-2">
     <strong>{x.label}</strong> — {x.reason}</li>)}
   </ol>
   <p className="text-amber-200">{en?'Decision: hold the investment until independent verification. No certified value or purchase cap.':'القرار: تعليق الاستثمار لحين التحقق المستقل؛ لا قيمة أو سقف شراء معتمد.'}</p>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" data-testid="fusion-export" onClick={exportJson}
    className="rounded border border-slate-500 px-3 py-2 text-xs">{en?'Export research JSON':'تصدير حزمة البحث JSON'}</button>
   <button type="button" data-testid="fusion-export-html" onClick={exportHtml}
    className="rounded border border-slate-500 px-3 py-2 text-xs">{en?'Arabic real-estate research HTML':'تقرير بحث عقاري واستثماري عربي HTML'}</button>
  </div>
  {message&&<p role="status" className="mt-2 text-xs text-sky-200">{message}</p>}
 </section>;
}