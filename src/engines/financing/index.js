'use strict';

// src/engines/financing/index.js -- SELECTOR FACADE.
// Selects financing-related fields from an already-computed canonical result.
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
    constructionLoanBalance: engineResult.constructionLoanBalance,
    financingEngineVersion: engineResult.financingEngineVersion,
    financingModelType: engineResult.financingModelType,
    financingModelBoundary: engineResult.financingModelBoundary,
    exactContractModel: engineResult.exactContractModel,
    loanSizingConstraint: engineResult.loanSizingConstraint,
    ltvLoanLimit: engineResult.ltvLoanLimit,
    dscrLoanLimit: engineResult.dscrLoanLimit,
    tenorMonths: engineResult.tenorMonths,
    gracePeriodMonths: engineResult.gracePeriodMonths,
    graceType: engineResult.graceType,
    balloonPct: engineResult.balloonPct,
    balloonAmount: engineResult.balloonAmount,
    scheduledMonthlyPayment: engineResult.scheduledMonthlyPayment,
    annualDebtService: engineResult.annualDebtService,
    annualDebtSchedule: engineResult.annualDebtSchedule,
    debtServiceBasis: engineResult.debtServiceBasis,
    debtServicePeak: engineResult.debtServicePeak,
  };
}
module.exports = { selectFinancingResult };
