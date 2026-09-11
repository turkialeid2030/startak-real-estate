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
  freshManifestCore,
  p50PlanCore,
  createFreshCompositeRegistryCandidate,
} = require('../../src/qualification/fresh-composite-registry-candidate');
const {
  STATUS,
  verifyFreshCompositeEvidence,
} = require('../../src/qualification/fresh-composite-evidence-verifier');
const { parseArgs } = require('../../tools/fresh-composite-evidence-verifier');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashBytes = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);

const releaseArtifactBytes = Buffer.from('fresh-release-artifact-p52\n');
const environmentConfigBytes = Buffer.from('{"environment":"fresh-p52"}\n');
const sourceCommit = 'a'.repeat(40);

function activationPlanFixture() {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p52',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p52',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    qualifiedSourceCommitSha: sourceCommit,
    releaseArtifactSha256: hashBytes(releaseArtifactBytes),
    environmentConfigSha256: hashBytes(environmentConfigBytes),
    expectedPriorRegistryHashSha256: observed.registryHashSha256,
    reviewPacketHashSha256: h('4'),
    freshReviewerDesignationHashSha256: h('5'),
    freshReviewerLifecycleLockHashSha256: h('6'),
    verifiedFreshReviewRecordHashSha256: h('7'),
  };
  const manifestHash = hashObject(freshManifestCore(manifest));
  const plan = {
    schemaVersion: 1,
    activationChangeId: 'activation-change:p52',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p52',
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
  const candidate = createFreshCompositeRegistryCandidate({ activationPlan, currentRegistry });
  const baseInput = {
    candidate,
    currentRegistry,
    observedSourceCommitSha: sourceCommit,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'fresh-evidence:p52',
    evidenceOperatorRef: 'operator:p52',
    verifiedAt: '2026-09-10T11:45:00.000Z',
    releaseArtifactRef: 'artifact:fresh-p52',
    environmentConfigRef: 'config:fresh-p52',
  };

  const success = verifyFreshCompositeEvidence(baseInput);
  assert.strictEqual(success.status, STATUS.FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.candidateEvidenceMatched, true);
  assert.strictEqual(success.sourceCommitMatched, true);
  assert.strictEqual(success.releaseArtifactMatched, true);
  assert.strictEqual(success.environmentConfigMatched, true);
  assert.strictEqual(success.activeRegistryChanged, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = verifyFreshCompositeEvidence(baseInput);
  assert.strictEqual(deterministic.freshCompositeEvidenceHashSha256, success.freshCompositeEvidenceHashSha256);

  const wrongCommit = verifyFreshCompositeEvidence({ ...baseInput, observedSourceCommitSha: 'b'.repeat(40) });
  assert(wrongCommit.blockers.includes('FRESH_COMPOSITE_SOURCE_COMMIT_MISMATCH'));

  const wrongArtifact = verifyFreshCompositeEvidence({ ...baseInput, releaseArtifactBytes: Buffer.from('tampered') });
  assert(wrongArtifact.blockers.includes('FRESH_COMPOSITE_RELEASE_ARTIFACT_HASH_MISMATCH'));

  const wrongConfig = verifyFreshCompositeEvidence({ ...baseInput, environmentConfigBytes: Buffer.from('tampered') });
  assert(wrongConfig.blockers.includes('FRESH_COMPOSITE_ENVIRONMENT_CONFIG_HASH_MISMATCH'));

  const candidateTamper = { ...candidate, cycleId: 'cycle:tampered' };
  const candidateTamperResult = verifyFreshCompositeEvidence({ ...baseInput, candidate: candidateTamper });
  assert(candidateTamperResult.blockers.includes('P51_CANDIDATE_RECORD_HASH_MISMATCH'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.evidenceStatus = 'FABRICATED';
  const drift = verifyFreshCompositeEvidence({ ...baseInput, currentRegistry: driftedRegistry });
  assert(drift.blockers.includes('CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED'));

  const noArtifactBytes = verifyFreshCompositeEvidence({ ...baseInput, releaseArtifactBytes: 'not-a-buffer' });
  assert(noArtifactBytes.blockers.includes('RELEASE_ARTIFACT_BYTES_REQUIRED'));

  const escalation = verifyFreshCompositeEvidence({ ...baseInput, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = verifyFreshCompositeEvidence({ ...baseInput, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  console.log('P52 fresh composite evidence verifier: PASS');
})();
