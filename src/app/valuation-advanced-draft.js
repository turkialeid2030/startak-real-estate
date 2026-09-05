'use strict';

const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  createComparable,
} = require('../valuation-intelligence');

class AdvancedValuationDraftError extends Error {
  constructor(reasonCode, field) {
    super(`Advanced valuation draft is incomplete or invalid: ${reasonCode}${field ? ` (${field})` : ''}`);
    this.name = 'AdvancedValuationDraftError';
    this.reasonCode = reasonCode;
    this.field = field || null;
  }
}

const EVIDENCE_KEYS = Object.freeze([
  'income',
  'expenses',
  'capRate',
  'landValue',
  'replacementCost',
  'depreciationRate',
]);

const RECONCILABLE_METHODS = Object.freeze([
  VALUATION_METHOD.MARKET_COMPARABLE,
  VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
  VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
]);

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function emptyEvidenceDescriptorDraft() {
  return {
    enabled: false,
    grade: '',
    status: '',
    sourceType: '',
    sourceRef: '',
    observedAt: '',
    note: '',
  };
}

function emptyComparableDraft() {
  return {
    comparableId: '',
    unitValue: '',
    transactionStatus: '',
    evidenceGrade: '',
    weight: '',
    transactionDate: '',
    sourceRef: '',
    adjustmentsJson: '[]',
    metadataJson: '{}',
  };
}

function emptyAdvancedValuationDraft() {
  return {
    evidence: Object.fromEntries(EVIDENCE_KEYS.map((key) => [key, emptyEvidenceDescriptorDraft()])),
    preservedEvidenceExtras: {},
    marketComparable: {
      enabled: false,
      subjectArea: '',
      basis: '',
      weightingPolicy: '',
      valuationDate: '',
      currency: '',
      comparables: [],
    },
    cost: {
      enabled: false,
      depreciationRate: '',
      indirectCostsJson: '[]',
      basis: '',
      valuationDate: '',
      currency: '',
    },
    reconciliation: {
      enabled: false,
      dispersionThreshold: '',
      methodWeights: Object.fromEntries(RECONCILABLE_METHODS.map((method) => [method, ''])),
    },
  };
}

function evidenceDescriptorDraft(descriptor) {
  if (!descriptor) return emptyEvidenceDescriptorDraft();
  return {
    enabled: true,
    grade: descriptor.grade || '',
    status: descriptor.status || '',
    sourceType: descriptor.sourceType || '',
    sourceRef: descriptor.sourceRef || '',
    observedAt: descriptor.observedAt || '',
    note: descriptor.note || '',
  };
}

function comparableDraft(comparable) {
  return {
    comparableId: comparable.comparableId || '',
    unitValue: comparable.unitValue === null || comparable.unitValue === undefined ? '' : String(comparable.unitValue),
    transactionStatus: comparable.transactionStatus || '',
    evidenceGrade: comparable.evidenceGrade || '',
    weight: comparable.weight === null || comparable.weight === undefined ? '' : String(comparable.weight),
    transactionDate: comparable.transactionDate || '',
    sourceRef: comparable.sourceRef || '',
    adjustmentsJson: JSON.stringify(comparable.adjustments || []),
    metadataJson: JSON.stringify(comparable.metadata || {}),
  };
}

function advancedDraftFromValuationCase(valuationCase) {
  const draft = emptyAdvancedValuationDraft();
  if (!valuationCase || typeof valuationCase !== 'object' || Array.isArray(valuationCase)) return draft;

  const evidence = valuationCase.evidence && typeof valuationCase.evidence === 'object' && !Array.isArray(valuationCase.evidence)
    ? valuationCase.evidence
    : {};
  for (const key of EVIDENCE_KEYS) draft.evidence[key] = evidenceDescriptorDraft(evidence[key]);
  for (const [key, value] of Object.entries(evidence)) {
    if (!EVIDENCE_KEYS.includes(key)) draft.preservedEvidenceExtras[key] = clone(value);
  }

  if (valuationCase.marketComparableInput) {
    const input = valuationCase.marketComparableInput;
    draft.marketComparable = {
      enabled: true,
      subjectArea: input.subjectArea === null || input.subjectArea === undefined ? '' : String(input.subjectArea),
      basis: input.basis || '',
      weightingPolicy: input.weightingPolicy || '',
      valuationDate: input.valuationDate || '',
      currency: input.currency || '',
      comparables: Array.isArray(input.comparables) ? input.comparables.map(comparableDraft) : [],
    };
  }

  if (valuationCase.costPolicy) {
    const policy = valuationCase.costPolicy;
    draft.cost = {
      enabled: true,
      depreciationRate: policy.depreciationRate === null || policy.depreciationRate === undefined ? '' : String(policy.depreciationRate),
      indirectCostsJson: JSON.stringify(policy.indirectCosts || []),
      basis: policy.basis || '',
      valuationDate: policy.valuationDate || '',
      currency: policy.currency || '',
    };
  }

  if (valuationCase.reconciliationPolicy) {
    const policy = valuationCase.reconciliationPolicy;
    const weights = Object.fromEntries(RECONCILABLE_METHODS.map((method) => [method, '']));
    for (const [method, weight] of Object.entries(policy.methodWeights || {})) weights[method] = String(weight);
    draft.reconciliation = {
      enabled: true,
      dispersionThreshold: policy.dispersionThreshold === null || policy.dispersionThreshold === undefined ? '' : String(policy.dispersionThreshold),
      methodWeights: weights,
    };
  }

  return clone(draft);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new AdvancedValuationDraftError('REQUIRED_FIELD', field);
  return value.trim();
}

function finiteNumber(value, field) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new AdvancedValuationDraftError('INVALID_NUMBER', field);
  const text = String(value).trim();
  if (text === '') throw new AdvancedValuationDraftError('REQUIRED_FIELD', field);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new AdvancedValuationDraftError('INVALID_NUMBER', field);
  return number;
}

function optionalString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function enumValue(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new AdvancedValuationDraftError('INVALID_ENUM', field);
  return value;
}

function parseJson(text, field, expected) {
  let value;
  try {
    value = JSON.parse(typeof text === 'string' ? text : '');
  } catch (error) {
    throw new AdvancedValuationDraftError('INVALID_JSON', field);
  }
  if (expected === 'array' && !Array.isArray(value)) throw new AdvancedValuationDraftError('INVALID_JSON_SHAPE', field);
  if (expected === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) throw new AdvancedValuationDraftError('INVALID_JSON_SHAPE', field);
  return value;
}

function buildEvidence(draft) {
  if (!draft.evidence || typeof draft.evidence !== 'object' || Array.isArray(draft.evidence)) {
    throw new AdvancedValuationDraftError('INVALID_DRAFT', 'evidence');
  }
  const evidence = clone(draft.preservedEvidenceExtras || {});
  for (const key of EVIDENCE_KEYS) {
    const item = draft.evidence[key] || emptyEvidenceDescriptorDraft();
    if (!item.enabled) continue;
    evidence[key] = {
      grade: enumValue(item.grade, EVIDENCE_GRADE, `evidence.${key}.grade`),
      status: enumValue(item.status, INPUT_STATUS, `evidence.${key}.status`),
      sourceType: requiredString(item.sourceType, `evidence.${key}.sourceType`),
      sourceRef: optionalString(item.sourceRef),
      observedAt: optionalString(item.observedAt),
      note: optionalString(item.note),
    };
  }
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function buildComparable(row, index, weightingPolicy) {
  const unitValue = finiteNumber(row.unitValue, `marketComparable.comparables[${index}].unitValue`);
  if (unitValue <= 0) throw new AdvancedValuationDraftError('OUT_OF_RANGE', `marketComparable.comparables[${index}].unitValue`);
  let weight = null;
  if (weightingPolicy === WEIGHTING_POLICY.EXPLICIT) {
    weight = finiteNumber(row.weight, `marketComparable.comparables[${index}].weight`);
    if (weight <= 0 || weight > 1) throw new AdvancedValuationDraftError('OUT_OF_RANGE', `marketComparable.comparables[${index}].weight`);
  }
  try {
    return createComparable({
      comparableId: requiredString(row.comparableId, `marketComparable.comparables[${index}].comparableId`),
      unitValue,
      transactionStatus: enumValue(row.transactionStatus, TRANSACTION_STATUS, `marketComparable.comparables[${index}].transactionStatus`),
      evidenceGrade: enumValue(row.evidenceGrade, EVIDENCE_GRADE, `marketComparable.comparables[${index}].evidenceGrade`),
      adjustments: parseJson(row.adjustmentsJson || '[]', `marketComparable.comparables[${index}].adjustmentsJson`, 'array'),
      weight,
      transactionDate: optionalString(row.transactionDate),
      sourceRef: optionalString(row.sourceRef),
      metadata: parseJson(row.metadataJson || '{}', `marketComparable.comparables[${index}].metadataJson`, 'object'),
    });
  } catch (error) {
    if (error instanceof AdvancedValuationDraftError) throw error;
    throw new AdvancedValuationDraftError('INVALID_COMPARABLE', `marketComparable.comparables[${index}]`);
  }
}

function buildMarketComparable(draft) {
  const section = draft.marketComparable || {};
  if (!section.enabled) return null;
  if (!Array.isArray(section.comparables) || section.comparables.length < 2) {
    throw new AdvancedValuationDraftError('MIN_TWO_COMPARABLES_REQUIRED', 'marketComparable.comparables');
  }
  const subjectArea = finiteNumber(section.subjectArea, 'marketComparable.subjectArea');
  if (subjectArea <= 0) throw new AdvancedValuationDraftError('OUT_OF_RANGE', 'marketComparable.subjectArea');
  const weightingPolicy = enumValue(section.weightingPolicy, WEIGHTING_POLICY, 'marketComparable.weightingPolicy');
  const basis = enumValue(section.basis, BASIS_OF_VALUE, 'marketComparable.basis');
  if (![BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.MARKET_RENT].includes(basis)) {
    throw new AdvancedValuationDraftError('UNSUPPORTED_BASIS', 'marketComparable.basis');
  }
  const comparables = section.comparables.map((row, index) => buildComparable(row, index, weightingPolicy));
  if (weightingPolicy === WEIGHTING_POLICY.EXPLICIT) {
    const total = comparables.reduce((sum, comparable) => sum + comparable.weight, 0);
    if (Math.abs(total - 1) > 1e-9) throw new AdvancedValuationDraftError('WEIGHTS_MUST_SUM_TO_ONE', 'marketComparable.comparables');
  }
  return {
    comparables,
    subjectArea,
    basis,
    weightingPolicy,
    valuationDate: optionalString(section.valuationDate),
    currency: requiredString(section.currency, 'marketComparable.currency'),
  };
}

function validateIndirectCosts(items) {
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AdvancedValuationDraftError('INVALID_COST_ITEM', `cost.indirectCosts[${index}]`);
    const amount = finiteNumber(item.amount, `cost.indirectCosts[${index}].amount`);
    if (amount < 0) throw new AdvancedValuationDraftError('OUT_OF_RANGE', `cost.indirectCosts[${index}].amount`);
    return {
      label: requiredString(item.label, `cost.indirectCosts[${index}].label`),
      amount,
    };
  });
}

function buildCostPolicy(draft) {
  const section = draft.cost || {};
  if (!section.enabled) return null;
  const depreciationRate = finiteNumber(section.depreciationRate, 'cost.depreciationRate');
  if (depreciationRate < 0 || depreciationRate > 1) throw new AdvancedValuationDraftError('OUT_OF_RANGE', 'cost.depreciationRate');
  const basis = enumValue(section.basis, BASIS_OF_VALUE, 'cost.basis');
  if (![BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.INVESTMENT_VALUE].includes(basis)) {
    throw new AdvancedValuationDraftError('UNSUPPORTED_BASIS', 'cost.basis');
  }
  return {
    depreciationRate,
    indirectCosts: validateIndirectCosts(parseJson(section.indirectCostsJson || '[]', 'cost.indirectCostsJson', 'array')),
    basis,
    valuationDate: optionalString(section.valuationDate),
    currency: requiredString(section.currency, 'cost.currency'),
  };
}

function buildReconciliationPolicy(draft) {
  const section = draft.reconciliation || {};
  if (!section.enabled) return null;
  const dispersionThreshold = finiteNumber(section.dispersionThreshold, 'reconciliation.dispersionThreshold');
  if (dispersionThreshold < 0) throw new AdvancedValuationDraftError('OUT_OF_RANGE', 'reconciliation.dispersionThreshold');
  if (!section.methodWeights || typeof section.methodWeights !== 'object' || Array.isArray(section.methodWeights)) {
    throw new AdvancedValuationDraftError('INVALID_DRAFT', 'reconciliation.methodWeights');
  }
  const methodWeights = {};
  for (const [method, raw] of Object.entries(section.methodWeights)) {
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    if (!Object.values(VALUATION_METHOD).includes(method)) throw new AdvancedValuationDraftError('INVALID_ENUM', `reconciliation.methodWeights.${method}`);
    const weight = finiteNumber(raw, `reconciliation.methodWeights.${method}`);
    if (weight <= 0 || weight > 1) throw new AdvancedValuationDraftError('OUT_OF_RANGE', `reconciliation.methodWeights.${method}`);
    methodWeights[method] = weight;
  }
  if (Object.keys(methodWeights).length < 2) throw new AdvancedValuationDraftError('MIN_TWO_METHOD_WEIGHTS_REQUIRED', 'reconciliation.methodWeights');
  const total = Object.values(methodWeights).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 1) > 1e-9) throw new AdvancedValuationDraftError('WEIGHTS_MUST_SUM_TO_ONE', 'reconciliation.methodWeights');
  return { methodWeights, dispersionThreshold };
}

function applyAdvancedDraftToValuationCase(valuationCase, draft) {
  if (!valuationCase || typeof valuationCase !== 'object' || Array.isArray(valuationCase)) {
    throw new AdvancedValuationDraftError('BASE_CONFIGURATION_REQUIRED', 'valuationCase');
  }
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new AdvancedValuationDraftError('INVALID_DRAFT', 'draft');

  const next = clone(valuationCase);
  const evidence = buildEvidence(draft);
  const marketComparableInput = buildMarketComparable(draft);
  const costPolicy = buildCostPolicy(draft);
  const reconciliationPolicy = buildReconciliationPolicy(draft);

  if (evidence) next.evidence = evidence;
  else delete next.evidence;
  if (marketComparableInput) next.marketComparableInput = marketComparableInput;
  else delete next.marketComparableInput;
  if (costPolicy) next.costPolicy = costPolicy;
  else delete next.costPolicy;
  if (reconciliationPolicy) next.reconciliationPolicy = reconciliationPolicy;
  else delete next.reconciliationPolicy;

  return next;
}

module.exports = {
  EVIDENCE_KEYS,
  RECONCILABLE_METHODS,
  AdvancedValuationDraftError,
  emptyEvidenceDescriptorDraft,
  emptyComparableDraft,
  emptyAdvancedValuationDraft,
  advancedDraftFromValuationCase,
  applyAdvancedDraftToValuationCase,
};
