'use strict';

const assert = require('assert');
const { runMonteCarlo, SIMULATION_STATUS } = require('../../src/scenario-risk');
const {
  CORRELATED_SIMULATION_STATUS,
  validateCorrelationModel,
  runCorrelatedMonteCarlo,
} = require('../../src/scenario-risk/correlated-monte-carlo');
const {
  createQualifiedDistribution,
  createMonteCarloGovernancePlan,
  CORRELATION_POLICY,
  MONTE_CARLO_GOVERNANCE_STATUS,
  hashMonteCarloBaseInputs,
} = require('../../src/uncertainty/monte-carlo-governance');
const {
  CORRELATED_GOVERNANCE_STATUS,
  CORRELATED_EXECUTION_STATUS,
  createQualifiedCorrelationModel,
  verifyQualifiedCorrelationModel,
  createCorrelatedMonteCarloGovernancePlan,
  verifyCorrelatedMonteCarloGovernancePlan,
  executeGovernedCorrelatedMonteCarlo,
  verifyGovernedCorrelatedMonteCarloResult,
} = require('../../src/uncertainty/correlated-monte-carlo-governance');

const baseInputs = { x: 1, y: 1 };
const distributions = [
  { key: 'x', type: 'TRIANGULAR', min: 0, mode: 1, max: 2 },
  { key: 'y', type: 'TRIANGULAR', min: 0, mode: 1, max: 2 },
];
const evaluator = (inputs) => inputs;

// Perfect +1 correlation over identical marginals must produce identical draws.
const perfectPositive = runCorrelatedMonteCarlo({
  baseInputs,
  distributions,
  correlationModel: { variableKeys: ['x', 'y'], matrix: [[1, 1], [1, 1]] },
  iterations: 1000,
  seed: 484,
  evaluator,
  metricSelector: (raw) => raw.x - raw.y,
});
assert.strictEqual(perfectPositive.status, CORRELATED_SIMULATION_STATUS.QUALIFIED);
assert.strictEqual(perfectPositive.correlationModelApplied, true);
assert.strictEqual(perfectPositive.standardDeviation, 0);
assert.strictEqual(perfectPositive.min, 0);
assert.strictEqual(perfectPositive.max, 0);

// Deterministic replay is exact for a fixed seed and governed inputs.
const replay = runCorrelatedMonteCarlo({
  baseInputs,
  distributions,
  correlationModel: { variableKeys: ['x', 'y'], matrix: [[1, 0.65], [0.65, 1]] },
  iterations: 1500,
  seed: 2030,
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
  thresholds: [{ thresholdId: 'SUM_BELOW_1', operator: 'BELOW', threshold: 1 }],
});
const replay2 = runCorrelatedMonteCarlo({
  baseInputs,
  distributions,
  correlationModel: { variableKeys: ['x', 'y'], matrix: [[1, 0.65], [0.65, 1]] },
  iterations: 1500,
  seed: 2030,
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
  thresholds: [{ thresholdId: 'SUM_BELOW_1', operator: 'BELOW', threshold: 1 }],
});
assert.deepStrictEqual(replay, replay2);
assert.ok(replay.p05 <= replay.p50 && replay.p50 <= replay.p95);
assert.ok(replay.standardDeviation > 0);
assert.ok(replay.thresholdProbabilities[0].probabilityConditionMet >= 0 && replay.thresholdProbabilities[0].probabilityConditionMet <= 1);

// Invalid correlation contracts fail closed; no nearest-PSD or silent repair occurs.
assert.strictEqual(validateCorrelationModel({ variableKeys: ['x', 'y'], matrix: [[1, 0.2], [0.3, 1]] }, ['x', 'y']).blocker, 'CORRELATION_MATRIX_ASYMMETRIC:0:1');
assert.strictEqual(validateCorrelationModel({ variableKeys: ['x', 'y'], matrix: [[0.9, 0], [0, 1]] }, ['x', 'y']).blocker, 'CORRELATION_DIAGONAL_NOT_ONE:0');
assert.strictEqual(validateCorrelationModel({ variableKeys: ['x', 'y'], matrix: [[1, 1.1], [1.1, 1]] }, ['x', 'y']).blocker, 'CORRELATION_COEFFICIENT_OUT_OF_RANGE:0:1');
assert.strictEqual(validateCorrelationModel({ variableKeys: ['x', 'x'], matrix: [[1, 0], [0, 1]] }, ['x', 'x']).blocker, 'DUPLICATE_CORRELATION_VARIABLE_KEY');
assert.strictEqual(validateCorrelationModel({ variableKeys: ['x', 'y'], matrix: [[1, 0], [0, 1]] }, ['y', 'x']).blocker, 'CORRELATION_VARIABLE_ORDER_MISMATCH:0');
const notPsd = validateCorrelationModel({
  variableKeys: ['x', 'y', 'z'],
  matrix: [[1, 0.9, 0.9], [0.9, 1, -0.9], [0.9, -0.9, 1]],
}, ['x', 'y', 'z']);
assert.strictEqual(notPsd.valid, false);
assert.strictEqual(notPsd.blocker, 'CORRELATION_MATRIX_NOT_POSITIVE_SEMIDEFINITE');

// Legacy independent scenario-risk Monte Carlo remains deterministic and untouched.
const legacyArgs = {
  baseInputs,
  distributions,
  iterations: 500,
  seed: 77,
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
};
const legacyA = runMonteCarlo(legacyArgs);
const legacyB = runMonteCarlo(legacyArgs);
assert.strictEqual(legacyA.status, SIMULATION_STATUS.QUALIFIED);
assert.deepStrictEqual(legacyA, legacyB);
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyA, 'correlationModelApplied'), false);

const qualifiedX = createQualifiedDistribution({
  distributionId: 'DIST-C7-X', variableKey: 'x', type: 'TRIANGULAR', min: 0, mode: 1, max: 2,
  unit: 'INDEX', asOfDate: '2026-09-29', rationale: 'Reviewed marginal for C7 regression.',
  sourceRefs: ['EVIDENCE-C7-X'], confidence: 'MEDIUM', preparedBy: 'risk-analyst', reviewedBy: 'risk-reviewer',
  reviewedAt: '2026-09-29T10:00:00Z', independenceAssumptionAcknowledged: false,
});
const qualifiedY = createQualifiedDistribution({
  distributionId: 'DIST-C7-Y', variableKey: 'y', type: 'TRIANGULAR', min: 0, mode: 1, max: 2,
  unit: 'INDEX', asOfDate: '2026-09-29', rationale: 'Reviewed marginal for C7 regression.',
  sourceRefs: ['EVIDENCE-C7-Y'], confidence: 'MEDIUM', preparedBy: 'risk-analyst', reviewedBy: 'risk-reviewer',
  reviewedAt: '2026-09-29T10:05:00Z', independenceAssumptionAcknowledged: false,
});
const correlationModel = createQualifiedCorrelationModel({
  correlationModelId: 'CORR-C7-XY',
  variableKeys: ['x', 'y'],
  matrix: [[1, 0.65], [0.65, 1]],
  rationale: 'Reviewed dependency assumption for regression; not inferred automatically.',
  sourceRefs: ['EVIDENCE-C7-CORRELATION'],
  asOfDate: '2026-09-29',
  preparedBy: 'risk-analyst',
  reviewedBy: 'risk-reviewer',
  reviewedAt: '2026-09-29T11:00:00Z',
});
assert.strictEqual(verifyQualifiedCorrelationModel(correlationModel).valid, true);
assert.strictEqual(correlationModel.nearestPsdRepairApplied, false);
assert.strictEqual(correlationModel.automaticCorrelationInferenceApplied, false);

const baseInputHashSha256 = hashMonteCarloBaseInputs(baseInputs);
const planInput = {
  planId: 'C7-PLAN-1',
  caseId: 'CASE-C7-1',
  propertyRef: 'PROPERTY-C7-1',
  analysisDate: '2026-09-30',
  baseInputHashSha256,
  evaluatorRef: 'C7-TEST-EVALUATOR',
  evaluatorVersion: '1.0.0',
  metricCode: 'X_PLUS_Y',
  metricUnit: 'INDEX',
  iterations: 1500,
  seed: 2030,
  distributions: [qualifiedX, qualifiedY],
  maximumAgeDaysByVariable: { x: 30, y: 30 },
  correlationModel,
  maximumCorrelationAgeDays: 30,
  thresholds: [{ thresholdId: 'SUM_BELOW_1', operator: 'BELOW', threshold: 1 }],
  createdAt: '2026-09-30T12:00:00Z',
};
const plan = createCorrelatedMonteCarloGovernancePlan(planInput);
assert.strictEqual(plan.governanceStatus, CORRELATED_GOVERNANCE_STATUS.READY_FOR_SIMULATION);
assert.deepStrictEqual(plan.blockers, []);
assert.strictEqual(verifyCorrelatedMonteCarloGovernancePlan(plan).valid, true);
assert.strictEqual(plan.transactionAuthorized, false);
assert.strictEqual(plan.approvalAuthorized, false);
assert.strictEqual(plan.publicAiAuthorized, false);
assert.strictEqual(plan.commercialGoLive, 'HOLD');
assert.strictEqual(plan.canonicalBaselineActivationAuthorized, false);

const result = executeGovernedCorrelatedMonteCarlo({
  plan,
  baseInputs,
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
  executedAt: '2026-09-30T12:05:00Z',
});
const resultReplay = executeGovernedCorrelatedMonteCarlo({
  plan,
  baseInputs,
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
  executedAt: '2026-09-30T12:05:00Z',
});
assert.strictEqual(result.status, CORRELATED_EXECUTION_STATUS.EXECUTED);
assert.deepStrictEqual(result, resultReplay);
assert.strictEqual(verifyGovernedCorrelatedMonteCarloResult(result).valid, true);
assert.strictEqual(result.correlationModelHashSha256, correlationModel.correlationModelHashSha256);
assert.strictEqual(result.correlationModelApplied, true);
assert.strictEqual(result.transactionAuthorized, false);
assert.strictEqual(result.approvalAuthorized, false);
assert.strictEqual(result.publicAiAuthorized, false);
assert.strictEqual(result.commercialGoLive, 'HOLD');
assert.strictEqual(result.canonicalBaselineActivationAuthorized, false);

// Hash tampering is detected.
const tamperedModel = JSON.parse(JSON.stringify(correlationModel));
tamperedModel.matrix[0][1] = 0.2;
assert.strictEqual(verifyQualifiedCorrelationModel(tamperedModel).valid, false);
const tamperedPlan = JSON.parse(JSON.stringify(plan));
tamperedPlan.seed = 999;
assert.strictEqual(verifyCorrelatedMonteCarloGovernancePlan(tamperedPlan).valid, false);
const tamperedResult = JSON.parse(JSON.stringify(result));
tamperedResult.mean += 1;
assert.strictEqual(verifyGovernedCorrelatedMonteCarloResult(tamperedResult).valid, false);

assert.throws(() => executeGovernedCorrelatedMonteCarlo({
  plan,
  baseInputs: { ...baseInputs, x: 1.01 },
  evaluator,
  metricSelector: (raw) => raw.x + raw.y,
}), /CORRELATED_MONTE_CARLO_BASE_INPUT_HASH_MISMATCH/);

// Order and freshness mismatches hold the governed plan.
const reversedModel = createQualifiedCorrelationModel({
  correlationModelId: 'CORR-C7-YX', variableKeys: ['y', 'x'], matrix: [[1, 0.65], [0.65, 1]],
  rationale: 'Intentional order mismatch regression.', sourceRefs: ['EVIDENCE-C7-CORRELATION'], asOfDate: '2026-09-29',
  preparedBy: 'risk-analyst', reviewedBy: 'risk-reviewer', reviewedAt: '2026-09-29T11:00:00Z',
});
const orderHold = createCorrelatedMonteCarloGovernancePlan({ ...planInput, planId: 'C7-PLAN-ORDER-HOLD', correlationModel: reversedModel });
assert.strictEqual(orderHold.governanceStatus, CORRELATED_GOVERNANCE_STATUS.HOLD);
assert.ok(orderHold.blockers.includes('CORRELATION_VARIABLE_ORDER_MISMATCH:0'));

const staleModel = createQualifiedCorrelationModel({
  correlationModelId: 'CORR-C7-STALE', variableKeys: ['x', 'y'], matrix: [[1, 0.65], [0.65, 1]],
  rationale: 'Intentional stale model regression.', sourceRefs: ['EVIDENCE-C7-CORRELATION-OLD'], asOfDate: '2025-01-01',
  preparedBy: 'risk-analyst', reviewedBy: 'risk-reviewer', reviewedAt: '2025-01-01T11:00:00Z',
});
const staleHold = createCorrelatedMonteCarloGovernancePlan({ ...planInput, planId: 'C7-PLAN-STALE-HOLD', correlationModel: staleModel, maximumCorrelationAgeDays: 30 });
assert.strictEqual(staleHold.governanceStatus, CORRELATED_GOVERNANCE_STATUS.HOLD);
assert.ok(staleHold.blockers.includes('CORRELATION_MODEL_STALE'));

// Existing V1 independent governance remains fail-closed if correlations are supplied.
const legacyIndependentPlan = createMonteCarloGovernancePlan({
  planId: 'LEGACY-INDEPENDENT-C7-CHECK', caseId: 'CASE-C7-LEGACY', propertyRef: 'PROPERTY-C7-LEGACY', analysisDate: '2026-09-30',
  baseInputHashSha256, evaluatorRef: 'LEGACY', evaluatorVersion: '1', metricCode: 'X_PLUS_Y', metricUnit: 'INDEX',
  iterations: 500, seed: 5, distributions: [qualifiedX, qualifiedY], maximumAgeDaysByVariable: { x: 30, y: 30 },
  correlationPolicy: CORRELATION_POLICY.INDEPENDENT_ONLY_V1,
  correlationAssumptions: [{ x: 'x', y: 'y', rho: 0.65 }],
  createdAt: '2026-09-30T12:10:00Z',
});
assert.strictEqual(legacyIndependentPlan.governanceStatus, MONTE_CARLO_GOVERNANCE_STATUS.HOLD);
assert.ok(legacyIndependentPlan.blockers.includes('CORRELATION_MODEL_UNSUPPORTED_BY_V1_ENGINE'));

console.log('c7_governed_correlated_monte_carlo: PASS');
