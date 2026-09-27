'use strict';

const PRICE_BASIS_VERSION = 'PRICE_BASIS_V1';

function buildExistingBuildingPriceBasis() {
  return Object.freeze({
    version: PRICE_BASIS_VERSION,
    metric: 'maxJustifiedPrice',
    outputBasis: 'BASE_BUILDING_PURCHASE_PRICE_SAR',
    thresholdBasis: Object.freeze(['MIN_NET_YIELD_THRESHOLD', 'MAX_PAYBACK_THRESHOLD']),
    bindingRateFormula: 'MAX_MIN_YIELD_OR_RECIPROCAL_MAX_PAYBACK',
    acquisitionLoadsIncludedInSolver: true,
    fixedCostsIncludedInSolver: Object.freeze(['inspectionCost', 'valuationCost']),
    solvesAllFinancialHardGates: false,
    excludedDecisionGates: Object.freeze([
      'IRR_MEETS_HURDLE',
      'NPV_NON_NEGATIVE',
      'INCOME_VALUE_COVERS_COST',
      'DSCR_MINIMUM_WHEN_FINANCED',
      'LEVERED_NPV_NON_NEGATIVE_WHEN_FINANCED',
    ]),
  });
}

function buildLandDevelopmentPriceBasis() {
  return Object.freeze({
    version: PRICE_BASIS_VERSION,
    metric: 'maxJustifiedLandPricePerSqm',
    outputBasis: 'RAW_LAND_MARKET_PRICE_PER_SQM_SAR',
    thresholdBasis: Object.freeze(['MAX_PAYBACK_THRESHOLD']),
    bindingRateFormula: 'RECIPROCAL_MAX_PAYBACK',
    acquisitionLoadsIncludedInSolver: true,
    fixedCostsIncludedInSolver: Object.freeze(['engineeringCost', 'landValuationCost']),
    constructionCostIncludedInSolver: true,
    solvesAllFinancialHardGates: false,
    excludedDecisionGates: Object.freeze([
      'IRR_MEETS_HURDLE',
      'NPV_NON_NEGATIVE',
      'COMPLETION_VALUE_COVERS_COST',
      'DSCR_MINIMUM_WHEN_FINANCED',
      'LEVERED_NPV_NON_NEGATIVE_WHEN_FINANCED',
    ]),
  });
}

module.exports = {
  PRICE_BASIS_VERSION,
  buildExistingBuildingPriceBasis,
  buildLandDevelopmentPriceBasis,
};
