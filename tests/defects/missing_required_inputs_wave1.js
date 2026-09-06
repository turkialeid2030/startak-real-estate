'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  ValidationError,
  REQUIRED_ENGINE_FIELDS,
} = require('../../src/validation/numeric-safety');
const gold = require(require('../config/paths').getGoldBaselinePath());

const BUILDING = gold['RE-GOLD-002_existing_building'].inputs;
const LAND = gold['RE-GOLD-001_land_development'].inputs;

function cloneWithout(input, ...fields) {
  const copy = { ...input };
  for (const field of fields) delete copy[field];
  return copy;
}

function expectMissing({ studyType, inputs, leverageEnabled, field, label = field }) {
  let error = null;
  try {
    calculateInvestmentCase({ studyType, inputs, leverageEnabled });
  } catch (caught) {
    error = caught;
  }

  assert(error, `${label}: expected missing required field to throw`);
  assert(error instanceof ValidationError, `${label}: expected ValidationError, got ${error?.constructor?.name}`);
  assert.strictEqual(error.rule, 'MISSING_REQUIRED_FIELD', `${label}: wrong rule`);
  assert.strictEqual(error.code, 'MISSING_REQUIRED_FIELD', `${label}: wrong code`);
  assert.strictEqual(error.field, field, `${label}: wrong field`);
  assert(error.message_ar && error.message_ar.includes(field), `${label}: Arabic message must identify field`);
  assert(error.message_en && error.message_en.includes(field), `${label}: English message must identify field`);
  assert(error.message_ar.includes('مطلوب'), `${label}: Arabic message must state required-field semantics`);
  assert(/required/i.test(error.message_en), `${label}: English message must state required-field semantics`);
  return error;
}

let requiredCases = 0;
for (const field of REQUIRED_ENGINE_FIELDS[STUDY_TYPE.EXISTING_BUILDING]) {
  const inputs = cloneWithout(BUILDING, field);
  const leverageEnabled = field === 'leverageEnabled' ? undefined : false;
  expectMissing({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs, leverageEnabled, field, label: `building:${field}` });
  requiredCases += 1;
}

for (const field of REQUIRED_ENGINE_FIELDS[STUDY_TYPE.LAND_DEVELOPMENT]) {
  const inputs = cloneWithout(LAND, field);
  const leverageEnabled = field === 'leverageEnabled' ? undefined : false;
  expectMissing({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs, leverageEnabled, field, label: `land:${field}` });
  requiredCases += 1;
}

// Conditional required fields.
expectMissing({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: cloneWithout(BUILDING, 'netLeasableOverride', 'efficiencyRatio'),
  leverageEnabled: false,
  field: 'efficiencyRatio',
  label: 'building:efficiencyRatio-without-override',
});
requiredCases += 1;

expectMissing({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: cloneWithout(BUILDING, 'variableOpexRate', 'maintenanceRate'),
  leverageEnabled: false,
  field: 'maintenanceRate',
  label: 'building:maintenanceRate-without-variableOpexRate',
});
requiredCases += 1;

expectMissing({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: cloneWithout(BUILDING, 'insuranceRateOnReplacementCost', 'insuranceRate'),
  leverageEnabled: false,
  field: 'insuranceRate',
  label: 'building:insuranceRate-without-explicit-insurance-rate',
});
requiredCases += 1;

expectMissing({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: cloneWithout(BUILDING, 'minDscrThreshold'),
  leverageEnabled: true,
  field: 'minDscrThreshold',
  label: 'building:minDscrThreshold-when-leveraged',
});
requiredCases += 1;

expectMissing({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: cloneWithout(LAND, 'variableOpexRate', 'opexRate'),
  leverageEnabled: false,
  field: 'opexRate',
  label: 'land:opexRate-without-variableOpexRate',
});
requiredCases += 1;

expectMissing({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: cloneWithout(LAND, 'minDscrThreshold'),
  leverageEnabled: true,
  field: 'minDscrThreshold',
  label: 'land:minDscrThreshold-when-leveraged',
});
requiredCases += 1;

// Explicit regression for the raw TypeError previously leaking from the cash-flow solver.
const missingBuildingPrice = expectMissing({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: cloneWithout(BUILDING, 'buildingPrice'),
  leverageEnabled: false,
  field: 'buildingPrice',
  label: 'building:buildingPrice-controlled-validation',
});
assert.strictEqual(missingBuildingPrice.name, 'ValidationError');

// A finite input can overflow during a later multiplication. The engine must
// stop at the first non-finite intermediate rather than convert it to zero.
let intermediateError = null;
try {
  calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: { ...BUILDING, floorAreaEach: Number.MAX_VALUE },
    leverageEnabled: false,
  });
} catch (caught) {
  intermediateError = caught;
}
assert(intermediateError, 'intermediate overflow must throw');
assert(intermediateError instanceof ValidationError, `intermediate overflow must be ValidationError, got ${intermediateError?.constructor?.name}`);
assert.strictEqual(intermediateError.rule, 'NON_FINITE_INTERMEDIATE');
assert(intermediateError.message_ar && intermediateError.message_en, 'intermediate error must be bilingual');

// Building economics below are frozen golden values already protected by the
// repository baseline. Land IRR is intentionally NOT frozen here: main@6a3af1b
// already produced 0.145861780688248 while the fixture's legacy_outputs stores
// 0.14586178068829136 (delta ~4.335e-14). Wave 1 records the live reference
// behavior only; the pre-existing precision drift is deferred to Wave 5/NC-001.
const GOLD_BUILDING = Object.freeze({
  noi: 14612760,
  expenses: 1112040,
  irr: 0.1444715207802304,
});
const WAVE1_LIVE_LAND_BASELINE = Object.freeze({
  noi: 12307075.2,
  expenses: 647740.8,
  irr: 0.145861780688248,
});

function assertBuildingGolden(leverageEnabled) {
  const result = calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: BUILDING,
    leverageEnabled,
  });
  assert.strictEqual(result.NOI, GOLD_BUILDING.noi, `building leverage=${leverageEnabled}: NOI drift`);
  assert.strictEqual(result.opexAmount, GOLD_BUILDING.expenses, `building leverage=${leverageEnabled}: OPEX drift`);
  assert.strictEqual(result.irr, GOLD_BUILDING.irr, `building leverage=${leverageEnabled}: IRR drift`);
}

function assertLandLiveBaseline(leverageEnabled) {
  const result = calculateInvestmentCase({
    studyType: STUDY_TYPE.LAND_DEVELOPMENT,
    inputs: LAND,
    leverageEnabled,
  });
  assert.strictEqual(result.stabilizedNOI, WAVE1_LIVE_LAND_BASELINE.noi, `land leverage=${leverageEnabled}: NOI drift from Wave 1 live baseline`);
  assert.strictEqual(result.operatingExpenses, WAVE1_LIVE_LAND_BASELINE.expenses, `land leverage=${leverageEnabled}: OPEX drift from Wave 1 live baseline`);
  assert.strictEqual(result.irr, WAVE1_LIVE_LAND_BASELINE.irr, `land leverage=${leverageEnabled}: IRR drift from Wave 1 live baseline`);
}

assertBuildingGolden(false);
assertBuildingGolden(true);
assertLandLiveBaseline(false);
assertLandLiveBaseline(true);

console.log(`WAVE1_REQUIRED_FIELD_CASES=${requiredCases}`);
console.log('WAVE1_BUILDINGPRICE_CONTROLLED_VALIDATION=PASS');
console.log('WAVE1_NON_FINITE_INTERMEDIATE_GUARD=PASS');
console.log('WAVE1_BILINGUAL_ERROR_MESSAGES=PASS');
console.log('WAVE1_BUILDING_GOLDEN_CASES=2 PASS');
console.log('WAVE1_LAND_LOCAL_BASELINE_CASES=2 PASS');
console.log('WAVE1_LAND_PRECISION_DRIFT_DEFERRED=Wave5_NC001');
console.log('WAVE1_RESULT=PASS');
