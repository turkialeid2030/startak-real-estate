'use strict';

const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  normalizeReadinessVerifierRegistry,
  normalizeReadinessEvidence,
  verifyReadinessEvidenceSignature,
} = require('../standards/production-evidence-go-live-readiness');

const STATUS = Object.freeze({
  HOLD_READINESS_TRUST_ROOT: 'HOLD_READINESS_TRUST_ROOT',
  HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY: 'HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY',
  HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE: 'HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE',
  HOLD_EXTERNAL_EVIDENCE_RESPONSE_RESULT: 'HOLD_EXTERNAL_EVIDENCE_RESPONSE_RESULT',
  READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED: 'READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED',
});

const REQUIRED_EVIDENCE_TYPES = Object.freeze(Object.values(EVIDENCE_TYPE));
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  externalEvidenceAcceptedByE2I: false,
  readinessVerifierTrustEstablishedHere: false,
  legalApprovalEstablished: false,
  pdplComplianceEstablished: false,
  professionalAuthorityEstablished: false,
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  if (!Number.isFinite(Date.parse(normalized))) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return new Date(normalized).toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeExpectedReleaseBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) throw new TypeError('expectedReleaseBinding must be an object');
  return deepFreeze({
    upstreamCloseoutPacketHashSha256: requiredSha256(binding.upstreamCloseoutPacketHashSha256, 'expectedReleaseBinding.upstreamCloseoutPacketHashSha256'),
    releaseCandidateId: requiredString(binding.releaseCandidateId, 'expectedReleaseBinding.releaseCandidateId'),
    sourceCommitSha: requiredCommitSha(binding.sourceCommitSha, 'expectedReleaseBinding.sourceCommitSha'),
    artifactSha256: requiredSha256(binding.artifactSha256, 'expectedReleaseBinding.artifactSha256'),
    environmentRef: requiredString(binding.environmentRef, 'expectedReleaseBinding.environmentRef'),
    environmentConfigSha256: requiredSha256(binding.environmentConfigSha256, 'expectedReleaseBinding.environmentConfigSha256'),
    upstreamCloseoutPreparedAt: requiredTimestamp(binding.upstreamCloseoutPreparedAt, 'expectedReleaseBinding.upstreamCloseoutPreparedAt'),
  });
}

function hold(status, blockers, registryHashSha256 = null, normalizedEvidence = []) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    readinessVerifierRegistryHashSha256: registryHashSha256,
    readinessEvidence: Object.freeze([...normalizedEvidence]),
    requiredEvidenceTypes: REQUIRED_EVIDENCE_TYPES,
    readyForE2IAggregation: false,
    e2iAcceptancePending: true,
    authority: AUTHORITY,
  });
}

function preflightExternalEvidenceResponses({
  policy,
  readinessVerifierRegistry,
  expectedReadinessVerifierRegistryHashSha256,
  expectedReleaseBinding,
  readinessEvidence,
  intakePreparedAt,
} = {}) {
  const intakePreparedAtIso = requiredTimestamp(intakePreparedAt, 'intakePreparedAt');
  const binding = normalizeExpectedReleaseBinding(expectedReleaseBinding);

  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('policy must be an object');
  if (!Array.isArray(policy.requiredEvidenceTypes) || !Array.isArray(policy.allowedEvidenceResults) || !Array.isArray(policy.signatureAlgorithmsAllowed)) {
    throw new TypeError('policy must expose E2I evidence/signature arrays');
  }
  for (const type of REQUIRED_EVIDENCE_TYPES) {
    if (!policy.requiredEvidenceTypes.includes(type)) throw new TypeError(`policy missing required E2I evidence type: ${type}`);
  }

  let registry;
  let expectedRegistryHash;
  try {
    registry = normalizeReadinessVerifierRegistry(readinessVerifierRegistry);
    expectedRegistryHash = requiredSha256(expectedReadinessVerifierRegistryHashSha256, 'expectedReadinessVerifierRegistryHashSha256');
  } catch (error) {
    return hold(STATUS.HOLD_READINESS_TRUST_ROOT, [error.message]);
  }
  if (registry.registryHashSha256 !== expectedRegistryHash) {
    return hold(STATUS.HOLD_READINESS_TRUST_ROOT, ['READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'], registry.registryHashSha256);
  }

  if (!Array.isArray(readinessEvidence)) throw new TypeError('readinessEvidence must be an array');
  let normalized;
  try {
    normalized = readinessEvidence.map((record) => normalizeReadinessEvidence(record, policy));
  } catch (error) {
    return hold(STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY, [error.message], registry.registryHashSha256);
  }

  const blockers = [];
  const seenIds = new Set();
  const seenTypes = new Set();
  const verifierById = new Map(registry.verifiers.map((record) => [record.verifierId, record]));

  for (const evidence of normalized) {
    if (seenIds.has(evidence.evidenceId)) blockers.push(`DUPLICATE_READINESS_EVIDENCE_ID:${evidence.evidenceId}`);
    seenIds.add(evidence.evidenceId);
    if (seenTypes.has(evidence.evidenceType)) blockers.push(`DUPLICATE_READINESS_EVIDENCE_TYPE:${evidence.evidenceType}`);
    seenTypes.add(evidence.evidenceType);

    const verifier = verifierById.get(evidence.verifierId);
    if (!verifier) {
      blockers.push(`READINESS_VERIFIER_NOT_TRUSTED:${evidence.evidenceId}:${evidence.verifierId}`);
      continue;
    }
    if (!verifier.allowedEvidenceTypes.includes(evidence.evidenceType)) blockers.push(`READINESS_VERIFIER_TYPE_NOT_ALLOWED:${evidence.evidenceId}:${evidence.verifierId}:${evidence.evidenceType}`);
    if (Date.parse(evidence.verifiedAt) < Date.parse(verifier.activeFrom) || (verifier.activeUntil && Date.parse(evidence.verifiedAt) > Date.parse(verifier.activeUntil))) blockers.push(`READINESS_VERIFIER_OUTSIDE_ACTIVE_PERIOD:${evidence.evidenceId}`);
    if (Date.parse(evidence.verifiedAt) < Date.parse(binding.upstreamCloseoutPreparedAt)) blockers.push(`READINESS_EVIDENCE_BEFORE_E2H_CLOSEOUT:${evidence.evidenceId}`);
    if (Date.parse(evidence.verifiedAt) > Date.parse(intakePreparedAtIso)) blockers.push(`READINESS_EVIDENCE_AFTER_INTAKE_PREPARATION:${evidence.evidenceId}`);
    if (evidence.expiresAt && Date.parse(evidence.expiresAt) < Date.parse(evidence.verifiedAt)) blockers.push(`READINESS_EVIDENCE_EXPIRY_BEFORE_VERIFICATION:${evidence.evidenceId}`);
    if (evidence.expiresAt && Date.parse(evidence.expiresAt) < Date.parse(intakePreparedAtIso)) blockers.push(`READINESS_EVIDENCE_EXPIRED_AT_INTAKE:${evidence.evidenceId}`);

    if (evidence.upstreamCloseoutPacketHashSha256 !== binding.upstreamCloseoutPacketHashSha256) blockers.push(`READINESS_UPSTREAM_CLOSEOUT_HASH_MISMATCH:${evidence.evidenceId}`);
    if (evidence.releaseCandidateId !== binding.releaseCandidateId) blockers.push(`READINESS_RELEASE_CANDIDATE_MISMATCH:${evidence.evidenceId}`);
    if (evidence.sourceCommitSha !== binding.sourceCommitSha) blockers.push(`READINESS_SOURCE_COMMIT_MISMATCH:${evidence.evidenceId}`);
    if (evidence.artifactSha256 !== binding.artifactSha256) blockers.push(`READINESS_ARTIFACT_HASH_MISMATCH:${evidence.evidenceId}`);
    if (evidence.environmentRef !== binding.environmentRef) blockers.push(`READINESS_ENVIRONMENT_MISMATCH:${evidence.evidenceId}`);
    if (evidence.environmentConfigSha256 !== binding.environmentConfigSha256) blockers.push(`READINESS_ENV_CONFIG_HASH_MISMATCH:${evidence.evidenceId}`);
    if (!verifyReadinessEvidenceSignature(evidence, verifier, policy)) blockers.push(`READINESS_EVIDENCE_SIGNATURE_INVALID:${evidence.evidenceId}`);
  }

  if (blockers.length) return hold(STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_INTEGRITY, blockers, registry.registryHashSha256, normalized);

  const missingEvidenceTypes = REQUIRED_EVIDENCE_TYPES.filter((type) => !seenTypes.has(type));
  if (missingEvidenceTypes.length > 0 || normalized.length !== REQUIRED_EVIDENCE_TYPES.length) {
    return hold(
      STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE,
      missingEvidenceTypes.map((type) => `READINESS_EVIDENCE_TYPE_MISSING:${type}`),
      registry.registryHashSha256,
      normalized,
    );
  }

  const verifierSubjects = new Set(normalized.map((record) => verifierById.get(record.verifierId)?.verifierSubjectRef).filter(Boolean));
  if (verifierSubjects.size < 2) {
    return hold(STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_COVERAGE, ['SINGLE_VERIFIER_SUBJECT_FOR_ALL_READINESS_EVIDENCE_PROHIBITED'], registry.registryHashSha256, normalized);
  }

  const nonVerified = normalized.filter((record) => record.result !== EVIDENCE_RESULT.VERIFIED);
  if (nonVerified.length > 0) {
    return hold(
      STATUS.HOLD_EXTERNAL_EVIDENCE_RESPONSE_RESULT,
      nonVerified.map((record) => `READINESS_EVIDENCE_NOT_VERIFIED:${record.evidenceType}:${record.result}`),
      registry.registryHashSha256,
      normalized,
    );
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED,
    blockers: Object.freeze([]),
    readinessVerifierRegistryId: registry.registryId,
    readinessVerifierRegistryHashSha256: registry.registryHashSha256,
    expectedReleaseBinding: binding,
    readinessEvidence: Object.freeze([...normalized]),
    requiredEvidenceTypes: REQUIRED_EVIDENCE_TYPES,
    verifierSubjects: Object.freeze([...verifierSubjects].sort()),
    allRequiredEvidenceTypesPresent: true,
    allEvidenceResultsVerified: true,
    signaturesCryptographicallyVerified: true,
    minimumVerifierSubjectDiversitySatisfied: true,
    readyForE2IAggregation: true,
    e2iAcceptancePending: true,
    intakePreparedAt: intakePreparedAtIso,
    authority: AUTHORITY,
    semantics: 'This preflight verifies the pinned public verifier-registry hash, evidence signatures, release binding, timing, exact six-type coverage, result status and verifier-subject diversity before E2I aggregation. It is not E2I acceptance, does not verify the E2H closeout packet itself, does not establish external legal/professional truth beyond the signed evidence result, and grants no release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  REQUIRED_EVIDENCE_TYPES,
  AUTHORITY,
  normalizeExpectedReleaseBinding,
  preflightExternalEvidenceResponses,
};
