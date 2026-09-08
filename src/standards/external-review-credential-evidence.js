'use strict';

const { sha256 } = require('./standards-registry');
const {
  verifyApplicabilityPacketIntegrity,
  APPLICABILITY_PACKET_STATUS,
} = require('./saudi-legal-professional-applicability');

const E2B_STATUS = Object.freeze({
  HOLD_APPLICABILITY_PACKET: 'HOLD_APPLICABILITY_PACKET',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
  WAITING_FOR_EXTERNAL_REVIEW_EVIDENCE: 'WAITING_FOR_EXTERNAL_REVIEW_EVIDENCE',
  WAITING_FOR_CREDENTIAL_EVIDENCE: 'WAITING_FOR_CREDENTIAL_EVIDENCE',
  READY_FOR_EXTERNAL_AUTHORITY_VALIDATION: 'READY_FOR_EXTERNAL_AUTHORITY_VALIDATION',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function sha(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function authorityBoundary() {
  return deepFreeze({
    externalReviewAuthenticityValidated: false,
    credentialAuthenticityValidated: false,
    reviewerAuthorityValidated: false,
    reviewerCredentialsVerified: false,
    reviewerIndependenceVerified: false,
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    formalStandardsConformanceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    pdplComplianceEstablished: false,
    taxComplianceEstablished: false,
    financialReportingComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function validateRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object') throw new TypeError('requirements must be an object');
  assertNonEmpty(requirements.requirementsId, 'requirements.requirementsId');
  if (requirements.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2B_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (!requirements.reviewClassRequirements || typeof requirements.reviewClassRequirements !== 'object') throw new TypeError('reviewClassRequirements must be an object');
  if (!Array.isArray(requirements.allowedEvidenceClasses) || requirements.allowedEvidenceClasses.length === 0) throw new TypeError('allowedEvidenceClasses must be non-empty');
  for (const [reviewClass, classes] of Object.entries(requirements.reviewClassRequirements)) {
    if (!nonEmpty(reviewClass) || !Array.isArray(classes) || classes.length === 0) throw new TypeError(`invalid reviewClassRequirements:${reviewClass}`);
    for (const evidenceClass of classes) {
      if (!requirements.allowedEvidenceClasses.includes(evidenceClass)) throw new TypeError(`UNKNOWN_EVIDENCE_CLASS:${reviewClass}:${evidenceClass}`);
    }
  }
  for (const field of [
    'evidenceTruthAutoValidationAllowed',
    'credentialAuthenticityAutoValidationAllowed',
    'reviewerAuthorityAutoValidationAllowed',
    'legalCorrectnessAutoValidationAllowed',
    'professionalCorrectnessAutoValidationAllowed',
    'automaticRuleActivationAllowed',
  ]) {
    if (requirements[field] !== false) throw new TypeError(`E2B_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  for (const [key, value] of Object.entries(requirements.authorityBoundary || {})) {
    if (value !== false) throw new TypeError(`E2B_AUTHORITY_BOUNDARY_MUST_REMAIN_FALSE:${key}`);
  }
  return true;
}

function normalizeReviewEvidence(record, requirements) {
  if (!record || typeof record !== 'object') throw new TypeError('review evidence record must be an object');
  for (const field of requirements.reviewEvidenceRequiredFields || []) assertNonEmpty(record[field], `reviewEvidence.${field}`);
  if (!requirements.allowedEvidenceClasses.includes(record.evidenceClass)) throw new TypeError(`EVIDENCE_CLASS_NOT_ALLOWED:${record.evidenceClass}`);
  const normalized = {
    evidenceId: record.evidenceId.trim(),
    candidateId: record.candidateId.trim(),
    evidenceClass: record.evidenceClass,
    reviewerRef: record.reviewerRef.trim(),
    issuerOrFirmRef: record.issuerOrFirmRef.trim(),
    artifactId: record.artifactId.trim(),
    artifactSha256: sha(record.artifactSha256, 'reviewEvidence.artifactSha256'),
    scopeRef: record.scopeRef.trim(),
    issuedAt: iso(record.issuedAt, 'reviewEvidence.issuedAt'),
    receivedAt: iso(record.receivedAt, 'reviewEvidence.receivedAt'),
    sourceReference: nonEmpty(record.sourceReference) ? record.sourceReference.trim() : null,
    reviewerIndependenceClaim: record.reviewerIndependenceClaim === true,
    externalTruthValidated: false,
    reviewerAuthorityValidated: false,
  };
  if (Date.parse(normalized.receivedAt) < Date.parse(normalized.issuedAt)) throw new TypeError(`EVIDENCE_RECEIVED_BEFORE_ISSUED:${normalized.evidenceId}`);
  return deepFreeze({
    ...normalized,
    evidenceRecordHashSha256: sha256(normalized),
  });
}

function normalizeCredentialEvidence(record, requirements) {
  if (!record || typeof record !== 'object') throw new TypeError('credential evidence record must be an object');
  for (const field of requirements.credentialEvidenceRequiredFields || []) assertNonEmpty(record[field], `credentialEvidence.${field}`);
  const normalized = {
    credentialEvidenceId: record.credentialEvidenceId.trim(),
    subjectReviewerRef: record.subjectReviewerRef.trim(),
    authorityRef: record.authorityRef.trim(),
    credentialClass: record.credentialClass.trim(),
    artifactId: record.artifactId.trim(),
    artifactSha256: sha(record.artifactSha256, 'credentialEvidence.artifactSha256'),
    observedAt: iso(record.observedAt, 'credentialEvidence.observedAt'),
    verificationSourceRef: record.verificationSourceRef.trim(),
    claimedValidFrom: nonEmpty(record.claimedValidFrom) ? iso(record.claimedValidFrom, 'credentialEvidence.claimedValidFrom') : null,
    claimedValidUntil: nonEmpty(record.claimedValidUntil) ? iso(record.claimedValidUntil, 'credentialEvidence.claimedValidUntil') : null,
    credentialAuthenticityValidated: false,
    reviewerAuthorityValidated: false,
  };
  if (normalized.claimedValidFrom && normalized.claimedValidUntil && Date.parse(normalized.claimedValidUntil) < Date.parse(normalized.claimedValidFrom)) {
    throw new TypeError(`CREDENTIAL_VALIDITY_RANGE_INVALID:${normalized.credentialEvidenceId}`);
  }
  return deepFreeze({
    ...normalized,
    credentialRecordHashSha256: sha256(normalized),
  });
}

function unique(records, key, blockerPrefix, blockers) {
  const seen = new Set();
  for (const record of records) {
    const value = record[key];
    if (seen.has(value)) blockers.push(`${blockerPrefix}:${value}`);
    seen.add(value);
  }
}

function requiredClassesForCandidate(candidate, requirements) {
  const classes = requirements.reviewClassRequirements[candidate.reviewClass];
  if (!Array.isArray(classes) || classes.length === 0) throw new TypeError(`REVIEW_CLASS_REQUIREMENTS_MISSING:${candidate.reviewClass}`);
  return classes;
}

function hold(status, envelopeId, applicabilityPacketHash, requirementsId, blockers, preparedByRef, preparedAtIso) {
  return deepFreeze({
    schemaVersion: 1,
    envelopeId,
    applicabilityPacketHash,
    requirementsId,
    status,
    blockers: Object.freeze([...blockers]),
    reviewEvidence: Object.freeze([]),
    credentialEvidence: Object.freeze([]),
    evidenceRequirements: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    envelopeHashSha256: null,
    reviewEvidenceCompletenessEstablished: false,
    credentialEvidenceCompletenessEstablished: false,
    ...authorityBoundary(),
  });
}

function createExternalReviewCredentialEvidenceEnvelope({
  envelopeId,
  applicabilityPacket,
  requirements,
  reviewEvidence = [],
  credentialEvidence = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(envelopeId, 'envelopeId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validateRequirements(requirements);

  const validApplicabilityStatus = [
    APPLICABILITY_PACKET_STATUS.READY_FOR_SAUDI_LEGAL_PROFESSIONAL_REVIEW,
    APPLICABILITY_PACKET_STATUS.HUMAN_REVIEW_DISPOSITIONS_RECORDED_PENDING_AUTHORITY_VALIDATION,
  ].includes(applicabilityPacket?.status);
  if (!validApplicabilityStatus || !verifyApplicabilityPacketIntegrity(applicabilityPacket)) {
    return hold(E2B_STATUS.HOLD_APPLICABILITY_PACKET, envelopeId.trim(), applicabilityPacket?.packetHashSha256 || null, requirements.requirementsId, ['E2_APPLICABILITY_PACKET_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }

  if (!Array.isArray(reviewEvidence) || !Array.isArray(credentialEvidence)) throw new TypeError('reviewEvidence and credentialEvidence must be arrays');
  let normalizedReview;
  let normalizedCredentials;
  try {
    normalizedReview = reviewEvidence.map((record) => normalizeReviewEvidence(record, requirements));
    normalizedCredentials = credentialEvidence.map((record) => normalizeCredentialEvidence(record, requirements));
  } catch (error) {
    return hold(E2B_STATUS.HOLD_EVIDENCE_INTEGRITY, envelopeId.trim(), applicabilityPacket.packetHashSha256, requirements.requirementsId, [error.message], preparedByRef.trim(), preparedAtIso);
  }

  const integrityBlockers = [];
  unique(normalizedReview, 'evidenceId', 'DUPLICATE_REVIEW_EVIDENCE_ID', integrityBlockers);
  unique(normalizedCredentials, 'credentialEvidenceId', 'DUPLICATE_CREDENTIAL_EVIDENCE_ID', integrityBlockers);
  const triggeredIds = new Set(applicabilityPacket.triggeredCandidates.map((candidate) => candidate.candidateId));
  for (const record of normalizedReview) {
    if (!triggeredIds.has(record.candidateId)) integrityBlockers.push(`REVIEW_EVIDENCE_FOR_NON_TRIGGERED_CANDIDATE:${record.evidenceId}:${record.candidateId}`);
    if (Date.parse(record.receivedAt) > Date.parse(preparedAtIso)) integrityBlockers.push(`REVIEW_EVIDENCE_RECEIVED_AFTER_ENVELOPE_PREPARATION:${record.evidenceId}`);
  }
  for (const record of normalizedCredentials) {
    if (Date.parse(record.observedAt) > Date.parse(preparedAtIso)) integrityBlockers.push(`CREDENTIAL_EVIDENCE_OBSERVED_AFTER_ENVELOPE_PREPARATION:${record.credentialEvidenceId}`);
  }
  if (integrityBlockers.length) {
    return hold(E2B_STATUS.HOLD_EVIDENCE_INTEGRITY, envelopeId.trim(), applicabilityPacket.packetHashSha256, requirements.requirementsId, integrityBlockers, preparedByRef.trim(), preparedAtIso);
  }

  const evidenceRequirements = applicabilityPacket.triggeredCandidates.map((candidate) => deepFreeze({
    candidateId: candidate.candidateId,
    reviewClass: candidate.reviewClass,
    requiredEvidenceClasses: Object.freeze([...requiredClassesForCandidate(candidate, requirements)]),
  }));
  const missingReview = [];
  for (const requirement of evidenceRequirements) {
    for (const evidenceClass of requirement.requiredEvidenceClasses) {
      if (!normalizedReview.some((record) => record.candidateId === requirement.candidateId && record.evidenceClass === evidenceClass)) {
        missingReview.push(`${requirement.candidateId}:${evidenceClass}`);
      }
    }
  }

  const reviewerRefs = [...new Set(normalizedReview.map((record) => record.reviewerRef))];
  const missingCredentials = reviewerRefs.filter((reviewerRef) => !normalizedCredentials.some((record) => record.subjectReviewerRef === reviewerRef));
  const reviewEvidenceComplete = missingReview.length === 0;
  const credentialEvidenceComplete = reviewEvidenceComplete && missingCredentials.length === 0;

  const status = !reviewEvidenceComplete
    ? E2B_STATUS.WAITING_FOR_EXTERNAL_REVIEW_EVIDENCE
    : !credentialEvidenceComplete
      ? E2B_STATUS.WAITING_FOR_CREDENTIAL_EVIDENCE
      : E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION;

  const core = {
    schemaVersion: 1,
    envelopeId: envelopeId.trim(),
    applicabilityPacketHash: applicabilityPacket.packetHashSha256,
    applicabilityPacketId: applicabilityPacket.reviewPacketId,
    requirementsId: requirements.requirementsId,
    evidenceRequirements,
    reviewEvidence: normalizedReview,
    credentialEvidence: normalizedCredentials,
    missingReviewEvidence: Object.freeze([...missingReview]),
    missingCredentialEvidenceForReviewers: Object.freeze([...missingCredentials]),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    envelopeHashSha256: sha256(core),
    reviewEvidenceCompletenessEstablished: reviewEvidenceComplete,
    credentialEvidenceCompletenessEstablished: credentialEvidenceComplete,
    externalAuthorityValidationRequired: true,
    ...authorityBoundary(),
    semantics: 'E2B verifies evidence-envelope structure, content-addressed artifact references and completeness only. It does not authenticate the external documents, verify reviewer credentials/authority/independence, validate legal or professional correctness, establish compliance, activate standards, certify valuation authority or authorize release/merge/deployment/transactions.',
  });
}

function verifyExternalEvidenceEnvelopeIntegrity(envelope) {
  if (!envelope || !/^[a-f0-9]{64}$/i.test(String(envelope.envelopeHashSha256 || ''))) return false;
  const core = {
    schemaVersion: envelope.schemaVersion,
    envelopeId: envelope.envelopeId,
    applicabilityPacketHash: envelope.applicabilityPacketHash,
    applicabilityPacketId: envelope.applicabilityPacketId,
    requirementsId: envelope.requirementsId,
    evidenceRequirements: envelope.evidenceRequirements,
    reviewEvidence: envelope.reviewEvidence,
    credentialEvidence: envelope.credentialEvidence,
    missingReviewEvidence: envelope.missingReviewEvidence,
    missingCredentialEvidenceForReviewers: envelope.missingCredentialEvidenceForReviewers,
    preparedByRef: envelope.preparedByRef,
    preparedAt: envelope.preparedAt,
  };
  return sha256(core) === envelope.envelopeHashSha256.toLowerCase();
}

module.exports = {
  E2B_STATUS,
  validateRequirements,
  normalizeReviewEvidence,
  normalizeCredentialEvidence,
  requiredClassesForCandidate,
  createExternalReviewCredentialEvidenceEnvelope,
  verifyExternalEvidenceEnvelopeIntegrity,
};
