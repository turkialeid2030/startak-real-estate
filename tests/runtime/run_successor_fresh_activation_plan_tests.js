'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { AUTHORITY, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P65_STATUS } = require('../../src/qualification/successor-fresh-independent-review-handoff');
const { designationCore, reviewPacketCore } = require('../../src/qualification/successor-fresh-review-attestation');
const { STATUS: P67_STATUS } = require('../../src/qualification/successor-fresh-reviewer-lifecycle-lock');
const {
  STATUS,
  successorReviewerLockCore,
  createSuccessorFreshActivationPlan,
} = require('../../src/qualification/successor-fresh-activation-plan');
const { parseArgs } = require('../../tools/successor-fresh-activation-plan');

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function h(label) {
  return sha256Text(`p68:${label}`);
}
function authorityFalse() {
  return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false]));
}

function buildPacket() {
  const designation = {
    schemaVersion: 1,
    designationId: 'successor-designation-002',
    cycleId: 'successor-cycle-003',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    designatedByRef: 'owner:successor',
    reviewerRef: 'reviewer:successor-independent',
    reviewerDisplayName: 'Successor Independent Reviewer',
    designatedAt: '2026-09-10T20:00:00.000Z',
    designationSourceRef: 'governance://successor-reviewer-designation/002',
    designationArtifactSha256: h('designation-artifact'),
  };
  designation.successorFreshReviewerDesignationHashSha256 = sha256Object(designationCore(designation));
  const core = {
    schemaVersion: 1,
    reviewRequestId: 'successor-review-request-002',
    requestedAt: '2026-09-10T20:01:00.000Z',
    cycleId: designation.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: designation.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: designation.designatedByRef,
    currentAuthoritativeMode: 'LEGACY_FILE_SHA256',
    currentRegistryHashSha256: h('legacy-logical'),
    currentRegistryContentSha256: h('legacy-content'),
    requestedTargetMode: 'GOVERNED_COMPOSITE_BASELINE',
    qualifiedSourceCommitSha: 'b'.repeat(40),
    releaseArtifactSha256: h('release-artifact'),
    environmentConfigSha256: h('environment-config'),
    cycleEvidenceArtifactSha256: h('cycle-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
    successorFreshReviewerDesignationHashSha256: designation.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist: Object.freeze(['CONFIRM_SUCCESSOR_SCOPE']),
  };
  return {
    ...core,
    status: P65_STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerDesignation: designation,
    successorFreshReviewPacketHashSha256: sha256Object(reviewPacketCore(core)),
    reviewPacketReady: true,
    successorFreshReviewerDesignated: true,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    successorFreshCryptographicReviewAttestationRequired: true,
    successorFreshReviewerLifecycleLockRequired: true,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

function buildLock(packet) {
  const core = {
    schemaVersion: 1,
    lockId: 'successor-reviewer-lock-002',
    lockOperatorRef: 'governance-operator:successor',
    lockedAt: '2026-09-10T20:10:00.000Z',
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    reviewRequestId: packet.reviewRequestId,
    successorFreshReviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    reviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    successorReviewerRegistryHashSha256: h('reviewer-registry'),
    reviewerPublicKeySha256: h('reviewer-public-key'),
    verifiedSuccessorFreshReviewRecordHashSha256: h('verified-review-record'),
    reviewDecisionId: 'successor-review-approve-002',
    reviewEvidenceSha256: h('review-evidence'),
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
  return {
    ...core,
    status: P67_STATUS.SUCCESSOR_FRESH_REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerLifecycleLockHashSha256: sha256Object(successorReviewerLockCore(core)),
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
    ...authorityFalse(),
  };
}

(function run() {
  const packet = buildPacket();
  const reviewerLifecycle = buildLock(packet);
  const baseInput = {
    packet,
    reviewerLifecycle,
    activationChangeId: 'successor-activation-change-001',
    preparedByRef: packet.ownerActorRef,
    preparedAt: '2026-09-10T20:11:00.000Z',
  };

  const result = createSuccessorFreshActivationPlan(baseInput);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.successorFreshCompositeRegistryCandidateRequired, true);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.strictEqual(result.successorFreshBaselineManifest.expectedPriorRegistryHashSha256, packet.currentRegistryHashSha256);
  assert.strictEqual(result.successorFreshBaselineManifest.expectedPriorRegistryContentSha256, packet.currentRegistryContentSha256);
  assert.strictEqual(result.successorFreshBaselineManifest.successorFreshReviewerLifecycleLockHashSha256, reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256);
  assert.match(result.successorFreshActivationPlanHashSha256, /^[a-f0-9]{64}$/);
  assert.match(result.successorFreshBaselineManifestHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(createSuccessorFreshActivationPlan(baseInput).successorFreshActivationPlanHashSha256, result.successorFreshActivationPlanHashSha256);

  const wrongOwner = createSuccessorFreshActivationPlan({ ...baseInput, preparedByRef: 'owner:other' });
  assert.strictEqual(wrongOwner.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(wrongOwner.blockers.includes('SUCCESSOR_FRESH_ACTIVATION_PLAN_MUST_BE_PREPARED_BY_CYCLE_OWNER'));

  const early = createSuccessorFreshActivationPlan({ ...baseInput, preparedAt: '2026-09-10T20:09:59.000Z' });
  assert.strictEqual(early.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(early.blockers.includes('SUCCESSOR_FRESH_ACTIVATION_PLAN_PRECEDES_REVIEWER_LIFECYCLE_LOCK'));

  const tamperedLock = JSON.parse(JSON.stringify(reviewerLifecycle));
  tamperedLock.successorFreshReviewerLifecycleLockHashSha256 = h('tampered-lock');
  const badLock = createSuccessorFreshActivationPlan({ ...baseInput, reviewerLifecycle: tamperedLock });
  assert.strictEqual(badLock.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(badLock.blockers.includes('P67_SUCCESSOR_REVIEWER_LIFECYCLE_LOCK_HASH_MISMATCH'));

  const driftedPacket = JSON.parse(JSON.stringify(packet));
  driftedPacket.currentRegistryContentSha256 = h('different-registry-content');
  const drifted = createSuccessorFreshActivationPlan({ ...baseInput, packet: driftedPacket });
  assert.strictEqual(drifted.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);

  const reused = createSuccessorFreshActivationPlan({ ...baseInput, freshActivationPlanHashSha256: h('old-plan') });
  assert.strictEqual(reused.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(reused.blockers.some((item) => item.startsWith('PREDECESSOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:')));

  const escalated = createSuccessorFreshActivationPlan({ ...baseInput, activationAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = createSuccessorFreshActivationPlan({ ...baseInput, privateKeyPem: 'forbidden' });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_PLAN);
  assert(keyMaterial.blockers.some((item) => item.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--packet', 'a.json', '--packet', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--secret-key', 'secret.pem']), /private or secret key argument rejected/);

  process.stdout.write('P68 successor fresh activation plan tests passed\n');
})();
