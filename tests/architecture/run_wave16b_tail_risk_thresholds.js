'use strict';

const assert = require('assert');
const {
  THRESHOLD_OPERATOR,
  runMonteCarlo,
} = require('../../src/scenario-risk');
const {
  DISTRIBUTION_TYPE,
  DISTRIBUTION_CONFIDENCE,
  CORRELATION_POLICY,
  hashMonteCarloBaseInputs,
  createQualifiedDistribution,
  createMonteCarloGovernancePlan,
  THRESHOLD_KIND,
  THRESHOLD_ANALYTICS_STATUS,
  THRESHOLD_RESULT_STATUS,
  createQualifiedDecisionThreshold,
  verifyQualifiedDecisionThreshold,
  createThresholdAnalyticsPlan,
  verifyThresholdAnalyticsPlan,
  executeThresholdAnalytics,
  verifyThresholdAnalyticsResult,
} = require('../../src/uncertainty');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const baseInputs = { rent: 100, occupancy: 0.90, cost: 1000 };
const evaluator = (inputs) => ({ value: inputs.rent * inputs.occupancy - inputs.cost * 0.05 });
const metricSelector = (result) => result.value;

function distribution(overrides = {}) {
  return createQualifiedDistribution({
    distributionId: 'DIST-RENT-16B', variableKey: 'rent', type: DISTRIBUTION_TYPE.TRIANGULAR,
    min: 80, mode: 100, max: 120, unit: 'SAR_PER_SQM_YEAR', asOfDate: '2026-09-01',
    rationale: 'Synthetic reviewed distribution for threshold analytics.', sourceRefs: ['EVIDENCE-RENT-16B'],
    confidence: DISTRIBUTION_CONFIDENCE.MEDIUM, preparedBy: 'ANALYST', reviewedBy: 'REVIEWER',
    reviewedAt: '2026-09-07T10:00:00Z', independenceAssumptionAcknowledged: true, ...overrides,
  });
}
const rentDist = distribution();
const occDist = distribution({
  distributionId: 'DIST-OCC-16B', variableKey: 'occupancy', min: 0.70, mode: 0.90, max: 0.98,
  unit: 'RATIO', sourceRefs: ['EVIDENCE-OCC-16B'],
});

function mcPlan(overrides = {}) {
  return createMonteCarloGovernancePlan({
    planId: 'MC-PLAN-16B', caseId: 'CASE-16B', propertyRef: 'PROPERTY-16B', analysisDate: '2026-09-07',
    baseInputHashSha256: hashMonteCarloBaseInputs(baseInputs), evaluatorRef: 'SYNTHETIC-EVALUATOR', evaluatorVersion: '1',
    metricCode: 'VALUE_INDICATION', metricUnit: 'SAR', iterations: 2000, seed: 99,
    distributions: [rentDist, occDist], maximumAgeDaysByVariable: { rent: 30, occupancy: 30 },
    correlationPolicy: CORRELATION_POLICY.INDEPENDENT_ONLY_V1, correlationAssumptions: [], createdAt: '2026-09-07T11:00:00Z',
    ...overrides,
  });
}
const monteCarloPlan = mcPlan();

function threshold(overrides = {}) {
  return createQualifiedDecisionThreshold({
    thresholdId: 'THRESHOLD-LOSS', kind: THRESHOLD_KIND.LOSS_LIMIT, metricCode: 'VALUE_INDICATION', metricUnit: 'SAR',
    operator: THRESHOLD_OPERATOR.BELOW, thresholdValue: 0,
    rationale: 'Measure conditional probability of a negative analytical metric.', policyRef: 'IC-POLICY-SYNTHETIC',
    evidenceRefs: ['IC-EVIDENCE-1'], preparedBy: 'ANALYST', reviewedBy: 'REVIEWER', reviewedAt: '2026-09-07T11:10:00Z',
    ...overrides,
  });
}
const lossThreshold = threshold();
const hurdleThreshold = threshold({
  thresholdId: 'THRESHOLD-HURDLE', kind: THRESHOLD_KIND.TARGET_HURDLE,
  operator: THRESHOLD_OPERATOR.AT_OR_ABOVE, thresholdValue: 40, policyRef: 'IC-HURDLE-SYNTHETIC', evidenceRefs: ['IC-EVIDENCE-2'],
});

// Core engine remains backward compatible and now supports explicit probability conditions.
const coreWithoutThresholds = runMonteCarlo({
  baseInputs, distributions: [{ key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 }],
  iterations: 1000, seed: 7, evaluator, metricSelector,
});
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(coreWithoutThresholds, 'thresholdProbabilities'), false));
const coreWithThreshold = runMonteCarlo({
  baseInputs, distributions: [{ key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 }],
  iterations: 1000, seed: 7, evaluator, metricSelector,
  thresholds: [{ thresholdId: 'ZERO', operator: THRESHOLD_OPERATOR.BELOW, threshold: 0 }],
});
check(() => assert.strictEqual(coreWithThreshold.thresholdProbabilities.length, 1));
check(() => assert.strictEqual(coreWithThreshold.thresholdProbabilities[0].probabilityConditionMet, coreWithThreshold.probabilityBelowZero));
check(() => assert.throws(() => runMonteCarlo({
  baseInputs, distributions: [{ key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 }], iterations: 100, seed: 1,
  evaluator, metricSelector, thresholds: [{ thresholdId: 'X', operator: 'INVALID', threshold: 0 }],
}), /operator is invalid/));
check(() => assert.throws(() => runMonteCarlo({
  baseInputs, distributions: [{ key: 'rent', type: 'TRIANGULAR', min: 80, mode: 100, max: 120 }], iterations: 100, seed: 1,
  evaluator, metricSelector, thresholds: [
    { thresholdId: 'X', operator: THRESHOLD_OPERATOR.BELOW, threshold: 0 },
    { thresholdId: 'X', operator: THRESHOLD_OPERATOR.ABOVE, threshold: 0 },
  ],
}), /DUPLICATE_SIMULATION_THRESHOLD_ID/));

check(() => assert.strictEqual(verifyQualifiedDecisionThreshold(lossThreshold).valid, true));
check(() => assert.strictEqual(lossThreshold.callerSuppliedThreshold, true));
check(() => assert.strictEqual(lossThreshold.thresholdInventedBySystem, false));
check(() => assert.ok(Object.isFrozen(lossThreshold)));
check(() => assert.throws(() => threshold({ evidenceRefs: [] }), /THRESHOLD_EVIDENCE_REFS_REQUIRED/));
check(() => assert.throws(() => threshold({ operator: 'AUTO' }), /operator is invalid/));
check(() => assert.throws(() => threshold({ kind: 'AUTO' }), /kind is invalid/));
const tamperedThreshold = { ...lossThreshold, thresholdValue: 1 };
check(() => assert.strictEqual(verifyQualifiedDecisionThreshold(tamperedThreshold).valid, false));

function analyticsPlan(overrides = {}) {
  return createThresholdAnalyticsPlan({
    thresholdAnalyticsPlanId: 'TAIL-PLAN-16B', caseId: 'CASE-16B', propertyRef: 'PROPERTY-16B',
    monteCarloPlan, thresholds: [lossThreshold, hurdleThreshold], createdAt: '2026-09-07T11:20:00Z', ...overrides,
  });
}
const readyPlan = analyticsPlan();
check(() => assert.strictEqual(readyPlan.analyticsStatus, THRESHOLD_ANALYTICS_STATUS.READY_FOR_ANALYSIS));
check(() => assert.deepStrictEqual(readyPlan.blockers, []));
check(() => assert.strictEqual(readyPlan.monteCarloPlanHashSha256, monteCarloPlan.planHashSha256));
check(() => assert.strictEqual(readyPlan.decisionStateDerived, false));
check(() => assert.strictEqual(readyPlan.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(readyPlan.humanCommitteeDecisionRequired, true));
check(() => assert.strictEqual(readyPlan.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(readyPlan.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(readyPlan.transactionAuthorized, false));
check(() => assert.strictEqual(verifyThresholdAnalyticsPlan(readyPlan).valid, true));
check(() => assert.ok(Object.isFrozen(readyPlan)));

const resultA = executeThresholdAnalytics({
  thresholdAnalyticsPlan: readyPlan, monteCarloPlan, baseInputs, evaluator, metricSelector, executedAt: '2026-09-07T11:30:00Z',
});
const resultB = executeThresholdAnalytics({
  thresholdAnalyticsPlan: readyPlan, monteCarloPlan, baseInputs, evaluator, metricSelector, executedAt: '2026-09-07T11:30:00Z',
});
check(() => assert.strictEqual(resultA.status, THRESHOLD_RESULT_STATUS.EXECUTED));
check(() => assert.strictEqual(resultA.thresholdResults.length, 2));
check(() => assert.deepStrictEqual(resultA.thresholdResults, resultB.thresholdResults));
check(() => assert.strictEqual(resultA.mean, resultB.mean));
check(() => assert.ok(resultA.tailRangeP05P95 >= 0));
const zeroResult = resultA.thresholdResults.find((row) => row.thresholdId === 'THRESHOLD-LOSS');
check(() => assert.strictEqual(zeroResult.probabilityConditionMet, resultA.probabilityBelowZero));
check(() => assert.strictEqual(Number((zeroResult.probabilityConditionMet + zeroResult.probabilityConditionNotMet).toFixed(12)), 1));
check(() => assert.strictEqual(resultA.decisionStateDerived, false));
check(() => assert.strictEqual(resultA.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(resultA.humanCommitteeDecisionRequired, true));
check(() => assert.strictEqual(resultA.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(resultA.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(resultA.transactionAuthorized, false));
check(() => assert.match(resultA.semantics, /do not constitute an approval/i));
check(() => assert.strictEqual(verifyThresholdAnalyticsResult(resultA).valid, true));
check(() => assert.ok(Object.isFrozen(resultA)));

const emptyPlan = analyticsPlan({ thresholds: [] });
check(() => assert.strictEqual(emptyPlan.analyticsStatus, THRESHOLD_ANALYTICS_STATUS.HOLD));
check(() => assert.ok(emptyPlan.blockers.includes('EXPLICIT_DECISION_THRESHOLDS_REQUIRED')));
check(() => assert.strictEqual(executeThresholdAnalytics({ thresholdAnalyticsPlan: emptyPlan, monteCarloPlan, baseInputs, evaluator, metricSelector }).status, THRESHOLD_RESULT_STATUS.HOLD));
const wrongMetric = threshold({ thresholdId: 'WRONG-METRIC', metricCode: 'IRR' });
check(() => assert.ok(analyticsPlan({ thresholds: [wrongMetric] }).blockers.includes('THRESHOLD_METRIC_MISMATCH:WRONG-METRIC')));
const wrongUnit = threshold({ thresholdId: 'WRONG-UNIT', metricUnit: 'PERCENT' });
check(() => assert.ok(analyticsPlan({ thresholds: [wrongUnit] }).blockers.includes('THRESHOLD_UNIT_MISMATCH:WRONG-UNIT')));
const duplicatePlan = analyticsPlan({ thresholds: [lossThreshold, lossThreshold] });
check(() => assert.ok(duplicatePlan.blockers.includes('DUPLICATE_THRESHOLD_ID:THRESHOLD-LOSS')));
const tamperedThresholdPlan = analyticsPlan({ thresholds: [tamperedThreshold] });
check(() => assert.ok(tamperedThresholdPlan.blockers.some((b) => b.startsWith('THRESHOLD_INTEGRITY_FAILURE'))));
const wrongScope = analyticsPlan({ caseId: 'OTHER-CASE' });
check(() => assert.ok(wrongScope.blockers.includes('MONTE_CARLO_PLAN_SCOPE_MISMATCH')));

const heldMcPlan = mcPlan({ correlationAssumptions: [{ left: 'rent', right: 'occupancy', correlation: 0.5 }] });
const heldParentPlan = createThresholdAnalyticsPlan({
  thresholdAnalyticsPlanId: 'TAIL-HELD', caseId: 'CASE-16B', propertyRef: 'PROPERTY-16B', monteCarloPlan: heldMcPlan,
  thresholds: [lossThreshold], createdAt: '2026-09-07T11:20:00Z',
});
check(() => assert.ok(heldParentPlan.blockers.includes('MONTE_CARLO_PLAN_NOT_READY')));

const tamperedAnalyticsPlan = { ...readyPlan, metricUnit: 'TAMPERED' };
check(() => assert.strictEqual(verifyThresholdAnalyticsPlan(tamperedAnalyticsPlan).valid, false));
check(() => assert.throws(() => executeThresholdAnalytics({
  thresholdAnalyticsPlan: tamperedAnalyticsPlan, monteCarloPlan, baseInputs, evaluator, metricSelector,
}), /THRESHOLD_ANALYTICS_PLAN_INTEGRITY_FAILURE/));
const otherMcPlan = mcPlan({ planId: 'MC-OTHER' });
check(() => assert.throws(() => executeThresholdAnalytics({
  thresholdAnalyticsPlan: readyPlan, monteCarloPlan: otherMcPlan, baseInputs, evaluator, metricSelector,
}), /THRESHOLD_ANALYTICS_MONTE_CARLO_PLAN_BINDING_MISMATCH/));
check(() => assert.throws(() => executeThresholdAnalytics({
  thresholdAnalyticsPlan: readyPlan, monteCarloPlan, baseInputs: { ...baseInputs, rent: 101 }, evaluator, metricSelector,
}), /THRESHOLD_ANALYTICS_BASE_INPUT_HASH_MISMATCH/));
const tamperedResult = { ...resultA, p05: resultA.p05 - 1 };
check(() => assert.strictEqual(verifyThresholdAnalyticsResult(tamperedResult).valid, false));

console.log(`WAVE_16B_TAIL_RISK_THRESHOLDS=PASS checks=${checks}`);
