'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { MODE, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P47_STATUS } = require('../../src/qualification/fresh-reactivation-independent-review-handoff');
const {
  PURPOSE: P48_PURPOSE,
  DECISION: P48_DECISION,
  STATUS: P48_STATUS,
} = require('../../src/qualification/fresh-reactivation-review-attestation');
const {
  STATUS,
  verifiedReviewRecordCore,
  createFreshReactivationReviewerLifecycleLock,
} = require('../../src/qualification/fresh-reactivation-reviewer-lifecycle-lock');
const { parseArgs } = require('../../tools/fresh-reactivation-reviewer-lifecycle-lock');

const hashObject = (value) => crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
const h = (char) => char.repeat(64);

function designationCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    designationId: record.designationId,
    cycleId: record.cycleId,
    freshReactivationGovernanceCycleHashSha256: record.freshReactivationGovernanceCycleHashSha256,
    designatedByRef: record.designatedByRef,
    reviewerRef: record.reviewerRef,
    reviewerDisplayName: record.reviewerDisplayName,
    designatedAt: record.designatedAt,
    designationSourceRef: record.designationSourceRef,
    designationArtifactSha256: record.designationArtifactSha256,
  };
}

function reviewPacketCore(packet) {
  return {
    schemaVersion: packet.schemaVersion,
    reviewRequestId: packet.reviewRequestId,
    requestedAt: packet.requestedAt,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    ownerActorRef: packet.ownerActorRef,
    currentAuthoritativeMode: packet.currentAuthoritativeMode,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    requestedTargetMode: packet.requestedTargetMode,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    priorGovernanceResetRecordHashSha256: packet.priorGovernanceResetRecordHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    independentReviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    reviewChecklist: packet.reviewChecklist,
  };
}

function packetFixture() {
  const designation = {
    schemaVersion: 1,
    designationId: 'fresh-designation:p49',
    cycleId: 'fresh-cycle:p49',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    designatedByRef: 'owner:p49',
    reviewerRef: 'reviewer:fresh-p49',
    reviewerDisplayName: 'Fresh Reviewer P49',
    designatedAt: '2026-09-10T10:00:00.000Z',
    designationSourceRef: 'governance:fresh-reviewer-p49',
    designationArtifactSha256: h('2'),
  };
  designation.freshReviewerDesignationHashSha256 = hashObject(designationCore(designation));

  const packet = {
    schemaVersion: 1,
    reviewRequestId: 'fresh-review-request:p49',
    requestedAt: '2026-09-10T10:05:00.000Z',
    cycleId: designation.cycleId,
    freshReactivationGovernanceCycleHashSha256: designation.freshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: h('3'),
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('4'),
    environmentConfigSha256: h('5'),
    cycleEvidenceArtifactSha256: h('6'),
    priorGovernanceResetRecordHashSha256: h('7'),
    freshReviewerDesignationHashSha256: designation.freshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist: Object.freeze(['CONFIRM_FRESH_CYCLE', 'CONFIRM_NO_AUTHORITY']),
  };
  packet.reviewPacketHashSha256 = hashObject(reviewPacketCore(packet));
  return {
    ...packet,
    status: P47_STATUS.FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: [],
    freshReviewerDesignation: designation,
    reviewPacketReady: true,
    freshReviewerDesignated: true,
    ownerMayReplaceReviewerBeforeVerifiedReview: true,
    replacementRequiresNewDesignationAndReviewPacket: true,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    freshCryptographicReviewAttestationRequired: true,
    freshReviewerLifecycleLockRequired: true,
    priorReviewerAuthorityAccepted: false,
    priorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    expectedReviewDecisionValues: [P48_DECISION.APPROVE, P48_DECISION.REJECT],
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function approvedReviewFixture(packet) {
  const core = {
    schemaVersion: 1,
    purpose: P48_PURPOSE,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    reviewerRegistryHashSha256: h('8'),
    reviewerId: 'reviewer-id:p49',
    reviewerSubjectRef: packet.independentReviewerRef,
    reviewerPublicKeySha256: h('9'),
    decisionId: 'fresh-review-decision:p49',
    decision: P48_DECISION.APPROVE,
    decisionSourceRef: 'decision:fresh-review-p49',
    decisionArtifactSha256: h('a'),
    reviewEvidenceRef: 'evidence:fresh-review-p49',
    reviewEvidenceSha256: h('b'),
    decidedAt: '2026-09-10T10:10:00.000Z',
    rationaleRef: 'rationale:fresh-review-p49',
    signingPayloadHashSha256: h('c'),
  };
  const record = {
    ...core,
    verifiedFreshReviewRecordHashSha256: hashObject(core),
    signatureAlgorithm: 'RSA-SHA256',
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
  };
  return {
    schemaVersion: 1,
    status: P48_STATUS.FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED,
    verified: true,
    blockers: [],
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    reviewerRegistryHashSha256: core.reviewerRegistryHashSha256,
    verifiedReviewRecord: record,
    verifiedFreshReviewRecordHashSha256: record.verifiedFreshReviewRecordHashSha256,
    freshReviewAccepted: true,
    freshReviewRejected: false,
    cycleBlockedByReview: false,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function rebuildVerifiedReview(review, mutate) {
  const next = JSON.parse(JSON.stringify(review));
  mutate(next);
  if (next.verifiedReviewRecord) {
    next.verifiedReviewRecord.verifiedFreshReviewRecordHashSha256 = hashObject(verifiedReviewRecordCore(next.verifiedReviewRecord));
    next.verifiedFreshReviewRecordHashSha256 = next.verifiedReviewRecord.verifiedFreshReviewRecordHashSha256;
  }
  return next;
}

(() => {
  const packet = packetFixture();
  const approved = approvedReviewFixture(packet);
  const baseInput = {
    packet,
    verifiedReview: approved,
    lockId: 'fresh-reviewer-lock:p49',
    lockOperatorRef: 'operator:p49',
    lockedAt: '2026-09-10T10:15:00.000Z',
  };

  const success = createFreshReactivationReviewerLifecycleLock(baseInput);
  assert.strictEqual(success.status, STATUS.FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.freshReviewerLifecycleLocked, true);
  assert.strictEqual(success.reviewerReplacementAllowedNow, false);
  assert.strictEqual(success.independentReviewCompleted, true);
  assert.strictEqual(success.reviewerIdentityCryptographicallyVerified, true);
  assert.strictEqual(success.freshActivationPlanRequired, true);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(success.releaseStillBlocked, true);

  const deterministic = createFreshReactivationReviewerLifecycleLock(baseInput);
  assert.strictEqual(deterministic.freshReviewerLifecycleLockHashSha256, success.freshReviewerLifecycleLockHashSha256);

  const packetTamper = { ...packet, qualifiedSourceCommitSha: 'b'.repeat(40) };
  const tamper = createFreshReactivationReviewerLifecycleLock({ ...baseInput, packet: packetTamper });
  assert.strictEqual(tamper.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEWER_LIFECYCLE);
  assert(tamper.blockers.includes('P47_REVIEW_PACKET_HASH_MISMATCH'));

  const rejected = { ...approved, status: P48_STATUS.FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED, freshReviewAccepted: false, freshReviewRejected: true, cycleBlockedByReview: true };
  const rejectedResult = createFreshReactivationReviewerLifecycleLock({ ...baseInput, verifiedReview: rejected });
  assert(rejectedResult.blockers.includes('P48_APPROVED_CRYPTOGRAPHICALLY_VERIFIED_REVIEW_REQUIRED'));

  const recordTamper = JSON.parse(JSON.stringify(approved));
  recordTamper.verifiedReviewRecord.reviewEvidenceSha256 = h('d');
  const recordTamperResult = createFreshReactivationReviewerLifecycleLock({ ...baseInput, verifiedReview: recordTamper });
  assert(recordTamperResult.blockers.includes('P48_VERIFIED_REVIEW_RECORD_HASH_MISMATCH'));

  const reviewerMismatch = rebuildVerifiedReview(approved, (value) => {
    value.verifiedReviewRecord.reviewerSubjectRef = 'reviewer:other';
  });
  const reviewerMismatchResult = createFreshReactivationReviewerLifecycleLock({ ...baseInput, verifiedReview: reviewerMismatch });
  assert(reviewerMismatchResult.blockers.includes('P48_RECORD_REVIEWER_NOT_CURRENT'));

  const cryptoDowngrade = rebuildVerifiedReview(approved, (value) => {
    value.verifiedReviewRecord.reviewAttestationSignatureVerified = false;
  });
  const cryptoDowngradeResult = createFreshReactivationReviewerLifecycleLock({ ...baseInput, verifiedReview: cryptoDowngrade });
  assert(cryptoDowngradeResult.blockers.includes('P48_RECORD_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE'));

  const tooEarly = createFreshReactivationReviewerLifecycleLock({ ...baseInput, lockedAt: '2026-09-10T10:09:59.000Z' });
  assert(tooEarly.blockers.includes('FRESH_REVIEWER_LOCK_PRECEDES_VERIFIED_REVIEW_DECISION'));

  const escalation = createFreshReactivationReviewerLifecycleLock({ ...baseInput, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = createFreshReactivationReviewerLifecycleLock({ ...baseInput, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--packet', 'a.json', '--packet', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P49 fresh reactivation reviewer lifecycle lock: PASS');
})();
