'use strict';

const { STUDY_TYPE } = require('./study-type');

const FINANCIAL_TIMING_BASIS_VERSION = 'FINANCIAL_TIMING_BASIS_V1';

const FINANCIAL_TIMING_CONVENTION = Object.freeze({
  INITIAL_INVESTMENT_TIME_ZERO: 'TIME_ZERO',
  ANNUAL_END_OF_PERIOD: 'ANNUAL_END_OF_PERIOD',
  END_OF_FINAL_HOLD_YEAR: 'END_OF_FINAL_HOLD_YEAR',
  END_OF_FINAL_OPERATING_YEAR: 'END_OF_FINAL_OPERATING_YEAR',
  MONTHLY_BEGINNING_OF_PERIOD: 'MONTHLY_BEGINNING_OF_PERIOD',
  PERIODIC_ANNUAL_NPV: 'PERIODIC_ANNUAL_NPV',
  PERIODIC_ANNUAL_IRR: 'PERIODIC_ANNUAL_IRR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

function buildFinancialTimingBasis(studyType) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new TypeError(`Unsupported studyType for financial timing basis: ${studyType}`);
  }

  const terminalValueTiming = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_HOLD_YEAR
    : FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_OPERATING_YEAR;
  const constructionDebtDrawTiming = studyType === STUDY_TYPE.LAND_DEVELOPMENT
    ? FINANCIAL_TIMING_CONVENTION.MONTHLY_BEGINNING_OF_PERIOD
    : FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE;

  return Object.freeze({
    version: FINANCIAL_TIMING_BASIS_VERSION,
    initialInvestmentTiming: FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO,
    unleveredCashflowTiming: FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
    operatingCashflowTiming: FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
    terminalValueTiming,
    constructionDebtDrawTiming,
    npvConvention: FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_NPV,
    irrConvention: FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_IRR,
    datedCashflowMethod: false,
    xnpvUsed: false,
    xirrUsed: false,
    periodsPerYear: 1,
    transactionAuthorized: false,
    semantics: 'Methodology disclosure only. Unlevered operating and terminal cash flows are modeled as periodic annual entries rather than date-specific cash flows. Land-development construction debt uses monthly beginning-of-period draws for its internal debt schedule. This metadata does not alter any financial calculation, constitute a valuation opinion, or authorize a transaction.',
  });
}

module.exports = {
  FINANCIAL_TIMING_BASIS_VERSION,
  FINANCIAL_TIMING_CONVENTION,
  buildFinancialTimingBasis,
};
