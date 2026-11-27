'use strict';
// A review handoff, not a report exporter or professional approval service.
// Revalidate original proof packet rather than accepting a caller's READY flag.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {validateProofGroundedProviderResponse}=require('./proof-grounded-ai-runtime');
const {ROLE,ACTION,STATUS:OPERATOR_STATUS,evaluateOperatorWorkspaceAction}=require('../operator/governed-operator-workspace');
const VERSION='STARTAK_AI_REPORT_REVIEW_HANDOFF_V1';
const REF=/^[A-Za-z0-9_.:-]{2,128}$/;
const validRef=x=>typeof x==='string'&&REF.test(x);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function createAiReportReviewHandoff(input={}){
 const held=reason=>Object.freeze({version:VERSION,status:'HOLD_AI_REPORT_REVIEW',reason,reviewCandidateReady:false,draft:null,claims:null,reportExportAuthorized:false,professionalApprovalEstablished:false,sourceAuthenticityIndependentlyVerified:false,productionDeploymentAuthorized:false,transactionAuthorized:false});
 try{
  if(!isPlainJson(input)||!input||Array.isArray(input))return held('AI_REPORT_REVIEW_REQUEST_INVALID');
  const {proofPacket,reviewRequest,asOf}=input;
  if(!isPlainJson(proofPacket)||!isPlainJson(reviewRequest)||!reviewRequest||Object.keys(reviewRequest).length!==5||![reviewRequest.reviewRef,reviewRequest.reviewerRef,reviewRequest.caseId,reviewRequest.propertyRef].every(validRef))return held('AI_REPORT_REVIEW_REQUEST_INVALID');
  const packet=structuredClone(proofPacket),review=structuredClone(reviewRequest);
  const at=strictCalendarDateMs(asOf),requested=strictCalendarDateMs(review.requestedAt);
  if(!Number.isFinite(at)||at>Date.now()||!Number.isFinite(requested)||requested>at||requested<strictCalendarDateMs(packet.providerResponse?.generatedAt)||strictCalendarDateMs(packet.asOf)!==at)return held('AI_REPORT_REVIEW_WINDOW_INVALID');
  if(review.caseId!==packet.request?.caseId||review.propertyRef!==packet.request?.propertyRef||review.reviewerRef===packet.groundingManifest?.preparedByRef)return held('AI_REPORT_REVIEW_SCOPE_OR_SEPARATION_INVALID');
  const result=validateProofGroundedProviderResponse(packet);
  if(result.groundedDraftReviewReady!==true||typeof result.draft!=='string'||!Array.isArray(result.claims))return held('AI_REPORT_GROUNDING_NOT_READY');
  const material={version:VERSION,status:'CANDIDATE_FOR_INDEPENDENT_HUMAN_REPORT_REVIEW',reason:null,reviewCandidateReady:true,caseId:review.caseId,propertyRef:review.propertyRef,reviewRef:review.reviewRef,reviewerRef:review.reviewerRef,requestedAt:new Date(requested).toISOString(),asOf:new Date(at).toISOString(),requestHashSha256:packet.request.requestHashSha256,invocationHashSha256:packet.invocation.invocationHashSha256,responseHashSha256:packet.providerResponse.responseHashSha256,draftHashSha256:hash(result.draft),claimCount:result.claims.length,deterministicDecisionState:result.deterministicDecisionState,reportExportAuthorized:false,professionalApprovalEstablished:false,reviewerIndependentlyAuthenticated:false,sourceAuthenticityIndependentlyVerified:false,productionDeploymentAuthorized:false,transactionAuthorized:false};
  // Metadata only: actual draft text remains in the existing controlled AI review path.
  return Object.freeze({...material,handoffHashSha256:hash(material),draft:null,claims:null});
 }catch{return held('AI_REPORT_REVIEW_VALIDATION_FAILED');}
}
// Operator-bound review metadata. This replays the underlying packet and
// C26 session/action contracts. It does not establish actual IAM, tenancy,
// authentic case state or a professional approval. Call only from a trusted
// server path that separately authenticates those inputs.
function evaluateAiReportReviewAccess(input={}){
 const hold=reason=>Object.freeze({status:'HOLD_AI_REPORT_REVIEW_ACCESS',reason,reviewAccessCandidate:false,reviewMetadata:null,operatorIdentityIndependentlyAuthenticated:false,reportExportAuthorized:false,professionalApprovalEstablished:false,productionDeploymentAuthorized:false,transactionAuthorized:false});
 try{
  if(!isPlainJson(input)||!input||Array.isArray(input))return hold('AI_REVIEW_ACCESS_INPUT_INVALID');
  const {proofPacket,reviewRequest,asOf,session,workspaceAction,caseSnapshot}=structuredClone(input);
  const handoff=createAiReportReviewHandoff({proofPacket,reviewRequest,asOf});
  if(!handoff.reviewCandidateReady)return hold('AI_REVIEW_HANDOFF_NOT_READY');
  if(!session||!workspaceAction||!caseSnapshot||![ROLE.REVIEWER,ROLE.APPROVER].includes(session.role)||session.userRef!==handoff.reviewerRef||workspaceAction.action!==ACTION.VIEW_EVIDENCE)return hold('AI_REVIEW_OPERATOR_ROLE_OR_IDENTITY_MISMATCH');
  if(caseSnapshot.caseId!==handoff.caseId||caseSnapshot.propertyRef!==handoff.propertyRef||caseSnapshot.status!==handoff.deterministicDecisionState||!proofPacket.request.deterministicOutputHashesSha256.includes(caseSnapshot.resultHashSha256))return hold('AI_REVIEW_CASE_SNAPSHOT_BINDING_MISMATCH');
  if(!workspaceAction.payload||Object.keys(workspaceAction.payload).length!==1||workspaceAction.payload.handoffHashSha256!==handoff.handoffHashSha256||strictCalendarDateMs(workspaceAction.requestedAt)<strictCalendarDateMs(handoff.requestedAt))return hold('AI_REVIEW_ACTION_BINDING_MISMATCH');
  const access=evaluateOperatorWorkspaceAction({session,workspaceAction,caseSnapshot,asOf});
  if(access.status!==OPERATOR_STATUS.ALLOWED||access.actionAllowed!==true||access.deterministicStateAfter!==handoff.deterministicDecisionState)return hold('AI_REVIEW_OPERATOR_ACCESS_HOLD');
  return Object.freeze({status:'CANDIDATE_FOR_AUTHENTICATED_OPERATOR_REVIEW',reason:null,reviewAccessCandidate:true,reviewMetadata:handoff,operatorActionHashSha256:workspaceAction.actionHashSha256,operatorEvaluationHashSha256:access.resultHashSha256,caseResultHashSha256:caseSnapshot.resultHashSha256,operatorIdentityIndependentlyAuthenticated:false,caseSnapshotIndependentlyAuthenticated:false,reportExportAuthorized:false,professionalApprovalEstablished:false,productionDeploymentAuthorized:false,transactionAuthorized:false});
 }catch{return hold('AI_REVIEW_ACCESS_VALIDATION_FAILED');}
}
module.exports={VERSION,createAiReportReviewHandoff,evaluateAiReportReviewAccess};
