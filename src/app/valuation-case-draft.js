'use strict';

const {
  VALUATION_CASE_SCHEMA_VERSION,
  VALUATION_METHOD,
  BASIS_OF_VALUE,
} = require('../valuation-intelligence');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../project-model/project-profile');
const { EXPENSE_TREATMENT } = require('../valuation-intelligence/income-capitalization');

class ValuationCaseDraftError extends Error {
  constructor(reasonCode, field) {
    super(`Valuation case draft is incomplete or invalid: ${reasonCode}${field ? ` (${field})` : ''}`);
    this.name = 'ValuationCaseDraftError';
    this.reasonCode = reasonCode;
    this.field = field || null;
  }
}

function emptyValuationCaseDraft() {
  return {
    projectId: '',
    classification: {
      assetClass: '',
      lifecycleStage: '',
      investmentStrategy: '',
      incomeModel: '',
    },
    incomePolicy: {
      expenseTreatment: '',
      basis: '',
      currency: '',
      valuationDate: '',
    },
    evidencePolicy: {
      enabled: false,
      minEvidenceCount: '',
      maxAssumptionBurdenRatio: '',
      maxLowGradeRatio: '',
    },
    singleMethodPolicy: {
      enabled: false,
      allowedMethod: '',
      justification: '',
    },
  };
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function draftFromValuationCase(valuationCase) {
  if (!valuationCase) return emptyValuationCaseDraft();
  const draft = emptyValuationCaseDraft();
  draft.projectId = valuationCase.projectId || '';
  draft.classification = { ...draft.classification, ...(valuationCase.classification || {}) };
  draft.incomePolicy = { ...draft.incomePolicy, ...(valuationCase.incomePolicy || {}) };
  draft.incomePolicy.valuationDate = valuationCase.incomePolicy?.valuationDate || '';
  if (valuationCase.evidencePolicy) {
    draft.evidencePolicy = {
      enabled: true,
      minEvidenceCount: String(valuationCase.evidencePolicy.minEvidenceCount ?? ''),
      maxAssumptionBurdenRatio: String(valuationCase.evidencePolicy.maxAssumptionBurdenRatio ?? ''),
      maxLowGradeRatio: String(valuationCase.evidencePolicy.maxLowGradeRatio ?? ''),
    };
  }
  if (valuationCase.singleMethodPolicy) {
    draft.singleMethodPolicy = {
      enabled: true,
      allowedMethod: valuationCase.singleMethodPolicy.allowedMethod || '',
      justification: valuationCase.singleMethodPolicy.justification || '',
    };
  }
  return clone(draft);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new ValuationCaseDraftError('REQUIRED_FIELD', field);
  return value.trim();
}

function enumValue(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new ValuationCaseDraftError('INVALID_ENUM', field);
  return value;
}

function finiteNumberString(value, field) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new ValuationCaseDraftError('INVALID_NUMBER', field);
  const text = String(value).trim();
  if (text === '') throw new ValuationCaseDraftError('REQUIRED_FIELD', field);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new ValuationCaseDraftError('INVALID_NUMBER', field);
  return number;
}

function validateEvidencePolicyDraft(policy) {
  if (!policy?.enabled) return null;
  const minEvidenceCount = finiteNumberString(policy.minEvidenceCount, 'evidencePolicy.minEvidenceCount');
  const maxAssumptionBurdenRatio = finiteNumberString(policy.maxAssumptionBurdenRatio, 'evidencePolicy.maxAssumptionBurdenRatio');
  const maxLowGradeRatio = finiteNumberString(policy.maxLowGradeRatio, 'evidencePolicy.maxLowGradeRatio');
  if (!Number.isInteger(minEvidenceCount) || minEvidenceCount < 1) throw new ValuationCaseDraftError('OUT_OF_RANGE', 'evidencePolicy.minEvidenceCount');
  if (maxAssumptionBurdenRatio < 0 || maxAssumptionBurdenRatio > 1) throw new ValuationCaseDraftError('OUT_OF_RANGE', 'evidencePolicy.maxAssumptionBurdenRatio');
  if (maxLowGradeRatio < 0 || maxLowGradeRatio > 1) throw new ValuationCaseDraftError('OUT_OF_RANGE', 'evidencePolicy.maxLowGradeRatio');
  return { minEvidenceCount, maxAssumptionBurdenRatio, maxLowGradeRatio };
}

function validateSingleMethodPolicyDraft(policy) {
  if (!policy?.enabled) return null;
  const allowedMethod = requiredString(policy.allowedMethod, 'singleMethodPolicy.allowedMethod');
  if (!Object.values(VALUATION_METHOD).includes(allowedMethod)) throw new ValuationCaseDraftError('INVALID_ENUM', 'singleMethodPolicy.allowedMethod');
  return {
    allowedMethod,
    justification: requiredString(policy.justification, 'singleMethodPolicy.justification'),
  };
}

function buildValuationCaseFromDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new ValuationCaseDraftError('INVALID_DRAFT', 'draft');
  const classification = draft.classification || {};
  const incomePolicy = draft.incomePolicy || {};

  const valuationCase = {
    schemaVersion: VALUATION_CASE_SCHEMA_VERSION,
    projectId: requiredString(draft.projectId, 'projectId'),
    classification: {
      assetClass: enumValue(classification.assetClass, ASSET_CLASS, 'classification.assetClass'),
      lifecycleStage: enumValue(classification.lifecycleStage, LIFECYCLE_STAGE, 'classification.lifecycleStage'),
      investmentStrategy: enumValue(classification.investmentStrategy, INVESTMENT_STRATEGY, 'classification.investmentStrategy'),
      incomeModel: enumValue(classification.incomeModel, INCOME_MODEL, 'classification.incomeModel'),
    },
    incomePolicy: {
      expenseTreatment: enumValue(incomePolicy.expenseTreatment, EXPENSE_TREATMENT, 'incomePolicy.expenseTreatment'),
      basis: enumValue(incomePolicy.basis, BASIS_OF_VALUE, 'incomePolicy.basis'),
      currency: requiredString(incomePolicy.currency, 'incomePolicy.currency'),
      valuationDate: typeof incomePolicy.valuationDate === 'string' && incomePolicy.valuationDate.trim() ? incomePolicy.valuationDate.trim() : null,
    },
  };

  const evidencePolicy = validateEvidencePolicyDraft(draft.evidencePolicy);
  if (evidencePolicy) valuationCase.evidencePolicy = evidencePolicy;
  const singleMethodPolicy = validateSingleMethodPolicyDraft(draft.singleMethodPolicy);
  if (singleMethodPolicy) valuationCase.singleMethodPolicy = singleMethodPolicy;

  return valuationCase;
}

module.exports = {
  ValuationCaseDraftError,
  emptyValuationCaseDraft,
  draftFromValuationCase,
  buildValuationCaseFromDraft,
};
