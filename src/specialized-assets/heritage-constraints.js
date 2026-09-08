'use strict';

const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_ASSET_PACKET_STATUS,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('./specialized-asset-evidence');

const HERITAGE_CONSTRAINT_TYPE = Object.freeze({
  DESIGNATION_OR_RESTRICTION: 'DESIGNATION_OR_RESTRICTION',
  PROTECTED_ELEMENT: 'PROTECTED_ELEMENT',
  CONSERVATION_REQUIREMENT: 'CONSERVATION_REQUIREMENT',
  ADAPTIVE_REUSE_REQUIREMENT: 'ADAPTIVE_REUSE_REQUIREMENT',
  PERMITTED_USE_CONSTRAINT: 'PERMITTED_USE_CONSTRAINT',
  PROHIBITED_WORK: 'PROHIBITED_WORK',
  APPROVAL_OR_CONSENT: 'APPROVAL_OR_CONSENT',
  ACCESSIBILITY_FIRE_LIFE_SAFETY_INTERFACE: 'ACCESSIBILITY_FIRE_LIFE_SAFETY_INTERFACE',
});

const HERITAGE_CONSTRAINT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
});

const HERITAGE_IMPACT_DOMAIN = Object.freeze({
  USE: 'USE',
  PHYSICAL_INTERVENTION: 'PHYSICAL_INTERVENTION',
  COST: 'COST',
  TIMING: 'TIMING',
  OPERATIONS: 'OPERATIONS',
  INSPECTION: 'INSPECTION',
});

const HERITAGE_CONSTRAINT_PACKET_STATUS = Object.freeze({
  READY_FOR_HERITAGE_PROFESSIONAL_REVIEW: 'READY_FOR_HERITAGE_PROFESSIONAL_REVIEW',
  NOT_APPLICABLE_ASSET_CLASS: 'NOT_APPLICABLE_ASSET_CLASS',
  HOLD_SPECIALIZED_PACKET: 'HOLD_SPECIALIZED_PACKET',
  HOLD_CONSTRAINT_EVIDENCE: 'HOLD_CONSTRAINT_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const QUALIFIED_STATUSES = Object.freeze([
  HERITAGE_CONSTRAINT_STATUS.VERIFIED,
  HERITAGE_CONSTRAINT_STATUS.PROFESSIONAL_REVIEWED,
]);

const BASE_REQUIRED_TYPES = Object.freeze([
  HERITAGE_CONSTRAINT_TYPE.DESIGNATION_OR_RESTRICTION,
  HERITAGE_CONSTRAINT_TYPE.CONSERVATION_REQUIREMENT,
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
function optionalIso(value, field) { return value === null || value === undefined ? null : iso(value, field); }
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
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => !nonEmpty(item))) throw new TypeError(`${field} must contain at least one non-empty reference`);
  return [...new Set(values.map((item) => item.trim()))].sort();
}
function normalizeImpactDomains(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('impactDomains must be a non-empty array');
  const normalized = [...new Set(values)];
  normalized.forEach((value) => assertEnum(value, HERITAGE_IMPACT_DOMAIN, 'impactDomain'));
  return normalized.sort();
}

function createHeritageConstraintRecord({
  constraintId,
  caseId,
  propertyRef,
  type,
  status,
  statement,
  impactDomains,
  sourceRef,
  evidenceRefs,
  asOfDate,
  validFrom,
  validTo = null,
  rationale,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['constraintId', constraintId], ['caseId', caseId], ['propertyRef', propertyRef], ['statement', statement],
    ['sourceRef', sourceRef], ['rationale', rationale], ['preparedByRef', preparedByRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(type, HERITAGE_CONSTRAINT_TYPE, 'type');
  assertEnum(status, HERITAGE_CONSTRAINT_STATUS, 'status');
  const asOf = iso(asOfDate, 'asOfDate');
  const from = iso(validFrom, 'validFrom');
  const to = optionalIso(validTo, 'validTo');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (to && Date.parse(to) < Date.parse(from)) throw new TypeError('HERITAGE_CONSTRAINT_VALID_TO_BEFORE_VALID_FROM');
  if (Date.parse(prepared) < Date.parse(asOf)) throw new TypeError('HERITAGE_CONSTRAINT_PREPARED_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('HERITAGE_CONSTRAINT_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    constraintId: constraintId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    status,
    statement: statement.trim(),
    impactDomains: normalizeImpactDomains(impactDomains),
    sourceRef: sourceRef.trim(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    asOfDate: asOf,
    validFrom: from,
    validTo: to,
    rationale: rationale.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    heritageConstraintHashSha256: sha256(core),
    legalInterpretationPerformed: false,
    authorityApprovalEstablished: false,
    automaticValuationInputAdoption: false,
  });
}

function verifyHeritageConstraintRecordIntegrity(record) {
  if (!record || !validSha(record.heritageConstraintHashSha256)) return false;
  const core = { ...record };
  ['heritageConstraintHashSha256', 'legalInterpretationPerformed', 'authorityApprovalEstablished', 'automaticValuationInputAdoption'].forEach((key) => delete core[key]);
  return sha256(core) === record.heritageConstraintHashSha256.toLowerCase();
}

function isEffectiveAt(record, valuationDate) {
  const date = Date.parse(valuationDate);
  return Date.parse(record.validFrom) <= date && (record.validTo === null || Date.parse(record.validTo) >= date);
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    heritagePacketId: context.heritagePacketId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    warnings: [],
    readyForHeritageProfessionalReview: false,
    legalInterpretationPerformed: false,
    authorityApprovalEstablished: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildHeritageConstraintPacket({
  heritagePacketId,
  caseId,
  propertyRef,
  specializedAssetEvidencePacket,
  constraints,
  adaptiveReuseProposed = false,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['heritagePacketId', heritagePacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (typeof adaptiveReuseProposed !== 'boolean') throw new TypeError('adaptiveReuseProposed must be boolean');
  if (!Array.isArray(constraints)) throw new TypeError('constraints must be an array');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('HERITAGE_PACKET_REVIEW_BEFORE_PREPARATION');
  const context = { heritagePacketId: heritagePacketId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };

  if (!specializedAssetEvidencePacket || specializedAssetEvidencePacket.caseId !== caseId || specializedAssetEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedAssetEvidencePacket');
  }
  if (specializedAssetEvidencePacket.assetClass !== SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET) {
    return hold(HERITAGE_CONSTRAINT_PACKET_STATUS.NOT_APPLICABLE_ASSET_CLASS, ['HERITAGE_ASSET_CLASS_REQUIRED'], context);
  }
  if (specializedAssetEvidencePacket.status !== SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW
      || specializedAssetEvidencePacket.readyForSpecializedAssetProfessionalWorkflow !== true
      || !verifySpecializedAssetEvidencePacketIntegrity(specializedAssetEvidencePacket)) {
    return hold(HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_SPECIALIZED_PACKET, ['SPECIALIZED_ASSET_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  const blockers = [];
  const warnings = [];
  const ids = new Set();
  const validRecords = [];
  for (const record of constraints) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:heritageConstraint');
    if (!verifyHeritageConstraintRecordIntegrity(record)) {
      return hold(HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_INTEGRITY, [`HERITAGE_CONSTRAINT_INTEGRITY_FAILED:${record?.constraintId || 'UNKNOWN'}`], context);
    }
    if (ids.has(record.constraintId)) blockers.push(`DUPLICATE_HERITAGE_CONSTRAINT_ID:${record.constraintId}`);
    ids.add(record.constraintId);
    if (Date.parse(record.reviewedAt) > Date.parse(reviewed)) blockers.push(`HERITAGE_CONSTRAINT_REVIEW_AFTER_PACKET_REVIEW:${record.constraintId}`);
    validRecords.push(record);
  }

  const effective = validRecords.filter((record) => isEffectiveAt(record, specializedAssetEvidencePacket.valuationDate));
  const future = validRecords.filter((record) => Date.parse(record.validFrom) > Date.parse(specializedAssetEvidencePacket.valuationDate));
  const expired = validRecords.filter((record) => record.validTo !== null && Date.parse(record.validTo) < Date.parse(specializedAssetEvidencePacket.valuationDate));
  if (future.length) warnings.push(...future.map((record) => `FUTURE_HERITAGE_CONSTRAINT_NOT_APPLIED:${record.constraintId}`));
  if (expired.length) warnings.push(...expired.map((record) => `EXPIRED_HERITAGE_CONSTRAINT_NOT_APPLIED:${record.constraintId}`));

  const requiredTypes = new Set(BASE_REQUIRED_TYPES);
  if (adaptiveReuseProposed) {
    requiredTypes.add(HERITAGE_CONSTRAINT_TYPE.ADAPTIVE_REUSE_REQUIREMENT);
    requiredTypes.add(HERITAGE_CONSTRAINT_TYPE.APPROVAL_OR_CONSENT);
  }
  for (const type of requiredTypes) {
    const candidates = effective.filter((record) => record.type === type);
    if (candidates.length === 0) blockers.push(`REQUIRED_EFFECTIVE_HERITAGE_CONSTRAINT_MISSING:${type}`);
    else if (!candidates.some((record) => QUALIFIED_STATUSES.includes(record.status))) blockers.push(`REQUIRED_HERITAGE_CONSTRAINT_NOT_VERIFIED:${type}`);
  }

  if (blockers.length) return deepFreeze({ ...hold(HERITAGE_CONSTRAINT_PACKET_STATUS.HOLD_CONSTRAINT_EVIDENCE, blockers, context), warnings });

  const impactSummary = Object.values(HERITAGE_IMPACT_DOMAIN).reduce((out, domain) => {
    out[domain] = effective.filter((record) => record.impactDomains.includes(domain)).map((record) => record.constraintId);
    return out;
  }, {});
  const core = {
    schemaVersion: 1,
    heritagePacketId: heritagePacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: specializedAssetEvidencePacket.valuationDate,
    specializedAssetEvidenceHashSha256: specializedAssetEvidencePacket.specializedAssetEvidenceHashSha256,
    adaptiveReuseProposed,
    constraints: validRecords,
    effectiveConstraintIds: effective.map((record) => record.constraintId).sort(),
    futureConstraintIds: future.map((record) => record.constraintId).sort(),
    expiredConstraintIds: expired.map((record) => record.constraintId).sort(),
    impactSummary,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    heritageConstraintPacketHashSha256: sha256(core),
    status: HERITAGE_CONSTRAINT_PACKET_STATUS.READY_FOR_HERITAGE_PROFESSIONAL_REVIEW,
    blockers: [],
    warnings,
    readyForHeritageProfessionalReview: true,
    professionalConstraintRegisterOnly: true,
    legalInterpretationPerformed: false,
    authorityApprovalEstablished: false,
    planningPermissionEstablished: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    adaptiveReuseFinancialFeasibilityPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet records evidence-backed heritage constraints effective at the valuation date and separates current, future and expired constraints. It does not establish legal validity, heritage-authority approval, planning permission, financial feasibility, valuation inputs, certified value or transaction authority.',
  });
}

function verifyHeritageConstraintPacketIntegrity(packet) {
  if (!packet || !validSha(packet.heritageConstraintPacketHashSha256)) return false;
  const core = { ...packet };
  [
    'heritageConstraintPacketHashSha256', 'status', 'blockers', 'warnings', 'readyForHeritageProfessionalReview',
    'professionalConstraintRegisterOnly', 'legalInterpretationPerformed', 'authorityApprovalEstablished',
    'planningPermissionEstablished', 'valuationInputsWritten', 'valuationArithmeticPerformed',
    'adaptiveReuseFinancialFeasibilityPerformed', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.heritageConstraintPacketHashSha256.toLowerCase();
}

module.exports = {
  HERITAGE_CONSTRAINT_TYPE,
  HERITAGE_CONSTRAINT_STATUS,
  HERITAGE_IMPACT_DOMAIN,
  HERITAGE_CONSTRAINT_PACKET_STATUS,
  createHeritageConstraintRecord,
  verifyHeritageConstraintRecordIntegrity,
  isEffectiveAt,
  buildHeritageConstraintPacket,
  verifyHeritageConstraintPacketIntegrity,
};
