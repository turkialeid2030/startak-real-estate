import React,{useMemo,useState} from 'react';
const {buildUnifiedResearch,researchReportBundle,researchClaimsGate}=
 require('../market/research-evidence-fusion');
const {renderResearchBriefHtml}=require('../market/research-brief-html');
export default function ResearchEvidenceFusionPanel({subject={},feeds={},asOf='2026-10-28',
 readinessStatus='NOT_TESTED',marketReport=null,readiness=null,publicNeighborhood=null,publicLoadMeta=null}){
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
   setMessage('تم تصدير تقرير عربي بحثي غير معتمد؛ لا يتضمن توصية شراء أو تقييمًا مرخصًا.');
  }catch(e){setMessage('تعذر إصدار التقرير البحثي العربي: '+String(e?.message||e));}
 };
 const exportJson=()=>{
  try{
   const blob=new Blob([JSON.stringify({...bundle,aiAdvisory:safeMemo},null,2)],
    {type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');
   link.href=url;link.download='STARTAK_Unified_Research_Brief.json';document.body.appendChild(link);
   link.click();link.remove();URL.revokeObjectURL(url);
   setMessage('تم تصدير تقرير بحثي مع حدود الثقة؛ لا يتضمن قيمة سوقية معتمدة.');
  }catch(e){setMessage('تعذر تصدير التقرير البحثي: '+String(e?.message||e));}
 };
 return <section data-testid="research-evidence-fusion" dir="rtl"
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-amber-700 bg-slate-950 p-4 text-slate-100">
  <div className="flex flex-wrap justify-between gap-2">
   <div><h3 className="font-bold text-base">STARTAK — ربط أدلة السوق متعددة المصادر</h3>
    <p className="mt-2 text-xs text-slate-300">عرض بحثي واحد؛ لا يصدر تقييمًا مهنيًا ولا توصية شراء دون أدلة.</p></div>
   <span data-testid="fusion-status" className="text-xs text-amber-200">
     قيد التحقق — HOLD</span>
  </div>
  <p className="mt-3 text-xs text-slate-300" data-testid="fusion-subject">
   العقار: {subject.city||'غير محدد'} / {subject.district||'الحي غير محدد'} |
   التاريخ: {asOf}</p>
  <div data-testid="fusion-statistics" className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
   <div className="rounded border border-slate-700 p-2">السجلات البحثية: {result.validResearchRows}</div>
   <div className="rounded border border-slate-700 p-2">سجلات نطاق الحي: {result.subjectAreaRows}</div>
   <div className="rounded border border-slate-700 p-2">
    تكرارات محتملة: {result.possibleCrossSourceDuplicates.length+result.possibleRepeatedObservations}</div>
   <div className="rounded border border-slate-700 p-2">صفقات منفذة مثبتة: {result.verifiedExecutedSales}</div>
  </div>
  <p className="mt-3 text-xs text-slate-300">مطابقة الحي لا تثبت تطابق العقار أو ملكيته؛
   يلزم معرّف عقاري أو مخطط وقطعة موثقان. كما لا تُمزج مؤشرات الأحياء بالقيم المعلنة.</p>
  <div data-testid="fusion-source-readiness" className="mt-2 text-xs text-slate-300">
   {result.feedReadiness.map(x=><p key={x.feed}>{x.feed}: {x.importedResearchRows} سجل بحثي؛
    API مباشر غير متصل، صحة المصدر الفردي غير مثبتة</p>)}
  </div>
  {result.sourceRefs.length>0?<p className="mt-2 text-xs break-words">
   المصادر المتعلقة بالحي: {result.sourceRefs.join('، ')}</p>:null}
  <p data-testid="fusion-risk-codes" className="mt-2 text-xs text-amber-200">
    قيود الفحص: {result.risks.join(' | ')}
  </p>
  <div className="mt-3 rounded border border-slate-700 p-3 text-xs">
   <p className="font-bold">مراجعة التقييم والاستثمار</p>
   <p className="mt-1">حسابات السوق المعتمدة: غير متاحة من هذه البيانات البحثية.</p>
   <p>سقف الشراء: غير محسوب؛ يحتاج نموذج التدفقات النقدية والعائد المستهدف وبيانات معتمدة.</p>
   <p>توصية الاستثمار: تعليق القرار لحين التحقق، مع استمرار المحاكاة الداخلية.</p>
   <p className="mt-1">حالة محرك التقييم الحالي: {readinessStatus}</p>
   <p data-testid="fusion-open-data-annex" className="mt-2">
    مرجع وزارة العدل التاريخي المفتوح:
    {bundle.openDataAnnex.status==='NOT_LOADED'?' لم يُحمّل بعد':
    ' '+bundle.openDataAnnex.status}.
    {Number.isFinite(bundle.openDataAnnex.medianNeighborhoodSarSqm)?
     ' وسيط تاريخي للحي '+new Intl.NumberFormat('ar-SA').format(
       bundle.openDataAnnex.medianNeighborhoodSarSqm)+' ر.س/م² (ليس قيمة العقار).':''}
   </p>
   <p data-testid="fusion-scenario-annex" className="mt-2">
    ملحق سيناريو الحسابات الحالية (مدخلات غير موثقة):
    {Number.isFinite(bundle.scenarioAnnex.previewValuesSar.todayValueScenarioSar)?
     ' القيمة التصورية '+new Intl.NumberFormat('ar-SA').format(
       bundle.scenarioAnnex.previewValuesSar.todayValueScenarioSar)+' ريال':' لا توجد قيمة تصورية مكتملة'}.
    لا تعادل القيمة السوقية المعتمدة ولا سقف شراء.
   </p>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" data-testid="fusion-export" onClick={exportJson}
    className="rounded border border-slate-500 px-3 py-2 text-xs">تصدير حزمة البحث JSON</button>
   <button type="button" data-testid="fusion-export-html" onClick={exportHtml}
    className="rounded border border-slate-500 px-3 py-2 text-xs">تقرير بحث عقاري واستثماري عربي HTML</button>
  </div>
  {message&&<p role="status" className="mt-2 text-xs text-sky-200">{message}</p>}
 </section>;
}