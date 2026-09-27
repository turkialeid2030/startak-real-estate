'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');
const {
  evaluateHighestAndBestUse,
  HBU_STATUS,
} = require('../../src/valuation-intelligence');

function close(actual, expected, tolerance) {
  assert.ok(Number.isFinite(actual), `expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected} within ${tolerance}`);
}

// Independent reference vector 1: income capitalization.
// NOI = 10.0m - 0.8m losses + 0.3m other income - 2.0m OPEX = 7.5m.
const waterfall = financial.normalizedNoiWaterfall({
  potentialBaseRentSar: 10_000_000,
  vacancyLossSar: 600_000,
  collectionLossSar: 200_000,
  otherOperatingIncomeSar: 300_000,
  nonRecoverableOperatingExpensesSar: 2_000_000,
});
assert.equal(waterfall.noiSar, 7_500_000);
close(financial.directCapitalizationValue(waterfall.noiSar, 0.075), 100_000_000, 0.01);
close(financial.marketCapRate(7_500_000, 100_000_000), 0.075, 1e-12);

// Independent reference vector 2: ACT/365.2425 leap-year XNPV.
// Closed-form external calculation: -1000 + 1100 / 1.1^(366/365.2425).
const leapFlows = [
  { date: '2028-01-01', amount: -1000 },
  { date: '2029-01-01', amount: 1100 },
];
close(financial.xnpv(0.10, leapFlows), -0.19765039949697893, 1e-10);

// Independent reference vector 3: one 365-day interval under ACT/365.2425.
// XIRR = 1.1^(365.2425/365) - 1.
const oneYearFlows = [
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 110 },
];
close(financial.xirr(oneYearFlows), 0.10006965697379555, 1e-8);

// Independent reference vector 4: standard monthly amortizing loan.
// PMT = P*r/(1-(1+r)^-n), P=10m, r=6%/12, n=240.
const debt = financial.buildMonthlyDebtPlan(10_000_000, 0.06, 20, {
  gracePeriodMonths: 0,
  balloonPct: 0,
});
assert.equal(debt.tenorMonths, 240);
close(debt.scheduledMonthlyPayment, 71_643.11, 0.01);
assert.equal(debt.schedule.length, 240);
close(debt.schedule[debt.schedule.length - 1].balance, 0, 0.01);
close(debt.totalPayments, 17_194_345.2, 5.0);

// Independent reference vector 5: HBU residual land value.
// GDV 100m - non-land cost 64m - developer margin 20m = 16m residual.
// 5% acquisition load on land price => maximum bid = 16m/1.05.
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
close(hbu.selected.residualBeforeAcquisitionSar, 16_000_000, 0.01);
close(hbu.selected.maximumLandBidSar, 15_238_095.238095237, 0.01);
close(hbu.selected.bidPerSqmSar, 1_523.8095238095236, 1e-6);
assert.equal(hbu.transactionAuthorized, false);

// Independent fail-closed vectors.
assert.throws(() => financial.xnpv(0.10, [
  { date: '2026-02-30', amount: -100 },
  { date: '2027-01-01', amount: 110 },
]), /real calendar date/);
assert.equal(financial.xirr([
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 230 },
  { date: '2028-01-01', amount: -132 },
]), null);

console.log('financial_independent_reference_vectors: PASS');
