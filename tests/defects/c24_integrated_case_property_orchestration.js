'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  STAGE_STATUS, OVERALL_STATUS, STAGE_ID, AI_STAGE_IDS,
  createStagePacket, createOrchestrationPolicy, evaluateCaseOrchestration, assessReplay,
} = require('../../src/orchestration/governed-case-property-orchestrator');

const AS_OF='2026-10-01T13:30:00Z';
const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');
const stages=Object.values(STAGE_ID);
const capability=(id)=>`CAPABILITY:${id}:QUALIFIED`;

function packet(stageId, overrides={}) {
  const status=overrides.status || STAGE_STATUS.READY;
  return createStagePacket({
    stageId, caseId:'CASE-C24', propertyRef:'PROP-C24', marketScopeRef:'MARKET-C24', capabilityRef:capability(stageId), status,
    inputHashSha256:hash(`input:${stageId}`), outputHashSha256:hash(`output:${stageId}:${status}`), lineageHashesSha256:[hash(`lineage:${stageId}`)],
    blockers:status===STAGE_STATUS.READY?[]:[overrides.reason || 'UPSTREAM_EVIDENCE_REQUIRED'], riskFlags:overrides.riskFlags||[],
    evaluatedAt:'2026-10-01T10:00:00Z', validUntil:'2026-10-02T13:00:00Z',
    transactionAuthorized:false, approvalAuthorized:false, publicAiAuthorized:false, autonomousActionExecuted:false,
    ...overrides,
  });
}
function policy(overrides={}) {
  const bindings={}; stages.forEach((s)=>{bindings[s]=[capability(s)];});
  return createOrchestrationPolicy({
    policyId:'POLICY-C24-FULL-STACK', requiredStageIds:stages, optionalStageIds:[], allowedCapabilityRefsByStage:bindings,
    reviewedByRef:'ORCHESTRATION-GOVERNANCE-REVIEWER', reviewEvidenceRef:'C24-POLICY-REVIEW-EVIDENCE', reviewedAt:'2026-10-01T09:00:00Z', validUntil:'2026-10-03T13:00:00Z',
    ...overrides,
  });
}
function run(stagePackets, overrides={}) {
  return evaluateCaseOrchestration({executionId:'EXEC-C24-001',caseId:'CASE-C24',propertyRef:'PROP-C24',marketScopeRef:'MARKET-C24',asOf:AS_OF,policy:policy(),stagePackets,...overrides});
}
const readyPackets=stages.map((s)=>packet(s));

const ready=run(readyPackets);
assert.strictEqual(ready.status,OVERALL_STATUS.READY_FOR_HUMAN_CASE_REVIEW);
assert.strictEqual(ready.humanCaseReviewReady,true);
assert.strictEqual(ready.stageSummary.length,stages.length);
assert.strictEqual(ready.auditLineage.length,stages.length);
assert.strictEqual(ready.aiOverrideApplied,false);
assert.strictEqual(ready.transactionAuthorized,false);
assert.strictEqual(ready.approvalAuthorized,false);
assert.strictEqual(ready.publicAiAuthorized,false);
assert.strictEqual(ready.productionDeploymentAuthorized,false);
assert.strictEqual(ready.commercialGoLive,'HOLD');

const replay=run(readyPackets);
assert.strictEqual(replay.inputFingerprintSha256,ready.inputFingerprintSha256);
assert.strictEqual(replay.resultHashSha256,ready.resultHashSha256);
assert.deepStrictEqual(assessReplay(ready,replay),{status:'IDEMPOTENT_REPLAY',conflict:false,reason:null});

const upstreamHoldPackets=readyPackets.map((p)=>p.stageId===STAGE_ID.TITLE_SURVEY_PROPERTY?packet(p.stageId,{status:STAGE_STATUS.HOLD,reason:'TITLE_EVIDENCE_UNRESOLVED'}):p);
const upstreamHold=run(upstreamHoldPackets,{executionId:'EXEC-C24-HOLD'});
assert.strictEqual(upstreamHold.status,OVERALL_STATUS.HOLD);
assert.strictEqual(upstreamHold.humanCaseReviewReady,false);
assert(upstreamHold.blockers.includes(`${STAGE_ID.TITLE_SURVEY_PROPERTY}:TITLE_EVIDENCE_UNRESOLVED`));
assert.strictEqual(upstreamHold.stageSummary.find((s)=>s.stageId===STAGE_ID.GENERATIVE_INTELLIGENCE).status,STAGE_STATUS.READY);
assert.strictEqual(upstreamHold.aiOverrideApplied,false);

const notEvalPackets=readyPackets.map((p)=>p.stageId===STAGE_ID.MARKET_COMPARABLES?packet(p.stageId,{status:STAGE_STATUS.NOT_EVALUATED,reason:'OFFICIAL_MARKET_INPUT_NOT_SUPPLIED'}):p);
const notEval=run(notEvalPackets,{executionId:'EXEC-C24-NE'});
assert.strictEqual(notEval.status,OVERALL_STATUS.NOT_EVALUATED);
assert.strictEqual(notEval.humanCaseReviewReady,false);

const aiHoldPackets=readyPackets.map((p)=>AI_STAGE_IDS.includes(p.stageId)&&p.stageId===STAGE_ID.AI_PROVIDER_GATEWAY?packet(p.stageId,{status:STAGE_STATUS.HOLD,reason:'PROVIDER_GROUNDING_FAILED'}):p);
const aiHold=run(aiHoldPackets,{executionId:'EXEC-C24-AI-HOLD'});
assert.strictEqual(aiHold.status,OVERALL_STATUS.HOLD);
assert(aiHold.blockers.includes(`${STAGE_ID.AI_PROVIDER_GATEWAY}:PROVIDER_GROUNDING_FAILED`));

const missing=run(readyPackets.filter((p)=>p.stageId!==STAGE_ID.FINANCING),{executionId:'EXEC-C24-MISSING'});
assert.strictEqual(missing.status,OVERALL_STATUS.HOLD);
assert(missing.blockers.includes(`C24_EVIDENCE_REQUIRED_STAGE_MISSING:${STAGE_ID.FINANCING}`));

const duplicate=run([...readyPackets,readyPackets[0]],{executionId:'EXEC-C24-DUP'});
assert.strictEqual(duplicate.status,OVERALL_STATUS.HOLD);
assert(duplicate.blockers.includes(`C24_INTEGRITY_DUPLICATE_STAGE:${readyPackets[0].stageId}`));

const wrongContext=readyPackets.map((p)=>p.stageId===STAGE_ID.AUCTION_ACQUISITION?createStagePacket({
  stageId:p.stageId,caseId:'OTHER-CASE',propertyRef:'PROP-C24',marketScopeRef:'MARKET-C24',capabilityRef:p.capabilityRef,status:STAGE_STATUS.READY,
  inputHashSha256:p.inputHashSha256,outputHashSha256:p.outputHashSha256,lineageHashesSha256:p.lineageHashesSha256,blockers:[],riskFlags:[],evaluatedAt:'2026-10-01T10:00:00Z',validUntil:'2026-10-02T13:00:00Z',
  transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,autonomousActionExecuted:false}):p);
const contextHold=run(wrongContext,{executionId:'EXEC-C24-CONTEXT'});
assert.strictEqual(contextHold.status,OVERALL_STATUS.HOLD);
assert(contextHold.blockers.includes(`C24_CONTEXT_STAGE_MISMATCH:${STAGE_ID.AUCTION_ACQUISITION}`));

const tampered={...readyPackets[0],outputHashSha256:hash('tampered')};
const tamperHold=run([tampered,...readyPackets.slice(1)],{executionId:'EXEC-C24-TAMPER'});
assert.strictEqual(tamperHold.status,OVERALL_STATUS.HOLD);
assert(tamperHold.blockers.includes('C24_INTEGRITY_STAGE_PACKET'));

const stalePacket=createStagePacket({
  stageId:STAGE_ID.RENTAL_REGULATION,caseId:'CASE-C24',propertyRef:'PROP-C24',marketScopeRef:'MARKET-C24',capabilityRef:capability(STAGE_ID.RENTAL_REGULATION),status:STAGE_STATUS.READY,
  inputHashSha256:hash('stale-in'),outputHashSha256:hash('stale-out'),lineageHashesSha256:[hash('stale-lineage')],blockers:[],riskFlags:[],evaluatedAt:'2026-09-29T10:00:00Z',validUntil:'2026-09-30T13:00:00Z',
  transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,autonomousActionExecuted:false});
const staleHold=run(readyPackets.map((p)=>p.stageId===STAGE_ID.RENTAL_REGULATION?stalePacket:p),{executionId:'EXEC-C24-STALE'});
assert.strictEqual(staleHold.status,OVERALL_STATUS.HOLD);
assert(staleHold.blockers.includes(`C24_WINDOW_STAGE_STALE:${STAGE_ID.RENTAL_REGULATION}`));

const wrongCap=createStagePacket({
  stageId:STAGE_ID.POLICY_SHOCK,caseId:'CASE-C24',propertyRef:'PROP-C24',marketScopeRef:'MARKET-C24',capabilityRef:'UNQUALIFIED-CAPABILITY',status:STAGE_STATUS.READY,
  inputHashSha256:hash('wrongcap-in'),outputHashSha256:hash('wrongcap-out'),lineageHashesSha256:[hash('wrongcap-lineage')],blockers:[],riskFlags:[],evaluatedAt:'2026-10-01T10:00:00Z',validUntil:'2026-10-02T13:00:00Z',
  transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,autonomousActionExecuted:false});
const capHold=run(readyPackets.map((p)=>p.stageId===STAGE_ID.POLICY_SHOCK?wrongCap:p),{executionId:'EXEC-C24-CAP'});
assert.strictEqual(capHold.status,OVERALL_STATUS.HOLD);
assert(capHold.blockers.includes(`C24_POLICY_CAPABILITY_NOT_ALLOWED:${STAGE_ID.POLICY_SHOCK}:UNQUALIFIED-CAPABILITY`));

const changedPackets=readyPackets.map((p)=>p.stageId===STAGE_ID.MARKET_LIQUIDITY?packet(p.stageId,{riskFlags:['NEW-RISK-FLAG']}):p);
const conflict=run(changedPackets);
assert.strictEqual(conflict.status,OVERALL_STATUS.READY_FOR_HUMAN_CASE_REVIEW);
assert.strictEqual(assessReplay(ready,conflict).status,'CONFLICT');
assert.strictEqual(assessReplay(ready,conflict).reason,'C24_REPLAY_EXECUTION_ID_INPUT_CONFLICT');

assert.throws(()=>createStagePacket({
  stageId:STAGE_ID.GEOSPATIAL_EVIDENCE,caseId:'C',propertyRef:'P',capabilityRef:'CAP',status:STAGE_STATUS.READY,inputHashSha256:hash('i'),outputHashSha256:hash('o'),lineageHashesSha256:[hash('l')],blockers:['ILLEGAL'],riskFlags:[],evaluatedAt:'2026-10-01T10:00:00Z',validUntil:'2026-10-02T10:00:00Z',transactionAuthorized:false,approvalAuthorized:false,publicAiAuthorized:false,autonomousActionExecuted:false,
}),/C24_READY_STAGE_CANNOT_HAVE_BLOCKERS/);

console.log('C24_INTEGRATED_CASE_PROPERTY_ORCHESTRATION=PASS');
