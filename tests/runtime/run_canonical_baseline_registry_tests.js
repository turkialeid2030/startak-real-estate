'use strict';

const assert = require('assert');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const { STATUS: P31_STATUS } = require('../../src/qualification/canonical-rebaseline-activation-plan');
const {
  MODE,
  STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  createGovernedCompositeBaselineRegistryCandidate,
} = require('../../src/qualification/canonical-baseline-registry');

const H64 = (c) => c.repeat(64);
const LEGACY_SHA = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';

(function run() {
  const confirmed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  assert.strictEqual(confirmed.status, STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED);
  assert.strictEqual(confirmed.activeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(confirmed.activationApplied, false);
  assert.strictEqual(confirmed.canonicalBaselineChanged, false);
  assert.strictEqual(confirmed.releaseAuthorized, false);
  assert.match(confirmed.registryHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(Object.isFrozen(confirmed), true);

  const unknownField = evaluateCurrentCanonicalBaselineRegistry({ ...currentRegistry, releaseNow: true });
  assert.strictEqual(unknownField.status, STATUS.HOLD_CANONICAL_BASELINE_REGISTRY);

  const wrongLegacyHash = evaluateCurrentCanonicalBaselineRegistry({
    ...currentRegistry,
    legacyBaseline: { ...currentRegistry.legacyBaseline, expectedSha256: H64('9') },
  });
  assert.strictEqual(wrongLegacyHash.status, STATUS.HOLD_CANONICAL_BASELINE_REGISTRY);

  const silentModeSwitch = evaluateCurrentCanonicalBaselineRegistry({
    ...currentRegistry,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
  });
  assert.strictEqual(silentModeSwitch.status, STATUS.HOLD_CANONICAL_BASELINE_REGISTRY);

  const fakeP31Plan = {
    status: P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN,
    activationPlanHashSha256: H64('a'),
    successorBaselineManifestHashSha256: H64('b'),
    successorBaselineManifest: {
      schemaVersion: 1,
      baselineId: 'canonical-rebaseline:test',
      baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
      qualifiedSourceCommitSha: '1'.repeat(40),
      releaseArtifactSha256: H64('c'),
      environmentConfigSha256: H64('d'),
      supersedesLegacyCanonicalSha256: LEGACY_SHA,
      governanceDecisionHashSha256: H64('e'),
      reviewerLockHashSha256: H64('f'),
    },
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedLegacyCanonicalSha256: LEGACY_SHA,
    },
    activationApplied: false,
    canonicalBaselineChanged: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };

  const candidate = createGovernedCompositeBaselineRegistryCandidate({ activationPlan: fakeP31Plan });
  assert.strictEqual(candidate.status, STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE);
  assert.strictEqual(candidate.requestedMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(candidate.supersedesMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(candidate.supersedesLegacyCanonicalSha256, LEGACY_SHA);
  assert.strictEqual(candidate.targetPath, 'config/governance/canonical-baseline.json');
  assert.strictEqual(candidate.candidateOnly, true);
  assert.strictEqual(candidate.activationApplied, false);
  assert.strictEqual(candidate.canonicalBaselineChanged, false);
  assert.strictEqual(candidate.releaseAuthorized, false);
  assert.match(candidate.candidateRegistryHashSha256, /^[a-f0-9]{64}$/);

  const missingPlan = createGovernedCompositeBaselineRegistryCandidate({});
  assert.strictEqual(missingPlan.status, STATUS.HOLD_CANONICAL_BASELINE_REGISTRY);

  const authorityTamper = createGovernedCompositeBaselineRegistryCandidate({
    activationPlan: { ...fakeP31Plan, releaseAuthorized: true },
  });
  assert.strictEqual(authorityTamper.status, STATUS.HOLD_CANONICAL_BASELINE_REGISTRY);

  console.log('canonical baseline registry tests: PASS');
})();
