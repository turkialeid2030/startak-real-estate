'use strict';

const crypto = require('crypto');
const { runMonteCarlo, SIMULATION_STATUS, THRESHOLD_OPERATOR } = require('../scenario-risk');
const {
  MONTE_CARLO_GOVERNANCE_STATUS,
  verifyMonteCarloGovernancePlan,
  hashMonteCarloBaseInputs,
} = require('./monte-carlo-governance');

const THRESHOLD_KIND = Object.freeze({
  CAPITAL_PRESERVATION: 'CAPITAL_PRESERVATION',
  TARGET_HURDLE: 'TARGET_HURDLE',
  LOSS_LIMIT: 'LOSS_LIMIT',
  CUSTOM: 'CUSTOM',
});

const THRESHOLD_ANALYTICS_STATUS = Object.freeze({
  READY_FOR_ANALYSIS: 'READY_FOR_ANALYSIS',
  HOLD: 'HOLD',
});

const THRESHOLD_RESULT_STATUS = Object.freeze({
  EXECUTED: 'EXECUTED',
  HOLD: 'HOLD',
});

const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = canonicalize(value[key]);
    return acc;
  }, {});
}
function hashObject(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
function requiredString(value, field) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`); return value.trim(); }
function finite(value, field) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`); return value; }
function assertSha(value, field) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`); return value.toLowerCase(); }
function isoTime(value, field) { const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`); return parsed.toISOString(); }
function evidenceRefs(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('THRESHOLD_EVIDENCE_REFS_REQUIRED');
  const result = values.map((v) => requiredString(v, 'evidenceRef'));
  if (new Set(result).size !== result.length) throw new Error('DUPLICATE_THRESHOLD_EVIDENCE_REF');
  return result;
}

function createQualifiedDecisionThreshold(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const kind = requiredString(input.kind, 'kind');
  if (!Object.values(THRESHOLD_KIND).includes(kind)) throw new TypeError('kind is invalid');
  const operator = requiredString(input.operator, 'operator');
  if (!Object.values(THRESHOLD_OPERATOR).includes(operator)) throw new TypeError('operator is invalid');
  const reviewedAt = isoTime(input.reviewedAt, 'reviewedAt');
  const core = {
    schemaVersion: 1,
    thresholdId: requiredString(input.thresholdId, 'thresholdId'),
    kind,
    metricCode: requiredString(input.metricCode, 'metricCode'),
    metricUnit: requiredString(input.metricUnit, 'metricUnit'),
    operator,
    thresholdValue: finite(input.thresholdValue, 'thresholdValue'),
    rationale: requiredString(input.rationale, 'rationale'),
    policyRef: input.policyRef == null ? null : requiredString(input.policyRef, 'policyRef'),
    evidenceRefs: evidenceRefs(input.evidenceRefs),
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt,
    callerSuppliedThreshold: true,
    thresholdInventedBySystem: false,
  };
  return deepFreeze({ ...core, thresholdHashSha256: hashObject(core) });
}

function verifyQualifiedDecisionThreshold(threshold) {
  if (!threshold || typeof threshold !== 'object') return deepFreeze({ valid: false, reason: 'THRESHOLD_REQUIRED' });
  const { thresholdHashSha256, ...core } = threshold;
  try {
    const expected = assertSha(thresholdHashSha256, 'thresholdHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'THRESHOLD_HASH_INVALID' });
  }
}

function createThresholdAnalyticsPlan(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const monteCarloPlan = input.monteCarloPlan;
  const blockers = new Set();
  if (!verifyMonteCarloGovernancePlan(monteCarloPlan).valid) blockers.add('MONTE_CARLO_PLAN_INTEGRITY_FAILURE');
  if (monteCarloPlan?.governanceStatus !== MONTE_CARLO_GOVERNANCE_STATUS.READY_FOR_SIMULATION) blockers.add('MONTE_CARLO_PLAN_NOT_READY');
  const thresholds = Array.isArray(input.thresholds) ? input.thresholds : [];
  if (thresholds.length === 0) blockers.add('EXPLICIT_DECISION_THRESHOLDS_REQUIRED');
  const ids = new Set();
  const normalized = [];
  for (const threshold of thresholds) {
    if (!verifyQualifiedDecisionThreshold(threshold).valid) {
      blockers.add(`THRESHOLD_INTEGRITY_FAILURE:${threshold?.thresholdId || 'UNKNOWN'}`);
      continue;
    }
    if (ids.has(threshold.thresholdId)) blockers.add(`DUPLICATE_THRESHOLD_ID:${threshold.thresholdId}`);
    ids.add(threshold.thresholdId);
    if (threshold.metricCode !== monteCarloPlan?.metricCode) blockers.add(`THRESHOLD_METRIC_MISMATCH:${threshold.thresholdId}`);
    if (threshold.metricUnit !== monteCarloPlan?.metricUnit) blockers.add(`THRESHOLD_UNIT_MISMATCH:${threshold.thresholdId}`);
    normalized.push({ ...threshold });
  }
  const core = {
    schemaVersion: 1,
    thresholdAnalyticsPlanId: requiredString(input.thresholdAnalyticsPlanId, 'thresholdAnalyticsPlanId'),
    caseId: requiredString(input.caseId, 'caseId'),
    propertyRef: requiredString(input.propertyRef, 'propertyRef'),
    monteCarloPlanId: monteCarloPlan?.planId || null,
    monteCarloPlanHashSha256: monteCarloPlan?.planHashSha256 || null,
    metricCode: monteCarloPlan?.metricCode || null,
    metricUnit: monteCarloPlan?.metricUnit || null,
    thresholds: normalized,
    blockers: [...blockers].sort(),
    analyticsStatus: blockers.size === 0 ? THRESHOLD_ANALYTICS_STATUS.READY_FOR_ANALYSIS : THRESHOLD_ANALYTICS_STATUS.HOLD,
    decisionStateDerived: false,
    automaticInvestmentDecisionAuthorized: false,
    humanCommitteeDecisionRequired: true,
    professionalValuationConclusionModified: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    operatingMode: OPERATING_MODE,
    createdAt: isoTime(input.createdAt || Date.now(), 'createdAt'),
  };
  if (monteCarloPlan && (core.caseId !== monteCarloPlan.caseId || core.propertyRef !== monteCarloPlan.propertyRef)) {
    core.blockers = [...new Set([...core.blockers, 'MONTE_CARLO_PLAN_SCOPE_MISMATCH'])].sort();
    core.analyticsStatus = THRESHOLD_ANALYTICS_STATUS.HOLD;
  }
  return deepFreeze({ ...core, thresholdAnalyticsPlanHashSha256: hashObject(core) });
}

function verifyThresholdAnalyticsPlan(plan) {
  if (!plan || typeof plan !== 'object') return deepFreeze({ valid: false, reason: 'THRESHOLD_ANALYTICS_PLAN_REQUIRED' });
  const { thresholdAnalyticsPlanHashSha256, ...core } = plan;
  try {
    const expected = assertSha(thresholdAnalyticsPlanHashSha256, 'thresholdAnalyticsPlanHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'THRESHOLD_ANALYTICS_PLAN_HASH_INVALID' });
  }
}

function executeThresholdAnalytics(input) {
  const analyticsPlan = input?.thresholdAnalyticsPlan;
  const monteCarloPlan = input?.monteCarloPlan;
  if (!verifyThresholdAnalyticsPlan(analyticsPlan).valid) throw new Error('THRESHOLD_ANALYTICS_PLAN_INTEGRITY_FAILURE');
  if (!verifyMonteCarloGovernancePlan(monteCarloPlan).valid) throw new Error('MONTE_CARLO_PLAN_INTEGRITY_FAILURE');
  if (analyticsPlan.monteCarloPlanId !== monteCarloPlan.planId || analyticsPlan.monteCarloPlanHashSha256 !== monteCarloPlan.planHashSha256) {
    throw new Error('THRESHOLD_ANALYTICS_MONTE_CARLO_PLAN_BINDING_MISMATCH');
  }
  if (analyticsPlan.analyticsStatus !== THRESHOLD_ANALYTICS_STATUS.READY_FOR_ANALYSIS) {
    return deepFreeze({
      status: THRESHOLD_RESULT_STATUS.HOLD,
      thresholdAnalyticsPlanId: analyticsPlan.thresholdAnalyticsPlanId,
      thresholdAnalyticsPlanHashSha256: analyticsPlan.thresholdAnalyticsPlanHashSha256,
      blockers: [...analyticsPlan.blockers],
      automaticInvestmentDecisionAuthorized: false,
      transactionAuthorized: false,
    });
  }
  const baseInputs = input.baseInputs;
  if (hashMonteCarloBaseInputs(baseInputs) !== monteCarloPlan.baseInputHashSha256) throw new Error('THRESHOLD_ANALYTICS_BASE_INPUT_HASH_MISMATCH');
  if (typeof input.evaluator !== 'function' || typeof input.metricSelector !== 'function') throw new TypeError('evaluator and metricSelector must be functions');
  const raw = runMonteCarlo({
    baseInputs,
    distributions: monteCarloPlan.distributions.map((d) => ({ key: d.variableKey, type: d.type, min: d.min, mode: d.mode, max: d.max })),
    iterations: monteCarloPlan.iterations,
    seed: monteCarloPlan.seed,
    evaluator: input.evaluator,
    metricSelector: input.metricSelector,
    thresholds: analyticsPlan.thresholds.map((t) => ({ thresholdId: t.thresholdId, operator: t.operator, threshold: t.thresholdValue })),
  });
  if (raw.status !== SIMULATION_STATUS.QUALIFIED) throw new Error(`THRESHOLD_ANALYTICS_ENGINE_NOT_QUALIFIED:${raw.status}`);
  const byId = new Map(analyticsPlan.thresholds.map((t) => [t.thresholdId, t]));
  const thresholdResults = (raw.thresholdProbabilities || []).map((row) => {
    const threshold = byId.get(row.thresholdId);
    return {
      thresholdId: row.thresholdId,
      kind: threshold.kind,
      metricCode: threshold.metricCode,
      metricUnit: threshold.metricUnit,
      operator: row.operator,
      thresholdValue: row.threshold,
      probabilityConditionMet: row.probabilityConditionMet,
      probabilityConditionNotMet: 1 - row.probabilityConditionMet,
      policyRef: threshold.policyRef,
      thresholdHashSha256: threshold.thresholdHashSha256,
    };
  });
  const core = {
    schemaVersion: 1,
    status: THRESHOLD_RESULT_STATUS.EXECUTED,
    thresholdAnalyticsPlanId: analyticsPlan.thresholdAnalyticsPlanId,
    thresholdAnalyticsPlanHashSha256: analyticsPlan.thresholdAnalyticsPlanHashSha256,
    monteCarloPlanId: monteCarloPlan.planId,
    monteCarloPlanHashSha256: monteCarloPlan.planHashSha256,
    caseId: monteCarloPlan.caseId,
    propertyRef: monteCarloPlan.propertyRef,
    metricCode: monteCarloPlan.metricCode,
    metricUnit: monteCarloPlan.metricUnit,
    mean: raw.mean,
    p05: raw.p05,
    p50: raw.p50,
    p95: raw.p95,
    min: raw.min,
    max: raw.max,
    tailRangeP05P95: raw.p95 - raw.p05,
    probabilityBelowZero: raw.probabilityBelowZero,
    thresholdResults,
    semantics: 'Threshold probabilities are conditional analytical frequencies under caller-supplied reviewed hurdles and governed simulation assumptions. They do not constitute an approval, rejection, forecast, guarantee, or professional valuation conclusion.',
    decisionStateDerived: false,
    automaticInvestmentDecisionAuthorized: false,
    humanCommitteeDecisionRequired: true,
    professionalValuationConclusionModified: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    operatingMode: OPERATING_MODE,
    executedAt: isoTime(input.executedAt || Date.now(), 'executedAt'),
  };
  return deepFreeze({ ...core, thresholdAnalyticsResultHashSha256: hashObject(core) });
}

function verifyThresholdAnalyticsResult(result) {
  if (!result || typeof result !== 'object' || result.status !== THRESHOLD_RESULT_STATUS.EXECUTED) return deepFreeze({ valid: false, reason: 'EXECUTED_THRESHOLD_RESULT_REQUIRED' });
  const { thresholdAnalyticsResultHashSha256, ...core } = result;
  try {
    const expected = assertSha(thresholdAnalyticsResultHashSha256, 'thresholdAnalyticsResultHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'THRESHOLD_ANALYTICS_RESULT_HASH_INVALID' });
  }
}

module.exports = {
  THRESHOLD_KIND,
  THRESHOLD_ANALYTICS_STATUS,
  THRESHOLD_RESULT_STATUS,
  THRESHOLD_OPERATOR,
  createQualifiedDecisionThreshold,
  verifyQualifiedDecisionThreshold,
  createThresholdAnalyticsPlan,
  verifyThresholdAnalyticsPlan,
  executeThresholdAnalytics,
  verifyThresholdAnalyticsResult,
};
