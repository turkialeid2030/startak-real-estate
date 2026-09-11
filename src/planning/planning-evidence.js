'use strict';

const crypto = require('crypto');

const PLANNING_CONSTRAINT_TYPE = Object.freeze({
  ZONING_CLASSIFICATION: 'ZONING_CLASSIFICATION',
  PERMITTED_USE: 'PERMITTED_USE',
  FAR: 'FAR',
  BCR: 'BCR',
  HEIGHT_LIMIT: 'HEIGHT_LIMIT',
  SETBACK: 'SETBACK',
  PARKING_REQUIREMENT: 'PARKING_REQUIREMENT',
  PERMIT_STATUS: 'PERMIT_STATUS',
  DEVELOPMENT_RESTRICTION: 'DEVELOPMENT_RESTRICTION',
  DEVELOPMENT_CONDITION: 'DEVELOPMENT_CONDITION',
});

const PLANNING_AUTHORITY_CLASS = Object.freeze({
  OFFICIAL_AUTHORITY: 'OFFICIAL_AUTHORITY',
  VERIFIED_PROFESSIONAL: 'VERIFIED_PROFESSIONAL',
  CLIENT_PROVIDED: 'CLIENT_PROVIDED',
  ASSUMED: 'ASSUMED',
});

const PLANNING_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
});

const PLANNING_CARDINALITY = Object.freeze({
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
});

const PLANNING_EVIDENCE_STATUS = Object.freeze({
  READY_FOR_HBU_LEGAL_REVIEW: 'READY_FOR_HBU_LEGAL_REVIEW',
  HOLD_MISSING_EVIDENCE: 'HOLD_MISSING_EVIDENCE',
  HOLD_TEMPORAL_VALIDITY: 'HOLD_TEMPORAL_VALIDITY',
  HOLD_AUTHORITY_OR_VERIFICATION: 'HOLD_AUTHORITY_OR_VERIFICATION',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
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

function valuesEqual(a, b) {
  return JSON.stringify(stableClone(a)) === JSON.stringify(stableClone(b));
}

function verifyPlanningEvidenceIntegrity(record) {
  if (!record || typeof record !== 'object' || !/^[a-f0-9]{64}$/i.test(String(record.planningEvidenceHashSha256 || ''))) return false;
  const { planningEvidenceHashSha256, ...payload } = record;
  return sha256(payload) === record.planningEvidenceHashSha256.toLowerCase();
}

function createPlanningEvidenceRecord({
  evidenceId,
  caseId,
  propertyRef,
  constraintType,
  value,
  unit = null,
  authorityClass,
  sourceAuthority,
  sourceRef,
  sourceUrl = null,
  sourceEffectiveDate,
  validFrom,
  validTo = null,
  verification,
  capturedAt,
} = {}) {
  for (const [field, item] of [
    ['evidenceId', evidenceId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['sourceAuthority', sourceAuthority], ['sourceRef', sourceRef],
  ]) assertNonEmpty(item, field);
  assertEnum(constraintType, PLANNING_CONSTRAINT_TYPE, 'constraintType');
  assertEnum(authorityClass, PLANNING_AUTHORITY_CLASS, 'authorityClass');
  if (value === null || value === undefined) throw new TypeError('value is required');
  if (unit !== null && unit !== undefined && !nonEmpty(unit)) throw new TypeError('unit must be null or non-empty');
  if (sourceUrl !== null && sourceUrl !== undefined && !nonEmpty(sourceUrl)) throw new TypeError('sourceUrl must be null or non-empty');
  if (!verification || typeof verification !== 'object') throw new TypeError('verification is required');
  assertEnum(verification.status, PLANNING_VERIFICATION_STATUS, 'verification.status');

  const sourceEffectiveDateIso = iso(sourceEffectiveDate, 'sourceEffectiveDate');
  const validFromIso = iso(validFrom, 'validFrom');
  const validToIso = validTo === null || validTo === undefined ? null : iso(validTo, 'validTo');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  if (Date.parse(sourceEffectiveDateIso) > Date.parse(validFromIso)) throw new TypeError('SOURCE_EFFECTIVE_DATE_AFTER_VALID_FROM');
  if (validToIso && Date.parse(validToIso) < Date.parse(validFromIso)) throw new TypeError('PLANNING_VALID_TO_BEFORE_VALID_FROM');

  let normalizedVerification;
  if (verification.status === PLANNING_VERIFICATION_STATUS.VERIFIED) {
    assertNonEmpty(verification.verifiedByRef, 'verification.verifiedByRef');
    assertNonEmpty(verification.verificationEvidenceRef, 'verification.verificationEvidenceRef');
    const verifiedAtIso = iso(verification.verifiedAt, 'verification.verifiedAt');
    if (Date.parse(verifiedAtIso) < Date.parse(capturedAtIso)) throw new TypeError('PLANNING_VERIFICATION_BEFORE_CAPTURE');
    normalizedVerification = {
      status: verification.status,
      verifiedByRef: verification.verifiedByRef.trim(),
      verifiedAt: verifiedAtIso,
      verificationEvidenceRef: verification.verificationEvidenceRef.trim(),
    };
  } else {
    normalizedVerification = {
      status: verification.status,
      verifiedByRef: null,
      verifiedAt: null,
      verificationEvidenceRef: null,
    };
  }

  const record = {
    schemaVersion: 1,
    evidenceId: evidenceId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    constraintType,
    value: stableClone(value),
    unit: unit ? unit.trim() : null,
    authorityClass,
    sourceAuthority: sourceAuthority.trim(),
    sourceRef: sourceRef.trim(),
    sourceUrl: sourceUrl ? sourceUrl.trim() : null,
    sourceEffectiveDate: sourceEffectiveDateIso,
    validFrom: validFromIso,
    validTo: validToIso,
    verification: normalizedVerification,
    capturedAt: capturedAtIso,
    legalOpinionEstablished: false,
    planningComplianceEstablished: false,
    transactionAuthorized: false,
  };
  record.planningEvidenceHashSha256 = sha256(record);
  return deepFreeze(record);
}

function isTemporallyValid(record, valuationDateIso) {
  const valueMs = Date.parse(valuationDateIso);
  return Date.parse(record.sourceEffectiveDate) <= valueMs
    && Date.parse(record.validFrom) <= valueMs
    && (!record.validTo || valueMs <= Date.parse(record.validTo));
}

function assessPlanningEvidenceSet({
  caseId,
  propertyRef,
  valuationDate,
  records,
  requiredConstraintTypes,
  allowedAuthorityClasses,
  cardinalityByType,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Array.isArray(requiredConstraintTypes) || requiredConstraintTypes.length === 0) throw new TypeError('requiredConstraintTypes must be a non-empty array');
  if (!Array.isArray(allowedAuthorityClasses) || allowedAuthorityClasses.length === 0) throw new TypeError('allowedAuthorityClasses must be a non-empty array');
  if (!cardinalityByType || typeof cardinalityByType !== 'object' || Array.isArray(cardinalityByType)) throw new TypeError('cardinalityByType must be an object');

  const required = [...new Set(requiredConstraintTypes)];
  required.forEach((type) => assertEnum(type, PLANNING_CONSTRAINT_TYPE, 'requiredConstraintType'));
  allowedAuthorityClasses.forEach((value) => assertEnum(value, PLANNING_AUTHORITY_CLASS, 'allowedAuthorityClass'));
  required.forEach((type) => assertEnum(cardinalityByType[type], PLANNING_CARDINALITY, `cardinalityByType.${type}`));

  const duplicateEvidenceIds = new Set();
  const seenIds = new Set();
  const integrityFailures = [];
  for (const record of records) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:planningEvidence');
    if (seenIds.has(record.evidenceId)) duplicateEvidenceIds.add(record.evidenceId);
    seenIds.add(record.evidenceId);
    if (!verifyPlanningEvidenceIntegrity(record)) integrityFailures.push(record.evidenceId || 'UNKNOWN');
  }
  if (duplicateEvidenceIds.size || integrityFailures.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId,
      propertyRef,
      valuationDate: valuationDateIso,
      status: PLANNING_EVIDENCE_STATUS.HOLD_CONFLICT,
      blockers: [
        ...[...duplicateEvidenceIds].map((id) => `DUPLICATE_PLANNING_EVIDENCE_ID:${id}`),
        ...integrityFailures.map((id) => `PLANNING_EVIDENCE_INTEGRITY_FAILED:${id}`),
      ],
      trace: [],
      readyForHbuLegalReview: false,
      legalPermissibilityConclusionEstablished: false,
      legalOpinionEstablished: false,
      transactionAuthorized: false,
    });
  }

  const blockers = [];
  const temporalBlockers = [];
  const authorityBlockers = [];
  const conflicts = [];
  const trace = [];

  for (const type of required) {
    const candidates = records.filter((record) => record.constraintType === type);
    if (candidates.length === 0) {
      blockers.push(`MISSING_REQUIRED_PLANNING_EVIDENCE:${type}`);
      trace.push({ type, candidateCount: 0, eligibleCount: 0, values: [] });
      continue;
    }
    const temporallyValid = candidates.filter((record) => isTemporallyValid(record, valuationDateIso));
    if (temporallyValid.length === 0) temporalBlockers.push(`NO_TEMPORALLY_VALID_PLANNING_EVIDENCE:${type}`);
    const eligible = temporallyValid.filter((record) => record.verification.status === PLANNING_VERIFICATION_STATUS.VERIFIED
      && allowedAuthorityClasses.includes(record.authorityClass));
    if (eligible.length === 0 && temporallyValid.length > 0) authorityBlockers.push(`NO_VERIFIED_ALLOWED_AUTHORITY_EVIDENCE:${type}`);

    if (cardinalityByType[type] === PLANNING_CARDINALITY.SINGLE && eligible.length > 1) {
      const reference = eligible[0].value;
      if (eligible.slice(1).some((record) => !valuesEqual(reference, record.value))) conflicts.push(`CONFLICTING_SINGLE_VALUE_PLANNING_EVIDENCE:${type}`);
    }

    trace.push({
      type,
      candidateCount: candidates.length,
      temporallyValidCount: temporallyValid.length,
      eligibleCount: eligible.length,
      values: eligible.map((record) => ({
        evidenceId: record.evidenceId,
        value: record.value,
        unit: record.unit,
        authorityClass: record.authorityClass,
        sourceAuthority: record.sourceAuthority,
        sourceRef: record.sourceRef,
        sourceEffectiveDate: record.sourceEffectiveDate,
        validFrom: record.validFrom,
        validTo: record.validTo,
        planningEvidenceHashSha256: record.planningEvidenceHashSha256,
      })),
    });
  }

  let status = PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW;
  if (conflicts.length) status = PLANNING_EVIDENCE_STATUS.HOLD_CONFLICT;
  else if (blockers.length) status = PLANNING_EVIDENCE_STATUS.HOLD_MISSING_EVIDENCE;
  else if (temporalBlockers.length) status = PLANNING_EVIDENCE_STATUS.HOLD_TEMPORAL_VALIDITY;
  else if (authorityBlockers.length) status = PLANNING_EVIDENCE_STATUS.HOLD_AUTHORITY_OR_VERIFICATION;

  const result = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    valuationDate: valuationDateIso,
    status,
    blockers: [...conflicts, ...blockers, ...temporalBlockers, ...authorityBlockers],
    requiredConstraintTypes: required,
    allowedAuthorityClasses: [...allowedAuthorityClasses],
    cardinalityByType: Object.fromEntries(required.map((type) => [type, cardinalityByType[type]])),
    trace,
    readyForHbuLegalReview: status === PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW,
    legalPermissibilityConclusionEstablished: false,
    legalOpinionEstablished: false,
    planningComplianceEstablished: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_HBU_LEGAL_REVIEW means the configured planning-evidence coverage, temporal-validity, authority/verification and cardinality checks passed for the valuation date. It is not a legal opinion, permit confirmation, planning-compliance conclusion, or automatic Highest & Best Use conclusion.',
  };
  result.planningEvidenceSetHashSha256 = sha256(result);
  return deepFreeze(result);
}

module.exports = {
  PLANNING_CONSTRAINT_TYPE,
  PLANNING_AUTHORITY_CLASS,
  PLANNING_VERIFICATION_STATUS,
  PLANNING_CARDINALITY,
  PLANNING_EVIDENCE_STATUS,
  createPlanningEvidenceRecord,
  verifyPlanningEvidenceIntegrity,
  isTemporallyValid,
  assessPlanningEvidenceSet,
};
