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

// Golden arithmetic: GPI 10.0m - 0.8m vacancy/credit loss + 0.3m other income - 2.0m OPEX = NOI 7.5m.
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

// Service-charge recoveries must not inflate NOI when they merely reimburse matched recoverable OPEX.
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

// YOC is deliberately distinct from market cap rate.
close(financial.yieldOnCost(12_000_000, 100_000_000), 0.12);
close(financial.marketCapRate(12_000_000, 150_000_000), 0.08);
assert.equal(financial.FORMULAS.YIELD_ON_COST.notEquivalentTo, 'MARKET_CAP_RATE');

// Financing metrics use explicit denominators; no universal 1.25x covenant is embedded.
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

// Date-aware returns: -100 today and +110 exactly one 365-day year later = 10% XIRR.
const datedCashflows = [
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 110 },
];
close(financial.xnpv(0.10, datedCashflows), 0, 1e-8);
close(financial.xirr(datedCashflows), 0.10, 1e-7);

// Critical assumptions are fail-closed when unsupported or stale.
const unsupported = evaluateAssumptionRegistry([{
  id: 'EXIT_CAP_RATE',
  value: 0.08,
  unit: 'ratio',
  critical: true,
  confidence: CONFIDENCE.UNSUPPORTED,
  owner: 'Investment',
}], { asOf: '2026-09-25' });
assert.equal(unsupported.status, ASSUMPTION_GATE_STATUS.HOLD);
assert.ok(unsupported.blockers.some((item) => item.startsWith('CRITICAL_ASSUMPTION_UNSUPPORTED:EXIT_CAP_RATE')));

const stale = evaluateAssumptionRegistry([{
  id: 'MARKET_RENT',
  value: 1800,
  unit: 'SAR/sqm/year',
  critical: true,
  sourceType: 'VERIFIED_COMPARABLES',
  sourceReference: 'market-evidence-001',
  sourceDate: '2026-01-15',
  expiresAt: '2026-06-30',
  geography: 'Riyadh',
  assetType: 'OFFICE',
  evidenceCount: 6,
  confidence: CONFIDENCE.MEDIUM,
  owner: 'Investment',
  reviewer: 'Risk',
}], { asOf: '2026-09-25' });
assert.equal(stale.status, ASSUMPTION_GATE_STATUS.HOLD);
assert.ok(stale.blockers.includes('CRITICAL_ASSUMPTION_STALE:MARKET_RENT'));

const supported = evaluateAssumptionRegistry([{
  id: 'MARKET_RENT',
  value: 1800,
  unit: 'SAR/sqm/year',
  critical: true,
  sourceType: 'VERIFIED_COMPARABLES',
  sourceReference: 'market-evidence-002',
  sourceDate: '2026-09-01',
  expiresAt: '2026-12-31',
  geography: 'Riyadh',
  assetType: 'OFFICE',
  evidenceCount: 6,
  confidence: CONFIDENCE.HIGH,
  owner: 'Investment',
  reviewer: 'Risk',
}], { asOf: '2026-09-25' });
assert.equal(supported.status, ASSUMPTION_GATE_STATUS.PASS);
assert.equal(supported.blockers.length, 0);

// Known model-risk warnings are visible instead of silently accepted.
const suspicious = financial.normalizedNoiWaterfall({ potentialBaseRentSar: 1_000_000 });
assert.ok(suspicious.warnings.includes('ZERO_ECONOMIC_VACANCY_OR_CREDIT_LOSS_REQUIRES_EVIDENCE'));
assert.ok(suspicious.warnings.includes('ZERO_OPEX_REQUIRES_EVIDENCE'));

console.log('FINANCIAL_INTEGRITY_P0=PASS');
