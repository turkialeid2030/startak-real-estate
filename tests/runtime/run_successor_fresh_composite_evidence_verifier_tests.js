'use strict';

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {
  AUTHORITY,
  stableStringify,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P68_STATUS } = require('../../src/qualification/successor-fresh-activation-plan');
const {
  successorManifestCore,
  p68PlanCore,
  createSuccessorFreshCompositeRegistryCandidate,
} = require('../../src/qualification/successor-fresh-composite-registry-candidate');
const {
  STATUS,
  verifySuccessorFreshCompositeEvidence,
} = require('../../src/qualification/successor-fresh-composite-evidence-verifier');
const { parseArgs } = require('../../tools/successor-fresh-composite-evidence-verifier');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p70:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPlan(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'successor-fresh-reactivation:successor-cycle-005',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'successor-cycle-005',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    qualifiedSourceCommitSha: 'd'.repeat(40),
    releaseArtifactSha256: sha256Bytes(releaseArtifactBytes),
    environmentConfigSha256: sha256Bytes(environmentConfigBytes),
    expectedPriorRegistryHashSha256: observed.registryHashSha256,
    expectedPriorRegistryContentSha256: sha256Text(currentRegistryContent),
    successorFreshReviewPacketHashSha256: h('review-packet'),
    successorFreshReviewerDesignationHashSha256: h('reviewer-designation'),
    successorFreshReviewerLifecycleLockHashSha256: h('reviewer-lock'),
    verifiedSuccessorFreshReviewRecordHashSha256: h('verified-review'),
    cycleEvidenceArtifactSha256: h('cycle-evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
  };
  const manifestHash = sha256Object(successorManifestCore(manifest));
  const core = {
    schemaVersion: 1,
    activationChangeId: 'successor-activation-change-003',
    cycleId: manifest.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:successor',
    preparedAt: '2026-09-10T20:40:00.000Z',
    successorFreshReviewerLifecycleLockHashSha256: manifest.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshBaselineManifest: manifest,
    successorFreshBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: 'LEGACY_FILE_SHA256',
      proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
      expectedPriorRegistryHashSha256: manifest.expectedPriorRegistryHashSha256,
      expectedPriorRegistryContentSha256: manifest.expectedPriorRegistryContentSha256,
      successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
      successorFreshReviewerLifecycleLockHashSha256: manifest.successorFreshReviewerLifecycleLockHashSha256,
    },
  };
  return {
    ...core,
    status: P68_STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshActivationPlanHashSha256: sha256Object(p68PlanCore(core)),
    explicitActivationChangeRequired: true,
    activationAuthorized: false,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorActivationPlanReusable: false,
    predecessorOwnerAuthorizationReusable: false,
    predecessorActivationContractReusable: false,
    successorFreshCompositeRegistryCandidateRequired: true,
    successorFreshShadowEvidenceRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

(function run() {
  const currentRegistryContent = fs.readFileSync('config/governance/canonical-baseline.json', 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const releaseArtifactBytes = Buffer.from('p70-release-artifact\n', 'utf8');
  const environmentConfigBytes = Buffer.from('p70-environment-config\n', 'utf8');
  const activationPlan = buildPlan(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes);
  const candidate = createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, currentRegistryContent });
  const input = {
    candidate,
    activationPlan,
    currentRegistry,
    currentRegistryContent,
    observedSourceCommitSha: activationPlan.successorFreshBaselineManifest.qualifiedSourceCommitSha,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'successor-evidence-001',
    evidenceOperatorRef: 'operator:successor-evidence',
    verifiedAt: '2026-09-10T20:45:00.000Z',
    releaseArtifactRef: 'artifact://successor/release/001',
    environmentConfigRef: 'config://successor/environment/001',
  };

  const result = verifySuccessorFreshCompositeEvidence(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_MATCH_NOT_ACTIVE);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.candidateEvidenceMatched, true);
  assert.strictEqual(result.sourceCommitMatched, true);
  assert.strictEqual(result.releaseArtifactMatched, true);
  assert.strictEqual(result.environmentConfigMatched, true);
  assert.strictEqual(result.candidateRecomputedFromP68, true);
  assert.strictEqual(result.exactPriorRawRegistryVerified, true);
  assert.strictEqual(result.candidateOnly, true);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.match(result.successorFreshCompositeEvidenceHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(verifySuccessorFreshCompositeEvidence(input).successorFreshCompositeEvidenceHashSha256, result.successorFreshCompositeEvidenceHashSha256);

  const wrongCommit = verifySuccessorFreshCompositeEvidence({ ...input, observedSourceCommitSha: 'e'.repeat(40) });
  assert.strictEqual(wrongCommit.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(wrongCommit.blockers.includes('SUCCESSOR_FRESH_COMPOSITE_SOURCE_COMMIT_MISMATCH'));

  const badArtifact = verifySuccessorFreshCompositeEvidence({ ...input, releaseArtifactBytes: Buffer.from('wrong') });
  assert.strictEqual(badArtifact.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(badArtifact.blockers.includes('SUCCESSOR_FRESH_COMPOSITE_RELEASE_ARTIFACT_HASH_MISMATCH'));

  const badEnv = verifySuccessorFreshCompositeEvidence({ ...input, environmentConfigBytes: Buffer.from('wrong-env') });
  assert.strictEqual(badEnv.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(badEnv.blockers.includes('SUCCESSOR_FRESH_COMPOSITE_ENVIRONMENT_CONFIG_HASH_MISMATCH'));

  const driftedRaw = verifySuccessorFreshCompositeEvidence({ ...input, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(driftedRaw.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(driftedRaw.blockers.includes('CURRENT_REGISTRY_CONTENT_HASH_MISMATCH'));

  const tamperedPlan = JSON.parse(JSON.stringify(activationPlan));
  tamperedPlan.successorFreshBaselineManifest.releaseArtifactSha256 = h('tampered-release');
  const recomputationFailure = verifySuccessorFreshCompositeEvidence({ ...input, activationPlan: tamperedPlan });
  assert.strictEqual(recomputationFailure.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(recomputationFailure.blockers.includes('P69_CANDIDATE_RECOMPUTATION_FAILED'));

  const tamperedCandidate = JSON.parse(JSON.stringify(candidate));
  tamperedCandidate.candidateRegistryContentSha256 = h('tampered-candidate-content');
  const badCandidate = verifySuccessorFreshCompositeEvidence({ ...input, candidate: tamperedCandidate });
  assert.strictEqual(badCandidate.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);

  const escalated = verifySuccessorFreshCompositeEvidence({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = verifySuccessorFreshCompositeEvidence({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE);
  assert(keyMaterial.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--secret-key', 'secret.pem']), /private or secret key argument rejected/);

  process.stdout.write('P70 successor fresh composite evidence verifier tests passed\n');
})();
