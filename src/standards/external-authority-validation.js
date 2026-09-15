'use strict';

const crypto = require('crypto');
const { sha256 } = require('./standards-registry');
const {
  E2B_STATUS,
  verifyExternalEvidenceEnvelopeIntegrity,
} = require('./external-review-credential-evidence');

const E2C_STATUS = Object.freeze({
  HOLD_EXTERNAL_EVIDENCE_ENVELOPE: 'HOLD_EXTERNAL_EVIDENCE_ENVELOPE',
  HOLD_TRUST_ROOT: 'HOLD_TRUST_ROOT',
  HOLD_ATTESTATION_INTEGRITY: 'HOLD_ATTESTATION_INTEGRITY',
  HOLD_EXTERNAL_VALIDATION_REJECTED: 'HOLD_EXTERNAL_VALIDATION_REJECTED',
  WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION: 'WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION',
  WAITING_FOR_CREDENTIAL_AUTHENTICITY_VALIDATION: 'WAITING_FOR_CREDENTIAL_AUTHENTICITY_VALIDATION',
  WAITING_FOR_REVIEWER_AUTHORITY_VALIDATION: 'WAITING_FOR_REVIEWER_AUTHORITY_VALIDATION',
  WAITING_FOR_REVIEWER_INDEPENDENCE_VALIDATION: 'WAITING_FOR_REVIEWER_INDEPENDENCE_VALIDATION',
  AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW: 'AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW',
});

const VALIDATION_TYPE = Object.freeze({
  REVIEW_EVIDENCE_AUTHENTICITY: 'REVIEW_EVIDENCE_AUTHENTICITY',
  CREDENTIAL_AUTHENTICITY: 'CREDENTIAL_AUTHENTICITY',
  REVIEWER_AUTHORITY: 'REVIEWER_AUTHORITY',
  REVIEWER_INDEPENDENCE: 'REVIEWER_INDEPENDENCE',
});

const ATTESTATION_RESULT = Object.freeze({
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function digest(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy must be an object');
  assertNonEmpty(policy.policyId, 'policy.policyId');
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2C_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.trustedVerifierRegistryRequired !== true) throw new TypeError('E2C_TRUSTED_VERIFIER_REGISTRY_REQUIRED');
  if (policy.trustedRegistryHashPinnedOutOfBandRequired !== true) throw new TypeError('E2C_OUT_OF_BAND_TRUST_ROOT_REQUIRED');
  if (policy.callerDeclaredVerificationAccepted !== false) throw new TypeError('E2C_CALLER_DECLARED_VERIFICATION_MUST_NOT_BE_ACCEPTED');
  if (policy.selfValidationAllowed !== false) throw new TypeError('E2C_SELF_VALIDATION_MUST_REMAIN_FALSE');
  if (policy.automaticRuleActivationAllowed !== false) throw new TypeError('E2C_AUTOMATIC_RULE_ACTIVATION_MUST_REMAIN_FALSE');
  if (policy.automaticLegalConclusionAllowed !== false) throw new TypeError('E2C_AUTOMATIC_LEGAL_CONCLUSION_MUST_REMAIN_FALSE');
  if (policy.automaticProfessionalConclusionAllowed !== false) throw new TypeError('E2C_AUTOMATIC_PROFESSIONAL_CONCLUSION_MUST_REMAIN_FALSE');
  if (policy.automaticComplianceConclusionAllowed !== false) throw new TypeError('E2C_AUTOMATIC_COMPLIANCE_CONCLUSION_MUST_REMAIN_FALSE');
  if (!Array.isArray(policy.requiredValidationTypes) || policy.requiredValidationTypes.length === 0) throw new TypeError('policy.requiredValidationTypes must be non-empty');
  for (const type of Object.values(VALIDATION_TYPE)) {
    if (!policy.requiredValidationTypes.includes(type)) throw new TypeError(`E2C_REQUIRED_VALIDATION_TYPE_MISSING:${type}`);
  }
  if (!Array.isArray(policy.allowedAttestationResults) || policy.allowedAttestationResults.length === 0) throw new TypeError('policy.allowedAttestationResults must be non-empty');
  if (!Array.isArray(policy.signatureAlgorithmsAllowed) || !policy.signatureAlgorithmsAllowed.includes('RSA-SHA256')) {
    throw new TypeError('E2C_RSA_SHA256_MUST_BE_ALLOWED');
  }
  return true;
}

function normalizeVerifier(record) {
  if (!record || typeof record !== 'object') throw new TypeError('trusted verifier record must be an object');
  for (const field of ['verifierId', 'verifierSubjectRef', 'authorityClass', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom']) {
    assertNonEmpty(record[field], `trustedVerifier.${field}`);
  }
  const normalized = {
    verifierId: record.verifierId.trim(),
    verifierSubjectRef: record.verifierSubjectRef.trim(),
    authorityClass: record.authorityClass.trim(),
    publicKeyPem: record.publicKeyPem.trim(),
    publicKeySha256: digest(record.publicKeySha256, 'trustedVerifier.publicKeySha256'),
    governanceEvidenceRef: record.governanceEvidenceRef.trim(),
    activeFrom: iso(record.activeFrom, 'trustedVerifier.activeFrom'),
    activeUntil: nonEmpty(record.activeUntil) ? iso(record.activeUntil, 'trustedVerifier.activeUntil') : null,
  };
  if (sha256(normalized.publicKeyPem) !== normalized.publicKeySha256) throw new TypeError(`TRUSTED_VERIFIER_PUBLIC_KEY_HASH_MISMATCH:${normalized.verifierId}`);
  if (normalized.activeUntil && Date.parse(normalized.activeUntil) < Date.parse(normalized.activeFrom)) throw new TypeError(`TRUSTED_VERIFIER_VALIDITY_RANGE_INVALID:${normalized.verifierId}`);
  try {
    crypto.createPublicKey(normalized.publicKeyPem);
  } catch (error) {
    throw new TypeError(`TRUSTED_VERIFIER_PUBLIC_KEY_INVALID:${normalized.verifierId}`);
  }
  return deepFreeze(normalized);
}

function normalizeTrustedVerifierRegistry(registry) {
  if (!registry || typeof registry !== 'object') throw new TypeError('trustedVerifierRegistry must be an object');
  assertNonEmpty(registry.registryId, 'trustedVerifierRegistry.registryId');
  if (registry.status !== 'EXTERNALLY_GOVERNED') throw new TypeError('TRUSTED_VERIFIER_REGISTRY_NOT_EXTERNALLY_GOVERNED');
  if (!Array.isArray(registry.verifiers) || registry.verifiers.length === 0) throw new TypeError('trustedVerifierRegistry.verifiers must be non-empty');
  const verifiers = registry.verifiers.map(normalizeVerifier);
  const ids = new Set();
  for (const verifier of verifiers) {
    if (ids.has(verifier.verifierId)) throw new TypeError(`DUPLICATE_TRUSTED_VERIFIER_ID:${verifier.verifierId}`);
    ids.add(verifier.verifierId);
  }
  const core = {
    schemaVersion: 1,
    registryId: registry.registryId.trim(),
    status: registry.status,
    governanceOwnerRef: nonEmpty(registry.governanceOwnerRef) ? registry.governanceOwnerRef.trim() : null,
    verifiers,
  };
  return deepFreeze({
    ...core,
    registryHashSha256: sha256(core),
  });
}

function createAttestationSigningPayload(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('attestation record must be an object');
  for (const field of [
    'attestationId', 'validationType', 'targetRef', 'subjectArtifactSha256', 'result',
    'verifierId', 'verificationSourceRef', 'verificationArtifactSha256', 'verifiedAt', 'signatureAlgorithm',
  ]) assertNonEmpty(record[field], `attestation.${field}`);
  if (!policy.requiredValidationTypes.includes(record.validationType)) throw new TypeError(`ATTESTATION_VALIDATION_TYPE_NOT_ALLOWED:${record.validationType}`);
  if (!policy.allowedAttestationResults.includes(record.result)) throw new TypeError(`ATTESTATION_RESULT_NOT_ALLOWED:${record.result}`);
  if (!policy.signatureAlgorithmsAllowed.includes(record.signatureAlgorithm)) throw new TypeError(`ATTESTATION_SIGNATURE_ALGORITHM_NOT_ALLOWED:${record.signatureAlgorithm}`);
  return deepFreeze({
    attestationId: record.attestationId.trim(),
    validationType: record.validationType,
    targetRef: record.targetRef.trim(),
    linkedCredentialEvidenceId: nonEmpty(record.linkedCredentialEvidenceId) ? record.linkedCredentialEvidenceId.trim() : null,
    subjectArtifactSha256: digest(record.subjectArtifactSha256, 'attestation.subjectArtifactSha256'),
    result: record.result,
    verifierId: record.verifierId.trim(),
    verificationSourceRef: record.verificationSourceRef.trim(),
    verificationArtifactSha256: digest(record.verificationArtifactSha256, 'attestation.verificationArtifactSha256'),
    verifiedAt: iso(record.verifiedAt, 'attestation.verifiedAt'),
    expiresAt: nonEmpty(record.expiresAt) ? iso(record.expiresAt, 'attestation.expiresAt') : null,
    signatureAlgorithm: record.signatureAlgorithm,
  });
}

function normalizeAttestation(record, policy) {
  const payload = createAttestationSigningPayload(record, policy);
  assertNonEmpty(record.signatureBase64, 'attestation.signatureBase64');
  let signature;
  try {
    signature = Buffer.from(record.signatureBase64, 'base64');
  } catch (error) {
    throw new TypeError(`ATTESTATION_SIGNATURE_BASE64_INVALID:${payload.attestationId}`);
  }
  if (!signature.length) throw new TypeError(`ATTESTATION_SIGNATURE_BASE64_INVALID:${payload.attestationId}`);
  return deepFreeze({
    ...payload,
    signatureBase64: record.signatureBase64.trim(),
    attestationPayloadHashSha256: sha256(payload),
  });
}

function verifyAttestationSignature(attestation, verifier) {
  if (attestation.signatureAlgorithm !== 'RSA-SHA256') return false;
  try {
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(createAttestationSigningPayload(attestation, {
        requiredValidationTypes: Object.values(VALIDATION_TYPE),
        allowedAttestationResults: Object.values(ATTESTATION_RESULT),
        signatureAlgorithmsAllowed: ['RSA-SHA256'],
      })), 'utf8'),
      verifier.publicKeyPem,
      Buffer.from(attestation.signatureBase64, 'base64'),
    );
  } catch (error) {
    return false;
  }
}

function substantiveBoundary() {
  return deepFreeze({
    legalConclusionEstablished: false,
    professionalApplicabilityEstablished: false,
    formalStandardsConformanceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    pdplComplianceEstablished: false,
    taxComplianceEstablished: false,
    financialReportingComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    standardsOrRulesActivated: false,
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, packetId, envelope, policy, blockers, preparedByRef, preparedAtIso, trustedRegistryHash = null) {
  return deepFreeze({
    schemaVersion: 1,
    validationPacketId: packetId,
    upstreamEnvelopeId: envelope?.envelopeId || null,
    upstreamEnvelopeHashSha256: envelope?.envelopeHashSha256 || null,
    policyId: policy?.policyId || null,
    trustedVerifierRegistryHashSha256: trustedRegistryHash,
    status,
    blockers: Object.freeze([...blockers]),
    attestations: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    validationPacketHashSha256: null,
    externalReviewAuthenticityValidated: false,
    credentialAuthenticityValidated: false,
    reviewerAuthorityValidated: false,
    reviewerCredentialsVerified: false,
    reviewerIndependenceVerified: false,
    externalAuthorityValidationComplete: false,
    ...substantiveBoundary(),
  });
}

function resolveAttestationTarget(attestation, envelope) {
  if (attestation.validationType === VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY) {
    const review = envelope.reviewEvidence.find((item) => item.evidenceId === attestation.targetRef);
    if (!review) return { error: `ATTESTATION_TARGET_NOT_FOUND:${attestation.attestationId}:${attestation.targetRef}` };
    if (review.artifactSha256 !== attestation.subjectArtifactSha256) return { error: `ATTESTATION_SUBJECT_HASH_MISMATCH:${attestation.attestationId}` };
    return { reviewerRef: review.reviewerRef };
  }
  if (attestation.validationType === VALIDATION_TYPE.CREDENTIAL_AUTHENTICITY) {
    const credential = envelope.credentialEvidence.find((item) => item.credentialEvidenceId === attestation.targetRef);
    if (!credential) return { error: `ATTESTATION_TARGET_NOT_FOUND:${attestation.attestationId}:${attestation.targetRef}` };
    if (credential.artifactSha256 !== attestation.subjectArtifactSha256) return { error: `ATTESTATION_SUBJECT_HASH_MISMATCH:${attestation.attestationId}` };
    return { reviewerRef: credential.subjectReviewerRef };
  }
  if ([VALIDATION_TYPE.REVIEWER_AUTHORITY, VALIDATION_TYPE.REVIEWER_INDEPENDENCE].includes(attestation.validationType)) {
    const reviewerRef = attestation.targetRef;
    const reviewerExists = envelope.reviewEvidence.some((item) => item.reviewerRef === reviewerRef);
    if (!reviewerExists) return { error: `ATTESTATION_REVIEWER_NOT_FOUND:${attestation.attestationId}:${reviewerRef}` };
    const credential = envelope.credentialEvidence.find((item) => item.credentialEvidenceId === attestation.linkedCredentialEvidenceId && item.subjectReviewerRef === reviewerRef);
    if (!credential) return { error: `ATTESTATION_LINKED_CREDENTIAL_NOT_FOUND:${attestation.attestationId}` };
    if (credential.artifactSha256 !== attestation.subjectArtifactSha256) return { error: `ATTESTATION_SUBJECT_HASH_MISMATCH:${attestation.attestationId}` };
    return { reviewerRef };
  }
  return { error: `ATTESTATION_VALIDATION_TYPE_UNRESOLVED:${attestation.attestationId}` };
}

function hasVerified(attestations, validationType, targetRef) {
  return attestations.some((item) => item.validationType === validationType && item.targetRef === targetRef && item.result === ATTESTATION_RESULT.VERIFIED);
}

function createExternalAuthorityValidationPacket({
  validationPacketId,
  externalEvidenceEnvelope,
  policy,
  trustedVerifierRegistry,
  expectedTrustedRegistryHashSha256,
  attestations = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(validationPacketId, 'validationPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  if (externalEvidenceEnvelope?.status !== E2B_STATUS.READY_FOR_EXTERNAL_AUTHORITY_VALIDATION || !verifyExternalEvidenceEnvelopeIntegrity(externalEvidenceEnvelope)) {
    return hold(E2C_STATUS.HOLD_EXTERNAL_EVIDENCE_ENVELOPE, validationPacketId.trim(), externalEvidenceEnvelope, policy, ['E2B_EXTERNAL_EVIDENCE_ENVELOPE_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }

  let registry;
  let expectedHash;
  try {
    registry = normalizeTrustedVerifierRegistry(trustedVerifierRegistry);
    expectedHash = digest(expectedTrustedRegistryHashSha256, 'expectedTrustedRegistryHashSha256');
  } catch (error) {
    return hold(E2C_STATUS.HOLD_TRUST_ROOT, validationPacketId.trim(), externalEvidenceEnvelope, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return hold(E2C_STATUS.HOLD_TRUST_ROOT, validationPacketId.trim(), externalEvidenceEnvelope, policy, ['TRUSTED_VERIFIER_REGISTRY_HASH_MISMATCH'], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  if (!Array.isArray(attestations)) throw new TypeError('attestations must be an array');
  let normalized;
  try {
    normalized = attestations.map((record) => normalizeAttestation(record, policy));
  } catch (error) {
    return hold(E2C_STATUS.HOLD_ATTESTATION_INTEGRITY, validationPacketId.trim(), externalEvidenceEnvelope, policy, [error.message], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const blockers = [];
  const seen = new Set();
  const verifierById = new Map(registry.verifiers.map((item) => [item.verifierId, item]));
  for (const attestation of normalized) {
    if (seen.has(attestation.attestationId)) blockers.push(`DUPLICATE_ATTESTATION_ID:${attestation.attestationId}`);
    seen.add(attestation.attestationId);
    const verifier = verifierById.get(attestation.verifierId);
    if (!verifier) {
      blockers.push(`ATTESTATION_VERIFIER_NOT_TRUSTED:${attestation.attestationId}:${attestation.verifierId}`);
      continue;
    }
    if (Date.parse(attestation.verifiedAt) < Date.parse(verifier.activeFrom) || (verifier.activeUntil && Date.parse(attestation.verifiedAt) > Date.parse(verifier.activeUntil))) {
      blockers.push(`ATTESTATION_VERIFIER_OUTSIDE_ACTIVE_PERIOD:${attestation.attestationId}`);
    }
    if (Date.parse(attestation.verifiedAt) > Date.parse(preparedAtIso)) blockers.push(`ATTESTATION_VERIFIED_AFTER_PACKET_PREPARATION:${attestation.attestationId}`);
    if (attestation.expiresAt && Date.parse(attestation.expiresAt) < Date.parse(attestation.verifiedAt)) blockers.push(`ATTESTATION_EXPIRY_BEFORE_VERIFICATION:${attestation.attestationId}`);
    if (attestation.expiresAt && Date.parse(attestation.expiresAt) < Date.parse(preparedAtIso)) blockers.push(`ATTESTATION_EXPIRED_AT_PACKET_PREPARATION:${attestation.attestationId}`);
    const target = resolveAttestationTarget(attestation, externalEvidenceEnvelope);
    if (target.error) blockers.push(target.error);
    if (target.reviewerRef && verifier.verifierSubjectRef === target.reviewerRef) blockers.push(`SELF_VALIDATION_PROHIBITED:${attestation.attestationId}:${target.reviewerRef}`);
    if (!verifyAttestationSignature(attestation, verifier)) blockers.push(`ATTESTATION_SIGNATURE_INVALID:${attestation.attestationId}`);
  }
  if (blockers.length) {
    return hold(E2C_STATUS.HOLD_ATTESTATION_INTEGRITY, validationPacketId.trim(), externalEvidenceEnvelope, policy, blockers, preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const rejected = normalized.filter((item) => item.result === ATTESTATION_RESULT.REJECTED);
  if (rejected.length) {
    return hold(E2C_STATUS.HOLD_EXTERNAL_VALIDATION_REJECTED, validationPacketId.trim(), externalEvidenceEnvelope, policy, rejected.map((item) => `EXTERNAL_VALIDATION_REJECTED:${item.validationType}:${item.targetRef}:${item.attestationId}`), preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const reviewIds = externalEvidenceEnvelope.reviewEvidence.map((item) => item.evidenceId);
  const credentialIds = externalEvidenceEnvelope.credentialEvidence.map((item) => item.credentialEvidenceId);
  const reviewerRefs = [...new Set(externalEvidenceEnvelope.reviewEvidence.map((item) => item.reviewerRef))];

  const missingReviewAuthenticity = reviewIds.filter((id) => !hasVerified(normalized, VALIDATION_TYPE.REVIEW_EVIDENCE_AUTHENTICITY, id));
  const missingCredentialAuthenticity = credentialIds.filter((id) => !hasVerified(normalized, VALIDATION_TYPE.CREDENTIAL_AUTHENTICITY, id));
  const missingReviewerAuthority = reviewerRefs.filter((id) => !hasVerified(normalized, VALIDATION_TYPE.REVIEWER_AUTHORITY, id));
  const missingReviewerIndependence = reviewerRefs.filter((id) => !hasVerified(normalized, VALIDATION_TYPE.REVIEWER_INDEPENDENCE, id));

  const reviewAuthenticityValidated = missingReviewAuthenticity.length === 0;
  const credentialAuthenticityValidated = missingCredentialAuthenticity.length === 0;
  const reviewerAuthorityValidated = missingReviewerAuthority.length === 0;
  const reviewerIndependenceVerified = missingReviewerIndependence.length === 0;
  const reviewerCredentialsVerified = credentialAuthenticityValidated && reviewerAuthorityValidated;
  const complete = reviewAuthenticityValidated && credentialAuthenticityValidated && reviewerAuthorityValidated && reviewerIndependenceVerified;

  const status = !reviewAuthenticityValidated
    ? E2C_STATUS.WAITING_FOR_REVIEW_AUTHENTICITY_VALIDATION
    : !credentialAuthenticityValidated
      ? E2C_STATUS.WAITING_FOR_CREDENTIAL_AUTHENTICITY_VALIDATION
      : !reviewerAuthorityValidated
        ? E2C_STATUS.WAITING_FOR_REVIEWER_AUTHORITY_VALIDATION
        : !reviewerIndependenceVerified
          ? E2C_STATUS.WAITING_FOR_REVIEWER_INDEPENDENCE_VALIDATION
          : E2C_STATUS.AUTHORITY_VALIDATION_COMPLETE_PENDING_SUBSTANTIVE_REVIEW;

  const core = {
    schemaVersion: 1,
    validationPacketId: validationPacketId.trim(),
    upstreamEnvelopeId: externalEvidenceEnvelope.envelopeId,
    upstreamEnvelopeHashSha256: externalEvidenceEnvelope.envelopeHashSha256,
    policyId: policy.policyId,
    trustedVerifierRegistryId: registry.registryId,
    trustedVerifierRegistryHashSha256: registry.registryHashSha256,
    attestations: normalized,
    missingReviewAuthenticity: Object.freeze([...missingReviewAuthenticity]),
    missingCredentialAuthenticity: Object.freeze([...missingCredentialAuthenticity]),
    missingReviewerAuthority: Object.freeze([...missingReviewerAuthority]),
    missingReviewerIndependence: Object.freeze([...missingReviewerIndependence]),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    validationPacketHashSha256: sha256(core),
    externalReviewAuthenticityValidated: reviewAuthenticityValidated,
    credentialAuthenticityValidated,
    reviewerAuthorityValidated,
    reviewerCredentialsVerified,
    reviewerIndependenceVerified,
    externalAuthorityValidationComplete: complete,
    ...substantiveBoundary(),
    semantics: 'E2C verifies cryptographic validation attestations against an externally governed verifier registry whose hash must be pinned out-of-band. A completed E2C packet establishes only the configured authenticity/authority/independence validation gates. It does not establish substantive legal/professional/accounting/tax/data-protection conclusions, standards conformance, platform licensing, certified valuation authority, external issuance authority, release, merge, deployment or transaction authorization.',
  });
}

function verifyExternalAuthorityValidationPacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.validationPacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    validationPacketId: packet.validationPacketId,
    upstreamEnvelopeId: packet.upstreamEnvelopeId,
    upstreamEnvelopeHashSha256: packet.upstreamEnvelopeHashSha256,
    policyId: packet.policyId,
    trustedVerifierRegistryId: packet.trustedVerifierRegistryId,
    trustedVerifierRegistryHashSha256: packet.trustedVerifierRegistryHashSha256,
    attestations: packet.attestations,
    missingReviewAuthenticity: packet.missingReviewAuthenticity,
    missingCredentialAuthenticity: packet.missingCredentialAuthenticity,
    missingReviewerAuthority: packet.missingReviewerAuthority,
    missingReviewerIndependence: packet.missingReviewerIndependence,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.validationPacketHashSha256.toLowerCase();
}

module.exports = {
  E2C_STATUS,
  VALIDATION_TYPE,
  ATTESTATION_RESULT,
  validatePolicy,
  normalizeTrustedVerifierRegistry,
  createAttestationSigningPayload,
  normalizeAttestation,
  verifyAttestationSignature,
  createExternalAuthorityValidationPacket,
  verifyExternalAuthorityValidationPacketIntegrity,
};
