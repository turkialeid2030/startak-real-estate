'use strict';

const crypto = require('crypto');
const { AUTHORITY, stableStringify } = require('./canonical-baseline-registry');
const {
  DECISION: P66_DECISION,
  STATUS: P66_STATUS,
  validateP65ReviewPacket,
  verifySuccessorFreshReviewAttestation,
} = require('./successor-fresh-review-attestation');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE: 'HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE',
  SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW: 'SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW',
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
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false)
    || (value.reviewerReplacementAllowedNow != null && value.reviewerReplacementAllowedNow !== false)
    || (value.successorFreshReviewerLifecycleLocked != null && value.successorFreshReviewerLifecycleLocked !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_REVIEWER_LIFECYCLE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    successorFreshReviewerLifecycleLocked: false,
    reviewerReplacementAllowedNow: false,
    independentReviewCompleted: false,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    p66ReviewRecomputed: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    successorFreshActivationPlanRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function verifiedSuccessorReviewRecordCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    purpose: record.purpose,
    reviewRequestId: record.reviewRequestId,
    reviewPacketHashSha256: record.reviewPacketHashSha256,
    cycleId: record.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: record.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerDesignationHashSha256: record.successorFreshReviewerDesignationHashSha256,
    successorReviewerRegistryHashSha256: record.successorReviewerRegistryHashSha256,
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

function validateApprovedP66Review({
  packet,
  verifiedReview,
  reviewerRegistry,
  expectedReviewerRegistryHashSha256,
  signedAttestation,
} = {}) {
  const blockers = validateP65ReviewPacket(packet);
  if (blockers.length > 0) return { blockers, recomputed: null };

  const recomputed = verifySuccessorFreshReviewAttestation({
    packet,
    reviewerRegistry,
    expectedReviewerRegistryHashSha256,
    attestation: signedAttestation,
  });
  if (
    recomputed.status !== P66_STATUS.SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED
    || recomputed.verified !== true
    || recomputed.successorFreshReviewAccepted !== true
    || recomputed.successorFreshReviewRejected !== false
    || recomputed.cycleBlockedByReview !== false
    || recomputed.reviewerIdentityCryptographicallyVerified !== true
    || recomputed.reviewerTrustRootVerified !== true
    || recomputed.reviewAttestationSignatureVerified !== true
    || recomputed.successorFreshReviewerLifecycleLockRequired !== true
    || recomputed.successorFreshActivationPlanRequired !== true
    || recomputed.reactivationAuthorized !== false
    || recomputed.currentBaselineMutationPerformed !== false
    || recomputed.releaseStillBlocked !== true
    || !allAuthorityFalse(recomputed)
  ) blockers.push('P66_APPROVED_CRYPTOGRAPHICALLY_VERIFIED_REVIEW_REQUIRED');

  if (!verifiedReview || verifiedReview.status !== P66_STATUS.SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED) {
    blockers.push('SUPPLIED_P66_APPROVED_REVIEW_REQUIRED');
    return { blockers, recomputed };
  }
  if (
    verifiedReview.verified !== true
    || verifiedReview.successorFreshReviewAccepted !== true
    || verifiedReview.successorFreshReviewRejected !== false
    || verifiedReview.cycleBlockedByReview !== false
    || verifiedReview.reviewerIdentityCryptographicallyVerified !== true
    || verifiedReview.reviewerTrustRootVerified !== true
    || verifiedReview.reviewAttestationSignatureVerified !== true
    || verifiedReview.successorFreshReviewerLifecycleLockRequired !== true
    || verifiedReview.successorFreshActivationPlanRequired !== true
    || verifiedReview.reactivationAuthorized !== false
    || verifiedReview.currentBaselineMutationPerformed !== false
    || verifiedReview.releaseStillBlocked !== true
    || !allAuthorityFalse(verifiedReview)
  ) blockers.push('SUPPLIED_P66_APPROVED_REVIEW_BOUNDARY_INVALID');
  if (verifiedReview.reviewPacketHashSha256 !== packet.successorFreshReviewPacketHashSha256) blockers.push('P66_REVIEW_PACKET_BINDING_MISMATCH');
  if (verifiedReview.successorReviewerRegistryHashSha256 !== recomputed.successorReviewerRegistryHashSha256) blockers.push('P66_REVIEWER_REGISTRY_BINDING_MISMATCH');
  if (verifiedReview.verifiedSuccessorFreshReviewRecordHashSha256 !== recomputed.verifiedSuccessorFreshReviewRecordHashSha256) blockers.push('P66_REVIEW_RECORD_HASH_MISMATCH');
  if (stableStringify(verifiedReview.verifiedSuccessorFreshReviewRecord) !== stableStringify(recomputed.verifiedSuccessorFreshReviewRecord)) blockers.push('P66_REVIEW_RECORD_OBJECT_MISMATCH');

  const record = verifiedReview.verifiedSuccessorFreshReviewRecord;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    blockers.push('P66_VERIFIED_SUCCESSOR_REVIEW_RECORD_REQUIRED');
    return { blockers, recomputed };
  }
  try {
    const recordHash = requiredSha256(record.verifiedSuccessorFreshReviewRecordHashSha256, 'verifiedSuccessorFreshReviewRecordHashSha256');
    if (sha256Object(verifiedSuccessorReviewRecordCore(record)) !== recordHash) blockers.push('P66_VERIFIED_SUCCESSOR_REVIEW_RECORD_HASH_MISMATCH');
    if (recordHash !== verifiedReview.verifiedSuccessorFreshReviewRecordHashSha256) blockers.push('P66_RESULT_REVIEW_RECORD_HASH_MISMATCH');
    if (record.reviewPacketHashSha256 !== packet.successorFreshReviewPacketHashSha256) blockers.push('P66_RECORD_REVIEW_PACKET_MISMATCH');
    if (record.reviewRequestId !== packet.reviewRequestId) blockers.push('P66_RECORD_REVIEW_REQUEST_MISMATCH');
    if (record.cycleId !== packet.cycleId) blockers.push('P66_RECORD_CYCLE_MISMATCH');
    if (record.successorFreshReactivationGovernanceCycleHashSha256 !== packet.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P66_RECORD_SUCCESSOR_CYCLE_HASH_MISMATCH');
    if (record.successorFreshReviewerDesignationHashSha256 !== packet.successorFreshReviewerDesignationHashSha256) blockers.push('P66_RECORD_DESIGNATION_HASH_MISMATCH');
    if (record.reviewerSubjectRef !== packet.independentReviewerRef) blockers.push('P66_RECORD_REVIEWER_NOT_CURRENT');
    if (record.decision !== P66_DECISION.APPROVE) blockers.push('P66_RECORD_APPROVAL_DECISION_REQUIRED');
    requiredSha256(record.successorReviewerRegistryHashSha256, 'successorReviewerRegistryHashSha256');
    requiredSha256(record.reviewerPublicKeySha256, 'reviewerPublicKeySha256');
    requiredSha256(record.reviewEvidenceSha256, 'reviewEvidenceSha256');
    requiredSha256(record.signingPayloadHashSha256, 'signingPayloadHashSha256');
    iso(record.decidedAt, 'decidedAt');
    if (
      record.reviewerIdentityCryptographicallyVerified !== true
      || record.reviewerTrustRootVerified !== true
      || record.reviewAttestationSignatureVerified !== true
    ) blockers.push('P66_RECORD_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE');
  } catch (error) {
    blockers.push(error.message);
  }
  return { blockers, recomputed };
}

function createSuccessorFreshReviewerLifecycleLock({
  packet,
  verifiedReview,
  reviewerRegistry,
  expectedReviewerRegistryHashSha256,
  signedAttestation,
  lockId,
  lockOperatorRef,
  lockedAt,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({ packet, verifiedReview, reviewerRegistry, signedAttestation, callerOverrides });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const validation = validateApprovedP66Review({
    packet,
    verifiedReview,
    reviewerRegistry,
    expectedReviewerRegistryHashSha256,
    signedAttestation,
  });
  if (validation.blockers.length > 0) return hold(validation.blockers);

  let normalizedLockId;
  let normalizedOperator;
  let normalizedLockedAt;
  try {
    normalizedLockId = requiredString(lockId, 'lockId');
    normalizedOperator = requiredString(lockOperatorRef, 'lockOperatorRef');
    normalizedLockedAt = iso(lockedAt, 'lockedAt');
  } catch (error) {
    return hold([error.message], {
      p66ReviewRecomputed: true,
      reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
      verifiedSuccessorFreshReviewRecordHashSha256: verifiedReview.verifiedSuccessorFreshReviewRecordHashSha256,
    });
  }

  const record = validation.recomputed.verifiedSuccessorFreshReviewRecord;
  if (Date.parse(normalizedLockedAt) < Date.parse(record.decidedAt)) {
    return hold(['SUCCESSOR_FRESH_REVIEWER_LOCK_PRECEDES_VERIFIED_REVIEW_DECISION'], {
      p66ReviewRecomputed: true,
      reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
      verifiedSuccessorFreshReviewRecordHashSha256: record.verifiedSuccessorFreshReviewRecordHashSha256,
    });
  }

  const core = {
    schemaVersion: 1,
    lockId: normalizedLockId,
    lockOperatorRef: normalizedOperator,
    lockedAt: normalizedLockedAt,
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    reviewRequestId: packet.reviewRequestId,
    successorFreshReviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    reviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    successorReviewerRegistryHashSha256: record.successorReviewerRegistryHashSha256,
    reviewerPublicKeySha256: record.reviewerPublicKeySha256,
    verifiedSuccessorFreshReviewRecordHashSha256: record.verifiedSuccessorFreshReviewRecordHashSha256,
    reviewDecisionId: record.decisionId,
    reviewEvidenceSha256: record.reviewEvidenceSha256,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    currentRegistryContentSha256: packet.currentRegistryContentSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerLifecycleLockHashSha256: sha256Object(core),
    successorFreshReviewerLifecycleLocked: true,
    reviewerReplacementAllowedNow: false,
    ownerMayReplaceReviewerBeforeVerifiedReview: false,
    acceptedVerifiedReviewFreezesReviewerReplacement: true,
    independentReviewCompleted: true,
    successorFreshReviewAccepted: true,
    p66ReviewRecomputed: true,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    predecessorReviewerLifecycleLockReusable: false,
    predecessorReviewerApprovalReusable: false,
    successorFreshActivationPlanRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P67 freezes the P65 successor-cycle reviewer designation only after independently re-running the exact P66 cryptographic approval against the pinned successor reviewer trust root. The lock is cycle-specific, predecessor reviewer authority is non-reusable, and no release or reactivation authority is granted.',
  });
}

module.exports = {
  STATUS,
  verifiedSuccessorReviewRecordCore,
  validateApprovedP66Review,
  createSuccessorFreshReviewerLifecycleLock,
};
