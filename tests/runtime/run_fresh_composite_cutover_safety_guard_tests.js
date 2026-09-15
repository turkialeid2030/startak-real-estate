'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P49_STATUS } = require('../../src/qualification/fresh-reactivation-reviewer-lifecycle-lock');
const { reviewerLockCore } = require('../../src/qualification/fresh-reactivation-activation-plan');
const { STATUS: P50_STATUS } = require('../../src/qualification/fresh-reactivation-activation-plan');
const {
  freshManifestCore,
  p50PlanCore,
} = require('../../src/qualification/fresh-composite-registry-candidate');
const { STATUS: P53_STATUS } = require('../../src/qualification/fresh-composite-shadow-release-gate');
const {
  p53ShadowCore,
  runFreshCompositeCutoverRehearsal,
} = require('../../src/qualification/fresh-composite-cutover-rehearsal');
const {
  STATUS,
  evaluateFreshCompositeCutoverSafetyGuard,
} = require('../../src/qualification/fresh-composite-cutover-safety-guard');
const { parseArgs } = require('../../tools/fresh-composite-cutover-safety-guard');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function reviewerLockFixture(currentHash) {
  const lock = {
    schemaVersion: 1,
    lockId: 'lock:p55',
    lockOperatorRef: 'operator:p55',
    lockedAt: '2026-09-10T12:00:00.000Z',
    cycleId: 'cycle:p55',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    reviewRequestId: 'review:p55',
    reviewPacketHashSha256: h('2'),
    freshReviewerDesignationHashSha256: h('3'),
    reviewerRef: 'reviewer:p55',
    reviewerDisplayName: 'Fresh Reviewer P55',
    reviewerRegistryHashSha256: h('4'),
    reviewerPublicKeySha256: h('5'),
    verifiedFreshReviewRecordHashSha256: h('6'),
    reviewDecisionId: 'decision:p55',
    reviewEvidenceSha256: h('7'),
    currentRegistryHashSha256: currentHash,
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('8'),
    environmentConfigSha256: h('9'),
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

function activationPlanFixture(lock, currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p55',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: lock.cycleId,
    freshReactivationGovernanceCycleHashSha256: lock.freshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: lock.qualifiedSourceCommitSha,
    releaseArtifactSha256: lock.releaseArtifactSha256,
    environmentConfigSha256: lock.environmentConfigSha256,
    expectedPriorRegistryHashSha256: currentHash,
    reviewPacketHashSha256: lock.reviewPacketHashSha256,
    freshReviewerDesignationHashSha256: lock.freshReviewerDesignationHashSha256,
    freshReviewerLifecycleLockHashSha256: lock.freshReviewerLifecycleLockHashSha256,
    verifiedFreshReviewRecordHashSha256: lock.verifiedFreshReviewRecordHashSha256,
  };
  const manifestHash = hashObject(freshManifestCore(manifest));
  const plan = {
    schemaVersion: 1,
    activationChangeId: 'activation:p55',
    cycleId: lock.cycleId,
    freshReactivationGovernanceCycleHashSha256: lock.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p55',
    preparedAt: '2026-09-10T12:05:00.000Z',
    freshReviewerLifecycleLockHashSha256: lock.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest: manifest,
    freshSuccessorBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: currentHash,
      freshReactivationGovernanceCycleHashSha256: lock.freshReactivationGovernanceCycleHashSha256,
      freshReviewerLifecycleLockHashSha256: lock.freshReviewerLifecycleLockHashSha256,
    },
  };
  plan.freshActivationPlanHashSha256 = hashObject(p50PlanCore(plan));
  return {
    ...plan,
    status: P50_STATUS.FRESH_REACTIVATION_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
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
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function shadowFixture(lock, plan, currentHash) {
  const shadow = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: plan.cycleId,
    freshReactivationGovernanceCycleHashSha256: plan.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: lock.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: plan.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: h('a'),
    currentRegistryHashSha256: currentHash,
    candidateRegistryHashSha256: h('b'),
    candidateRegistryContentSha256: h('c'),
    freshCompositeEvidenceHashSha256: h('d'),
  };
  shadow.freshShadowEvaluationHashSha256 = hashObject(p53ShadowCore(shadow));
  return {
    ...shadow,
    status: P53_STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: [],
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
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

(() => {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const lock = reviewerLockFixture(current.registryHashSha256);
  const plan = activationPlanFixture(lock, current.registryHashSha256);
  const shadow = shadowFixture(lock, plan, current.registryHashSha256);
  const rehearsal = runFreshCompositeCutoverRehearsal({
    currentRegistry,
    freshShadowEvaluation: shadow,
    rehearsalId: 'rehearsal:p55',
    preparedByRef: 'operator:p55',
    preparedAt: '2026-09-10T12:10:00.000Z',
  });

  const input = {
    currentRegistry,
    reviewerLifecycle: lock,
    activationPlan: plan,
    freshShadowEvaluation: shadow,
    freshRehearsalResult: rehearsal,
  };
  const success = evaluateFreshCompositeCutoverSafetyGuard(input);
  assert.strictEqual(success.status, STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.reviewerLockVerified, true);
  assert.strictEqual(success.activationPlanVerified, true);
  assert.strictEqual(success.shadowMatchVerified, true);
  assert.strictEqual(success.rollbackRehearsalVerified, true);
  assert.strictEqual(success.exactRollbackIdentityVerified, true);
  assert.strictEqual(success.activationAuthorized, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = evaluateFreshCompositeCutoverSafetyGuard(input);
  assert.strictEqual(deterministic.freshCutoverSafetyGuardHashSha256, success.freshCutoverSafetyGuardHashSha256);

  const tamperedLock = { ...lock, reviewerRef: 'reviewer:tampered' };
  const lockResult = evaluateFreshCompositeCutoverSafetyGuard({ ...input, reviewerLifecycle: tamperedLock });
  assert(lockResult.blockers.includes('P49_FRESH_REVIEWER_LIFECYCLE_HASH_MISMATCH'));

  const tamperedPlan = { ...plan, cycleId: 'cycle:tampered' };
  const planResult = evaluateFreshCompositeCutoverSafetyGuard({ ...input, activationPlan: tamperedPlan });
  assert(planResult.blockers.some((code) => code.includes('P50_')));

  const tamperedShadow = { ...shadow, freshActivationPlanHashSha256: h('e') };
  const shadowResult = evaluateFreshCompositeCutoverSafetyGuard({ ...input, freshShadowEvaluation: tamperedShadow });
  assert(shadowResult.blockers.some((code) => code.includes('P53_')));

  const tamperedRehearsal = { ...rehearsal, rollbackRestoresExactAuthoritativeRegistry: false };
  const rehearsalResult = evaluateFreshCompositeCutoverSafetyGuard({ ...input, freshRehearsalResult: tamperedRehearsal });
  assert(rehearsalResult.blockers.includes('P54_FRESH_REHEARSAL_BOUNDARY_INVALID'));

  const escalation = evaluateFreshCompositeCutoverSafetyGuard({ ...input, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = evaluateFreshCompositeCutoverSafetyGuard({ ...input, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--shadow', 'a.json', '--shadow', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P55 fresh composite cutover safety guard: PASS');
})();
