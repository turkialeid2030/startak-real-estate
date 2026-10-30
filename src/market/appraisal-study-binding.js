'use strict';
// This is a session-only, restrictive research linkage; no deed verification, certified value,
// stored personal details, or permission to alter canonical Saved Deals.
const {number}=require('./appraisal-assurance');
const name=x=>String(x||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ar');
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x)?x.toLowerCase():null;
function snapshot(subject={}){
 const area=number(subject.landArea);
 return {
  name:name(subject.name),assetType:String(subject.assetType||'').trim(),
  areaSqm:area!==null&&area>0?area:null,
  valuationDate:String(subject.valuationDate||'').trim(),
 };
}
function same(a,b){
 return a.name===b.name&&a.assetType===b.assetType&&a.valuationDate===b.valuationDate&&
  a.areaSqm!==null&&b.areaSqm!==null&&Math.abs(a.areaSqm-b.areaSqm)<0.01;
}
function validateIdentity({subject={},appraisal={},documentDigest,confirmed=false}={}){
 const errors=[],current=snapshot(subject);
 const report=snapshot({
  name:appraisal?.property?.name,assetType:appraisal?.property?.assetType,
  landArea:appraisal?.property?.areaSqm,valuationDate:appraisal.valuationDate,
 });
 if(!current.name||!current.assetType||current.areaSqm===null||
    !/^\d{4}-\d{2}-\d{2}$/.test(current.valuationDate))errors.push('STUDY_IDENTITY_INCOMPLETE');
 if(!report.name||!report.assetType||report.areaSqm===null||
    !/^\d{4}-\d{2}-\d{2}$/.test(report.valuationDate))errors.push('APPRAISAL_IDENTITY_INCOMPLETE');
 if(!same(current,report))errors.push('PROPERTY_IDENTITY_MISMATCH');
 if(!String(appraisal.reportId||'').trim())errors.push('APPRAISAL_REPORT_ID_REQUIRED');
 if(!digest(documentDigest))errors.push('SOURCE_PDF_SHA256_REQUIRED');
 if(confirmed!==true)errors.push('EXPLICIT_SAME_PROPERTY_ATTESTATION_REQUIRED');
 return {status:errors.length?'HOLD':'MATCHED_USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED',
  reasons:errors,subjectSnapshot:current};
}
function bindReview({subject,appraisal,documentDigest,review,confirmed}={}){
 const match=validateIdentity({subject,appraisal,documentDigest,confirmed});
 if(match.status==='HOLD')return {status:'HOLD',reasons:match.reasons,link:null};
 if(!review||!['HOLD','REVIEW_REQUIRED'].includes(review.status)||
   (review.status==='REVIEW_REQUIRED'&&Array.isArray(review.issues)&&review.issues.some(x=>x?.severity==='BLOCK')))
   return {status:'HOLD',reasons:['VALID_APPRAISAL_AUDIT_REQUIRED'],link:null};
 const link=Object.freeze({
  kind:'STARTAK_APPRAISAL_SESSION_REVIEW_V1',documentDigest:digest(documentDigest),
  reportId:String(appraisal.reportId).trim(),subjectSnapshot:match.subjectSnapshot,
  reviewStatus:review.status,issues:Object.freeze((Array.isArray(review.issues)?review.issues:[])
    .map(x=>String(x.code||'')).filter(Boolean)),
  independentlyVerified:false,professionalUseAuthorized:false, 
 });
 return {status:review.status==='HOLD'?'LINKED_AUDIT_HOLD':'LINKED_REVIEW_REQUIRED',
  reasons:[],link};
}
function evaluateBoundReview({subject={},link=null}={}){
 if(link===null||link===undefined)return {status:'NOT_LINKED',appraisalReview:null,blockExport:false,reasons:[]};
 if(typeof link!=='object'||Array.isArray(link))
  return {status:'STALE_OR_UNMATCHED_LINK',appraisalReview:{status:'HOLD'},blockExport:true,
   reasons:['APPRAISAL_LINK_MALFORMED']};
 if(link.invalidated===true||link.kind!=='STARTAK_APPRAISAL_SESSION_REVIEW_V1'||!digest(link.documentDigest)||
    !same(snapshot(subject),link.subjectSnapshot||{}))
  return {status:'STALE_OR_UNMATCHED_LINK',appraisalReview:{status:'HOLD'},blockExport:true,reasons:['APPRAISAL_LINK_IDENTITY_OR_SOURCE_CHANGED']};
 if(!['HOLD','REVIEW_REQUIRED'].includes(link.reviewStatus)||
    (link.reviewStatus==='REVIEW_REQUIRED'&&Array.isArray(link.issues)&&
      link.issues.some(x=>['CIRCULAR_VALUATION','INCOME_CAPITALIZATION_MISMATCH',
        'NOI_RECONCILIATION_MISMATCH','RENT_PERCENTAGE_ARITHMETIC_MISMATCH',
        'SPECIALIST_EVIDENCE_HOLD','INVALID_NUMERIC_INPUT','APPRAISAL_INPUT_CONFLICT',
        'INDOOR_LEASABLE_AREA_EXCEEDS_BUILT_AREA','COST_TOTAL_MISMATCH','IMPROVEMENT_RIGHTS_UNRESOLVED'].includes(x))))
  return {status:'STALE_OR_UNMATCHED_LINK',appraisalReview:{status:'HOLD'},blockExport:true,
    reasons:['APPRAISAL_REVIEW_STATE_INVALID_OR_BLOCKERS_PRESENT']};
 if(link.reviewStatus==='HOLD')
  return {status:'LINKED_AUDIT_HOLD',appraisalReview:{status:'HOLD'},blockExport:true,reasons:['APPRAISAL_AUDIT_HOLD']};
 return {status:'LINKED_REVIEW_REQUIRED',appraisalReview:{status:'REVIEW_REQUIRED'},
  blockExport:false,reasons:['USER_ATTESTED_NOT_VERIFIED']};
}
module.exports={snapshot,validateIdentity,bindReview,evaluateBoundReview};
