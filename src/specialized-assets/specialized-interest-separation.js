'use strict';

const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ASSET_PACKET_STATUS,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('./specialized-asset-evidence');
const {
  SPECIALIZED_OPERATING_FORECAST_STATUS,
  verifySpecializedOperatingForecastPacketIntegrity,
} = require('./specialized-operating-forecast');

const SPECIALIZED_VALUE_COMPONENT = Object.freeze({
  REAL_PROPERTY: 'REAL_PROPERTY',
  FF_E: 'FF_E',
  OPERATING_BUSINESS: 'OPERATING_BUSINESS',
  INTANGIBLE_BRAND_OR_FRANCHISE: 'INTANGIBLE_BRAND_OR_FRANCHISE',
  MANAGEMENT_OR_OPERATOR_CONTRACT: 'MANAGEMENT_OR_OPERATOR_CONTRACT',
  OTHER_NON_REAL_PROPERTY: 'OTHER_NON_REAL_PROPERTY',
});

const SPECIALIZED_VALUATION_PREMISE = Object.freeze({
  REAL_PROPERTY_ONLY: 'REAL_PROPERTY_ONLY',
  REAL_PROPERTY_PLUS_FF_E: 'REAL_PROPERTY_PLUS_FF_E',
  ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW: 'ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW',
});

const COMPONENT_TREATMENT = Object.freeze({
  INCLUDED_IN_PREMISE: 'INCLUDED_IN_PREMISE',
  EXCLUDED_FROM_PREMISE: 'EXCLUDED_FROM_PREMISE',
  SEPARATE_REVIEW_REQUIRED: 'SEPARATE_REVIEW_REQUIRED',
});

const COMPONENT_EVIDENCE_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
});

const SPECIALIZED_INTEREST_SEPARATION_STATUS = Object.freeze({
  READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW: 'READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW',
  HOLD_SPECIALIZED_PACKET: 'HOLD_SPECIALIZED_PACKET',
  HOLD_COMPONENT_EVIDENCE: 'HOLD_COMPONENT_EVIDENCE',
  HOLD_PREMISE_CONFLICT: 'HOLD_PREMISE_CONFLICT',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const QUALIFIED_STATUSES = Object.freeze([
  COMPONENT_EVIDENCE_STATUS.VERIFIED,
  COMPONENT_EVIDENCE_STATUS.PROFESSIONAL_REVIEWED,
]);

const HOSPITALITY_CLASSES = Object.freeze([
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_ASSET_CLASS.SERVICED_APARTMENTS,
  SPECIALIZED_ASSET_CLASS.RESORT,
]);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => !nonEmpty(item))) throw new TypeError(`${field} must contain non-empty references`);
  return [...new Set(values.map((item) => item.trim()))].sort();
}

function requiredComponents(assetClass, operatingModel) {
  const required = new Set([SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY]);
  if (HOSPITALITY_CLASSES.includes(assetClass) || assetClass === SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION) {
    required.add(SPECIALIZED_VALUE_COMPONENT.FF_E);
    required.add(SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS);
  }
  if (operatingModel === SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT
      || operatingModel === SPECIALIZED_OPERATING_MODEL.FRANCHISE
      || operatingModel === SPECIALIZED_OPERATING_MODEL.LEASED_OPERATOR) {
    required.add(SPECIALIZED_VALUE_COMPONENT.MANAGEMENT_OR_OPERATOR_CONTRACT);
  }
  if (operatingModel === SPECIALIZED_OPERATING_MODEL.FRANCHISE) required.add(SPECIALIZED_VALUE_COMPONENT.INTANGIBLE_BRAND_OR_FRANCHISE);
  return [...required].sort();
}

function createSpecializedComponentTreatment({
  treatmentId,
  caseId,
  propertyRef,
  component,
  treatment,
  evidenceStatus,
  rationale,
  evidenceRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['treatmentId', treatmentId], ['caseId', caseId], ['propertyRef', propertyRef], ['rationale', rationale],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(component, SPECIALIZED_VALUE_COMPONENT, 'component');
  assertEnum(treatment, COMPONENT_TREATMENT, 'treatment');
  assertEnum(evidenceStatus, COMPONENT_EVIDENCE_STATUS, 'evidenceStatus');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('COMPONENT_TREATMENT_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    treatmentId: treatmentId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    component,
    treatment,
    evidenceStatus,
    rationale: rationale.trim(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    componentTreatmentHashSha256: sha256(core),
    monetaryAllocationPerformed: false,
    valuationArithmeticPerformed: false,
  });
}

function verifySpecializedComponentTreatmentIntegrity(record) {
  if (!record || !validSha(record.componentTreatmentHashSha256)) return false;
  const core = { ...record };
  ['componentTreatmentHashSha256', 'monetaryAllocationPerformed', 'valuationArithmeticPerformed'].forEach((key) => delete core[key]);
  return sha256(core) === record.componentTreatmentHashSha256.toLowerCase();
}

function premiseConflict(premise, treatmentMap) {
  const conflicts = [];
  const treatmentOf = (component) => treatmentMap.get(component)?.treatment || null;
  if (treatmentOf(SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY) !== COMPONENT_TREATMENT.INCLUDED_IN_PREMISE) {
    conflicts.push('REAL_PROPERTY_MUST_BE_INCLUDED_IN_SPECIALIZED_PREMISE');
  }
  if (premise === SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY) {
    for (const component of Object.values(SPECIALIZED_VALUE_COMPONENT)) {
      if (component !== SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY && treatmentOf(component) === COMPONENT_TREATMENT.INCLUDED_IN_PREMISE) {
        conflicts.push(`NON_REAL_PROPERTY_COMPONENT_CANNOT_BE_INCLUDED_IN_REAL_PROPERTY_ONLY:${component}`);
      }
    }
  }
  if (premise === SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E) {
    if (treatmentOf(SPECIALIZED_VALUE_COMPONENT.FF_E) !== COMPONENT_TREATMENT.INCLUDED_IN_PREMISE) conflicts.push('FF_E_MUST_BE_INCLUDED_IN_REAL_PROPERTY_PLUS_FF_E');
    for (const component of [
      SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS,
      SPECIALIZED_VALUE_COMPONENT.INTANGIBLE_BRAND_OR_FRANCHISE,
      SPECIALIZED_VALUE_COMPONENT.MANAGEMENT_OR_OPERATOR_CONTRACT,
      SPECIALIZED_VALUE_COMPONENT.OTHER_NON_REAL_PROPERTY,
    ]) {
      if (treatmentOf(component) === COMPONENT_TREATMENT.INCLUDED_IN_PREMISE) conflicts.push(`BUSINESS_OR_INTANGIBLE_COMPONENT_CANNOT_BE_INCLUDED_WITHOUT_SEPARATE_REVIEW:${component}`);
    }
  }
  return conflicts;
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    separationPacketId: context.separationPacketId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForSpecializedValuationPremiseReview: false,
    monetaryAllocationPerformed: false,
    businessEnterpriseValueCalculated: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildSpecializedInterestSeparationPacket({
  separationPacketId,
  caseId,
  propertyRef,
  specializedAssetPacket,
  operatingForecastPacket = null,
  valuationPremise,
  componentTreatments,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['separationPacketId', separationPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(valuationPremise, SPECIALIZED_VALUATION_PREMISE, 'valuationPremise');
  if (!Array.isArray(componentTreatments) || componentTreatments.length === 0) throw new TypeError('componentTreatments must be a non-empty array');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('SPECIALIZED_SEPARATION_REVIEW_BEFORE_PREPARATION');
  const context = { separationPacketId: separationPacketId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };

  if (!specializedAssetPacket || specializedAssetPacket.caseId !== caseId || specializedAssetPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedAssetPacket');
  }
  if (specializedAssetPacket.status !== SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW
      || specializedAssetPacket.readyForSpecializedAssetProfessionalWorkflow !== true
      || !verifySpecializedAssetEvidencePacketIntegrity(specializedAssetPacket)) {
    return hold(SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_SPECIALIZED_PACKET, ['SPECIALIZED_ASSET_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  let operatingForecastHashSha256 = null;
  if (operatingForecastPacket !== null) {
    if (!operatingForecastPacket || operatingForecastPacket.caseId !== caseId || operatingForecastPacket.propertyRef !== propertyRef) {
      throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:operatingForecastPacket');
    }
    if (operatingForecastPacket.status !== SPECIALIZED_OPERATING_FORECAST_STATUS.READY
        || !verifySpecializedOperatingForecastPacketIntegrity(operatingForecastPacket)) {
      return hold(SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_INTEGRITY, ['OPERATING_FORECAST_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
    }
    operatingForecastHashSha256 = operatingForecastPacket.specializedOperatingForecastHashSha256;
  }

  const blockers = [];
  const ids = new Set();
  const treatmentMap = new Map();
  for (const record of componentTreatments) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:componentTreatment');
    if (!verifySpecializedComponentTreatmentIntegrity(record)) return hold(SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_INTEGRITY, [`COMPONENT_TREATMENT_INTEGRITY_FAILED:${record?.treatmentId || 'UNKNOWN'}`], context);
    if (ids.has(record.treatmentId)) blockers.push(`DUPLICATE_COMPONENT_TREATMENT_ID:${record.treatmentId}`);
    if (treatmentMap.has(record.component)) blockers.push(`DUPLICATE_COMPONENT_CLASSIFICATION:${record.component}`);
    if (Date.parse(record.reviewedAt) > Date.parse(reviewed)) blockers.push(`COMPONENT_TREATMENT_REVIEW_AFTER_PACKET_REVIEW:${record.treatmentId}`);
    ids.add(record.treatmentId);
    treatmentMap.set(record.component, record);
  }

  for (const component of requiredComponents(specializedAssetPacket.assetClass, specializedAssetPacket.operatingModel)) {
    const record = treatmentMap.get(component);
    if (!record) blockers.push(`REQUIRED_VALUE_COMPONENT_MISSING:${component}`);
    else if (!QUALIFIED_STATUSES.includes(record.evidenceStatus)) blockers.push(`REQUIRED_VALUE_COMPONENT_NOT_VERIFIED:${component}:${record.evidenceStatus}`);
  }
  if (blockers.length) return hold(SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_COMPONENT_EVIDENCE, blockers, context);

  const premiseBlockers = premiseConflict(valuationPremise, treatmentMap);
  if (premiseBlockers.length) return hold(SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_PREMISE_CONFLICT, premiseBlockers, context);

  const sortedTreatments = componentTreatments.slice().sort((a, b) => a.component.localeCompare(b.component));
  const separateReviewComponents = sortedTreatments.filter((record) => record.treatment === COMPONENT_TREATMENT.SEPARATE_REVIEW_REQUIRED).map((record) => record.component);
  const core = {
    schemaVersion: 1,
    separationPacketId: separationPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: specializedAssetPacket.valuationDate,
    assetClass: specializedAssetPacket.assetClass,
    operatingModel: specializedAssetPacket.operatingModel,
    specializedAssetEvidenceHashSha256: specializedAssetPacket.specializedAssetEvidenceHashSha256,
    operatingForecastHashSha256,
    valuationPremise,
    requiredComponents: requiredComponents(specializedAssetPacket.assetClass, specializedAssetPacket.operatingModel),
    componentTreatments: sortedTreatments,
    separateReviewComponents,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    specializedInterestSeparationHashSha256: sha256(core),
    status: SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW,
    blockers: [],
    readyForSpecializedValuationPremiseReview: true,
    professionalAllocationRequired: separateReviewComponents.length > 0 || valuationPremise === SPECIALIZED_VALUATION_PREMISE.ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW,
    monetaryAllocationPerformed: false,
    businessEnterpriseValueCalculated: false,
    intangibleValueCalculated: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet separates real property, FF&E, operating business, intangible/brand and operator-contract components for professional premise review. It does not assign monetary allocations, calculate business enterprise or intangible value, write valuation inputs, establish a final/certified value, or authorize a transaction.',
  });
}

function verifySpecializedInterestSeparationPacketIntegrity(packet) {
  if (!packet || !validSha(packet.specializedInterestSeparationHashSha256)) return false;
  const core = { ...packet };
  [
    'specializedInterestSeparationHashSha256', 'status', 'blockers', 'readyForSpecializedValuationPremiseReview',
    'professionalAllocationRequired', 'monetaryAllocationPerformed', 'businessEnterpriseValueCalculated',
    'intangibleValueCalculated', 'valuationInputsWritten', 'valuationArithmeticPerformed',
    'finalValuationConclusionEstablished', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  if (!Array.isArray(core.componentTreatments) || core.componentTreatments.some((record) => !verifySpecializedComponentTreatmentIntegrity(record))) return false;
  return sha256(core) === packet.specializedInterestSeparationHashSha256.toLowerCase();
}

module.exports = {
  SPECIALIZED_VALUE_COMPONENT,
  SPECIALIZED_VALUATION_PREMISE,
  COMPONENT_TREATMENT,
  COMPONENT_EVIDENCE_STATUS,
  SPECIALIZED_INTEREST_SEPARATION_STATUS,
  requiredComponents,
  createSpecializedComponentTreatment,
  verifySpecializedComponentTreatmentIntegrity,
  premiseConflict,
  buildSpecializedInterestSeparationPacket,
  verifySpecializedInterestSeparationPacketIntegrity,
};
