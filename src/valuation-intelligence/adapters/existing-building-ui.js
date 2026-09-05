'use strict';

const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
} = require('../../project-model/project-profile');
const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
} = require('../contracts');
const { EXPENSE_TREATMENT } = require('../income-capitalization');
const { createValuationRequest } = require('../valuation-request');

const SUPPORTED_EXISTING_BUILDING_ASSET_CLASSES = Object.freeze([
  ASSET_CLASS.OFFICE,
  ASSET_CLASS.RETAIL,
  ASSET_CLASS.RESIDENTIAL,
]);

const DIRECT_CAP_SUPPORTED_BASIS = Object.freeze([
  BASIS_OF_VALUE.MARKET_VALUE,
  BASIS_OF_VALUE.FAIR_VALUE,
  BASIS_OF_VALUE.INVESTMENT_VALUE,
]);

const COST_SUPPORTED_BASIS = DIRECT_CAP_SUPPORTED_BASIS;

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function optionalString(value, field) {
  if (value === null || value === undefined) return null;
  return requireString(value, field);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function requireSupportedClassification(classification) {
  requireObject(classification, 'classification');
  const assetClass = classification.assetClass;
  if (!SUPPORTED_EXISTING_BUILDING_ASSET_CLASSES.includes(assetClass)) {
    throw new TypeError(`classification.assetClass is not supported by existing-building-ui adapter: ${assetClass}`);
  }
  if (!Object.values(LIFECYCLE_STAGE).includes(classification.lifecycleStage)) {
    throw new TypeError(`classification.lifecycleStage is invalid: ${classification.lifecycleStage}`);
  }
  if (!Object.values(INVESTMENT_STRATEGY).includes(classification.investmentStrategy)) {
    throw new TypeError(`classification.investmentStrategy is invalid: ${classification.investmentStrategy}`);
  }
  if (classification.incomeModel !== INCOME_MODEL.LEASE_INCOME) {
    throw new TypeError('existing-building-ui adapter currently requires classification.incomeModel=LEASE_INCOME');
  }
  return classification;
}

function requireIncomePolicy(policy) {
  requireObject(policy, 'incomePolicy');
  if (!Object.values(EXPENSE_TREATMENT).includes(policy.expenseTreatment)) {
    throw new TypeError(`incomePolicy.expenseTreatment is invalid: ${policy.expenseTreatment}`);
  }
  if (!DIRECT_CAP_SUPPORTED_BASIS.includes(policy.basis)) {
    throw new TypeError(`incomePolicy.basis is unsupported: ${policy.basis}`);
  }
  requireString(policy.currency, 'incomePolicy.currency');
  optionalString(policy.valuationDate, 'incomePolicy.valuationDate');
  return policy;
}

function defaultUnverifiedDescriptor(sourceRef, note) {
  return {
    grade: EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,
    status: INPUT_STATUS.UNVERIFIED,
    sourceType: 'STARTAK_EXISTING_BUILDING_UI',
    sourceRef: sourceRef || null,
    observedAt: null,
    note,
  };
}

function evidenceDescriptor(overrides, sourceRef, note) {
  if (overrides === undefined || overrides === null) return defaultUnverifiedDescriptor(sourceRef, note);
  requireObject(overrides, 'evidence descriptor');
  return clone(overrides);
}

function buildIncomeMethodInput({ legacyInput, legacyResult, incomePolicy, evidence = {} }) {
  requireIncomePolicy(incomePolicy);
  finiteNumber(legacyResult.totalAnnualIncome, 'legacyResult.totalAnnualIncome');
  finiteNumber(legacyResult.opexAmount, 'legacyResult.opexAmount');
  finiteNumber(legacyInput.marketCapRate, 'legacyInput.marketCapRate');

  return {
    effectiveGrossIncome: legacyResult.totalAnnualIncome,
    operatingExpenses: legacyResult.opexAmount,
    capitalizationRate: legacyInput.marketCapRate,
    expenseTreatment: incomePolicy.expenseTreatment,
    incomeEvidence: evidenceDescriptor(
      evidence.income,
      'existing-building:totalAnnualIncome',
      'Derived from the current STARTAK existing-building input set through the unchanged legacy calculation path; not independently verified by this adapter.',
    ),
    expenseEvidence: evidenceDescriptor(
      evidence.expenses,
      'existing-building:opexAmount',
      'Derived from the current STARTAK existing-building input set through the unchanged legacy calculation path; not independently verified by this adapter.',
    ),
    capRateEvidence: evidenceDescriptor(
      evidence.capRate,
      'existing-building:marketCapRate',
      'Copied from the current STARTAK existing-building UI input; not independently verified by this adapter.',
    ),
    basis: incomePolicy.basis,
    valuationDate: incomePolicy.valuationDate || null,
    currency: incomePolicy.currency,
  };
}

function buildCostMethodInput({ legacyResult, costPolicy, evidence = {} }) {
  if (costPolicy === null || costPolicy === undefined) return null;
  requireObject(costPolicy, 'costPolicy');
  finiteNumber(costPolicy.depreciationRate, 'costPolicy.depreciationRate');
  if (costPolicy.depreciationRate < 0 || costPolicy.depreciationRate > 1) {
    throw new RangeError('costPolicy.depreciationRate must be in [0,1]');
  }
  if (!Array.isArray(costPolicy.indirectCosts)) throw new TypeError('costPolicy.indirectCosts must be an explicit array');
  if (!COST_SUPPORTED_BASIS.includes(costPolicy.basis)) throw new TypeError(`costPolicy.basis is unsupported: ${costPolicy.basis}`);
  requireString(costPolicy.currency, 'costPolicy.currency');
  optionalString(costPolicy.valuationDate, 'costPolicy.valuationDate');
  finiteNumber(legacyResult.currentLandValue, 'legacyResult.currentLandValue');
  finiteNumber(legacyResult.totalReplacementConstructionValue, 'legacyResult.totalReplacementConstructionValue');

  return {
    landValue: legacyResult.currentLandValue,
    directReplacementCost: legacyResult.totalReplacementConstructionValue,
    indirectCosts: clone(costPolicy.indirectCosts),
    depreciationRate: costPolicy.depreciationRate,
    landEvidence: evidenceDescriptor(
      evidence.landValue,
      'existing-building:currentLandValue',
      'Copied from the unchanged legacy existing-building result; the underlying land-price input remains client supplied unless stronger evidence is provided.',
    ),
    replacementCostEvidence: evidenceDescriptor(
      evidence.replacementCost,
      'existing-building:totalReplacementConstructionValue',
      'Copied from the unchanged legacy existing-building result; the underlying construction-cost inputs remain client supplied unless stronger evidence is provided.',
    ),
    depreciationEvidence: evidenceDescriptor(
      evidence.depreciationRate,
      'existing-building:depreciationRate',
      'Explicit cost-approach depreciation policy supplied to the adapter; no age-life depreciation default is inferred.',
    ),
    basis: costPolicy.basis,
    valuationDate: costPolicy.valuationDate || null,
    currency: costPolicy.currency,
  };
}

function createExistingBuildingValuationRequest({
  caseId,
  projectId,
  classification,
  legacyInput,
  legacyResult,
  incomePolicy,
  marketComparableInput = null,
  costPolicy = null,
  evidence = {},
  evidencePolicy = null,
  criticalEvidenceRequirements = {},
  singleMethodPolicy = null,
  reconciliationPolicy = null,
} = {}) {
  requireString(caseId, 'caseId');
  requireString(projectId, 'projectId');
  requireObject(legacyInput, 'legacyInput');
  requireObject(legacyResult, 'legacyResult');
  requireObject(evidence, 'evidence');
  requireSupportedClassification(classification);
  requireIncomePolicy(incomePolicy);

  const projectProfile = createProjectProfile({
    projectId,
    projectName: typeof legacyInput.projectTitle === 'string' && legacyInput.projectTitle.trim() ? legacyInput.projectTitle.trim() : null,
    assetClasses: [classification.assetClass],
    lifecycleStage: classification.lifecycleStage,
    investmentStrategy: classification.investmentStrategy,
    incomeModel: classification.incomeModel,
    jurisdiction: classification.jurisdiction ? clone(classification.jurisdiction) : null,
    metadata: {
      sourceAdapter: 'EXISTING_BUILDING_UI_V1',
      legacyCalculationPreserved: true,
    },
  });

  const methodInputs = {
    [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: buildIncomeMethodInput({ legacyInput, legacyResult, incomePolicy, evidence }),
  };

  if (marketComparableInput !== null && marketComparableInput !== undefined) {
    requireObject(marketComparableInput, 'marketComparableInput');
    methodInputs[VALUATION_METHOD.MARKET_COMPARABLE] = clone(marketComparableInput);
  }

  const costInput = buildCostMethodInput({ legacyResult, costPolicy, evidence });
  if (costInput) methodInputs[VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT] = costInput;

  return createValuationRequest({
    caseId,
    projectId,
    projectProfile,
    methodInputs,
    evidencePolicy,
    criticalEvidenceRequirements,
    singleMethodPolicy,
    reconciliationPolicy,
  });
}

module.exports = {
  SUPPORTED_EXISTING_BUILDING_ASSET_CLASSES,
  createExistingBuildingValuationRequest,
};
