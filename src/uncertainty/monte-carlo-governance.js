'use strict';

const crypto = require('crypto');
const { runMonteCarlo, SIMULATION_STATUS } = require('../scenario-risk');

const DISTRIBUTION_TYPE = Object.freeze({ TRIANGULAR: 'TRIANGULAR' });
const DISTRIBUTION_CONFIDENCE = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });
const MONTE_CARLO_GOVERNANCE_STATUS = Object.freeze({
  READY_FOR_SIMULATION: 'READY_FOR_SIMULATION',
  HOLD: 'HOLD',
});
const GOVERNED_SIMULATION_STATUS = Object.freeze({
  EXECUTED: 'EXECUTED',
  HOLD: 'HOLD',
});
const CORRELATION_POLICY = Object.freeze({ INDEPENDENT_ONLY_V1: 'INDEPENDENT_ONLY_V1' });
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
function realIsoDate(value, field) {
  requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`${field} must be a real ISO date`);
  return value;
}
function isoTime(value, field) { const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`); return parsed.toISOString(); }
function stringArray(values, field, { required = false } = {}) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const result = values.map((v) => requiredString(v, field));
  if (required && result.length === 0) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  if (new Set(result).size !== result.length) throw new Error(`DUPLICATE_${field.toUpperCase()}`);
  return result;
}
function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.floor((to - from) / 86400000);
}

function hashMonteCarloBaseInputs(baseInputs) {
  if (!baseInputs || typeof baseInputs !== 'object' || Array.isArray(baseInputs)) throw new TypeError('baseInputs must be an object');
  for (const [key, value] of Object.entries(baseInputs)) finite(value, `baseInputs.${key}`);
  return hashObject(baseInputs);
}

function createQualifiedDistribution(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const type = requiredString(input.type, 'type');
  if (type !== DISTRIBUTION_TYPE.TRIANGULAR) throw new Error('ONLY_TRIANGULAR_DISTRIBUTIONS_SUPPORTED_V1');
  const min = finite(input.min, 'min');
  const mode = finite(input.mode, 'mode');
  const max = finite(input.max, 'max');
  if (!(min <= mode && mode <= max) || min === max) throw new RangeError('triangular distribution requires min <= mode <= max and min < max');
  const confidence = requiredString(input.confidence, 'confidence');
  if (!Object.values(DISTRIBUTION_CONFIDENCE).includes(confidence)) throw new TypeError('confidence is invalid');
  const asOfDate = realIsoDate(input.asOfDate, 'asOfDate');
  const reviewedAt = isoTime(input.reviewedAt, 'reviewedAt');
  if (reviewedAt.slice(0, 10) < asOfDate) throw new Error('DISTRIBUTION_REVIEW_BEFORE_AS_OF_DATE');
  const sourceRefs = stringArray(input.sourceRefs || [], 'sourceRefs', { required: true });
  const core = {
    schemaVersion: 1,
    distributionId: requiredString(input.distributionId, 'distributionId'),
    variableKey: requiredString(input.variableKey, 'variableKey'),
    type,
    min,
    mode,
    max,
    unit: requiredString(input.unit, 'unit'),
    asOfDate,
    rationale: requiredString(input.rationale, 'rationale'),
    sourceRefs,
    confidence,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt,
    independenceAssumptionAcknowledged: input.independenceAssumptionAcknowledged === true,
    correlationModelApplied: false,
  };
  return deepFreeze({ ...core, distributionHashSha256: hashObject(core) });
}

function verifyQualifiedDistribution(distribution) {
  if (!distribution || typeof distribution !== 'object') return deepFreeze({ valid: false, reason: 'DISTRIBUTION_REQUIRED' });
  const { distributionHashSha256, ...core } = distribution;
  try {
    const expected = assertSha(distributionHashSha256, 'distributionHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'DISTRIBUTION_HASH_INVALID' });
  }
}

function createMonteCarloGovernancePlan(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const blockers = new Set();
  const analysisDate = realIsoDate(input.analysisDate, 'analysisDate');
  const distributions = Array.isArray(input.distributions) ? input.distributions : [];
  if (distributions.length === 0) blockers.add('QUALIFIED_DISTRIBUTIONS_REQUIRED');
  const distributionIds = new Set();
  const variableKeys = new Set();
  const normalized = [];
  const maximumAgeDaysByVariable = input.maximumAgeDaysByVariable && typeof input.maximumAgeDaysByVariable === 'object'
    ? { ...input.maximumAgeDaysByVariable } : {};
  for (const distribution of distributions) {
    if (!verifyQualifiedDistribution(distribution).valid) {
      blockers.add(`DISTRIBUTION_INTEGRITY_FAILURE:${distribution?.distributionId || 'UNKNOWN'}`);
      continue;
    }
    if (distributionIds.has(distribution.distributionId)) blockers.add(`DUPLICATE_DISTRIBUTION_ID:${distribution.distributionId}`);
    distributionIds.add(distribution.distributionId);
    if (variableKeys.has(distribution.variableKey)) blockers.add(`DUPLICATE_DISTRIBUTION_VARIABLE:${distribution.variableKey}`);
    variableKeys.add(distribution.variableKey);
    if (distribution.asOfDate > analysisDate) blockers.add(`DISTRIBUTION_AS_OF_DATE_IN_FUTURE:${distribution.variableKey}`);
    const maxAge = maximumAgeDaysByVariable[distribution.variableKey];
    if (!Number.isInteger(maxAge) || maxAge < 0) blockers.add(`DISTRIBUTION_MAX_AGE_POLICY_REQUIRED:${distribution.variableKey}`);
    else if (daysBetween(distribution.asOfDate, analysisDate) > maxAge) blockers.add(`DISTRIBUTION_STALE:${distribution.variableKey}`);
    if (distribution.independenceAssumptionAcknowledged !== true) blockers.add(`INDEPENDENCE_ASSUMPTION_ACKNOWLEDGEMENT_REQUIRED:${distribution.variableKey}`);
    normalized.push({ ...distribution });
  }
  const correlationPolicy = requiredString(input.correlationPolicy || CORRELATION_POLICY.INDEPENDENT_ONLY_V1, 'correlationPolicy');
  if (correlationPolicy !== CORRELATION_POLICY.INDEPENDENT_ONLY_V1) blockers.add('CORRELATION_POLICY_UNSUPPORTED_V1');
  const correlationAssumptions = Array.isArray(input.correlationAssumptions) ? input.correlationAssumptions : [];
  if (correlationAssumptions.length > 0) blockers.add('CORRELATION_MODEL_UNSUPPORTED_BY_V1_ENGINE');
  if (!Number.isInteger(input.iterations) || input.iterations < 100 || input.iterations > 100000) throw new RangeError('iterations must be integer between 100 and 100000');
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer');
  const core = {
    schemaVersion: 1,
    planId: requiredString(input.planId, 'planId'),
    caseId: requiredString(input.caseId, 'caseId'),
    propertyRef: requiredString(input.propertyRef, 'propertyRef'),
    analysisDate,
    baseInputHashSha256: assertSha(input.baseInputHashSha256, 'baseInputHashSha256'),
    evaluatorRef: requiredString(input.evaluatorRef, 'evaluatorRef'),
    evaluatorVersion: requiredString(input.evaluatorVersion, 'evaluatorVersion'),
    metricCode: requiredString(input.metricCode, 'metricCode'),
    metricUnit: requiredString(input.metricUnit, 'metricUnit'),
    iterations: input.iterations,
    seed: input.seed,
    distributions: normalized,
    maximumAgeDaysByVariable,
    correlationPolicy,
    correlationAssumptions,
    blockers: [...blockers].sort(),
    governanceStatus: blockers.size === 0 ? MONTE_CARLO_GOVERNANCE_STATUS.READY_FOR_SIMULATION : MONTE_CARLO_GOVERNANCE_STATUS.HOLD,
    operatingMode: OPERATING_MODE,
    professionalValuationConclusionModified: false,
    automaticInvestmentDecisionAuthorized: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    createdAt: isoTime(input.createdAt || Date.now(), 'createdAt'),
  };
  return deepFreeze({ ...core, planHashSha256: hashObject(core) });
}

function verifyMonteCarloGovernancePlan(plan) {
  if (!plan || typeof plan !== 'object') return deepFreeze({ valid: false, reason: 'PLAN_REQUIRED' });
  const { planHashSha256, ...core } = plan;
  try {
    const expected = assertSha(planHashSha256, 'planHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'PLAN_HASH_INVALID' });
  }
}

function executeGovernedMonteCarlo(input) {
  const plan = input?.plan;
  if (!verifyMonteCarloGovernancePlan(plan).valid) throw new Error('MONTE_CARLO_PLAN_INTEGRITY_FAILURE');
  if (plan.governanceStatus !== MONTE_CARLO_GOVERNANCE_STATUS.READY_FOR_SIMULATION) {
    return deepFreeze({
      status: GOVERNED_SIMULATION_STATUS.HOLD,
      planId: plan.planId,
      planHashSha256: plan.planHashSha256,
      blockers: [...plan.blockers],
      automaticInvestmentDecisionAuthorized: false,
      transactionAuthorized: false,
    });
  }
  const baseInputs = input.baseInputs;
  const actualBaseHash = hashMonteCarloBaseInputs(baseInputs);
  if (actualBaseHash !== plan.baseInputHashSha256) throw new Error('MONTE_CARLO_BASE_INPUT_HASH_MISMATCH');
  for (const distribution of plan.distributions) {
    if (!Object.prototype.hasOwnProperty.call(baseInputs, distribution.variableKey)) throw new Error(`MONTE_CARLO_UNKNOWN_INPUT:${distribution.variableKey}`);
  }
  if (typeof input.evaluator !== 'function' || typeof input.metricSelector !== 'function') throw new TypeError('evaluator and metricSelector must be functions');
  const raw = runMonteCarlo({
    baseInputs,
    distributions: plan.distributions.map((d) => ({ key: d.variableKey, type: d.type, min: d.min, mode: d.mode, max: d.max })),
    iterations: plan.iterations,
    seed: plan.seed,
    evaluator: input.evaluator,
    metricSelector: input.metricSelector,
  });
  if (raw.status !== SIMULATION_STATUS.QUALIFIED) throw new Error(`MONTE_CARLO_ENGINE_NOT_QUALIFIED:${raw.status}`);
  const core = {
    schemaVersion: 1,
    status: GOVERNED_SIMULATION_STATUS.EXECUTED,
    planId: plan.planId,
    planHashSha256: plan.planHashSha256,
    caseId: plan.caseId,
    propertyRef: plan.propertyRef,
    analysisDate: plan.analysisDate,
    evaluatorRef: plan.evaluatorRef,
    evaluatorVersion: plan.evaluatorVersion,
    metricCode: plan.metricCode,
    metricUnit: plan.metricUnit,
    iterations: raw.iterations,
    seed: raw.seed,
    mean: raw.mean,
    p05: raw.p05,
    p50: raw.p50,
    p95: raw.p95,
    min: raw.min,
    max: raw.max,
    probabilityBelowZero: raw.probabilityBelowZero,
    correlationPolicy: plan.correlationPolicy,
    correlationModelApplied: false,
    semantics: 'Conditional simulation based on reviewed input distributions and a deterministic evaluator. It is not a prediction, guarantee, professional valuation conclusion, or automatic investment decision.',
    operatingMode: OPERATING_MODE,
    professionalValuationConclusionModified: false,
    automaticInvestmentDecisionAuthorized: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    executedAt: isoTime(input.executedAt || Date.now(), 'executedAt'),
  };
  return deepFreeze({ ...core, resultHashSha256: hashObject(core) });
}

function verifyGovernedMonteCarloResult(result) {
  if (!result || typeof result !== 'object' || result.status !== GOVERNED_SIMULATION_STATUS.EXECUTED) return deepFreeze({ valid: false, reason: 'EXECUTED_RESULT_REQUIRED' });
  const { resultHashSha256, ...core } = result;
  try {
    const expected = assertSha(resultHashSha256, 'resultHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'RESULT_HASH_INVALID' });
  }
}

module.exports = {
  DISTRIBUTION_TYPE,
  DISTRIBUTION_CONFIDENCE,
  MONTE_CARLO_GOVERNANCE_STATUS,
  GOVERNED_SIMULATION_STATUS,
  CORRELATION_POLICY,
  hashMonteCarloBaseInputs,
  createQualifiedDistribution,
  verifyQualifiedDistribution,
  createMonteCarloGovernancePlan,
  verifyMonteCarloGovernancePlan,
  executeGovernedMonteCarlo,
  verifyGovernedMonteCarloResult,
};
