'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MODE,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P30_STATUS } = require('../../src/qualification/canonical-rebaseline-reviewer-lifecycle');
const { STATUS: P31_STATUS } = require('../../src/qualification/canonical-rebaseline-activation-plan');
const { STATUS: P36_STATUS } = require('../../src/qualification/composite-baseline-shadow-release-gate');
const { STATUS: P37_STATUS } = require('../../src/qualification/composite-baseline-cutover-rehearsal');
const {
  STATUS: P38_STATUS,
  evaluateCompositeBaselineCutoverSafetyGuard,
} = require('../../src/qualification/composite-baseline-cutover-safety-guard');
const {
  STATUS: TOOL_STATUS,
  evaluateCompositeBaselineCutoverSafetyFromEnvironment,
} = require('../../tools/composite-baseline-cutover-safety-gate');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const currentRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function authorityFalse() {
  return {
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function fixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const reviewerCore = {
    schemaVersion: 1,
    ledgerHashSha256: '1'.repeat(64),
    currentDesignationHashSha256: '2'.repeat(64),
    currentReviewerRef: 'reviewer:saeed-pending',
    currentReviewerDisplayName: 'سعيد المراجع',
    reviewRequestId: 'review-request-p38-fixture',
    reviewPacketHashSha256: '3'.repeat(64),
    verifiedReviewResponseHashSha256: '4'.repeat(64),
  };
  const reviewerLifecycle = {
    ...reviewerCore,
    status: P30_STATUS.REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    reviewerLockHashSha256: sha256Object(reviewerCore),
    blockers: [],
    ownerMayReplaceReviewerBeforeAcceptedReview: false,
    reviewerReplacementAllowedNow: false,
    independentReviewCompleted: true,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerRegistryTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    ...authorityFalse(),
  };

  const manifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:p38-fixture',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: 'b'.repeat(64),
    environmentConfigSha256: 'c'.repeat(64),
    supersedesLegacyCanonicalSha256: currentRegistry.legacyBaseline.expectedSha256,
    governanceDecisionHashSha256: '5'.repeat(64),
    reviewerLockHashSha256: reviewerLifecycle.reviewerLockHashSha256,
  };
  const successorBaselineManifestHashSha256 = sha256Object(manifest);
  const planCore = {
    schemaVersion: 1,
    activationChangeId: 'activation-change-p38-fixture',
    proposalId: 'p38-fixture',
    proposalHashSha256: '6'.repeat(64),
    preparedByRef: 'owner:test',
    preparedAt: '2026-09-10T07:00:00.000Z',
    successorBaselineManifest: manifest,
    successorBaselineManifestHashSha256,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedLegacyCanonicalSha256: currentRegistry.legacyBaseline.expectedSha256,
    },
  };
  const activationPlan = {
    ...planCore,
    status: P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN,
    activationPlanHashSha256: sha256Object(planCore),
    blockers: [],
    explicitCodeChangeRequired: true,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    externalReviewerDecisionAlreadyRequired: true,
    ...authorityFalse(),
  };

  const shadowCore = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: '7'.repeat(64),
    compositeEvidenceHashSha256: '8'.repeat(64),
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    successorBaselineManifestHashSha256,
  };
  const shadowEvaluation = {
    ...shadowCore,
    status: P36_STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE,
    shadowEvaluationHashSha256: sha256Object(shadowCore),
    blockers: [],
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    activationApplied: false,
    authoritativeBaselineRemainsLegacy: true,
    independentReviewStillRequiredForRealActivation: true,
    explicitActivationCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...authorityFalse(),
  };

  const transitions = [
    {
      sequence: 0,
      mode: MODE.LEGACY_FILE_SHA256,
      registryHashSha256: current.registryHashSha256,
      authoritative: true,
    },
    {
      sequence: 1,
      mode: MODE.GOVERNED_COMPOSITE_BASELINE,
      sourceCandidateRegistryHashSha256: shadowEvaluation.candidateRegistryHashSha256,
      sourceCompositeEvidenceHashSha256: shadowEvaluation.compositeEvidenceHashSha256,
      sourceActivationPlanHashSha256: shadowEvaluation.activationPlanHashSha256,
      sourceSuccessorBaselineManifestHashSha256: shadowEvaluation.successorBaselineManifestHashSha256,
      shadowEvaluationHashSha256: shadowEvaluation.shadowEvaluationHashSha256,
      authoritative: false,
      simulated: true,
    },
    {
      sequence: 2,
      mode: MODE.LEGACY_FILE_SHA256,
      registryHashSha256: current.registryHashSha256,
      authoritative: true,
      simulated: true,
      restoresInitialRegistryHashExactly: true,
    },
  ];
  const rehearsalCore = {
    schemaVersion: 1,
    rehearsalId: 'p38-rehearsal-fixture',
    preparedByRef: 'owner:test',
    preparedAt: '2026-09-10T07:10:00.000Z',
    currentRegistryHashSha256: current.registryHashSha256,
    shadowEvaluationHashSha256: shadowEvaluation.shadowEvaluationHashSha256,
    transitions,
  };
  const rehearsalResult = {
    ...rehearsalCore,
    status: P37_STATUS.CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION,
    rehearsalHashSha256: sha256Object(rehearsalCore),
    blockers: [],
    cutoverSimulated: true,
    rollbackSimulated: true,
    rollbackRestoresExactAuthoritativeRegistry: true,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    simulationOnly: true,
    activationApplied: false,
    independentReviewStillRequiredForRealActivation: true,
    explicitActivationCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...authorityFalse(),
  };

  return { reviewerLifecycle, activationPlan, shadowEvaluation, rehearsalResult };
}

(function run() {
  const base = fixture();
  const pass = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base });
  assert.strictEqual(pass.status, P38_STATUS.CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED);
  assert.strictEqual(pass.reviewerLockVerified, true);
  assert.strictEqual(pass.activationPlanVerified, true);
  assert.strictEqual(pass.shadowMatchVerified, true);
  assert.strictEqual(pass.rollbackRehearsalVerified, true);
  assert.strictEqual(pass.exactRollbackIdentityVerified, true);
  assert.strictEqual(pass.activationAuthorizationGranted, false);
  assert.strictEqual(pass.activationApplied, false);
  assert.strictEqual(pass.releaseAuthorized, false);
  assert.strictEqual(pass.mergeAuthorized, false);
  assert.strictEqual(pass.deploymentAuthorized, false);
  assert.strictEqual(pass.goLiveAuthorized, false);
  assert.strictEqual(pass.transactionAuthorized, false);

  const deterministic = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base });
  assert.strictEqual(deterministic.cutoverSafetyGuardHashSha256, pass.cutoverSafetyGuardHashSha256);

  const mutableReviewer = { ...base.reviewerLifecycle, status: P30_STATUS.REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW };
  const reviewerHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base, reviewerLifecycle: mutableReviewer });
  assert.strictEqual(reviewerHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(reviewerHold.blockers.includes('P30_VERIFIED_REVIEWER_LIFECYCLE_LOCK_REQUIRED'));

  const badReviewerHash = { ...base.reviewerLifecycle, reviewerLockHashSha256: '9'.repeat(64) };
  const reviewerHashHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base, reviewerLifecycle: badReviewerHash });
  assert.strictEqual(reviewerHashHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(reviewerHashHold.blockers.includes('P30_REVIEWER_LOCK_HASH_MISMATCH'));
  assert(reviewerHashHold.blockers.includes('P31_REVIEWER_LOCK_BINDING_MISMATCH'));

  const badPlan = { ...base.activationPlan, activationPlanHashSha256: 'a'.repeat(64) };
  const planHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base, activationPlan: badPlan });
  assert.strictEqual(planHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(planHold.blockers.includes('P31_ACTIVATION_PLAN_HASH_MISMATCH'));
  assert(planHold.blockers.includes('P36_ACTIVATION_PLAN_BINDING_MISMATCH'));

  const badShadow = { ...base.shadowEvaluation, releaseAuthorized: true };
  const shadowHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base, shadowEvaluation: badShadow });
  assert.strictEqual(shadowHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(shadowHold.blockers.includes('P36_SHADOW_BOUNDARY_INVALID'));

  const badRollback = JSON.parse(JSON.stringify(base.rehearsalResult));
  badRollback.transitions[2].registryHashSha256 = 'f'.repeat(64);
  const rollbackHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry, ...base, rehearsalResult: badRollback });
  assert.strictEqual(rollbackHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(rollbackHold.blockers.includes('P37_EXACT_ROLLBACK_IDENTITY_NOT_PROVEN'));
  assert(rollbackHold.blockers.includes('P37_REHEARSAL_HASH_MISMATCH'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.activeMode = MODE.GOVERNED_COMPOSITE_BASELINE;
  const registryHold = evaluateCompositeBaselineCutoverSafetyGuard({ currentRegistry: driftedRegistry, ...base });
  assert.strictEqual(registryHold.status, P38_STATUS.HOLD_CUTOVER_SAFETY_GUARD);
  assert(registryHold.blockers.includes('CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'));

  const absent = evaluateCompositeBaselineCutoverSafetyFromEnvironment({ env: {} });
  assert.strictEqual(absent.status, TOOL_STATUS.NOT_EVALUATED);
  assert.strictEqual(absent.verified, false);

  const requiredAbsent = evaluateCompositeBaselineCutoverSafetyFromEnvironment({ env: { REQUIRE_COMPOSITE_CUTOVER_SAFETY: '1' } });
  assert.strictEqual(requiredAbsent.status, TOOL_STATUS.MISSING_REQUIRED);

  const partial = evaluateCompositeBaselineCutoverSafetyFromEnvironment({
    env: { COMPOSITE_CUTOVER_ACTIVATION_PLAN_PATH: '/tmp/only-plan.json' },
  });
  assert.strictEqual(partial.status, TOOL_STATUS.HOLD);
  assert.strictEqual(partial.reasonCode, 'COMPOSITE_CUTOVER_SAFETY_PARTIAL_INPUT');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p38-'));
  try {
    const files = {
      reviewer: path.join(dir, 'reviewer.json'),
      plan: path.join(dir, 'plan.json'),
      shadow: path.join(dir, 'shadow.json'),
      rehearsal: path.join(dir, 'rehearsal.json'),
    };
    fs.writeFileSync(files.reviewer, JSON.stringify(base.reviewerLifecycle));
    fs.writeFileSync(files.plan, JSON.stringify(base.activationPlan));
    fs.writeFileSync(files.shadow, JSON.stringify(base.shadowEvaluation));
    fs.writeFileSync(files.rehearsal, JSON.stringify(base.rehearsalResult));

    const toolPass = evaluateCompositeBaselineCutoverSafetyFromEnvironment({
      env: {
        REQUIRE_COMPOSITE_CUTOVER_SAFETY: '1',
        COMPOSITE_CUTOVER_REVIEWER_LIFECYCLE_PATH: files.reviewer,
        COMPOSITE_CUTOVER_ACTIVATION_PLAN_PATH: files.plan,
        COMPOSITE_CUTOVER_SHADOW_PATH: files.shadow,
        COMPOSITE_CUTOVER_REHEARSAL_PATH: files.rehearsal,
      },
    });
    assert.strictEqual(toolPass.status, TOOL_STATUS.VERIFIED);
    assert.strictEqual(toolPass.verified, true);
    assert.strictEqual(toolPass.exactRollbackIdentityVerified, true);
    assert.strictEqual(toolPass.activationAuthorizationGranted, false);
    const serialized = JSON.stringify(toolPass);
    for (const p of Object.values(files)) assert(!serialized.includes(p));
    assert(!serialized.includes('private-key'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P38 composite baseline cutover safety guard: PASS');
})();
