'use strict';
// Personal owner-only research export. This is not a professional valuation,
// official executed-sale verification, source-rights attestation, or trade authority.
const {sha256Hex}=require('../crypto/sha256');
const {canonicalState}=require('./personal-sector-case-archive');
const {evaluatePersonalSectorScenarios,STATUS}=require('./personal-sector-scenario-workbench');
const {VALUATION_METHOD}=require('./contracts');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');
const {researchReason,researchEnumLabel}=require('../i18n/personal-research-presentation');
const VERSION='PERSONAL_SECTOR_RESEARCH_REPORT_V1';
const PURPOSE='PERSONAL_NON_CERTIFIED_SECTOR_RESEARCH';
const MAX_REPORT_BYTES=128*1024;
function fail(code){throw Object.assign(new Error(code),{code});}
function calculatePersonalSectorCase(raw){
 const state=canonicalState(raw);
 const {assetClass,subject,methods,inc,cost,comparables,marketOptions,policy}=state;
 const income=methods.income?{
  annualEffectivePropertyIncome:parseAmount(inc.gross),
  annualPropertyOperatingExpenses:parseAmount(inc.opex),
  capRate:parseAmount(inc.cap),expenseTreatment:inc.expenseTreatment,
  realEstateOnlyConfirmed:inc.realEstateOnly,
  groundLeaseEvidenceConfirmed:inc.groundLease,sharedCostsAllocated:inc.sharedCosts,
 }:null;
 const replacement=methods.cost?{
  landValue:parseAmount(cost.land),replacementBuildingCost:parseAmount(cost.replacement),
  depreciationRate:parseAmount(cost.depreciation),
  businessEquipmentExcluded:cost.excludesBusiness,
 }:null;
 const market=methods.market?{
  unitOfComparison:marketOptions.unit,
  subjectQuantity:parseAmount(marketOptions.quantity),
  businessAssetsExcluded:marketOptions.businessExcluded,
  mixedUseComparableAllocationConfirmed:marketOptions.mixedAllocated,
  comparables:comparables.map(c=>({
   comparableId:c.id,city:c.city,district:c.district,assetClass,
   unitOfComparison:c.unit,propertySubtype:c.subtype,
   propertyRight:c.right,transactionDate:c.date,sourceRef:c.source,
   unitValue:parseAmount(c.unitValue),transactionStatus:c.saleKind,
  })),
 }:null;
 const weights={};
 if(methods.income)weights[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]=parseAmount(policy.incomeWeight);
 if(methods.cost)weights[VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]=parseAmount(policy.costWeight);
 if(methods.market)weights[VALUATION_METHOD.MARKET_COMPARABLE]=parseAmount(policy.marketWeight);
 const reconciliationPolicy=Object.keys(weights).length>=2?{
  maxDispersion:parseAmount(policy.maxDispersion),methodWeights:weights,
 }:null;
 return evaluatePersonalSectorScenarios({
  assetClass,city:subject.city,propertySubtype:subject.subtype,
  subjectDistrict:subject.district,valuationDate:subject.date,
  subjectAreaSqm:parseAmount(subject.area),propertyRight:subject.right,
  income,cost:replacement,market,reconciliationPolicy,
 });
}
function snapshot(value){
 if(Array.isArray(value))return value.map(snapshot);
 if(value&&typeof value==='object')return Object.fromEntries(
  Object.keys(value).map(k=>[k,snapshot(value[k])]));
 if(typeof value==='number'&&!Number.isFinite(value))fail('REPORT_INVALID_NUMBER');
 if(value===undefined)fail('REPORT_UNDEFINED_FIELD');
 return value;
}
function iso(value){
 const d=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(d.getTime()))fail('REPORT_DATE_INVALID');
 return d.toISOString();
}
function checkClaims(result){
 if(!result||!Object.values(STATUS).includes(result.status)||
  result.marketSalesIndependentlyVerified!==false||
  result.professionalValuationCertified!==false||
  result.transactionAuthorized!==false||
  result.commercialReportAuthorized!==false||
  result.automaticPurchasePriceRecommendation!==false)fail('REPORT_AUTHORITY_VIOLATION');
 if(result.status!==STATUS.RECONCILED&&result.provisionalReconciledAmountSar!==null)
  fail('REPORT_RECONCILIATION_WHILE_HELD');
}
function buildPersonalSectorResearchReport(raw,{generatedAt=new Date()}={}){
 const state=canonicalState(raw);
 const result=snapshot(calculatePersonalSectorCase(state));
 checkClaims(result);
 const core={
  version:VERSION,purpose:PURPOSE,generatedAt:iso(generatedAt),currency:'SAR',
  assetClass:state.assetClass,propertyRight:state.subject.right,
  valuationDate:state.subject.date,studyInputs:state,
  inputFingerprintSha256:sha256Hex(JSON.stringify(state)),
  result,
  independentlyVerified:false,professionalAppraisalClaim:false,
  transactionAuthorityClaim:false,externalGoLiveAuthorized:false,
  caveat:'Owner-entered research assumptions and sale declarations are NOT independently verified. HOLD does not authorize a value or transaction.',
 };
 const report={...core,reportHashSha256:sha256Hex(JSON.stringify(core))};
 if(new TextEncoder().encode(JSON.stringify(report)).length>MAX_REPORT_BYTES)
  fail('REPORT_TOO_LARGE');
 return Object.freeze(report);
}
function verifyPersonalSectorResearchReport(r){
 if(!r||typeof r!=='object'||Array.isArray(r))return false;
 try{
  const {reportHashSha256,...core}=r;
  if(Object.keys(r).length!==16||r.version!==VERSION||r.purpose!==PURPOSE||
   !/^[a-f0-9]{64}$/.test(reportHashSha256||'')||
   r.professionalAppraisalClaim!==false||r.independentlyVerified!==false||
   r.transactionAuthorityClaim!==false||r.externalGoLiveAuthorized!==false||
   r.currency!=='SAR')return false;
  if(reportHashSha256!==sha256Hex(JSON.stringify(core)))return false;
  const reconstructed=buildPersonalSectorResearchReport(r.studyInputs,{generatedAt:r.generatedAt});
  return JSON.stringify(reconstructed)===JSON.stringify(r);
 }catch{return false;}
}
function escapeHtml(s){
 return String(s??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
 })[ch]);
}
function renderPersonalSectorResearchHtml(report,{locale='ar-SA'}={}){
 if(!verifyPersonalSectorResearchReport(report))fail('REPORT_DIGEST_OR_RECOMPUTATION_INVALID');
 const ar=locale!=='en',h=escapeHtml,inputs=report.studyInputs,res=report.result;
 const title=ar?'تقرير دراسة عقارية قطاعية شخصية — غير معتمد':'Personal sector real estate study — unverified';
 const original=value=>'<span data-user-content translate="no">'+h(value)+'</span>';
 const coded=value=>value?'<span>'+h(researchEnumLabel(value,locale))+'</span> <code dir="ltr" data-diagnostic-content translate="no">'+h(value)+'</code>':'—';
 const row=(a,b,kind='text')=>'<tr><th>'+h(a)+'</th><td>'+(kind==='enum'?coded(b):kind==='original'?original(b):kind==='code'?'<code dir="ltr" data-diagnostic-content translate="no">'+h(b)+'</code>':h(b))+'</td></tr>';
 const money=n=>typeof n==='number'&&Number.isFinite(n)?
  n.toLocaleString(ar?'ar-SA':'en-US',{maximumFractionDigits:2})+(ar?' ر.س':' SAR'):'—';
 const declaration=v=>v?(ar?'نعم — بحسب إقرار المستخدم':'Yes — user-declared'):(ar?'لا / غير مؤكد':'No / unconfirmed');
 const summary=[
  row(ar?'نوع التقرير':'Report type',report.purpose,'enum'),
  row(ar?'إصدار التقرير':'Report schema version',report.version,'code'),
  row(ar?'إصدار محرك الحساب':'Calculation model version',res.version,'code'),
  row(ar?'أساس القيمة المستقل':'Independently supported valuation basis',
   ar?'غير مثبت — هذه مؤشرات بحثية وليست قيمة سوقية معتمدة':'NOT_ESTABLISHED — arithmetic research only'),
  row(ar?'مصدر البيانات':'Market input provenance',
   ar?'إقرارات ومدخلات المستخدم، دون تحقق مستقل':'User-declared and user-entered, not independently verified'),
  row(ar?'القطاع':'Asset class',report.assetClass,'enum'),
  row(ar?'المدينة':'City',inputs.subject.city,'original'),
  row(ar?'الحي':'District',inputs.subject.district,'original'),
  row(ar?'النوع التفصيلي':'Subtype',inputs.subject.subtype,'original'),
  row(ar?'المساحة المدخلة':'Entered area',inputs.subject.area,'original'),
  row(ar?'الحق العقاري':'Property right',report.propertyRight,'enum'),
  row(ar?'تاريخ الدراسة':'Valuation date',report.valuationDate),
  row(ar?'حالة الحساب':'Calculation status',res.status,'enum'),
  row(ar?'الترجيح الحسابي الأولي':'Unverified method reconciliation',money(res.provisionalReconciledAmountSar)),
  row(ar?'تاريخ إنشاء النسخة':'Generated at',report.generatedAt,'code'),
 ];
 const methodRows=res.methods.map(m=>'<tr><td>'+coded(m.method)+'</td><td>'+
  h(money(m.scenarioAmountSar))+'</td><td>'+h(money(m.netOperatingIncomeSar))+
  '</td><td>'+coded(m.status)+'</td></tr>').join('');
 const reasons=res.reasonCodes.map(code=>'<li>'+h(researchReason(code,locale).message)+
  ' — <code dir="ltr" data-diagnostic-content translate="no">'+h(code)+'</code></li>').join('');
 const comparableRows=inputs.comparables.map(c=>'<tr><td>'+original(c.id)+'</td><td>'+
  coded(c.saleKind||'UNSPECIFIED')+'</td><td>'+original(c.source)+'</td><td>'+
  original(c.date)+'</td><td>'+original(c.city)+'</td><td>'+original(c.district)+'</td><td>'+
  original(c.subtype)+'</td><td>'+coded(c.right)+'</td><td>'+coded(c.unit)+'</td><td>'+
  original(c.unitValue)+'</td></tr>').join('');
 const declarations=[
  row(ar?'طريقة الدخل':'Income method selected',declaration(inputs.methods.income)),
  row(ar?'الدخل المعلن':'Declared gross property income',inputs.inc.gross,'original'),
  row(ar?'المصروفات المعلنة':'Declared OPEX',inputs.inc.opex,'original'),
  row(ar?'معدل الرسملة المدخل':'Entered capitalization rate',inputs.inc.cap,'original'),
  row(ar?'سياسة تحمل مصروفات العقار':'Operating expense treatment',inputs.inc.expenseTreatment,'enum'),
  row(ar?'فصل دخل العقار عن النشاط':'Property-only income declaration',declaration(inputs.inc.realEstateOnly)),
  row(ar?'إثبات دخل إيجار الأرض':'Ground-lease evidence declaration',declaration(inputs.inc.groundLease)),
  row(ar?'توزيع المصروفات المشتركة':'Shared expenses allocated',declaration(inputs.inc.sharedCosts)),
  row(ar?'طريقة التكلفة':'Cost method selected',declaration(inputs.methods.cost)),
  row(ar?'قيمة الأرض المدخلة':'Entered land amount',inputs.cost.land,'original'),
  row(ar?'تكلفة الاستبدال المدخلة':'Entered replacement cost',inputs.cost.replacement,'original'),
  row(ar?'نسبة الاستهلاك المدخلة':'Entered depreciation',inputs.cost.depreciation,'original'),
  row(ar?'استبعاد معدات وأعمال النشاط من التكلفة':'Business equipment excluded from cost',declaration(inputs.cost.excludesBusiness)),
  row(ar?'طريقة المقارنات':'Comparable method selected',declaration(inputs.methods.market)),
  row(ar?'وحدة المقارنة':'Comparison unit',inputs.marketOptions.unit,'enum'),
  row(ar?'كمية وحدات المقارنة المدخلة':'Entered comparison quantity',inputs.marketOptions.quantity,'original'),
  row(ar?'استبعاد قيمة التشغيل من المقارنات':'Operating business excluded from comparables',declaration(inputs.marketOptions.businessExcluded)),
  row(ar?'توزيع قيمة المجمع متعدد الاستخدامات':'Mixed-use comparable allocation declared',declaration(inputs.marketOptions.mixedAllocated)),
  row(ar?'حد تشتت الطرق':'Method dispersion threshold',inputs.policy.maxDispersion,'original'),
  row(ar?'وزن طريقة الدخل':'Income method weight',inputs.policy.incomeWeight,'original'),
  row(ar?'وزن طريقة التكلفة':'Cost method weight',inputs.policy.costWeight,'original'),
  row(ar?'وزن طريقة المقارنات':'Market comparison method weight',inputs.policy.marketWeight,'original'),
 ];
 const css='body{font-family:Tahoma,Arial,sans-serif;max-width:1050px;margin:2rem auto;padding:1rem;color:#152034}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #abb8c7;padding:.55rem;text-align:start;vertical-align:top;overflow-wrap:anywhere}th{background:#eef2f5}h1,h2{color:#193652}small{color:#546578}@media print{@page{size:A4 landscape;margin:10mm}body{margin:0;padding:0;font-size:10pt}table{font-size:8pt;table-layout:fixed}th,td{padding:.3rem;overflow-wrap:anywhere}tr{break-inside:avoid}}';
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+
  '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;">'+
  '<title>'+h(title)+'</title><style>'+css+'</style></head><body><h1>'+h(title)+'</h1>'+
  '<p><strong>'+h(ar?'دراسة شخصية فقط: لا اعتماد مهني ولا إثبات مستقل لصحة الصفقات أو تصريح بالشراء.':'Personal research only: no licensed valuation, independent sale verification or transaction authority.')+'</strong></p>'+
  '<h2>'+h(ar?'ملخص الأصل والنتائج':'Asset and results')+'</h2><table>'+summary.join('')+
  '</table><h2>'+h(ar?'الافتراضات المدخلة':'Entered assumptions')+'</h2><table>'+declarations.join('')+
  '</table><h2>'+h(ar?'مؤشرات طرق التقييم':'Valuation method indications')+
  '</h2><table><tr><th>'+h(ar?'الطريقة':'Method')+'</th><th>'+h(ar?'المؤشر (ريال)':'Scenario amount (SAR)')+
  '</th><th>'+h(ar?'صافي دخل العقار (ريال)':'Property NOI (SAR)')+
  '</th><th>'+h(ar?'تصنيف النتيجة':'Status')+'</th></tr>'+methodRows+
  '</table><h2>'+h(ar?'سجل المقارنات المصرح بها':'Owner-declared comparable record')+
  '</h2><p><small>'+h(ar?'كل المراجع والحالات أدناه إقرارات من المستخدم، وليست سجلات صفقات موثقة من مصدر مستقل.':
    'All source references and sale statuses are supplied by the user and are not authenticated.')+
  '</small></p><table><tr>'+
  [ar?'رقم الصفقة':'Sale ID',ar?'حالة الصفقة':'Declared status',
   ar?'مرجع المصدر المصرح':'User source reference',ar?'تاريخ الصفقة':'Sale date',
   ar?'المدينة':'City',ar?'الحي':'District',ar?'نوع العقار':'Subtype',
   ar?'الحق العقاري':'Property right',ar?'وحدة المقارنة':'Comparison unit',
   ar?'القيمة لكل وحدة':'Amount per unit'].map(x=>'<th>'+h(x)+'</th>').join('')+
  '</tr>'+comparableRows+
  '</table><h2>'+h(ar?'أسباب الحجب والتحفظات':'HOLD and warnings')+'</h2><ul>'+reasons+
  '</ul><p><small>'+h(ar?'افتراضات البحث والصفقات إقرارات المستخدم ولم تُتحقق مستقلاً. الحجب لا يفوض قيمة أو معاملة.':report.caveat)+'</small></p>'+
  '<p><small>'+h(ar?'بصمة المدخلات':'Input digest')+' <code dir="ltr" translate="no">SHA-256: '+h(report.inputFingerprintSha256)+
  '</code> | '+h(ar?'بصمة التقرير':'Report digest')+' <code dir="ltr" translate="no">SHA-256: '+h(report.reportHashSha256)+'</code></small></p></body></html>';
}
module.exports={VERSION,PURPOSE,MAX_REPORT_BYTES,calculatePersonalSectorCase,
 buildPersonalSectorResearchReport,verifyPersonalSectorResearchReport,renderPersonalSectorResearchHtml};
