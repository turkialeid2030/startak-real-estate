'use strict';
// Personal owner-only research export. This is not a professional valuation,
// official executed-sale verification, source-rights attestation, or trade authority.
const {sha256Hex}=require('../crypto/sha256');
const {canonicalState}=require('./personal-sector-case-archive');
const {evaluatePersonalSectorScenarios,STATUS}=require('./personal-sector-scenario-workbench');
const {VALUATION_METHOD}=require('./contracts');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');
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
 const row=(a,b)=>'<tr><th>'+h(a)+'</th><td>'+h(b)+'</td></tr>';
 const money=n=>typeof n==='number'&&Number.isFinite(n)?
  n.toLocaleString(ar?'ar-SA':'en-US',{maximumFractionDigits:2})+' SAR':'—';
 const summary=[
  row(ar?'القطاع':'Asset class',report.assetClass),
  row(ar?'المدينة':'City',inputs.subject.city),
  row(ar?'الحي':'District',inputs.subject.district),
  row(ar?'النوع التفصيلي':'Subtype',inputs.subject.subtype),
  row(ar?'المساحة المدخلة':'Entered area',inputs.subject.area),
  row(ar?'الحق العقاري':'Property right',report.propertyRight),
  row(ar?'تاريخ الدراسة':'Valuation date',report.valuationDate),
  row(ar?'حالة الحساب':'Calculation status',res.status),
  row(ar?'الترجيح الحسابي الأولي':'Unverified method reconciliation',money(res.provisionalReconciledAmountSar)),
  row(ar?'تاريخ إنشاء النسخة':'Generated at',report.generatedAt),
 ];
 const methodRows=res.methods.map(m=>'<tr><td>'+h(m.method)+'</td><td>'+
  h(money(m.scenarioAmountSar))+'</td><td>'+h(m.status)+'</td></tr>').join('');
 const reasons=res.reasonCodes.map(code=>'<li>'+h(code)+'</li>').join('');
 const comparableRows=inputs.comparables.map(c=>'<tr><td>'+h(c.id)+'</td><td>'+
  h(c.saleKind||'UNSPECIFIED')+'</td><td>'+h(c.source)+'</td><td>'+
  h(c.date)+'</td><td>'+h(c.unitValue)+'</td></tr>').join('');
 const declarations=[
  row(ar?'طريقة الدخل':'Income method selected',String(inputs.methods.income)),
  row(ar?'الدخل المعلن':'Declared gross property income',inputs.inc.gross),
  row(ar?'المصروفات المعلنة':'Declared OPEX',inputs.inc.opex),
  row(ar?'معدل الرسملة المدخل':'Entered capitalization rate',inputs.inc.cap),
  row(ar?'طريقة التكلفة':'Cost method selected',String(inputs.methods.cost)),
  row(ar?'قيمة الأرض المدخلة':'Entered land amount',inputs.cost.land),
  row(ar?'تكلفة الاستبدال المدخلة':'Entered replacement cost',inputs.cost.replacement),
  row(ar?'نسبة الاستهلاك المدخلة':'Entered depreciation',inputs.cost.depreciation),
  row(ar?'طريقة المقارنات':'Comparable method selected',String(inputs.methods.market)),
  row(ar?'وحدة المقارنة':'Comparison unit',inputs.marketOptions.unit),
 ];
 const css='body{font-family:Tahoma,Arial,sans-serif;max-width:1050px;margin:2rem auto;padding:1rem;color:#152034}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #abb8c7;padding:.55rem;text-align:start;vertical-align:top;overflow-wrap:anywhere}th{background:#eef2f5}h1,h2{color:#193652}small{color:#546578}@media print{body{margin:0;padding:0}}';
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+
  '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;">'+
  '<title>'+h(title)+'</title><style>'+css+'</style></head><body><h1>'+h(title)+'</h1>'+
  '<p><strong>'+h(ar?'دراسة شخصية فقط: لا اعتماد مهني ولا إثبات مستقل لصحة الصفقات أو تصريح بالشراء.':'Personal research only: no licensed valuation, independent sale verification or transaction authority.')+'</strong></p>'+
  '<h2>'+h(ar?'ملخص الأصل والنتائج':'Asset and results')+'</h2><table>'+summary.join('')+
  '</table><h2>'+h(ar?'الافتراضات المدخلة':'Entered assumptions')+'</h2><table>'+declarations.join('')+
  '</table><h2>'+h(ar?'مؤشرات طرق التقييم':'Valuation method indications')+
  '</h2><table><tr><th>Method</th><th>SAR</th><th>Status</th></tr>'+methodRows+
  '</table><h2>'+h(ar?'سجل المقارنات المصرح بها':'Owner-declared comparable record')+
  '</h2><table><tr><th>ID</th><th>Status</th><th>Source</th><th>Date</th><th>Unit amount</th></tr>'+comparableRows+
  '</table><h2>'+h(ar?'أسباب الحجب والتحفظات':'HOLD and warnings')+'</h2><ul>'+reasons+
  '</ul><p><small>'+h(report.caveat)+'</small></p>'+
  '<p><small>Input SHA-256: '+h(report.inputFingerprintSha256)+
  ' | Report SHA-256: '+h(report.reportHashSha256)+'</small></p></body></html>';
}
module.exports={VERSION,PURPOSE,MAX_REPORT_BYTES,calculatePersonalSectorCase,
 buildPersonalSectorResearchReport,verifyPersonalSectorResearchReport,renderPersonalSectorResearchHtml};
