import React, {useEffect,useMemo,useState} from 'react';
import {useAppraisalReviewSession} from './AppraisalReviewSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel,assuranceMoney}=require('../i18n/assurance-workflow-presentation');
const {bindReview,validateIdentity}=require('../market/appraisal-study-binding');
const {auditAppraisal,compareVersions}=require('../market/appraisal-assurance');

// The user must manually transcribe and check every value against the original page.
// This component neither uploads documents nor stores data persistently.
const fresh=()=>({
 reportId:'',valuationDate:'',property:{name:'',assetType:'',deedNumber:'',owner:'',rightType:'',areaSqm:''},
 reported:{capitalValueSar:'',marketRentSar:''},
 income:{annualGrossRevenueSar:'',vacancyLossSar:'',operatingExpensesSar:'',annualNoiSar:'',
   capitalizationRatePct:'',indicatedValueSar:'',rentUsesThisEstimate:false,leaseStructure:''},
 marketRent:{annualRentSar:'',capitalValueBasisSar:'',percentOfCapitalValue:'',derivation:'',
   usedAsIncomeApproachEvidence:false},
 sectorEvidence:{},
 pages:{income:'',rent:''}
});
const fields=[
 ['reportId','رقم تقرير التقييم','text'],
 ['property.name','اسم العقار المطابق لدراسة السوق','text'],
 ['property.assetType','رمز نوع الأصل المطابق لدراسة السوق','text'],
 ['valuationDate','تاريخ القيمة (ميلادي)','date'],
 ['property.deedNumber','رقم الصك (اختياري في هذه الدراسة)','text'],
 ['property.owner','اسم المالك (اختياري)','text'],
 ['property.areaSqm','مساحة العقار م²','text'],
 ['reported.capitalValueSar','القيمة الرأسمالية الواردة (ريال)','text'],
 ['reported.marketRentSar','الإيجار السنوي الوارد (ريال)','text'],
 ['income.annualGrossRevenueSar','الإيراد التشغيلي الإجمالي السنوي (ريال)','text'],
 ['income.vacancyLossSar','فاقد الشواغر السنوي (ريال)','text'],
 ['income.operatingExpensesSar','مصروفات المالك التشغيلية السنوية (ريال)','text'],
 ['income.annualNoiSar','صافي الدخل التشغيلي السنوي NOI (ريال)','text'],
 ['income.capitalizationRatePct','معدل الرسملة (%)','text'],
 ['income.indicatedValueSar','القيمة المعلنة بأسلوب الدخل (ريال)','text'],
 ['marketRent.annualRentSar','الإيجار السنوي المستخدم للتقدير (ريال)','text'],
 ['marketRent.capitalValueBasisSar','القيمة المستخدمة أساسًا لاشتقاق الإيجار (ريال)','text'],
 ['marketRent.percentOfCapitalValue','نسبة اشتقاق الإيجار من القيمة (%)','text'],
 ['pages.income','رقم صفحة حساب الدخل في الأصل','text'],
 ['pages.rent','رقم صفحة حساب الإيجار في الأصل','text'],
];
const descriptions=Object.freeze({
 INCOME_CAPITALIZATION_MISMATCH:'تعارض بين قيمة أسلوب الدخل وحاصل قسمة NOI على معدل الرسملة.',
 NOI_RECONCILIATION_MISMATCH:'صافي الدخل لا يساوي الإيراد الإجمالي ناقص الشواغر والمصروفات.',
 RENT_DERIVED_FROM_CAPITAL_NOT_MARKET_EVIDENCE:'الإيجار مشتق من القيمة، وليس شاهدًا سوقيًا مستقلًا.',
 CIRCULAR_VALUATION:'استُخدم إيجار مشتق من القيمة لإثبات القيمة ذاتها؛ استدلال دائري.',
 RENT_PERCENTAGE_ARITHMETIC_MISMATCH:'الإيجار لا يطابق القيمة × النسبة.',
 ZERO_OPERATING_COST_UNSUPPORTED:'مصروفات المالك صفر دون دليل لعقد يحمل المستأجر المصروفات.',
 INDEPENDENT_MARKET_EVIDENCE_NOT_VERIFIED:'لم يجر التحقق الخارجي من المقارنات السوقية.',
 VALUATION_DATE_MISSING:'تاريخ القيمة غير مدخل.',
 FILE_PROVENANCE_MISSING:'لا توجد بصمة مستند مصدر للتحقق من النسخة.',
 INVALID_NUMERIC_INPUT:'يوجد رقم غير صالح أو صفر غير مسموح به.',
 CAP_RATE_INVALID:'معدل الرسملة غير صالح.',
 OWNER_NAME_CHANGED:'تغير اسم المالك بين النسختين؛ يلزم مطابقة حقوق الملكية.',
 REPORT_IDENTITY_COLLISION:'رقم التقرير ذاته يرتبط بصكين مختلفين؛ لا يجوز دمج النسختين.',
 REPORT_ID_MISMATCH:'رقم التقرير مختلف؛ لا تجوز مقارنة عقارين على أنهما نسختان.',
 DEPENDENT_VALUE_UNCHANGED:'تغير افتراض مالي دون تغير القيمة النهائية؛ يلزم توثيق التسوية.',
 SPECIALIST_EVIDENCE_HOLD:'البيانات التشغيلية والمستندية القطاعية غير مكتملة أو لا تتطابق. لا تجوز رسملة ربح النشاط التجاري باعتباره صافي دخل عقاري.',
});
const at=(obj,path)=>path.split('.').reduce((a,b)=>a?.[b],obj);
function update(obj,path,value){
 const chunks=path.split('.');const o={...obj};let x=o,y=obj;
 for(let i=0;i<chunks.length-1;i++){const key=chunks[i];x[key]={...(y?.[key]||{})};y=y?.[key];x=x[key];}
 x[chunks[chunks.length-1]]=value;return o;
}
function FieldSet({stage,setStage,prefix}){
 const {locale}=useLocale();
 const L=value=>assuranceLabel(value,locale);
 return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {fields.map(([path,label,type])=><label key={path} className="block text-xs text-slate-200">{L(label)}
    <input type={type} data-testid={prefix+'-'+path.replace(/\./g,'-')} aria-label={L(label)}
      inputMode={type==='text' && path.includes('Sar')?'decimal':undefined}
      dir={type==='date'?'ltr':'auto'} value={at(stage,path)??''}
      onChange={e=>setStage(s=>update(s,path,e.target.value))}
      className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
   </label>)}
  <label className="block text-xs text-slate-200">{L("مصدر الإيجار")}
   <select aria-label={L("مصدر الإيجار")} value={stage.marketRent.derivation}
    onChange={e=>setStage(s=>update(s,'marketRent.derivation',e.target.value))}
    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm">
    <option value="">{L("غير محدد / يلزم توثيق")}</option>
    <option value="INDEPENDENT_LEASES">{L("عقود أو مقارنات مستقلة (إقرار دون تحقق)")}</option>
    <option value="CAPITAL_VALUE_PERCENTAGE">{L("نسبة من القيمة الرأسمالية")}</option>
   </select>
  </label>
  <label className="flex items-center gap-2 self-center text-xs text-slate-200">
   <input type="checkbox" checked={stage.income.rentUsesThisEstimate===true}
    onChange={e=>setStage(s=>update(s,'income.rentUsesThisEstimate',e.target.checked))}/>
   {L("استُخدم هذا الإيجار نفسه لحساب قيمة أسلوب الدخل")}
  </label>
  <label className="flex items-center gap-2 self-center text-xs text-slate-200">
   <input type="checkbox" checked={stage.income.leaseStructure==='EVIDENCED_TRIPLE_NET'}
    onChange={e=>setStage(s=>update(s,'income.leaseStructure',e.target.checked?'EVIDENCED_TRIPLE_NET':''))}/>
   {L("يدّعي التقرير وجود عقد صافي ثلاثي موثّق (يلزم فحص العقد)")}
  </label>
 </div>;
}

const sectorFields=Object.freeze({
 HOTEL:[
 ['availableRoomNights','الليالي الفندقية المتاحة','number'],['occupiedRoomNights','الليالي المشغولة','number'],
 ['roomRevenueSar','دخل الغرف السنوي','number'],['otherOperatingRevenueSar','الإيرادات التشغيلية الأخرى','number'],
 ['hotelOperatingExpensesSar','مصروفات تشغيل الفندق','number'],['ffAndEReserveSar','احتياطي الأثاث والمعدات','number'],
 ['operatingBusinessExclusionSar','دخل النشاط التجاري المستبعد','number'],['realPropertyNoiSar','NOI العقار بعد استبعاد النشاط','number'],
 ['operatingStatementRef','مرجع قائمة التشغيل','ref'],['managementAgreementRef','مرجع عقد المشغل','ref'],
 ['specialistReviewRef','مرجع المراجع المتخصص','ref'],
 ['realEstateAndOperatingBusinessSeparated','الفصل بين العقار والنشاط التجاري','boolean']],
 COMMERCIAL_MALL:[
 ['grossLeasableAreaSqm','إجمالي المساحة التأجيرية GLA','number'],['leasedAreaSqm','المساحة المؤجرة','number'],
 ['annualBaseRentSar','الإيجارات الأساسية السنوية','number'],['annualTurnoverRentSar','إيجار نسب المبيعات','number'],
 ['annualOtherPropertyRevenueSar','إيرادات عقارية إضافية','number'],['vacancyLossSar','فاقد الشواغر','number'],
 ['landlordOperatingExpensesSar','مصروفات المالك','number'],['realPropertyNoiSar','NOI العقاري','number'],
 ['rentRollRef','مرجع جدول المستأجرين','ref'],['serviceChargeAllocationRef','مرجع توزيع المصروفات المشتركة','ref'],
 ['specialistReviewRef','مرجع المراجع المتخصص','ref'],['tenantMixAndConcentrationReviewed','تمت مراجعة توزيع المستأجرين','boolean']],
 WAREHOUSE:[
 ['builtAreaSqm','مساحة المباني','number'],['netLeasableAreaSqm','المساحة التأجيرية الصافية','number'],
 ['clearHeightMeters','الارتفاع الصافي بالمتر','number'],['annualPropertyRentSar','دخل الإيجار العقاري','number'],
 ['landlordOperatingExpensesSar','مصروفات المالك','number'],['realPropertyNoiSar','NOI العقاري','number'],
 ['buildingPermitRef','مرجع رخصة البناء','ref'],['fireSafetyRef','مرجع سلامة الحريق','ref'],
 ['leaseEvidenceRef','مرجع عقود الإيجار','ref'],['specialistReviewRef','مرجع المراجع المتخصص','ref'],
 ['permittedUseAndFireSafetyVerified','تمت مراجعة التصاريح والحريق','boolean'],
 ['loadingAndUtilitiesReviewed','تمت مراجعة التحميل والخدمات','boolean']],
 FUEL_STATION:[
 ['annualPropertyRentSar','الإيجار السنوي للعقار','number'],['landlordOperatingExpensesSar','مصروفات المالك','number'],
 ['realPropertyNoiSar','NOI العقار','number'],['operatingBusinessIncomeSar','دخل تشغيل الوقود والخدمات (مستبعد)','number'],
 ['operatorLeaseRef','مرجع عقد المشغل','ref'],['environmentalAssessmentRef','مرجع دراسة الالتزامات البيئية','ref'],
 ['titleAndUseRef','مرجع حق العقار والاستخدام','ref'],['specialistReviewRef','مرجع المراجع المتخصص','ref'],
 ['fuelBusinessExcludedFromRealPropertyNoi','تم استبعاد دخل تشغيل الوقود من NOI العقار','boolean'],
 ['environmentalAndTankLiabilityReviewed','تمت مراجعة التزامات الخزانات والبيئة','boolean']]
});
function SpecialistFields({stage,setStage}){
 const {locale}=useLocale();
 const L=value=>assuranceLabel(value,locale);
 const kind=stage.property.assetType==='LOGISTICS_PARK'?'WAREHOUSE':stage.property.assetType;
 const choices=sectorFields[kind];
 if(!choices)return null;
 return <section data-testid="appraisal-specialist-fields" className="rounded-lg border border-amber-700 p-3">
  <h3 className="mb-2 text-sm font-semibold text-amber-100">{L("الحقول القطاعية للعقار المتخصص — مراجعة يدوية")}</h3>
  <p className="mb-3 text-xs text-slate-300">{L("أدخل أرقامًا من التقرير مع مرجع المستند. اختيار المربعات إقرار إدخال فقط وليس تحققًا مهنيًا. الأرقام تستخدم للفحص الحسابي ولا تولّد قيمة سوقية معتمدة.")}</p>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {choices.map(([key,label,type])=>type==='boolean'?
   <label key={key} className="flex items-center gap-2 text-xs text-slate-200">
    <input data-testid={'sector-'+key} aria-label={L(label)} type="checkbox" checked={stage.sectorEvidence[key]===true}
     onChange={e=>setStage(s=>update(s,'sectorEvidence.'+key,e.target.checked))}/>{L(label)}
   </label>:
   <label key={key} className="text-xs text-slate-200">{L(label)}
    <input data-testid={'sector-'+key} aria-label={L(label)} dir="auto" value={stage.sectorEvidence[key]||''}
     inputMode={type==='number'?'decimal':undefined}
     onChange={e=>setStage(s=>update(s,'sectorEvidence.'+key,e.target.value))}
     className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"/>
   </label>)}
  </div>
 </section>;
}

function IssueRows({items}){
 const {locale}=useLocale();
 const L=value=>assuranceLabel(value,locale);
 return items.length?<ul className="mt-2 space-y-2">
  {items.map((x,i)=><li key={x.code+':'+i} className="rounded border border-slate-700 p-2 text-xs">
   <strong className={x.severity==='BLOCK'?'text-rose-200':'text-amber-200'}>{x.severity==='BLOCK'?L('مانع'):L('للمراجعة')} · <code translate="no" dir="ltr" className="break-all">{x.code}</code></strong>
   <p className="mt-1 text-slate-200">{descriptions[x.code]?L(descriptions[x.code]):<span data-user-content translate="no">{x.detail}</span>}</p>
   {x.pages?.length>0&&<p className="mt-1 text-slate-400">{L("الصفحة المرجعية:")} {x.pages.join('، ')}</p>}
  </li>)}
 </ul>:<p className="text-xs text-slate-300">{L("لم تظهر تعارضات في الحقول المدخلة. هذا لا يعني صحة التقرير أو اكتمال أدلته.")}</p>;
}
export default function AppraisalAssuranceWorkbench({intakeRecord=null}){
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
 const money=value=>Number.isFinite(value)?assuranceMoney(value,locale):'—';
 const {subject:marketSubject,setLink,clearLink}=useAppraisalReviewSession();
 const [open,setOpen]=useState(false);
 const [identityConfirmed,setIdentityConfirmed]=useState(false);
 const [linkMessage,setLinkMessage]=useState(null);
 const [current,setCurrent]=useState(fresh);
 const [previous,setPrevious]=useState(fresh);
 const [compare,setCompare]=useState(false);
 // Reset on any uploaded source change, including clearing the source. No stale report fields cross files.
 const digest=intakeRecord?.digest||'';
 useEffect(()=>{setCurrent(fresh());setPrevious(fresh());setCompare(false);},[digest]);
 useEffect(()=>{clearLink();setIdentityConfirmed(false);setLinkMessage(null);},[current,previous,compare,digest]);
 const reviewed=useMemo(()=>auditAppraisal({
  ...current,
  provenance:{reportFileHash:digest,comparableEvidenceIndependentlyVerified:false},
  pages:{income:Number(current.pages.income),rent:Number(current.pages.rent)},
 }),[current,digest]);
 const diff=useMemo(()=>compare?compareVersions(previous,current):null,[compare,previous,current]);
 const match=useMemo(()=>validateIdentity({subject:marketSubject||{},appraisal:current,documentDigest:digest,confirmed:identityConfirmed}),[marketSubject,current,digest,identityConfirmed]);
 const attach=()=>{
  const result=bindReview({subject:marketSubject||{},appraisal:current,documentDigest:digest,review:reviewed,confirmed:identityConfirmed});
  if(!result.link){setLink(null);setLinkMessage({label:'لم يتم الربط:',reasons:result.reasons});return;}
  setLink(result.link);
  setLinkMessage({label:result.status==='LINKED_AUDIT_HOLD'?'تم الربط مع إيقاف القيمة والتصدير بسبب تعارض التقرير.':'تم ربط التدقيق للدراسة الحالية بإقرار المستخدم، دون تحقق مهني مستقل.'});
 };
 return <section data-testid="appraisal-assurance-workbench" dir={dir}
  className="mx-auto my-6 w-full max-w-7xl px-4 md:px-8">
  <div className="rounded-2xl border border-slate-700 bg-[#101a2d] p-4 text-slate-100 md:p-5">
   <button type="button" aria-expanded={open} aria-controls="appraisal-assurance-details"
    data-testid="appraisal-assurance-toggle" onClick={()=>setOpen(v=>!v)}
    className="flex w-full items-center justify-between gap-3 rounded p-2 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
    <span className="text-base font-bold text-amber-100">{L("تدقيق تقرير التقييم العقاري — مراجعة يدوية آمنة")}</span>
    <span className="text-xs text-slate-300">{open?L('إغلاق'):L('فتح')}</span>
   </button>
   {open&&<div id="appraisal-assurance-details" className="mt-3 space-y-4">
    <p data-diagnostic-content translate="no" className="text-xs leading-6 text-slate-300">{L("أدخل القيم يدويًا بعد مطابقتها مع صفحات الملف الأصلي. لا تُستورد حقول OCR تلقائيًا، ولا تحفظ هذه اللوحة البيانات في الخادم أو الصفقات المحفوظة أو GitHub. نتائجها للتدقيق البحثي فقط وغير معتمدة مهنيًا.")}</p>
    <p className="rounded border border-slate-700 p-2 text-xs text-slate-300">{L("بصمة ملف المستند المحلي:")} {digest?<span data-testid="appraisal-document-hash" className="break-all font-mono" dir="ltr">{digest}</span>:L('لم يُرفق ملف أو لم يكتمل فحصه')}</p>
    <FieldSet stage={current} setStage={setCurrent} prefix="current"/>
    <SpecialistFields stage={current} setStage={setCurrent}/>
    {reviewed.metrics.sectorReview?.applicable&&
     <section data-testid="appraisal-sector-status" data-status={reviewed.metrics.sectorReview.status}
      className="rounded border border-amber-700 p-3 text-xs text-amber-100">
      <strong>{L("تدقيق أدلة الأصل المتخصص:")} <code translate="no" dir="ltr" className="break-all">{reviewed.metrics.sectorReview.status}</code></strong>
      <p className="mt-1">{L("الموانع:")} {reviewed.metrics.sectorReview.blockers.length?<code translate="no" dir="ltr" className="break-all">{reviewed.metrics.sectorReview.blockers.join(', ')}</code>:L('لا توجد موانع حسابية في المدخلات؛ لا يزال الاعتماد المهني غير متاح.')}</p>
     </section>}
    <section data-testid="appraisal-study-link" className="rounded-lg border border-slate-600 p-3 text-xs">
      <h3 className="font-semibold text-amber-100">{L("ربط هذا التدقيق بدراسة السوق الحالية — إقرار مستخدم لا تحقق من الصك")}</h3>
      <p data-testid="appraisal-identity-summary" className="my-2 text-slate-300">{L("هوية دراسة السوق الحالية:")} <span data-user-content translate="no">{marketSubject?.name||L('غير محدد')} · {marketSubject?.assetType||L('غير محدد')}</span> {L("· مساحة الأرض")} <span data-user-content translate="no">{marketSubject?.landArea||L('غير محددة')}</span> {L("م² · تاريخ القيمة")} <span data-user-content translate="no">{marketSubject?.valuationDate||L('غير محدد')}</span>.</p>
      <p className="my-2 text-slate-300">{L("يلزم تطابق اسم العقار ونوعه ومساحة الأرض وتاريخ القيمة تمامًا، ووجود ملف ببصمة SHA-256، بالإضافة إلى إقرار المستخدم. أي اختلاف لاحق سيوقف النتائج المرتبطة تلقائيًا.")}</p>
      <label className="inline-flex items-center gap-2 text-slate-200"><input type="checkbox" data-testid="appraisal-confirm-identity" checked={identityConfirmed} onChange={e=>setIdentityConfirmed(e.target.checked)}/>{L("أقر أن بيانات التقرير تطابق العقار محل دراسة السوق.")}</label>
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <button type="button" data-testid="appraisal-link-to-study" disabled={match.status==='HOLD'} onClick={attach}
          className="rounded border border-amber-500 px-3 py-2 text-amber-100 disabled:opacity-40">{L("ربط نتيجة التدقيق بدراسة السوق")}</button>
        <span data-testid="appraisal-identity-status" data-status={match.status} className="text-slate-300">{match.status==='HOLD'?<>{L('الربط غير مستوفٍ:')} <code translate="no" dir="ltr" className="break-all">{match.reasons.join(', ')}</code></>:L('الهوية متطابقة بإقرار المستخدم فقط')}</span>
      </div>
      {linkMessage&&<p data-testid="appraisal-link-message" role="status" className="mt-2 text-amber-200">{L(linkMessage.label)} {linkMessage.reasons&&<code translate="no" dir="ltr" className="break-all">{linkMessage.reasons.join(', ')}</code>}</p>}
    </section>
    <div data-testid="appraisal-audit-status" data-status={reviewed.status} role="status"
      className={'rounded border p-3 '+(reviewed.status==='HOLD'?'border-rose-700 text-rose-100':'border-amber-700 text-amber-100')}>
     <strong><code>{reviewed.status==='HOLD'?'HOLD':'REVIEW_REQUIRED'}</code> — {locale==='en'?(reviewed.status==='HOLD'?'Calculation or methodology blockers remain':'Professional report integrity has not been established'):(reviewed.status==='HOLD'?'توجد موانع حسابية أو منهجية':'لم تثبت سلامة التقرير مهنيًا')}</strong>
     <p className="mt-1 text-xs">{locale==='en'?'Professional certification: ':'التصديق المهني: '}<code>NOT_AUTHORIZED</code>. {locale==='en'?'An official appraisal report cannot be issued.':'إصدار تقرير تقييم رسمي غير متاح.'}</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
     <div className="rounded border border-slate-700 p-3 text-sm">{L("القيمة التي تنتج عن NOI / معدل الرسملة")}
      <strong data-testid="appraisal-calculated-value" className="mt-1 block">{money(reviewed.metrics.capitalizedIncomeValueSar)}</strong>
     </div>
     <div className="rounded border border-slate-700 p-3 text-sm">{L("فرق قيمة أسلوب الدخل")}
      <strong className="mt-1 block">{money(reviewed.metrics.incomeArithmeticDifferenceSar)}</strong>
     </div>
    </div>
    <section data-testid="appraisal-issues" aria-label={L("ملاحظات التدقيق")}>
     <h3 className="text-sm font-semibold">{L("نتائج فحص المعادلات والمصادر")}</h3>
     <IssueRows items={reviewed.issues}/>
    </section>
    <div className="rounded-lg border border-slate-700 p-3">
     <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" data-testid="appraisal-version-compare" checked={compare} onChange={e=>setCompare(e.target.checked)}/>
      {L("لدي نسخة أخرى من التقرير وأريد فحص الفروق")}
     </label>
     {compare&&<div className="mt-3 space-y-3">
      <h3 className="text-sm font-semibold">{L("النسخة السابقة — إدخال يدوي")}</h3>
      <FieldSet stage={previous} setStage={setPrevious} prefix="previous"/>
      <section data-testid="appraisal-version-differences" aria-label={L("اختلافات النسخ")}>
       <h3 className="text-sm font-semibold">{L("تسوية النسخ:")} <code translate="no" dir="ltr" className="break-all">{diff?.status}</code></h3>
       <IssueRows items={diff?.flags||[]}/>
       <ul className="mt-2 space-y-1 text-xs">
        {(diff?.changed||[]).map(r=><li data-user-content translate="no" key={r.path} className="break-all border-b border-slate-700 py-1">
         {r.path}: <span className="text-slate-400">{String(r.previous??'—')}</span> ← {String(r.current??'—')}
        </li>)}
       </ul>
       <p className="mt-2 text-xs text-amber-200">{L("لا تختار STARTAK النسخة الأحدث تلقائيًا ولا تجمع قيم النسخ في المحفظة.")}</p>
      </section>
     </div>}
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>{setCurrent(fresh());setPrevious(fresh());setCompare(false);clearLink();}}
       data-testid="appraisal-reset" className="rounded border border-slate-500 px-3 py-2 text-xs">{L("مسح مدخلات التدقيق المحلية")}</button>
     <p className="self-center text-xs text-slate-400">{L("لا يوجد زر اعتماد أو تصدير تقرير مهني.")}</p>
    </div>
   </div>}
  </div>
 </section>;
}
