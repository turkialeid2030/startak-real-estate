'use strict';

const crypto = require('crypto');
const {
  COMPARABLE_QUALITY_STATUS,
} = require('./comparable-evidence');

const COMPARABLE_SELECTION_STATUS = Object.freeze({
  READY_FOR_ADJUSTMENT_ANALYSIS: 'READY_FOR_ADJUSTMENT_ANALYSIS',
  HOLD_QUALITY_GATE: 'HOLD_QUALITY_GATE',
  HOLD_SELECTION: 'HOLD_SELECTION',
});

const ADJUSTMENT_FACTOR = Object.freeze({
  TRANSACTION_TERMS: 'TRANSACTION_TERMS',
  TIME_MARKET_CONDITIONS: 'TIME_MARKET_CONDITIONS',
  LOCATION: 'LOCATION',
  RIGHTS_INTEREST: 'RIGHTS_INTEREST',
  SIZE: 'SIZE',
  FRONTAGE_ACCESS: 'FRONTAGE_ACCESS',
  CONDITION_QUALITY: 'CONDITION_QUALITY',
  AGE: 'AGE',
  FLOOR: 'FLOOR',
  PARKING: 'PARKING',
  OCCUPANCY_INCOME: 'OCCUPANCY_INCOME',
  DEVELOPMENT_POTENTIAL: 'DEVELOPMENT_POTENTIAL',
  OTHER: 'OTHER',
});

const ADJUSTMENT_DIRECTION = Object.freeze({
  INCREASE: 'INCREASE',
  DECREASE: 'DECREASE',
  NONE: 'NONE',
});

const ADJUSTMENT_METHOD = Object.freeze({
  PERCENT_OF_BASE: 'PERCENT_OF_BASE',
  AMOUNT_SAR_PER_SQM: 'AMOUNT_SAR_PER_SQM',
});

const ADJUSTMENT_CONFIDENCE = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
});

const ADJUSTMENT_ANALYSIS_STATUS = Object.freeze({
  READY_FOR_RECONCILIATION: 'READY_FOR_RECONCILIATION',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD_ADJUSTMENT: 'HOLD_ADJUSTMENT',
});

const CALCULATION_CONVENTION = Object.freeze({
  ADDITIVE_TO_BASE_UNIT_VALUE: 'ADDITIVE_TO_BASE_UNIT_VALUE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
}

function recordProfessionalComparableSelection({
  caseId,
  qualityGate,
  records,
  selectedComparableIds,
  selectionRationales,
  selectedByRef,
  selectionEvidenceRef,
  selectedAt,
  minimumSelectedCount = 1,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  if (!qualityGate || typeof qualityGate !== 'object') throw new TypeError('qualityGate is required');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Array.isArray(selectedComparableIds)) throw new TypeError('selectedComparableIds must be an array');
  if (!Number.isInteger(minimumSelectedCount) || minimumSelectedCount < 1) throw new TypeError('minimumSelectedCount must be a positive integer');
  assertNonEmpty(selectedByRef, 'selectedByRef');
  assertNonEmpty(selectionEvidenceRef, 'selectionEvidenceRef');
  const selectedAtIso = iso(selectedAt, 'selectedAt');

  if (qualityGate.caseId !== caseId || qualityGate.status !== COMPARABLE_QUALITY_STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      status: COMPARABLE_SELECTION_STATUS.HOLD_QUALITY_GATE,
      reasons: ['COMPARABLE_QUALITY_GATE_NOT_QUALIFIED'],
      selectedComparableIds: [],
      professionalSelectionRecorded: false,
      automaticComparableSelection: false,
      automaticValuationWeighting: false,
      valuationConclusionProduced: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
    });
  }

  const recordById = new Map();
  for (const record of records) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: comparable belongs to another case');
    if (recordById.has(record.comparableId)) throw new TypeError(`DUPLICATE_COMPARABLE_ID:${record.comparableId}`);
    recordById.set(record.comparableId, record);
  }

  const uniqueIds = [...new Set(selectedComparableIds)];
  const reasons = [];
  if (uniqueIds.length !== selectedComparableIds.length) reasons.push('DUPLICATE_SELECTION_ID');
  if (uniqueIds.length < minimumSelectedCount) reasons.push(`INSUFFICIENT_PROFESSIONALLY_SELECTED_COMPARABLES:${uniqueIds.length}/${minimumSelectedCount}`);
  const qualified = new Set(qualityGate.qualifiedComparableIds || []);
  const rationales = selectionRationales && typeof selectionRationales === 'object' ? selectionRationales : {};

  for (const id of uniqueIds) {
    if (!recordById.has(id)) reasons.push(`SELECTED_COMPARABLE_NOT_FOUND:${id}`);
    if (!qualified.has(id)) reasons.push(`SELECTED_COMPARABLE_NOT_QUALITY_QUALIFIED:${id}`);
    if (!nonEmpty(rationales[id])) reasons.push(`SELECTION_RATIONALE_REQUIRED:${id}`);
  }

  if (reasons.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      status: COMPARABLE_SELECTION_STATUS.HOLD_SELECTION,
      reasons,
      selectedComparableIds: uniqueIds,
      professionalSelectionRecorded: false,
      automaticComparableSelection: false,
      automaticValuationWeighting: false,
      valuationConclusionProduced: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
    });
  }

  const selected = uniqueIds.map((id) => {
    const record = recordById.get(id);
    return {
      comparableId: id,
      comparableHashSha256: record.comparableHashSha256,
      evidenceLevel: record.evidenceLevel,
      evidenceRank: record.evidenceRank,
      transactionType: record.transactionType,
      transactionDate: record.transactionDate,
      sourcePropertyRef: record.sourcePropertyRef,
      sourceRef: record.sourceRef,
      unitValueSarPerSqm: record.unitValueSarPerSqm,
      rationale: rationales[id].trim(),
    };
  });

  const selection = {
    schemaVersion: 1,
    caseId,
    status: COMPARABLE_SELECTION_STATUS.READY_FOR_ADJUSTMENT_ANALYSIS,
    reasons: [],
    selectedComparableIds: uniqueIds,
    selected,
    selectedByRef: selectedByRef.trim(),
    selectionEvidenceRef: selectionEvidenceRef.trim(),
    selectedAt: selectedAtIso,
    professionalSelectionRecorded: true,
    professionalSelectionRequired: true,
    automaticComparableSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  selection.selectionHashSha256 = sha256(selection);
  return deepFreeze(selection);
}

function createComparableAdjustmentRecord({
  adjustmentId,
  caseId,
  comparableId,
  factor,
  factorLabel = null,
  direction,
  method,
  magnitude,
  rationale,
  evidenceRefs,
  confidence,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['adjustmentId', adjustmentId], ['caseId', caseId], ['comparableId', comparableId], ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) {
    assertNonEmpty(value, field);
  }
  assertEnum(factor, ADJUSTMENT_FACTOR, 'factor');
  assertEnum(direction, ADJUSTMENT_DIRECTION, 'direction');
  assertEnum(method, ADJUSTMENT_METHOD, 'method');
  assertEnum(confidence, ADJUSTMENT_CONFIDENCE, 'confidence');
  finiteNonNegative(magnitude, 'magnitude');
  if (direction === ADJUSTMENT_DIRECTION.NONE && magnitude !== 0) throw new TypeError('NONE_DIRECTION_REQUIRES_ZERO_MAGNITUDE');
  if (direction !== ADJUSTMENT_DIRECTION.NONE && magnitude <= 0) throw new TypeError('NONZERO_DIRECTION_REQUIRES_POSITIVE_MAGNITUDE');
  if (factor === ADJUSTMENT_FACTOR.OTHER && !nonEmpty(factorLabel)) throw new TypeError('OTHER_FACTOR_REQUIRES_LABEL');
  if (factor !== ADJUSTMENT_FACTOR.OTHER && factorLabel !== null && factorLabel !== undefined && !nonEmpty(factorLabel)) throw new TypeError('factorLabel must be null or non-empty');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError('evidenceRefs must contain at least one non-empty reference');
  }

  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('ADJUSTMENT_REVIEW_BEFORE_PREPARATION');

  const record = {
    schemaVersion: 1,
    adjustmentId: adjustmentId.trim(),
    caseId: caseId.trim(),
    comparableId: comparableId.trim(),
    factor,
    factorLabel: factorLabel ? factorLabel.trim() : null,
    direction,
    method,
    magnitude,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    confidence,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    professionalJudgmentSuppliedByUser: true,
    automaticAdjustmentEstimated: false,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
  };
  record.adjustmentHashSha256 = sha256(record);
  return deepFreeze(record);
}

function adjustmentKey(record) {
  return record.factor === ADJUSTMENT_FACTOR.OTHER
    ? `${record.factor}:${String(record.factorLabel || '').toLowerCase()}`
    : record.factor;
}

function signedDelta(record, baseUnitValue) {
  const sign = record.direction === ADJUSTMENT_DIRECTION.INCREASE ? 1
    : record.direction === ADJUSTMENT_DIRECTION.DECREASE ? -1 : 0;
  if (record.method === ADJUSTMENT_METHOD.PERCENT_OF_BASE) return sign * baseUnitValue * record.magnitude;
  return sign * record.magnitude;
}

function buildComparableAdjustmentAnalysis({
  caseId,
  selection,
  records,
  adjustmentRecords,
  calculationConvention = CALCULATION_CONVENTION.ADDITIVE_TO_BASE_UNIT_VALUE,
  materialNetAdjustmentThreshold = 0.25,
  materialGrossAdjustmentThreshold = 0.40,
  materialSinglePercentAdjustmentThreshold = 0.20,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertEnum(calculationConvention, CALCULATION_CONVENTION, 'calculationConvention');
  [
    ['materialNetAdjustmentThreshold', materialNetAdjustmentThreshold],
    ['materialGrossAdjustmentThreshold', materialGrossAdjustmentThreshold],
    ['materialSinglePercentAdjustmentThreshold', materialSinglePercentAdjustmentThreshold],
  ].forEach(([field, value]) => finiteNonNegative(value, field));
  if (!selection || selection.caseId !== caseId || selection.status !== COMPARABLE_SELECTION_STATUS.READY_FOR_ADJUSTMENT_ANALYSIS || selection.professionalSelectionRecorded !== true) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      status: ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT,
      reasons: ['PROFESSIONAL_COMPARABLE_SELECTION_REQUIRED'],
      indications: [],
      reconciliationReady: false,
      valuationConclusionProduced: false,
      automaticValuationWeighting: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }
  if (!Array.isArray(records) || !Array.isArray(adjustmentRecords)) throw new TypeError('records and adjustmentRecords must be arrays');

  const recordById = new Map();
  for (const record of records) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: comparable belongs to another case');
    recordById.set(record.comparableId, record);
  }
  const selectedIds = new Set(selection.selectedComparableIds);
  const adjustmentIds = new Set();
  const byComparable = new Map(selection.selectedComparableIds.map((id) => [id, []]));
  const reasons = [];

  for (const adj of adjustmentRecords) {
    if (!adj || adj.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: adjustment belongs to another case');
    if (!selectedIds.has(adj.comparableId)) reasons.push(`ADJUSTMENT_FOR_UNSELECTED_COMPARABLE:${adj.adjustmentId}`);
    if (adjustmentIds.has(adj.adjustmentId)) reasons.push(`DUPLICATE_ADJUSTMENT_ID:${adj.adjustmentId}`);
    adjustmentIds.add(adj.adjustmentId);
    if (selectedIds.has(adj.comparableId)) byComparable.get(adj.comparableId).push(adj);
  }

  for (const id of selection.selectedComparableIds) {
    if (!recordById.has(id)) reasons.push(`SELECTED_COMPARABLE_RECORD_MISSING:${id}`);
    const seenFactors = new Set();
    for (const adj of byComparable.get(id) || []) {
      const key = adjustmentKey(adj);
      if (seenFactors.has(key)) reasons.push(`DUPLICATE_ADJUSTMENT_FACTOR:${id}:${key}`);
      seenFactors.add(key);
    }
  }

  if (reasons.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      status: ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT,
      reasons,
      indications: [],
      reconciliationReady: false,
      valuationConclusionProduced: false,
      automaticValuationWeighting: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }

  const reviewFlags = [];
  const indications = selection.selectedComparableIds.map((id) => {
    const comparable = recordById.get(id);
    const base = comparable.unitValueSarPerSqm;
    let netDelta = 0;
    let grossDelta = 0;
    const adjustmentTrace = (byComparable.get(id) || []).map((adj) => {
      const delta = signedDelta(adj, base);
      netDelta += delta;
      grossDelta += Math.abs(delta);
      const effectivePercentOfBase = base === 0 ? 0 : delta / base;
      if (adj.method === ADJUSTMENT_METHOD.PERCENT_OF_BASE && adj.magnitude > materialSinglePercentAdjustmentThreshold) {
        reviewFlags.push(`MATERIAL_SINGLE_ADJUSTMENT_REVIEW_REQUIRED:${id}:${adj.adjustmentId}`);
      }
      return {
        adjustmentId: adj.adjustmentId,
        adjustmentHashSha256: adj.adjustmentHashSha256,
        factor: adj.factor,
        factorLabel: adj.factorLabel,
        direction: adj.direction,
        method: adj.method,
        magnitude: adj.magnitude,
        deltaSarPerSqm: delta,
        effectivePercentOfBase,
        rationale: adj.rationale,
        evidenceRefs: adj.evidenceRefs,
        confidence: adj.confidence,
        reviewedByRef: adj.reviewedByRef,
        reviewedAt: adj.reviewedAt,
        reviewEvidenceRef: adj.reviewEvidenceRef,
      };
    });
    const adjusted = base + netDelta;
    if (!Number.isFinite(adjusted) || adjusted <= 0) reasons.push(`ADJUSTED_UNIT_VALUE_NON_POSITIVE:${id}`);
    const netAdjustmentPercent = netDelta / base;
    const grossAdjustmentPercent = grossDelta / base;
    if (Math.abs(netAdjustmentPercent) > materialNetAdjustmentThreshold) reviewFlags.push(`MATERIAL_NET_ADJUSTMENT_REVIEW_REQUIRED:${id}`);
    if (grossAdjustmentPercent > materialGrossAdjustmentThreshold) reviewFlags.push(`MATERIAL_GROSS_ADJUSTMENT_REVIEW_REQUIRED:${id}`);
    return {
      comparableId: id,
      comparableHashSha256: comparable.comparableHashSha256,
      baseUnitValueSarPerSqm: base,
      adjustmentTrace,
      netAdjustmentSarPerSqm: netDelta,
      netAdjustmentPercent,
      grossAdjustmentPercent,
      adjustedUnitValueSarPerSqm: adjusted,
      valuationWeight: null,
      professionalWeightRequiredLater: true,
    };
  });

  if (reasons.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      status: ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT,
      reasons,
      indications,
      reconciliationReady: false,
      valuationConclusionProduced: false,
      automaticValuationWeighting: false,
      transactionAuthorized: false,
      certifiedValuationEstablished: false,
    });
  }

  const analysis = {
    schemaVersion: 1,
    caseId,
    status: reviewFlags.length ? ADJUSTMENT_ANALYSIS_STATUS.REVIEW_REQUIRED : ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION,
    reasons: [],
    reviewFlags: [...new Set(reviewFlags)],
    calculationConvention,
    thresholds: {
      materialNetAdjustmentThreshold,
      materialGrossAdjustmentThreshold,
      materialSinglePercentAdjustmentThreshold,
    },
    selectionHashSha256: selection.selectionHashSha256,
    indications,
    reconciliationReady: reviewFlags.length === 0,
    professionalReconciliationRequired: true,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    semantics: 'Adjusted indications are deterministic arithmetic over explicitly supplied and reviewed professional adjustments. The module does not estimate adjustment magnitudes, select weights, reconcile a final value, certify a valuation, or authorize a transaction.',
  };
  analysis.analysisHashSha256 = sha256(analysis);
  return deepFreeze(analysis);
}

module.exports = {
  COMPARABLE_SELECTION_STATUS,
  ADJUSTMENT_FACTOR,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  ADJUSTMENT_CONFIDENCE,
  ADJUSTMENT_ANALYSIS_STATUS,
  CALCULATION_CONVENTION,
  recordProfessionalComparableSelection,
  createComparableAdjustmentRecord,
  buildComparableAdjustmentAnalysis,
};
