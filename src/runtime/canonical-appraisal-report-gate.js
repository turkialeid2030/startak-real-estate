'use strict';
// A cross-route canonical-scope check for authenticated internal reporting.
// Only an injected, server-controlled resolver can supply current report evidence.
// This module never grants a professional report, transaction, or release permission.
const HEX=/^[0-9a-f]{64}$/i;
const required=s=>typeof s==='string'&&s.trim().length>0&&s===s.trim();
function checkCanonicalAppraisalReportEvidence({sourceContext={},propertyRef,record=null,resolverConfigured=false}={}){
 const reasons=[];
 if(!resolverConfigured)return Object.freeze({
  status:'CANONICAL_APPRAISAL_RESOLVER_NOT_CONNECTED',blockInternalQa:false,
  sourceAuthenticated:false,independentMarketVerified:false,professionalReportAuthorized:false,reasons:[]});
 if(!record||typeof record!=='object'||Array.isArray(record))
  reasons.push('CANONICAL_APPRAISAL_EVIDENCE_MISSING');
 else {
  const same=(key,value)=>required(value)&&record[key]===value;
  if(!same('tenantId',sourceContext.tenantId)||!same('projectId',sourceContext.projectId)||
   !same('caseId',sourceContext.caseId)||!same('propertyRef',propertyRef)||
   !same('workspaceId',sourceContext.workspaceId)||record.workspaceVersion!==sourceContext.workspaceVersion)
   reasons.push('CANONICAL_APPRAISAL_SCOPE_OR_VERSION_MISMATCH');
  if(!required(record.reportId)||!required(record.evidenceRef)||!HEX.test(record.sourceDigestSha256||''))
   reasons.push('CANONICAL_APPRAISAL_SOURCE_PROVENANCE_INCOMPLETE');
  if(record.status!=='REVIEW_REQUIRED'&&record.status!=='HOLD')
   reasons.push('CANONICAL_APPRAISAL_REVIEW_STATUS_UNKNOWN');
  if(record.status==='REVIEW_REQUIRED'&&
     (record.hasBlockingArithmeticIssue===true||record.hasCircularValuation===true))
   reasons.push('CANONICAL_APPRAISAL_REVIEW_CONTRADICTS_BLOCKER');
  if(record.status==='HOLD')reasons.push('CANONICAL_APPRAISAL_REVIEW_HOLD');
 }
 return Object.freeze({
  status:reasons.length?'HOLD_CANONICAL_APPRAISAL_REPORT':'INTERNAL_APPRAISAL_REVIEW_REQUIRED',
  blockInternalQa:reasons.length>0,
  sourceAuthenticated:false,
  independentMarketVerified:false,professionalReportAuthorized:false,
  reasons:Object.freeze([...new Set(reasons)])});
}
module.exports={checkCanonicalAppraisalReportEvidence};
