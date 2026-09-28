'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { getDecisionMetricLabelOverride } = require('../../src/i18n/decision-metric-semantics');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));

const baseInputs = {
  ...fixture.input_set,
  leaseYears: 6,
  holdPeriod: 5,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
};

function run(buildingAge) {
  return calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...baseInputs, buildingAge },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
}

// 1) Characterize the current semantic defect independently: changing only the
// building age does not change the legacy-named totalAppraisedValue.
const ageOne = run(1);
const ageTwenty = run(20);
assert.equal(ageOne.totalAppraisedValue, ageTwenty.totalAppraisedValue);
assert.equal(
  ageOne.totalAppraisedValue,
  ageOne.totalReplacementConstructionValue + ageOne.currentLandValue,
);
console.log('P24_BUILDING_AGE_NOT_USED_IN_LEGACY_APPRAISED_VALUE=PROVEN');

// 2) Canonical results must disclose what this arithmetic figure actually is.
assert.equal(
  ageOne.costApproachIndicationBasis,
  'UNDEPRECIATED_REPLACEMENT_COST_NEW_PLUS_LAND_INPUT',
);
assert.equal(ageOne.costApproachIndication, ageOne.totalAppraisedValue);
assert.equal(ageOne.costApproachUsesBuildingAge, false);
assert.equal(ageOne.costApproachAccreditedValuation, false);
assert.equal(ageOne.costApproachMarketValueDetermined, false);
assert.equal(ageOne.totalAppraisedValueLegacyAlias, true);

// 3) The customer-facing semantic layer must stop calling the arithmetic figure
// a generic current/appraised value and must state the non-certified boundary.
const arLabel = getDecisionMetricLabelOverride('ar-SA', 'metricRowR2B2.totalAppraisedValue');
const enLabel = getDecisionMetricLabelOverride('en', 'metricRowR2B2.totalAppraisedValue');
const arSection = getDecisionMetricLabelOverride('ar-SA', 'dashboardR3.sectionAppraisal');
const enSection = getDecisionMetricLabelOverride('en', 'dashboardR3.sectionAppraisal');
assert.ok(arLabel && arLabel.includes('تكلفة الاستبدال'));
assert.ok(arLabel.includes('غير تقييم معتمد'));
assert.ok(enLabel && /replacement cost/i.test(enLabel));
assert.ok(/not accredited/i.test(enLabel));
assert.ok(arSection && !arSection.includes('التقييم العيني'));
assert.ok(enSection && !/appraisal/i.test(enSection));

console.log('REPLACEMENT_COST_VALUATION_SEMANTICS_P24=PASS');
