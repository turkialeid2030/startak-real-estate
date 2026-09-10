'use strict';

const crypto = require('crypto');
const { MODE, stableStringify } = require('./canonical-baseline-registry');
const { validateP47ReviewPacket } = require('./fresh-reactivation-review-attestation');
const { STATUS: P49_STATUS } = require('./fresh-reactivation-reviewer-lifecycle-lock');

const STATUS = Object.freeze({
  HOLD_FRESH_REACTIVATION_ACTIVATION_PLAN: 'HOLD_FRESH_REACTIVATION_ACTIVATION_PLAN',
  FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED: 'FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PRIOR_REUSE_FIELDS = Object.freeze([
  'priorReviewerLockHashSha256',
  'priorReviewerApprovalHashSha256',
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

function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

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
    status: STATUS.HOLD_FRESH_REACTIVATION_ACTIVATION_PLAN,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    freshActivationPlanHashSha256: null,
    freshSuccessorBaselineManifestHashSha256: null,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshShadowEvidenceRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function reviewerLockCore(lock) {
  return {
    schemaVersion: lock.schemaVersion,
    lockId: lock.lockId,
    lockOperatorRef: lock.lockOperatorRef,
    lockedAt: lock.lockedAt,
    cycleId: lock.cycleId,
    freshReactivationGovernanceCycleHashSha256: lock.freshReactivationGovernanceCycleHashSha256,
    reviewRequestId: lock.reviewRequestId,
    reviewPacketHashSha256: lock.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: lock.freshReviewerDesignationHashSha256,
    reviewerRef: lock.reviewerRef,
    reviewerDisplayName: lock.reviewerDisplayName,
    reviewerRegistryHashSha256: lock.reviewerRegistryHashSha256,
    reviewerPublicKeySha256: lock.reviewerPublicKeySha256,
    verifiedFreshReviewRecordHashSha256: lock.verifiedFreshReviewRecordHashSha256,
    reviewDecisionId: lock.reviewDecisionId,
    reviewEvidenceSha256: lock.reviewEvidenceSha256,
    currentRegistryHashSha256: lock.currentRegistryHashSha256,
    qualifiedSourceCommitSha: lock.qualifiedSourceCommitSha,
    releaseArtifactSha256: lock.releaseArtifactSha256,
    environmentConfigSha256: lock.environmentConfigSha256,
  };
}

function validateP49ReviewerLifecycleLock({ packet, reviewerLifecycle } = {}) {
  const blockers = validateP47ReviewPacket(packet);
  if (blockers.length > 0) return blockers;
  if (!reviewerLifecycle || reviewerLifecycle.status !== P49_STATUS.FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW) {
    return ['P49_FRESH_REVIEWER_LIFECYCLE_LOCK_REQUIRED'];
  }
  if (
    reviewerLifecycle.verified !== true
    || reviewerLifecycle.freshReviewerLifecycleLocked !== true
    || reviewerLifecycle.reviewerReplacementAllowedNow !== false
    || reviewerLifecycle.ownerMayReplaceReviewerBeforeVerifiedReview !== false
    || reviewerLifecycle.acceptedVerifiedReviewFreezesReviewerReplacement !== true
    || reviewerLifecycle.independentReviewCompleted !== true
    || reviewerLifecycle.freshReviewAccepted !== true
    || reviewerLifecycle.reviewerIdentityCryptographicallyVerified !== true
    || reviewerLifecycle.reviewerTrustRootVerified !== true
    || reviewerLifecycle.reviewAttestationSignatureVerified !== true
    || reviewerLifecycle.externalReviewArtifactContentVerifiedHere !== false
    || reviewerLifecycle.priorReviewerLifecycleLockReusable !== false
    || reviewerLifecycle.priorReviewerApprovalReusable !== false
    || reviewerLifecycle.freshActivationPlanRequired !== true
    || reviewerLifecycle.reactivationAuthorized !== false
    || reviewerLifecycle.currentBaselineMutationPerformed !== false
    || reviewerLifecycle.releaseStillBlocked !== true
    || !allAuthorityFalse(reviewerLifecycle)
  ) blockers.push('P49_REVIEWER_LIFECYCLE_BOUNDARY_INVALID');

  try {
    const lockHash = requiredSha256(reviewerLifecycle.freshReviewerLifecycleLockHashSha256, 'freshReviewerLifecycleLockHashSha256');
    if (sha256Object(reviewerLockCore(reviewerLifecycle)) !== lockHash) blockers.push('P49_REVIEWER_LIFECYCLE_LOCK_HASH_MISMATCH');
    if (reviewerLifecycle.cycleId !== packet.cycleId) blockers.push('P49_LOCK_CYCLE_MISMATCH');
    if (reviewerLifecycle.freshReactivationGovernanceCycleHashSha256 !== packet.freshReactivationGovernanceCycleHashSha256) blockers.push('P49_LOCK_FRESH_CYCLE_HASH_MISMATCH');
    if (reviewerLifecycle.reviewRequestId !== packet.reviewRequestId) blockers.push('P49_LOCK_REVIEW_REQUEST_MISMATCH');
    if (reviewerLifecycle.reviewPacketHashSha256 !== packet.reviewPacketHashSha256) blockers.push('P49_LOCK_REVIEW_PACKET_MISMATCH');
    if (reviewerLifecycle.freshReviewerDesignationHashSha256 !== packet.freshReviewerDesignationHashSha256) blockers.push('P49_LOCK_DESIGNATION_MISMATCH');
    if (reviewerLifecycle.reviewerRef !== packet.independentReviewerRef) blockers.push('P49_LOCK_REVIEWER_MISMATCH');
    if (reviewerLifecycle.currentRegistryHashSha256 !== packet.currentRegistryHashSha256) blockers.push('P49_LOCK_REGISTRY_MISMATCH');
    if (reviewerLifecycle.qualifiedSourceCommitSha !== packet.qualifiedSourceCommitSha) blockers.push('P49_LOCK_COMMIT_MISMATCH');
    if (reviewerLifecycle.releaseArtifactSha256 !== packet.releaseArtifactSha256) blockers.push('P49_LOCK_RELEASE_ARTIFACT_MISMATCH');
    if (reviewerLifecycle.environmentConfigSha256 !== packet.environmentConfigSha256) blockers.push('P49_LOCK_ENVIRONMENT_CONFIG_MISMATCH');
    requiredSha256(reviewerLifecycle.verifiedFreshReviewRecordHashSha256, 'verifiedFreshReviewRecordHashSha256');
    requiredSha256(reviewerLifecycle.reviewerRegistryHashSha256, 'reviewerRegistryHashSha256');
    requiredSha256(reviewerLifecycle.reviewerPublicKeySha256, 'reviewerPublicKeySha256');
    requiredSha256(reviewerLifecycle.reviewEvidenceSha256, 'reviewEvidenceSha256');
    iso(reviewerLifecycle.lockedAt, 'reviewerLifecycle.lockedAt');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function createFreshReactivationActivationPlan({
  packet,
  reviewerLifecycle,
  activationChangeId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  for (const field of FORBIDDEN_PRIOR_REUSE_FIELDS) {
    if (callerOverrides[field] != null) return hold([`PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${field}`]);
  }

  const blockers = validateP49ReviewerLifecycleLock({ packet, reviewerLifecycle });
  if (blockers.length > 0) return hold(blockers);

  let changeId;
  let preparer;
  let preparedAtIso;
  try {
    changeId = requiredString(activationChangeId, 'activationChangeId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], { freshReviewerLifecycleLockHashSha256: reviewerLifecycle.freshReviewerLifecycleLockHashSha256 });
  }
  if (preparer !== packet.ownerActorRef) return hold(['FRESH_ACTIVATION_PLAN_MUST_BE_PREPARED_BY_CYCLE_OWNER']);
  if (Date.parse(preparedAtIso) < Date.parse(reviewerLifecycle.lockedAt)) return hold(['FRESH_ACTIVATION_PLAN_PRECEDES_REVIEWER_LIFECYCLE_LOCK']);

  const freshSuccessorBaselineManifest = deepFreeze({
    schemaVersion: 1,
    baselineId: `fresh-reactivation:${packet.cycleId}`,
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: requiredCommit(packet.qualifiedSourceCommitSha, 'packet.qualifiedSourceCommitSha'),
    releaseArtifactSha256: requiredSha256(packet.releaseArtifactSha256, 'packet.releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(packet.environmentConfigSha256, 'packet.environmentConfigSha256'),
    expectedPriorRegistryHashSha256: requiredSha256(packet.currentRegistryHashSha256, 'packet.currentRegistryHashSha256'),
    reviewPacketHashSha256: requiredSha256(packet.reviewPacketHashSha256, 'packet.reviewPacketHashSha256'),
    freshReviewerDesignationHashSha256: requiredSha256(packet.freshReviewerDesignationHashSha256, 'packet.freshReviewerDesignationHashSha256'),
    freshReviewerLifecycleLockHashSha256: requiredSha256(reviewerLifecycle.freshReviewerLifecycleLockHashSha256, 'reviewerLifecycle.freshReviewerLifecycleLockHashSha256'),
    verifiedFreshReviewRecordHashSha256: requiredSha256(reviewerLifecycle.verifiedFreshReviewRecordHashSha256, 'reviewerLifecycle.verifiedFreshReviewRecordHashSha256'),
  });
  const freshSuccessorBaselineManifestHashSha256 = sha256Object(freshSuccessorBaselineManifest);

  const core = {
    schemaVersion: 1,
    activationChangeId: changeId,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    freshReviewerLifecycleLockHashSha256: reviewerLifecycle.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest,
    freshSuccessorBaselineManifestHashSha256,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: packet.currentRegistryHashSha256,
      freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
      freshReviewerLifecycleLockHashSha256: reviewerLifecycle.freshReviewerLifecycleLockHashSha256,
    },
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    freshActivationPlanHashSha256: sha256Object(core),
    explicitActivationChangeRequired: true,
    activationAuthorized: false,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    priorActivationPlanReusable: false,
    priorOwnerAuthorizationReusable: false,
    priorActivationContractReusable: false,
    freshShadowEvidenceRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P50 creates a deterministic fresh activation plan from the P49 cycle-specific reviewer lock. It does not activate the governed-composite baseline or authorize reactivation. Fresh shadow evidence, rehearsal, cutover safety, owner authorization and an explicit activation change contract remain mandatory.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  FORBIDDEN_PRIOR_REUSE_FIELDS,
  reviewerLockCore,
  validateP49ReviewerLifecycleLock,
  createFreshReactivationActivationPlan,
};
