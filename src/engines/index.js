// src/engines/index.js -- MODULAR ENGINE ENTRYPOINT.
// Single production entry point selecting the correct study engine and applying
// canonical post-calculation financing remediation where implemented.
const { calcExistingBuilding, VACANCY_MONTHS_MAP } = require('./valuation/existing-building');
const { calcLandDevelopment } = require('./valuation/land-development');
const { applyExistingBuildingExitCostGovernance } = require('./valuation/existing-building-exit-cost-governance');
const { applyExistingBuildingLeaseRollForwardGovernance } = require('./valuation/existing-building-lease-roll-forward-governance');
const { applyFinancingRemediation } = require('./financing/remediation-wave-b');
const { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE } = require('../contracts/study-type');
const { validateEngineInputs } = require('../validation/numeric-safety');
const { validateSupportedFinancialHorizons } = require('../validation/financial-horizon-support');

const PRICE_BASIS_VERSION = 'PRICE_BASIS_V1';
const COST_APPROACH_INDICATION_BASIS = 'UNDEPRECIATED_REPLACEMENT_COST_NEW_PLUS_LAND_INPUT';

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
    bindingRateFormula: 'CALENDAR_CUMULATIVE_OPERATING_PAYBACK_INVERTED_OVER_CONSTRUCTION_AND_NOI',
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

function buildExistingBuildingCostApproachSemantics(result) {
  return Object.freeze({
    costApproachIndicationBasis: COST_APPROACH_INDICATION_BASIS,
    costApproachIndication: result.totalAppraisedValue,
    costApproachUsesBuildingAge: false,
    costApproachAccreditedValuation: false,
    costApproachMarketValueDetermined: false,
    totalAppraisedValueLegacyAlias: true,
  });
}

function normalizeZeroDebtEconomics(studyType, inputs, result) {
  // P13: a financing toggle with an explicit zero debt ratio is economically
  // unlevered. It must not manufacture a leverage risk premium or debt-only
  // decision gates. Preserve the engine's unlevered cash-flow result as the
  // authoritative economic case while retaining zero-valued debt evidence.
  const baseDiscountRate = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? inputs.discountRate
    : inputs.hurdleRate;

  // An upstream governed hold (for example missing V2 exit evidence or P23
  // lease rollover) remains non-decisionable even when requested debt is 0%.
  // Zero-debt normalization must not re-materialize a levered cash-flow series
  // from an incomplete case merely because economics are otherwise unlevered.
  if (result && result.decisionStatus === 'INCOMPLETE_INPUTS') {
    return {
      ...result,
      loanAmount: 0,
      debtService: 0,
      dscrMin: null,
      leveredCashflows: null,
      leveredIRR: null,
      leveredNPV: null,
      equityDiscountRate: baseDiscountRate,
      leveredIrrDiagnostics: null,
      leveredMirr: null,
      leveredIrrReliability: null,
    };
  }

  const neutralCashflows = Array.isArray(result.cashflows) ? [...result.cashflows] : result.cashflows;
  return {
    ...result,
    loanAmount: 0,
    debtService: 0,
    dscrMin: null,
    leveredCashflows: neutralCashflows,
    leveredIRR: result.irr,
    leveredNPV: result.npv,
    equityDiscountRate: baseDiscountRate,
    leveredIrrDiagnostics: result.irrDiagnostics || null,
    leveredMirr: result.mirr == null ? null : result.mirr,
    leveredIrrReliability: result.irrReliability == null ? null : result.irrReliability,
  };
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

  const leverageOverrideProvided = leverageEnabled !== undefined;
  const requestedLeverageEnabled = leverageOverrideProvided
    ? leverageEnabled === true
    : inputs.leverageEnabled;
  const zeroDebtRequest = requestedLeverageEnabled === true && Number(inputs.ltv) === 0;

  // Preserve the existing fail-closed contract for missing required inputs.
  // Only replace leverageEnabled when an explicit zero-debt request is present
  // (or when the caller explicitly supplied the leverage override). A missing
  // leverageEnabled field therefore remains missing and validation still rejects it.
  let engineInputs;
  if (leverageOverrideProvided) {
    engineInputs = {
      ...inputs,
      leverageEnabled: zeroDebtRequest ? false : requestedLeverageEnabled,
    };
  } else if (zeroDebtRequest) {
    engineInputs = { ...inputs, leverageEnabled: false };
  } else {
    engineInputs = { ...inputs };
  }

  validateEngineInputs(engineInputs, { studyType });
  validateSupportedFinancialHorizons(engineInputs, { studyType });
  const baseResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? calcExistingBuilding(engineInputs, { assumptionModelVersion })
    : calcLandDevelopment(engineInputs);

  // P22 / #402: acquisition transfer-cost economics and seller-borne exit-cost
  // economics are separate assumptions for Existing Building. Apply the exit
  // governance layer before financing so both unlevered and Wave-B levered cash
  // flows use the same governed terminal proceeds. LEGACY may preserve the old
  // acquisition-rate fallback; V2 fails closed without an explicit exit rate.
  const exitGovernedResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? applyExistingBuildingExitCostGovernance({
        inputs: engineInputs,
        engineResult: baseResult,
        assumptionModelVersion,
      })
    : baseResult;

  // P23 / #456: the raw Existing Building engine does not model contractual
  // lease rollover after leaseYears. Apply lease-horizon governance before any
  // financing overlay so an unsupported V2 post-expiry case cannot manufacture
  // levered NPV/IRR or a recommendation. Legacy economics remain compatibility
  // evidence and carry an explicit rollover disclosure status.
  const governedResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? applyExistingBuildingLeaseRollForwardGovernance({
        inputs: engineInputs,
        engineResult: exitGovernedResult,
        assumptionModelVersion,
      })
    : exitGovernedResult;

  const remediatedResult = applyFinancingRemediation({
    studyType,
    inputs: engineInputs,
    engineResult: governedResult,
    assumptionModelVersion,
  });
  const economicResult = zeroDebtRequest
    ? normalizeZeroDebtEconomics(studyType, engineInputs, remediatedResult)
    : remediatedResult;

  // #398 / P12: disclose the exact threshold basis of the legacy maximum-price
  // metrics. This metadata is descriptive only: it does not recalculate the
  // numeric metric and must not imply that all financial hard gates are solved.
  const canonicalMetadata = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? buildExistingBuildingCostApproachSemantics(economicResult)
    : {};

  // P24 / #458: totalAppraisedValue is retained as a legacy numeric alias only.
  // Its arithmetic is replacement cost new plus the user-entered land-value
  // indication; it does not use building age, determine market value, or create
  // an accredited valuation. Do not invent depreciation/obsolescence economics.
  return {
    ...economicResult,
    ...canonicalMetadata,
    priceBasis: buildPriceBasis(studyType),
  };
}

module.exports = {
  calculateInvestmentCase,
  STUDY_TYPE,
  STUDY_TYPE_TO_LEGACY_MODE,
  VACANCY_MONTHS_MAP,
  PRICE_BASIS_VERSION,
  COST_APPROACH_INDICATION_BASIS,
};