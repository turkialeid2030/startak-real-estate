// src/contracts/financing-result.js -- maps ACTUAL current financing output fields.
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
});
module.exports = { FINANCING_RESULT_FIELDS };
