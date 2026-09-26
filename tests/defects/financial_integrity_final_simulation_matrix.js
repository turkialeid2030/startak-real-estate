'use strict';

const assert = require('assert');
const {
  runDeterministicStressTest,
  STRESS_STATUS,
  runGovernedMonteCarlo,
  MONTE_CARLO_STATUS,
  evaluateHighestAndBestUse,
  HBU_STATUS,
  evaluatePortfolioDecision,
  PORTFOLIO_STATUS,
  solveDatedXirr,
  DATED_RETURNS_STATUS,
} = require('../../src/valuation-intelligence');

let simulatedCases = 0;

// A) Deterministic property stress: optimistic -> base -> adverse ordering.
const stressBase = {
  noiSar: 800_000,
  valueSar: 10_000_000,
  effectiveRevenueSar: 1_120_000,
  opexSar: 320_000,
  annualDebtServiceSar: 500_000,
  capRate: 0.08,
};
const stress = runDeterministicStressTest({
  base: stressBase,
  scenarios: [
    { id: 'OPTIMISTIC', rentShock: 0.05, occupancyShock: 0.02, opexShock: -0.05, capRateShock: -0.005, debtServiceShock: -0.05 },
    { id: 'BASE', rentShock: 0, occupancyShock: 0, opexShock: 0, capRateShock: 0, debtServiceShock: 0 },
    { id: 'ADVERSE', rentShock: -0.15, occupancyShock: -0.10, opexShock: 0.15, capRateShock: 0.015, debtServiceShock: 0.10 },
  ],
  thresholds: { maxValueDecline: 0.25, minDscr: 1.25 },
});
simulatedCases += 3;
assert.notStrictEqual(stress.status, STRESS_STATUS.HOLD);
const byId = Object.fromEntries(stress.results.map(r => [r.id, r]));
assert.ok(byId.OPTIMISTIC.stressedNoiSar > byId.BASE.stressedNoiSar);
assert.ok(byId.BASE.stressedNoiSar > byId.ADVERSE.stressedNoiSar);
assert.ok(byId.OPTIMISTIC.stressedValueSar > byId.BASE.stressedValueSar);
assert.ok(byId.BASE.stressedValueSar > byId.ADVERSE.stressedValueSar);
assert.ok(byId.OPTIMISTIC.dscr > byId.BASE.dscr);
assert.ok(byId.BASE.dscr > byId.ADVERSE.dscr);

// B) HBU sensitivity grid: maximum land bid must decrease as developer margin or acquisition load increases.
const hbuAlternative = {
  id: 'RESIDENTIAL',
  legallyPermissible: true,
  physicallyPossible: true,
  grossDevelopmentValueSar: 100_000_000,
  hardCostsSar: 48_000_000,
  softCostsSar: 7_000_000,
  financeCostsSar: 4_000_000,
  contingencySar: 3_000_000,
  sellingCostsSar: 2_000_000,
};
let previousByMargin = null;
for (const margin of [0.15, 0.20, 0.25, 0.30]) {
  let previousByAcquisition = null;
  for (const acquisitionCostsRate of [0, 0.025, 0.05, 0.075, 0.10]) {
    const result = evaluateHighestAndBestUse({
      alternatives: [hbuAlternative],
      landAreaSqm: 10_000,
      requiredDeveloperMarginRate: margin,
      acquisitionCostsRate,
      evidenceComplete: true,
    });
    simulatedCases += 1;
    assert.notStrictEqual(result.status, HBU_STATUS.HOLD);
    assert.ok(result.selected && result.selected.maximumLandBidSar > 0);
    if (previousByAcquisition !== null) assert.ok(result.selected.maximumLandBidSar < previousByAcquisition);
    previousByAcquisition = result.selected.maximumLandBidSar;
    if (acquisitionCostsRate === 0) {
      if (previousByMargin !== null) assert.ok(result.selected.maximumLandBidSar < previousByMargin);
      previousByMargin = result.selected.maximumLandBidSar;
    }
  }
}

// C) Portfolio concentration grid: concentration warnings must appear at the governed boundary.
const limits = { maxSingleAssetWeight: 0.50, maxCityWeight: 0.60, maxAssetTypeWeight: 0.70, minPortfolioDscr: 1.25 };
for (const dominantWeight of [0.34, 0.40, 0.49, 0.51, 0.60, 0.70]) {
  const remainder = (1 - dominantWeight) / 2;
  const scale = 100_000_000;
  const assets = [
    { id: 'A', city: 'Riyadh', assetType: 'Office', valueSar: dominantWeight * scale, noiSar: dominantWeight * 8_000_000, annualDebtServiceSar: dominantWeight * 5_000_000 },
    { id: 'B', city: 'Jeddah', assetType: 'Residential', valueSar: remainder * scale, noiSar: remainder * 8_000_000, annualDebtServiceSar: remainder * 5_000_000 },
    { id: 'C', city: 'Dammam', assetType: 'Industrial', valueSar: remainder * scale, noiSar: remainder * 8_000_000, annualDebtServiceSar: remainder * 5_000_000 },
  ];
  const result = evaluatePortfolioDecision({ assets, limits });
  simulatedCases += 1;
  assert.notStrictEqual(result.status, PORTFOLIO_STATUS.HOLD);
  assert.ok(result.metrics.portfolioDscr >= 1.25);
  if (dominantWeight <= 0.50) {
    assert.ok(!result.warnings.includes('SINGLE_ASSET_CONCENTRATION_BREACH'));
  } else {
    assert.ok(result.warnings.includes('SINGLE_ASSET_CONCENTRATION_BREACH'));
    assert.strictEqual(result.status, PORTFOLIO_STATUS.REVIEW_REQUIRED);
  }
  assert.strictEqual(result.transactionAuthorized, false);
}

// D) Seeded Monte Carlo comparison: adverse assumptions must reduce the distribution of value/return diagnostics.
const commonMonteCarlo = {
  seed: 2030,
  iterations: 1000,
  base: { initialInvestmentSar: 10_000_000, baseNoiSar: 800_000, horizonYears: 5, annualDebtServiceSar: 500_000 },
  thresholds: { hurdleIrr: 0.08, minDscr: 1.25, maxProbabilityNpvNegative: 0.50, maxProbabilityIrrBelowHurdle: 0.75, maxProbabilityDscrBreach: 0.50 },
};
const mcBase = runGovernedMonteCarlo({
  ...commonMonteCarlo,
  distributions: {
    noiGrowth: { type: 'triangular', min: 0.01, mode: 0.03, max: 0.05 },
    exitCapRate: { type: 'triangular', min: 0.07, mode: 0.08, max: 0.09 },
    discountRate: { type: 'triangular', min: 0.08, mode: 0.10, max: 0.12 },
  },
});
const mcBaseRepeat = runGovernedMonteCarlo({
  ...commonMonteCarlo,
  distributions: {
    noiGrowth: { type: 'triangular', min: 0.01, mode: 0.03, max: 0.05 },
    exitCapRate: { type: 'triangular', min: 0.07, mode: 0.08, max: 0.09 },
    discountRate: { type: 'triangular', min: 0.08, mode: 0.10, max: 0.12 },
  },
});
const mcAdverse = runGovernedMonteCarlo({
  ...commonMonteCarlo,
  distributions: {
    noiGrowth: { type: 'triangular', min: -0.04, mode: -0.02, max: 0 },
    exitCapRate: { type: 'triangular', min: 0.09, mode: 0.10, max: 0.12 },
    discountRate: { type: 'triangular', min: 0.11, mode: 0.13, max: 0.16 },
  },
});
simulatedCases += 3000;
assert.notStrictEqual(mcBase.status, MONTE_CARLO_STATUS.HOLD);
assert.notStrictEqual(mcAdverse.status, MONTE_CARLO_STATUS.HOLD);
assert.deepStrictEqual(mcBase.summary, mcBaseRepeat.summary);
assert.ok(mcBase.summary.npvSar.p50 > mcAdverse.summary.npvSar.p50);
assert.ok(mcBase.summary.irr.p50 > mcAdverse.summary.irr.p50);
assert.ok(mcBase.summary.dscr.p50 > mcAdverse.summary.dscr.p50);
assert.ok(mcBase.summary.npvSar.probabilityNegative <= mcAdverse.summary.npvSar.probabilityNegative);

// E) Dated-return terminal-value sensitivity: XIRR must increase monotonically with exit proceeds.
let previousXirr = null;
for (let terminal = 9_000_000; terminal <= 21_000_000; terminal += 500_000) {
  const result = solveDatedXirr({
    cashflows: [
      { date: '2026-01-01', amount: -10_000_000 },
      { date: '2027-01-01', amount: 650_000 },
      { date: '2028-01-01', amount: 680_000 },
      { date: '2029-01-01', amount: 710_000 },
      { date: '2030-01-01', amount: 740_000 },
      { date: '2031-01-01', amount: 770_000 + terminal },
    ],
  });
  simulatedCases += 1;
  assert.strictEqual(result.status, DATED_RETURNS_STATUS.QUALIFIED);
  if (previousXirr !== null) assert.ok(result.xirr > previousXirr);
  previousXirr = result.xirr;
  assert.strictEqual(result.transactionAuthorized, false);
  assert.strictEqual(result.humanDecisionRequired, true);
}

// F) Fail-closed integration controls.
assert.strictEqual(runDeterministicStressTest({}).status, STRESS_STATUS.HOLD);
assert.strictEqual(evaluateHighestAndBestUse({}).status, HBU_STATUS.HOLD);
assert.strictEqual(evaluatePortfolioDecision({}).status, PORTFOLIO_STATUS.HOLD);
assert.strictEqual(runGovernedMonteCarlo({}).status, MONTE_CARLO_STATUS.HOLD);
assert.strictEqual(solveDatedXirr({}).status, DATED_RETURNS_STATUS.HOLD);
simulatedCases += 5;

assert.ok(simulatedCases >= 3050);
console.log(`financial_integrity_final_simulation_matrix: PASS simulatedCases=${simulatedCases}`);
