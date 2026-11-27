'use strict';
// C9 historical profile capability, rebuilt on current guarded C8/C9 inputs.
// A supplied review record is NOT proof of an actual licensed reviewer.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {assessGuardedPlotEnvelope,STATUS}=require('./guarded-plot-envelope');
const VERSION='STARTAK_REVIEWED_PLOT_ENVELOPE_V1',REF=/^[A-Za-z0-9_.:-]{2,128}$/;
const TYPES=['FAR','BCR','SETBACK'];
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const validRef=x=>typeof x==='string'&&REF.test(x);
const equal=(a,b)=>hash(a)===hash(b);
function canonicalProfile(input,review){
 if(!isPlainJson(input)||!input||!isPlainJson(review)||!review||Array.isArray(review)||Object.keys(review).length!==4||![review.profileId,review.reviewedByRef,review.interpretationEvidenceRef].every(validRef))throw Error('C9_PROFILE_REVIEW_INVALID');
 const result=assessGuardedPlotEnvelope(input);
 if(result.status!==STATUS.CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW)throw Error('C9_PROFILE_UPSTREAM_NOT_READY');
 const reviewed=strictCalendarDateMs(review.reviewedAt),cutoff=strictCalendarDateMs(input.evaluatedAt);
 const relevant=input.planningRecords.filter(x=>TYPES.includes(x.constraintType));
 const dates=[...relevant.map(x=>strictCalendarDateMs(x.verification?.verifiedAt)),...input.titleFacts.map(x=>strictCalendarDateMs(x.observedAt)),strictCalendarDateMs(input.geometry.observedAt)];
 if(!Number.isFinite(reviewed)||reviewed>cutoff||dates.some(x=>!Number.isFinite(x)||x>reviewed))throw Error('C9_PROFILE_REVIEW_CHRONOLOGY_INVALID');
 const constraints=Object.fromEntries(TYPES.map(type=>{const row=input.planningEvidenceSet.trace.find(x=>x.type===type).values[0];return [type,{evidenceId:row.evidenceId,sourceRef:row.sourceRef,value:structuredClone(row.value),unit:row.unit}];}));
 const material={version:VERSION,caseId:input.caseId,propertyRef:input.propertyRef,evaluatedAt:new Date(cutoff).toISOString(),profileId:review.profileId,reviewedByRef:review.reviewedByRef,interpretationEvidenceRef:review.interpretationEvidenceRef,reviewedAt:new Date(reviewed).toISOString(),constraints,sourceInputHashSha256:hash(input),planningEvidenceSetHashSha256:input.planningEvidenceSet.planningEvidenceSetHashSha256,geometrySourceRef:input.geometry.sourceRef,calculations:structuredClone(result.calculations),reviewerIndependentlyAuthenticated:false,sourceAuthenticityIndependentlyVerified:false,officialPlanningApproval:false,buildingPermitEstablished:false,professionalHbuApproval:false,financialEngineInputsWritten:false,transactionAuthorized:false};
 return deepFreeze({...material,profileHashSha256:hash(material)});
}
function deepFreeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(deepFreeze);Object.freeze(x);}return x;}
function createReviewedPlotProfile(input,review){return canonicalProfile(input,review);}
function evaluateReviewedPlotProfile(input,profile){
 const hold=reason=>Object.freeze({status:'HOLD_REVIEWED_PLOT_PROFILE',reason,profileReplayVerified:false,calculations:null,reviewerIndependentlyAuthenticated:false,sourceAuthenticityIndependentlyVerified:false,officialPlanningApproval:false,buildingPermitEstablished:false,professionalHbuApproval:false,financialEngineInputsWritten:false,transactionAuthorized:false});
 try{
  if(!isPlainJson(profile)||!profile)return hold('C9_PROFILE_INVALID');
  const replay=canonicalProfile(input,{profileId:profile.profileId,reviewedByRef:profile.reviewedByRef,interpretationEvidenceRef:profile.interpretationEvidenceRef,reviewedAt:profile.reviewedAt});
  if(!equal(profile,replay))return hold('C9_PROFILE_REPLAY_MISMATCH');
  return Object.freeze({...replay,status:'CANDIDATE_FOR_INDEPENDENT_PROFILE_REVIEW',profileReplayVerified:true,reason:null});
 }catch{return hold('C9_PROFILE_REPLAY_FAILED');}
}
module.exports={VERSION,createReviewedPlotProfile,evaluateReviewedPlotProfile};
