// src/engines/financing/index.js -- SELECTOR FACADE.
// Selects/reshapes financing-related fields from an already-computed engine
// result. Performs ZERO recalculation.
function selectFinancingResult(engineResult) {
  return {
    loanAmount: engineResult.loanAmount,
    equityRequired: engineResult.equityRequired,
    debtService: engineResult.debtService,
    dscrMin: engineResult.dscrMin,
    leveredCashflows: engineResult.leveredCashflows,
    leveredIRR: engineResult.leveredIRR,
    leveredNPV: engineResult.leveredNPV,
    equityDiscountRate: engineResult.equityDiscountRate,
    constructionLoanBalance: engineResult.constructionLoanBalance, // undefined for building -- preserved as-is, not defaulted
  };
}
module.exports = { selectFinancingResult };
