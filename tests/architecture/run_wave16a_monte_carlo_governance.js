'use strict';

const assert = require('assert');
const {
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
} = require('../../src/uncertainty');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const baseInputs = { rent: 100, occupancy: 0.90, cost: 1000 };
const evaluator = (inputs) => ({ value: inputs.rent * inputs.occupancy - inputs.cost * 0.05 });
const metricSelector = (result) => result.value;
const baseHash = hashMonteCarloBaseInputs(baseInputs);

function distribution(overrides = {}) {
  return createQualifiedDistribution({
    distributionId: 'DIST-RENT',
    variableKey: 'rent',
    type: DISTRIBUTION_TYPE.TRIANGULAR,
    min: 80,
    mode: 100,
    max: 120,
    unit: 'SAR_PER_SQM_YEAR',
    asOfDate: '2026-09-01',
    rationale: 'Synthetic market-supported range for governance testing.',
    sourceRefs: ['MARKET-EVIDENCE-1'],
    confidence: DISTRIBUTION_CONFIDENCE.MEDIUM,
    preparedBy: 'ANALYST-1',
    reviewedBy: 'REVIEWER-1',
    reviewedAt: '2026-09-07T10:00:00Z',
    independenceAssumptionAcknowledged: true,
    ...overrides,
  });
}

const rentDist = distribution();
const occDist = distribution({
  distributionId: 'DIST-OCC', variableKey: 'occupancy', min: 0.70, mode: 0.90, max: 0.98,
  unit: 'RATIO', sourceRefs: ['LEASE-EVIDENCE-1'],
});

check(() => assert.strictEqual(baseHash.length, 64));
check(() => assert.strictEqual(verifyQualifiedDistribution(rentDist).valid, true));
check(() => assert.ok(Object.isFrozen(rentDist)));
check(() => assert.strictEqual(rentDist.correlationModelApplied, false));
check(() => assert.throws(() => distribution({ sourceRefs: [] }), /SOURCEREFS_REQUIRED/));
check(() => assert.throws(() => distribution({ reviewedAt: '2026-08-31T10:00:00Z' }), /DISTRIBUTION_REVIEW_BEFORE_AS_OF_DATE/));
check(() => assert.throws(() => distribution({ type: 'NORMAL' }), /ONLY_TRIANGULAR_DISTRIBUTIONS_SUPPORTED_V1/));
check(() => assert.throws(() => distribution({ min: 100, mode: 90, max: 120 }), /triangular distribution/));
const tamperedDist = { ...rentDist, max: 130 };
check(() => assert.strictEqual(verifyQualifiedDistribution(tamperedDist).valid, false));

function plan(overrides = {}) {
  return createMonteCarloGovernancePlan({
    planId: 'PLAN-W16A',
    caseId: 'CASE-W16A',
    propertyRef: 'PROPERTY-W16A',
    analysisDate: '2026-09-07',
    baseInputHashSha256: baseHash,
    evaluatorRef: 'EXISTING_BUILDING_ENGINE',
    evaluatorVersion: 'V2',
    metricCode: 'VALUE_INDICATION',
    metricUnit: 'SAR',
    iterations: 1000,
    seed: 42,
    distributions: [rentDist, occDist],
    maximumAgeDaysByVariable: { rent: 30, occupancy: 30 },
    correlationPolicy: CORRELATION_POLICY.INDEPENDENT_ONLY_V1,
    correlationAssumptions: [],
    createdAt: '2026-09-07T11:00:00Z',
    ...overrides,
  });
}

const readyPlan = plan();
check(() => assert.strictEqual(readyPlan.governanceStatus, MONTE_CARLO_GOVERNANCE_STATUS.READY_FOR_SIMULATION));
check(() => assert.deepStrictEqual(readyPlan.blockers, []));
check(() => assert.strictEqual(readyPlan.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(readyPlan.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(readyPlan.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(readyPlan.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(readyPlan.transactionAuthorized, false));
check(() => assert.strictEqual(verifyMonteCarloGovernancePlan(readyPlan).valid, true));
check(() => assert.ok(Object.isFrozen(readyPlan)));

const resultA = executeGovernedMonteCarlo({
  plan: readyPlan, baseInputs, evaluator, metricSelector, executedAt: '2026-09-07T11:10:00Z',
});
const resultB = executeGovernedMonteCarlo({
  plan: readyPlan, baseInputs, evaluator, metricSelector, executedAt: '2026-09-07T11:10:00Z',
});
check(() => assert.strictEqual(resultA.status, GOVERNED_SIMULATION_STATUS.EXECUTED));
check(() => assert.strictEqual(resultA.mean, resultB.mean));
check(() => assert.strictEqual(resultA.p05, resultB.p05));
check(() => assert.strictEqual(resultA.p50, resultB.p50));
check(() => assert.strictEqual(resultA.p95, resultB.p95));
check(() => assert.ok(resultA.p05 <= resultA.p50));
check(() => assert.ok(resultA.p50 <= resultA.p95));
check(() => assert.strictEqual(resultA.correlationModelApplied, false));
check(() => assert.strictEqual(resultA.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(resultA.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(resultA.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(resultA.transactionAuthorized, false));
check(() => assert.match(resultA.semantics, /not a prediction/i));
check(() => assert.strictEqual(verifyGovernedMonteCarloResult(resultA).valid, true));
check(() => assert.ok(Object.isFrozen(resultA)));

const stale = plan({ analysisDate: '2026-11-01', maximumAgeDaysByVariable: { rent: 30, occupancy: 30 } });
check(() => assert.strictEqual(stale.governanceStatus, MONTE_CARLO_GOVERNANCE_STATUS.HOLD));
check(() => assert.ok(stale.blockers.includes('DISTRIBUTION_STALE:rent')));
check(() => assert.ok(stale.blockers.includes('DISTRIBUTION_STALE:occupancy')));
const noAgePolicy = plan({ maximumAgeDaysByVariable: { rent: 30 } });
check(() => assert.ok(noAgePolicy.blockers.includes('DISTRIBUTION_MAX_AGE_POLICY_REQUIRED:occupancy')));
const futureDist = distribution({ distributionId: 'DIST-FUTURE', asOfDate: '2026-09-10', reviewedAt: '2026-09-10T10:00:00Z' });
const futurePlan = plan({ distributions: [futureDist], maximumAgeDaysByVariable: { rent: 30 } });
check(() => assert.ok(futurePlan.blockers.includes('DISTRIBUTION_AS_OF_DATE_IN_FUTURE:rent')));
const noAck = distribution({ distributionId: 'DIST-NOACK', independenceAssumptionAcknowledged: false });
const noAckPlan = plan({ distributions: [noAck], maximumAgeDaysByVariable: { rent: 30 } });
check(() => assert.ok(noAckPlan.blockers.includes('INDEPENDENCE_ASSUMPTION_ACKNOWLEDGEMENT_REQUIRED:rent')));
const correlationPlan = plan({ correlationAssumptions: [{ left: 'rent', right: 'occupancy', correlation: 0.5 }] });
check(() => assert.ok(correlationPlan.blockers.includes('CORRELATION_MODEL_UNSUPPORTED_BY_V1_ENGINE')));
check(() => assert.strictEqual(executeGovernedMonteCarlo({ plan: correlationPlan, baseInputs, evaluator, metricSelector }).status, GOVERNED_SIMULATION_STATUS.HOLD));
const emptyPlan = plan({ distributions: [], maximumAgeDaysByVariable: {} });
check(() => assert.ok(emptyPlan.blockers.includes('QUALIFIED_DISTRIBUTIONS_REQUIRED')));
const duplicateVariable = distribution({ distributionId: 'DIST-RENT-2' });
const dupPlan = plan({ distributions: [rentDist, duplicateVariable], maximumAgeDaysByVariable: { rent: 30 } });
check(() => assert.ok(dupPlan.blockers.includes('DUPLICATE_DISTRIBUTION_VARIABLE:rent')));
const dupId = distribution({ variableKey: 'cost', min: 900, mode: 1000, max: 1100, unit: 'SAR' });
const dupIdPlan = plan({ distributions: [rentDist, dupId], maximumAgeDaysByVariable: { rent: 30, cost: 30 } });
check(() => assert.ok(dupIdPlan.blockers.includes('DUPLICATE_DISTRIBUTION_ID:DIST-RENT')));
const badDistPlan = plan({ distributions: [tamperedDist], maximumAgeDaysByVariable: { rent: 30 } });
check(() => assert.ok(badDistPlan.blockers.some((b) => b.startsWith('DISTRIBUTION_INTEGRITY_FAILURE'))));
const tamperedPlan = { ...readyPlan, iterations: 2000 };
check(() => assert.strictEqual(verifyMonteCarloGovernancePlan(tamperedPlan).valid, false));
check(() => assert.throws(
  () => executeGovernedMonteCarlo({ plan: tamperedPlan, baseInputs, evaluator, metricSelector }),
  /MONTE_CARLO_PLAN_INTEGRITY_FAILURE/,
));
check(() => assert.throws(
  () => executeGovernedMonteCarlo({ plan: readyPlan, baseInputs: { ...baseInputs, rent: 101 }, evaluator, metricSelector }),
  /MONTE_CARLO_BASE_INPUT_HASH_MISMATCH/,
));
const unknownVariable = distribution({ distributionId: 'DIST-UNKNOWN', variableKey: 'unknown', min: 1, mode: 2, max: 3, unit: 'X' });
const unknownPlan = plan({ distributions: [unknownVariable], maximumAgeDaysByVariable: { unknown: 30 } });
check(() => assert.throws(
  () => executeGovernedMonteCarlo({ plan: unknownPlan, baseInputs, evaluator, metricSelector }),
  /MONTE_CARLO_UNKNOWN_INPUT:unknown/,
));
check(() => assert.throws(() => plan({ iterations: 99 }), /iterations must be integer/));
check(() => assert.throws(() => plan({ seed: -1 }), /seed must be an unsigned/));

const tamperedResult = { ...resultA, mean: resultA.mean + 1 };
check(() => assert.strictEqual(verifyGovernedMonteCarloResult(tamperedResult).valid, false));

console.log(`WAVE_16A_MONTE_CARLO_GOVERNANCE=PASS checks=${checks}`);
