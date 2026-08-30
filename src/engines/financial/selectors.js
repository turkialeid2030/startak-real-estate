// src/engines/financial/selectors.js -- SELECTOR FACADE for cash-flow/NPV/IRR views.
function selectFinancialResult(engineResult) {
  return {
    cashflows: engineResult.cashflows,
    irr: engineResult.irr,
    npv: engineResult.npv,
  };
}
module.exports = { selectFinancialResult };
