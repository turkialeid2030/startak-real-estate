'use strict';

const crypto = require('crypto');
const {
  CORRELATED_SIMULATION_STATUS,
  CORRELATED_SAMPLING_MODEL,
  validateCorrelationModel,
  runCorrelatedMonteCarlo,
} = require('../scenario-risk/correlated-monte-carlo');
const {
  verifyQualifiedDistribution,
  hashMonteCarloBaseInputs,
} = require('./monte-carlo-governance');

const CORRELATION_MODEL_VERSION = 'C7_GAUSSIAN_COPULA_CORRELATION_V1';
const CORRELATED_MONTE_CARLO_PLAN_VERSION = 'C7_GOVERNED_CORRELATED_MONTE_CARLO_PLAN_V1';
const CORRELATED_MONTE_CARLO_RESULT_VERSION = 'C7_GOVERNED_CORRELATED_MONTE_CARLO_RESULT_V1';
const CORRELATED_GOVERNANCE_STATUS = Object.freeze({ READY_FOR_SIMULATION: 'READY_FOR_SIMULATION', HOLD: 'HOLD' });
const CORRELATED_EXECUTION_STATUS = Object.freeze({ EXECUTED: 'EXECUTED', HOLD: 'HOLD' });
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

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function assertSha(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  return value.toLowerCase();
}

function realIsoDate(value, field) {
  requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`${field} must be a real ISO date`);
  return value;
}

function isoTime(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function stringArray(values, field, { required = false } = {}) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const result = values.map((value) => requiredString(value, field));
  if (required && result.length === 0) throw new Error(`${field.toUpperCase()}_REQUIRED`);
  if (new Set(result).size !== result.length) throw new Error(`DUPLICATE_${field.toUpperCase()}`);
  return result;
}

function daysBetween(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.floor((to - from) / 86400000);
}

function normalizeThresholds(thresholds) {
  if (thresholds === undefined || thresholds === null) return [];
  if (!Array.isArray(thresholds)) throw new TypeError('thresholds must be an array');
  const ids = new Set();
  return thresholds.map((threshold, index) => {
    if (!threshold || typeof threshold !== 'object' || Array.isArray(threshold)) throw new TypeError(`thresholds[${index}] must be an object`);
    const thresholdId = requiredString(threshold.thresholdId, `thresholds[${index}].thresholdId`);
    if (ids.has(thresholdId)) throw new Error(`DUPLICATE_SIMULATION_THRESHOLD_ID:${thresholdId}`);
    ids.add(thresholdId);
    if (!['BELOW', 'AT_OR_BELOW', 'ABOVE', 'AT_OR_ABOVE'].includes(threshold.operator)) throw new TypeError(`thresholds[${index}].operator is invalid`);
    if (typeof threshold.threshold !== 'number' || !Number.isFinite(threshold.threshold)) throw new TypeError(`thresholds[${index}].threshold must be a finite number`);
    return { thresholdId, operator: threshold.operator, threshold: threshold.threshold };
  });
}

function createQualifiedCorrelationModel(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('input is required');
  const variableKeys = stringArray(input.variableKeys || [], 'variableKeys', { required: true });
  const validation = validateCorrelationModel({ variableKeys, matrix: input.matrix }, variableKeys);
  if (!validation.valid) throw new Error(validation.blocker);
  const asOfDate = realIsoDate(input.asOfDate, 'asOfDate');
  const reviewedAt = isoTime(input.reviewedAt, 'reviewedAt');
  if (reviewedAt.slice(0, 10) < asOfDate) throw new Error('CORRELATION_REVIEW_BEFORE_AS_OF_DATE');
  const core = {
    schemaVersion: 1,
    modelVersion: CORRELATION_MODEL_VERSION,
    correlationModelId: requiredString(input.correlationModelId, 'correlationModelId'),
    variableKeys,
    matrix: validation.matrix.map((row) => [...row]),
    methodology: CORRELATED_SAMPLING_MODEL,
    rationale: requiredString(input.rationale, 'rationale'),
    sourceRefs: stringArray(input.sourceRefs || [], 'sourceRefs', { required: true }),
    asOfDate,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt,
    nearestPsdRepairApplied: false,
    professionalJudgementRequired: true,
    automaticCorrelationInferenceApplied: false,
  };
  return deepFreeze({ ...core, correlationModelHashSha256: hashObject(core) });
}

function verifyQualifiedCorrelationModel(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) return deepFreeze({ valid: false, reason: 'CORRELATION_MODEL_REQUIRED' });
  const { correlationModelHashSha256, ...core } = model;
  try {
    const expected = assertSha(correlationModelHashSha256, 'correlationModelHashSha256');
    if (core.modelVersion !== CORRELATION_MODEL_VERSION || core.methodology !== CORRELATED_SAMPLING_MODEL) return deepFreeze({ valid: false, reason: 'CORRELATION_MODEL_VERSION_INVALID' });
    const validation = validateCorrelationModel({ variableKeys: core.variableKeys, matrix: core.matrix }, core.variableKeys || []);
    if (!validation.valid) return deepFreeze({ valid: false, reason: validation.blocker });
    if (core.nearestPsdRepairApplied !== false || core.automaticCorrelationInferenceApplied !== false) return deepFreeze({ valid: false, reason: 'CORRELATION_MODEL_UNAUTHORIZED_AUTOMATION' });
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed, reason: computed === expected ? null : 'CORRELATION_MODEL_HASH_MISMATCH' });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'CORRELATION_MODEL_HASH_INVALID' });
  }
}

function createCorrelatedMonteCarloGovernancePlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('input is required');
  const blockers = new Set();
  const analysisDate = realIsoDate(input.analysisDate, 'analysisDate');
  const distributions = Array.isArray(input.distributions) ? input.distributions : [];
  if (distributions.length === 0) blockers.add('QUALIFIED_DISTRIBUTIONS_REQUIRED');

  const distributionIds = new Set();
  const variableKeys = new Set();
  const normalizedDistributions = [];
  const maximumAgeDaysByVariable = input.maximumAgeDaysByVariable && typeof input.maximumAgeDaysByVariable === 'object' && !Array.isArray(input.maximumAgeDaysByVariable)
    ? { ...input.maximumAgeDaysByVariable }
    : {};

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
    normalizedDistributions.push({ ...distribution });
  }

  const correlationModel = input.correlationModel;
  const correlationVerification = verifyQualifiedCorrelationModel(correlationModel);
  if (!correlationVerification.valid) blockers.add(`CORRELATION_MODEL_INTEGRITY_FAILURE:${correlationVerification.reason || 'UNKNOWN'}`);
  else {
    const orderedDistributionKeys = normalizedDistributions.map((distribution) => distribution.variableKey);
    if (correlationModel.variableKeys.length !== orderedDistributionKeys.length) blockers.add('CORRELATION_VARIABLE_COUNT_MISMATCH');
    else {
      for (let i = 0; i < orderedDistributionKeys.length; i++) {
        if (correlationModel.variableKeys[i] !== orderedDistributionKeys[i]) blockers.add(`CORRELATION_VARIABLE_ORDER_MISMATCH:${i}`);
      }
    }
    if (correlationModel.asOfDate > analysisDate) blockers.add('CORRELATION_AS_OF_DATE_IN_FUTURE');
    if (!Number.isInteger(input.maximumCorrelationAgeDays) || input.maximumCorrelationAgeDays < 0) blockers.add('CORRELATION_MAX_AGE_POLICY_REQUIRED');
    else if (daysBetween(correlationModel.asOfDate, analysisDate) > input.maximumCorrelationAgeDays) blockers.add('CORRELATION_MODEL_STALE');
  }

  if (!Number.isInteger(input.iterations) || input.iterations < 100 || input.iterations > 100000) throw new RangeError('iterations must be integer between 100 and 100000');
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer');
  const thresholds = normalizeThresholds(input.thresholds || []);

  const core = {
    schemaVersion: 1,
    planVersion: CORRELATED_MONTE_CARLO_PLAN_VERSION,
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
    distributions: normalizedDistributions,
    maximumAgeDaysByVariable,
    correlationModel: correlationModel ? { ...correlationModel, variableKeys: [...(correlationModel.variableKeys || [])], matrix: Array.isArray(correlationModel.matrix) ? correlationModel.matrix.map((row) => [...row]) : correlationModel.matrix } : null,
    maximumCorrelationAgeDays: input.maximumCorrelationAgeDays,
    thresholds,
    blockers: [...blockers].sort(),
    governanceStatus: blockers.size === 0 ? CORRELATED_GOVERNANCE_STATUS.READY_FOR_SIMULATION : CORRELATED_GOVERNANCE_STATUS.HOLD,
    operatingMode: OPERATING_MODE,
    professionalValuationConclusionModified: false,
    automaticInvestmentDecisionAuthorized: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    createdAt: isoTime(input.createdAt || Date.now(), 'createdAt'),
  };
  return deepFreeze({ ...core, planHashSha256: hashObject(core) });
}

function verifyCorrelatedMonteCarloGovernancePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return deepFreeze({ valid: false, reason: 'PLAN_REQUIRED' });
  const { planHashSha256, ...core } = plan;
  try {
    const expected = assertSha(planHashSha256, 'planHashSha256');
    if (core.planVersion !== CORRELATED_MONTE_CARLO_PLAN_VERSION) return deepFreeze({ valid: false, reason: 'PLAN_VERSION_INVALID' });
    if (core.transactionAuthorized !== false || core.approvalAuthorized !== false || core.publicAiAuthorized !== false || core.commercialGoLive !== 'HOLD' || core.canonicalBaselineActivationAuthorized !== false) {
      return deepFreeze({ valid: false, reason: 'PLAN_AUTHORITY_BOUNDARY_INVALID' });
    }
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed, reason: computed === expected ? null : 'PLAN_HASH_MISMATCH' });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'PLAN_HASH_INVALID' });
  }
}

function executeGovernedCorrelatedMonteCarlo(input) {
  const plan = input?.plan;
  if (!verifyCorrelatedMonteCarloGovernancePlan(plan).valid) throw new Error('CORRELATED_MONTE_CARLO_PLAN_INTEGRITY_FAILURE');
  if (plan.governanceStatus !== CORRELATED_GOVERNANCE_STATUS.READY_FOR_SIMULATION) {
    return deepFreeze({
      status: CORRELATED_EXECUTION_STATUS.HOLD,
      planId: plan.planId,
      planHashSha256: plan.planHashSha256,
      blockers: [...plan.blockers],
      automaticInvestmentDecisionAuthorized: false,
      transactionAuthorized: false,
      approvalAuthorized: false,
      publicAiAuthorized: false,
      commercialGoLive: 'HOLD',
      canonicalBaselineActivationAuthorized: false,
    });
  }
  if (!verifyQualifiedCorrelationModel(plan.correlationModel).valid) throw new Error('CORRELATION_MODEL_INTEGRITY_FAILURE');
  const actualBaseHash = hashMonteCarloBaseInputs(input.baseInputs);
  if (actualBaseHash !== plan.baseInputHashSha256) throw new Error('CORRELATED_MONTE_CARLO_BASE_INPUT_HASH_MISMATCH');
  if (typeof input.evaluator !== 'function' || typeof input.metricSelector !== 'function') throw new TypeError('evaluator and metricSelector must be functions');

  const raw = runCorrelatedMonteCarlo({
    baseInputs: input.baseInputs,
    distributions: plan.distributions.map((distribution) => ({
      key: distribution.variableKey,
      type: distribution.type,
      min: distribution.min,
      mode: distribution.mode,
      max: distribution.max,
    })),
    correlationModel: {
      variableKeys: [...plan.correlationModel.variableKeys],
      matrix: plan.correlationModel.matrix.map((row) => [...row]),
    },
    iterations: plan.iterations,
    seed: plan.seed,
    evaluator: input.evaluator,
    metricSelector: input.metricSelector,
    thresholds: plan.thresholds,
  });
  if (raw.status !== CORRELATED_SIMULATION_STATUS.QUALIFIED) throw new Error(`CORRELATED_MONTE_CARLO_ENGINE_NOT_QUALIFIED:${raw.status}:${raw.reason || 'UNKNOWN'}`);

  const core = {
    schemaVersion: 1,
    resultVersion: CORRELATED_MONTE_CARLO_RESULT_VERSION,
    status: CORRELATED_EXECUTION_STATUS.EXECUTED,
    planId: plan.planId,
    planHashSha256: plan.planHashSha256,
    correlationModelId: plan.correlationModel.correlationModelId,
    correlationModelHashSha256: plan.correlationModel.correlationModelHashSha256,
    caseId: plan.caseId,
    propertyRef: plan.propertyRef,
    analysisDate: plan.analysisDate,
    evaluatorRef: plan.evaluatorRef,
    evaluatorVersion: plan.evaluatorVersion,
    metricCode: plan.metricCode,
    metricUnit: plan.metricUnit,
    samplingModel: raw.samplingModel,
    correlationModelApplied: true,
    variableKeys: [...raw.variableKeys],
    iterations: raw.iterations,
    seed: raw.seed,
    mean: raw.mean,
    standardDeviation: raw.standardDeviation,
    p05: raw.p05,
    p50: raw.p50,
    p95: raw.p95,
    min: raw.min,
    max: raw.max,
    probabilityBelowZero: raw.probabilityBelowZero,
    thresholdProbabilities: raw.thresholdProbabilities ? raw.thresholdProbabilities.map((item) => ({ ...item })) : [],
    semantics: raw.semantics,
    operatingMode: OPERATING_MODE,
    professionalValuationConclusionModified: false,
    automaticInvestmentDecisionAuthorized: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    executedAt: isoTime(input.executedAt || Date.now(), 'executedAt'),
  };
  return deepFreeze({ ...core, resultHashSha256: hashObject(core) });
}

function verifyGovernedCorrelatedMonteCarloResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result) || result.status !== CORRELATED_EXECUTION_STATUS.EXECUTED) return deepFreeze({ valid: false, reason: 'EXECUTED_RESULT_REQUIRED' });
  const { resultHashSha256, ...core } = result;
  try {
    const expected = assertSha(resultHashSha256, 'resultHashSha256');
    if (core.resultVersion !== CORRELATED_MONTE_CARLO_RESULT_VERSION) return deepFreeze({ valid: false, reason: 'RESULT_VERSION_INVALID' });
    if (core.transactionAuthorized !== false || core.approvalAuthorized !== false || core.publicAiAuthorized !== false || core.commercialGoLive !== 'HOLD' || core.canonicalBaselineActivationAuthorized !== false) {
      return deepFreeze({ valid: false, reason: 'RESULT_AUTHORITY_BOUNDARY_INVALID' });
    }
    const computed = hashObject(core);
    return deepFreeze({ valid: computed === expected, expectedHash: expected, computedHash: computed, reason: computed === expected ? null : 'RESULT_HASH_MISMATCH' });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'RESULT_HASH_INVALID' });
  }
}

module.exports = {
  CORRELATION_MODEL_VERSION,
  CORRELATED_MONTE_CARLO_PLAN_VERSION,
  CORRELATED_MONTE_CARLO_RESULT_VERSION,
  CORRELATED_GOVERNANCE_STATUS,
  CORRELATED_EXECUTION_STATUS,
  createQualifiedCorrelationModel,
  verifyQualifiedCorrelationModel,
  createCorrelatedMonteCarloGovernancePlan,
  verifyCorrelatedMonteCarloGovernancePlan,
  executeGovernedCorrelatedMonteCarlo,
  verifyGovernedCorrelatedMonteCarloResult,
};
