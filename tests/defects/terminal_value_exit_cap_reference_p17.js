'use strict';

const assert = require('assert/strict');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');
const gold = require(require('../config/paths').getGoldBaselinePath());

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite actual, got ${actual}`);
  assert.ok(Number.isFinite(expected), `${label}: expected finite reference, got ${expected}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} within ${tolerance}`);
}

// ---------------------------------------------------------------------------
// Existing building independent reference
// ---------------------------------------------------------------------------
// Synthetic economics chosen so the terminal formula can be recomputed by
// inspection, without borrowing constants from the production engine:
//   Year-0 stabilized NOI = 10,000,000 SAR
//   rent growth = 3%
//   hold = 5 years
//   forward (Year-6) NOI used at sale = 10,000,000 * 1.03^5
//   exit cap = 7%
//   exit transfer-cost input = 5%
//
// Therefore:
//   forward NOI = 11,592,740.743
//   gross terminal value = 165,610,582.04285714
//   net terminal proceeds = 157,330,052.94071427
//   Year-5 NOI = 11,255,088.10
//   final cash flow = 168,585,141.04071426
const buildingBase = {
  ...gold['RE-GOLD-002_existing_building'].inputs,
  netLeasableOverride: 10_000,
  rentPerSqm: 1_000,
  occupancyRate: 1,
  serviceIncomeRate: 0,
  maintenanceRate: 0,
  variableOpexRate: 0,
  managementFeeRate: 0,
  fixedOpexPerSqm: 0,
  replacementReservePerSqm: 0,
  insuranceRate: 0,
  insuranceRateOnReplacementCost: 0,
  opexGrowthRate: 0,
  replacementCostGrowthRate: 0,
  rentGrowthRate: 0.03,
  holdPeriod: 5,
  exitCapRate: 0.07,
  transferFeeRate: 0.05,
  leverageEnabled: false,
};

const building = calcExistingBuilding(buildingBase, { assumptionModelVersion: 'LEGACY' });
close(building.NOI, 10_000_000, 0.01, 'building stabilized year-0 NOI');
close(building.operatingNoiCashflows[4], 11_255_088.10, 0.02, 'building year-5 NOI');
close(building.terminalSaleValue, 165_610_582.04285714, 0.02, 'building terminal gross value');
close(building.terminalNetSaleProceeds, 157_330_052.94071427, 0.02, 'building terminal net proceeds');
close(building.cashflows[5], 168_585_141.04071426, 0.02, 'building final cash flow');
close(building.npv, -1_355_300.7252068305, 0.05, 'building independently recomputed NPV');
assert.equal(building.exitCapSource, 'EXPLICIT');
assert.equal(building.cashflowsIncludeTerminalValue, true);

// This proves the model is using forward Year-(N+1) stabilized NOI rather than
// simply capitalizing Year-N NOI. If Year-5 NOI were used, terminal value would
// be only 160,786,972.85714287 SAR.
assert.ok(
  Math.abs(building.terminalSaleValue - 160_786_972.85714287) > 4_000_000,
  'building terminal value must not silently capitalize current Year-N NOI',
);

// Exit-cap sensitivity must be directionally monotonic, all else equal.
const buildingAt6 = calcExistingBuilding({ ...buildingBase, exitCapRate: 0.06 }, { assumptionModelVersion: 'LEGACY' });
const buildingAt8 = calcExistingBuilding({ ...buildingBase, exitCapRate: 0.08 }, { assumptionModelVersion: 'LEGACY' });
close(buildingAt6.terminalSaleValue, 193_212_345.7166667, 0.02, 'building 6% terminal value');
close(buildingAt8.terminalSaleValue, 144_909_259.2875, 0.02, 'building 8% terminal value');
assert.ok(buildingAt6.terminalSaleValue > building.terminalSaleValue);
assert.ok(building.terminalSaleValue > buildingAt8.terminalSaleValue);
assert.ok(buildingAt6.npv > building.npv && building.npv > buildingAt8.npv,
  'lower exit cap must increase NPV and higher exit cap must reduce NPV');

// ---------------------------------------------------------------------------
// Land/development independent reference
// ---------------------------------------------------------------------------
// Gold geometry produces 6,426 sqm NLA. With 1,000 SAR/sqm rent, no service
// income and zero OPEX, stabilized NOI is exactly 6,426,000 SAR. At 3% growth
// and a 5-year operating hold, the terminal value must capitalize Year-6 NOI.
const landBase = {
  ...gold['RE-GOLD-001_land_development'].inputs,
  marketRentPerSqm: 1_000,
  occupancyRate: 1,
  serviceIncomeRate: 0,
  opexRate: 0,
  variableOpexRate: 0,
  fixedOpexPerSqm: 0,
  managementFeeRate: 0,
  insuranceRateOnReplacementCost: 0,
  replacementReservePerSqm: 0,
  opexGrowthRate: 0,
  replacementCostGrowthRate: 0,
  rentGrowthRate: 0.03,
  operatingPeriod: 5,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};

const land = calcLandDevelopment(landBase);
close(land.stabilizedNOI, 6_426_000, 0.01, 'land stabilized NOI');
close(land.operatingNoiCashflows[4], 7_232_519.61306, 0.02, 'land year-5 NOI');
close(land.terminalExitValue, 106_421_360.02074, 0.02, 'land terminal gross value');
close(land.terminalNetExitValue, 101_100_292.019703, 0.02, 'land terminal net proceeds');
close(land.cashflows[land.cashflows.length - 1], 108_332_811.632763, 0.02, 'land final operating cash flow');

// Explicitly lock the one-time exit-cost waterfall: gross terminal value minus
// exactly one 5% exit transfer-cost input. This does NOT opine that Saudi RETT
// is legally borne by the seller; P17 validates arithmetic only. Regulatory
// incidence remains a separate evidence gate.
close(
  land.terminalNetExitValue,
  land.terminalExitValue * 0.95,
  0.02,
  'land one-time exit-cost deduction',
);

console.log('TERMINAL_VALUE_EXIT_CAP_REFERENCE_P17=PASS');
