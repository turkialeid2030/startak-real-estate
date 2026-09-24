'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ValidationError } = require('../../src/validation/numeric-safety');
const { normalizeTenorMonths } = require('../../src/engines/financial/monthly-debt');
const { normalizeConstructionMonths } = require('../../src/engines/financial/construction-debt');
const gold = require(require('../config/paths').getGoldBaselinePath());

const building = gold['RE-GOLD-002_existing_building'].inputs;
const land = gold['RE-GOLD-001_land_development'].inputs;

function expectValidation(field, inputs, studyType, leverageEnabled = false) {
  assert.throws(
    () => calculateInvestmentCase({ studyType, inputs, leverageEnabled }),
    (error) => error instanceof ValidationError && error.field === field,
    `expected fail-closed ValidationError for ${field}`,
  );
}

// #397: Existing Building annual engine cannot safely model a fractional hold
// period. A 5.5-year hold previously omitted terminal proceeds entirely because
// the integer loop never reached y === holdPeriod.
expectValidation(
  'holdPeriod',
  { ...building, holdPeriod: 5.5 },
  STUDY_TYPE.EXISTING_BUILDING,
);

// Land construction time is an intentional exception: Wave-B financing models
// construction monthly, so a fractional construction horizon remains supported.
assert.strictEqual(normalizeConstructionMonths(2.5), 30);
const fractionalConstruction = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: { ...land, constructionPeriod: 2.5, loanTenor: 7.5, leverageEnabled: true },
  leverageEnabled: true,
});
assert.strictEqual(fractionalConstruction.constructionDebtSchedule.length, 30);
assert.strictEqual(fractionalConstruction.tenorMonths, 90);

// Land operating cash flows are annual-only today. Do not silently round an
// unsupported fractional operating horizon.
expectValidation(
  'operatingPeriod',
  { ...land, operatingPeriod: 10.5 },
  STUDY_TYPE.LAND_DEVELOPMENT,
);

// The current lease-up schedule only models the first operating year. Do not
// silently clamp a >12-month input and then assume full stabilization in year 2.
expectValidation(
  'leaseUpMonths',
  { ...land, leaseUpMonths: 18 },
  STUDY_TYPE.LAND_DEVELOPMENT,
);

// Boundary remains valid.
const leaseUp12 = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: { ...land, leaseUpMonths: 12 },
  leverageEnabled: false,
});
assert.strictEqual(leaseUp12.initialLeaseUpFactor, 0);
assert.ok(Number.isFinite(leaseUp12.npv));

// Preserve legitimate fractional financing tenor: Wave-B debt is explicitly
// monthly and 7.5 years maps deterministically to 90 months.
assert.strictEqual(normalizeTenorMonths(7.5), 90);
const financedBuilding = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: { ...building, loanTenor: 7.5, leverageEnabled: true },
  leverageEnabled: true,
});
assert.strictEqual(financedBuilding.tenorMonths, 90);
assert.ok(Number.isFinite(financedBuilding.leveredNPV));

console.log('FINANCIAL_HORIZON_FAIL_CLOSED_397=PASS');
