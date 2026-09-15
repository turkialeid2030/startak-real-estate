'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P50_STATUS } = require('./fresh-reactivation-activation-plan');

const STATUS = Object.freeze({
  HOLD_FRESH_COMPOSITE_REGISTRY_CANDIDATE: 'HOLD_FRESH_COMPOSITE_REGISTRY_CANDIDATE',
  FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE: 'FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PRIOR_REUSE_FIELDS = Object.freeze([
  'priorActivationPlanHashSha256',
  'priorActivationAuthorizationHashSha256',
  'priorSignedOwnerAuthorizationVerificationHashSha256',
  'priorCutoverSafetyGuardHashSha256',
  'priorActivationChangeContractHashSha256',
  'reviewerLockHashSha256',
  'activationPlanHashSha256',
  'activationAuthorizationHashSha256',
  'signedOwnerAuthorizationVerificationHashSha256',
  'cutoverSafetyGuardHashSha256',
  'activationChangeContractHashSha256',
]);

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
function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
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
    status: STATUS.HOLD_FRESH_COMPOSITE_REGISTRY_CANDIDATE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    candidateOnly: true,
    candidateRegistryHashSha256: null,
    candidateRegistryContentSha256: null,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshCompositeEvidenceVerificationRequired: true,
    freshShadowVerificationRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function freshManifestCore(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    baselineId: manifest.baselineId,
    baselineType: manifest.baselineType,
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
    releaseArtifactSha256: manifest.releaseArtifactSha256,
    environmentConfigSha256: manifest.environmentConfigSha256,
    expectedPriorRegistryHashSha256: manifest.expectedPriorRegistryHashSha256,
    reviewPacketHashSha256: manifest.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: manifest.freshReviewerDesignationHashSha256,
    freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    verifiedFreshReviewRecordHashSha256: manifest.verifiedFreshReviewRecordHashSha256,
  };
}

function p50PlanCore(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    activationChangeId: plan.activationChangeId,
    cycleId: plan.cycleId,
    freshReactivationGovernanceCycleHashSha256: plan.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: plan.preparedByRef,
    preparedAt: plan.preparedAt,
    freshReviewerLifecycleLockHashSha256: plan.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest: plan.freshSuccessorBaselineManifest,
    freshSuccessorBaselineManifestHashSha256: plan.freshSuccessorBaselineManifestHashSha256,
    targetActivationContract: plan.targetActivationContract,
  };
}

function validateFreshActivationPlan(plan) {
  const blockers = [];
  if (!plan || plan.status !== P50_STATUS.FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED) {
    return ['P50_FRESH_ACTIVATION_PLAN_REQUIRED'];
  }
  if (
    plan.verified !== true
    || plan.explicitActivationChangeRequired !== true
    || plan.activationAuthorized !== false
    || plan.activationApplied !== false
    || plan.automaticBaselineSwitchAllowed !== false
    || plan.reactivationAuthorized !== false
    || plan.currentBaselineMutationPerformed !== false
    || plan.priorActivationPlanReusable !== false
    || plan.priorOwnerAuthorizationReusable !== false
    || plan.priorActivationContractReusable !== false
    || plan.freshShadowEvidenceRequired !== true
    || plan.freshCutoverRehearsalRequired !== true
    || plan.freshCutoverSafetyEvidenceRequired !== true
    || plan.freshOwnerActivationAuthorizationRequired !== true
    || plan.freshActivationChangeContractRequired !== true
    || plan.postChangeReleaseVerifyRequired !== true
    || plan.releaseStillBlocked !== true
    || !allAuthorityFalse(plan)
  ) blockers.push('P50_FRESH_ACTIVATION_PLAN_BOUNDARY_INVALID');

  try {
    const manifest = plan.freshSuccessorBaselineManifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('P50_FRESH_SUCCESSOR_MANIFEST_REQUIRED');
    const manifestHash = requiredSha256(plan.freshSuccessorBaselineManifestHashSha256, 'freshSuccessorBaselineManifestHashSha256');
    if (sha256Object(freshManifestCore(manifest)) !== manifestHash) blockers.push('P50_FRESH_SUCCESSOR_MANIFEST_HASH_MISMATCH');
    const planHash = requiredSha256(plan.freshActivationPlanHashSha256, 'freshActivationPlanHashSha256');
    if (sha256Object(p50PlanCore(plan)) !== planHash) blockers.push('P50_FRESH_ACTIVATION_PLAN_HASH_MISMATCH');
    if (manifest.cycleId !== plan.cycleId) blockers.push('P50_MANIFEST_CYCLE_MISMATCH');
    if (manifest.freshReactivationGovernanceCycleHashSha256 !== plan.freshReactivationGovernanceCycleHashSha256) blockers.push('P50_MANIFEST_CYCLE_HASH_MISMATCH');
    if (manifest.freshReviewerLifecycleLockHashSha256 !== plan.freshReviewerLifecycleLockHashSha256) blockers.push('P50_MANIFEST_REVIEWER_LOCK_MISMATCH');
    requiredCommit(manifest.qualifiedSourceCommitSha, 'manifest.qualifiedSourceCommitSha');
    requiredSha256(manifest.releaseArtifactSha256, 'manifest.releaseArtifactSha256');
    requiredSha256(manifest.environmentConfigSha256, 'manifest.environmentConfigSha256');
    requiredSha256(manifest.expectedPriorRegistryHashSha256, 'manifest.expectedPriorRegistryHashSha256');
    if (!plan.targetActivationContract || plan.targetActivationContract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || plan.targetActivationContract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
      blockers.push('P50_TARGET_ACTIVATION_CONTRACT_MODE_INVALID');
    }
    if (plan.targetActivationContract.expectedPriorRegistryHashSha256 !== manifest.expectedPriorRegistryHashSha256) blockers.push('P50_TARGET_PRIOR_REGISTRY_HASH_MISMATCH');
    if (plan.targetActivationContract.freshReactivationGovernanceCycleHashSha256 !== plan.freshReactivationGovernanceCycleHashSha256) blockers.push('P50_TARGET_CYCLE_HASH_MISMATCH');
    if (plan.targetActivationContract.freshReviewerLifecycleLockHashSha256 !== plan.freshReviewerLifecycleLockHashSha256) blockers.push('P50_TARGET_REVIEWER_LOCK_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function createFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, ...callerOverrides } = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  for (const field of FORBIDDEN_PRIOR_REUSE_FIELDS) {
    if (callerOverrides[field] != null) return hold([`PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${field}`]);
  }

  const planBlockers = validateFreshActivationPlan(activationPlan);
  if (planBlockers.length > 0) return hold(planBlockers);

  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED']);
  }
  const manifest = activationPlan.freshSuccessorBaselineManifest;
  if (observed.registryHashSha256 !== manifest.expectedPriorRegistryHashSha256) {
    return hold(['CURRENT_REGISTRY_HASH_DOES_NOT_MATCH_P50_EXPECTED_PRIOR']);
  }

  const governedCompositeBaseline = deepFreeze({
    baselineId: manifest.baselineId,
    baselineType: manifest.baselineType,
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
    releaseArtifactSha256: manifest.releaseArtifactSha256,
    environmentConfigSha256: manifest.environmentConfigSha256,
    expectedPriorRegistryHashSha256: manifest.expectedPriorRegistryHashSha256,
    reviewPacketHashSha256: manifest.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: manifest.freshReviewerDesignationHashSha256,
    freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    verifiedFreshReviewRecordHashSha256: manifest.verifiedFreshReviewRecordHashSha256,
    freshSuccessorBaselineManifestHashSha256: activationPlan.freshSuccessorBaselineManifestHashSha256,
  });

  const proposedRegistry = deepFreeze({
    schemaVersion: 3,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: JSON.parse(JSON.stringify(currentRegistry.legacyBaseline)),
    governedCompositeBaseline,
    freshReactivationGovernanceCycleHashSha256: activationPlan.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: activationPlan.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: activationPlan.freshActivationPlanHashSha256,
    activationApplied: true,
    canonicalBaselineChanged: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
  });
  const proposedRegistryContent = canonicalContent(proposedRegistry);

  const core = {
    schemaVersion: 1,
    cycleId: activationPlan.cycleId,
    freshReactivationGovernanceCycleHashSha256: activationPlan.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: activationPlan.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: activationPlan.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: activationPlan.freshSuccessorBaselineManifestHashSha256,
    currentRegistryHashSha256: observed.registryHashSha256,
    targetPath: activationPlan.targetActivationContract.targetPath,
    proposedRegistryHashSha256: sha256Object(proposedRegistry),
    proposedRegistryContentSha256: sha256Text(proposedRegistryContent),
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    freshCompositeRegistryCandidateHashSha256: sha256Object(core),
    proposedRegistry,
    proposedRegistryContent,
    candidateRegistryHashSha256: core.proposedRegistryHashSha256,
    candidateRegistryContentSha256: core.proposedRegistryContentSha256,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshCompositeEvidenceVerificationRequired: true,
    freshShadowVerificationRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P51 prepares a schema-v3 fresh governed-composite registry candidate bound to the P50 fresh activation plan while the actual registry remains the exact legacy baseline. The schema change is intentionally not accepted by the existing active-registry verifier until a later explicit fresh-mode verifier/change is reviewed. No activation or release authority is granted.',
  });
}

module.exports = {
  STATUS,
  FORBIDDEN_PRIOR_REUSE_FIELDS,
  freshManifestCore,
  p50PlanCore,
  validateFreshActivationPlan,
  createFreshCompositeRegistryCandidate,
};
