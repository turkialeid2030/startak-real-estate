// src/engines/index.js -- MODULAR ENGINE ENTRYPOINT.
// Single production entry point selecting the correct study engine and applying
// canonical post-calculation financing remediation where implemented.
const { calcExistingBuilding, VACANCY_MONTHS_MAP } = require('./valuation/existing-building');
const { calcLandDevelopment } = require('./valuation/land-development');
const { applyFinancingRemediation } = require('./financing/remediation-wave-b');
const { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE } = require('../contracts/study-type');
const { validateEngineInputs } = require('../validation/numeric-safety');
const { validateSupportedFinancialHorizons } = require('../validation/financial-horizon-support');

const PRICE_BASIS_VERSION = 'PRICE_BASIS_V1';

function buildPriceBasis(studyType) {
  if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
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

/**
 * calculateInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion })
 * Validates inputs, executes the study engine, then applies any versioned
 * canonical financing remediation. assumptionModelVersion is deal-envelope
 * metadata and is never injected into the economic inputs object.
 */
function calculateInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion }) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new Error(`calculateInvestmentCase: unknown studyType "${studyType}" -- must be one of ${Object.values(STUDY_TYPE).join(', ')}`);
  }
  const engineInputs = leverageEnabled === undefined ? { ...inputs } : { ...inputs, leverageEnabled };
  validateEngineInputs(engineInputs, { studyType });
  validateSupportedFinancialHorizons(engineInputs, { studyType });
  const rawResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? calcExistingBuilding(engineInputs, { assumptionModelVersion })
    : calcLandDevelopment(engineInputs);
  const remediatedResult = applyFinancingRemediation({
    studyType,
    inputs: engineInputs,
    engineResult: rawResult,
    assumptionModelVersion,
  });

  // #398: This metadata discloses the exact accounting/threshold basis of the
  // legacy "max justified price" metrics. It is intentionally descriptive and
  // does not recalculate the metric or imply that all financial hard gates have
  // been solved at the returned price.
  return {
    ...remediatedResult,
    priceBasis: buildPriceBasis(studyType),
  };
}

module.exports = {
  calculateInvestmentCase,
  STUDY_TYPE,
  STUDY_TYPE_TO_LEGACY_MODE,
  VACANCY_MONTHS_MAP,
  PRICE_BASIS_VERSION,
};
