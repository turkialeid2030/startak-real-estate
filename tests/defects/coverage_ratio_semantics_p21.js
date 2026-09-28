'use strict';

const assert = require('assert/strict');
const {
  GROSS_BUILT_AREA_RATIO_SEMANTICS,
  getDecisionMetricLabelOverride,
} = require('../../src/i18n/decision-metric-semantics');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const gold = require(require('../config/paths').getGoldBaselinePath());

assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.legacyField, 'coverageRatio');
assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.numerator, 'TOTAL_BUILT_AREA_INCLUDING_BASEMENTS');
assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.denominator, 'LAND_AREA');
assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.includesBasements, true);
assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.isSiteCoverageRatio, false);
assert.equal(GROSS_BUILT_AREA_RATIO_SEMANTICS.isZoningComplianceMetric, false);
assert.ok(Object.isFrozen(GROSS_BUILT_AREA_RATIO_SEMANTICS));

const ar = getDecisionMetricLabelOverride('ar-SA', 'metricRow.coverageRatio');
assert.ok(ar.includes('إجمالي المساحة المبنية'));
assert.ok(ar.includes('الأقبية'));
assert.ok(ar.includes('ليس نسبة تغطية الموقع'));

const en = getDecisionMetricLabelOverride('en', 'metricRow.coverageRatio');
assert.ok(en.includes('Gross Built Area / Land Area Multiple'));
assert.ok(en.includes('includes basements'));
assert.ok(en.includes('not site coverage'));

// Reproduce the legacy numeric field independently from the engine output. The
// field is deliberately not renamed in the API in P21; the semantic contract
// documents what it actually means while avoiding a breaking data migration.
const inputs = gold['RE-GOLD-002_existing_building'].inputs;
const result = calcExistingBuilding(inputs, { assumptionModelVersion: 'LEGACY' });
const landArea = inputs.landLength * inputs.landWidth;
const grossBuiltArea = (inputs.basementCount * inputs.basementAreaEach)
  + (inputs.floorCount * inputs.floorAreaEach);
const independentMultiple = grossBuiltArea / landArea;
assert.ok(Math.abs(result.coverageRatio - independentMultiple) < 1e-12);
assert.ok(result.coverageRatio > 1,
  'a multi-floor gross built-area multiple above 1 must not be interpreted as site footprint coverage');

console.log('COVERAGE_RATIO_SEMANTICS_P21=PASS');
