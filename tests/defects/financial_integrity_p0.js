'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');
const {
  ASSUMPTION_GATE_STATUS,
  CONFIDENCE,
  evaluateAssumptionRegistry,
} = require('../../src/assumptions/assumption-registry');

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Number.isFinite(actual), `expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);
}

const noi = financial.normalizedNoiWaterfall({
  potentialBaseRentSar: 10_000_000,
  vacancyLossSar: 600_000,
  collectionLossSar: 200_000,
  otherOperatingIncomeSar: 300_000,
  nonRecoverableOperatingExpensesSar: 2_000_000,
});
assert.equal(noi.gpiSar, 10_000_000);
assert.equal(noi.egiSar, 9_500_000);
assert.equal(noi.noiSar, 7_500_000);
close(financial.directCapitalizationValue(noi.noiSar, 0.075), 100_000_000, 0.01);
close(financial.marketCapRate(7_500_000, 100_000_000), 0.075);

const withoutRecovery = financial.normalizedNoiWaterfall({
  potentialBaseRentSar: 10_000_000,
  vacancyLossSar: 500_000,
  nonRecoverableOperatingExpensesSar: 1_500_000,
});
const withMatchedRecovery = financial.normalizedNoiWaterfall({
  potentialBaseRentSar: 10_000_000,
  vacancyLossSar: 500_000,
  serviceChargeRecoveriesSar: 1_200_000,
  recoverableOperatingExpensesSar: 1_200_000,
  nonRecoverableOperatingExpensesSar: 1_500_000,
});
assert.equal(withMatchedRecovery.noiSar, withoutRecovery.noiSar);
assert.equal(withMatchedRecovery.netServiceChargeContributionSar, 0);

close(financial.yieldOnCost(12_000_000, 100_000_000), 0.12);
close(financial.marketCapRate(12_000_000, 150_000_000), 0.08);
assert.equal(financial.FORMULAS.YIELD_ON_COST.notEquivalentTo, 'MARKET_CAP_RATE');

close(financial.dscr(10_000_000, 8_000_000), 1.25);
close(financial.ltv(60_000_000, 100_000_000), 0.60);
close(financial.ltc(60_000_000, 120_000_000), 0.50);
close(financial.debtYield(9_000_000, 60_000_000), 0.15);
close(financial.breakEvenOccupancy({
  operatingExpensesSar: 2_000_000,
  debtServiceSar: 5_000_000,
  otherIncomeSar: 1_000_000,
  grossPotentialRentSar: 10_000_000,
}), 0.60);

// Canonical date-aware returns use ACT/365.2425, not ACT/365.
const datedCashflows = [
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 110 },
];
const expectedXirr = Math.pow(1.10, 365.2425 / 365) - 1;
close(financial.xirr(datedCashflows), expectedXirr, 1e-9);
close(financial.xnpv(expectedXirr, datedCashflows), 0, 1e-8);

const leapFlows = [
  { date: '2028-01-01', amount: -1000 },
  { date: '2029-01-01', amount: 1100 },
];
const expectedLeapXnpv = -1000 + 1100 / Math.pow(1.10, 366 / 365.2425);
const obsoleteAct365 = -1000 + 1100 / Math.pow(1.10, 366 / 365);
close(financial.xnpv(0.10, leapFlows), expectedLeapXnpv, 1e-10);
assert.ok(Math.abs(financial.xnpv(0.10, leapFlows) - obsoleteAct365) > 1e-4);

assert.throws(() => financial.xnpv(0.10, [
  { date: '2026-02-30', amount: -100 },
  { date: '2027-01-01', amount: 110 },
]), /real calendar date/);
assert.equal(financial.xirr([
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 230 },
  { date: '2028-01-01', amount: -132 },
]), null);

const unsupported = evaluateAssumptionRegistry([{
  id: 'EXIT_CAP_RATE', value: 0.08, unit: 'ratio', critical: true,
  confidence: CONFIDENCE.UNSUPPORTED, owner: 'Investment',
}], { asOf: '2026-09-25' });
assert.equal(unsupported.status, ASSUMPTION_GATE_STATUS.HOLD);
assert.ok(unsupported.blockers.some((item) => item.startsWith('CRITICAL_ASSUMPTION_UNSUPPORTED:EXIT_CAP_RATE')));

const stale = evaluateAssumptionRegistry([{
  id: 'MARKET_RENT', value: 1800, unit: 'SAR/sqm/year', critical: true,
  sourceType: 'VERIFIED_COMPARABLES', sourceReference: 'market-evidence-001', sourceDate: '2026-01-15',
  expiresAt: '2026-06-30', geography: 'Riyadh', assetType: 'OFFICE', evidenceCount: 6,
  confidence: CONFIDENCE.MEDIUM, owner: 'Investment', reviewer: 'Risk',
}], { asOf: '2026-09-25' });
assert.equal(stale.status, ASSUMPTION_GATE_STATUS.HOLD);
assert.ok(stale.blockers.includes('CRITICAL_ASSUMPTION_STALE:MARKET_RENT'));

const supported = evaluateAssumptionRegistry([{
  id: 'MARKET_RENT', value: 1800, unit: 'SAR/sqm/year', critical: true,
  sourceType: 'VERIFIED_COMPARABLES', sourceReference: 'market-evidence-002', sourceDate: '2026-09-01',
  expiresAt: '2026-12-31', geography: 'Riyadh', assetType: 'OFFICE', evidenceCount: 6,
  confidence: CONFIDENCE.HIGH, owner: 'Investment', reviewer: 'Risk',
}], { asOf: '2026-09-25' });
assert.equal(supported.status, ASSUMPTION_GATE_STATUS.PASS);
assert.equal(supported.blockers.length, 0);

const suspicious = financial.normalizedNoiWaterfall({ potentialBaseRentSar: 1_000_000 });
assert.ok(suspicious.warnings.includes('ZERO_ECONOMIC_VACANCY_OR_CREDIT_LOSS_REQUIRES_EVIDENCE'));
assert.ok(suspicious.warnings.includes('ZERO_OPEX_REQUIRES_EVIDENCE'));

console.log('FINANCIAL_INTEGRITY_P0=PASS');
