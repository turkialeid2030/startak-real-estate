'use strict';

const crypto = require('crypto');
const { stableStringify } = require('./canonical-baseline-registry');
const {
  DECISION: P48_DECISION,
  STATUS: P48_STATUS,
  validateP47ReviewPacket,
} = require('./fresh-reactivation-review-attestation');

const STATUS = Object.freeze({
  HOLD_FRESH_REACTIVATION_REVIEWER_LIFECYCLE: 'HOLD_FRESH_REACTIVATION_REVIEWER_LIFECYCLE',
  FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW: 'FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
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
    || (value.reactivationAllowed != null && value.reactivationAllowed !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_REACTIVATION_REVIEWER_LIFECYCLE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    freshReviewerLifecycleLocked: false,
    reviewerReplacementAllowedNow: false,
    ownerMayReplaceReviewerBeforeVerifiedReview: false,
    independentReviewCompleted: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    freshActivationPlanRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function verifiedReviewRecordCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    purpose: record.purpose,
    reviewRequestId: record.reviewRequestId,
    reviewPacketHashSha256: record.reviewPacketHashSha256,
    cycleId: record.cycleId,
    freshReactivationGovernanceCycleHashSha256: record.freshReactivationGovernanceCycleHashSha256,
    freshReviewerDesignationHashSha256: record.freshReviewerDesignationHashSha256,
    reviewerRegistryHashSha256: record.reviewerRegistryHashSha256,
    reviewerId: record.reviewerId,
    reviewerSubjectRef: record.reviewerSubjectRef,
    reviewerPublicKeySha256: record.reviewerPublicKeySha256,
    decisionId: record.decisionId,
    decision: record.decision,
    decisionSourceRef: record.decisionSourceRef,
    decisionArtifactSha256: record.decisionArtifactSha256,
    reviewEvidenceRef: record.reviewEvidenceRef,
    reviewEvidenceSha256: record.reviewEvidenceSha256,
    decidedAt: record.decidedAt,
    rationaleRef: record.rationaleRef,
    signingPayloadHashSha256: record.signingPayloadHashSha256,
  };
}

function validateApprovedP48Review({ packet, verifiedReview } = {}) {
  const blockers = validateP47ReviewPacket(packet);
  if (blockers.length > 0) return blockers;

  if (!verifiedReview || verifiedReview.status !== P48_STATUS.FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED) {
    return ['P48_APPROVED_CRYPTOGRAPHICALLY_VERIFIED_REVIEW_REQUIRED'];
  }
  if (
    verifiedReview.verified !== true
    || verifiedReview.freshReviewAccepted !== true
    || verifiedReview.freshReviewRejected !== false
    || verifiedReview.cycleBlockedByReview !== false
    || verifiedReview.reviewerIdentityCryptographicallyVerified !== true
    || verifiedReview.reviewerTrustRootVerified !== true
    || verifiedReview.reviewAttestationSignatureVerified !== true
    || verifiedReview.externalReviewArtifactContentVerifiedHere !== false
    || verifiedReview.freshReviewerLifecycleLockRequired !== true
    || verifiedReview.freshActivationPlanRequired !== true
    || verifiedReview.reactivationAuthorized !== false
    || verifiedReview.currentBaselineMutationPerformed !== false
    || verifiedReview.releaseStillBlocked !== true
    || !allAuthorityFalse(verifiedReview)
  ) blockers.push('P48_APPROVED_REVIEW_BOUNDARY_INVALID');

  if (verifiedReview.reviewPacketHashSha256 !== packet.reviewPacketHashSha256) blockers.push('P48_REVIEW_PACKET_BINDING_MISMATCH');

  const record = verifiedReview.verifiedReviewRecord;
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [...blockers, 'P48_VERIFIED_REVIEW_RECORD_REQUIRED'];

  try {
    const recordHash = requiredSha256(record.verifiedFreshReviewRecordHashSha256, 'verifiedFreshReviewRecordHashSha256');
    if (sha256Object(verifiedReviewRecordCore(record)) !== recordHash) blockers.push('P48_VERIFIED_REVIEW_RECORD_HASH_MISMATCH');
    if (verifiedReview.verifiedFreshReviewRecordHashSha256 !== recordHash) blockers.push('P48_RESULT_REVIEW_RECORD_HASH_MISMATCH');
    if (record.reviewPacketHashSha256 !== packet.reviewPacketHashSha256) blockers.push('P48_RECORD_REVIEW_PACKET_MISMATCH');
    if (record.reviewRequestId !== packet.reviewRequestId) blockers.push('P48_RECORD_REVIEW_REQUEST_MISMATCH');
    if (record.cycleId !== packet.cycleId) blockers.push('P48_RECORD_CYCLE_MISMATCH');
    if (record.freshReactivationGovernanceCycleHashSha256 !== packet.freshReactivationGovernanceCycleHashSha256) blockers.push('P48_RECORD_FRESH_CYCLE_HASH_MISMATCH');
    if (record.freshReviewerDesignationHashSha256 !== packet.freshReviewerDesignationHashSha256) blockers.push('P48_RECORD_DESIGNATION_HASH_MISMATCH');
    if (record.reviewerSubjectRef !== packet.independentReviewerRef) blockers.push('P48_RECORD_REVIEWER_NOT_CURRENT');
    if (record.decision !== P48_DECISION.APPROVE) blockers.push('P48_RECORD_APPROVAL_DECISION_REQUIRED');
    requiredSha256(record.reviewerRegistryHashSha256, 'reviewerRegistryHashSha256');
    requiredSha256(record.reviewerPublicKeySha256, 'reviewerPublicKeySha256');
    requiredSha256(record.decisionArtifactSha256, 'decisionArtifactSha256');
    requiredSha256(record.reviewEvidenceSha256, 'reviewEvidenceSha256');
    requiredSha256(record.signingPayloadHashSha256, 'signingPayloadHashSha256');
    iso(record.decidedAt, 'decidedAt');
    if (
      record.reviewerIdentityCryptographicallyVerified !== true
      || record.reviewerTrustRootVerified !== true
      || record.reviewAttestationSignatureVerified !== true
    ) blockers.push('P48_RECORD_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE');
  } catch (error) {
    blockers.push(error.message);
  }

  return blockers;
}

function createFreshReactivationReviewerLifecycleLock({
  packet,
  verifiedReview,
  lockId,
  lockOperatorRef,
  lockedAt,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const blockers = validateApprovedP48Review({ packet, verifiedReview });
  if (blockers.length > 0) return hold(blockers);

  let normalizedLockId;
  let normalizedOperator;
  let normalizedLockedAt;
  try {
    normalizedLockId = requiredString(lockId, 'lockId');
    normalizedOperator = requiredString(lockOperatorRef, 'lockOperatorRef');
    normalizedLockedAt = iso(lockedAt, 'lockedAt');
  } catch (error) {
    return hold([error.message], { reviewPacketHashSha256: packet.reviewPacketHashSha256 });
  }

  const record = verifiedReview.verifiedReviewRecord;
  if (Date.parse(normalizedLockedAt) < Date.parse(record.decidedAt)) {
    return hold(['FRESH_REVIEWER_LOCK_PRECEDES_VERIFIED_REVIEW_DECISION'], {
      reviewPacketHashSha256: packet.reviewPacketHashSha256,
      verifiedFreshReviewRecordHashSha256: verifiedReview.verifiedFreshReviewRecordHashSha256,
    });
  }

  const core = {
    schemaVersion: 1,
    lockId: normalizedLockId,
    lockOperatorRef: normalizedOperator,
    lockedAt: normalizedLockedAt,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    reviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    reviewerRegistryHashSha256: record.reviewerRegistryHashSha256,
    reviewerPublicKeySha256: record.reviewerPublicKeySha256,
    verifiedFreshReviewRecordHashSha256: verifiedReview.verifiedFreshReviewRecordHashSha256,
    reviewDecisionId: record.decisionId,
    reviewEvidenceSha256: record.reviewEvidenceSha256,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    verified: true,
    blockers: Object.freeze([]),
    freshReviewerLifecycleLockHashSha256: sha256Object(core),
    freshReviewerLifecycleLocked: true,
    reviewerReplacementAllowedNow: false,
    ownerMayReplaceReviewerBeforeVerifiedReview: false,
    acceptedVerifiedReviewFreezesReviewerReplacement: true,
    independentReviewCompleted: true,
    freshReviewAccepted: true,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    priorReviewerLifecycleLockReusable: false,
    priorReviewerApprovalReusable: false,
    freshActivationPlanRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P49 freezes the fresh P47 reviewer designation only after the exact P48 approval is cryptographically verified. The lock is cycle-specific and cannot reuse the failed historical reviewer lifecycle. It grants no reactivation, release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  verifiedReviewRecordCore,
  validateApprovedP48Review,
  createFreshReactivationReviewerLifecycleLock,
};
