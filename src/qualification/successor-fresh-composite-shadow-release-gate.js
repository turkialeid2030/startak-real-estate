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
  STATUS: P70_STATUS,
  validateP69Candidate,
} = require('./successor-fresh-composite-evidence-verifier');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW: 'HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW',
  SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE: 'SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
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
function hold(blockers, current = null, candidate = null, evidence = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeMode: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    currentRegistryContentSha256: candidate?.currentRegistryContentSha256 || evidence?.currentRegistryContentSha256 || null,
    candidateRegistryHashSha256: candidate?.candidateRegistryHashSha256 || null,
    candidateRegistryContentSha256: candidate?.candidateRegistryContentSha256 || null,
    successorFreshCompositeEvidenceHashSha256: evidence?.successorFreshCompositeEvidenceHashSha256 || null,
    successorFreshShadowEvaluationHashSha256: null,
    shadowComparisonMatch: false,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function successorEvidenceCore(evidence) {
  return {
    schemaVersion: evidence.schemaVersion,
    evidenceId: evidence.evidenceId,
    evidenceOperatorRef: evidence.evidenceOperatorRef,
    verifiedAt: evidence.verifiedAt,
    cycleId: evidence.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: evidence.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: evidence.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: evidence.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: evidence.successorFreshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: evidence.candidateRegistryHashSha256,
    candidateRegistryContentSha256: evidence.candidateRegistryContentSha256,
    currentRegistryHashSha256: evidence.currentRegistryHashSha256,
    currentRegistryContentSha256: evidence.currentRegistryContentSha256,
    observedSourceCommitSha: evidence.observedSourceCommitSha,
    releaseArtifactRef: evidence.releaseArtifactRef,
    releaseArtifactSha256: evidence.releaseArtifactSha256,
    environmentConfigRef: evidence.environmentConfigRef,
    environmentConfigSha256: evidence.environmentConfigSha256,
    predecessorIncidentCloseoutPacketHashSha256: evidence.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: evidence.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: evidence.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: evidence.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: evidence.predecessorCorrectivePreventiveActionSha256,
  };
}

function evaluateSuccessorFreshCompositeShadow({
  currentRegistry,
  currentRegistryContent,
  successorFreshCompositeCandidate,
  successorFreshCompositeEvidence,
  ...callerOverrides
} = {}) {
  const keyMaterial = findForbiddenKeyMaterial(callerOverrides);
  if (keyMaterial) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${keyMaterial}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const candidate = successorFreshCompositeCandidate;
  const evidence = successorFreshCompositeEvidence;
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, candidate, evidence);
  }
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') {
    return hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED'], current, candidate, evidence);
  }

  const blockers = [];
  let parsedCurrent;
  try {
    parsedCurrent = JSON.parse(currentRegistryContent);
  } catch (_) {
    blockers.push('CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON');
  }
  if (parsedCurrent && stableStringify(parsedCurrent) !== stableStringify(currentRegistry)) {
    blockers.push('CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH');
  }
  const currentContentHash = sha256Text(currentRegistryContent);

  const candidateBlockers = validateP69Candidate(candidate);
  if (candidateBlockers.length > 0) blockers.push(...candidateBlockers);

  if (!evidence || evidence.status !== P70_STATUS.SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE) {
    blockers.push('P70_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_REQUIRED');
  } else {
    if (
      evidence.verified !== true
      || evidence.candidateEvidenceMatched !== true
      || evidence.sourceCommitMatched !== true
      || evidence.releaseArtifactMatched !== true
      || evidence.environmentConfigMatched !== true
      || evidence.candidateRecomputedFromP68 !== true
      || evidence.exactPriorRawRegistryVerified !== true
      || evidence.candidateOnly !== true
      || evidence.activeRegistryChanged !== false
      || evidence.activationAuthorized !== false
      || evidence.activationApplied !== false
      || evidence.reactivationAuthorized !== false
      || evidence.currentBaselineMutationPerformed !== false
      || evidence.successorFreshShadowVerificationRequired !== true
      || evidence.successorFreshCutoverRehearsalRequired !== true
      || evidence.successorFreshCutoverSafetyEvidenceRequired !== true
      || evidence.successorFreshOwnerActivationAuthorizationRequired !== true
      || evidence.successorFreshActivationChangeContractRequired !== true
      || evidence.successorFreshModeVerifierRequired !== true
      || evidence.releaseStillBlocked !== true
      || !allAuthorityFalse(evidence)
    ) blockers.push('P70_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_BOUNDARY_INVALID');

    if (!SHA256_RE.test(evidence.successorFreshCompositeEvidenceHashSha256 || '')) {
      blockers.push('P70_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_HASH_INVALID');
    } else if (sha256Object(successorEvidenceCore(evidence)) !== evidence.successorFreshCompositeEvidenceHashSha256) {
      blockers.push('P70_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_HASH_MISMATCH');
    }
  }

  if (candidate) {
    if (candidate.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CANDIDATE_MISMATCH');
    if (candidate.currentRegistryContentSha256 !== currentContentHash) blockers.push('SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CONTENT_CANDIDATE_MISMATCH');
  }
  if (evidence) {
    if (evidence.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_EVIDENCE_MISMATCH');
    if (evidence.currentRegistryContentSha256 !== currentContentHash) blockers.push('SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CONTENT_EVIDENCE_MISMATCH');
  }

  if (candidate && evidence) {
    if (evidence.cycleId !== candidate.cycleId) blockers.push('SUCCESSOR_FRESH_SHADOW_CYCLE_MISMATCH');
    if (evidence.successorFreshReactivationGovernanceCycleHashSha256 !== candidate.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CYCLE_HASH_MISMATCH');
    if (evidence.successorFreshReviewerLifecycleLockHashSha256 !== candidate.successorFreshReviewerLifecycleLockHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_REVIEWER_LOCK_MISMATCH');
    if (evidence.successorFreshActivationPlanHashSha256 !== candidate.successorFreshActivationPlanHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_ACTIVATION_PLAN_MISMATCH');
    if (evidence.successorFreshCompositeRegistryCandidateHashSha256 !== candidate.successorFreshCompositeRegistryCandidateHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CANDIDATE_RECORD_HASH_MISMATCH');
    if (evidence.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CANDIDATE_LOGICAL_HASH_MISMATCH');
    if (evidence.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_CANDIDATE_CONTENT_HASH_MISMATCH');

    const composite = candidate.proposedRegistry?.governedCompositeBaseline || {};
    if (evidence.observedSourceCommitSha !== composite.qualifiedSourceCommitSha) blockers.push('SUCCESSOR_FRESH_SHADOW_COMMIT_MISMATCH');
    if (evidence.releaseArtifactSha256 !== composite.releaseArtifactSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_RELEASE_ARTIFACT_MISMATCH');
    if (evidence.environmentConfigSha256 !== composite.environmentConfigSha256) blockers.push('SUCCESSOR_FRESH_SHADOW_ENVIRONMENT_CONFIG_MISMATCH');
    for (const field of [
      'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256',
      'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) {
      if (evidence[field] !== composite[field]) blockers.push(`SUCCESSOR_FRESH_SHADOW_${field.toUpperCase()}_MISMATCH`);
    }
  }

  if (blockers.length > 0) return hold(blockers, current, candidate, evidence);

  const core = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: candidate.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: candidate.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: candidate.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: candidate.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: candidate.successorFreshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    currentRegistryContentSha256: currentContentHash,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
    successorFreshCompositeEvidenceHashSha256: evidence.successorFreshCompositeEvidenceHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: evidence.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: evidence.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: evidence.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: evidence.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: evidence.predecessorCorrectivePreventiveActionSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshShadowEvaluationHashSha256: sha256Object(core),
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    exactPriorRawRegistryVerified: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P71 proves the P69 schema-v4 successor fresh composite candidate and P70 exact-byte evidence are mutually consistent beside the exact still-authoritative legacy registry logical and raw-byte state. This is shadow comparison only and grants no activation, reactivation, release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  successorEvidenceCore,
  evaluateSuccessorFreshCompositeShadow,
};
