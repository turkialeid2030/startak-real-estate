'use strict';

const crypto = require('crypto');
const {
  MARKET_EVIDENCE_TYPE,
  MARKET_GATE_STATUS,
} = require('../contracts/market-evidence');
const {
  C3M_WHOLE_PROPERTY_SALES_COMPARISON_SCHEMA_VERSION,
  WHOLE_PROPERTY_UNIT_OF_COMPARISON,
  SUBJECT_MEASUREMENT_TYPE_BY_UNIT,
  SUBJECT_MEASUREMENT_UNIT_BY_COMPARISON_UNIT,
  WHOLE_PROPERTY_ADJUSTMENT_DIRECTION,
  WHOLE_PROPERTY_ADJUSTMENT_METHOD,
  WHOLE_PROPERTY_ADJUSTMENT_FACTOR,
  WHOLE_PROPERTY_SALES_INPUT_STATUS,
} = require('../contracts/whole-property-sales-comparison');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');
const {
  evaluateMarketEvidenceBundle,
} = require('../market/market-evidence-governance');

const C3M_WHOLE_PROPERTY_SALES_INPUT_VERSION = 'C3M_WHOLE_PROPERTY_SALES_INPUT_V1';
const HASH_RE = /^[a-f0-9]{64}$/i;
const COUNT_BASES = Object.freeze([
  WHOLE_PROPERTY_UNIT_OF_COMPARISON.ROOM_KEY,
  WHOLE_PROPERTY_UNIT_OF_COMPARISON.RESIDENTIAL_UNIT,
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
function cleanStringArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  const cleaned = value.map(cleanString);
  if (cleaned.some((item) => !item)) throw new TypeError(`${name} must contain only non-empty strings`);
  return [...new Set(cleaned)];
}
function toTimestamp(value) {
  const text = cleanString(value);
  if (!text) return null;
  const ms = new Date(text).getTime();
  return Number.isFinite(ms) ? ms : null;
}
function isPositiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function isValidBasisQuantity(value, unitOfComparison) {
  if (!isPositiveFinite(value)) return false;
  return !COUNT_BASES.includes(unitOfComparison) || Number.isInteger(value);
}
function isJsonSafe(value, seen = new Set()) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => isJsonSafe(value[key], seen));
  seen.delete(value);
  return valid;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, Object.create(null));
  }
  return value;
}
function sha256(value) {
  if (!isJsonSafe(value)) return null;
  try {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
  } catch (_) {
    return null;
  }
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function unique(values) {
  return [...new Set(values)];
}
function daysApart(aMs, bMs) {
  return Math.abs(aMs - bMs) / 86400000;
}

function verifyPropertyEvidencePacketIntegrity(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return false;
  if (!HASH_RE.test(cleanString(packet.packetHashSha256))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    assignmentRef: packet.assignmentRef,
    assignmentHashSha256: packet.assignmentHashSha256,
    inspectionId: packet.inspectionId,
    inspectionHashSha256: packet.inspectionHashSha256,
    valuationDate: packet.valuationDate,
    reportDate: packet.reportDate,
    jurisdiction: packet.jurisdiction,
    assetType: packet.assetType,
    assetLocation: packet.assetLocation,
    valuedRights: packet.valuedRights,
    basisOfValue: packet.basisOfValue,
    purpose: packet.purpose,
    evidenceFacts: packet.evidenceFacts,
    measurements: packet.measurements,
    propertyDataGateStatus: packet.propertyDataGateStatus,
    measurementGateStatus: packet.measurementGateStatus,
  };
  return sha256(core) === cleanString(packet.packetHashSha256).toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: C3M_WHOLE_PROPERTY_SALES_COMPARISON_SCHEMA_VERSION,
    version: C3M_WHOLE_PROPERTY_SALES_INPUT_VERSION,
    packetId: context.packetId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    unitOfComparison: context.unitOfComparison || null,
    status,
    blockers: unique(blockers),
    readyForCanonicalWholePropertySalesCalculation: false,
    wholePropertyMarketValueIndicationProduced: false,
    automaticComparableSelection: false,
    automaticAdjustmentEstimated: false,
    automaticComparableWeighting: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
  });
}

function validatePolicy(policyId, registry, unitOfComparison, assetType) {
  const blockers = [];
  const id = cleanString(policyId);
  const registryValid = registry && typeof registry === 'object' && !Array.isArray(registry);
  if (!registryValid) blockers.push('C3M_POLICY_REGISTRY_REQUIRED');
  if (!id) blockers.push('C3M_POLICY_ID_REQUIRED');
  const raw = registryValid && id && Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
  if (id && !raw) blockers.push(`C3M_POLICY_NOT_GOVERNED:${id}`);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (raw) blockers.push(`C3M_POLICY_INVALID:${id}`);
    return { policyId: id || null, policy: null, blockers };
  }

  const allowedUnits = Array.isArray(raw.allowedUnitsOfComparison)
    ? unique(raw.allowedUnitsOfComparison.map(cleanString).filter(Boolean)) : [];
  if (!allowedUnits.length) blockers.push('C3M_POLICY_ALLOWED_UNITS_REQUIRED');
  if (!allowedUnits.includes(unitOfComparison)) blockers.push(`C3M_UNIT_NOT_ALLOWED_BY_POLICY:${unitOfComparison || 'MISSING'}`);
  for (const unit of allowedUnits) {
    if (!Object.values(WHOLE_PROPERTY_UNIT_OF_COMPARISON).includes(unit)) blockers.push(`C3M_POLICY_UNIT_UNSUPPORTED:${unit}`);
  }

  const allowedAssetTypes = Array.isArray(raw.allowedAssetTypes)
    ? unique(raw.allowedAssetTypes.map(cleanString).filter(Boolean)) : [];
  if (!allowedAssetTypes.length) blockers.push('C3M_POLICY_ALLOWED_ASSET_TYPES_REQUIRED');
  if (!allowedAssetTypes.includes(assetType)) blockers.push(`C3M_ASSET_TYPE_NOT_ALLOWED_BY_POLICY:${assetType || 'MISSING'}`);

  if (!Number.isInteger(raw.minimumComparableCount) || raw.minimumComparableCount < 1) blockers.push('C3M_POLICY_MINIMUM_COMPARABLE_COUNT_INVALID');
  if (!Number.isInteger(raw.maxMeasurementTransactionDateGapDays) || raw.maxMeasurementTransactionDateGapDays < 0) {
    blockers.push('C3M_POLICY_MAX_MEASUREMENT_TRANSACTION_DATE_GAP_DAYS_INVALID');
  }
  const ratioFields = [
    'maxSingleComparableWeight', 'maxSingleAdjustmentPercent', 'maxNetAdjustmentPercent',
    'maxGrossAdjustmentPercent', 'maxAdjustedUnitSpreadRatio',
  ];
  for (const field of ratioFields) {
    const value = raw[field];
    if (!(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) blockers.push(`C3M_POLICY_${field.toUpperCase()}_INVALID`);
  }
  if (Number.isInteger(raw.minimumComparableCount) && raw.minimumComparableCount > 0
      && typeof raw.maxSingleComparableWeight === 'number' && Number.isFinite(raw.maxSingleComparableWeight)
      && raw.minimumComparableCount * raw.maxSingleComparableWeight < 1 - 1e-12) {
    blockers.push('C3M_POLICY_WEIGHT_CAP_INFEASIBLE');
  }
  if (raw.requireAllSelectedWeighted !== true) blockers.push('C3M_POLICY_REQUIRE_ALL_SELECTED_WEIGHTED_MUST_BE_TRUE');
  if (raw.requireAdjustmentDisposition !== true) blockers.push('C3M_POLICY_REQUIRE_ADJUSTMENT_DISPOSITION_MUST_BE_TRUE');

  return {
    policyId: id || null,
    policy: Object.freeze({
      allowedUnitsOfComparison: Object.freeze(allowedUnits),
      allowedAssetTypes: Object.freeze(allowedAssetTypes),
      minimumComparableCount: raw.minimumComparableCount,
      maxMeasurementTransactionDateGapDays: raw.maxMeasurementTransactionDateGapDays,
      maxSingleComparableWeight: raw.maxSingleComparableWeight,
      maxSingleAdjustmentPercent: raw.maxSingleAdjustmentPercent,
      maxNetAdjustmentPercent: raw.maxNetAdjustmentPercent,
      maxGrossAdjustmentPercent: raw.maxGrossAdjustmentPercent,
      maxAdjustedUnitSpreadRatio: raw.maxAdjustedUnitSpreadRatio,
      requireAllSelectedWeighted: raw.requireAllSelectedWeighted === true,
      requireAdjustmentDisposition: raw.requireAdjustmentDisposition === true,
    }),
    blockers,
  };
}

function evaluateMarketContextBinding(binding, { propertyRef, marketEvidence, valuationDateMs, asOfMs, trustedMarketContextBinderIds }) {
  const blockers = [];
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return { blockers: ['C3M_MARKET_CONTEXT_BINDING_REQUIRED'], normalized: null };
  const bindingId = cleanString(binding.bindingId);
  const boundPropertyRef = cleanString(binding.propertyRef);
  const marketContextId = cleanString(binding.marketContextId);
  const geographyKey = cleanString(binding.geographyKey);
  const assetType = cleanString(binding.assetType);
  const boundBy = cleanString(binding.boundBy);
  const bindingReference = cleanString(binding.bindingReference);
  const boundAtMs = toTimestamp(binding.boundAt);
  if (!bindingId) blockers.push('C3M_MARKET_CONTEXT_BINDING_ID_REQUIRED');
  if (boundPropertyRef !== propertyRef) blockers.push('C3M_MARKET_CONTEXT_PROPERTY_MISMATCH');
  if (!marketContextId || marketContextId !== cleanString(marketEvidence.marketContextId)) blockers.push('C3M_MARKET_CONTEXT_ID_MISMATCH');
  if (!geographyKey || geographyKey !== cleanString(marketEvidence.geographyKey)) blockers.push('C3M_MARKET_CONTEXT_GEOGRAPHY_MISMATCH');
  if (!assetType || assetType !== cleanString(marketEvidence.assetType)) blockers.push('C3M_MARKET_CONTEXT_ASSET_TYPE_MISMATCH');
  if (!boundBy) blockers.push('C3M_MARKET_CONTEXT_BINDER_REQUIRED');
  else if (!trustedMarketContextBinderIds.includes(boundBy)) blockers.push(`C3M_MARKET_CONTEXT_BINDER_UNTRUSTED:${boundBy}`);
  if (!bindingReference) blockers.push('C3M_MARKET_CONTEXT_BINDING_REFERENCE_REQUIRED');
  if (boundAtMs === null) blockers.push('C3M_MARKET_CONTEXT_BOUND_AT_REQUIRED');
  else {
    if (boundAtMs > asOfMs) blockers.push('C3M_MARKET_CONTEXT_BOUND_AT_FUTURE');
    if (valuationDateMs !== null && boundAtMs < valuationDateMs) blockers.push('C3M_MARKET_CONTEXT_BOUND_BEFORE_VALUATION_DATE');
  }
  return {
    blockers,
    normalized: Object.freeze({
      bindingId: bindingId || null, propertyRef: boundPropertyRef || null,
      marketContextId: marketContextId || null, geographyKey: geographyKey || null,
      assetType: assetType || null, boundBy: boundBy || null,
      bindingReference: bindingReference || null,
      boundAt: boundAtMs === null ? null : new Date(boundAtMs).toISOString(),
    }),
  };
}

function normalizeComparableMeasurement(record, { assetType, unitOfComparison, asOfMs, trustedMeasurementVerifierIds }) {
  const blockers = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { blockers: ['C3M_COMPARABLE_MEASUREMENT_OBJECT_REQUIRED'], normalized: null };
  const comparableId = cleanString(record.comparableId);
  const transactionKey = cleanString(record.transactionKey);
  const sourcePropertyRef = cleanString(record.sourcePropertyRef);
  const recordAssetType = cleanString(record.assetType);
  const basis = cleanString(record.unitOfComparison);
  const basisQuantity = record.basisQuantity;
  const sourceRef = cleanString(record.sourceRef);
  const effectiveAtMs = toTimestamp(record.effectiveAt);
  const validUntilMs = toTimestamp(record.validUntil);
  const verifiedBy = cleanString(record.verifiedBy);
  const verificationReference = cleanString(record.verificationReference);
  const verifiedAtMs = toTimestamp(record.verifiedAt);
  if (!comparableId) blockers.push('C3M_COMPARABLE_ID_REQUIRED');
  if (!transactionKey) blockers.push(`C3M_TRANSACTION_KEY_REQUIRED:${comparableId || 'UNKNOWN'}`);
  if (!sourcePropertyRef) blockers.push(`C3M_SOURCE_PROPERTY_REF_REQUIRED:${comparableId || 'UNKNOWN'}`);
  if (recordAssetType !== assetType) blockers.push(`C3M_COMPARABLE_ASSET_TYPE_MISMATCH:${comparableId || 'UNKNOWN'}`);
  if (basis !== unitOfComparison) blockers.push(`C3M_COMPARABLE_UNIT_BASIS_MISMATCH:${comparableId || 'UNKNOWN'}`);
  if (!isValidBasisQuantity(basisQuantity, unitOfComparison)) blockers.push(`C3M_COMPARABLE_BASIS_QUANTITY_INVALID:${comparableId || 'UNKNOWN'}`);
  if (!sourceRef) blockers.push(`C3M_COMPARABLE_MEASUREMENT_SOURCE_REQUIRED:${comparableId || 'UNKNOWN'}`);
  if (effectiveAtMs === null) blockers.push(`C3M_COMPARABLE_MEASUREMENT_EFFECTIVE_AT_REQUIRED:${comparableId || 'UNKNOWN'}`);
  else if (effectiveAtMs > asOfMs) blockers.push(`C3M_COMPARABLE_MEASUREMENT_EFFECTIVE_AT_FUTURE:${comparableId || 'UNKNOWN'}`);
  if (validUntilMs === null) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VALID_UNTIL_REQUIRED:${comparableId || 'UNKNOWN'}`);
  else if (validUntilMs < asOfMs) blockers.push(`C3M_COMPARABLE_MEASUREMENT_STALE:${comparableId || 'UNKNOWN'}`);
  if (!verifiedBy) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFIER_REQUIRED:${comparableId || 'UNKNOWN'}`);
  else if (!trustedMeasurementVerifierIds.includes(verifiedBy)) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFIER_UNTRUSTED:${comparableId || 'UNKNOWN'}`);
  if (!verificationReference) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFICATION_REFERENCE_REQUIRED:${comparableId || 'UNKNOWN'}`);
  if (verifiedAtMs === null) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFIED_AT_REQUIRED:${comparableId || 'UNKNOWN'}`);
  else {
    if (verifiedAtMs > asOfMs) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFIED_AT_FUTURE:${comparableId || 'UNKNOWN'}`);
    if (effectiveAtMs !== null && verifiedAtMs < effectiveAtMs) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VERIFIED_BEFORE_EFFECTIVE_AT:${comparableId || 'UNKNOWN'}`);
  }
  if (effectiveAtMs !== null && validUntilMs !== null && validUntilMs < effectiveAtMs) blockers.push(`C3M_COMPARABLE_MEASUREMENT_VALIDITY_WINDOW_INVALID:${comparableId || 'UNKNOWN'}`);
  const core = {
    comparableId: comparableId || null, transactionKey: transactionKey || null,
    sourcePropertyRef: sourcePropertyRef || null, assetType: recordAssetType || null,
    unitOfComparison: basis || null, basisQuantity: isValidBasisQuantity(basisQuantity, unitOfComparison) ? basisQuantity : null,
    sourceRef: sourceRef || null,
    effectiveAt: effectiveAtMs === null ? null : new Date(effectiveAtMs).toISOString(),
    validUntil: validUntilMs === null ? null : new Date(validUntilMs).toISOString(),
    verifiedBy: verifiedBy || null, verificationReference: verificationReference || null,
    verifiedAt: verifiedAtMs === null ? null : new Date(verifiedAtMs).toISOString(),
  };
  return { blockers, normalized: Object.freeze({ ...core, measurementEvidenceHashSha256: sha256(core) }) };
}

function normalizeAdjustment(record, { selectedIds, valuationDateMs, asOfMs, trustedAdjustmentReviewerIds }) {
  const blockers = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { blockers: ['C3M_ADJUSTMENT_OBJECT_REQUIRED'], normalized: null };
  const adjustmentId = cleanString(record.adjustmentId);
  const comparableId = cleanString(record.comparableId);
  const factor = cleanString(record.factor);
  const factorLabel = cleanString(record.factorLabel);
  const direction = cleanString(record.direction);
  const method = cleanString(record.method);
  const magnitude = record.magnitude;
  const rationale = cleanString(record.rationale);
  const evidenceRefs = Array.isArray(record.evidenceRefs) ? unique(record.evidenceRefs.map(cleanString).filter(Boolean)) : [];
  const reviewedBy = cleanString(record.reviewedBy);
  const reviewReference = cleanString(record.reviewReference);
  const reviewedAtMs = toTimestamp(record.reviewedAt);
  if (!adjustmentId) blockers.push('C3M_ADJUSTMENT_ID_REQUIRED');
  if (!selectedIds.has(comparableId)) blockers.push(`C3M_ADJUSTMENT_TARGET_NOT_SELECTED:${comparableId || 'MISSING'}`);
  if (!Object.values(WHOLE_PROPERTY_ADJUSTMENT_FACTOR).includes(factor)) blockers.push(`C3M_ADJUSTMENT_FACTOR_INVALID:${adjustmentId || 'UNKNOWN'}`);
  if (factor === WHOLE_PROPERTY_ADJUSTMENT_FACTOR.OTHER && !factorLabel) blockers.push(`C3M_ADJUSTMENT_OTHER_LABEL_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  if (!Object.values(WHOLE_PROPERTY_ADJUSTMENT_DIRECTION).includes(direction)) blockers.push(`C3M_ADJUSTMENT_DIRECTION_INVALID:${adjustmentId || 'UNKNOWN'}`);
  if (!Object.values(WHOLE_PROPERTY_ADJUSTMENT_METHOD).includes(method)) blockers.push(`C3M_ADJUSTMENT_METHOD_INVALID:${adjustmentId || 'UNKNOWN'}`);
  if (!isNonNegativeFinite(magnitude)) blockers.push(`C3M_ADJUSTMENT_MAGNITUDE_INVALID:${adjustmentId || 'UNKNOWN'}`);
  if (direction === WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.NONE && magnitude !== 0) blockers.push(`C3M_ADJUSTMENT_NONE_REQUIRES_ZERO:${adjustmentId || 'UNKNOWN'}`);
  if (direction !== WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.NONE && !(magnitude > 0)) blockers.push(`C3M_ADJUSTMENT_NONZERO_REQUIRES_POSITIVE:${adjustmentId || 'UNKNOWN'}`);
  if (!rationale) blockers.push(`C3M_ADJUSTMENT_RATIONALE_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  if (!evidenceRefs.length) blockers.push(`C3M_ADJUSTMENT_EVIDENCE_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  if (!reviewedBy) blockers.push(`C3M_ADJUSTMENT_REVIEWER_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  else if (!trustedAdjustmentReviewerIds.includes(reviewedBy)) blockers.push(`C3M_ADJUSTMENT_REVIEWER_UNTRUSTED:${adjustmentId || 'UNKNOWN'}`);
  if (!reviewReference) blockers.push(`C3M_ADJUSTMENT_REVIEW_REFERENCE_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  if (reviewedAtMs === null) blockers.push(`C3M_ADJUSTMENT_REVIEWED_AT_REQUIRED:${adjustmentId || 'UNKNOWN'}`);
  else {
    if (reviewedAtMs > asOfMs) blockers.push(`C3M_ADJUSTMENT_REVIEWED_AT_FUTURE:${adjustmentId || 'UNKNOWN'}`);
    if (valuationDateMs !== null && reviewedAtMs < valuationDateMs) blockers.push(`C3M_ADJUSTMENT_REVIEWED_BEFORE_VALUATION_DATE:${adjustmentId || 'UNKNOWN'}`);
  }
  const core = {
    adjustmentId: adjustmentId || null, comparableId: comparableId || null,
    factor: factor || null, factorLabel: factor === WHOLE_PROPERTY_ADJUSTMENT_FACTOR.OTHER ? factorLabel || null : null,
    direction: direction || null, method: method || null,
    magnitude: isNonNegativeFinite(magnitude) ? magnitude : null,
    rationale: rationale || null, evidenceRefs,
    reviewedBy: reviewedBy || null, reviewReference: reviewReference || null,
    reviewedAt: reviewedAtMs === null ? null : new Date(reviewedAtMs).toISOString(),
  };
  return { blockers, normalized: Object.freeze({ ...core, adjustmentHashSha256: sha256(core) }) };
}

function buildWholePropertySalesComparisonInputPacket({
  packetId, caseId, propertyRef, valuationDate, asOf = new Date(), unitOfComparison,
  subjectMeasurementId, subjectPropertyEvidencePacket, marketEvidence, marketContextBinding,
  trustedMarketContextBinderIds = [], comparableMeasurements, trustedMeasurementVerifierIds = [],
  selectedComparableIds, selectionRationales, selectedBy, selectionReference, selectedAt,
  trustedComparableSelectorIds = [], adjustmentRecords = [], trustedAdjustmentReviewerIds = [],
  reconciliationPolicyId, governedReconciliationPolicies = {}, weightsByComparableId, weightRationales,
  reconciledBy, reconciliationReference, reconciledAt, trustedReconcilerIds = [],
} = {}) {
  const packet = cleanString(packetId);
  const caseKey = cleanString(caseId);
  const property = cleanString(propertyRef);
  const valuationDateMs = toTimestamp(valuationDate);
  const asOfMs = new Date(asOf).getTime();
  const comparisonUnit = cleanString(unitOfComparison);
  const context = {
    packetId: packet || null, caseId: caseKey || null, propertyRef: property || null,
    valuationDate: valuationDateMs === null ? null : new Date(valuationDateMs).toISOString(),
    unitOfComparison: comparisonUnit || null,
  };
  if (!Number.isFinite(asOfMs)) throw new TypeError('asOf must be a valid date');
  const basicBlockers = [];
  if (!packet) basicBlockers.push('C3M_PACKET_ID_REQUIRED');
  if (!caseKey) basicBlockers.push('C3M_CASE_ID_REQUIRED');
  if (!property) basicBlockers.push('C3M_PROPERTY_REF_REQUIRED');
  if (valuationDateMs === null) basicBlockers.push('C3M_VALUATION_DATE_REQUIRED');
  else if (valuationDateMs > asOfMs) basicBlockers.push('C3M_VALUATION_DATE_FUTURE');
  if (!Object.values(WHOLE_PROPERTY_UNIT_OF_COMPARISON).includes(comparisonUnit)) basicBlockers.push(`C3M_UNIT_OF_COMPARISON_INVALID:${comparisonUnit || 'MISSING'}`);
  if (basicBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_INTEGRITY, basicBlockers, context);

  const valuationDateIso = new Date(valuationDateMs).toISOString();
  const propertyBlockers = [];
  const propertyPacket = subjectPropertyEvidencePacket;
  if (!propertyPacket || typeof propertyPacket !== 'object' || Array.isArray(propertyPacket)) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_PACKET_REQUIRED');
  else {
    if (propertyPacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW || propertyPacket.professionalValuationWorkflowReady !== true) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_PACKET_NOT_READY');
    if (cleanString(propertyPacket.caseId) !== caseKey) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_CASE_MISMATCH');
    if (cleanString(propertyPacket.propertyRef) !== property) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_PROPERTY_MISMATCH');
    if (toTimestamp(propertyPacket.valuationDate) !== valuationDateMs) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_VALUATION_DATE_MISMATCH');
    if (!verifyPropertyEvidencePacketIntegrity(propertyPacket)) propertyBlockers.push('C3M_PROPERTY_EVIDENCE_PACKET_INTEGRITY_FAILED');
  }
  if (propertyBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, propertyBlockers, context);

  const marketInput = marketEvidence && typeof marketEvidence === 'object' && !Array.isArray(marketEvidence) ? marketEvidence : {};
  let marketEvaluation = null;
  const marketBlockers = [];
  try { marketEvaluation = evaluateMarketEvidenceBundle({ ...marketInput, asOf: new Date(asOfMs) }); }
  catch (error) { marketBlockers.push(`C3M_MARKET_EVALUATION_ERROR:${error.message}`); }
  if (!marketEvaluation || marketEvaluation.status !== MARKET_GATE_STATUS.READY || marketEvaluation.decisionReady !== true) marketBlockers.push('C3M_MARKET_EVIDENCE_NOT_READY');
  const marketAssetType = cleanString(marketInput.assetType);
  if (cleanString(propertyPacket.assetType) !== marketAssetType) marketBlockers.push('C3M_SUBJECT_MARKET_ASSET_TYPE_MISMATCH');
  if (marketBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_EVIDENCE, marketBlockers, context);

  const binders = cleanStringArray(trustedMarketContextBinderIds, 'trustedMarketContextBinderIds');
  const binding = evaluateMarketContextBinding(marketContextBinding, {
    propertyRef: property, marketEvidence: marketInput, valuationDateMs, asOfMs, trustedMarketContextBinderIds: binders,
  });
  if (binding.blockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_CONTEXT_BINDING, binding.blockers, context);

  const policyEvaluation = validatePolicy(reconciliationPolicyId, governedReconciliationPolicies, comparisonUnit, marketAssetType);
  if (policyEvaluation.blockers.length || !policyEvaluation.policy) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_RECONCILIATION, policyEvaluation.blockers, context);
  const policy = policyEvaluation.policy;

  const expectedMeasurementType = SUBJECT_MEASUREMENT_TYPE_BY_UNIT[comparisonUnit];
  const expectedMeasurementUnit = SUBJECT_MEASUREMENT_UNIT_BY_COMPARISON_UNIT[comparisonUnit];
  const subjectMeasurement = Array.isArray(propertyPacket.measurements)
    ? propertyPacket.measurements.find((item) => cleanString(item.measurementId) === cleanString(subjectMeasurementId)) : null;
  const subjectBlockers = [];
  if (!subjectMeasurement) subjectBlockers.push('C3M_SUBJECT_MEASUREMENT_NOT_FOUND');
  else {
    if (cleanString(subjectMeasurement.type) !== expectedMeasurementType) subjectBlockers.push(`C3M_SUBJECT_MEASUREMENT_TYPE_MISMATCH:${cleanString(subjectMeasurement.type)}/${expectedMeasurementType}`);
    if (cleanString(subjectMeasurement.unit) !== expectedMeasurementUnit) subjectBlockers.push(`C3M_SUBJECT_MEASUREMENT_UNIT_MISMATCH:${cleanString(subjectMeasurement.unit)}/${expectedMeasurementUnit}`);
    if (!isValidBasisQuantity(subjectMeasurement.value, comparisonUnit)) subjectBlockers.push('C3M_SUBJECT_MEASUREMENT_VALUE_INVALID');
    if (!HASH_RE.test(cleanString(subjectMeasurement.measurementHashSha256))) subjectBlockers.push('C3M_SUBJECT_MEASUREMENT_HASH_REQUIRED');
    const measuredAtMs = toTimestamp(subjectMeasurement.measuredAt);
    if (measuredAtMs === null) subjectBlockers.push('C3M_SUBJECT_MEASUREMENT_MEASURED_AT_REQUIRED');
    else if (measuredAtMs > asOfMs) subjectBlockers.push('C3M_SUBJECT_MEASUREMENT_MEASURED_AT_FUTURE');
  }
  if (subjectBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_SUBJECT_MEASUREMENT, subjectBlockers, context);

  const measurementVerifiers = cleanStringArray(trustedMeasurementVerifierIds, 'trustedMeasurementVerifierIds');
  if (!Array.isArray(comparableMeasurements)) throw new TypeError('comparableMeasurements must be an array');
  const measurementFindings = comparableMeasurements.map((record) => normalizeComparableMeasurement(record, {
    assetType: marketAssetType, unitOfComparison: comparisonUnit, asOfMs, trustedMeasurementVerifierIds: measurementVerifiers,
  }));
  const comparableBlockers = measurementFindings.flatMap((item) => item.blockers);
  const normalizedMeasurements = measurementFindings.map((item) => item.normalized).filter(Boolean);
  const measurementById = new Map();
  const measurementTransactionKeys = new Set();
  for (const record of normalizedMeasurements) {
    if (measurementById.has(record.comparableId)) comparableBlockers.push(`C3M_DUPLICATE_COMPARABLE_ID:${record.comparableId}`);
    measurementById.set(record.comparableId, record);
    if (measurementTransactionKeys.has(record.transactionKey)) comparableBlockers.push(`C3M_DUPLICATE_TRANSACTION_KEY:${record.transactionKey}`);
    measurementTransactionKeys.add(record.transactionKey);
  }
  if (comparableBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_COMPARABLE_MEASUREMENT, comparableBlockers, context);

  if (!Array.isArray(selectedComparableIds)) throw new TypeError('selectedComparableIds must be an array');
  const selectedRaw = selectedComparableIds.map(cleanString);
  const selectedIds = selectedRaw.filter(Boolean);
  const selectionBlockers = [];
  if (selectedRaw.some((id) => !id)) selectionBlockers.push('C3M_SELECTED_COMPARABLE_ID_REQUIRED');
  if (new Set(selectedIds).size !== selectedIds.length) selectionBlockers.push('C3M_DUPLICATE_SELECTED_COMPARABLE_ID');
  if (selectedIds.length < policy.minimumComparableCount) selectionBlockers.push(`C3M_MINIMUM_COMPARABLES_NOT_MET:${selectedIds.length}/${policy.minimumComparableCount}`);
  const selectionRationaleMap = selectionRationales && typeof selectionRationales === 'object' && !Array.isArray(selectionRationales) ? selectionRationales : {};
  const selector = cleanString(selectedBy);
  const selectorReference = cleanString(selectionReference);
  const selectedAtMs = toTimestamp(selectedAt);
  const trustedSelectors = cleanStringArray(trustedComparableSelectorIds, 'trustedComparableSelectorIds');
  if (!selector) selectionBlockers.push('C3M_COMPARABLE_SELECTOR_REQUIRED');
  else if (!trustedSelectors.includes(selector)) selectionBlockers.push(`C3M_COMPARABLE_SELECTOR_UNTRUSTED:${selector}`);
  if (!selectorReference) selectionBlockers.push('C3M_COMPARABLE_SELECTION_REFERENCE_REQUIRED');
  if (selectedAtMs === null) selectionBlockers.push('C3M_COMPARABLE_SELECTED_AT_REQUIRED');
  else {
    if (selectedAtMs > asOfMs) selectionBlockers.push('C3M_COMPARABLE_SELECTED_AT_FUTURE');
    if (selectedAtMs < valuationDateMs) selectionBlockers.push('C3M_COMPARABLE_SELECTED_BEFORE_VALUATION_DATE');
  }
  for (const id of selectedIds) {
    if (!measurementById.has(id)) selectionBlockers.push(`C3M_SELECTED_COMPARABLE_MEASUREMENT_NOT_FOUND:${id}`);
    if (!cleanString(selectionRationaleMap[id])) selectionBlockers.push(`C3M_SELECTION_RATIONALE_REQUIRED:${id}`);
  }
  if (selectionBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_SELECTION, selectionBlockers, context);

  const c2SalesByTransactionKey = new Map();
  for (const record of marketEvaluation.authoritativeEvidence || []) {
    if (record.evidenceType === MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION && cleanString(record.transactionKey)) c2SalesByTransactionKey.set(record.transactionKey, record);
  }
  const saleBindingBlockers = [];
  const baseComparableById = new Map();
  for (const id of selectedIds) {
    const measurement = measurementById.get(id);
    const c2Sale = c2SalesByTransactionKey.get(measurement.transactionKey);
    if (!c2Sale) {
      saleBindingBlockers.push(`C3M_C2_CLOSED_SALE_NOT_FOUND:${id}:${measurement.transactionKey}`);
      continue;
    }
    const saleEffectiveAtMs = toTimestamp(c2Sale.effectiveAt);
    if (saleEffectiveAtMs === null) saleBindingBlockers.push(`C3M_C2_SALE_EFFECTIVE_AT_REQUIRED:${id}:${measurement.transactionKey}`);
    else if (saleEffectiveAtMs > valuationDateMs) saleBindingBlockers.push(`C3M_POST_VALUATION_DATE_SALE_NOT_ELIGIBLE:${id}:${measurement.transactionKey}`);
    const measurementEffectiveAtMs = toTimestamp(measurement.effectiveAt);
    if (saleEffectiveAtMs !== null && measurementEffectiveAtMs !== null && daysApart(saleEffectiveAtMs, measurementEffectiveAtMs) > policy.maxMeasurementTransactionDateGapDays) {
      saleBindingBlockers.push(`C3M_MEASUREMENT_TRANSACTION_DATE_GAP_EXCEEDS_POLICY:${id}`);
    }
    const amountSar = c2Sale.normalizedValue && c2Sale.normalizedValue.amountSar;
    if (!isPositiveFinite(amountSar)) {
      saleBindingBlockers.push(`C3M_C2_TOTAL_SALE_AMOUNT_REQUIRED:${id}:${measurement.transactionKey}`);
      continue;
    }
    const baseUnitValueSar = amountSar / measurement.basisQuantity;
    if (!isPositiveFinite(baseUnitValueSar)) {
      saleBindingBlockers.push(`C3M_BASE_UNIT_VALUE_INVALID:${id}`);
      continue;
    }
    baseComparableById.set(id, Object.freeze({
      comparableId: id, transactionKey: measurement.transactionKey,
      transactionEffectiveAt: saleEffectiveAtMs === null ? null : new Date(saleEffectiveAtMs).toISOString(),
      sourcePropertyRef: measurement.sourcePropertyRef,
      measurementEvidenceHashSha256: measurement.measurementEvidenceHashSha256,
      measurementEffectiveAt: measurement.effectiveAt,
      c2EvidenceId: c2Sale.id, c2NormalizedValueHash: c2Sale.normalizedValueHash,
      saleAmountSar: amountSar, basisQuantity: measurement.basisQuantity,
      unitOfComparison: comparisonUnit, baseUnitValueSar,
    }));
  }
  if (saleBindingBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_EVIDENCE, saleBindingBlockers, context);

  const selectedSet = new Set(selectedIds);
  const adjustmentReviewers = cleanStringArray(trustedAdjustmentReviewerIds, 'trustedAdjustmentReviewerIds');
  if (!Array.isArray(adjustmentRecords)) throw new TypeError('adjustmentRecords must be an array');
  const adjustmentFindings = adjustmentRecords.map((record) => normalizeAdjustment(record, {
    selectedIds: selectedSet, valuationDateMs, asOfMs, trustedAdjustmentReviewerIds: adjustmentReviewers,
  }));
  const adjustmentBlockers = adjustmentFindings.flatMap((item) => item.blockers);
  const normalizedAdjustments = adjustmentFindings.map((item) => item.normalized).filter(Boolean);
  const seenAdjustmentIds = new Set();
  const byComparable = new Map(selectedIds.map((id) => [id, []]));
  for (const adjustment of normalizedAdjustments) {
    if (seenAdjustmentIds.has(adjustment.adjustmentId)) adjustmentBlockers.push(`C3M_DUPLICATE_ADJUSTMENT_ID:${adjustment.adjustmentId}`);
    seenAdjustmentIds.add(adjustment.adjustmentId);
    if (byComparable.has(adjustment.comparableId)) byComparable.get(adjustment.comparableId).push(adjustment);
  }

  const adjustedIndications = [];
  for (const id of selectedIds) {
    const base = baseComparableById.get(id);
    const records = byComparable.get(id) || [];
    if (records.length === 0) adjustmentBlockers.push(`C3M_TRUSTED_ADJUSTMENT_DISPOSITION_REQUIRED:${id}`);
    const seenFactors = new Set();
    let netDelta = 0;
    let grossDelta = 0;
    const trace = [];
    for (const adjustment of records) {
      const factorKey = adjustment.factor === WHOLE_PROPERTY_ADJUSTMENT_FACTOR.OTHER ? `${adjustment.factor}:${adjustment.factorLabel}` : adjustment.factor;
      if (seenFactors.has(factorKey)) adjustmentBlockers.push(`C3M_DUPLICATE_ADJUSTMENT_FACTOR:${id}:${factorKey}`);
      seenFactors.add(factorKey);
      const sign = adjustment.direction === WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.INCREASE ? 1
        : adjustment.direction === WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.DECREASE ? -1 : 0;
      const delta = adjustment.method === WHOLE_PROPERTY_ADJUSTMENT_METHOD.PERCENT_OF_BASE
        ? sign * base.baseUnitValueSar * adjustment.magnitude : sign * adjustment.magnitude;
      if (!Number.isFinite(delta)) {
        adjustmentBlockers.push(`C3M_ADJUSTMENT_DELTA_NON_FINITE:${adjustment.adjustmentId}`);
        continue;
      }
      const effectivePercent = Math.abs(delta) / base.baseUnitValueSar;
      if (effectivePercent > policy.maxSingleAdjustmentPercent + 1e-12) adjustmentBlockers.push(`C3M_SINGLE_ADJUSTMENT_EXCEEDS_POLICY:${adjustment.adjustmentId}`);
      netDelta += delta;
      grossDelta += Math.abs(delta);
      trace.push(Object.freeze({ ...adjustment, deltaSarPerBasisUnit: delta, effectivePercentOfBase: effectivePercent }));
    }
    const adjustedUnitValueSar = base.baseUnitValueSar + netDelta;
    const netAdjustmentPercent = netDelta / base.baseUnitValueSar;
    const grossAdjustmentPercent = grossDelta / base.baseUnitValueSar;
    if (!isPositiveFinite(adjustedUnitValueSar)) adjustmentBlockers.push(`C3M_ADJUSTED_UNIT_VALUE_INVALID:${id}`);
    if (Math.abs(netAdjustmentPercent) > policy.maxNetAdjustmentPercent + 1e-12) adjustmentBlockers.push(`C3M_NET_ADJUSTMENT_EXCEEDS_POLICY:${id}`);
    if (grossAdjustmentPercent > policy.maxGrossAdjustmentPercent + 1e-12) adjustmentBlockers.push(`C3M_GROSS_ADJUSTMENT_EXCEEDS_POLICY:${id}`);
    adjustedIndications.push(Object.freeze({
      ...base, adjustmentTrace: Object.freeze(trace),
      explicitNoAdjustmentDisposition: records.some((record) => record.direction === WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.NONE),
      netAdjustmentSarPerBasisUnit: netDelta, netAdjustmentPercent, grossAdjustmentPercent, adjustedUnitValueSar,
    }));
  }
  if (adjustmentBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_ADJUSTMENT, adjustmentBlockers, context);

  const weights = weightsByComparableId && typeof weightsByComparableId === 'object' && !Array.isArray(weightsByComparableId) ? weightsByComparableId : null;
  const rationaleMap = weightRationales && typeof weightRationales === 'object' && !Array.isArray(weightRationales) ? weightRationales : {};
  const reconciler = cleanString(reconciledBy);
  const reconciliationRef = cleanString(reconciliationReference);
  const reconciledAtMs = toTimestamp(reconciledAt);
  const reconcilers = cleanStringArray(trustedReconcilerIds, 'trustedReconcilerIds');
  const reconciliationBlockers = [];
  if (!weights) reconciliationBlockers.push('C3M_WEIGHTS_MAP_REQUIRED');
  if (!reconciler) reconciliationBlockers.push('C3M_RECONCILER_REQUIRED');
  else if (!reconcilers.includes(reconciler)) reconciliationBlockers.push(`C3M_RECONCILER_UNTRUSTED:${reconciler}`);
  if (!reconciliationRef) reconciliationBlockers.push('C3M_RECONCILIATION_REFERENCE_REQUIRED');
  if (reconciledAtMs === null) reconciliationBlockers.push('C3M_RECONCILED_AT_REQUIRED');
  else {
    if (reconciledAtMs > asOfMs) reconciliationBlockers.push('C3M_RECONCILED_AT_FUTURE');
    if (reconciledAtMs < valuationDateMs) reconciliationBlockers.push('C3M_RECONCILED_BEFORE_VALUATION_DATE');
  }

  let weightSum = 0;
  const weightedIndications = adjustedIndications.map((indication) => {
    const weight = weights ? weights[indication.comparableId] : undefined;
    if (!(typeof weight === 'number' && Number.isFinite(weight) && weight > 0 && weight <= 1)) reconciliationBlockers.push(`C3M_POSITIVE_WEIGHT_REQUIRED:${indication.comparableId}`);
    else {
      if (weight > policy.maxSingleComparableWeight + 1e-12) reconciliationBlockers.push(`C3M_WEIGHT_EXCEEDS_POLICY:${indication.comparableId}`);
      weightSum += weight;
    }
    if (!cleanString(rationaleMap[indication.comparableId])) reconciliationBlockers.push(`C3M_WEIGHT_RATIONALE_REQUIRED:${indication.comparableId}`);
    return Object.freeze({ ...indication, weight: typeof weight === 'number' && Number.isFinite(weight) ? weight : null, weightRationale: cleanString(rationaleMap[indication.comparableId]) || null });
  });
  if (weights) for (const key of Object.keys(weights)) if (!selectedSet.has(key)) reconciliationBlockers.push(`C3M_WEIGHT_TARGET_NOT_SELECTED:${key}`);
  if (Math.abs(weightSum - 1) > 1e-9) reconciliationBlockers.push(`C3M_WEIGHTS_SUM_INVALID:${weightSum}`);
  if (!reconciliationBlockers.length) {
    const candidateWeightedUnitValue = weightedIndications.reduce((sum, item) => sum + item.adjustedUnitValueSar * item.weight, 0);
    const values = weightedIndications.map((item) => item.adjustedUnitValueSar);
    const spreadRatio = (Math.max(...values) - Math.min(...values)) / candidateWeightedUnitValue;
    if (!Number.isFinite(spreadRatio) || spreadRatio < 0) reconciliationBlockers.push('C3M_ADJUSTED_UNIT_SPREAD_INVALID');
    else if (spreadRatio > policy.maxAdjustedUnitSpreadRatio + 1e-12) reconciliationBlockers.push(`C3M_ADJUSTED_UNIT_SPREAD_EXCEEDS_POLICY:${spreadRatio}`);
  }
  if (reconciliationBlockers.length) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_RECONCILIATION, reconciliationBlockers, context);

  const marketEvidenceEvaluationHashSha256 = sha256(marketEvaluation);
  if (!marketEvidenceEvaluationHashSha256) return hold(WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_INTEGRITY, ['C3M_MARKET_EVALUATION_HASH_FAILED'], context);
  const core = {
    schemaVersion: C3M_WHOLE_PROPERTY_SALES_COMPARISON_SCHEMA_VERSION,
    version: C3M_WHOLE_PROPERTY_SALES_INPUT_VERSION,
    packetId: packet, caseId: caseKey, propertyRef: property, valuationDate: valuationDateIso,
    asOf: new Date(asOfMs).toISOString(), valueScope: 'WHOLE_PROPERTY', unitOfComparison: comparisonUnit,
    assetType: marketAssetType, propertyEvidencePacketHashSha256: propertyPacket.packetHashSha256,
    subjectMeasurement: {
      measurementId: subjectMeasurement.measurementId, type: subjectMeasurement.type, unit: subjectMeasurement.unit,
      value: subjectMeasurement.value, source: subjectMeasurement.source, sourceEvidenceRef: subjectMeasurement.sourceEvidenceRef,
      measurementStandardRef: subjectMeasurement.measurementStandardRef, measurementMethod: subjectMeasurement.measurementMethod,
      measuredAt: subjectMeasurement.measuredAt, measurementHashSha256: subjectMeasurement.measurementHashSha256,
    },
    marketEvidenceEvaluationHashSha256, marketContextBinding: binding.normalized,
    reconciliationPolicyId: policyEvaluation.policyId,
    comparableSelection: {
      selectedComparableIds: Object.freeze([...selectedIds]),
      selectionRationales: Object.freeze(Object.fromEntries(selectedIds.map((id) => [id, cleanString(selectionRationaleMap[id])]))),
      selectedBy: selector, selectionReference: selectorReference, selectedAt: new Date(selectedAtMs).toISOString(),
    },
    indications: weightedIndications, reconciledBy: reconciler,
    reconciliationReference: reconciliationRef, reconciledAt: new Date(reconciledAtMs).toISOString(),
  };
  return deepFreeze({
    ...core,
    wholePropertySalesComparisonInputHashSha256: sha256(core),
    status: WHOLE_PROPERTY_SALES_INPUT_STATUS.READY_FOR_CANONICAL_WHOLE_PROPERTY_SALES_CALCULATION,
    blockers: [], readyForCanonicalWholePropertySalesCalculation: true,
    c2MarketEvidenceReevaluatedInternally: true, propertyToMarketContextBindingRequired: true,
    explicitUnitOfComparisonRequired: true, transactionDateLookAheadBlocked: true,
    comparableMeasurementTemporalGovernanceRequired: true, professionalComparableSelectionRecorded: true,
    trustedAdjustmentDispositionRequiredForEverySelectedComparable: true,
    professionalAdjustmentDispositionRecorded: true, professionalWeightsExplicit: true,
    automaticComparableSelection: false, automaticAdjustmentEstimated: false, automaticComparableWeighting: false,
    wholePropertyMarketValueIndicationProduced: false, finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false, transactionAuthorized: false, publicAiAuthorized: false,
    semantics: 'C3M input governance binds a verified WHOLE_PROPERTY subject measurement to C2-qualified pre-valuation-date closed-sale transactions through separately verified, temporally governed comparable property denominators, an explicit common unit of comparison, trusted professional selection, trusted reviewed adjustment/no-adjustment dispositions for every selected comparable, and explicit professional weights. It never infers a denominator from generic transaction area, uses asking evidence as a sale, looks ahead to post-valuation-date sales, invents adjustments/weights, certifies a valuation or authorizes a transaction.',
  });
}

function verifyWholePropertySalesComparisonInputIntegrity(packet) {
  if (!packet || packet.status !== WHOLE_PROPERTY_SALES_INPUT_STATUS.READY_FOR_CANONICAL_WHOLE_PROPERTY_SALES_CALCULATION) return false;
  const digest = cleanString(packet.wholePropertySalesComparisonInputHashSha256);
  if (!HASH_RE.test(digest)) return false;
  const core = {
    schemaVersion: packet.schemaVersion, version: packet.version, packetId: packet.packetId,
    caseId: packet.caseId, propertyRef: packet.propertyRef, valuationDate: packet.valuationDate,
    asOf: packet.asOf, valueScope: packet.valueScope, unitOfComparison: packet.unitOfComparison,
    assetType: packet.assetType, propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    subjectMeasurement: packet.subjectMeasurement, marketEvidenceEvaluationHashSha256: packet.marketEvidenceEvaluationHashSha256,
    marketContextBinding: packet.marketContextBinding, reconciliationPolicyId: packet.reconciliationPolicyId,
    comparableSelection: packet.comparableSelection, indications: packet.indications,
    reconciledBy: packet.reconciledBy, reconciliationReference: packet.reconciliationReference,
    reconciledAt: packet.reconciledAt,
  };
  return sha256(core) === digest.toLowerCase();
}

module.exports = {
  C3M_WHOLE_PROPERTY_SALES_INPUT_VERSION,
  buildWholePropertySalesComparisonInputPacket,
  verifyWholePropertySalesComparisonInputIntegrity,
  verifyPropertyEvidencePacketIntegrity,
};
