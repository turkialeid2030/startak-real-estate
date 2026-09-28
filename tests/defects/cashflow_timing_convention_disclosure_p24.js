'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE, CASHFLOW_TIMING_VERSION } = require('../../src/engines');
const { buildCashflowTimingConvention, TIMING_CODE } = require('../../src/engines/financial/timing-conventions');

const FIXTURE_DIR = path.join(__dirname, '..', 'characterization', 'fixtures');
const fixtureIds = ['RE-GOLD-001-U', 'RE-GOLD-001-L', 'RE-GOLD-002-U', 'RE-GOLD-002-L'];
const studyTypeMap = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };

for (const id of fixtureIds) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${id}.json`), 'utf8'));
  const result = calculateInvestmentCase({
    studyType: studyTypeMap[fixture.study_type],
    inputs: fixture.input_set,
    leverageEnabled: fixture.input_set.leverageEnabled,
  });
  const timing = result.cashflowTiming;
  const financed = typeof result.financingEngineVersion === 'string';
  const land = fixture.study_type === 'land';

  assert.equal(timing.version, CASHFLOW_TIMING_VERSION, `${id}: version`);
  assert.equal(timing.returnCalculationBasis, TIMING_CODE.PERIODIC, `${id}: periodic basis`);
  assert.equal(timing.npvConvention, TIMING_CODE.PERIODIC_ANNUAL_NPV, `${id}: NPV convention`);
  assert.equal(timing.irrConvention, TIMING_CODE.PERIODIC_ANNUAL_IRR, `${id}: IRR convention`);
  assert.equal(timing.dateAwareReturns, false, `${id}: not date-aware`);
  assert.equal(timing.dayCountBasis, null, `${id}: no day-count basis`);
  assert.equal(timing.initialInvestmentTiming, TIMING_CODE.PERIOD_0, `${id}: initial investment`);
  assert.equal(timing.unleveredOperatingCashflowTiming, TIMING_CODE.ANNUAL_END_OF_PERIOD, `${id}: operating timing`);
  assert.equal(timing.terminalValueTiming, TIMING_CODE.ANNUAL_END_OF_PERIOD, `${id}: terminal timing`);
  assert.equal(timing.terminalValueNoiBasis, TIMING_CODE.FORWARD_YEAR_N_PLUS_1_STABILIZED_NOI, `${id}: terminal NOI basis`);
  assert.equal(timing.datedReturnEngineUsed, false, `${id}: dated engine`);
  assert.equal(timing.xnpvUsed, false, `${id}: XNPV`);
  assert.equal(timing.xirrUsed, false, `${id}: XIRR`);
  assert.equal(timing.financingModelApplied, financed, `${id}: financing metadata`);
  assert.equal(timing.unleveredConstructionCostTiming, land ? TIMING_CODE.ANNUAL_END_OF_PERIOD : null, `${id}: construction timing`);
  assert.equal(typeof timing.disclosure.ar, 'string', `${id}: Arabic disclosure`);
  assert.equal(typeof timing.disclosure.en, 'string', `${id}: English disclosure`);
  assert.ok(timing.disclosure.ar.length > 30, `${id}: Arabic disclosure substantive`);
  assert.ok(timing.disclosure.en.length > 30, `${id}: English disclosure substantive`);
  assert.equal(timing.transactionAuthorized, false, `${id}: no authority`);

  if (financed) {
    assert.equal(timing.debtCalculationFrequency, TIMING_CODE.MONTHLY, `${id}: monthly debt`);
    assert.equal(timing.debtFundingTiming, TIMING_CODE.PERIOD_0, `${id}: debt funding`);
    assert.equal(timing.termDebtPaymentTiming, TIMING_CODE.MONTHLY_END_OF_PERIOD_AFTER_INTEREST_ACCRUAL, `${id}: term debt payment timing`);
    assert.equal(timing.annualDebtServiceAggregation, TIMING_CODE.SUM_MONTHLY_PAYMENTS_BY_MODEL_YEAR, `${id}: annual debt aggregation`);
    assert.equal(timing.leveredValuationCashflowTiming, TIMING_CODE.ANNUAL_END_OF_PERIOD, `${id}: levered valuation timing`);
    if (land) {
      assert.equal(timing.constructionDebtDrawTiming, TIMING_CODE.MONTHLY_BEGINNING_OF_PERIOD_BEFORE_INTEREST_ACCRUAL, `${id}: construction debt draw`);
      assert.equal(timing.constructionInterestTiming, TIMING_CODE.MONTHLY_AFTER_CONSTRUCTION_DRAW_CAPITALIZED, `${id}: construction interest timing`);
    } else {
      assert.equal(timing.constructionDebtDrawTiming, null, `${id}: no building construction debt draw`);
      assert.equal(timing.constructionInterestTiming, null, `${id}: no building construction interest`);
    }
  } else {
    assert.equal(timing.debtCalculationFrequency, null, `${id}: no debt frequency`);
    assert.equal(timing.termDebtPaymentTiming, null, `${id}: no debt payment timing`);
    assert.equal(timing.annualDebtServiceAggregation, null, `${id}: no debt aggregation`);
    assert.equal(timing.leveredValuationCashflowTiming, null, `${id}: no levered timing`);
    assert.equal(timing.constructionDebtDrawTiming, null, `${id}: no construction debt timing`);
    assert.equal(timing.constructionInterestTiming, null, `${id}: no construction interest timing`);
  }
}

// The timing builder must be descriptive and side-effect free.
const sentinel = {
  financingEngineVersion: 'MONTHLY_DSCR_WAVE_B_1.0',
  npv: 123.45,
  irr: 0.123,
  cashflows: Object.freeze([-100, 20, 120]),
};
const before = JSON.stringify(sentinel);
const timing = buildCashflowTimingConvention({ studyType: STUDY_TYPE.EXISTING_BUILDING, result: sentinel });
assert.equal(JSON.stringify(sentinel), before, 'timing builder mutated economic result');
assert.equal(timing.npvConvention, TIMING_CODE.PERIODIC_ANNUAL_NPV);
assert.equal(timing.xnpvUsed, false);

console.log('P24_CASHFLOW_TIMING_CONVENTION_DISCLOSURE=PASS');
