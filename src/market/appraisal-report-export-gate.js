'use strict';
// Restrictive-only guard for draft financial-report exports in the active browser
// research session. A linked HOLD is quarantined across private report routes.
// Canonical data backups and unrelated non-report files are deliberately excluded.
const {evaluateBoundReview}=require('./appraisal-study-binding');
function evaluatePersonalReportExport({subject=null,link=null}={}){
 if(link===null)return {status:'UNLINKED_PERSONAL_RESEARCH',blocked:false,reason:null,
  professionalValuationAuthorized:false};
 if(!link||typeof link!=='object'||Array.isArray(link))
  return {status:'BLOCKED_INVALID_LINK',blocked:true,reason:'APPRAISAL_LINK_INVALID',
   professionalValuationAuthorized:false};
 const result=evaluateBoundReview({subject:subject||{},link});
 if(result.blockExport||result.status==='STALE_OR_UNMATCHED_LINK'||result.status==='LINKED_AUDIT_HOLD')
  return {status:'BLOCKED_LINKED_APPRAISAL',blocked:true,
   reason:result.reasons?.[0]||'APPRAISAL_REVIEW_HOLD',
   professionalValuationAuthorized:false};
 if(result.status!=='LINKED_REVIEW_REQUIRED')
  return {status:'BLOCKED_UNRECOGNIZED_REVIEW',blocked:true,
   reason:'APPRAISAL_REVIEW_STATE_INVALID',professionalValuationAuthorized:false};
 return {status:'UNVERIFIED_PERSONAL_DRAFT_ONLY',blocked:false,
  reason:'APPRAISAL_REVIEW_NOT_INDEPENDENTLY_VERIFIED',professionalValuationAuthorized:false};
}
function assertPersonalReportExportAllowed(args){
 const gate=evaluatePersonalReportExport(args);
 if(gate.blocked){const e=new Error(gate.reason);e.code=gate.reason;throw e;}
 return gate;
}
module.exports={evaluatePersonalReportExport,assertPersonalReportExportAllowed};
