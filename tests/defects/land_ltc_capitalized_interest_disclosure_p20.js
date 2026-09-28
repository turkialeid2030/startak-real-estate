'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const financial = require('../../src/engines/financial');
const { FINANCING_RESULT_FIELDS } = require('../../src/contracts/financing-result');
const { CAPITALIZED_INTEREST_TREATMENT } = require('../../src/engines/financing/remediation-wave-b');
const gold = require(require('../config/paths').getGoldBaselinePath());

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite actual, got ${actual}`);
  assert.ok(Number.isFinite(expected), `${label}: expected finite reference, got ${expected}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} within ${tolerance}`);
}

// Independent closed recurrence for a simple construction facility:
// total cost = 24m (12m land + 12m construction), principal LTC = 50%,
// annual rate 12%, one-year construction. Debt draws are therefore 6m at
// land acquisition plus 0.5m at the beginning of each construction month.
// Monthly recurrence: B_m = (B_(m-1) + 500,000) * 1.01.
// Hand/closed-form reference after 12 months = 13,165,614.202456292 SAR.
const primitive = financial.simulateConstructionFacility({
  landCost: 12_000_000,
  constructionCost: 12_000_000,
  debtFraction: 0.5,
  annualRate: 0.12,
  constructionYears: 1,
});
close(primitive.principalDebtDraws, 12_000_000, 0.01, 'principal debt draws');
close(primitive.completionBalance, 13_165_614.202456292, 0.05, 'completion balance');
close(primitive.capitalizedInterest, 1_165_614.202456292, 0.05, 'capitalized construction interest');
close(primitive.principalDebtDraws / 24_000_000, 0.5, 1e-12, 'principal LTC');
close(primitive.completionBalance / 24_000_000, 0.5485672584356788, 1e-9, 'effective completion debt-to-cost');
assert.ok(primitive.completionBalance / 24_000_000 > primitive.principalDebtDraws / 24_000_000,
  'capitalized interest must make all-in completion debt ratio exceed principal LTC when rate is positive');

// Production-path disclosure: preserve the current financing mathematics while
// making the convention machine-readable. Use strong NOI so this assertion is
// about LTC/capitalized-interest semantics rather than a DSCR binding edge.
const inputs = {
  ...gold['RE-GOLD-001_land_development'].inputs,
  leverageEnabled: true,
  marketRentPerSqm: 10_000,
};
const result = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs,
  leverageEnabled: true,
});

assert.equal(result.financingRatioBasis, 'TOTAL_PROJECT_COST');
assert.equal(result.capitalizedInterestTreatment,
  CAPITALIZED_INTEREST_TREATMENT.EXCLUDED_FROM_PRINCIPAL_LTC_CAP);
close(result.principalLtc, result.loanAmount / result.totalProjectCost, 1e-12, 'disclosed principal LTC identity');
close(result.principalLtc, result.actualDebtToBasisRatio, 1e-12, 'P16/P20 ratio identity');
close(result.effectiveCompletionDebtToCost,
  result.constructionLoanBalance / result.totalProjectCost,
  1e-12,
  'effective completion debt ratio identity');
close(result.constructionLoanBalance,
  result.loanAmount + result.capitalizedConstructionInterest,
  0.05,
  'completion debt equals principal draws plus capitalized interest');
assert.ok(result.principalLtc <= inputs.ltv + 1e-12,
  `principal LTC must not exceed requested principal cap; got ${result.principalLtc}`);
assert.ok(result.capitalizedConstructionInterest > 0,
  'positive-rate construction financing must disclose positive capitalized interest');
assert.ok(result.effectiveCompletionDebtToCost > result.principalLtc,
  'effective completion debt-to-cost must exceed principal LTC when interest is capitalized');
assert.equal(
  result.allInCompletionDebtExceedsPrincipalLtcCap,
  result.constructionLoanBalance > result.requestedDebtLimitSar,
  'boolean disclosure must match the stated requested principal limit',
);

for (const field of [
  'principalLtc',
  'effectiveCompletionDebtToCost',
  'capitalizedInterestTreatment',
  'allInCompletionDebtExceedsPrincipalLtcCap',
]) {
  assert.ok(Object.prototype.hasOwnProperty.call(FINANCING_RESULT_FIELDS, field),
    `${field} must be declared in the canonical financing-result contract`);
}

console.log('LAND_LTC_CAPITALIZED_INTEREST_DISCLOSURE_P20=PASS');
