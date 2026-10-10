'use strict';
const {createDecisionAction,ACTION_TYPE,ACTION_STATUS,buildDecisionActionRegister}=require('./index');
const {createActionStateHistory,transitionActionState}=require('./state-history');
const {sha256Hex}=require('../crypto/sha256');
const {createLocalReviewJournal,readLocalReviewJournal}=require('../storage/local-review-journal');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const string=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function workspaceFingerprint(workspace){return sha256Hex(JSON.stringify({projectId:workspace.projectId,caseId:workspace.caseId,case:workspace.executableCase}));}
function gapRequirements(workspace){
 const sections=workspace.orchestration?.unresolvedLifecycleSections||[];
 return sections.map(section=>({section,code:`LIFECYCLE_GAP:${section}`,
  type:/legal|title|assignment|scope/i.test(section)?ACTION_TYPE.LEGAL_REVIEW:/inspection|technical/i.test(section)?ACTION_TYPE.TECHNICAL_DD:/valuation|review/i.test(section)?ACTION_TYPE.VALUATION_REVIEW:ACTION_TYPE.EVIDENCE,
  requiresLicensedProfessional:/legal|title|inspection|technical|valuation/i.test(section),requiredEvidenceKeys:[String(section)]}));
}
function createLocalCaseAction({workspace,section,ownerId,dueDate,actorId,occurredAt}){
 const gap=gapRequirements(workspace).find(g=>g.section===section);
 if(!gap||!string(ownerId)||!string(actorId)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate||'')||!date(dueDate)||new Date(dueDate).toISOString().slice(0,10)!==dueDate||!date(occurredAt))fail('LOCAL_RECORD_INVALID');
 const action=createDecisionAction({actionId:`GAP:${sha256Hex(JSON.stringify([workspace.projectId,workspace.caseId,section])).slice(0,20)}`,caseId:workspace.caseId,projectId:workspace.projectId,
  type:gap.type,description:gap.code,ownerId:ownerId.trim(),dueDate,requiresLicensedProfessional:gap.requiresLicensedProfessional,requiredEvidenceKeys:gap.requiredEvidenceKeys,sourceDecisionRef:`LOCAL_CASE:${workspaceFingerprint(workspace)}`});
 return {action,history:createActionStateHistory({action,actorId,occurredAt}),review:null};
}
function advanceLocalCaseAction({entry,toStatus,actorId,occurredAt,evidenceRef='',reviewNote=''}){
 if(!string(actorId)||!date(occurredAt))fail('LOCAL_RECORD_INVALID');
 if(toStatus===ACTION_STATUS.CLOSED){
  if(entry.action.requiresLicensedProfessional)fail('LICENSED_PROFESSIONAL_REVIEW_REQUIRED');
  if(!string(evidenceRef)||!string(reviewNote)||actorId.trim()===entry.action.ownerId)fail('HUMAN_CLOSURE_REVIEW_REQUIRED');
 }
 if(toStatus===ACTION_STATUS.SATISFIED_PENDING_REVIEW&&!string(evidenceRef))fail('REQUIRED_EVIDENCE_NOT_SATISFIED');
 const history=transitionActionState({history:entry.history,toStatus,actorId:actorId.trim(),occurredAt,reasonCode:'EXPLICIT_LOCAL_HUMAN_REVIEW',evidenceRefs:evidenceRef?[evidenceRef]:[]});
 const review=toStatus===ACTION_STATUS.CLOSED?{reviewerId:actorId.trim(),reviewedAt:occurredAt,evidenceRef,reviewNote,identityAuthenticated:false,independentlyVerified:false}:null;
 return {...entry,history,review,reviews:review?{...(entry.reviews||{}),[history.events.at(-1).sequence]:review}:(entry.reviews||{})};
}
function validateLocalCaseActions(workspace,entries){
 if(!Array.isArray(entries)||entries.length>50)fail('LOCAL_RECORD_INVALID');
 const allowed=new Set(gapRequirements(workspace).map(g=>g.section));const ids=new Set();
 for(const entry of entries){
  const a=entry?.action,h=entry?.history;
  if(!a||!h||a.caseId!==workspace.caseId||a.projectId!==workspace.projectId||a.sourceDecisionRef!==`LOCAL_CASE:${workspaceFingerprint(workspace)}`||ids.has(a.actionId))fail('LOCAL_RECORD_SCOPE_MISMATCH');
  ids.add(a.actionId);const section=a.requiredEvidenceKeys?.[0];if(!allowed.has(section))fail('LOCAL_RECORD_SCOPE_MISMATCH');
  if(!Array.isArray(h.events)||h.events.length<1||h.events.length>200)fail('LOCAL_RECORD_INVALID');
  const first=h.events[0];const rebuilt=createLocalCaseAction({workspace,section,ownerId:a.ownerId,dueDate:a.dueDate,actorId:first.actorId,occurredAt:first.occurredAt});
  if(JSON.stringify(rebuilt.action)!==JSON.stringify(a))fail('LOCAL_RECORD_INVALID');
  let replay=rebuilt.history;
  for(const event of h.events.slice(1)){
   if(!date(event.occurredAt)||Date.parse(event.occurredAt)<Date.parse(replay.events.at(-1).occurredAt))fail('LOCAL_RECORD_INVALID');
   if(event.toStatus===ACTION_STATUS.CLOSED){
    const review=entry.reviews?.[event.sequence];
    if(a.requiresLicensedProfessional||!review||review.reviewerId!==event.actorId||review.reviewerId===a.ownerId||review.reviewedAt!==event.occurredAt||!string(review.reviewNote)||review.evidenceRef!==event.evidenceRefs?.[0]||review.identityAuthenticated!==false||review.independentlyVerified!==false)fail('HUMAN_CLOSURE_REVIEW_REQUIRED');
   }
   if(event.toStatus===ACTION_STATUS.SATISFIED_PENDING_REVIEW&&!event.evidenceRefs?.length)fail('REQUIRED_EVIDENCE_NOT_SATISFIED');
   replay=transitionActionState({history:replay,toStatus:event.toStatus,actorId:event.actorId,occurredAt:event.occurredAt,reasonCode:event.reasonCode,evidenceRefs:event.evidenceRefs,professionalReviewRef:event.professionalReviewRef});
  }
  if(JSON.stringify(replay)!==JSON.stringify(h))fail('LOCAL_RECORD_INVALID');
 }
 return entries;
}
function localCaseActionRegister(workspace,entries){validateLocalCaseActions(workspace,entries);return buildDecisionActionRegister({projectId:workspace.projectId,caseId:workspace.caseId,actions:entries.map(e=>({...e.action,status:e.history.currentStatus}))});}
function exportLocalCaseActions(workspace,entries){validateLocalCaseActions(workspace,entries);return createLocalReviewJournal({projectId:workspace.projectId,caseId:workspace.caseId,kind:'ACTIONS',payload:{workspaceFingerprint:workspaceFingerprint(workspace),entries}});}
function restoreLocalCaseActions(workspace,text){const read=readLocalReviewJournal(text,{projectId:workspace.projectId,caseId:workspace.caseId,kind:'ACTIONS'});if(read.payload.workspaceFingerprint!==workspaceFingerprint(workspace))fail('LOCAL_RECORD_SCOPE_MISMATCH');return validateLocalCaseActions(workspace,read.payload.entries);}
module.exports={gapRequirements,workspaceFingerprint,createLocalCaseAction,advanceLocalCaseAction,validateLocalCaseActions,localCaseActionRegister,exportLocalCaseActions,restoreLocalCaseActions};
