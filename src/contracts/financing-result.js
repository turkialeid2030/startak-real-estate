'use strict';

// Canonical financing-result field contract for Wave B production paths.
const FINANCING_RESULT_FIELDS = Object.freeze({
  loanAmount: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  equityRequired: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  debtService: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  dscrMin: { present: 'BOTH_WHEN_LEVERED', type: 'number | null' },
  leveredCashflows: { present: 'BOTH_WHEN_LEVERED', type: 'number[]' },
  leveredIRR: { present: 'BOTH_WHEN_LEVERED', type: 'number (may be NaN)' },
  leveredNPV: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  equityDiscountRate: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  constructionLoanBalance: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },

  financingEngineVersion: { present: 'BOTH_WHEN_LEVERED', type: 'string' },
  financingModelType: { present: 'BOTH_WHEN_LEVERED', type: 'string' },
  financingModelBoundary: { present: 'BOTH_WHEN_LEVERED', type: 'string' },
  exactContractModel: { present: 'BOTH_WHEN_LEVERED', type: 'boolean' },

  // P16 / F-002: ratio semantics must identify the actual denominator used by
  // the debt-sizing engine rather than rely on the legacy input name `ltv`.
  financingRatioBasis: { present: 'BOTH_WHEN_LEVERED', type: 'TOTAL_ACQUISITION_COST | TOTAL_PROJECT_COST' },
  financingRatioDenominatorSar: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  requestedDebtRatio: { present: 'BOTH_WHEN_LEVERED', type: 'number 0..1' },
  requestedDebtLimitSar: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  actualDebtToBasisRatio: { present: 'BOTH_WHEN_LEVERED', type: 'number 0..1' },
  actualDebtToBasePurchasePriceRatio: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number | null' },
  legacyLoanSizingConstraint: { present: 'BOTH_WHEN_LEVERED', type: 'LTV | LTC | DSCR' },
  loanSizingConstraint: { present: 'BOTH_WHEN_LEVERED', type: 'LTC | DSCR' },

  ltvLoanLimit: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number (legacy field name; acquisition-cost based)' },
  dscrLoanLimit: { present: 'EXISTING_BUILDING_ONLY_WHEN_LEVERED', type: 'number' },
  ltcPrincipalLimit: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },
  constructionDebtFraction: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number 0..1' },

  // P20 / #399: principal LTC and all-in completion debt are separate concepts.
  // The current model treats capitalized construction interest as outside the
  // principal LTC cap. These fields disclose that convention without claiming
  // it matches any lender term sheet or an all-in LTC covenant.
  principalLtc: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number 0..1' },
  effectiveCompletionDebtToCost: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number >= 0' },
  capitalizedInterestTreatment: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'EXCLUDED_FROM_PRINCIPAL_LTC_CAP' },
  allInCompletionDebtExceedsPrincipalLtcCap: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'boolean' },

  tenorMonths: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  gracePeriodMonths: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  graceType: { present: 'BOTH_WHEN_LEVERED', type: 'INTEREST_ONLY | CAPITALIZED' },
  balloonPct: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  balloonAmount: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  scheduledMonthlyPayment: { present: 'BOTH_WHEN_LEVERED', type: 'number' },
  annualDebtService: { present: 'BOTH_WHEN_LEVERED', type: 'number[]' },
  annualDebtSchedule: { present: 'BOTH_WHEN_LEVERED', type: 'object[]' },
  debtServiceBasis: { present: 'BOTH_WHEN_LEVERED', type: 'YEAR_1_ACTUAL' },
  debtServicePeak: { present: 'BOTH_WHEN_LEVERED', type: 'number' },

  initialEquityRequired: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },
  totalConstructionEquity: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },
  termRefinanceBalance: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },
  capitalizedConstructionInterest: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'number' },
  constructionDebtSchedule: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'object[]' },
  annualConstructionDebtDraws: { present: 'LAND_DEVELOPMENT_ONLY_WHEN_LEVERED', type: 'object[]' },
});
module.exports = { FINANCING_RESULT_FIELDS };
