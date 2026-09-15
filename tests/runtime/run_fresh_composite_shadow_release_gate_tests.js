'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
const { verifyFreshCompositeEvidence } = require('../../src/qualification/fresh-composite-evidence-verifier');
const {
  STATUS,
  evaluateFreshCompositeShadow,
} = require('../../src/qualification/fresh-composite-shadow-release-gate');
const {
  STATUS: GATE_STATUS,
  parseArgs,
  evaluateFreshCompositeShadowFromEnvironment,
} = require('../../tools/fresh-composite-shadow-release-gate');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashBytes = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const releaseArtifactBytes = Buffer.from('fresh-release-artifact-p53\n');
const environmentConfigBytes = Buffer.from('{"environment":"fresh-p53"}\n');
const sourceCommit = 'c'.repeat(40);

function activationPlanFixture() {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p53',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p53',
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
    activationChangeId: 'activation-change:p53',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p53',
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
  const plan = activationPlanFixture();
  const candidate = createFreshCompositeRegistryCandidate({ activationPlan: plan, currentRegistry });
  const evidence = verifyFreshCompositeEvidence({
    candidate,
    currentRegistry,
    observedSourceCommitSha: sourceCommit,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'fresh-evidence:p53',
    evidenceOperatorRef: 'operator:p53',
    verifiedAt: '2026-09-10T11:45:00.000Z',
    releaseArtifactRef: 'artifact:fresh-p53',
    environmentConfigRef: 'config:fresh-p53',
  });

  const success = evaluateFreshCompositeShadow({
    currentRegistry,
    freshCompositeCandidate: candidate,
    freshCompositeEvidence: evidence,
  });
  assert.strictEqual(success.status, STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.shadowComparisonMatch, true);
  assert.strictEqual(success.authoritativeBaselineRemainsLegacy, true);
  assert.strictEqual(success.activationAuthorized, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate: candidate, freshCompositeEvidence: evidence });
  assert.strictEqual(deterministic.freshShadowEvaluationHashSha256, success.freshShadowEvaluationHashSha256);

  const tamperedEvidence = { ...evidence, cycleId: 'cycle:tampered' };
  const evidenceTamperResult = evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate: candidate, freshCompositeEvidence: tamperedEvidence });
  assert(evidenceTamperResult.blockers.includes('P52_FRESH_COMPOSITE_EVIDENCE_HASH_MISMATCH'));

  const tamperedCandidate = { ...candidate, currentRegistryHashSha256: h('9') };
  const candidateTamperResult = evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate: tamperedCandidate, freshCompositeEvidence: evidence });
  assert(candidateTamperResult.blockers.some((code) => code.includes('P51_') || code.includes('FRESH_SHADOW_')));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.evidenceStatus = 'FABRICATED';
  const driftResult = evaluateFreshCompositeShadow({ currentRegistry: driftedRegistry, freshCompositeCandidate: candidate, freshCompositeEvidence: evidence });
  assert(driftResult.blockers.includes('CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'));

  const missingEvidence = evaluateFreshCompositeShadow({ currentRegistry, freshCompositeCandidate: candidate });
  assert(missingEvidence.blockers.includes('P52_FRESH_COMPOSITE_EVIDENCE_REQUIRED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'p53-'));
  try {
    const candidatePath = path.join(temp, 'candidate.json');
    const evidencePath = path.join(temp, 'evidence.json');
    fs.writeFileSync(candidatePath, JSON.stringify(candidate));
    fs.writeFileSync(evidencePath, JSON.stringify(evidence));

    const gate = evaluateFreshCompositeShadowFromEnvironment({
      env: {
        FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: candidatePath,
        FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH: evidencePath,
        REQUIRE_FRESH_COMPOSITE_SHADOW: '1',
      },
    });
    assert.strictEqual(gate.status, GATE_STATUS.VERIFIED);
    assert.strictEqual(gate.verified, true);

    const notEvaluated = evaluateFreshCompositeShadowFromEnvironment({ env: {} });
    assert.strictEqual(notEvaluated.status, GATE_STATUS.NOT_EVALUATED);

    const requiredMissing = evaluateFreshCompositeShadowFromEnvironment({ env: { REQUIRE_FRESH_COMPOSITE_SHADOW: '1' } });
    assert.strictEqual(requiredMissing.status, GATE_STATUS.MISSING_REQUIRED);

    const partial = evaluateFreshCompositeShadowFromEnvironment({ env: { FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: candidatePath } });
    assert.strictEqual(partial.status, GATE_STATUS.HOLD);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log('P53 fresh composite shadow release gate: PASS');
})();
