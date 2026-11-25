'use strict';
const {sha256Hex}=require('../crypto/sha256');
const {parseNumericText}=require('../validation/numeric-text');
const {UNITS,STATUS,evaluateSectorPropertyDcf}=require('./sector-property-dcf');
const CASE_VERSION='SECTOR_PROPERTY_DCF_INPUTS_V1',REPORT_VERSION='SECTOR_PROPERTY_DCF_REPORT_V1',MAX_BYTES=65536;
const TEXT=['propertyRef','leaseAssumptionRef','valuationDate','propertyRight','terminalMode','terminalEvidenceRef'];
const NUMBER=['years','quantity','annualRentPerUnitSar','leasedFraction','collectionFraction','annualOwnerExpensesSar','annualSustainingCapexSar','rentGrowth','expenseGrowth','purchasePriceSar','acquisitionCostsSar','discountRate','terminalNetSaleSar','stressRevenueReduction','stressExpenseIncrease','stressDiscountIncrease'];
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
function fail(code){throw Object.assign(new Error(code),{code});}
function exact(v,keys){return plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
function normalizeState(s,{strict=false}={}){
 if(!exact(s,['assetClass','raw'])||typeof s.assetClass!=='string'||!Object.hasOwn(UNITS,s.assetClass)||!plain(s.raw))fail('DCF_ARCHIVE_SCOPE_INVALID');
 const checks=['propertyIncomeOnly','businessAssetsExcluded',...(s.assetClass==='MIXED_USE'?['mixedAllocationConfirmed']:[]),...(s.assetClass==='FUEL_STATION'?['environmentalObligationsReviewed']:[])];
 const keys=[...TEXT,...NUMBER,...checks];
 if(Object.keys(s.raw).some(k=>!keys.includes(k))||(strict&&!exact(s.raw,keys)))fail('DCF_ARCHIVE_FIELDS_INVALID');
 const raw=Object.fromEntries(keys.map(k=>{
  const bool=checks.includes(k),v=Object.hasOwn(s.raw,k)?s.raw[k]:bool?false:'';
  if(typeof v!==(bool?'boolean':'string')||(!bool&&(v.length>200||/[\u0000-\u001f\u007f]/.test(v))))fail('DCF_ARCHIVE_FIELD_INVALID');
  return [k,v];
 }));
 return {assetClass:s.assetClass,raw};
}
function calculateDcfStudy(state){
 const s=normalizeState(state),input={assetClass:s.assetClass};
 for(const [k,v] of Object.entries(s.raw)){if(NUMBER.includes(k)){const n=parseNumericText(v);input[k]=n.ok?n.value:null;}else input[k]=v;}
 return evaluateSectorPropertyDcf(input);
}
function bounded(file){let raw;try{raw=JSON.stringify(file);}catch{fail('DCF_ARCHIVE_INVALID');}if(typeof raw!=='string'||raw.length>MAX_BYTES||new TextEncoder().encode(raw).length>MAX_BYTES)fail('DCF_ARCHIVE_SIZE_INVALID');}
function build(state,version,createdAt){
 if(!validDate(createdAt))fail('DCF_ARCHIVE_DATE_INVALID');
 const studyInputs=normalizeState(state),body={version,createdAt,studyInputs};
 if(version===REPORT_VERSION){
  const result=calculateDcfStudy(studyInputs);
  if(result.status!==STATUS.READY)fail('DCF_REPORT_NOT_READY');
  Object.assign(body,{result,scope:'UNVERIFIED_FREEHOLD_PROPERTY_RESEARCH_ONLY',transactionAuthorized:false,professionalValuationCertified:false});
 }
 const file={...body,sha256:sha256Hex(JSON.stringify(body))};bounded(file);return file;
}
function createDcfInputArchive(state,{createdAt=new Date().toISOString()}={}){return build(state,CASE_VERSION,createdAt);}
function createDcfResearchReport(state,{createdAt=new Date().toISOString()}={}){return build(state,REPORT_VERSION,createdAt);}
function restoreDcfStudy(file,{expectedAssetClass}={}){
 bounded(file);
 if(typeof expectedAssetClass!=='string'||!Object.hasOwn(UNITS,expectedAssetClass)||!plain(file)||![CASE_VERSION,REPORT_VERSION].includes(file.version)||!validDate(file.createdAt)||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail('DCF_ARCHIVE_INVALID');
 const report=file.version===REPORT_VERSION,keys=['version','createdAt','studyInputs','sha256',...(report?['result','scope','transactionAuthorized','professionalValuationCertified']:[])];
 if(!exact(file,keys))fail('DCF_ARCHIVE_FIELDS_INVALID');
 const state=normalizeState(file.studyInputs,{strict:true});
 if(state.assetClass!==expectedAssetClass)fail('DCF_ARCHIVE_SCOPE_MISMATCH');
 const expected=build(state,file.version,file.createdAt);
 if(file.sha256!==expected.sha256)fail('DCF_ARCHIVE_DIGEST_MISMATCH');
 if(report&&(file.scope!==expected.scope||file.transactionAuthorized!==false||file.professionalValuationCertified!==false||JSON.stringify(file.result)!==JSON.stringify(expected.result)))fail('DCF_REPORT_RECOMPUTATION_MISMATCH');
 return {studyInputs:state,sourceKind:report?'RECOMPUTED_REPORT':'INPUT_ARCHIVE',resultsRestored:false,authorityRestored:false};
}
module.exports={CASE_VERSION,REPORT_VERSION,MAX_BYTES,normalizeState,calculateDcfStudy,createDcfInputArchive,createDcfResearchReport,restoreDcfStudy};
