'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  FINANCIAL_TIMING_BASIS_VERSION,
  FINANCIAL_TIMING_CONVENTION,
} = require('../../src/contracts/financial-timing-basis');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const gold = require(require('../config/paths').getGoldBaselinePath());

const buildingGoldInputs = gold['RE-GOLD-002_existing_building'].inputs;
const buildingInputs = {
  ...buildingGoldInputs,
  // Keep P22/P23 independently satisfied so this test isolates P26 timing
  // disclosure and its interaction with P25 decision governance.
  leaseYears: buildingGoldInputs.holdPeriod + 1,
  exitCapRate: 0.07,
  exitTransferFeeRate: 0.05,
  leverageEnabled: false,
};

const building = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});

assert.equal(building.timingBasis.version, FINANCIAL_TIMING_BASIS_VERSION);
assert.equal(
  building.timingBasis.initialInvestmentTiming,
  FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO,
);
assert.equal(
  building.timingBasis.unleveredCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(
  building.timingBasis.operatingCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(
  building.timingBasis.constructionCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
);
assert.equal(
  building.timingBasis.terminalValueTiming,
  FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_HOLD_YEAR,
);
assert.equal(
  building.timingBasis.constructionDebtDrawTiming,
  FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE,
);
assert.equal(building.timingBasis.npvConvention, FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_NPV);
assert.equal(building.timingBasis.irrConvention, FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_IRR);
assert.equal(building.timingBasis.datedCashflowMethod, false);
assert.equal(building.timingBasis.xnpvUsed, false);
assert.equal(building.timingBasis.xirrUsed, false);
assert.equal(building.timingBasis.periodsPerYear, 1);
assert.equal(building.timingBasis.transactionAuthorized, false);

const landGoldInputs = gold['RE-GOLD-001_land_development'].inputs;
const land = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: { ...landGoldInputs, leverageEnabled: false },
  leverageEnabled: false,
});

assert.equal(land.timingBasis.version, FINANCIAL_TIMING_BASIS_VERSION);
assert.equal(
  land.timingBasis.initialInvestmentTiming,
  FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO,
);
assert.equal(
  land.timingBasis.unleveredCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(
  land.timingBasis.operatingCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(
  land.timingBasis.constructionCashflowTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(
  land.timingBasis.terminalValueTiming,
  FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_OPERATING_YEAR,
);
assert.equal(
  land.timingBasis.constructionDebtDrawTiming,
  FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
);
assert.equal(land.timingBasis.npvConvention, FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_NPV);
assert.equal(land.timingBasis.irrConvention, FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_IRR);
assert.equal(land.timingBasis.datedCashflowMethod, false);
assert.equal(land.timingBasis.xnpvUsed, false);
assert.equal(land.timingBasis.xirrUsed, false);
assert.equal(land.timingBasis.periodsPerYear, 1);
assert.equal(land.timingBasis.transactionAuthorized, false);
assert.equal(
  land.cashflows.length,
  1 + land.constructionYears + land.operatingYears,
  'land cash-flow vector must use one time-zero entry followed by annual construction and operating entries',
);

// P25 must fail closed on incomplete critical-override evidence without
// stripping either the analytical result or P26 methodology disclosure.
const incompleteOverride = [{
  id: 'maintenanceRate',
  value: 0.06,
  critical: true,
  override: true,
  overrideReason: 'P26 interaction test',
  approvalStatus: 'PENDING',
}];
const held = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: incompleteOverride,
});

assert.equal(held.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(held.verdict, 'INCOMPLETE_INPUTS');
assert.equal(held.analyticalResultsOnly, true);
assert.ok(Number.isFinite(held.npv), 'P25 hold must preserve analytical NPV');
assert.ok(Number.isFinite(held.irr), 'P25 hold must preserve analytical IRR');
assert.ok(Number.isFinite(held.NOI), 'P25 hold must preserve analytical NOI');
assert.equal(held.timingBasis.version, FINANCIAL_TIMING_BASIS_VERSION);
assert.equal(
  held.timingBasis.terminalValueTiming,
  FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_HOLD_YEAR,
);
assert.equal(held.timingBasis.transactionAuthorized, false);
assert.equal(held.metCount, null);
assert.equal(held.totalCriteria, null);
assert.equal(held.criteriaDetail, null);

console.log('FINANCIAL_TIMING_BASIS_DISCLOSURE_P26=PASS');
