'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  getDecisionMetricLabelOverride,
} = require('../../src/i18n/decision-metric-semantics');
const gold = require(require('../config/paths').getGoldBaselinePath());

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite actual, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} within ${tolerance}`);
}

// Reproduce the financing-basis finding from the 27 Sep review: a 140m SAR
// purchase plus 2.5% commission, 5% transfer fee, and 135k inspection/valuation
// gives 150.635m total acquisition cost. The entered 50% ratio has historically
// been applied to that TOTAL cost, yielding a 75.3175m requested debt limit.
const base = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = {
  ...base,
  leverageEnabled: true,
  ltv: 0.50,
  exitCapRate: 0.08,
};

const result = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs,
  leverageEnabled: true,
});

close(result.totalPurchaseCost, 150_635_000, 0.01, 'total acquisition cost');
assert.equal(result.financingRatioBasis, 'TOTAL_ACQUISITION_COST');
close(result.financingRatioDenominatorSar, 150_635_000, 0.01, 'financing ratio denominator');
close(result.requestedDebtRatio, 0.50, 1e-12, 'requested debt ratio');
close(result.requestedDebtLimitSar, 75_317_500, 0.01, 'requested debt limit');
close(result.ltvLoanLimit, 75_317_500, 0.01, 'legacy limit field preserved numerically');
close(result.loanAmount, 75_317_500, 0.01, 'actual debt amount when cost constraint binds');
close(result.actualDebtToBasisRatio, 0.50, 1e-12, 'actual debt / acquisition cost');
close(result.actualDebtToBasePurchasePriceRatio, 75_317_500 / 140_000_000, 1e-12, 'actual debt / raw purchase price');
assert.equal(result.legacyLoanSizingConstraint, 'LTV');
assert.equal(result.loanSizingConstraint, 'LTC');
assert.ok(result.actualDebtToBasePurchasePriceRatio > result.actualDebtToBasisRatio,
  'purchase-price ratio must be visibly different from acquisition-cost ratio');

// Decision-critical presentation must name the actual denominator and actual
// constrained debt rather than call the input a generic LTV.
assert.equal(
  getDecisionMetricLabelOverride('ar-SA', 'financingInput.ltvLabelBuilding'),
  'نسبة التمويل المطلوبة إلى إجمالي تكلفة الاستحواذ (LTC)',
);
assert.match(
  getDecisionMetricLabelOverride('ar-SA', 'financingInput.ltvWarnBuilding'),
  /إجمالي تكلفة الاستحواذ/,
);
assert.equal(
  getDecisionMetricLabelOverride('ar-SA', 'metricRowR2B3.loanAmountBuilding'),
  'مبلغ التمويل الفعلي بعد قيود التكلفة وتغطية خدمة الدين',
);
assert.equal(
  getDecisionMetricLabelOverride('en', 'financingInput.ltvLabelBuilding'),
  'Requested Loan-to-Total-Acquisition-Cost Ratio (LTC)',
);

console.log('FINANCING_ACQUISITION_COST_BASIS_P16=PASS');
