'use strict';
const {sha256Hex}=require('../crypto/sha256');
const {parseNumericText}=require('../validation/numeric-text');
const {HOTEL_FIELDS,SUPPORTED_SECTORS,STATUS,evaluateLocalSectorOperations}=require('./local-sector-operating-research');
const CASE_VERSION='LOCAL_SECTOR_OPERATING_INPUTS_V1',REPORT_VERSION='LOCAL_SECTOR_OPERATING_REPORT_V1',MAX_BYTES=64*1024;
const schema=(numbers=[],strings=[],booleans=[])=>Object.freeze(Object.fromEntries([...numbers,...strings].map(k=>[k,'string']).concat(booleans.map(k=>[k,'boolean']))));
const CAP=schema(['capacity','usedCapacity','annualOperatingRevenueSar','annualOperatingExpensesSar']);
const SCHEMAS=Object.freeze({
 HOSPITALITY:schema(HOTEL_FIELDS),
 INDUSTRIAL_LOGISTICS:schema(['landAreaSqm','builtAreaSqm','netLeasableAreaSqm','clearHeightMeters','powerCapacityKva','annualRentSar','landlordExpensesSar'],['assetId','subtype','customSubtype','leaseStructure','internalInspectionStatus','buildingPermitStatus'],['tenantOpexConfirmed']),
 HEALTHCARE:CAP,EDUCATION:CAP,PARKING:CAP,DATA_CENTER:CAP,
 FUEL_STATION:schema(['annualLitres','sellingPricePerLitre','purchaseCostPerLitre','annualNonFuelRevenueSar','annualNonFuelDirectCostSar','annualOperatingExpensesSar','annualPropertyRentSar','annualEnvironmentalReserveSar'],[],['nonFuelSeparated','propertyRentSeparated','environmentalReviewDeclared']),
 MIXED_USE:schema(['totalLeasableAreaSqm','commonExpensesSar'],[],['sharedExpensesAllocatedOnce']),
 SPECIAL_PURPOSE:schema(['landValueSar','replacementCostSar','physicalLossSar','functionalLossSar','externalLossSar'],['propertyRightRef'],['lossCausesDistinct','businessAssetsExcluded']),
});
const SEGMENT=schema(['areaSqm','annualPropertyRevenueSar','annualDirectExpensesSar'],['id'],['propertyIncomeOnly']);
const TEXT_KEYS=new Set(['assetId','subtype','customSubtype','leaseStructure','internalInspectionStatus','buildingPermitStatus','propertyRightRef','id']);
function fail(code){throw Object.assign(new Error(code),{code});}
function plain(v){return v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;}
function exact(v,keys){return plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function date(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
function canonicalFields(raw,fields,strict){
 if(!plain(raw)||Object.keys(raw).some(k=>!Object.hasOwn(fields,k))||(strict&&!exact(raw,Object.keys(fields))))fail('SPECIALIST_ARCHIVE_FIELDS_INVALID');
 return Object.fromEntries(Object.entries(fields).map(([k,t])=>{
  const v=Object.hasOwn(raw,k)?raw[k]:t==='boolean'?false:'';
  if(typeof v!==t||(t==='string'&&(v.length>200||/[\u0000-\u001f\u007f]/.test(v))))fail('SPECIALIST_ARCHIVE_FIELD_INVALID');
  return [k,v];
 }));
}
function normalizeStudy(state,{strict=false}={}){
 if(!exact(state,['assetClass','values','segments'])||typeof state.assetClass!=='string'||!SUPPORTED_SECTORS.includes(state.assetClass))fail('SPECIALIST_ARCHIVE_SECTOR_INVALID');
 const assetClass=state.assetClass,values=canonicalFields(state.values,SCHEMAS[assetClass],strict);
 if(!Array.isArray(state.segments))fail('SPECIALIST_ARCHIVE_SEGMENTS_INVALID');
 if(assetClass==='MIXED_USE'){
  if(state.segments.length<2||state.segments.length>20)fail('SPECIALIST_ARCHIVE_SEGMENTS_INVALID');
 }else if(state.segments.length!==0)fail('SPECIALIST_ARCHIVE_SEGMENTS_INVALID');
 return {assetClass,values,segments:state.segments.map(s=>canonicalFields(s,SEGMENT,strict))};
}
function convert(values,fields){
 return Object.fromEntries(Object.entries(fields).map(([k,t])=>{
  const v=values[k];if(t==='boolean'||TEXT_KEYS.has(k))return [k,v];
  const n=parseNumericText(v);return [k,n.ok?n.value:null];
 }));
}
function calculateStudy(state){
 const s=normalizeStudy(state),inputs=convert(s.values,SCHEMAS[s.assetClass]);
 if(s.assetClass==='MIXED_USE')inputs.segments=s.segments.map(v=>convert(v,SEGMENT));
 return evaluateLocalSectorOperations({assetClass:s.assetClass,inputs});
}
function digest(body){return sha256Hex(JSON.stringify(body));}
function bounded(v){let raw;try{raw=JSON.stringify(v);}catch{fail('SPECIALIST_ARCHIVE_INVALID');}if(typeof raw!=='string'||raw.length>MAX_BYTES||new TextEncoder().encode(raw).length>MAX_BYTES)fail('SPECIALIST_ARCHIVE_SIZE_INVALID');}
function build(state,version,createdAt){
 const studyInputs=normalizeStudy(state);
 if(!date(createdAt))fail('SPECIALIST_ARCHIVE_DATE_INVALID');
 const body={version,createdAt,studyInputs};
 if(version===REPORT_VERSION){const result=calculateStudy(studyInputs);if(result.status!==STATUS.READY)fail('SPECIALIST_REPORT_NOT_READY');Object.assign(body,{result,scope:'LOCAL_UNVERIFIED_OPERATING_RESEARCH_ONLY',professionalValuationCertified:false,transactionAuthorized:false});}
 const file={...body,sha256:digest(body)};bounded(file);return file;
}
function createInputArchive(state,{createdAt=new Date().toISOString()}={}){return build(state,CASE_VERSION,createdAt);}
function createOperatingReport(state,{createdAt=new Date().toISOString()}={}){return build(state,REPORT_VERSION,createdAt);}
function restoreStudyFile(file,{expectedAssetClass}={}){
 bounded(file);
 if(!plain(file)||!SUPPORTED_SECTORS.includes(expectedAssetClass)||![CASE_VERSION,REPORT_VERSION].includes(file.version)||!date(file.createdAt)||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))fail('SPECIALIST_ARCHIVE_INVALID');
 const isReport=file.version===REPORT_VERSION,keys=['version','createdAt','studyInputs','sha256',...(isReport?['result','scope','professionalValuationCertified','transactionAuthorized']:[])];
 if(!exact(file,keys))fail('SPECIALIST_ARCHIVE_FIELDS_INVALID');
 const state=normalizeStudy(file.studyInputs,{strict:true});
 if(state.assetClass!==expectedAssetClass)fail('SPECIALIST_ARCHIVE_SECTOR_MISMATCH');
 const expected=build(state,file.version,file.createdAt);
 if(file.sha256!==expected.sha256)fail('SPECIALIST_ARCHIVE_DIGEST_MISMATCH');
 if(isReport&&(file.scope!==expected.scope||file.professionalValuationCertified!==false||file.transactionAuthorized!==false||JSON.stringify(file.result)!==JSON.stringify(expected.result)))fail('SPECIALIST_REPORT_RECOMPUTATION_MISMATCH');
 return {studyInputs:state,sourceKind:isReport?'RECOMPUTED_REPORT':'INPUT_ARCHIVE',resultsRestored:false,authorityRestored:false};
}
module.exports={CASE_VERSION,REPORT_VERSION,MAX_BYTES,normalizeStudy,calculateStudy,createInputArchive,createOperatingReport,restoreStudyFile};
