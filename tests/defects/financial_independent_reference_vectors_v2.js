'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');
const { evaluateHighestAndBestUse, HBU_STATUS } = require('../../src/valuation-intelligence');

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${actual} ≈ ${expected} within ${tolerance}`);
}

// 1) Income capitalization reference vector.
const waterfall = financial.normalizedNoiWaterfall({
  potentialBaseRentSar: 10_000_000,
  vacancyLossSar: 600_000,
  collectionLossSar: 200_000,
  otherOperatingIncomeSar: 300_000,
  nonRecoverableOperatingExpensesSar: 2_000_000,
});
assert.equal(waterfall.noiSar, 7_500_000);
close(financial.directCapitalizationValue(waterfall.noiSar, 0.075), 100_000_000, 0.01, 'direct capitalization');
close(financial.marketCapRate(7_500_000, 100_000_000), 0.075, 1e-12, 'cap rate');

// 2) ACT/365.2425 leap-year XNPV closed-form reference.
const leapFlows = [
  { date: '2028-01-01', amount: -1000 },
  { date: '2029-01-01', amount: 1100 },
];
close(financial.xnpv(0.10, leapFlows), -0.19765039949697893, 1e-10, 'leap XNPV');

// 3) ACT/365.2425 365-day XIRR closed-form reference.
const oneYearFlows = [
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 110 },
];
close(financial.xirr(oneYearFlows), 0.10006965697379555, 1e-9, '365-day XIRR');

// 4) Standard amortizing loan reference: P=10m, 6% nominal, 20 years, monthly.
const debt = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 20, { gracePeriodMonths: 0, balloonPct: 0 });
assert.equal(debt.tenorMonths, 240);
close(debt.scheduledMonthlyPayment, 71_643.11, 0.01, 'monthly debt payment');
assert.equal(debt.schedule.length, 240);
close(debt.schedule[debt.schedule.length - 1].balance, 0, 0.01, 'final debt balance');
close(debt.totalPayments, 17_194_345.2, 10.0, 'total debt payments');

// 5) HBU residual land value reference.
const hbu = evaluateHighestAndBestUse({
  alternatives: [{
    id: 'REFERENCE_RESIDENTIAL',
    legallyPermissible: true,
    physicallyPossible: true,
    grossDevelopmentValueSar: 100_000_000,
    hardCostsSar: 48_000_000,
    softCostsSar: 7_000_000,
    financeCostsSar: 4_000_000,
    contingencySar: 3_000_000,
    sellingCostsSar: 2_000_000,
  }],
  landAreaSqm: 10_000,
  requiredDeveloperMarginRate: 0.20,
  acquisitionCostsRate: 0.05,
  evidenceComplete: true,
});
assert.notEqual(hbu.status, HBU_STATUS.HOLD);
close(hbu.selected.residualBeforeAcquisitionSar, 16_000_000, 0.01, 'HBU residual before acquisition');
close(hbu.selected.maximumLandBidSar, 15_238_095.238095237, 0.01, 'maximum land bid');
close(hbu.selected.bidPerSqmSar, 1_523.8095238095236, 1e-6, 'maximum land bid per sqm');
assert.equal(hbu.transactionAuthorized, false);

// 6) Fail-closed date and multiple-IRR vectors.
assert.throws(() => financial.xnpv(0.10, [
  { date: '2026-02-30', amount: -100 },
  { date: '2027-01-01', amount: 110 },
]), /real calendar date/);
assert.equal(financial.xirr([
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 230 },
  { date: '2028-01-01', amount: -132 },
]), null);

console.log('financial_independent_reference_vectors_v2: PASS');
