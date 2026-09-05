'use strict';

const SOURCE_CLASS = Object.freeze({
  OFFICIAL_PRIMARY: 'OFFICIAL_PRIMARY',
  CONTRACTUAL_PRIMARY: 'CONTRACTUAL_PRIMARY',
  PROFESSIONAL_PRIMARY: 'PROFESSIONAL_PRIMARY',
  OWNER_SUPPLIED: 'OWNER_SUPPLIED',
  MARKET_OBSERVED: 'MARKET_OBSERVED',
  SYSTEM_CALCULATED: 'SYSTEM_CALCULATED',
  AI_INTERPRETATION: 'AI_INTERPRETATION',
});

const SOURCE_VERIFICATION_STATUS = Object.freeze({
  NOT_VERIFIED: 'NOT_VERIFIED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

const DATA_QUALITY_STATUS = Object.freeze({
  UNASSESSED: 'UNASSESSED',
  QUALIFIED: 'QUALIFIED',
  HOLD_MISSING: 'HOLD_MISSING',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
  HOLD_UNIT_MISMATCH: 'HOLD_UNIT_MISMATCH',
  HOLD_STALE: 'HOLD_STALE',
  HOLD_SCOPE: 'HOLD_SCOPE',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requireEnum(value, enumObject, field) {
  if (!Object.values(enumObject).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(enumObject).join(', ')}`);
  }
  return value;
}

function normalizeIsoTimestamp(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  requireString(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function normalizeSha256(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function normalizeRefs(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  const normalized = value.map((item) => requireString(String(item), field));
  return Object.freeze([...new Set(normalized)]);
}

function createCanonicalSourceMetadata({
  metadataId,
  caseId,
  projectId,
  semanticKey,
  sourceClass,
  sourceSystem,
  sourceObjectId,
  sourceVersion,
  sourceRef,
  evidenceRefs = [],
  observedAt,
  effectiveDate = null,
  contentHashSha256 = null,
  verificationStatus = SOURCE_VERIFICATION_STATUS.NOT_VERIFIED,
  dataQualityStatus = DATA_QUALITY_STATUS.UNASSESSED,
  authorityScope,
  derivationRef = null,
  createdAt,
  createdBy,
} = {}) {
  const normalizedSourceClass = requireEnum(sourceClass, SOURCE_CLASS, 'sourceClass');
  const normalizedVerificationStatus = requireEnum(verificationStatus, SOURCE_VERIFICATION_STATUS, 'verificationStatus');
  const normalizedDataQualityStatus = requireEnum(dataQualityStatus, DATA_QUALITY_STATUS, 'dataQualityStatus');

  if (normalizedSourceClass === SOURCE_CLASS.AI_INTERPRETATION && normalizedVerificationStatus === SOURCE_VERIFICATION_STATUS.VERIFIED) {
    const error = new Error('AI interpretation cannot be promoted to a verified authoritative fact');
    error.code = 'AI_SOURCE_CANNOT_BE_VERIFIED_AUTHORITY';
    throw error;
  }

  if (normalizedSourceClass === SOURCE_CLASS.SYSTEM_CALCULATED && !derivationRef) {
    const error = new Error('SYSTEM_CALCULATED sources require derivationRef');
    error.code = 'DERIVATION_REFERENCE_REQUIRED';
    throw error;
  }

  if (normalizedVerificationStatus === SOURCE_VERIFICATION_STATUS.VERIFIED && normalizedDataQualityStatus !== DATA_QUALITY_STATUS.QUALIFIED) {
    const error = new Error('VERIFIED sources must also be QUALIFIED for data quality');
    error.code = 'VERIFIED_SOURCE_MUST_BE_QUALIFIED';
    throw error;
  }

  return deepFreeze({
    schemaVersion: 1,
    metadataId: requireString(metadataId, 'metadataId'),
    caseId: requireString(caseId, 'caseId'),
    projectId: requireString(projectId, 'projectId'),
    semanticKey: requireString(semanticKey, 'semanticKey'),
    sourceClass: normalizedSourceClass,
    sourceSystem: requireString(sourceSystem, 'sourceSystem'),
    sourceObjectId: requireString(sourceObjectId, 'sourceObjectId'),
    sourceVersion: requireString(sourceVersion, 'sourceVersion'),
    sourceRef: requireString(sourceRef, 'sourceRef'),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    observedAt: normalizeIsoTimestamp(observedAt, 'observedAt'),
    effectiveDate: normalizeIsoTimestamp(effectiveDate, 'effectiveDate', { optional: true }),
    contentHashSha256: normalizeSha256(contentHashSha256, 'contentHashSha256', { optional: true }),
    verificationStatus: normalizedVerificationStatus,
    dataQualityStatus: normalizedDataQualityStatus,
    authorityScope: requireString(authorityScope, 'authorityScope'),
    derivationRef: derivationRef == null ? null : requireString(derivationRef, 'derivationRef'),
    createdAt: normalizeIsoTimestamp(createdAt, 'createdAt'),
    createdBy: requireString(createdBy, 'createdBy'),
    authoritativeForDecision: normalizedVerificationStatus === SOURCE_VERIFICATION_STATUS.VERIFIED
      && normalizedDataQualityStatus === DATA_QUALITY_STATUS.QUALIFIED
      && normalizedSourceClass !== SOURCE_CLASS.AI_INTERPRETATION,
    transactionAuthorized: false,
    semantics: 'Canonical source metadata records provenance and source authority class for one semantic field in one case/project scope. Storage location alone never establishes authority. AI interpretation is never an authoritative fact.',
  });
}

module.exports = {
  SOURCE_CLASS,
  SOURCE_VERIFICATION_STATUS,
  DATA_QUALITY_STATUS,
  createCanonicalSourceMetadata,
};