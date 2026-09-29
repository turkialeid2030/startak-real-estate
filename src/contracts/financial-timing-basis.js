'use strict';

const { STUDY_TYPE } = require('./study-type');

const FINANCIAL_TIMING_BASIS_VERSION = 'FINANCIAL_TIMING_BASIS_V1';

const FINANCIAL_TIMING_CONVENTION = Object.freeze({
  INITIAL_INVESTMENT_TIME_ZERO: 'TIME_ZERO',
  ANNUAL_END_OF_PERIOD: 'ANNUAL_END_OF_PERIOD',
  END_OF_FINAL_HOLD_YEAR: 'END_OF_FINAL_HOLD_YEAR',
  END_OF_FINAL_OPERATING_YEAR: 'END_OF_FINAL_OPERATING_YEAR',
  PERIODIC_ANNUAL_NPV: 'PERIODIC_ANNUAL_NPV',
  PERIODIC_ANNUAL_IRR: 'PERIODIC_ANNUAL_IRR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

function buildFinancialTimingBasis(studyType) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new TypeError(`Unsupported studyType for financial timing basis: ${studyType}`);
  }

  const isLandDevelopment = studyType === STUDY_TYPE.LAND_DEVELOPMENT;
  const terminalValueTiming = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_HOLD_YEAR
    : FINANCIAL_TIMING_CONVENTION.END_OF_FINAL_OPERATING_YEAR;
  const constructionCashflowTiming = isLandDevelopment
    ? FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD
    : FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE;
  const constructionDebtDrawTiming = isLandDevelopment
    ? FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD
    : FINANCIAL_TIMING_CONVENTION.NOT_APPLICABLE;

  return Object.freeze({
    version: FINANCIAL_TIMING_BASIS_VERSION,
    initialInvestmentTiming: FINANCIAL_TIMING_CONVENTION.INITIAL_INVESTMENT_TIME_ZERO,
    unleveredCashflowTiming: FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
    operatingCashflowTiming: FINANCIAL_TIMING_CONVENTION.ANNUAL_END_OF_PERIOD,
    constructionCashflowTiming,
    terminalValueTiming,
    constructionDebtDrawTiming,
    npvConvention: FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_NPV,
    irrConvention: FINANCIAL_TIMING_CONVENTION.PERIODIC_ANNUAL_IRR,
    datedCashflowMethod: false,
    xnpvUsed: false,
    xirrUsed: false,
    periodsPerYear: 1,
    transactionAuthorized: false,
    semantics: 'Methodology disclosure only. Initial investment is represented at time zero; subsequent modeled cash-flow entries are periodic annual end-of-period amounts. For land development, construction equity/cost cash flows and construction debt draws are modeled on the same annual end-of-period grid used by the current engine; no monthly draw convention is claimed. Terminal value is included in the final hold or operating-year cash-flow entry. NPV and IRR use equally spaced annual periods rather than date-specific cash flows. This metadata does not alter any financial calculation, constitute a valuation opinion, or authorize a transaction.',
  });
}

module.exports = {
  FINANCIAL_TIMING_BASIS_VERSION,
  FINANCIAL_TIMING_CONVENTION,
  buildFinancialTimingBasis,
};
