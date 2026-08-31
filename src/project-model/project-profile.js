'use strict';

const ASSET_CLASS = Object.freeze({
  LAND: 'LAND',
  RESIDENTIAL: 'RESIDENTIAL',
  OFFICE: 'OFFICE',
  RETAIL: 'RETAIL',
  INDUSTRIAL_LOGISTICS: 'INDUSTRIAL_LOGISTICS',
  HOSPITALITY: 'HOSPITALITY',
  HEALTHCARE: 'HEALTHCARE',
  EDUCATION: 'EDUCATION',
  MIXED_USE: 'MIXED_USE',
  PARKING: 'PARKING',
  DATA_CENTER: 'DATA_CENTER',
  SPECIAL_PURPOSE: 'SPECIAL_PURPOSE',
  OTHER: 'OTHER',
});

const LIFECYCLE_STAGE = Object.freeze({
  VACANT: 'VACANT',
  PLANNED: 'PLANNED',
  UNDER_DEVELOPMENT: 'UNDER_DEVELOPMENT',
  EXISTING_VACANT: 'EXISTING_VACANT',
  EXISTING_OPERATING: 'EXISTING_OPERATING',
  STABILIZED: 'STABILIZED',
  REDEVELOPMENT: 'REDEVELOPMENT',
  RENOVATION: 'RENOVATION',
  CONVERSION: 'CONVERSION',
  PORTFOLIO: 'PORTFOLIO',
  OTHER: 'OTHER',
});

const INVESTMENT_STRATEGY = Object.freeze({
  ACQUIRE_HOLD: 'ACQUIRE_HOLD',
  CORE_INCOME: 'CORE_INCOME',
  DEVELOPMENT: 'DEVELOPMENT',
  REDEVELOPMENT: 'REDEVELOPMENT',
  VALUE_ADD: 'VALUE_ADD',
  LEASE: 'LEASE',
  DISPOSAL: 'DISPOSAL',
  REFINANCE: 'REFINANCE',
  JOINT_VENTURE: 'JOINT_VENTURE',
  SALE_LEASEBACK: 'SALE_LEASEBACK',
  OTHER: 'OTHER',
});

const INCOME_MODEL = Object.freeze({
  NONE: 'NONE',
  LEASE_INCOME: 'LEASE_INCOME',
  OPERATING_BUSINESS: 'OPERATING_BUSINESS',
  UNIT_SALES: 'UNIT_SALES',
  MIXED: 'MIXED',
  UNKNOWN: 'UNKNOWN',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function enumValue(value, values, field) {
  if (!Object.values(values).includes(value)) throw new TypeError(`${field} is invalid: ${value}`);
  return value;
}

function createProjectProfile({
  projectId,
  projectName = null,
  assetClasses,
  lifecycleStage,
  investmentStrategy,
  incomeModel = INCOME_MODEL.UNKNOWN,
  customAssetClass = null,
  customLifecycleStage = null,
  customInvestmentStrategy = null,
  jurisdiction = null,
  metadata = {},
}) {
  requiredString(projectId, 'projectId');
  if (!Array.isArray(assetClasses) || assetClasses.length < 1) throw new TypeError('assetClasses must contain at least one asset class');

  const normalizedAssetClasses = [...new Set(assetClasses.map((value) => enumValue(value, ASSET_CLASS, 'assetClass')))];
  enumValue(lifecycleStage, LIFECYCLE_STAGE, 'lifecycleStage');
  enumValue(investmentStrategy, INVESTMENT_STRATEGY, 'investmentStrategy');
  enumValue(incomeModel, INCOME_MODEL, 'incomeModel');

  if (normalizedAssetClasses.includes(ASSET_CLASS.OTHER)) requiredString(customAssetClass, 'customAssetClass');
  if (lifecycleStage === LIFECYCLE_STAGE.OTHER) requiredString(customLifecycleStage, 'customLifecycleStage');
  if (investmentStrategy === INVESTMENT_STRATEGY.OTHER) requiredString(customInvestmentStrategy, 'customInvestmentStrategy');
  if (projectName !== null && projectName !== undefined && typeof projectName !== 'string') throw new TypeError('projectName must be a string or null');
  if (jurisdiction !== null && (typeof jurisdiction !== 'object' || Array.isArray(jurisdiction))) throw new TypeError('jurisdiction must be an object or null');
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('metadata must be an object');

  const landOnly = normalizedAssetClasses.length === 1 && normalizedAssetClasses[0] === ASSET_CLASS.LAND;
  const hasBuiltAsset = normalizedAssetClasses.some((assetClass) => assetClass !== ASSET_CLASS.LAND);
  const developmentLifecycle = [
    LIFECYCLE_STAGE.PLANNED,
    LIFECYCLE_STAGE.UNDER_DEVELOPMENT,
    LIFECYCLE_STAGE.REDEVELOPMENT,
    LIFECYCLE_STAGE.RENOVATION,
    LIFECYCLE_STAGE.CONVERSION,
  ].includes(lifecycleStage);
  const developmentStrategy = [
    INVESTMENT_STRATEGY.DEVELOPMENT,
    INVESTMENT_STRATEGY.REDEVELOPMENT,
    INVESTMENT_STRATEGY.VALUE_ADD,
  ].includes(investmentStrategy);
  const incomeProducing = [INCOME_MODEL.LEASE_INCOME, INCOME_MODEL.OPERATING_BUSINESS, INCOME_MODEL.MIXED].includes(incomeModel);

  return deepFreeze({
    schemaVersion: 1,
    projectId: projectId.trim(),
    projectName: projectName ? projectName.trim() : null,
    assetClasses: normalizedAssetClasses,
    lifecycleStage,
    investmentStrategy,
    incomeModel,
    customAssetClass: customAssetClass ? String(customAssetClass).trim() : null,
    customLifecycleStage: customLifecycleStage ? String(customLifecycleStage).trim() : null,
    customInvestmentStrategy: customInvestmentStrategy ? String(customInvestmentStrategy).trim() : null,
    jurisdiction: jurisdiction ? { ...jurisdiction } : null,
    metadata: { ...metadata },
    traits: {
      landOnly,
      hasBuiltAsset,
      developmentOrRepositioning: developmentLifecycle || developmentStrategy,
      incomeProducing,
      multiAssetOrMixedUse: normalizedAssetClasses.length > 1 || normalizedAssetClasses.includes(ASSET_CLASS.MIXED_USE),
    },
    semantics: 'Universal project classification is independent of project name and does not imply a qualified financial engine exists.',
  });
}

module.exports = {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
};
