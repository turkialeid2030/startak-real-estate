'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P50_STATUS } = require('../../src/qualification/fresh-reactivation-activation-plan');
const {
  STATUS,
  freshManifestCore,
  p50PlanCore,
  createFreshCompositeRegistryCandidate,
} = require('../../src/qualification/fresh-composite-registry-candidate');
const { parseArgs } = require('../../tools/fresh-composite-registry-candidate');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

function activationPlanFixture() {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p51',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p51',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('2'),
    environmentConfigSha256: h('3'),
    expectedPriorRegistryHashSha256: observed.registryHashSha256,
    reviewPacketHashSha256: h('4'),
    freshReviewerDesignationHashSha256: h('5'),
    freshReviewerLifecycleLockHashSha256: h('6'),
    verifiedFreshReviewRecordHashSha256: h('7'),
  };
  const manifestHash = hashObject(freshManifestCore(manifest));
  const plan = {
    schemaVersion: 1,
    activationChangeId: 'activation-change:p51',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p51',
    preparedAt: '2026-09-10T11:30:00.000Z',
    freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest: manifest,
    freshSuccessorBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: observed.registryHashSha256,
      freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
      freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
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

(() => {
  const activationPlan = activationPlanFixture();
  const baseInput = { activationPlan, currentRegistry };

  const success = createFreshCompositeRegistryCandidate(baseInput);
  assert.strictEqual(success.status, STATUS.FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.candidateOnly, true);
  assert.strictEqual(success.proposedRegistry.schemaVersion, 3);
  assert.strictEqual(success.proposedRegistry.activeMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(success.proposedRegistry.activationApplied, true);
  assert.strictEqual(success.activeRegistryChanged, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(hashObject(success.proposedRegistry), success.candidateRegistryHashSha256);
  assert.strictEqual(hashText(success.proposedRegistryContent), success.candidateRegistryContentSha256);
  assert.strictEqual(success.currentRegistryHashSha256, activationPlan.freshSuccessorBaselineManifest.expectedPriorRegistryHashSha256);

  const deterministic = createFreshCompositeRegistryCandidate(baseInput);
  assert.strictEqual(deterministic.freshCompositeRegistryCandidateHashSha256, success.freshCompositeRegistryCandidateHashSha256);
  assert.strictEqual(deterministic.candidateRegistryHashSha256, success.candidateRegistryHashSha256);

  const planTamper = { ...activationPlan, preparedByRef: 'owner:tampered' };
  const planTamperResult = createFreshCompositeRegistryCandidate({ ...baseInput, activationPlan: planTamper });
  assert(planTamperResult.blockers.includes('P50_FRESH_ACTIVATION_PLAN_HASH_MISMATCH'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.evidenceStatus = 'FABRICATED';
  const drift = createFreshCompositeRegistryCandidate({ activationPlan, currentRegistry: driftedRegistry });
  assert(drift.blockers.includes('CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED'));

  const wrongPrior = JSON.parse(JSON.stringify(activationPlan));
  wrongPrior.freshSuccessorBaselineManifest.expectedPriorRegistryHashSha256 = h('f');
  wrongPrior.freshSuccessorBaselineManifestHashSha256 = hashObject(freshManifestCore(wrongPrior.freshSuccessorBaselineManifest));
  wrongPrior.targetActivationContract.expectedPriorRegistryHashSha256 = h('f');
  wrongPrior.freshActivationPlanHashSha256 = hashObject(p50PlanCore(wrongPrior));
  const wrongPriorResult = createFreshCompositeRegistryCandidate({ activationPlan: wrongPrior, currentRegistry });
  assert(wrongPriorResult.blockers.includes('CURRENT_REGISTRY_HASH_DOES_NOT_MATCH_P50_EXPECTED_PRIOR'));

  const priorReuse = createFreshCompositeRegistryCandidate({ ...baseInput, priorActivationPlanHashSha256: h('a') });
  assert(priorReuse.blockers.some((value) => value.includes('PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED')));

  const escalation = createFreshCompositeRegistryCandidate({ ...baseInput, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = createFreshCompositeRegistryCandidate({ ...baseInput, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--registry', 'a.json', '--registry', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P51 fresh composite registry candidate: PASS');
})();
