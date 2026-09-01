'use strict';

// Canonical financing-result field contract. Wave B adds production-path
// monthly financing metadata for Existing Building while Land Development
// retains its construction-facility path pending Wave B2.
const FINANCING_RESULT_FIELDS = Object.freeze({
  loanAmount: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  equityRequired: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  debtService: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  dscrMin: { present: 'BOTH_WHEN_LEVERED', type: 'number | null' },
  leveredCashflows: { present: 'BOTH_WHEN_LEVERED', type: 'number[]' },
  leveredIRR: { present: 'BOTH_WHEN_LEVERED', type: 'number (may be NaN)' },
  leveredNPV: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  equityDiscountRate: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  constructionLoanBalance: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number | undefined' },

  financingEngineVersion: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'string' },
  financingModelType: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'string' },
  financingModelBoundary: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'string' },
  exactContractModel: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'boolean' },
  loanSizingConstraint: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'LTV | DSCR' },
  ltvLoanLimit: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  dscrLoanLimit: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  tenorMonths: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  gracePeriodMonths: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  graceType: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'INTEREST_ONLY | CAPITALIZED' },
  balloonPct: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  balloonAmount: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  scheduledMonthlyPayment: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  annualDebtService: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number[]' },
  annualDebtSchedule: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'object[]' },
  debtServiceBasis: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'YEAR_1_ACTUAL' },
  debtServicePeak: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
});
module.exports = { FINANCING_RESULT_FIELDS };
