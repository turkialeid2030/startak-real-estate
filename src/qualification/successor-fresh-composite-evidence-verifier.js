'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P69_STATUS,
  createSuccessorFreshCompositeRegistryCandidate,
} = require('./successor-fresh-composite-registry-candidate');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE: 'HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE',
  SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE: 'SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function requiredSha256(value, field) {
  const valueNormalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(valueNormalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return valueNormalized;
}
function requiredCommit(value, field) {
  const valueNormalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(valueNormalized)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return valueNormalized;
}
function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function canonicalContent(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}
function findForbiddenKeyMaterial(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key)) return `${path}.${key}`;
    const nested = findForbiddenKeyMaterial(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
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
    status: STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    candidateEvidenceMatched: false,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshShadowVerificationRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function candidateCore(candidate) {
  return {
    schemaVersion: candidate.schemaVersion,
    cycleId: candidate.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: candidate.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: candidate.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: candidate.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: candidate.successorFreshBaselineManifestHashSha256,
    currentRegistryHashSha256: candidate.currentRegistryHashSha256,
    currentRegistryContentSha256: candidate.currentRegistryContentSha256,
    targetPath: candidate.targetPath,
    proposedRegistrySchemaVersion: candidate.proposedRegistrySchemaVersion,
    proposedRegistryHashSha256: candidate.proposedRegistryHashSha256,
    proposedRegistryContentSha256: candidate.proposedRegistryContentSha256,
  };
}

function validateP69Candidate(candidate) {
  const blockers = [];
  if (!candidate || candidate.status !== P69_STATUS.SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE) return ['P69_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_REQUIRED'];
  if (
    candidate.verified !== true
    || candidate.candidateOnly !== true
    || candidate.activeRegistryChanged !== false
    || candidate.activationAuthorized !== false
    || candidate.activationApplied !== false
    || candidate.reactivationAuthorized !== false
    || candidate.currentBaselineMutationPerformed !== false
    || candidate.predecessorFreshCompositeCandidateReusable !== false
    || candidate.successorFreshCompositeEvidenceVerificationRequired !== true
    || candidate.successorFreshShadowVerificationRequired !== true
    || candidate.successorFreshCutoverRehearsalRequired !== true
    || candidate.successorFreshCutoverSafetyEvidenceRequired !== true
    || candidate.successorFreshOwnerActivationAuthorizationRequired !== true
    || candidate.successorFreshActivationChangeContractRequired !== true
    || candidate.successorFreshModeVerifierRequired !== true
    || candidate.releaseStillBlocked !== true
    || !allAuthorityFalse(candidate)
  ) blockers.push('P69_SUCCESSOR_FRESH_CANDIDATE_BOUNDARY_INVALID');
  try {
    const candidateHash = requiredSha256(candidate.successorFreshCompositeRegistryCandidateHashSha256, 'successorFreshCompositeRegistryCandidateHashSha256');
    if (sha256Object(candidateCore(candidate)) !== candidateHash) blockers.push('P69_SUCCESSOR_FRESH_CANDIDATE_RECORD_HASH_MISMATCH');
    const logicalHash = requiredSha256(candidate.candidateRegistryHashSha256, 'candidateRegistryHashSha256');
    const contentHash = requiredSha256(candidate.candidateRegistryContentSha256, 'candidateRegistryContentSha256');
    if (candidate.proposedRegistryHashSha256 !== logicalHash) blockers.push('P69_RESULT_LOGICAL_HASH_MISMATCH');
    if (candidate.proposedRegistryContentSha256 !== contentHash) blockers.push('P69_RESULT_CONTENT_HASH_MISMATCH');
    if (!candidate.proposedRegistry || typeof candidate.proposedRegistry !== 'object' || Array.isArray(candidate.proposedRegistry)) throw new TypeError('P69_PROPOSED_REGISTRY_REQUIRED');
    if (candidate.proposedRegistrySchemaVersion !== 4 || candidate.proposedRegistry.schemaVersion !== 4) blockers.push('P69_PROPOSED_REGISTRY_SCHEMA_MUST_EQUAL_4');
    if (candidate.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P69_PROPOSED_REGISTRY_MODE_INVALID');
    if (candidate.proposedRegistry.activationApplied !== true || candidate.proposedRegistry.canonicalBaselineChanged !== true) blockers.push('P69_PROPOSED_REGISTRY_FUTURE_STATE_INVALID');
    if (!allAuthorityFalse(candidate.proposedRegistry)) blockers.push('P69_PROPOSED_REGISTRY_AUTHORITY_ESCALATION');
    if (sha256Object(candidate.proposedRegistry) !== logicalHash) blockers.push('P69_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH');
    const exactContent = canonicalContent(candidate.proposedRegistry);
    if (candidate.proposedRegistryContent !== exactContent) blockers.push('P69_PROPOSED_REGISTRY_CONTENT_NOT_CANONICAL');
    if (sha256Text(exactContent) !== contentHash) blockers.push('P69_PROPOSED_REGISTRY_CONTENT_HASH_MISMATCH');
    if (candidate.proposedRegistry.successorFreshReactivationGovernanceCycleHashSha256 !== candidate.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P69_PROPOSED_REGISTRY_CYCLE_HASH_MISMATCH');
    if (candidate.proposedRegistry.successorFreshReviewerLifecycleLockHashSha256 !== candidate.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P69_PROPOSED_REGISTRY_REVIEWER_LOCK_MISMATCH');
    if (candidate.proposedRegistry.successorFreshActivationPlanHashSha256 !== candidate.successorFreshActivationPlanHashSha256) blockers.push('P69_PROPOSED_REGISTRY_ACTIVATION_PLAN_MISMATCH');
    for (const field of ['currentRegistryHashSha256', 'currentRegistryContentSha256', 'successorFreshActivationPlanHashSha256', 'successorFreshReviewerLifecycleLockHashSha256', 'successorFreshBaselineManifestHashSha256']) requiredSha256(candidate[field], field);
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function verifySuccessorFreshCompositeEvidence({
  candidate,
  activationPlan,
  currentRegistry,
  currentRegistryContent,
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
  const keyMaterial = findForbiddenKeyMaterial(callerOverrides);
  if (keyMaterial) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${keyMaterial}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const candidateBlockers = validateP69Candidate(candidate);
  if (candidateBlockers.length > 0) return hold(candidateBlockers);
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') return hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED']);

  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED']);
  const observedContentHash = sha256Text(currentRegistryContent);
  if (observed.registryHashSha256 !== candidate.currentRegistryHashSha256) return hold(['CURRENT_REGISTRY_HASH_MISMATCH']);
  if (observedContentHash !== candidate.currentRegistryContentSha256) return hold(['CURRENT_REGISTRY_CONTENT_HASH_MISMATCH']);
  let parsedCurrent;
  try { parsedCurrent = JSON.parse(currentRegistryContent); } catch (_) { return hold(['CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON']); }
  if (stableStringify(parsedCurrent) !== stableStringify(currentRegistry)) return hold(['CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH']);

  if (!activationPlan || typeof activationPlan !== 'object') return hold(['P68_ACTIVATION_PLAN_REQUIRED_FOR_RECOMPUTATION']);
  const recomputedCandidate = createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, currentRegistryContent });
  if (recomputedCandidate.status !== P69_STATUS.SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE || recomputedCandidate.verified !== true) return hold(['P69_CANDIDATE_RECOMPUTATION_FAILED']);
  if (recomputedCandidate.successorFreshCompositeRegistryCandidateHashSha256 !== candidate.successorFreshCompositeRegistryCandidateHashSha256) return hold(['P69_CANDIDATE_RECOMPUTATION_HASH_MISMATCH']);
  if (recomputedCandidate.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256 || recomputedCandidate.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) return hold(['P69_CANDIDATE_RECOMPUTATION_REGISTRY_MISMATCH']);

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
  if (!composite || typeof composite !== 'object' || Array.isArray(composite)) return hold(['SUCCESSOR_FRESH_GOVERNED_COMPOSITE_BASELINE_REQUIRED']);
  const releaseArtifactSha256 = sha256Bytes(releaseArtifactBytes);
  const environmentConfigSha256 = sha256Bytes(environmentConfigBytes);
  const failures = [];
  if (sourceCommit !== composite.qualifiedSourceCommitSha) failures.push('SUCCESSOR_FRESH_COMPOSITE_SOURCE_COMMIT_MISMATCH');
  if (releaseArtifactSha256 !== composite.releaseArtifactSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_RELEASE_ARTIFACT_HASH_MISMATCH');
  if (environmentConfigSha256 !== composite.environmentConfigSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_ENVIRONMENT_CONFIG_HASH_MISMATCH');
  if (composite.expectedPriorRegistryHashSha256 !== candidate.currentRegistryHashSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_EXPECTED_PRIOR_REGISTRY_MISMATCH');
  if (composite.expectedPriorRegistryContentSha256 !== candidate.currentRegistryContentSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_EXPECTED_PRIOR_CONTENT_MISMATCH');
  if (composite.successorFreshReactivationGovernanceCycleHashSha256 !== candidate.successorFreshReactivationGovernanceCycleHashSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_CYCLE_BINDING_MISMATCH');
  if (composite.successorFreshReviewerLifecycleLockHashSha256 !== candidate.successorFreshReviewerLifecycleLockHashSha256) failures.push('SUCCESSOR_FRESH_COMPOSITE_REVIEWER_LOCK_BINDING_MISMATCH');
  if (failures.length > 0) return hold(failures, {
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
    successorFreshReactivationGovernanceCycleHashSha256: candidate.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: candidate.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: candidate.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: candidate.successorFreshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
    currentRegistryHashSha256: candidate.currentRegistryHashSha256,
    currentRegistryContentSha256: candidate.currentRegistryContentSha256,
    observedSourceCommitSha: sourceCommit,
    releaseArtifactRef: artifactRef,
    releaseArtifactSha256,
    environmentConfigRef: configRef,
    environmentConfigSha256,
    predecessorIncidentCloseoutPacketHashSha256: composite.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: composite.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: composite.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: composite.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: composite.predecessorCorrectivePreventiveActionSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshCompositeEvidenceHashSha256: sha256Object(core),
    candidateEvidenceMatched: true,
    sourceCommitMatched: true,
    releaseArtifactMatched: true,
    environmentConfigMatched: true,
    candidateRecomputedFromP68: true,
    exactPriorRawRegistryVerified: true,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshShadowVerificationRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P70 proves exact source-commit identity plus release-artifact and environment-config bytes against the recomputed P69 successor candidate while the authoritative registry remains the exact legacy logical and raw-byte state. This is candidate evidence only and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  candidateCore,
  validateP69Candidate,
  verifySuccessorFreshCompositeEvidence,
};
