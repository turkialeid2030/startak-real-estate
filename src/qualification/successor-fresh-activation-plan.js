'use strict';

const crypto = require('crypto');
const { MODE, AUTHORITY, stableStringify } = require('./canonical-baseline-registry');
const { validateP65ReviewPacket } = require('./successor-fresh-review-attestation');
const { STATUS: P67_STATUS } = require('./successor-fresh-reviewer-lifecycle-lock');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN: 'HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN',
  SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED: 'SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PREDECESSOR_REUSE_FIELDS = Object.freeze([
  'predecessorReviewerLifecycleLockHashSha256',
  'predecessorReviewerApprovalHashSha256',
  'predecessorActivationPlanHashSha256',
  'predecessorActivationAuthorizationHashSha256',
  'predecessorSignedOwnerAuthorizationVerificationHashSha256',
  'predecessorCutoverSafetyGuardHashSha256',
  'predecessorActivationChangeContractHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'freshActivationPlanHashSha256',
  'verifiedFreshOwnerAuthorizationRecordHashSha256',
  'freshActivationChangeContractHashSha256',
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
function findForbiddenReuse(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PREDECESSOR_REUSE_FIELDS.includes(key) && child != null) return `${path}.${key}`;
    const nested = findForbiddenReuse(child, `${path}.${key}`, seen);
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
    status: STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    successorFreshActivationPlanHashSha256: null,
    successorFreshBaselineManifestHashSha256: null,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCompositeRegistryCandidateRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function successorReviewerLockCore(lock) {
  return {
    schemaVersion: lock.schemaVersion,
    lockId: lock.lockId,
    lockOperatorRef: lock.lockOperatorRef,
    lockedAt: lock.lockedAt,
    cycleId: lock.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: lock.successorFreshReactivationGovernanceCycleHashSha256,
    reviewRequestId: lock.reviewRequestId,
    successorFreshReviewPacketHashSha256: lock.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: lock.successorFreshReviewerDesignationHashSha256,
    reviewerRef: lock.reviewerRef,
    reviewerDisplayName: lock.reviewerDisplayName,
    successorReviewerRegistryHashSha256: lock.successorReviewerRegistryHashSha256,
    reviewerPublicKeySha256: lock.reviewerPublicKeySha256,
    verifiedSuccessorFreshReviewRecordHashSha256: lock.verifiedSuccessorFreshReviewRecordHashSha256,
    reviewDecisionId: lock.reviewDecisionId,
    reviewEvidenceSha256: lock.reviewEvidenceSha256,
    currentRegistryHashSha256: lock.currentRegistryHashSha256,
    currentRegistryContentSha256: lock.currentRegistryContentSha256,
    qualifiedSourceCommitSha: lock.qualifiedSourceCommitSha,
    releaseArtifactSha256: lock.releaseArtifactSha256,
    environmentConfigSha256: lock.environmentConfigSha256,
    cycleEvidenceArtifactSha256: lock.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: lock.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: lock.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: lock.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: lock.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: lock.predecessorCorrectivePreventiveActionSha256,
  };
}

function validateP67ReviewerLifecycleLock({ packet, reviewerLifecycle } = {}) {
  const blockers = validateP65ReviewPacket(packet);
  if (blockers.length > 0) return blockers;
  if (!reviewerLifecycle || reviewerLifecycle.status !== P67_STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW) {
    return ['P67_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE_LOCK_REQUIRED'];
  }
  if (
    reviewerLifecycle.verified !== true
    || reviewerLifecycle.successorFreshReviewerLifecycleLocked !== true
    || reviewerLifecycle.reviewerReplacementAllowedNow !== false
    || reviewerLifecycle.ownerMayReplaceReviewerBeforeVerifiedReview !== false
    || reviewerLifecycle.acceptedVerifiedReviewFreezesReviewerReplacement !== true
    || reviewerLifecycle.independentReviewCompleted !== true
    || reviewerLifecycle.successorFreshReviewAccepted !== true
    || reviewerLifecycle.p66ReviewRecomputed !== true
    || reviewerLifecycle.reviewerIdentityCryptographicallyVerified !== true
    || reviewerLifecycle.reviewerTrustRootVerified !== true
    || reviewerLifecycle.reviewAttestationSignatureVerified !== true
    || reviewerLifecycle.externalReviewArtifactContentVerifiedHere !== false
    || reviewerLifecycle.predecessorReviewerAuthorityAccepted !== false
    || reviewerLifecycle.predecessorActivationAuthorityAccepted !== false
    || reviewerLifecycle.predecessorReviewerLifecycleLockReusable !== false
    || reviewerLifecycle.predecessorReviewerApprovalReusable !== false
    || reviewerLifecycle.successorFreshActivationPlanRequired !== true
    || reviewerLifecycle.successorFreshShadowEvidenceRequired !== true
    || reviewerLifecycle.successorFreshCutoverRehearsalRequired !== true
    || reviewerLifecycle.successorFreshCutoverSafetyEvidenceRequired !== true
    || reviewerLifecycle.successorFreshOwnerActivationAuthorizationRequired !== true
    || reviewerLifecycle.successorFreshActivationChangeContractRequired !== true
    || reviewerLifecycle.reactivationAuthorized !== false
    || reviewerLifecycle.currentBaselineMutationPerformed !== false
    || reviewerLifecycle.releaseStillBlocked !== true
    || !allAuthorityFalse(reviewerLifecycle)
  ) blockers.push('P67_SUCCESSOR_REVIEWER_LIFECYCLE_BOUNDARY_INVALID');

  try {
    const lockHash = requiredSha256(reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256, 'successorFreshReviewerLifecycleLockHashSha256');
    if (sha256Object(successorReviewerLockCore(reviewerLifecycle)) !== lockHash) blockers.push('P67_SUCCESSOR_REVIEWER_LIFECYCLE_LOCK_HASH_MISMATCH');
    if (reviewerLifecycle.cycleId !== packet.cycleId) blockers.push('P67_LOCK_CYCLE_MISMATCH');
    if (reviewerLifecycle.successorFreshReactivationGovernanceCycleHashSha256 !== packet.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P67_LOCK_SUCCESSOR_CYCLE_HASH_MISMATCH');
    if (reviewerLifecycle.reviewRequestId !== packet.reviewRequestId) blockers.push('P67_LOCK_REVIEW_REQUEST_MISMATCH');
    if (reviewerLifecycle.successorFreshReviewPacketHashSha256 !== packet.successorFreshReviewPacketHashSha256) blockers.push('P67_LOCK_REVIEW_PACKET_MISMATCH');
    if (reviewerLifecycle.successorFreshReviewerDesignationHashSha256 !== packet.successorFreshReviewerDesignationHashSha256) blockers.push('P67_LOCK_DESIGNATION_MISMATCH');
    if (reviewerLifecycle.reviewerRef !== packet.independentReviewerRef) blockers.push('P67_LOCK_REVIEWER_MISMATCH');
    if (reviewerLifecycle.currentRegistryHashSha256 !== packet.currentRegistryHashSha256) blockers.push('P67_LOCK_REGISTRY_HASH_MISMATCH');
    if (reviewerLifecycle.currentRegistryContentSha256 !== packet.currentRegistryContentSha256) blockers.push('P67_LOCK_REGISTRY_CONTENT_HASH_MISMATCH');
    if (reviewerLifecycle.qualifiedSourceCommitSha !== packet.qualifiedSourceCommitSha) blockers.push('P67_LOCK_COMMIT_MISMATCH');
    if (reviewerLifecycle.releaseArtifactSha256 !== packet.releaseArtifactSha256) blockers.push('P67_LOCK_RELEASE_ARTIFACT_MISMATCH');
    if (reviewerLifecycle.environmentConfigSha256 !== packet.environmentConfigSha256) blockers.push('P67_LOCK_ENVIRONMENT_CONFIG_MISMATCH');
    if (reviewerLifecycle.cycleEvidenceArtifactSha256 !== packet.cycleEvidenceArtifactSha256) blockers.push('P67_LOCK_CYCLE_EVIDENCE_MISMATCH');
    for (const field of [
      'predecessorIncidentCloseoutPacketHashSha256', 'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256', 'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) if (reviewerLifecycle[field] !== packet[field]) blockers.push(`P67_LOCK_${field.toUpperCase()}_MISMATCH`);
    requiredSha256(reviewerLifecycle.verifiedSuccessorFreshReviewRecordHashSha256, 'verifiedSuccessorFreshReviewRecordHashSha256');
    requiredSha256(reviewerLifecycle.successorReviewerRegistryHashSha256, 'successorReviewerRegistryHashSha256');
    requiredSha256(reviewerLifecycle.reviewerPublicKeySha256, 'reviewerPublicKeySha256');
    requiredSha256(reviewerLifecycle.reviewEvidenceSha256, 'reviewEvidenceSha256');
    iso(reviewerLifecycle.lockedAt, 'reviewerLifecycle.lockedAt');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function createSuccessorFreshActivationPlan({
  packet,
  reviewerLifecycle,
  activationChangeId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  const forbiddenKey = findForbiddenKeyMaterial(callerOverrides);
  if (forbiddenKey) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbiddenKey}`]);
  const forbiddenReuse = findForbiddenReuse(callerOverrides);
  if (forbiddenReuse) return hold([`PREDECESSOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${forbiddenReuse}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const blockers = validateP67ReviewerLifecycleLock({ packet, reviewerLifecycle });
  if (blockers.length > 0) return hold(blockers);

  let changeId;
  let preparer;
  let preparedAtIso;
  try {
    changeId = requiredString(activationChangeId, 'activationChangeId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], { successorFreshReviewerLifecycleLockHashSha256: reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256 });
  }
  if (preparer !== packet.ownerActorRef) return hold(['SUCCESSOR_FRESH_ACTIVATION_PLAN_MUST_BE_PREPARED_BY_CYCLE_OWNER']);
  if (Date.parse(preparedAtIso) < Date.parse(reviewerLifecycle.lockedAt)) return hold(['SUCCESSOR_FRESH_ACTIVATION_PLAN_PRECEDES_REVIEWER_LIFECYCLE_LOCK']);

  const successorFreshBaselineManifest = deepFreeze({
    schemaVersion: 1,
    baselineId: `successor-fresh-reactivation:${packet.cycleId}`,
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: requiredCommit(packet.qualifiedSourceCommitSha, 'packet.qualifiedSourceCommitSha'),
    releaseArtifactSha256: requiredSha256(packet.releaseArtifactSha256, 'packet.releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(packet.environmentConfigSha256, 'packet.environmentConfigSha256'),
    expectedPriorRegistryHashSha256: requiredSha256(packet.currentRegistryHashSha256, 'packet.currentRegistryHashSha256'),
    expectedPriorRegistryContentSha256: requiredSha256(packet.currentRegistryContentSha256, 'packet.currentRegistryContentSha256'),
    successorFreshReviewPacketHashSha256: requiredSha256(packet.successorFreshReviewPacketHashSha256, 'packet.successorFreshReviewPacketHashSha256'),
    successorFreshReviewerDesignationHashSha256: requiredSha256(packet.successorFreshReviewerDesignationHashSha256, 'packet.successorFreshReviewerDesignationHashSha256'),
    successorFreshReviewerLifecycleLockHashSha256: requiredSha256(reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256, 'reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256'),
    verifiedSuccessorFreshReviewRecordHashSha256: requiredSha256(reviewerLifecycle.verifiedSuccessorFreshReviewRecordHashSha256, 'reviewerLifecycle.verifiedSuccessorFreshReviewRecordHashSha256'),
    cycleEvidenceArtifactSha256: requiredSha256(packet.cycleEvidenceArtifactSha256, 'packet.cycleEvidenceArtifactSha256'),
    predecessorIncidentCloseoutPacketHashSha256: requiredSha256(packet.predecessorIncidentCloseoutPacketHashSha256, 'packet.predecessorIncidentCloseoutPacketHashSha256'),
    predecessorHumanDecisionRecordHashSha256: requiredSha256(packet.predecessorHumanDecisionRecordHashSha256, 'packet.predecessorHumanDecisionRecordHashSha256'),
    predecessorGovernanceResetRecordHashSha256: requiredSha256(packet.predecessorGovernanceResetRecordHashSha256, 'packet.predecessorGovernanceResetRecordHashSha256'),
    predecessorRootCauseAnalysisSha256: requiredSha256(packet.predecessorRootCauseAnalysisSha256, 'packet.predecessorRootCauseAnalysisSha256'),
    predecessorCorrectivePreventiveActionSha256: requiredSha256(packet.predecessorCorrectivePreventiveActionSha256, 'packet.predecessorCorrectivePreventiveActionSha256'),
  });
  const successorFreshBaselineManifestHashSha256 = sha256Object(successorFreshBaselineManifest);

  const core = {
    schemaVersion: 1,
    activationChangeId: changeId,
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    successorFreshReviewerLifecycleLockHashSha256: reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshBaselineManifest,
    successorFreshBaselineManifestHashSha256,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: packet.currentRegistryHashSha256,
      expectedPriorRegistryContentSha256: packet.currentRegistryContentSha256,
      successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
      successorFreshReviewerLifecycleLockHashSha256: reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256,
    },
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshActivationPlanHashSha256: sha256Object(core),
    explicitActivationChangeRequired: true,
    activationAuthorized: false,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorActivationPlanReusable: false,
    predecessorOwnerAuthorizationReusable: false,
    predecessorActivationContractReusable: false,
    successorFreshCompositeRegistryCandidateRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P68 creates a deterministic successor fresh activation plan from the exact P67 reviewer lifecycle lock. It grants no activation or reactivation authority; a new successor composite candidate and the full fresh evidence/safety/owner/contract chain remain mandatory.',
  });
}

module.exports = {
  STATUS,
  FORBIDDEN_PREDECESSOR_REUSE_FIELDS,
  successorReviewerLockCore,
  validateP67ReviewerLifecycleLock,
  createSuccessorFreshActivationPlan,
};
