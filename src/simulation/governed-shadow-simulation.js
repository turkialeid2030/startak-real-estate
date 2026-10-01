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
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  return value;
}
function stableJson(value) { return JSON.stringify(canonicalize(value)); }
function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex'); }
function requireText(value, code) { if (typeof value !== 'string' || value.trim() === '') throw new Error(code); return value; }
function requireSha256(value, code) { if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(code); return value; }
function requireGitSha(value, code) { if (typeof value !== 'string' || !GIT_SHA_RE.test(value)) throw new Error(code); return value; }
function requireIso(value, code) { requireText(value, code); if (Number.isNaN(Date.parse(value))) throw new Error(code); return value; }
function sideEffectsFalse(input) {
  return input.transactionExecuted !== true && input.bidSubmitted !== true && input.paymentInitiated !== true &&
    input.filingSubmitted !== true && input.termsAccepted !== true && input.productionDeploymentExecuted !== true && input.autonomousActionExecuted !== true;
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
  if (external && input.synthetic === true) throw new Error('C29_EXTERNAL_EVIDENCE_SCENARIO_CANNOT_BE_SYNTHETIC');
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
    requireSha256(material.outputHashSha256, 'C29_OUTPUT_HASH_INVALID');
    requireIso(material.observedAt, 'C29_OBSERVED_AT_INVALID');
    if (material.status === OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL) {
      requireText(material.evidenceRef, 'C29_ACTUAL_EVIDENCE_REF_REQUIRED'); requireSha256(material.evidenceHashSha256, 'C29_ACTUAL_EVIDENCE_HASH_INVALID'); requireText(material.evidenceKind, 'C29_ACTUAL_EVIDENCE_KIND_REQUIRED');
    } else if (material.evidenceRef || material.evidenceHashSha256 || material.evidenceKind) throw new Error('C29_SYNTHETIC_OBSERVATION_MUST_NOT_POSE_AS_ACTUAL_EVIDENCE');
  }
  return Object.freeze({ ...material, observationHashSha256: sha256(material) });
}
function verifyScenario(s) { return !!s && SHA256_RE.test(s.scenarioHashSha256 || '') && sha256(scenarioMaterial(s)) === s.scenarioHashSha256; }
function verifyObservation(o) { return !!o && SHA256_RE.test(o.observationHashSha256 || '') && sha256(observationMaterial(o)) === o.observationHashSha256; }

function evaluateShadowCampaign({ campaignId, candidateHeadSha, caseId, propertyRef, scenarios, observations, evaluatedAt }) {
  requireText(campaignId, 'C29_CAMPAIGN_ID_REQUIRED'); requireGitSha(candidateHeadSha, 'C29_CANDIDATE_HEAD_INVALID');
  requireText(caseId, 'C29_CASE_ID_REQUIRED'); requireText(propertyRef, 'C29_PROPERTY_REF_REQUIRED'); requireIso(evaluatedAt, 'C29_EVALUATED_AT_INVALID');
  if (!Array.isArray(scenarios) || !Array.isArray(observations)) throw new Error('C29_SCENARIOS_OBSERVATIONS_REQUIRED');
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
  const observationByScenario = new Map();
  for (const observation of observations) {
    if (!verifyObservation(observation)) { blockers.push('C29_INTEGRITY_OBSERVATION_TAMPERED'); continue; }
    if (observationByScenario.has(observation.scenarioId)) blockers.push(`C29_DUPLICATE_OBSERVATION:${observation.scenarioId}`); observationByScenario.set(observation.scenarioId, observation);
    const scenario = scenarioById.get(observation.scenarioId);
    if (!scenario || scenario.scenarioHashSha256 !== observation.scenarioHashSha256) blockers.push(`C29_CONTEXT_OBSERVATION_BINDING:${observation.scenarioId}`);
    if (observation.observedAt && Date.parse(observation.observedAt) > Date.parse(evaluatedAt)) blockers.push(`C29_FUTURE_OBSERVATION:${observation.scenarioId}`);
    if (scenario && EXTERNAL_TYPES.has(scenario.scenarioType) && observation.status === OBSERVATION_STATUS.COMPLETED_SYNTHETIC) blockers.push(`C29_EXTERNAL_SCENARIO_SYNTHETIC_RESULT:${scenario.scenarioType}`);
    if (scenario && !EXTERNAL_TYPES.has(scenario.scenarioType) && observation.status === OBSERVATION_STATUS.EVIDENCE_CAPTURED_ACTUAL) blockers.push(`C29_TECHNICAL_SCENARIO_MISLABELED_ACTUAL:${scenario.scenarioType}`);
  }
  for (const scenario of scenarios) if (!observationByScenario.has(scenario.scenarioId)) blockers.push(`C29_MISSING_OBSERVATION:${scenario.scenarioId}`);
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
  const externalOpenTypes = scenarios.filter((s) => EXTERNAL_TYPES.has(s.scenarioType) && observationByScenario.get(s.scenarioId)?.status === OBSERVATION_STATUS.NOT_EVALUATED).map((s) => s.scenarioType).sort();
  const material = { campaignId, candidateHeadSha, caseId, propertyRef, evaluatedAt, status, blockers: [...new Set(blockers)].sort(), externalOpenTypes, scenarioHashesSha256: scenarios.map((s) => s.scenarioHashSha256).filter(Boolean).sort(), observationHashesSha256: observations.map((o) => o.observationHashSha256).filter(Boolean).sort() };
  return Object.freeze({ ...material,
    technicalSimulationComplete: status === CAMPAIGN_STATUS.TECHNICALLY_COMPLETE || status === CAMPAIGN_STATUS.TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN,
    historicalPerformanceEstablished: false, uatApproved: false, productionPerformanceClaimed: false,
    transactionAuthorized: false, approvalAuthorized: false, publicAiAuthorized: false, productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD', canonicalBaselineActivationAuthorized: false, realSideEffectsExecuted: false,
    campaignHashSha256: sha256(material),
  });
}

module.exports = { SCENARIO_TYPE, OBSERVATION_STATUS, CAMPAIGN_STATUS, createSimulationScenario, createSimulationObservation, evaluateShadowCampaign };
