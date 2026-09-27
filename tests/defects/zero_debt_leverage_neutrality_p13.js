'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite actual, got ${actual}`);
  assert.ok(Number.isFinite(expected), `${label}: expected finite reference, got ${expected}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected} within ${tolerance}`);
}

function financingCodes(result) {
  return (result.criteriaDetail || [])
    .map((item) => item.code)
    .filter((code) => code === 'DSCR_MINIMUM' || code === 'LEVERED_NPV_NON_NEGATIVE');
}

function assertZeroDebtNeutrality({ studyType, inputs, baseDiscountRate, label }) {
  const result = calculateInvestmentCase({
    studyType,
    inputs: { ...inputs, ltv: 0, leverageEnabled: true },
    leverageEnabled: true,
  });

  assert.equal(result.loanAmount, 0, `${label}: loan amount must be zero`);
  assert.equal(result.debtService, 0, `${label}: debt service must be zero`);
  assert.equal(result.dscrMin, null, `${label}: DSCR is not applicable without debt`);
  assert.deepEqual(result.leveredCashflows, result.cashflows, `${label}: zero-debt levered cash flow must equal unlevered cash flow`);
  close(result.leveredIRR, result.irr, 1e-12, `${label}: IRR neutrality`);
  close(result.leveredNPV, result.npv, 0.01, `${label}: NPV neutrality`);
  close(result.equityDiscountRate, baseDiscountRate, 1e-12, `${label}: discount-rate neutrality`);
  assert.deepEqual(financingCodes(result), [], `${label}: debt-only decision gates must be absent when effective debt is zero`);
  assert.ok(!result.failedHardGates.includes('DSCR_MINIMUM'), `${label}: DSCR must not fail without debt`);
  assert.ok(!result.failedHardGates.includes('LEVERED_NPV_NON_NEGATIVE'), `${label}: levered NPV gate must not fail without debt`);
  assert.equal(result.financingEngineVersion, undefined, `${label}: Wave-B financing overlay must not be applied to zero requested debt`);
}

function assertMissingLeverageStillFailsClosed({ studyType, inputs, label }) {
  const incomplete = { ...inputs };
  delete incomplete.leverageEnabled;
  assert.throws(
    () => calculateInvestmentCase({ studyType, inputs: incomplete }),
    (error) => error && error.name === 'ValidationError' && error.field === 'leverageEnabled',
    `${label}: P13 must not manufacture leverageEnabled=false when the required input is missing`,
  );
}

const buildingInputs = gold['RE-GOLD-002_existing_building'].inputs;
assertZeroDebtNeutrality({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  baseDiscountRate: buildingInputs.discountRate,
  label: 'existing building',
});
assertMissingLeverageStillFailsClosed({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  label: 'existing building',
});

const landInputs = gold['RE-GOLD-001_land_development'].inputs;
assertZeroDebtNeutrality({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: landInputs,
  baseDiscountRate: landInputs.hurdleRate,
  label: 'land development',
});
assertMissingLeverageStillFailsClosed({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: landInputs,
  label: 'land development',
});

console.log('ZERO_DEBT_LEVERAGE_NEUTRALITY_P13=PASS');
