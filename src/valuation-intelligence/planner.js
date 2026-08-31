'use strict';

const { ASSET_CLASS, INCOME_MODEL } = require('../project-model/project-profile');
const { VALUATION_METHOD } = require('./contracts');

const METHOD_APPLICABILITY = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  REQUIRES_ASSET_ADAPTER: 'REQUIRES_ASSET_ADAPTER',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const ASSET_REQUIREMENTS = Object.freeze({
  [ASSET_CLASS.LAND]: ['landArea', 'landUse', 'access', 'surroundingRoads', 'comparableLandEvidence'],
  [ASSET_CLASS.OFFICE]: ['netLeasableArea', 'occupancy', 'rentEvidence', 'operatingExpenses', 'buildingAge', 'parking'],
  [ASSET_CLASS.RETAIL]: ['netLeasableArea', 'occupancy', 'rentEvidence', 'operatingExpenses', 'buildingAge', 'parking', 'managementAndSecurity'],
  [ASSET_CLASS.INDUSTRIAL_LOGISTICS]: ['builtArea', 'netLeasableArea', 'rentEvidence', 'operatingExpenses', 'buildingAge', 'condition', 'access', 'parkingAndYard'],
  [ASSET_CLASS.HOSPITALITY]: ['roomCount', 'occupancy', 'averageDailyRate', 'seasonality', 'operatingExpenses', 'operatingIncome'],
  [ASSET_CLASS.RESIDENTIAL]: ['unitCount', 'saleOrRentEvidence', 'occupancyOrAbsorption', 'operatingExpenses'],
  [ASSET_CLASS.HEALTHCARE]: ['builtArea', 'operatingModel', 'incomeEvidence', 'specializedFitout'],
  [ASSET_CLASS.EDUCATION]: ['builtArea', 'operatingModel', 'incomeEvidence', 'specializedFitout'],
  [ASSET_CLASS.DATA_CENTER]: ['builtArea', 'operatingModel', 'incomeEvidence', 'specializedInfrastructure'],
  [ASSET_CLASS.PARKING]: ['spaceCount', 'utilization', 'rateEvidence', 'operatingExpenses'],
  [ASSET_CLASS.SPECIAL_PURPOSE]: ['specializedUse', 'replacementCostEvidence', 'incomeModel'],
  [ASSET_CLASS.MIXED_USE]: ['componentMix', 'componentAreas', 'componentIncomeModels'],
  [ASSET_CLASS.OTHER]: ['customAssetDefinition', 'marketEvidence', 'incomeModel'],
});

function method(method, applicability, reason) {
  return Object.freeze({ method, applicability, reason });
}

function planValuationMethods(projectProfile) {
  if (!projectProfile || typeof projectProfile !== 'object' || !Array.isArray(projectProfile.assetClasses)) {
    throw new TypeError('projectProfile is required');
  }

  const assetSet = new Set(projectProfile.assetClasses);
  const methods = [];

  methods.push(method(
    VALUATION_METHOD.MARKET_COMPARABLE,
    METHOD_APPLICABILITY.CANDIDATE,
    'Market evidence is a universal cross-check when sufficiently comparable observable evidence exists.',
  ));

  if (projectProfile.traits?.hasBuiltAsset) {
    methods.push(method(
      VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
      METHOD_APPLICABILITY.CANDIDATE,
      'Built assets may support a depreciated replacement cost indication when land, replacement cost, and depreciation evidence are available.',
    ));
  } else {
    methods.push(method(
      VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
      METHOD_APPLICABILITY.NOT_APPLICABLE,
      'No built asset is present in the project profile.',
    ));
  }

  const isHospitalityOperatingBusiness = assetSet.has(ASSET_CLASS.HOSPITALITY) && projectProfile.incomeModel === INCOME_MODEL.OPERATING_BUSINESS;
  const otherOperatingBusiness = projectProfile.incomeModel === INCOME_MODEL.OPERATING_BUSINESS && !assetSet.has(ASSET_CLASS.HOSPITALITY);

  if (isHospitalityOperatingBusiness || otherOperatingBusiness) {
    methods.push(method(
      VALUATION_METHOD.INCOME_OPERATING_BUSINESS,
      METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER,
      'Operating-business income requires asset-specific normalization before valuation; generic lease capitalization must not be substituted silently.',
    ));
    methods.push(method(
      VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER,
      'Direct capitalization requires an explicit normalized property-income basis distinct from raw operating-business revenue.',
    ));
  } else if (projectProfile.traits?.incomeProducing) {
    methods.push(method(
      VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      METHOD_APPLICABILITY.CANDIDATE,
      'Income-producing property may support direct capitalization when normalized NOI and market-supported capitalization rate are evidenced.',
    ));
  } else {
    methods.push(method(
      VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      METHOD_APPLICABILITY.NOT_APPLICABLE,
      'The project profile does not indicate an income-producing property model.',
    ));
  }

  if (projectProfile.traits?.developmentOrRepositioning || projectProfile.traits?.landOnly) {
    methods.push(method(
      VALUATION_METHOD.RESIDUAL,
      METHOD_APPLICABILITY.CANDIDATE,
      'Development or land optionality may support a residual indication when completed value, costs, profit, timing, and discount evidence are explicit.',
    ));
  } else {
    methods.push(method(
      VALUATION_METHOD.RESIDUAL,
      METHOD_APPLICABILITY.NOT_APPLICABLE,
      'No development or repositioning trait requires a residual land/development indication.',
    ));
  }

  if (projectProfile.traits?.incomeProducing) {
    methods.push(method(
      VALUATION_METHOD.INCOME_DCF,
      METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER,
      'DCF remains a planned adapter path for time-varying income; v1 does not silently replace direct capitalization with an unqualified DCF implementation.',
    ));
  }

  const requiredEvidence = [...new Set(projectProfile.assetClasses.flatMap((assetClass) => ASSET_REQUIREMENTS[assetClass] || []))];

  return Object.freeze({
    schemaVersion: 1,
    projectId: projectProfile.projectId,
    methods,
    requiredEvidence,
    routingBasis: {
      assetClasses: [...projectProfile.assetClasses],
      lifecycleStage: projectProfile.lifecycleStage,
      investmentStrategy: projectProfile.investmentStrategy,
      incomeModel: projectProfile.incomeModel,
    },
    semantics: 'Method planning is derived from project characteristics, never from project name or a named calibration case.',
  });
}

module.exports = {
  METHOD_APPLICABILITY,
  ASSET_REQUIREMENTS,
  planValuationMethods,
};
