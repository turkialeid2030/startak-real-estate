'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SCENARIO_TYPE, OBSERVATION_STATUS, CAMPAIGN_STATUS,
  createSimulationScenario, createSimulationObservation, evaluateShadowCampaign,
} = require('../../src/simulation/governed-shadow-simulation');

const HEAD='c371c426cd10fac6b6e2e4cc033b770e1417b7d0';
const CASE='CASE-C29';
const PROP='PROP-C29';
const AS_OF='2026-10-01T20:00:00Z';
const hash=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');
const H=(c)=>c.repeat(64);

let seq=0;
function scenario(type, overrides={}) {
  seq += 1;
  const external=type===SCENARIO_TYPE.HISTORICAL_REPLAY || type===SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW;
  return createSimulationScenario({
    scenarioId:`SCENARIO-${seq}-${type}`, scenarioType:type, caseId:CASE, propertyRef:PROP,
    candidateHeadSha:HEAD, governedInputHashSha256:hash(`input:${type}:${seq}`), synthetic:!external,
    transactionExecuted:false,bidSubmitted:false,paymentInitiated:false,filingSubmitted:false,termsAccepted:false,productionDeploymentExecuted:false,autonomousActionExecuted:false,
    ...overrides,
  });
}
let obsSeq=0;
function syntheticObservation(s, overrides={}) {
  obsSeq += 1;
  return createSimulationObservation({observationId:`OBS-SYN-${obsSeq}`,scenarioId:s.scenarioId,scenarioHashSha256:s.scenarioHashSha256,status:OBSERVATION_STATUS.COMPLETED_SYNTHETIC,outputHashSha256:hash(`synthetic-output:${s.scenarioId}`),observedAt:'2026-10-01T19:00:00Z',...overrides});
}
function notEvaluated(s, reason) {
  obsSeq += 1;
  return createSimulationObservation({observationId:`OBS-NE-${obsSeq}`,scenarioId:s.scenarioId,scenarioHashSha256:s.scenarioHashSha256,status:OBSERVATION_STATUS.NOT_EVALUATED,reasonCode:reason});
}
function actualObservation(s, kind) {
  obsSeq += 1;
  return createSimulationObservation({observationId:`OBS-ACT-${obsSeq}`,scenarioId:s.scenarioId,scenarioHashSha256:s.scenarioHashSha256,status:OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL,outputHashSha256:hash(`actual-output:${s.scenarioId}`),evidenceRef:`ACTUAL-EVIDENCE-${s.scenarioType}`,evidenceHashSha256:hash(`actual-evidence:${s.scenarioId}`),evidenceKind:kind,observedAt:'2026-10-01T19:10:00Z'});
}

const scenarios=[
  scenario(SCENARIO_TYPE.SYNTHETIC_END_TO_END),scenario(SCENARIO_TYPE.HISTORICAL_REPLAY),scenario(SCENARIO_TYPE.SOURCE_DEGRADATION),scenario(SCENARIO_TYPE.POLICY_SHOCK),
  scenario(SCENARIO_TYPE.MONTE_CARLO),scenario(SCENARIO_TYPE.AI_HOSTILE_INPUT),scenario(SCENARIO_TYPE.SIDE_EFFECT_DRY_RUN),scenario(SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW),
];
const byType=Object.fromEntries(scenarios.map(s=>[s.scenarioType,s]));
const partialObs=scenarios.map((s)=>{
  if(s.scenarioType===SCENARIO_TYPE.HISTORICAL_REPLAY) return notEvaluated(s,'REAL_HISTORICAL_INPUTS_NOT_SUPPLIED');
  if(s.scenarioType===SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW) return notEvaluated(s,'REAL_UAT_REVIEW_EVIDENCE_NOT_SUPPLIED');
  return syntheticObservation(s);
});
const partial=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-PARTIAL',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios,observations:partialObs,evaluatedAt:AS_OF});
assert.strictEqual(partial.status,CAMPAIGN_STATUS.TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN);
assert.strictEqual(partial.technicalSimulationComplete,true);
assert.deepStrictEqual(partial.externalOpenTypes,[SCENARIO_TYPE.HISTORICAL_REPLAY,SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW].sort());
assert.strictEqual(partial.historicalPerformanceEstablished,false);assert.strictEqual(partial.uatApproved,false);assert.strictEqual(partial.productionPerformanceClaimed,false);
assert.strictEqual(partial.transactionAuthorized,false);assert.strictEqual(partial.approvalAuthorized,false);assert.strictEqual(partial.publicAiAuthorized,false);assert.strictEqual(partial.productionDeploymentAuthorized,false);assert.strictEqual(partial.commercialGoLive,'HOLD');assert.strictEqual(partial.realSideEffectsExecuted,false);

const completeObs=scenarios.map((s)=>{
  if(s.scenarioType===SCENARIO_TYPE.HISTORICAL_REPLAY) return actualObservation(s,'HISTORICAL_REPLAY_INPUT_AND_RESULT_EVIDENCE');
  if(s.scenarioType===SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW) return actualObservation(s,'UAT_PROFESSIONAL_REVIEW_EVIDENCE');
  return syntheticObservation(s);
});
const complete=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-COMPLETE-EVIDENCE',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios,observations:completeObs,evaluatedAt:AS_OF});
assert.strictEqual(complete.status,CAMPAIGN_STATUS.TECHNICALLY_COMPLETE);assert.strictEqual(complete.technicalSimulationComplete,true);
assert.strictEqual(complete.historicalPerformanceEstablished,false);assert.strictEqual(complete.uatApproved,false);assert.strictEqual(complete.productionPerformanceClaimed,false);assert.strictEqual(complete.commercialGoLive,'HOLD');

const technicalNe=partialObs.map((o)=>o.scenarioId===byType[SCENARIO_TYPE.MONTE_CARLO].scenarioId?notEvaluated(byType[SCENARIO_TYPE.MONTE_CARLO],'GOVERNED_MONTE_CARLO_INPUT_NOT_SUPPLIED'):o);
const technicalHold=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-TECH-NE',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios,observations:technicalNe,evaluatedAt:AS_OF});
assert.strictEqual(technicalHold.status,CAMPAIGN_STATUS.HOLD_EVIDENCE);assert.strictEqual(technicalHold.technicalSimulationComplete,false);

const missing=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-MISSING',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios:scenarios.slice(0,-1),observations:partialObs.slice(0,-1),evaluatedAt:AS_OF});
assert.strictEqual(missing.status,CAMPAIGN_STATUS.HOLD_EVIDENCE);
const tamperedObs=[{...partialObs[0],outputHashSha256:hash('tampered')},...partialObs.slice(1)];
const tampered=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-TAMPER',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios,observations:tamperedObs,evaluatedAt:AS_OF});
assert.strictEqual(tampered.status,CAMPAIGN_STATUS.HOLD_INTEGRITY);

const wrongScenario=createSimulationScenario({scenarioId:'SCENARIO-WRONG-CONTEXT',scenarioType:SCENARIO_TYPE.SYNTHETIC_END_TO_END,caseId:'OTHER-CASE',propertyRef:PROP,candidateHeadSha:HEAD,governedInputHashSha256:hash('wrong-context'),synthetic:true});
const wrongScenarios=[wrongScenario,...scenarios.filter(s=>s.scenarioType!==SCENARIO_TYPE.SYNTHETIC_END_TO_END)];
const wrongObs=[syntheticObservation(wrongScenario),...partialObs.filter(o=>o.scenarioId!==byType[SCENARIO_TYPE.SYNTHETIC_END_TO_END].scenarioId)];
const context=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-CONTEXT',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios:wrongScenarios,observations:wrongObs,evaluatedAt:AS_OF});
assert.strictEqual(context.status,CAMPAIGN_STATUS.HOLD_CONTEXT);

const futureObs=partialObs.map((o)=>o.scenarioId===byType[SCENARIO_TYPE.AI_HOSTILE_INPUT].scenarioId?syntheticObservation(byType[SCENARIO_TYPE.AI_HOSTILE_INPUT],{observedAt:'2026-10-02T19:00:00Z'}):o);
const future=evaluateShadowCampaign({campaignId:'CAMPAIGN-C29-FUTURE',candidateHeadSha:HEAD,caseId:CASE,propertyRef:PROP,scenarios,observations:futureObs,evaluatedAt:AS_OF});
assert.strictEqual(future.status,CAMPAIGN_STATUS.HOLD_TEMPORAL);

assert.throws(()=>createSimulationScenario({scenarioId:'SIDE-EFFECT-ATTEMPT',scenarioType:SCENARIO_TYPE.SIDE_EFFECT_DRY_RUN,caseId:CASE,propertyRef:PROP,candidateHeadSha:HEAD,governedInputHashSha256:hash('side-effect'),synthetic:true,paymentInitiated:true}),/C29_REAL_SIDE_EFFECT_FORBIDDEN/);
assert.throws(()=>createSimulationObservation({observationId:'FAKE-HISTORY',scenarioId:byType[SCENARIO_TYPE.HISTORICAL_REPLAY].scenarioId,scenarioHashSha256:byType[SCENARIO_TYPE.HISTORICAL_REPLAY].scenarioHashSha256,status:OBSERVATION_STATUS.NOT_EVALUATED,reasonCode:'NOT_SUPPLIED',evidenceRef:'FABRICATED-EVIDENCE'}),/C29_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE/);
assert.throws(()=>createSimulationObservation({observationId:'SYNTHETIC-PRETENDING-ACTUAL',scenarioId:byType[SCENARIO_TYPE.MONTE_CARLO].scenarioId,scenarioHashSha256:byType[SCENARIO_TYPE.MONTE_CARLO].scenarioHashSha256,status:OBSERVATION_STATUS.COMPLETED_SYNTHETIC,outputHashSha256:hash('x'),observedAt:'2026-10-01T19:00:00Z',evidenceRef:'FAKE',evidenceHashSha256:hash('fake'),evidenceKind:'PRODUCTION_RESULT'}),/C29_SYNTHETIC_OBSERVATION_MUST_NOT_POSE_AS_ACTUAL_EVIDENCE/);
assert.throws(()=>createSimulationScenario({scenarioId:'BAD-GIT-HASH',scenarioType:SCENARIO_TYPE.MONTE_CARLO,caseId:CASE,propertyRef:PROP,candidateHeadSha:H('a'),governedInputHashSha256:hash('input'),synthetic:true}),/C29_CANDIDATE_HEAD_INVALID/);

console.log('C29_GOVERNED_SHADOW_SIMULATION_UAT_HARNESS=PASS');
