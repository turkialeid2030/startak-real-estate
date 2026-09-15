'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P51_STATUS } = require('./fresh-composite-registry-candidate');

const STATUS = Object.freeze({
  HOLD_FRESH_COMPOSITE_EVIDENCE: 'HOLD_FRESH_COMPOSITE_EVIDENCE',
  FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE: 'FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}
function requiredCommit(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return normalized;
}
function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function canonicalContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}
function privateKeyPresent(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).some((key) => /private[-_]?key/i.test(key)));
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.activationAuthorized != null && value.activationAuthorized !== false)
    || (value.activationApplied != null && value.activationApplied !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_COMPOSITE_EVIDENCE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    candidateEvidenceMatched: false,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshShadowVerificationRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function candidateCore(candidate) {
  return {
    schemaVersion: candidate.schemaVersion,
    cycleId: candidate.cycleId,
    freshReactivationGovernanceCycleHashSha256: candidate.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: candidate.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: candidate.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: candidate.freshSuccessorBaselineManifestHashSha256,
    currentRegistryHashSha256: candidate.currentRegistryHashSha256,
    targetPath: candidate.targetPath,
    proposedRegistryHashSha256: candidate.proposedRegistryHashSha256,
    proposedRegistryContentSha256: candidate.proposedRegistryContentSha256,
  };
}

function validateP51Candidate(candidate) {
  const blockers = [];
  if (!candidate || candidate.status !== P51_STATUS.FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE) {
    return ['P51_FRESH_COMPOSITE_REGISTRY_CANDIDATE_REQUIRED'];
  }
  if (
    candidate.verified !== true
    || candidate.candidateOnly !== true
    || candidate.activeRegistryChanged !== false
    || candidate.activationAuthorized !== false
    || candidate.activationApplied !== false
    || candidate.reactivationAuthorized !== false
    || candidate.currentBaselineMutationPerformed !== false
    || candidate.freshCompositeEvidenceVerificationRequired !== true
    || candidate.freshShadowVerificationRequired !== true
    || candidate.freshCutoverRehearsalRequired !== true
    || candidate.freshCutoverSafetyEvidenceRequired !== true
    || candidate.freshOwnerActivationAuthorizationRequired !== true
    || candidate.freshActivationChangeContractRequired !== true
    || candidate.releaseStillBlocked !== true
    || !allAuthorityFalse(candidate)
  ) blockers.push('P51_CANDIDATE_BOUNDARY_INVALID');

  try {
    const candidateHash = requiredSha256(candidate.freshCompositeRegistryCandidateHashSha256, 'freshCompositeRegistryCandidateHashSha256');
    if (sha256Object(candidateCore(candidate)) !== candidateHash) blockers.push('P51_CANDIDATE_RECORD_HASH_MISMATCH');
    const logicalHash = requiredSha256(candidate.candidateRegistryHashSha256, 'candidateRegistryHashSha256');
    const contentHash = requiredSha256(candidate.candidateRegistryContentSha256, 'candidateRegistryContentSha256');
    if (candidate.proposedRegistryHashSha256 !== logicalHash) blockers.push('P51_RESULT_LOGICAL_HASH_MISMATCH');
    if (candidate.proposedRegistryContentSha256 !== contentHash) blockers.push('P51_RESULT_CONTENT_HASH_MISMATCH');
    if (!candidate.proposedRegistry || typeof candidate.proposedRegistry !== 'object' || Array.isArray(candidate.proposedRegistry)) throw new TypeError('P51_PROPOSED_REGISTRY_REQUIRED');
    if (candidate.proposedRegistry.schemaVersion !== 3) blockers.push('P51_PROPOSED_REGISTRY_SCHEMA_MUST_EQUAL_3');
    if (candidate.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P51_PROPOSED_REGISTRY_MODE_INVALID');
    if (candidate.proposedRegistry.activationApplied !== true || candidate.proposedRegistry.canonicalBaselineChanged !== true) blockers.push('P51_PROPOSED_REGISTRY_FUTURE_STATE_INVALID');
    if (!allAuthorityFalse(candidate.proposedRegistry)) blockers.push('P51_PROPOSED_REGISTRY_AUTHORITY_ESCALATION');
    if (sha256Object(candidate.proposedRegistry) !== logicalHash) blockers.push('P51_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH');
    const exactContent = canonicalContent(candidate.proposedRegistry);
    if (candidate.proposedRegistryContent !== exactContent) blockers.push('P51_PROPOSED_REGISTRY_CONTENT_NOT_CANONICAL');
    if (sha256Text(exactContent) !== contentHash) blockers.push('P51_PROPOSED_REGISTRY_CONTENT_HASH_MISMATCH');
    if (candidate.proposedRegistry.freshReactivationGovernanceCycleHashSha256 !== candidate.freshReactivationGovernanceCycleHashSha256) blockers.push('P51_PROPOSED_REGISTRY_CYCLE_HASH_MISMATCH');
    if (candidate.proposedRegistry.freshReviewerLifecycleLockHashSha256 !== candidate.freshReviewerLifecycleLockHashSha256) blockers.push('P51_PROPOSED_REGISTRY_REVIEWER_LOCK_MISMATCH');
    if (candidate.proposedRegistry.freshActivationPlanHashSha256 !== candidate.freshActivationPlanHashSha256) blockers.push('P51_PROPOSED_REGISTRY_ACTIVATION_PLAN_MISMATCH');
    requiredSha256(candidate.currentRegistryHashSha256, 'currentRegistryHashSha256');
    requiredSha256(candidate.freshActivationPlanHashSha256, 'freshActivationPlanHashSha256');
    requiredSha256(candidate.freshReviewerLifecycleLockHashSha256, 'freshReviewerLifecycleLockHashSha256');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function verifyFreshCompositeEvidence({
  candidate,
  currentRegistry,
  observedSourceCommitSha,
  releaseArtifactBytes,
  environmentConfigBytes,
  evidenceId,
  evidenceOperatorRef,
  verifiedAt,
  releaseArtifactRef,
  environmentConfigRef,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const candidateBlockers = validateP51Candidate(candidate);
  if (candidateBlockers.length > 0) return hold(candidateBlockers);

  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED']);
  if (observed.registryHashSha256 !== candidate.currentRegistryHashSha256) return hold(['CURRENT_REGISTRY_HASH_MISMATCH']);

  if (!Buffer.isBuffer(releaseArtifactBytes)) return hold(['RELEASE_ARTIFACT_BYTES_REQUIRED']);
  if (!Buffer.isBuffer(environmentConfigBytes)) return hold(['ENVIRONMENT_CONFIG_BYTES_REQUIRED']);

  let sourceCommit;
  let normalizedEvidenceId;
  let operatorRef;
  let verifiedAtIso;
  let artifactRef;
  let configRef;
  try {
    sourceCommit = requiredCommit(observedSourceCommitSha, 'observedSourceCommitSha');
    normalizedEvidenceId = requiredString(evidenceId, 'evidenceId');
    operatorRef = requiredString(evidenceOperatorRef, 'evidenceOperatorRef');
    verifiedAtIso = iso(verifiedAt, 'verifiedAt');
    artifactRef = requiredString(releaseArtifactRef, 'releaseArtifactRef');
    configRef = requiredString(environmentConfigRef, 'environmentConfigRef');
  } catch (error) {
    return hold([error.message], { candidateRegistryHashSha256: candidate.candidateRegistryHashSha256 });
  }

  const composite = candidate.proposedRegistry.governedCompositeBaseline;
  if (!composite || typeof composite !== 'object' || Array.isArray(composite)) return hold(['FRESH_GOVERNED_COMPOSITE_BASELINE_REQUIRED']);

  const releaseArtifactSha256 = sha256Bytes(releaseArtifactBytes);
  const environmentConfigSha256 = sha256Bytes(environmentConfigBytes);
  const evidenceFailures = [];
  if (sourceCommit !== composite.qualifiedSourceCommitSha) evidenceFailures.push('FRESH_COMPOSITE_SOURCE_COMMIT_MISMATCH');
  if (releaseArtifactSha256 !== composite.releaseArtifactSha256) evidenceFailures.push('FRESH_COMPOSITE_RELEASE_ARTIFACT_HASH_MISMATCH');
  if (environmentConfigSha256 !== composite.environmentConfigSha256) evidenceFailures.push('FRESH_COMPOSITE_ENVIRONMENT_CONFIG_HASH_MISMATCH');
  if (composite.expectedPriorRegistryHashSha256 !== candidate.currentRegistryHashSha256) evidenceFailures.push('FRESH_COMPOSITE_EXPECTED_PRIOR_REGISTRY_MISMATCH');
  if (composite.freshReactivationGovernanceCycleHashSha256 !== candidate.freshReactivationGovernanceCycleHashSha256) evidenceFailures.push('FRESH_COMPOSITE_CYCLE_BINDING_MISMATCH');
  if (composite.freshReviewerLifecycleLockHashSha256 !== candidate.freshReviewerLifecycleLockHashSha256) evidenceFailures.push('FRESH_COMPOSITE_REVIEWER_LOCK_BINDING_MISMATCH');
  if (evidenceFailures.length > 0) return hold(evidenceFailures, {
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    observedSourceCommitSha: sourceCommit,
    computedReleaseArtifactSha256: releaseArtifactSha256,
    computedEnvironmentConfigSha256: environmentConfigSha256,
  });

  const core = {
    schemaVersion: 1,
    evidenceId: normalizedEvidenceId,
    evidenceOperatorRef: operatorRef,
    verifiedAt: verifiedAtIso,
    cycleId: candidate.cycleId,
    freshReactivationGovernanceCycleHashSha256: candidate.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: candidate.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: candidate.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: candidate.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
    currentRegistryHashSha256: candidate.currentRegistryHashSha256,
    observedSourceCommitSha: sourceCommit,
    releaseArtifactRef: artifactRef,
    releaseArtifactSha256,
    environmentConfigRef: configRef,
    environmentConfigSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    freshCompositeEvidenceHashSha256: sha256Object(core),
    candidateEvidenceMatched: true,
    sourceCommitMatched: true,
    releaseArtifactMatched: true,
    environmentConfigMatched: true,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshShadowVerificationRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P52 proves that supplied exact commit identity plus release-artifact and environment-config bytes match the P51 fresh composite candidate while the authoritative registry remains legacy. The result is candidate evidence only and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  candidateCore,
  validateP51Candidate,
  verifyFreshCompositeEvidence,
};
