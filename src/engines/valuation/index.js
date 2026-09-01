'use strict';

// Selector facade only: no recalculation is performed here.
function selectValuationResult(engineResult, studyType) {
  if (studyType === 'EXISTING_BUILDING') {
    return {
      financialModelVersion: engineResult.financialModelVersion,
      financialModelStatus: engineResult.financialModelStatus,
      totalPurchaseCost: engineResult.totalPurchaseCost,
      costPerSqm: engineResult.costPerSqm,
      NOI: engineResult.NOI,
      firstYearNOI: engineResult.firstYearNOI,
      netYieldOnCost: engineResult.netYieldOnCost,
      netYieldOnPrice: engineResult.netYieldOnPrice,
      cumulativePaybackOnCost: engineResult.paybackOnCost,
      paybackOnPrice: engineResult.paybackOnPrice,
      priceToNoiMultiple: engineResult.priceToNoiMultiple,
      marketValueByIncomeCap: engineResult.marketValueByIncomeCap,
      valueGapVsCost: engineResult.valueGapVsCost,
      exitCapRate: engineResult.exitCapRate,
      terminalSaleValue: engineResult.terminalSaleValue,
      totalAppraisedValue: engineResult.totalAppraisedValue,
      maxJustifiedPrice: engineResult.maxJustifiedPrice,
    };
  }
  return {
    financialModelVersion: engineResult.financialModelVersion,
    financialModelStatus: engineResult.financialModelStatus,
    totalProjectCost: engineResult.totalProjectCost,
    costPerSqm: engineResult.costPerSqm,
    stabilizedNOI: engineResult.stabilizedNOI,
    firstOperatingYearNOI: engineResult.firstOperatingYearNOI,
    capRateOnCost: engineResult.capRateOnCost,
    cumulativeProjectPaybackYears: engineResult.simplePaybackYears,
    projectCostToNoiMultiple: engineResult.projectCostToNoiMultiple,
    marketValueAfterCompletion: engineResult.marketValueAfterCompletion,
    valueSurplusOverCost: engineResult.valueSurplusOverCost,
    leaseUpMonths: engineResult.leaseUpMonths,
    terminalExitValue: engineResult.terminalExitValue,
    maxJustifiedLandPricePerSqm: engineResult.maxJustifiedLandPricePerSqm,
  };
}
module.exports = { selectValuationResult };
