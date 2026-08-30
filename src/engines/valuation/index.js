// src/engines/valuation/index.js -- SELECTOR FACADE.
// Selects/reshapes valuation-related fields from an already-computed engine
// result. Performs ZERO recalculation -- every value here is read directly off
// the result object produced by the canonical study engine (via src/engines/index.js).
function selectValuationResult(engineResult, studyType) {
  if (studyType === 'EXISTING_BUILDING') {
    return {
      totalPurchaseCost: engineResult.totalPurchaseCost,
      costPerSqm: engineResult.costPerSqm,
      NOI: engineResult.NOI,
      netYieldOnPrice: engineResult.netYieldOnPrice,
      paybackOnPrice: engineResult.paybackOnPrice,
      marketValueByIncomeCap: engineResult.marketValueByIncomeCap,
      valueGapVsCost: engineResult.valueGapVsCost,
      totalAppraisedValue: engineResult.totalAppraisedValue,
      maxJustifiedPrice: engineResult.maxJustifiedPrice,
    };
  }
  return {
    totalProjectCost: engineResult.totalProjectCost,
    costPerSqm: engineResult.costPerSqm,
    stabilizedNOI: engineResult.stabilizedNOI,
    capRateOnCost: engineResult.capRateOnCost,
    simplePaybackYears: engineResult.simplePaybackYears,
    marketValueAfterCompletion: engineResult.marketValueAfterCompletion,
    valueSurplusOverCost: engineResult.valueSurplusOverCost,
    maxJustifiedLandPricePerSqm: engineResult.maxJustifiedLandPricePerSqm,
  };
}
module.exports = { selectValuationResult };
