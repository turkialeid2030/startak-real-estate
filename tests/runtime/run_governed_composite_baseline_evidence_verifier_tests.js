'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  createGovernedCompositeBaselineRegistryCandidate,
  STATUS: P32_STATUS,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P31_STATUS } = require('../../src/qualification/canonical-rebaseline-activation-plan');
const {
  STATUS,
  verifyGovernedCompositeBaselineEvidence,
  sha256Bytes,
} = require('../../src/qualification/governed-composite-baseline-evidence-verifier');

const COMMIT = 'a'.repeat(40);
const LEGACY = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';
const ARTIFACT = Buffer.from('release-artifact-bytes-p34', 'utf8');
const ENVIRONMENT = Buffer.from('DATABASE_URL=super-secret-never-serialize\nFEATURE_X=1', 'utf8');

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function activationPlan() {
  const successorBaselineManifest = {
    schemaVersion: 1,
    baselineId: 'canonical-rebaseline:p34-fixture',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: sha256Bytes(ARTIFACT, 'artifact'),
    environmentConfigSha256: sha256Bytes(ENVIRONMENT, 'environment'),
    supersedesLegacyCanonicalSha256: LEGACY,
    governanceDecisionHashSha256: 'b'.repeat(64),
    reviewerLockHashSha256: 'c'.repeat(64),
  };
  return {
    status: P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN,
    activationPlanHashSha256: 'd'.repeat(64),
    successorBaselineManifest,
    successorBaselineManifestHashSha256: sha256Object(successorBaselineManifest),
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: 'LEGACY_FILE_SHA256',
      proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
      expectedLegacyCanonicalSha256: LEGACY,
    },
    activationApplied: false,
    canonicalBaselineChanged: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function candidate() {
  const result = createGovernedCompositeBaselineRegistryCandidate({ activationPlan: activationPlan() });
  assert.strictEqual(result.status, P32_STATUS.COMPOSITE_REGISTRY_CANDIDATE_READY_FOR_EXPLICIT_CODE_CHANGE);
  return result;
}

function verify(overrides = {}) {
  return verifyGovernedCompositeBaselineEvidence({
    currentRegistry,
    compositeCandidate: candidate(),
    observedQualifiedSourceCommitSha: COMMIT,
    releaseArtifactBytes: ARTIFACT,
    environmentConfigBytes: ENVIRONMENT,
    verificationId: 'p34-evidence-1',
    verifiedByRef: 'engineering-verifier:p34',
    verifiedAt: '2026-09-10T06:30:00Z',
    ...overrides,
  });
}

(function run() {
  const good = verify();
  assert.strictEqual(good.status, STATUS.COMPOSITE_BASELINE_EVIDENCE_VERIFIED_CANDIDATE_ONLY);
  assert.strictEqual(good.candidateOnly, true);
  assert.strictEqual(good.activationApplied, false);
  assert.strictEqual(good.canonicalBaselineChanged, false);
  assert.strictEqual(good.releaseAuthorized, false);
  assert.strictEqual(good.mergeAuthorized, false);
  assert.strictEqual(good.deploymentAuthorized, false);
  assert.strictEqual(good.goLiveAuthorized, false);
  assert.strictEqual(good.transactionAuthorized, false);
  assert.match(good.compositeEvidenceHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(good.observedReleaseArtifactSha256, sha256Bytes(ARTIFACT, 'artifact'));
  assert.strictEqual(good.observedEnvironmentConfigSha256, sha256Bytes(ENVIRONMENT, 'environment'));
  assert.strictEqual(good.rawReleaseArtifactSerialized, false);
  assert.strictEqual(good.rawEnvironmentConfigSerialized, false);
  assert.strictEqual(JSON.stringify(good).includes('super-secret-never-serialize'), false);

  const deterministic = verify();
  assert.strictEqual(deterministic.compositeEvidenceHashSha256, good.compositeEvidenceHashSha256);

  const artifactMismatch = verify({ releaseArtifactBytes: Buffer.from('wrong-artifact') });
  assert.strictEqual(artifactMismatch.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(artifactMismatch.blockers.includes('RELEASE_ARTIFACT_SHA256_MISMATCH'));

  const envMismatch = verify({ environmentConfigBytes: Buffer.from('wrong-environment') });
  assert.strictEqual(envMismatch.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(envMismatch.blockers.includes('ENVIRONMENT_CONFIG_SHA256_MISMATCH'));

  const commitMismatch = verify({ observedQualifiedSourceCommitSha: 'f'.repeat(40) });
  assert.strictEqual(commitMismatch.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(commitMismatch.blockers.includes('QUALIFIED_SOURCE_COMMIT_SHA_MISMATCH'));

  const switchedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  switchedRegistry.activeMode = 'GOVERNED_COMPOSITE_BASELINE';
  const registryHold = verify({ currentRegistry: switchedRegistry });
  assert.strictEqual(registryHold.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(registryHold.blockers.includes('CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'));

  const tamperedCandidate = { ...candidate(), releaseAuthorized: true };
  const authorityHold = verify({ compositeCandidate: tamperedCandidate });
  assert.strictEqual(authorityHold.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(authorityHold.blockers.includes('P32_COMPOSITE_CANDIDATE_AUTHORITY_BOUNDARY_INVALID'));

  const tamperedManifestCandidate = JSON.parse(JSON.stringify(candidate()));
  tamperedManifestCandidate.successorBaselineManifest.environmentConfigSha256 = 'e'.repeat(64);
  const manifestHold = verify({ compositeCandidate: tamperedManifestCandidate });
  assert.strictEqual(manifestHold.status, STATUS.HOLD_COMPOSITE_BASELINE_EVIDENCE);
  assert.ok(manifestHold.blockers.includes('P32_SUCCESSOR_BASELINE_MANIFEST_HASH_MISMATCH'));

  console.log('governed composite baseline evidence verifier tests: PASS');
})();
