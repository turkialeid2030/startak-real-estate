'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const { MODE, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P46_STATUS } = require('../../src/qualification/fresh-reactivation-governance-cycle');
const {
  STATUS,
  createFreshReactivationIndependentReviewHandoff,
} = require('../../src/qualification/fresh-reactivation-independent-review-handoff');

const hashObject = (value) => crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');

function p46Fixture() {
  const core = {
    schemaVersion: 1,
    cycleId: 'reactivation-cycle:p47-001',
    ownerActorRef: 'owner:p47',
    preparedAt: '2026-09-10T11:10:00.000Z',
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: '1'.repeat(64),
    requestedTargetMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: '2'.repeat(64),
    environmentConfigSha256: '3'.repeat(64),
    cycleRationaleRef: 'rationale:p47-fresh-cycle',
    cycleEvidenceArtifactSha256: '4'.repeat(64),
    priorGovernanceResetRecordHashSha256: '5'.repeat(64),
    priorHumanDecisionRecordHashSha256: '6'.repeat(64),
  };
  return {
    ...core,
    status: P46_STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    freshReactivationGovernanceCycleHashSha256: hashObject(core),
    freshGovernanceCycleOpened: true,
    priorReviewerApprovalAccepted: false,
    priorActivationAuthorizationAccepted: false,
    priorActivationPlanAccepted: false,
    priorActivationContractAccepted: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
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

function designationFixture(overrides = {}) {
  return {
    designationId: 'fresh-reviewer-designation:p47-001',
    designatedByRef: 'owner:p47',
    reviewerRef: 'reviewer:p47-independent',
    reviewerDisplayName: 'Independent Reviewer P47',
    designatedAt: '2026-09-10T11:15:00.000Z',
    designationSourceRef: 'governance:fresh-reviewer-designation:p47',
    designationArtifactSha256: '7'.repeat(64),
    ...overrides,
  };
}

function create(p46, designation, overrides = {}) {
  return createFreshReactivationIndependentReviewHandoff({
    p46,
    reviewerDesignation: designation,
    reviewRequestId: 'fresh-review-request:p47-001',
    requestedAt: '2026-09-10T11:20:00.000Z',
    ...overrides,
  });
}

(() => {
  const p46 = p46Fixture();
  const designation = designationFixture();
  const success = create(p46, designation);
  assert.strictEqual(success.status, STATUS.FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.reviewPacketReady, true);
  assert.strictEqual(success.freshReviewerDesignated, true);
  assert.strictEqual(success.independentReviewerRef, designation.reviewerRef);
  assert.strictEqual(success.ownerActorRef, p46.ownerActorRef);
  assert.strictEqual(success.currentAuthoritativeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(success.reviewerIdentityCryptographicallyVerified, false);
  assert.strictEqual(success.independentReviewAccepted, false);
  assert.strictEqual(success.priorReviewerAuthorityAccepted, false);
  assert.strictEqual(success.priorActivationAuthorityAccepted, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(success.currentBaselineMutationPerformed, false);
  assert.strictEqual(success.expectedReviewDecisionValues.length, 2);
  assert(success.reviewChecklist.includes('CONFIRM_FAILED_ACTIVATION_CYCLE_IS_HISTORICAL_AND_NON_REUSABLE'));

  const deterministic = create(p46, designation);
  assert.strictEqual(deterministic.reviewPacketHashSha256, success.reviewPacketHashSha256);
  assert.strictEqual(deterministic.freshReviewerDesignationHashSha256, success.freshReviewerDesignationHashSha256);

  const tamperedP46 = { ...p46, releaseArtifactSha256: '8'.repeat(64) };
  const p46Tamper = create(tamperedP46, designation);
  assert.strictEqual(p46Tamper.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(p46Tamper.blockers.includes('P46_FRESH_CYCLE_HASH_MISMATCH'));

  const wrongStatus = { ...p46, status: P46_STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE };
  assert.strictEqual(create(wrongStatus, designation).status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);

  const ownerReviewer = create(p46, designationFixture({ reviewerRef: p46.ownerActorRef }));
  assert.strictEqual(ownerReviewer.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(ownerReviewer.blockers.includes('OWNER_AND_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER'));

  const wrongDesignator = create(p46, designationFixture({ designatedByRef: 'owner:wrong' }));
  assert.strictEqual(wrongDesignator.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(wrongDesignator.blockers.includes('FRESH_REVIEWER_MUST_BE_DESIGNATED_BY_CYCLE_OWNER'));

  const staleDesignation = create(p46, designationFixture({ designatedAt: '2026-09-10T11:09:59.000Z' }));
  assert.strictEqual(staleDesignation.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(staleDesignation.blockers.includes('FRESH_REVIEWER_DESIGNATION_PRECEDES_CYCLE_OPENING'));

  const reusedOldReviewerLock = create(p46, designationFixture({ reviewerLockHashSha256: '9'.repeat(64) }));
  assert.strictEqual(reusedOldReviewerLock.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(reusedOldReviewerLock.blockers.some((item) => item.startsWith('PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED')));

  const reusedOldActivation = create(p46, designationFixture({ activationAuthorizationHashSha256: 'a'.repeat(64) }));
  assert.strictEqual(reusedOldActivation.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);

  const requestBeforeDesignation = createFreshReactivationIndependentReviewHandoff({
    p46,
    reviewerDesignation: designation,
    reviewRequestId: 'fresh-review-request:p47-too-early',
    requestedAt: '2026-09-10T11:14:59.000Z',
  });
  assert.strictEqual(requestBeforeDesignation.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(requestBeforeDesignation.blockers.includes('FRESH_REVIEW_REQUEST_PRECEDES_REVIEWER_DESIGNATION'));

  const authorityEscalation = create(p46, designation, { releaseAuthorized: true });
  assert.strictEqual(authorityEscalation.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(authorityEscalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = create(p46, designationFixture({ privateKeyPem: 'forbidden' }));
  assert.strictEqual(privateKey.status, STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF);
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  const replacement = create(p46, designationFixture({
    designationId: 'fresh-reviewer-designation:p47-002',
    reviewerRef: 'reviewer:p47-replacement',
    reviewerDisplayName: 'Replacement Reviewer P47',
    designationArtifactSha256: 'b'.repeat(64),
  }));
  assert.strictEqual(replacement.status, STATUS.FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED);
  assert.notStrictEqual(replacement.reviewPacketHashSha256, success.reviewPacketHashSha256);
  assert.notStrictEqual(replacement.freshReviewerDesignationHashSha256, success.freshReviewerDesignationHashSha256);

  const cli = path.join(__dirname, '..', '..', 'tools', 'fresh-reactivation-independent-review-handoff.js');
  const cliPrivateKey = spawnSync(process.execPath, [cli, '--private-key', 'forbidden'], { encoding: 'utf8' });
  assert.strictEqual(cliPrivateKey.status, 1);
  assert(cliPrivateKey.stderr.includes('private signing key argument rejected'));

  const cliDuplicate = spawnSync(process.execPath, [cli, '--review-request-id', 'a', '--review-request-id', 'b'], { encoding: 'utf8' });
  assert.strictEqual(cliDuplicate.status, 1);
  assert(cliDuplicate.stderr.includes('duplicate argument'));

  console.log('P47 fresh reactivation independent review handoff: PASS');
})();
