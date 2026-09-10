'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { validateP51Candidate } = require('./fresh-composite-evidence-verifier');
const { STATUS: P52_STATUS } = require('./fresh-composite-evidence-verifier');

const STATUS = Object.freeze({
  HOLD_FRESH_COMPOSITE_SHADOW: 'HOLD_FRESH_COMPOSITE_SHADOW',
  FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE: 'FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}
function hold(blockers, current = null, candidate = null, evidence = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_COMPOSITE_SHADOW,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeMode: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    candidateRegistryHashSha256: candidate?.candidateRegistryHashSha256 || null,
    freshCompositeEvidenceHashSha256: evidence?.freshCompositeEvidenceHashSha256 || null,
    freshShadowEvaluationHashSha256: null,
    shadowComparisonMatch: false,
    shadowOnly: true,
    candidateOnly: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function evidenceCore(evidence) {
  return {
    schemaVersion: evidence.schemaVersion,
    evidenceId: evidence.evidenceId,
    evidenceOperatorRef: evidence.evidenceOperatorRef,
    verifiedAt: evidence.verifiedAt,
    cycleId: evidence.cycleId,
    freshReactivationGovernanceCycleHashSha256: evidence.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: evidence.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: evidence.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: evidence.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: evidence.candidateRegistryHashSha256,
    candidateRegistryContentSha256: evidence.candidateRegistryContentSha256,
    currentRegistryHashSha256: evidence.currentRegistryHashSha256,
    observedSourceCommitSha: evidence.observedSourceCommitSha,
    releaseArtifactRef: evidence.releaseArtifactRef,
    releaseArtifactSha256: evidence.releaseArtifactSha256,
    environmentConfigRef: evidence.environmentConfigRef,
    environmentConfigSha256: evidence.environmentConfigSha256,
  };
}

function evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate, freshCompositeEvidence } = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, freshCompositeCandidate, freshCompositeEvidence);
  }

  const blockers = [];
  const candidate = freshCompositeCandidate;
  const evidence = freshCompositeEvidence;

  const candidateBlockers = validateP51Candidate(candidate);
  if (candidateBlockers.length > 0) blockers.push(...candidateBlockers);

  if (!evidence || evidence.status !== P52_STATUS.FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE) {
    blockers.push('P52_FRESH_COMPOSITE_EVIDENCE_REQUIRED');
  } else {
    if (
      evidence.verified !== true
      || evidence.candidateEvidenceMatched !== true
      || evidence.sourceCommitMatched !== true
      || evidence.releaseArtifactMatched !== true
      || evidence.environmentConfigMatched !== true
      || evidence.candidateOnly !== true
      || evidence.activeRegistryChanged !== false
      || evidence.activationAuthorized !== false
      || evidence.activationApplied !== false
      || evidence.reactivationAuthorized !== false
      || evidence.currentBaselineMutationPerformed !== false
      || evidence.freshShadowVerificationRequired !== true
      || evidence.freshCutoverRehearsalRequired !== true
      || evidence.freshCutoverSafetyEvidenceRequired !== true
      || evidence.releaseStillBlocked !== true
      || !allAuthorityFalse(evidence)
    ) blockers.push('P52_FRESH_COMPOSITE_EVIDENCE_BOUNDARY_INVALID');

    if (!SHA256_RE.test(evidence.freshCompositeEvidenceHashSha256 || '')) blockers.push('P52_FRESH_COMPOSITE_EVIDENCE_HASH_INVALID');
    else if (sha256Object(evidenceCore(evidence)) !== evidence.freshCompositeEvidenceHashSha256) blockers.push('P52_FRESH_COMPOSITE_EVIDENCE_HASH_MISMATCH');
  }

  if (candidate && evidence) {
    if (candidate.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('FRESH_SHADOW_CURRENT_REGISTRY_CANDIDATE_MISMATCH');
    if (evidence.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('FRESH_SHADOW_CURRENT_REGISTRY_EVIDENCE_MISMATCH');
    if (evidence.cycleId !== candidate.cycleId) blockers.push('FRESH_SHADOW_CYCLE_MISMATCH');
    if (evidence.freshReactivationGovernanceCycleHashSha256 !== candidate.freshReactivationGovernanceCycleHashSha256) blockers.push('FRESH_SHADOW_CYCLE_HASH_MISMATCH');
    if (evidence.freshReviewerLifecycleLockHashSha256 !== candidate.freshReviewerLifecycleLockHashSha256) blockers.push('FRESH_SHADOW_REVIEWER_LOCK_MISMATCH');
    if (evidence.freshActivationPlanHashSha256 !== candidate.freshActivationPlanHashSha256) blockers.push('FRESH_SHADOW_ACTIVATION_PLAN_MISMATCH');
    if (evidence.freshCompositeRegistryCandidateHashSha256 !== candidate.freshCompositeRegistryCandidateHashSha256) blockers.push('FRESH_SHADOW_CANDIDATE_RECORD_HASH_MISMATCH');
    if (evidence.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('FRESH_SHADOW_CANDIDATE_LOGICAL_HASH_MISMATCH');
    if (evidence.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) blockers.push('FRESH_SHADOW_CANDIDATE_CONTENT_HASH_MISMATCH');

    const composite = candidate.proposedRegistry?.governedCompositeBaseline || {};
    if (evidence.observedSourceCommitSha !== composite.qualifiedSourceCommitSha) blockers.push('FRESH_SHADOW_COMMIT_MISMATCH');
    if (evidence.releaseArtifactSha256 !== composite.releaseArtifactSha256) blockers.push('FRESH_SHADOW_RELEASE_ARTIFACT_MISMATCH');
    if (evidence.environmentConfigSha256 !== composite.environmentConfigSha256) blockers.push('FRESH_SHADOW_ENVIRONMENT_CONFIG_MISMATCH');
  }

  if (blockers.length > 0) return hold(blockers, current, candidate, evidence);

  const core = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: candidate.cycleId,
    freshReactivationGovernanceCycleHashSha256: candidate.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: candidate.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: candidate.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: candidate.freshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: evidence.freshCompositeEvidenceHashSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    freshShadowEvaluationHashSha256: sha256Object(core),
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P53 proves the P51 schema-v3 fresh composite candidate and P52 exact-byte evidence are mutually consistent beside the still-authoritative legacy registry. This is shadow comparison only and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  evidenceCore,
  evaluateFreshCompositeShadow,
};
