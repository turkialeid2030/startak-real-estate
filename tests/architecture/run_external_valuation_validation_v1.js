'use strict';

const assert = require('assert');
const {
  COMPARATOR_TYPE,
  EXTERNAL_VALUATION_VALIDATION_STATUS: STATUS,
  evaluateExternalValuationValidation,
} = require('../../src/validation/external-valuation-validation');

function policy() {
  return {
    minObservations: 3,
    maxDateGapDays: 60,
    maxMedianAbsolutePercentageError: 0.1,
    maxAbsoluteMedianSignedPercentageError: 0.05,
  };
}

function observation(overrides = {}) {
  return {
    caseId: 'CASE-VAL-1',
    projectId: 'PROJECT-VAL-1',
    startakValue: 10_200_000,
    comparatorValue: 10_000_000,
    comparatorType: COMPARATOR_TYPE.INDEPENDENT_APPRAISAL,
    currency: 'SAR',
    basis: 'MARKET_VALUE',
    startakCurrency: 'SAR',
    comparatorCurrency: 'SAR',
    startakBasis: 'MARKET_VALUE',
    comparatorBasis: 'MARKET_VALUE',
    startakAsOf: '2026-08-15T00:00:00Z',
    comparatorAsOf: '2026-08-20T00:00:00Z',
    startakEvidenceRef: 'evidence://startak/valuation/1',
    comparatorEvidenceRef: 'evidence://external/appraisal/1',
    reviewerRef: 'reviewer://valuation/1',
    ...overrides,
  };
}

function sample() {
  return [
    observation(),
    observation({ caseId: 'CASE-VAL-2', projectId: 'PROJECT-VAL-2', startakValue: 9_600_000, comparatorValue: 10_000_000, comparatorType: COMPARATOR_TYPE.ACTUAL_TRANSACTION, comparatorEvidenceRef: 'evidence://transaction/2' }),
    observation({ caseId: 'CASE-VAL-3', projectId: 'PROJECT-VAL-3', startakValue: 10_500_000, comparatorValue: 10_000_000, comparatorEvidenceRef: 'evidence://external/appraisal/3' }),
  ];
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('comparison sample passes caller policy without certification claims', () => {
  const result = evaluateExternalValuationValidation({ observations: sample(), policy: policy() });
  assert.strictEqual(result.status, STATUS.VALIDATED_WITHIN_POLICY);
  assert.strictEqual(result.validationPolicyPassed, true);
  assert.strictEqual(result.metrics.observationCount, 3);
  assert.strictEqual(result.certifiedValuationEstablished, false);
  assert.strictEqual(result.productionDecisionAuthorized, false);
  assert.strictEqual(result.statisticalConfidenceEstablished, false);
  assert.strictEqual(result.humanReviewRequired, true);
});

check('policy thresholds are never invented', () => {
  const result = evaluateExternalValuationValidation({ observations: sample(), policy: null });
  assert.strictEqual(result.status, STATUS.UNRATED_POLICY_REQUIRED);
});

check('missing independent evidence fails closed', () => {
  const observations = sample();
  observations[0] = { ...observations[0], comparatorEvidenceRef: '' };
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: policy() }).status, STATUS.HOLD_EVIDENCE);
});

check('basis mismatch fails comparability', () => {
  const observations = sample();
  observations[0] = { ...observations[0], comparatorBasis: 'INVESTMENT_VALUE' };
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: policy() }).status, STATUS.HOLD_COMPARABILITY);
});

check('currency mismatch fails comparability', () => {
  const observations = sample();
  observations[1] = { ...observations[1], comparatorCurrency: 'USD' };
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: policy() }).status, STATUS.HOLD_COMPARABILITY);
});

check('date gap exceeding caller policy fails comparability', () => {
  const observations = sample();
  observations[2] = { ...observations[2], comparatorAsOf: '2025-01-01T00:00:00Z' };
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: policy() }).status, STATUS.HOLD_COMPARABILITY);
});

check('minimum sample size is caller governed', () => {
  const p = policy();
  p.minObservations = 5;
  assert.strictEqual(evaluateExternalValuationValidation({ observations: sample(), policy: p }).status, STATUS.HOLD_MIN_SAMPLE);
});

check('excess median absolute error fails caller threshold', () => {
  const observations = [
    observation({ startakValue: 12_000_000 }),
    observation({ caseId: 'CASE-2', projectId: 'PROJECT-2', startakValue: 12_500_000 }),
    observation({ caseId: 'CASE-3', projectId: 'PROJECT-3', startakValue: 13_000_000 }),
  ];
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: policy() }).status, STATUS.HOLD_THRESHOLD);
});

check('systematic signed bias can fail even when sample exists', () => {
  const p = policy();
  p.maxMedianAbsolutePercentageError = 0.2;
  p.maxAbsoluteMedianSignedPercentageError = 0.01;
  const observations = [
    observation({ startakValue: 10_300_000 }),
    observation({ caseId: 'CASE-2', projectId: 'PROJECT-2', startakValue: 10_400_000 }),
    observation({ caseId: 'CASE-3', projectId: 'PROJECT-3', startakValue: 10_500_000 }),
  ];
  assert.strictEqual(evaluateExternalValuationValidation({ observations, policy: p }).status, STATUS.HOLD_THRESHOLD);
});

console.log(`EXTERNAL_VALUATION_VALIDATION_V1=PASS checks=${checks}`);
