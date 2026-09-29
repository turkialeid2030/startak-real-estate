'use strict';

const assert = require('assert/strict');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const {
  buildFinancialTimingBasisReportDisclosure,
  FINANCIAL_TIMING_REPORT_SCHEMA_VERSION,
} = require('../../src/reporting/financial-timing-basis-report');
const {
  FINANCIAL_TIMING_BASIS_VERSION,
  FINANCIAL_TIMING_CONVENTION,
} = require('../../src/contracts/financial-timing-basis');
const gold = require(require('../config/paths').getGoldBaselinePath());

const buildingGoldInputs = gold['RE-GOLD-002_existing_building'].inputs;
const building = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...buildingGoldInputs,
    leaseYears: buildingGoldInputs.holdPeriod + 1,
    exitCapRate: 0.07,
    exitTransferFeeRate: 0.05,
    leverageEnabled: false,
  },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});

const buildingNpv = building.npv;
const buildingIrr = building.irr;
const buildingNoi = building.NOI;
const buildingReport = buildFinancialTimingBasisReportDisclosure(building, { locale: 'ar-SA' });

assert.equal(buildingReport.schemaVersion, FINANCIAL_TIMING_REPORT_SCHEMA_VERSION);
assert.equal(buildingReport.timingBasisVersion, FINANCIAL_TIMING_BASIS_VERSION);
assert.equal(buildingReport.locale, 'ar-SA');
assert.equal(buildingReport.methodology.initialInvestmentTiming, FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO);
assert.equal(buildingReport.methodology.unleveredCashflowTiming, FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD);
assert.equal(buildingReport.methodology.terminalValueTiming, FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_HOLD_YEAR);
assert.equal(buildingReport.methodology.constructionDebtDrawTiming, FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE);
assert.equal(buildingReport.methodology.xnpvUsed, false);
assert.equal(buildingReport.methodology.xirrUsed, false);
assert.equal(buildingReport.transactionAuthorized, false);
assert.ok(buildingReport.rows.length >= 10);
assert.ok(buildingReport.reconciliationNote.includes('الاستثمار الأولي'));
assert.equal(building.npv, buildingNpv, 'report adapter must not mutate NPV');
assert.equal(building.irr, buildingIrr, 'report adapter must not mutate IRR');
assert.equal(building.NOI, buildingNoi, 'report adapter must not mutate NOI');

const landGoldInputs = gold['RE-GOLD-001_land_development'].inputs;
const land = calculateInvestmentCase({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  inputs: {
    ...landGoldInputs,
    leverageEnabled: true,
    minDscrThreshold: 0.1,
  },
  leverageEnabled: true,
});
const landReport = buildFinancialTimingBasisReportDisclosure(land, { locale: 'en' });

assert.equal(landReport.locale, 'en');
assert.equal(landReport.methodology.constructionCashflowTiming, FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD);
assert.equal(landReport.methodology.landDebtDrawTiming, FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO);
assert.equal(landReport.methodology.constructionDebtDrawTiming, FINANCIAL_TIMING_CONVENTION.MONTHLY_BEGINNING_OF_PERIOD);
assert.equal(landReport.methodology.constructionInterestCapitalizationTiming, FINANCIAL_TIMING_CONVENTION.MONTHLY_END_OF_PERIOD);
assert.equal(landReport.methodology.constructionDebtPeriodsPerYear, 12);
assert.equal(landReport.methodology.annualConstructionDebtDrawsAreAggregationOnly, true);
assert.equal(landReport.methodology.terminalValueTiming, FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_OPERATING_YEAR);
assert.ok(landReport.reconciliationNote.includes('separate monthly schedule'));
assert.equal(landReport.transactionAuthorized, false);

const held = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...buildingGoldInputs,
    leaseYears: buildingGoldInputs.holdPeriod + 1,
    exitCapRate: 0.07,
    exitTransferFeeRate: 0.05,
    leverageEnabled: false,
  },
  leverageEnabled: false,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  assumptionRegistry: [{
    id: 'maintenanceRate',
    value: 0.06,
    critical: true,
    override: true,
    overrideReason: 'P26 report hold interaction test',
    approvalStatus: 'PENDING',
  }],
});
const heldReport = buildFinancialTimingBasisReportDisclosure(held, { locale: 'en' });
assert.equal(held.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(heldReport.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(heldReport.analyticalResultsOnly, true);
assert.equal(heldReport.transactionAuthorized, false);
assert.equal(heldReport.timingBasisVersion, FINANCIAL_TIMING_BASIS_VERSION);

assert.throws(
  () => buildFinancialTimingBasisReportDisclosure({}),
  /result\.timingBasis is required/,
  'report disclosure must fail closed rather than invent missing timing metadata',
);
assert.throws(
  () => buildFinancialTimingBasisReportDisclosure({ timingBasis: { version: 'UNKNOWN' } }),
  /Unsupported timing basis version/,
  'report disclosure must reject unsupported timing metadata versions',
);

console.log('FINANCIAL_TIMING_BASIS_REPORT_P26=PASS');
