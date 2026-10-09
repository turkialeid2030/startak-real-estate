'use strict';
// C75 PERSONAL investment research. Does not use, circumvent or modify C62/C71
// regulated/public valuation authority. Exports diagnostic values already
// computed by the canonical existing-building valuation engine only.
const {sha256Hex}=require('../crypto/sha256');
const VERSION='C75_PERSONAL_RESEARCH_REPORT_V1';
const PURPOSE='PERSONAL_INVESTMENT_RESEARCH';
const STATE=Object.freeze({
 PRELIMINARY_VALUE:'PRELIMINARY_VALUE_CALCULATED',
 METHOD_INDICATIONS:'METHOD_INDICATIONS_ONLY',
 SPECIALIST_INPUTS:'SPECIALIST_INPUTS_ONLY',
 INPUTS_REQUIRED:'INPUTS_REQUIRED',
});
function err(code){const e=new Error(code);e.code=code;throw e;}
function text(x,max=200){
 return typeof x==='string'&&x.length<=max?x.trim():'';
}
function finite(x){return typeof x==='number'&&Number.isFinite(x)?x:null;}
function codes(x){return Array.isArray(x)?[...new Set(x.filter(y=>typeof y==='string'&&y.length<=120))].slice(0,80):[];}
function iso(x){
 const d=x instanceof Date?x:new Date(x);
 if(!Number.isFinite(d.getTime()))err('C75_GENERATED_DATE_INVALID');
 return d.toISOString();
}
function freeze(o){
 if(o&&typeof o==='object'&&!Object.isFrozen(o)){
  Object.values(o).forEach(freeze);
  Object.freeze(o);
 }
 return o;
}
function canonical(x){
 if(Array.isArray(x))return x.map(canonical);
 if(x&&typeof x==='object')return Object.fromEntries(
  Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
 return x;
}
function coreHash(x){return sha256Hex(JSON.stringify(canonical(x)));}
function methodFromStage(m){
 if(!m||typeof m!=='object'||typeof m.method!=='string')return null;
 const value=finite(m.indication?.value);
 // A method marked HOLD or with unqualified evidence must not be dressed up
 // as accepted merely because a numeric diagnostic value exists.
 const qualified=m.state==='AVAILABLE'&&value!==null;
 return {
  method:text(m.method,120),
  state:text(m.state,120),
  diagnosticValue:qualified?value:null,
  reasonCode:text(m.reasonCode,120)||null,
  evidenceGaps:codes(m.evidenceGaps),
  weakestEvidenceGrade:text(m.indication?.weakestEvidenceGrade,80)||null,
 };
}
function buildPersonalResearchReport({runtime=null,valuationCase=null,generatedAt=new Date()}={}){
 const generatedAtIso=iso(generatedAt);
 if(runtime!==null&&(typeof runtime!=='object'||Array.isArray(runtime)))
  err('C75_RUNTIME_INVALID');
 if(valuationCase!==null&&(typeof valuationCase!=='object'||Array.isArray(valuationCase)))
  err('C75_VALUATION_CASE_INVALID');
 const stage=runtime?.stage;
 if(stage!=null&&(!Array.isArray(stage.methods)||typeof stage.status!=='string'))
  err('C75_STAGE_INVALID');
 const methods=stage?stage.methods.map(methodFromStage).filter(Boolean):[];
 const classification=text(valuationCase?.classification?.assetClass,80)||null;
 const specialist=Boolean(runtime?.specialistRoute)||
  ['HOSPITALITY','INDUSTRIAL_LOGISTICS'].includes(classification);
 const final=stage?.readyForDecisionControl===true&&
  stage?.status==='READY_FOR_DECISION_CONTROL'?
  finite(stage.finalValue):null;
 const state=final!==null?STATE.PRELIMINARY_VALUE:
  methods.some(x=>x.diagnosticValue!==null)?STATE.METHOD_INDICATIONS:
  specialist?STATE.SPECIALIST_INPUTS:STATE.INPUTS_REQUIRED;
 // Neither a legacy calculation nor an unimplemented hotel/industrial adapter
 // may be silently relabelled as an appraised real-property value.
 const preliminaryValue=state===STATE.PRELIMINARY_VALUE?final:null;
 const warnings=[
  ...codes(stage?.reasonCodes),
  ...codes(stage?.evidenceGaps),
  ...codes(runtime?.specialistRoute?.blockers),
 ];
 if(!stage)warnings.push('NO_QUALIFIED_VALUATION_STAGE');
 if(!valuationCase)warnings.push('PERSONAL_VALUATION_CONFIGURATION_REQUIRED');
 const core={
  version:VERSION,purpose:PURPOSE,
  reportStatus:state,
  generatedAt:generatedAtIso,
  caseId:text(runtime?.caseId,160)||null,
  projectId:text(runtime?.projectId,160)||text(valuationCase?.projectId,160)||null,
  assetClass:classification,
  basis:text(valuationCase?.incomePolicy?.basis,100)||null,
  currency:text(valuationCase?.incomePolicy?.currency,30)||null,
  valuationDate:text(valuationCase?.incomePolicy?.valuationDate,60)||null,
  stageStatus:text(stage?.status,120)||null,
  preliminaryValue,
  methods,
  warnings:[...new Set(warnings)],
  evidenceVerificationStatus:'USER_SUPPLIED_OR_ENGINE_DIAGNOSTIC_NOT_INDEPENDENTLY_VERIFIED',
  indicativeNotCertified:true,
  professionalAppraisalClaim:false,
  transactionAuthorityClaim:false,
  externalGoLiveGateRequiredForPersonalExport:false,
  reportLabelAr:'دراسة تحليلية شخصية أولية — غير معتمدة',
  reportLabelEn:'Personal preliminary analytical study — not a certified appraisal',
 };
 return freeze({...core,reportHashSha256:coreHash(core)});
}
function verifyPersonalResearchReport(r){
 if(!r||typeof r!=='object'||Array.isArray(r))return false;
 const {reportHashSha256,...core}=r;
 if(r.version!==VERSION||r.purpose!==PURPOSE||
  !Object.values(STATE).includes(r.reportStatus)||
  r.indicativeNotCertified!==true||r.professionalAppraisalClaim!==false||
  r.transactionAuthorityClaim!==false||
  r.externalGoLiveGateRequiredForPersonalExport!==false||
  !Array.isArray(r.warnings)||!Array.isArray(r.methods)||
  !/^[a-f0-9]{64}$/.test(reportHashSha256||''))return false;
 if(r.reportStatus!==STATE.PRELIMINARY_VALUE&&r.preliminaryValue!==null)return false;
 try{return coreHash(core)===reportHashSha256;}catch{return false;}
}
function escapeHtml(x){
 return String(x??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
 })[ch]);
}
function htmlReport(r,{locale='ar-SA'}={}){
 if(!verifyPersonalResearchReport(r))err('C75_REPORT_DIGEST_INVALID');
 const ar=locale!=='en',h=escapeHtml;
 const title=ar?'دراسة استثمار عقاري شخصية':'Personal real estate investment study';
 const cell=(a,b)=>'<tr><th>'+h(a)+'</th><td>'+h(b??'—')+'</td></tr>';
 const cash=x=>finite(x)===null?'—':Number(x).toLocaleString(ar?'ar-SA':'en-US',{
  maximumFractionDigits:2})+' '+h(r.currency||'');
 const body=[
  cell(ar?'رقم الحالة':'Case',r.caseId),
  cell(ar?'رقم المشروع':'Project',r.projectId),
  cell(ar?'نوع العقار':'Asset class',r.assetClass),
  cell(ar?'تاريخ التقييم':'Valuation date',r.valuationDate),
  cell(ar?'أساس القيمة':'Basis of value',r.basis),
  cell(ar?'حالة الدراسة':'Study status',r.reportStatus),
  cell(ar?'مؤشر القيمة المحسوب':'Computed preliminary value',cash(r.preliminaryValue)),
 ];
 const rows=r.methods.map(m=>'<tr><td>'+h(m.method)+'</td><td>'+h(m.state)+
  '</td><td>'+cash(m.diagnosticValue)+'</td><td>'+h(m.reasonCode||'—')+'</td></tr>').join('');
 const warning=r.warnings.map(w=>'<li>'+h(w)+'</li>').join('');
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+
  '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:">'+
  '<title>'+h(title)+'</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:900px;margin:2rem auto;padding:1rem;color:#162033}h1,h2{color:#18344a}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{padding:.7rem;border:1px solid #bbb;text-align:start;vertical-align:top}th{background:#eef2f5;width:30%}small{color:#5b6770}li{margin:.4rem 0}@media print{body{margin:0;padding:0}}</style></head><body>'+
  '<h1>'+h(title)+'</h1><p><strong>'+h(ar?r.reportLabelAr:r.reportLabelEn)+'</strong></p>'+
  '<table>'+body.join('')+'</table><h2>'+(ar?'نتائج المناهج':'Method indications')+
  '</h2><table><tr><th>'+(ar?'المنهج':'Method')+'</th><th>'+(ar?'الحالة':'State')+
  '</th><th>'+(ar?'مؤشر القيمة':'Value')+'</th><th>'+(ar?'السبب':'Reason')+'</th></tr>'+rows+
  '</table><h2>'+(ar?'البيانات الناقصة والملاحظات':'Missing inputs and warnings')+
  '</h2><ul>'+warning+'</ul><p><small>'+h(ar?
  'القيم مبنية على المدخلات والنتائج المحسوبة المتاحة، وليست تقرير تقييم عقاري مهنيًا معتمدًا. عدم توفر بيانات كافية لا يمنع حفظ هذه المسودة الشخصية.':
  'Values reflect available inputs and engine indications; this is not a certified professional appraisal. Incomplete evidence does not block saving this personal draft.')+
  '</small></p><p><small>SHA-256: '+r.reportHashSha256+'</small></p></body></html>';
}
module.exports={VERSION,PURPOSE,STATE,buildPersonalResearchReport,
 verifyPersonalResearchReport,htmlReport};
