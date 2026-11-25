'use strict';
const {sha256Hex}=require('../crypto/sha256');
const {parseNumericText}=require('../validation/numeric-text');
const {normalizeState,calculateDcfStudy}=require('./sector-property-dcf-archive');
const {STATUS:BASE_STATUS}=require('./sector-property-dcf');
const {STATUS,evaluateSectorFinancingRisk}=require('./sector-financing-risk-research');
const CASE_VERSION='SECTOR_FINANCING_RISK_INPUTS_V1',REPORT_VERSION='SECTOR_FINANCING_RISK_REPORT_V1',MAX_BYTES=65536;
const FINANCE_NUMBERS=['principalSar','annualRate','tenorYears','upfrontFinanceFeeSar','equityDiscountRate','annualAdditionalTaxSar','exitAdditionalTaxSar'];
const RISK_NUMBERS=['seed','samples','rentVariation','expenseVariation','saleVariation'];
const NUMBERS=[...FINANCE_NUMBERS.map(k=>'f-'+k),...RISK_NUMBERS.map(k=>'r-'+k)];
const CHECKS=['f-additionalTaxCashflowsConfirmed','f-noDuplicateCostsConfirmed'];
const KEYS=['mode','f-financingAssumptionRef','f-taxCashflowAssumptionRef','r-assumptionRef',...NUMBERS,...CHECKS];
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function fail(code){throw Object.assign(new Error(code),{code});}
function normalizeOverlay(raw,strict=false){
 if(!plain(raw)||Object.keys(raw).some(k=>!KEYS.includes(k))||(strict&&!exact(raw,KEYS)))fail('RISK_ARCHIVE_FIELDS_INVALID');
 return Object.fromEntries(KEYS.map(k=>{
  const bool=CHECKS.includes(k),v=Object.hasOwn(raw,k)?raw[k]:bool?false:'';
  if(typeof v!==(bool?'boolean':'string')||(!bool&&(v.length>200||/[\u0000-\u001f\u007f]/.test(v))))fail('RISK_ARCHIVE_FIELD_INVALID');
  return [k,v];
 }));
}
function baseBinding(study){
 const baseInputs=normalizeState(study);
 if(calculateDcfStudy(baseInputs).status!==BASE_STATUS.READY)fail('RISK_BASE_DCF_REQUIRED');
 return {baseInputs,baseSha256:sha256Hex(JSON.stringify(baseInputs))};
}
function calculateOverlay(study,raw){
 const v=normalizeOverlay(raw),financing={mode:v.mode},risk={};
 for(const k of KEYS.filter(k=>k!=='mode')){
  let value=v[k];if(NUMBERS.includes(k)){const n=parseNumericText(value);value=n.ok?n.value:null;}
  (k.startsWith('f-')?financing:risk)[k.slice(2)]=value;
 }
 return evaluateSectorFinancingRisk({study,financing,risk});
}
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function bounded(v){let s;try{s=JSON.stringify(v);}catch{fail('RISK_ARCHIVE_INVALID');}if(typeof s!=='string'||s.length>MAX_BYTES||new TextEncoder().encode(s).length>MAX_BYTES)fail('RISK_ARCHIVE_SIZE_INVALID');}
function build(study,raw,version,createdAt){
 if(!date(createdAt))fail('RISK_ARCHIVE_DATE_INVALID');
 const binding=baseBinding(study),overlayInputs=normalizeOverlay(raw),body={version,createdAt,...binding,overlayInputs};
 if(version===REPORT_VERSION){
  const result=calculateOverlay(binding.baseInputs,overlayInputs);
  if(result.status!==STATUS.READY)fail('RISK_REPORT_NOT_READY');
  Object.assign(body,{result,scope:'UNVERIFIED_FINANCING_TAX_CASHFLOW_RISK_RESEARCH_ONLY',transactionAuthorized:false,financeApproved:false,taxOpinionEstablished:false,professionalValuationCertified:false});
 }
 const file={...body,sha256:sha256Hex(JSON.stringify(body))};bounded(file);return file;
}
function createRiskInputArchive(study,raw,{createdAt=new Date().toISOString()}={}){return build(study,raw,CASE_VERSION,createdAt);}
function createRiskReport(study,raw,{createdAt=new Date().toISOString()}={}){return build(study,raw,REPORT_VERSION,createdAt);}
function restoreRiskFile(file,study){
 bounded(file);
 if(!plain(file)||![CASE_VERSION,REPORT_VERSION].includes(file.version)||!date(file.createdAt)||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail('RISK_ARCHIVE_INVALID');
 const report=file.version===REPORT_VERSION;
 const keys=['version','createdAt','baseInputs','baseSha256','overlayInputs','sha256',...(report?['result','scope','transactionAuthorized','financeApproved','taxOpinionEstablished','professionalValuationCertified']:[])];
 if(!exact(file,keys))fail('RISK_ARCHIVE_FIELDS_INVALID');
 const binding=baseBinding(study),imported=normalizeState(file.baseInputs,{strict:true});
 if(file.baseSha256!==binding.baseSha256||JSON.stringify(imported)!==JSON.stringify(binding.baseInputs))fail('RISK_BASE_SCOPE_MISMATCH');
 const overlayInputs=normalizeOverlay(file.overlayInputs,true);
 const expected=build(binding.baseInputs,overlayInputs,file.version,file.createdAt);
 if(file.sha256!==expected.sha256)fail('RISK_ARCHIVE_DIGEST_MISMATCH');
 if(report&&(file.scope!==expected.scope||['transactionAuthorized','financeApproved','taxOpinionEstablished','professionalValuationCertified'].some(k=>file[k]!==false)||JSON.stringify(file.result)!==JSON.stringify(expected.result)))fail('RISK_REPORT_RECOMPUTATION_MISMATCH');
 return {overlayInputs,sourceKind:report?'RECOMPUTED_REPORT':'INPUT_ARCHIVE',baseInputsRestored:false,resultsRestored:false,authorityRestored:false};
}
module.exports={CASE_VERSION,REPORT_VERSION,MAX_BYTES,normalizeOverlay,calculateOverlay,createRiskInputArchive,createRiskReport,restoreRiskFile};
