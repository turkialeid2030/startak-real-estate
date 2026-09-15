'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MODE,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P31_STATUS } = require('../../src/qualification/canonical-rebaseline-activation-plan');
const { STATUS: P38_STATUS } = require('../../src/qualification/composite-baseline-cutover-safety-guard');
const {
  STATUS: P39_STATUS,
  createCompositeBaselineActivationChangeContract,
} = require('../../src/qualification/composite-baseline-activation-change-contract');

const ROOT = path.join(__dirname, '..', '..');
const currentRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'governance', 'canonical-baseline.json'), 'utf8'));

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function fixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:test-proposal',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: 'b'.repeat(64),
    environmentConfigSha256: 'c'.repeat(64),
    supersedesLegacyCanonicalSha256: currentRegistry.legacyBaseline.expectedSha256,
    governanceDecisionHashSha256: 'd'.repeat(64),
    reviewerLockHashSha256: 'e'.repeat(64),
  };
  const manifestHash = sha256Object(manifest);
  const planCore = {
    schemaVersion: 1,
    activationChangeId: 'activation:test-1',
    proposalId: 'proposal:test-1',
    proposalHashSha256: '1'.repeat(64),
    preparedByRef: 'owner:test',
    preparedAt: '2026-09-10T08:00:00.000Z',
    successorBaselineManifest: manifest,
    successorBaselineManifestHashSha256: manifestHash,
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
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };

  const safetyCore = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current.registryHashSha256,
    reviewerLockHashSha256: manifest.reviewerLockHashSha256,
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    successorBaselineManifestHashSha256: manifestHash,
    shadowEvaluationHashSha256: '2'.repeat(64),
    rehearsalHashSha256: '3'.repeat(64),
  };
  const cutoverSafetyGuard = {
    ...safetyCore,
    status: P38_STATUS.CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED,
    cutoverSafetyGuardHashSha256: sha256Object(safetyCore),
    blockers: [],
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackIdentityVerified: true,
    safetyPrerequisitesSatisfiedForFutureExplicitReviewedActivationChange: true,
    activationAuthorizationGranted: false,
    activationApplied: false,
    explicitReviewedRegistryCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    canonicalBaselineChanged: false,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  return { current, activationPlan, cutoverSafetyGuard };
}

(function run() {
  const { current, activationPlan, cutoverSafetyGuard } = fixture();
  const args = {
    currentRegistry,
    activationPlan,
    cutoverSafetyGuard,
    contractId: 'p39:test-contract',
    preparedByRef: 'owner:test',
    preparedAt: '2026-09-10T08:15:00.000Z',
  };

  const pass = createCompositeBaselineActivationChangeContract(args);
  assert.strictEqual(pass.status, P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED);
  assert.strictEqual(pass.proposedRegistry.activeMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(pass.proposedRegistry.schemaVersion, 2);
  assert.strictEqual(pass.proposedRegistry.activationApplied, true);
  assert.strictEqual(pass.proposedRegistry.canonicalBaselineChanged, true);
  assert.strictEqual(pass.proposedRegistry.releaseAuthorized, false);
  assert.strictEqual(pass.proposedRegistry.mergeAuthorized, false);
  assert.strictEqual(pass.proposedRegistry.deploymentAuthorized, false);
  assert.strictEqual(pass.proposedRegistry.goLiveAuthorized, false);
  assert.strictEqual(pass.proposedRegistry.transactionAuthorized, false);
  assert.strictEqual(pass.rollbackRegistryHashSha256, current.registryHashSha256);
  assert.strictEqual(pass.rollbackRestoresExactCurrentLogicalRegistry, true);
  assert.strictEqual(pass.activationAuthorizationGranted, false);
  assert.strictEqual(pass.actualRegistryMutationPerformed, false);
  assert.strictEqual(pass.activationApplied, false);
  assert.strictEqual(pass.canonicalBaselineChanged, false);
  assert.strictEqual(pass.humanActivationAuthorizationStillRequired, true);
  assert.strictEqual(pass.postActivationReleaseVerifyRequired, true);
  assert.strictEqual(pass.releaseGateImplementationUpdateRequired, true);

  const proposedContentHash = crypto.createHash('sha256').update(pass.proposedRegistryContent, 'utf8').digest('hex');
  const rollbackContentHash = crypto.createHash('sha256').update(pass.rollbackRegistryContent, 'utf8').digest('hex');
  assert.strictEqual(proposedContentHash, pass.proposedRegistryContentSha256);
  assert.strictEqual(rollbackContentHash, pass.rollbackRegistryContentSha256);
  assert.deepStrictEqual(JSON.parse(pass.rollbackRegistryContent), currentRegistry);
  assert.deepStrictEqual(JSON.parse(pass.proposedRegistryContent), pass.proposedRegistry);

  const deterministic = createCompositeBaselineActivationChangeContract(args);
  assert.strictEqual(deterministic.activationChangeContractHashSha256, pass.activationChangeContractHashSha256);
  assert.strictEqual(deterministic.proposedRegistryContentSha256, pass.proposedRegistryContentSha256);
  assert.strictEqual(deterministic.rollbackRegistryContentSha256, pass.rollbackRegistryContentSha256);

  const badSafety = { ...cutoverSafetyGuard, activationAuthorizationGranted: true };
  const safetyHold = createCompositeBaselineActivationChangeContract({ ...args, cutoverSafetyGuard: badSafety });
  assert.strictEqual(safetyHold.status, P39_STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT);
  assert(safetyHold.blockers.includes('P38_CUTOVER_SAFETY_BOUNDARY_INVALID'));

  const tamperedSafety = { ...cutoverSafetyGuard, rehearsalHashSha256: '9'.repeat(64) };
  const hashHold = createCompositeBaselineActivationChangeContract({ ...args, cutoverSafetyGuard: tamperedSafety });
  assert.strictEqual(hashHold.status, P39_STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT);
  assert(hashHold.blockers.includes('P38_CUTOVER_SAFETY_GUARD_HASH_MISMATCH'));

  const badPlan = JSON.parse(JSON.stringify(activationPlan));
  badPlan.successorBaselineManifest.releaseArtifactSha256 = '8'.repeat(64);
  const planHold = createCompositeBaselineActivationChangeContract({ ...args, activationPlan: badPlan });
  assert.strictEqual(planHold.status, P39_STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT);
  assert(planHold.blockers.includes('P31_SUCCESSOR_MANIFEST_HASH_MISMATCH'));

  const ownerHold = createCompositeBaselineActivationChangeContract({ ...args, preparedByRef: 'other:actor' });
  assert.strictEqual(ownerHold.status, P39_STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT);
  assert(ownerHold.blockers.includes('ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_ACTIVATION_PLAN_OWNER'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.activeMode = MODE.GOVERNED_COMPOSITE_BASELINE;
  const registryHold = createCompositeBaselineActivationChangeContract({ ...args, currentRegistry: driftedRegistry });
  assert.strictEqual(registryHold.status, P39_STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT);

  console.log('P39 composite baseline activation change contract: PASS');
})();
