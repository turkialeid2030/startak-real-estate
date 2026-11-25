'use strict';
// Separate internal research appendix. Never mutates a valuation report or
// upgrades its QA state. User-imported report hashes are not signatures.
const {sha256Hex}=require('../crypto/sha256');
const {reviewSupplementalText,MAX_BYTES}=require('../engines/financial/supplemental-research-input');
const {validateOpeningPortfolioSnapshot,assertOpeningReturnMatch}=require('../portfolio/opening-return-snapshot');
const VERSION='STARTAK_SUPPLEMENTAL_RESEARCH_APPENDIX_V1';
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v===undefined?null:v;
const digest=v=>sha256Hex(JSON.stringify(canon(v)));
function parse(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('APPENDIX_INPUT_LIMIT');
 return JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('APPENDIX_INPUT_INVALID');return v;});
}
function reportReference(text,expected){
 const r=parse(text);
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('APPENDIX_REPORT_INVALID');
 const {reportHashSha256,...core}=r;
 if(!/^[a-f0-9]{64}$/.test(reportHashSha256||'')||digest(core)!==reportHashSha256||r.schemaVersion!==1||
 !['INTERNAL_VALUATION_DRAFT','PROFESSIONAL_VALUATION_DRAFT','FINANCIAL_REPORTING_HANDOFF'].includes(r.reportType)||
 !['REPORT_BLOCKED','READY_FOR_INTERNAL_QA'].includes(r.qaStatus)||!Array.isArray(r.criticalGaps)||
 r.externalIssuanceAuthorized!==false||r.certifiedValuationAuthorized!==false||r.transactionAuthorized!==false||
 typeof r.reportId!=='string'||!r.reportId.trim()||typeof r.reportVersion!=='string'||!r.reportVersion.trim())
 throw Error('APPENDIX_REPORT_INVALID');
 if(r.caseId!==expected.caseId||r.propertyRef!==expected.propertyRef||r.valuationDate!==expected.asOfDate)throw Error('APPENDIX_REPORT_SCOPE_MISMATCH');
 if((r.criticalGaps.length===0)!==(r.qaStatus==='READY_FOR_INTERNAL_QA'))throw Error('APPENDIX_REPORT_QA_INCONSISTENT');
 return {reportId:r.reportId,reportVersion:r.reportVersion,reportHashSha256,qaStatus:r.qaStatus,caseId:r.caseId,propertyRef:r.propertyRef,valuationDate:r.valuationDate};
}
function buildSupplementalAppendix({method,text,expected,reportText=null,snapshotText=null}={}){
 const result=reviewSupplementalText({method,text,expected});
 if(result.status!=='ANALYTICAL_ONLY'||!result.metrics.some(m=>Number.isFinite(m.value)))throw Error('APPENDIX_RESEARCH_HOLD');
 let parent=null,opening=null;
 if(method==='portfolio'){
  if(reportText!==null)throw Error('APPENDIX_PORTFOLIO_PROPERTY_REPORT_FORBIDDEN');
  if(snapshotText!==null){
   const s=validateOpeningPortfolioSnapshot(snapshotText,expected);
   assertOpeningReturnMatch(parse(text),s);
   opening={snapshotId:s.snapshotId,snapshotHashSha256:s.snapshotHashSha256,periodStart:s.periodStart};
  }
 }else if(reportText!==null)parent=reportReference(reportText,expected);
 const core={version:VERSION,kind:'LOCAL_RESEARCH_DRAFT',method,scope:result.scope,analysis:result,
  reportReference:parent,openingSnapshotReference:opening,sourceTextSha256:sha256Hex(text),
  inputSourceIndependentlyVerified:false,reportIssuerAuthenticated:false,canonicalReportModified:false,
  reportQaUpgraded:false,professionalValuationAuthorized:false,externalIssuanceAuthorized:false,transactionAuthorized:false,
  labelAr:'ملحق تحليلي داخلي غير معتمد — لا يغيّر التقرير المرجعي',
  labelEn:'Uncertified internal analytical appendix — does not modify the reference report'};
 return {...core,appendixHashSha256:digest(core)};
}
module.exports={buildSupplementalAppendix,reportReference};
