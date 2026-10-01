'use strict';

const assert=require('assert');
const crypto=require('crypto');
const {STAGE_STATUS,OVERALL_STATUS,STAGE_ID,createStagePacket,createOrchestrationPolicy,evaluateCaseOrchestration}=require('../../src/orchestration/governed-case-property-orchestrator');
const {ROLE,ACTION,STATUS:RBAC_STATUS,createOperatorSession,createWorkspaceAction,evaluateOperatorWorkspaceAction}=require('../../src/operator/governed-operator-workspace');
const {EVENT_TYPE,SEVERITY,TECHNICAL_HEALTH,createTelemetryEvent,summarizeOperationalState}=require('../../src/observability/governed-operational-telemetry');
const {RESULT,STATUS,TECHNICAL_GATE,EXTERNAL_GATE,createQualificationCheck,evaluateIntegrationQualification}=require('../../src/qualification/governed-integration-qualification');

const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');
const H=(c)=>c.repeat(64);
const AS_OF='2026-10-01T19:00:00Z';
const CASE_ID='CASE-C28'; const PROP='PROP-C28'; const MARKET='MARKET-C28';
const stages=Object.values(STAGE_ID); const cap=(s)=>`CAPABILITY:${s}:QUALIFIED`;
function packet(stageId,status=STAGE_STATUS.READY,reason=null){return createStagePacket({stageId,caseId:CASE_ID,propertyRef:PROP,marketScopeRef:MARKET,capabilityRef:cap(stageId),status,inputHashSha256:hash(`in:${stageId}`),outputHashSha256:hash(`out:${stageId}:${status}`),lineageHashesSha256:[hash(`lineage:${stageId}`)],blockers:status===STAGE_STATUS.READY?[]:[reason||'EVIDENCE_REQUIRED'],riskFlags:[],evaluatedAt:'2026-10-01T18:00:00Z',validUntil:'2026-10-02T19:00:00Z',transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,autonomousActionExecuted:false});}
function policy(){const allowed={};for(const s of stages)allowed[s]=[cap(s)];return createOrchestrationPolicy({policyId:'POLICY-C28',requiredStageIds:stages,optionalStageIds:[],allowedCapabilityRefsByStage:allowed,reviewedByRef:'C28-GOVERNANCE',reviewEvidenceRef:'C28-POLICY-EVIDENCE',reviewedAt:'2026-10-01T17:00:00Z',validUntil:'2026-10-03T19:00:00Z'});}
function run(packets,id){return evaluateCaseOrchestration({executionId:id,caseId:CASE_ID,propertyRef:PROP,marketScopeRef:MARKET,asOf:AS_OF,policy:policy(),stagePackets:packets});}

// Cross-layer READY case -> governed human view -> telemetry; no authority appears.
const readyCase=run(stages.map(s=>packet(s)),'EXEC-C28-READY');
assert.strictEqual(readyCase.status,OVERALL_STATUS.READY_FOR_HUMAN_CASE_REVIEW);
const viewer=createOperatorSession({sessionId:'SESSION-C28-VIEW',userRef:'USER-C28',role:ROLE.VIEWER,caseId:CASE_ID,propertyRef:PROP,issuedAt:'2026-10-01T18:00:00Z',validUntil:'2026-10-01T20:00:00Z',authenticationEvidenceRef:'AUTH-C28',authenticationEvidenceHashSha256:H('a'),mfaVerified:true});
const viewAction=createWorkspaceAction({actionId:'ACTION-C28-VIEW',sessionHashSha256:viewer.sessionHashSha256,caseId:CASE_ID,propertyRef:PROP,action:ACTION.VIEW_CASE,payload:{caseResultHashSha256:readyCase.resultHashSha256},requestedAt:'2026-10-01T18:30:00Z'});
const view=evaluateOperatorWorkspaceAction({session:viewer,workspaceAction:viewAction,caseSnapshot:{caseId:CASE_ID,propertyRef:PROP,status:readyCase.status,resultHashSha256:readyCase.resultHashSha256},asOf:AS_OF});
assert.strictEqual(view.status,RBAC_STATUS.ALLOWED);assert.strictEqual(view.deterministicStateAfter,readyCase.status);assert.strictEqual(view.approvalAuthorized,false);
const readyEvent=createTelemetryEvent({eventId:'EVENT-C28-READY',eventType:EVENT_TYPE.CASE_EVALUATED,severity:SEVERITY.INFO,occurredAt:AS_OF,correlationRef:'CORR-C28',caseId:CASE_ID,propertyRef:PROP,requestRef:'REQ-C28',sessionRef:viewer.sessionId,sourceComponent:'c28-integration',technicalHealth:TECHNICAL_HEALTH.HEALTHY,businessReadiness:readyCase.status,payload:{caseResultHashSha256:readyCase.resultHashSha256,workspaceResultHashSha256:view.resultHashSha256}});
const readyTelemetry=summarizeOperationalState({events:[readyEvent],metrics:[],asOf:AS_OF});
assert.strictEqual(readyTelemetry.technicalServiceHealthy,true);assert.strictEqual(readyTelemetry.businessApprovalInferred,false);assert.strictEqual(readyTelemetry.approvalAuthorized,false);

// Cross-layer HOLD cannot be upgraded by reviewer or observability.
const holdPackets=stages.map(s=>s===STAGE_ID.TITLE_SURVEY_PROPERTY?packet(s,STAGE_STATUS.HOLD,'TITLE_EVIDENCE_UNRESOLVED'):packet(s));
const holdCase=run(holdPackets,'EXEC-C28-HOLD'); assert.strictEqual(holdCase.status,OVERALL_STATUS.HOLD);
const reviewer=createOperatorSession({sessionId:'SESSION-C28-REVIEW',userRef:'REVIEWER-C28',role:ROLE.REVIEWER,caseId:CASE_ID,propertyRef:PROP,issuedAt:'2026-10-01T18:00:00Z',validUntil:'2026-10-01T20:00:00Z',authenticationEvidenceRef:'AUTH-REVIEW-C28',authenticationEvidenceHashSha256:H('b'),mfaVerified:true});
const reviewAction=createWorkspaceAction({actionId:'ACTION-C28-REVIEW',sessionHashSha256:reviewer.sessionHashSha256,caseId:CASE_ID,propertyRef:PROP,action:ACTION.SUBMIT_REVIEW_DISPOSITION,payload:{disposition:'EVIDENCE_REQUIRED'},requestedAt:'2026-10-01T18:31:00Z'});
const review=evaluateOperatorWorkspaceAction({session:reviewer,workspaceAction:reviewAction,caseSnapshot:{caseId:CASE_ID,propertyRef:PROP,status:holdCase.status,resultHashSha256:holdCase.resultHashSha256},asOf:AS_OF});
assert.strictEqual(review.status,RBAC_STATUS.ALLOWED);assert.strictEqual(review.deterministicStateAfter,OVERALL_STATUS.HOLD);assert.strictEqual(review.deterministicStateOverrideApplied,false);assert.strictEqual(review.transactionAuthorized,false);

// Qualification evidence: every technical gate must be supplied and PASS; external gaps remain explicit.
const HEAD=H('c');let i=0;
const technicalChecks=Object.values(TECHNICAL_GATE).map(g=>createQualificationCheck({checkId:`TECH-${++i}`,gate:g,result:RESULT.PASS,candidateHeadSha:HEAD,evidenceRef:`EVIDENCE-${g}`,evidenceHashSha256:hash(`evidence:${g}`),observedAt:'2026-10-01T18:45:00Z'}));
const externalChecks=Object.values(EXTERNAL_GATE).map(g=>createQualificationCheck({checkId:`EXT-${++i}`,gate:g,result:RESULT.NOT_EVALUATED,candidateHeadSha:HEAD,reasonCode:`${g}_EVIDENCE_NOT_SUPPLIED`}));
const qualified=evaluateIntegrationQualification({qualificationId:'QUAL-C28',candidateHeadSha:HEAD,checks:[...technicalChecks,...externalChecks],evaluatedAt:AS_OF});
assert.strictEqual(qualified.status,STATUS.TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN);assert.strictEqual(qualified.technicalQualificationReached,true);assert.strictEqual(qualified.productionAuthorized,false);assert.strictEqual(qualified.publicAiAuthorized,false);assert.strictEqual(qualified.commercialGoLive,'HOLD');

const missing=evaluateIntegrationQualification({qualificationId:'QUAL-C28-MISSING',candidateHeadSha:HEAD,checks:technicalChecks.slice(1),evaluatedAt:AS_OF});
assert.strictEqual(missing.status,STATUS.HOLD_EVIDENCE);assert.strictEqual(missing.technicalQualificationReached,false);
const failedChecks=technicalChecks.map((c,idx)=>idx===0?createQualificationCheck({checkId:'TECH-FAIL',gate:c.gate,result:RESULT.FAIL,candidateHeadSha:HEAD,evidenceRef:'FAIL-EVIDENCE',evidenceHashSha256:H('d'),observedAt:'2026-10-01T18:45:00Z'}):c);
const failed=evaluateIntegrationQualification({qualificationId:'QUAL-C28-FAIL',candidateHeadSha:HEAD,checks:failedChecks,evaluatedAt:AS_OF});assert.strictEqual(failed.status,STATUS.HOLD_FAILURE);
const tampered=[{...technicalChecks[0],evidenceRef:'TAMPERED'},...technicalChecks.slice(1)];
const integrity=evaluateIntegrationQualification({qualificationId:'QUAL-C28-TAMPER',candidateHeadSha:HEAD,checks:tampered,evaluatedAt:AS_OF});assert.strictEqual(integrity.status,STATUS.HOLD_INTEGRITY);
assert.throws(()=>createQualificationCheck({checkId:'BAD-EXT',gate:EXTERNAL_GATE.UAT_PROFESSIONAL_REVIEW,result:RESULT.NOT_EVALUATED,candidateHeadSha:HEAD,reasonCode:'NOT_SUPPLIED',evidenceRef:'FAKE'}),/C28_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE/);

console.log('C28_COMPREHENSIVE_INTEGRATION_QUALIFICATION=PASS');
