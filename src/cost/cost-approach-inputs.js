'use strict';

const crypto = require('crypto');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');

const COST_BASIS = Object.freeze({
  REPLACEMENT_COST_NEW: 'REPLACEMENT_COST_NEW',
  REPRODUCTION_COST_NEW: 'REPRODUCTION_COST_NEW',
});

const COST_COMPONENT_CLASS = Object.freeze({
  STRUCTURE: 'STRUCTURE',
  MEP: 'MEP',
  FITOUT: 'FITOUT',
  SITE_IMPROVEMENT: 'SITE_IMPROVEMENT',
  PROFESSIONAL_FEE: 'PROFESSIONAL_FEE',
  INDIRECT_COST: 'INDIRECT_COST',
  OTHER: 'OTHER',
});

const COST_SOURCE_CLASS = Object.freeze({
  OFFICIAL_COST_INDEX: 'OFFICIAL_COST_INDEX',
  VERIFIED_QUANTITY_SURVEY: 'VERIFIED_QUANTITY_SURVEY',
  VERIFIED_CONTRACTOR_QUOTE: 'VERIFIED_CONTRACTOR_QUOTE',
  VERIFIED_HISTORICAL_COST: 'VERIFIED_HISTORICAL_COST',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  ASSUMED: 'ASSUMED',
});

const COST_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
});

const LAND_VALUE_METHOD_REFERENCE = Object.freeze({
  SALES_COMPARISON: 'SALES_COMPARISON',
  ALLOCATION: 'ALLOCATION',
  EXTRACTION: 'EXTRACTION',
  GROUND_RENT_CAPITALIZATION: 'GROUND_RENT_CAPITALIZATION',
  RESIDUAL: 'RESIDUAL',
  OTHER: 'OTHER',
});

const DEPRECIATION_TYPE = Object.freeze({
  PHYSICAL_CURABLE: 'PHYSICAL_CURABLE',
  PHYSICAL_INCURABLE: 'PHYSICAL_INCURABLE',
  FUNCTIONAL_CURABLE: 'FUNCTIONAL_CURABLE',
  FUNCTIONAL_INCURABLE: 'FUNCTIONAL_INCURABLE',
  EXTERNAL_OBSOLESCENCE: 'EXTERNAL_OBSOLESCENCE',
});

const DEPRECIATION_METHOD = Object.freeze({
  AMOUNT_SAR: 'AMOUNT_SAR',
  PERCENT_OF_IMPROVEMENT_COST_NEW: 'PERCENT_OF_IMPROVEMENT_COST_NEW',
});

const COST_APPROACH_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_COST_CALCULATION: 'READY_FOR_CANONICAL_COST_CALCULATION',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_COST_EVIDENCE: 'HOLD_COST_EVIDENCE',
  HOLD_LAND_VALUE_INPUT: 'HOLD_LAND_VALUE_INPUT',
  HOLD_DEPRECIATION: 'HOLD_DEPRECIATION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function positiveFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
}

function nonNegativeFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
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

function verifyHash(record, field) {
  if (!record || typeof record !== 'object') return false;
  const digest = record[field];
  if (!nonEmpty(digest) || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const payload = { ...record };
  delete payload[field];
  return sha256(payload) === digest.toLowerCase();
}

function normalizeVerification(verification, capturedAtIso, prefix) {
  if (!verification || typeof verification !== 'object') throw new TypeError(`${prefix}.verification is required`);
  assertEnum(verification.status, COST_VERIFICATION_STATUS, `${prefix}.verification.status`);
  if (verification.status === COST_VERIFICATION_STATUS.NOT_VERIFIED) {
    return {
      status: verification.status,
      verifiedByRef: null,
      verifiedAt: null,
      verificationEvidenceRef: null,
    };
  }
  assertNonEmpty(verification.verifiedByRef, `${prefix}.verification.verifiedByRef`);
  assertNonEmpty(verification.verificationEvidenceRef, `${prefix}.verification.verificationEvidenceRef`);
  const verifiedAtIso = iso(verification.verifiedAt, `${prefix}.verification.verifiedAt`);
  if (Date.parse(verifiedAtIso) < Date.parse(capturedAtIso)) throw new TypeError(`${prefix.toUpperCase()}_VERIFICATION_BEFORE_CAPTURE`);
  return {
    status: verification.status,
    verifiedByRef: verification.verifiedByRef.trim(),
    verifiedAt: verifiedAtIso,
    verificationEvidenceRef: verification.verificationEvidenceRef.trim(),
  };
}

function createCostComponentRecord({
  componentId,
  caseId,
  propertyRef,
  componentClass,
  description,
  quantity,
  unit,
  unitCostSar,
  costBasis,
  sourceClass,
  sourceName,
  sourceRef,
  sourceDate,
  verification,
  capturedAt,
} = {}) {
  for (const [field, value] of [
    ['componentId', componentId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['description', description], ['unit', unit], ['sourceName', sourceName], ['sourceRef', sourceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(componentClass, COST_COMPONENT_CLASS, 'componentClass');
  assertEnum(costBasis, COST_BASIS, 'costBasis');
  assertEnum(sourceClass, COST_SOURCE_CLASS, 'sourceClass');
  positiveFinite(quantity, 'quantity');
  positiveFinite(unitCostSar, 'unitCostSar');
  const sourceDateIso = iso(sourceDate, 'sourceDate');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  if (Date.parse(sourceDateIso) > Date.parse(capturedAtIso)) throw new TypeError('COST_SOURCE_DATE_AFTER_CAPTURE');
  const normalizedVerification = normalizeVerification(verification, capturedAtIso, 'costComponent');

  const record = {
    schemaVersion: 1,
    componentId: componentId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    componentClass,
    description: description.trim(),
    quantity,
    unit: unit.trim(),
    unitCostSar,
    costBasis,
    sourceClass,
    sourceName: sourceName.trim(),
    sourceRef: sourceRef.trim(),
    sourceDate: sourceDateIso,
    verification: normalizedVerification,
    capturedAt: capturedAtIso,
    extendedCostCalculatedOutsideCanonicalEngine: false,
    canonicalEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  record.costComponentHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyCostComponentIntegrity(record) {
  return verifyHash(record, 'costComponentHashSha256');
}

function createProfessionalLandValueInput({
  landValueId,
  caseId,
  propertyRef,
  valueSar,
  methodReference,
  methodDetail = null,
  rationale,
  evidenceRefs,
  valuationDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['landValueId', landValueId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(methodReference, LAND_VALUE_METHOD_REFERENCE, 'methodReference');
  if (methodReference === LAND_VALUE_METHOD_REFERENCE.OTHER) assertNonEmpty(methodDetail, 'methodDetail');
  positiveFinite(valueSar, 'valueSar');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('evidenceRefs must be a non-empty array');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('LAND_VALUE_REVIEW_BEFORE_PREPARATION');

  const record = {
    schemaVersion: 1,
    landValueId: landValueId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valueSar,
    methodReference,
    methodDetail: methodReference === LAND_VALUE_METHOD_REFERENCE.OTHER ? methodDetail.trim() : null,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    valuationDate: valuationDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    landValueCalculatedByThisModule: false,
    professionalJudgmentExplicit: true,
    finalValuationConclusionEstablished: false,
    transactionAuthorized: false,
  };
  record.landValueInputHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyLandValueInputIntegrity(record) {
  return verifyHash(record, 'landValueInputHashSha256');
}

function createDepreciationRecord({
  depreciationId,
  caseId,
  propertyRef,
  type,
  method,
  magnitude,
  rationale,
  evidenceRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['depreciationId', depreciationId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(type, DEPRECIATION_TYPE, 'type');
  assertEnum(method, DEPRECIATION_METHOD, 'method');
  nonNegativeFinite(magnitude, 'magnitude');
  if (method === DEPRECIATION_METHOD.PERCENT_OF_IMPROVEMENT_COST_NEW && magnitude > 1) throw new TypeError('DEPRECIATION_PERCENT_MUST_BE_BETWEEN_0_AND_1');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) throw new TypeError('evidenceRefs must be a non-empty array');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('DEPRECIATION_REVIEW_BEFORE_PREPARATION');

  const record = {
    schemaVersion: 1,
    depreciationId: depreciationId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    method,
    magnitude,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    depreciationCalculatedOutsideCanonicalEngine: false,
    professionalJudgmentExplicit: true,
    finalValuationConclusionEstablished: false,
    transactionAuthorized: false,
  };
  record.depreciationHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyDepreciationIntegrity(record) {
  return verifyHash(record, 'depreciationHashSha256');
}

function hold(status, blockers, caseId, propertyRef) {
  return deepFreeze({
    schemaVersion: 1,
    caseId,
    propertyRef,
    status,
    blockers,
    readyForCanonicalCostCalculation: false,
    canonicalEngineInputsWritten: false,
    costApproachValueIndicationProduced: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildCostApproachInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  propertyEvidencePacket,
  costComponents,
  landValueInput,
  depreciationRecords,
  allowedCostSourceClasses,
  maxCostSourceAgeDays,
  preparedByRef,
  preparedAt,
  packetEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['packetEvidenceRef', packetEvidenceRef],
  ]) assertNonEmpty(value, field);
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  if (!Array.isArray(costComponents) || costComponents.length === 0) throw new TypeError('costComponents must be a non-empty array');
  if (!Array.isArray(depreciationRecords)) throw new TypeError('depreciationRecords must be an array');
  if (!landValueInput || typeof landValueInput !== 'object') throw new TypeError('landValueInput is required');
  if (!Array.isArray(allowedCostSourceClasses) || allowedCostSourceClasses.length === 0) throw new TypeError('allowedCostSourceClasses must be a non-empty array');
  allowedCostSourceClasses.forEach((value) => assertEnum(value, COST_SOURCE_CLASS, 'allowedCostSourceClass'));
  if (!Number.isInteger(maxCostSourceAgeDays) || maxCostSourceAgeDays < 0) throw new TypeError('maxCostSourceAgeDays must be a non-negative integer');

  if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true
      || !/^[a-f0-9]{64}$/i.test(String(propertyEvidencePacket.packetHashSha256 || ''))) {
    return hold(COST_APPROACH_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY'], caseId, propertyRef);
  }

  const blockers = [];
  const seenComponentIds = new Set();
  for (const component of costComponents) {
    if (!component || component.caseId !== caseId || component.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:costComponent');
    if (seenComponentIds.has(component.componentId)) blockers.push(`DUPLICATE_COST_COMPONENT_ID:${component.componentId}`);
    seenComponentIds.add(component.componentId);
    if (!verifyCostComponentIntegrity(component)) blockers.push(`COST_COMPONENT_INTEGRITY_FAILED:${component.componentId || 'UNKNOWN'}`);
    if (component.verification?.status !== COST_VERIFICATION_STATUS.VERIFIED) blockers.push(`COST_COMPONENT_NOT_VERIFIED:${component.componentId}`);
    if (!allowedCostSourceClasses.includes(component.sourceClass)) blockers.push(`COST_SOURCE_CLASS_NOT_ALLOWED:${component.componentId}:${component.sourceClass}`);
    const ageDays = Math.floor((Date.parse(valuationDateIso) - Date.parse(component.sourceDate)) / 86400000);
    if (ageDays < 0) blockers.push(`COST_SOURCE_AFTER_VALUATION_DATE:${component.componentId}`);
    else if (ageDays > maxCostSourceAgeDays) blockers.push(`COST_SOURCE_STALE:${component.componentId}`);
  }
  if (blockers.length) return hold(COST_APPROACH_INPUT_STATUS.HOLD_COST_EVIDENCE, blockers, caseId, propertyRef);

  if (landValueInput.caseId !== caseId || landValueInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:landValueInput');
  const landBlockers = [];
  if (!verifyLandValueInputIntegrity(landValueInput)) landBlockers.push('LAND_VALUE_INPUT_INTEGRITY_FAILED');
  if (iso(landValueInput.valuationDate, 'landValueInput.valuationDate') !== valuationDateIso) landBlockers.push('LAND_VALUE_DATE_MISMATCH');
  if (!nonEmpty(landValueInput.reviewedByRef) || !nonEmpty(landValueInput.reviewEvidenceRef)) landBlockers.push('LAND_VALUE_PROFESSIONAL_REVIEW_REQUIRED');
  if (landBlockers.length) return hold(COST_APPROACH_INPUT_STATUS.HOLD_LAND_VALUE_INPUT, landBlockers, caseId, propertyRef);

  const depreciationBlockers = [];
  const seenDepreciationIds = new Set();
  const seenDepreciationTypes = new Set();
  for (const record of depreciationRecords) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:depreciationRecord');
    if (seenDepreciationIds.has(record.depreciationId)) depreciationBlockers.push(`DUPLICATE_DEPRECIATION_ID:${record.depreciationId}`);
    seenDepreciationIds.add(record.depreciationId);
    if (seenDepreciationTypes.has(record.type)) depreciationBlockers.push(`DUPLICATE_DEPRECIATION_TYPE:${record.type}`);
    seenDepreciationTypes.add(record.type);
    if (!verifyDepreciationIntegrity(record)) depreciationBlockers.push(`DEPRECIATION_INTEGRITY_FAILED:${record.depreciationId || 'UNKNOWN'}`);
    if (!nonEmpty(record.reviewedByRef) || !nonEmpty(record.reviewEvidenceRef)) depreciationBlockers.push(`DEPRECIATION_PROFESSIONAL_REVIEW_REQUIRED:${record.depreciationId}`);
  }
  if (depreciationBlockers.length) return hold(COST_APPROACH_INPUT_STATUS.HOLD_DEPRECIATION, depreciationBlockers, caseId, propertyRef);

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId,
    propertyRef,
    valuationDate: valuationDateIso,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    costComponents: costComponents.map((component) => ({
      componentId: component.componentId,
      componentClass: component.componentClass,
      description: component.description,
      quantity: component.quantity,
      unit: component.unit,
      unitCostSar: component.unitCostSar,
      costBasis: component.costBasis,
      sourceClass: component.sourceClass,
      sourceName: component.sourceName,
      sourceRef: component.sourceRef,
      sourceDate: component.sourceDate,
      costComponentHashSha256: component.costComponentHashSha256,
    })),
    landValueInput: {
      landValueId: landValueInput.landValueId,
      valueSar: landValueInput.valueSar,
      methodReference: landValueInput.methodReference,
      methodDetail: landValueInput.methodDetail,
      rationale: landValueInput.rationale,
      evidenceRefs: landValueInput.evidenceRefs,
      landValueInputHashSha256: landValueInput.landValueInputHashSha256,
    },
    depreciationRecords: depreciationRecords.map((record) => ({
      depreciationId: record.depreciationId,
      type: record.type,
      method: record.method,
      magnitude: record.magnitude,
      rationale: record.rationale,
      evidenceRefs: record.evidenceRefs,
      depreciationHashSha256: record.depreciationHashSha256,
    })),
    allowedCostSourceClasses: [...allowedCostSourceClasses],
    maxCostSourceAgeDays,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    packetEvidenceRef: packetEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    costApproachInputPacketHashSha256: sha256(core),
    status: COST_APPROACH_INPUT_STATUS.READY_FOR_CANONICAL_COST_CALCULATION,
    blockers: [],
    readyForCanonicalCostCalculation: true,
    canonicalEngineInputsWritten: false,
    costApproachValueIndicationProduced: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds verified cost evidence, an explicitly reviewed professional land-value input, and explicit depreciation judgments to the property evidence packet. No extended cost, depreciation amount, or value indication is calculated outside the canonical valuation engine.',
  });
}

function verifyCostApproachInputPacketIntegrity(packet) {
  if (!packet || packet.status !== COST_APPROACH_INPUT_STATUS.READY_FOR_CANONICAL_COST_CALCULATION) return false;
  const digest = packet.costApproachInputPacketHashSha256;
  if (!nonEmpty(digest) || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    packetId: packet.packetId,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    valuationDate: packet.valuationDate,
    propertyEvidencePacketHashSha256: packet.propertyEvidencePacketHashSha256,
    costComponents: packet.costComponents,
    landValueInput: packet.landValueInput,
    depreciationRecords: packet.depreciationRecords,
    allowedCostSourceClasses: packet.allowedCostSourceClasses,
    maxCostSourceAgeDays: packet.maxCostSourceAgeDays,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
    packetEvidenceRef: packet.packetEvidenceRef,
  };
  return sha256(core) === digest.toLowerCase();
}

module.exports = {
  COST_BASIS,
  COST_COMPONENT_CLASS,
  COST_SOURCE_CLASS,
  COST_VERIFICATION_STATUS,
  LAND_VALUE_METHOD_REFERENCE,
  DEPRECIATION_TYPE,
  DEPRECIATION_METHOD,
  COST_APPROACH_INPUT_STATUS,
  createCostComponentRecord,
  verifyCostComponentIntegrity,
  createProfessionalLandValueInput,
  verifyLandValueInputIntegrity,
  createDepreciationRecord,
  verifyDepreciationIntegrity,
  buildCostApproachInputPacket,
  verifyCostApproachInputPacketIntegrity,
};
