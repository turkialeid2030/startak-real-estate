'use strict';

const crypto = require('crypto');

const SCENARIO_TYPE = Object.freeze({
  SYNTHETIC_END_TO_END: 'SYNTHETIC_END_TO_END',
  HISTORICAL_REPLAY: 'HISTORICAL_REPLAY',
  SOURCE_DEGRADATION: 'SOURCE_DEGRADATION',
  POLICY_SHOCK: 'POLICY_SHOCK',
  MONTE_CARLO: 'MONTE_CARLO',
  AI_HOSTILE_INPUT: 'AI_HOSTILE_INPUT',
  SIDE_EFFECT_DRY_RUN: 'SIDE_EFFECT_DRY_RUN',
  UAT_PROFESSIONAL_REVIEW: 'UAT_PROFESSIONAL_REVIEW',
});
const OBSERVATION_STATUS = Object.freeze({
  COMPLETED_SYNTHETIC: 'COMPLETED_SYNTHETIC',
  EVIDENCE_CAPTURED_ACTUAL: 'EVIDENCE_CAPTURED_ACTUAL',
  NOT_EVALUATED: 'NOT_EVALUATED',
});
const CAMPAIGN_STATUS = Object.freeze({
  TECHNICALLY_COMPLETE: 'TECHNICALLY_COMPLETE',
  TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN: 'TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_TEMPORAL: 'HOLD_TEMPORAL',
});
const EXTERNAL_TYPES = new Set([SCENARIO_TYPE.HISTORICAL_REPLAY, SCENARIO_TYPE.UAT_PROFESSIONAL_REVIEW]);
const TECHNICAL_TYPES = Object.freeze(Object.values(SCENARIO_TYPE).filter((t) => !EXTERNAL_TYPES.has(t)));
const SHA256_RE = /^[a-f0-9]{64}$/;
const GIT_SHA_RE = /^[a-f0-9]{40}$/;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  return value;
}
function stableJson(value) { return JSON.stringify(canonicalize(value)); }
function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex'); }
function requireText(value, code) { if (typeof value !== 'string' || value.trim() === '') throw new Error(code); return value; }
function requireSha256(value, code) { if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(code); return value; }
function requireGitSha(value, code) { if (typeof value !== 'string' || !GIT_SHA_RE.test(value)) throw new Error(code); return value; }
function requireIso(value, code) { requireText(value, code); if (Number.isNaN(Date.parse(value))) throw new Error(code); return value; }
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
function sideEffectsFalse(input) {
  return ['transactionExecuted','bidSubmitted','paymentInitiated','filingSubmitted','termsAccepted','productionDeploymentExecuted','autonomousActionExecuted'].every(k=>!Object.hasOwn(input,k)||input[k]===false);
}

function scenarioMaterial(input) {
  return {
    scenarioId: input.scenarioId, scenarioType: input.scenarioType, caseId: input.caseId, propertyRef: input.propertyRef,
    candidateHeadSha: input.candidateHeadSha, governedInputHashSha256: input.governedInputHashSha256,
    simulationOnly: true, synthetic: input.synthetic,
    transactionExecuted: false, bidSubmitted: false, paymentInitiated: false, filingSubmitted: false,
    termsAccepted: false, productionDeploymentExecuted: false, autonomousActionExecuted: false,
  };
}
function createSimulationScenario(input) {
  if (!input || typeof input !== 'object') throw new Error('C29_SCENARIO_REQUIRED');
  if (!Object.values(SCENARIO_TYPE).includes(input.scenarioType)) throw new Error('C29_SCENARIO_TYPE_UNKNOWN');
  if (!sideEffectsFalse(input)) throw new Error('C29_REAL_SIDE_EFFECT_FORBIDDEN');
  const external = EXTERNAL_TYPES.has(input.scenarioType);
  if (external && input.synthetic !== false) throw new Error('C29_EXTERNAL_EVIDENCE_SCENARIO_CANNOT_BE_SYNTHETIC');
  const material = scenarioMaterial({
    scenarioId: requireText(input.scenarioId, 'C29_SCENARIO_ID_REQUIRED'), scenarioType: input.scenarioType,
    caseId: requireText(input.caseId, 'C29_CASE_ID_REQUIRED'), propertyRef: requireText(input.propertyRef, 'C29_PROPERTY_REF_REQUIRED'),
    candidateHeadSha: requireGitSha(input.candidateHeadSha, 'C29_CANDIDATE_HEAD_INVALID'),
    governedInputHashSha256: requireSha256(input.governedInputHashSha256, 'C29_GOVERNED_INPUT_HASH_INVALID'),
    synthetic: external ? false : input.synthetic === true,
  });
  if (!external && material.synthetic !== true) throw new Error('C29_TECHNICAL_SIMULATION_MUST_BE_LABELED_SYNTHETIC');
  return Object.freeze({ ...material, scenarioHashSha256: sha256(material) });
}

function observationMaterial(input) {
  return {
    observationId: input.observationId, scenarioId: input.scenarioId, scenarioHashSha256: input.scenarioHashSha256,
    status: input.status, outputHashSha256: input.outputHashSha256 || null, evidenceRef: input.evidenceRef || null,
    evidenceHashSha256: input.evidenceHashSha256 || null, observedAt: input.observedAt || null, reasonCode: input.reasonCode || null,
    evidenceKind: input.evidenceKind || null, productionPerformanceClaimed: false,
    transactionExecuted: false, bidSubmitted: false, paymentInitiated: false, filingSubmitted: false,
    termsAccepted: false, productionDeploymentExecuted: false, autonomousActionExecuted: false,
  };
}
function createSimulationObservation(input) {
  if (!input || typeof input !== 'object') throw new Error('C29_OBSERVATION_REQUIRED');
  if (!Object.values(OBSERVATION_STATUS).includes(input.status)) throw new Error('C29_OBSERVATION_STATUS_UNKNOWN');
  if (!sideEffectsFalse(input)) throw new Error('C29_REAL_SIDE_EFFECT_FORBIDDEN');
  if(Object.hasOwn(input,'productionPerformanceClaimed')&&input.productionPerformanceClaimed!==false)throw new Error('C29_PRODUCTION_CLAIM_FORBIDDEN');
  for(const key of ['outputHashSha256','evidenceRef','evidenceHashSha256','observedAt','reasonCode','evidenceKind'])if(input[key]!=null&&(typeof input[key]!=='string'||!input[key].trim()))throw new Error('C29_OBSERVATION_FIELD_INVALID:'+key);
  const material = observationMaterial({
    observationId: requireText(input.observationId, 'C29_OBSERVATION_ID_REQUIRED'), scenarioId: requireText(input.scenarioId, 'C29_OBSERVATION_SCENARIO_ID_REQUIRED'),
    scenarioHashSha256: requireSha256(input.scenarioHashSha256, 'C29_SCENARIO_HASH_INVALID'), status: input.status,
    outputHashSha256: input.outputHashSha256 || null, evidenceRef: input.evidenceRef || null, evidenceHashSha256: input.evidenceHashSha256 || null,
    observedAt: input.observedAt || null, reasonCode: input.reasonCode || null, evidenceKind: input.evidenceKind || null,
  });
  if (material.status === OBSERVATION_STATUS.NOT_EVALUATED) {
    requireText(material.reasonCode, 'C29_NOT_EVALUATED_REASON_REQUIRED');
    if (material.outputHashSha256 || material.evidenceRef || material.evidenceHashSha256 || material.observedAt || material.evidenceKind) throw new Error('C29_NOT_EVALUATED_MUST_NOT_FABRICATE_EVIDENCE');
  } else {
    if(material.reasonCode!==null)throw new Error('C29_COMPLETED_OBSERVATION_REASON_CONFLICT');
    requireSha256(material.outputHashSha256, 'C29_OUTPUT_HASH_INVALID');
    requireIso(material.observedAt, 'C29_OBSERVED_AT_INVALID');
    if (material.status === OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL) {
      requireText(material.evidenceRef, 'C29_ACTUAL_EVIDENCE_REF_REQUIRED'); requireSha256(material.evidenceHashSha256, 'C29_ACTUAL_EVIDENCE_HASH_INVALID'); requireText(material.evidenceKind, 'C29_ACTUAL_EVIDENCE_KIND_REQUIRED');
    } else if (material.evidenceRef || material.evidenceHashSha256 || material.evidenceKind) throw new Error('C29_SYNTHETIC_OBSERVATION_MUST_NOT_POSE_AS_ACTUAL_EVIDENCE');
  }
  return Object.freeze({ ...material, observationHashSha256: sha256(material) });
}
function verifyScenario(s) {try{return !!s&&stableJson(s)===stableJson(createSimulationScenario(s));}catch{return false;}}
function verifyObservation(o) {try{return !!o&&stableJson(o)===stableJson(createSimulationObservation(o));}catch{return false;}}

function evaluateShadowCampaign({ campaignId, candidateHeadSha, caseId, propertyRef, scenarios, observations, evaluatedAt }) {
  requireText(campaignId, 'C29_CAMPAIGN_ID_REQUIRED'); requireGitSha(candidateHeadSha, 'C29_CANDIDATE_HEAD_INVALID');
  requireText(caseId, 'C29_CASE_ID_REQUIRED'); requireText(propertyRef, 'C29_PROPERTY_REF_REQUIRED'); requireIso(evaluatedAt, 'C29_EVALUATED_AT_INVALID');
  if (!Array.isArray(scenarios) || !Array.isArray(observations)) throw new Error('C29_SCENARIOS_OBSERVATIONS_REQUIRED');
  if(Date.parse(evaluatedAt)>Date.now())throw new Error('C29_CAMPAIGN_FUTURE_EVALUATION');
  const blockers = [], scenarioById = new Map(), typeSeen = new Set();
  for (const scenario of scenarios) {
    if (!verifyScenario(scenario)) { blockers.push('C29_INTEGRITY_SCENARIO_TAMPERED'); continue; }
    if (scenarioById.has(scenario.scenarioId)) blockers.push(`C29_DUPLICATE_SCENARIO_ID:${scenario.scenarioId}`);
    scenarioById.set(scenario.scenarioId, scenario);
    if (typeSeen.has(scenario.scenarioType)) blockers.push(`C29_DUPLICATE_SCENARIO_TYPE:${scenario.scenarioType}`); typeSeen.add(scenario.scenarioType);
    if (scenario.candidateHeadSha !== candidateHeadSha) blockers.push(`C29_HEAD_MISMATCH:${scenario.scenarioId}`);
    if (scenario.caseId !== caseId || scenario.propertyRef !== propertyRef) blockers.push(`C29_CONTEXT_SCENARIO_MISMATCH:${scenario.scenarioId}`);
  }
  for (const type of Object.values(SCENARIO_TYPE)) if (!typeSeen.has(type)) blockers.push(`C29_MISSING_SCENARIO_TYPE:${type}`);
  const observationByScenario = new Map(), observationIds=new Set();
  for (const observation of observations) {
    if (!verifyObservation(observation)) { blockers.push('C29_INTEGRITY_OBSERVATION_TAMPERED'); continue; }
    if(observationIds.has(observation.observationId))blockers.push('C29_DUPLICATE_OBSERVATION_ID');
    observationIds.add(observation.observationId);
    if (observationByScenario.has(observation.scenarioId)) blockers.push(`C29_DUPLICATE_OBSERVATION:${observation.scenarioId}`); observationByScenario.set(observation.scenarioId, observation);
    const scenario = scenarioById.get(observation.scenarioId);
    if (!scenario || scenario.scenarioHashSha256 !== observation.scenarioHashSha256) blockers.push(`C29_CONTEXT_OBSERVATION_BINDING:${observation.scenarioId}`);
    if (observation.observedAt && Date.parse(observation.observedAt) > Date.parse(evaluatedAt)) blockers.push(`C29_FUTURE_OBSERVATION:${observation.scenarioId}`);
    if (scenario && EXTERNAL_TYPES.has(scenario.scenarioType) && observation.status === OBSERVATION_STATUS.COMPLETED_SYNTHETIC) blockers.push(`C29_EXTERNAL_SCENARIO_SYNTHETIC_RESULT:${scenario.scenarioType}`);
    if (scenario && !EXTERNAL_TYPES.has(scenario.scenarioType) && observation.status === OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL) blockers.push(`C29_TECHNICAL_SCENARIO_MISLABELED_ACTUAL:${scenario.scenarioType}`);
    if(scenario&&EXTERNAL_TYPES.has(scenario.scenarioType)&&observation.status===OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL){
      const expectedKind=scenario.scenarioType===SCENARIO_TYPE.HISTORICAL_REPLAY?'HISTORICAL_REPLAY_INPUT_AND_RESULT_EVIDENCE':'UAT_PROFESSIONAL_REVIEW_EVIDENCE';
      if(observation.evidenceKind!==expectedKind)blockers.push('C29_CONTEXT_EXTERNAL_EVIDENCE_KIND:'+scenario.scenarioType);
    }
  }
  for (const scenario of scenarioById.values()) if (!observationByScenario.has(scenario.scenarioId)) blockers.push(`C29_MISSING_OBSERVATION:${scenario.scenarioId}`);
  let status;
  if (blockers.some((b) => b.startsWith('C29_INTEGRITY') || b.startsWith('C29_DUPLICATE') || b.startsWith('C29_HEAD_MISMATCH'))) status = CAMPAIGN_STATUS.HOLD_INTEGRITY;
  else if (blockers.some((b) => b.startsWith('C29_CONTEXT') || b.includes('MISLABELED') || b.includes('SYNTHETIC_RESULT'))) status = CAMPAIGN_STATUS.HOLD_CONTEXT;
  else if (blockers.some((b) => b.startsWith('C29_FUTURE'))) status = CAMPAIGN_STATUS.HOLD_TEMPORAL;
  else if (blockers.some((b) => b.startsWith('C29_MISSING_SCENARIO') || b.startsWith('C29_MISSING_OBSERVATION'))) status = CAMPAIGN_STATUS.HOLD_EVIDENCE;
  else {
    const technicalOpen = scenarios.some((s) => TECHNICAL_TYPES.includes(s.scenarioType) && observationByScenario.get(s.scenarioId).status === OBSERVATION_STATUS.NOT_EVALUATED);
    if (technicalOpen) status = CAMPAIGN_STATUS.HOLD_EVIDENCE;
    else status = scenarios.some((s) => EXTERNAL_TYPES.has(s.scenarioType) && observationByScenario.get(s.scenarioId).status === OBSERVATION_STATUS.NOT_EVALUATED) ? CAMPAIGN_STATUS.TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN : CAMPAIGN_STATUS.TECHNICALLY_COMPLETE;
  }
  // A campaign with any unresolved integrity, scope, timing or completeness
  // blocker cannot close external evidence. Captured evidence is not approval.
  const campaignQualified=[CAMPAIGN_STATUS.TECHNICALLY_COMPLETE,CAMPAIGN_STATUS.TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN].includes(status);
  const externalOpenTypes=[...EXTERNAL_TYPES].filter(type=>!campaignQualified||![...scenarioById.values()].some(s=>{
    const o=observationByScenario.get(s.scenarioId);
    return s.scenarioType===type&&s.candidateHeadSha===candidateHeadSha&&s.caseId===caseId&&s.propertyRef===propertyRef&&o?.status===OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL&&o.scenarioHashSha256===s.scenarioHashSha256&&Date.parse(o.observedAt)<=Date.parse(evaluatedAt)&&o.evidenceKind===(type===SCENARIO_TYPE.HISTORICAL_REPLAY?'HISTORICAL_REPLAY_INPUT_AND_RESULT_EVIDENCE':'UAT_PROFESSIONAL_REVIEW_EVIDENCE');
  })).sort();
  const material = { campaignId, candidateHeadSha, caseId, propertyRef, evaluatedAt, status, blockers: [...new Set(blockers)].sort(), externalOpenTypes, scenarioHashesSha256: scenarios.filter(verifyScenario).map(s=>s.scenarioHashSha256).sort(), observationHashesSha256: observations.filter(verifyObservation).map(o=>o.observationHashSha256).sort() };
  const resultCore={ ...material,
    technicalSimulationComplete: status === CAMPAIGN_STATUS.TECHNICALLY_COMPLETE || status === CAMPAIGN_STATUS.TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN,
    historicalPerformanceEstablished: false, uatApproved: false, productionPerformanceClaimed: false,
    transactionAuthorized: false, approvalAuthorized: false, publicAiAuthorized: false, productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD', canonicalBaselineActivationAuthorized: false, realSideEffectsExecuted: false,
  };
  return deepFreeze({...resultCore,campaignHashSha256:sha256(resultCore)});
}

module.exports = { SCENARIO_TYPE, OBSERVATION_STATUS, CAMPAIGN_STATUS, createSimulationScenario, createSimulationObservation, evaluateShadowCampaign };
