'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { MODE, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P47_STATUS } = require('../../src/qualification/fresh-reactivation-independent-review-handoff');
const { STATUS: P49_STATUS } = require('../../src/qualification/fresh-reactivation-reviewer-lifecycle-lock');
const {
  STATUS,
  reviewerLockCore,
  createFreshReactivationActivationPlan,
} = require('../../src/qualification/fresh-reactivation-activation-plan');
const { parseArgs } = require('../../tools/fresh-reactivation-activation-plan');

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

function packetHashCore(packet) {
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
    designationId: 'designation:p50',
    cycleId: 'cycle:p50',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    designatedByRef: 'owner:p50',
    reviewerRef: 'reviewer:p50',
    reviewerDisplayName: 'Reviewer P50',
    designatedAt: '2026-09-10T10:00:00.000Z',
    designationSourceRef: 'designation-source:p50',
    designationArtifactSha256: h('2'),
  };
  designation.freshReviewerDesignationHashSha256 = hashObject(designationCore(designation));

  const packet = {
    schemaVersion: 1,
    reviewRequestId: 'review-request:p50',
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
    reviewChecklist: ['CONFIRM_FRESH_CYCLE'],
  };
  packet.reviewPacketHashSha256 = hashObject(packetHashCore(packet));
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
    expectedReviewDecisionValues: ['APPROVE_FRESH_REACTIVATION_REVIEW', 'REJECT_FRESH_REACTIVATION_REVIEW'],
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function lifecycleFixture(packet) {
  const lock = {
    schemaVersion: 1,
    lockId: 'lock:p50',
    lockOperatorRef: 'operator:p50',
    lockedAt: '2026-09-10T10:15:00.000Z',
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    reviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    reviewerRegistryHashSha256: h('8'),
    reviewerPublicKeySha256: h('9'),
    verifiedFreshReviewRecordHashSha256: h('a'),
    reviewDecisionId: 'review-decision:p50',
    reviewEvidenceSha256: h('b'),
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
  };
  lock.freshReviewerLifecycleLockHashSha256 = hashObject(reviewerLockCore(lock));
  return {
    ...lock,
    status: P49_STATUS.FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    verified: true,
    blockers: [],
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
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

(() => {
  const packet = packetFixture();
  const reviewerLifecycle = lifecycleFixture(packet);
  const baseInput = {
    packet,
    reviewerLifecycle,
    activationChangeId: 'fresh-activation-change:p50',
    preparedByRef: packet.ownerActorRef,
    preparedAt: '2026-09-10T10:20:00.000Z',
  };

  const success = createFreshReactivationActivationPlan(baseInput);
  assert.strictEqual(success.status, STATUS.FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.freshSuccessorBaselineManifest.cycleId, packet.cycleId);
  assert.strictEqual(success.freshSuccessorBaselineManifest.qualifiedSourceCommitSha, packet.qualifiedSourceCommitSha);
  assert.strictEqual(success.targetActivationContract.expectedPriorMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(success.targetActivationContract.proposedMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(success.activationAuthorized, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = createFreshReactivationActivationPlan(baseInput);
  assert.strictEqual(deterministic.freshActivationPlanHashSha256, success.freshActivationPlanHashSha256);
  assert.strictEqual(deterministic.freshSuccessorBaselineManifestHashSha256, success.freshSuccessorBaselineManifestHashSha256);

  const wrongOwner = createFreshReactivationActivationPlan({ ...baseInput, preparedByRef: 'owner:other' });
  assert(wrongOwner.blockers.includes('FRESH_ACTIVATION_PLAN_MUST_BE_PREPARED_BY_CYCLE_OWNER'));

  const tooEarly = createFreshReactivationActivationPlan({ ...baseInput, preparedAt: '2026-09-10T10:14:59.000Z' });
  assert(tooEarly.blockers.includes('FRESH_ACTIVATION_PLAN_PRECEDES_REVIEWER_LIFECYCLE_LOCK'));

  const lockTamper = { ...reviewerLifecycle, reviewEvidenceSha256: h('c') };
  const lockTamperResult = createFreshReactivationActivationPlan({ ...baseInput, reviewerLifecycle: lockTamper });
  assert(lockTamperResult.blockers.includes('P49_REVIEWER_LIFECYCLE_LOCK_HASH_MISMATCH'));

  const packetTamper = { ...packet, releaseArtifactSha256: h('d') };
  const packetTamperResult = createFreshReactivationActivationPlan({ ...baseInput, packet: packetTamper });
  assert(packetTamperResult.blockers.includes('P47_REVIEW_PACKET_HASH_MISMATCH'));

  const mismatchedLock = { ...reviewerLifecycle, currentRegistryHashSha256: h('e') };
  mismatchedLock.freshReviewerLifecycleLockHashSha256 = hashObject(reviewerLockCore(mismatchedLock));
  const mismatchResult = createFreshReactivationActivationPlan({ ...baseInput, reviewerLifecycle: mismatchedLock });
  assert(mismatchResult.blockers.includes('P49_LOCK_REGISTRY_MISMATCH'));

  const priorReuse = createFreshReactivationActivationPlan({ ...baseInput, priorActivationPlanHashSha256: h('f') });
  assert(priorReuse.blockers.some((value) => value.includes('PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED')));

  const escalation = createFreshReactivationActivationPlan({ ...baseInput, activationAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = createFreshReactivationActivationPlan({ ...baseInput, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--packet', 'a.json', '--packet', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P50 fresh reactivation activation plan: PASS');
})();
