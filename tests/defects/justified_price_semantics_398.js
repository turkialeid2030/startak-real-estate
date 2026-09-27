'use strict';

const assert = require('assert');
const {
  calculateInvestmentCase,
  STUDY_TYPE,
  PRICE_BASIS_VERSION,
} = require('../../src/engines');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const { calcLandDevelopment } = require('../../src/engines/valuation/land-development');
const {
  getDecisionMetricLabelOverride,
} = require('../../src/i18n/decision-metric-semantics');
const gold = require(require('../config/paths').getGoldBaselinePath());

const buildingInputs = gold['RE-GOLD-002_existing_building'].inputs;
const landInputs = gold['RE-GOLD-001_land_development'].inputs;

// #398 / P12: semantic remediation must not alter the underlying price metric.
const directBuilding = calcExistingBuilding(buildingInputs);
const building = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  leverageEnabled: buildingInputs.leverageEnabled,
});
assert.strictEqual(building.maxJustifiedPrice, directBuilding.maxJustifiedPrice);
assert.strictEqual(building.priceBasis.version, PRICE_BASIS_VERSION);
assert.strictEqual(building.priceBasis.metric, 'maxJustifiedPrice');
assert.strictEqual(building.priceBasis.outputBasis, 'BASE_BUILDING_PURCHASE_PRICE_SAR');
assert.deepStrictEqual(building.priceBasis.thresholdBasis, ['MIN_NET_YIELD_THRESHOLD', 'MAX_PAYBACK_THRESHOLD']);
assert.strictEqual(building.priceBasis.bindingRateFormula, 'MAX_MIN_YIELD_OR_RECIPROCAL_MAX_PAYBACK');
assert.strictEqual(building.priceBasis.solvesAllFinancialHardGates, false);
assert.ok(building.priceBasis.excludedDecisionGates.includes('IRR_MEETS_HURDLE'));
assert.ok(building.priceBasis.excludedDecisionGates.includes('NPV_NON_NEGATIVE'));
assert.ok(Object.isFrozen(building.priceBasis));
assert.ok(Object.isFrozen(building.priceBasis.thresholdBasis));
assert.ok(Object.isFrozen(building.priceBasis.excludedDecisionGates));

const directLand = calcLandDevelopment(landInputs);
const land = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: landInputs,
  leverageEnabled: landInputs.leverageEnabled,
});
assert.strictEqual(land.maxJustifiedLandPricePerSqm, directLand.maxJustifiedLandPricePerSqm);
assert.strictEqual(land.priceBasis.version, PRICE_BASIS_VERSION);
assert.strictEqual(land.priceBasis.metric, 'maxJustifiedLandPricePerSqm');
assert.strictEqual(land.priceBasis.outputBasis, 'RAW_LAND_MARKET_PRICE_PER_SQM_SAR');
assert.deepStrictEqual(land.priceBasis.thresholdBasis, ['MAX_PAYBACK_THRESHOLD']);
assert.strictEqual(land.priceBasis.bindingRateFormula, 'RECIPROCAL_MAX_PAYBACK');
assert.strictEqual(land.priceBasis.constructionCostIncludedInSolver, true);
assert.strictEqual(land.priceBasis.solvesAllFinancialHardGates, false);
assert.ok(land.priceBasis.excludedDecisionGates.includes('IRR_MEETS_HURDLE'));
assert.ok(land.priceBasis.excludedDecisionGates.includes('NPV_NON_NEGATIVE'));
assert.ok(Object.isFrozen(land.priceBasis));

// Customer-facing labels must disclose the exact threshold basis rather than
// imply that the returned price satisfies every decision hard gate.
assert.strictEqual(
  getDecisionMetricLabelOverride('ar-SA', 'metricRowR2B2.maxJustifiedPrice'),
  'أقصى سعر شراء للمبنى وفق حدّي العائد الصافي والاسترداد فقط',
);
assert.strictEqual(
  getDecisionMetricLabelOverride('ar-SA', 'metricRowR2B2.maxJustifiedLandPricePerSqm'),
  'أقصى سعر لمتر الأرض وفق حد الاسترداد فقط',
);
assert.strictEqual(
  getDecisionMetricLabelOverride('en', 'metricRowR2B2.maxJustifiedPrice'),
  'Maximum Building Purchase Price — Yield/Payback Thresholds Only',
);
assert.strictEqual(
  getDecisionMetricLabelOverride('en', 'metricRowR2B2.maxJustifiedLandPricePerSqm'),
  'Maximum Land Price per Sqm — Payback Threshold Only',
);
assert.strictEqual(getDecisionMetricLabelOverride('ar-SA', 'metricRowR2B2.netYieldOnPrice'), null);

console.log('JUSTIFIED_PRICE_SEMANTICS_398=PASS');
