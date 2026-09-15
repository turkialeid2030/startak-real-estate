'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
const { verifySuccessorFreshCompositeEvidence } = require('../../src/qualification/successor-fresh-composite-evidence-verifier');
const {
  STATUS,
  evaluateSuccessorFreshCompositeShadow,
} = require('../../src/qualification/successor-fresh-composite-shadow-release-gate');
const {
  STATUS: GATE_STATUS,
  parseArgs,
  evaluateSuccessorFreshCompositeShadowFromEnvironment,
} = require('../../tools/successor-fresh-composite-shadow-release-gate');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p71:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPlan(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'successor-fresh-reactivation:successor-cycle-006',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'successor-cycle-006',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    qualifiedSourceCommitSha: 'e'.repeat(40),
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
    activationChangeId: 'successor-activation-change-004',
    cycleId: manifest.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:successor',
    preparedAt: '2026-09-10T21:10:00.000Z',
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
  const registryPath = path.resolve('config/governance/canonical-baseline.json');
  const currentRegistryContent = fs.readFileSync(registryPath, 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const releaseArtifactBytes = Buffer.from('p71-release-artifact\n', 'utf8');
  const environmentConfigBytes = Buffer.from('p71-environment-config\n', 'utf8');
  const activationPlan = buildPlan(currentRegistry, currentRegistryContent, releaseArtifactBytes, environmentConfigBytes);
  const candidate = createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, currentRegistryContent });
  const evidence = verifySuccessorFreshCompositeEvidence({
    candidate,
    activationPlan,
    currentRegistry,
    currentRegistryContent,
    observedSourceCommitSha: activationPlan.successorFreshBaselineManifest.qualifiedSourceCommitSha,
    releaseArtifactBytes,
    environmentConfigBytes,
    evidenceId: 'successor-evidence-002',
    evidenceOperatorRef: 'operator:successor-evidence',
    verifiedAt: '2026-09-10T21:15:00.000Z',
    releaseArtifactRef: 'artifact://successor/release/002',
    environmentConfigRef: 'config://successor/environment/002',
  });

  const input = {
    currentRegistry,
    currentRegistryContent,
    successorFreshCompositeCandidate: candidate,
    successorFreshCompositeEvidence: evidence,
  };
  const result = evaluateSuccessorFreshCompositeShadow(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.shadowComparisonMatch, true);
  assert.strictEqual(result.shadowOnly, true);
  assert.strictEqual(result.candidateOnly, true);
  assert.strictEqual(result.authoritativeBaselineRemainsLegacy, true);
  assert.strictEqual(result.exactPriorRawRegistryVerified, true);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.strictEqual(result.currentRegistryContentSha256, sha256Text(currentRegistryContent));
  assert.match(result.successorFreshShadowEvaluationHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(evaluateSuccessorFreshCompositeShadow(input).successorFreshShadowEvaluationHashSha256, result.successorFreshShadowEvaluationHashSha256);

  const rawDrift = evaluateSuccessorFreshCompositeShadow({ ...input, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW);
  assert(rawDrift.blockers.includes('SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CONTENT_CANDIDATE_MISMATCH'));

  const tamperedEvidence = JSON.parse(JSON.stringify(evidence));
  tamperedEvidence.releaseArtifactSha256 = h('tampered-release');
  const badEvidence = evaluateSuccessorFreshCompositeShadow({ ...input, successorFreshCompositeEvidence: tamperedEvidence });
  assert.strictEqual(badEvidence.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW);
  assert(badEvidence.blockers.includes('P70_SUCCESSOR_FRESH_COMPOSITE_EVIDENCE_HASH_MISMATCH'));

  const tamperedCandidate = JSON.parse(JSON.stringify(candidate));
  tamperedCandidate.candidateRegistryHashSha256 = h('tampered-candidate');
  const badCandidate = evaluateSuccessorFreshCompositeShadow({ ...input, successorFreshCompositeCandidate: tamperedCandidate });
  assert.strictEqual(badCandidate.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW);

  const escalated = evaluateSuccessorFreshCompositeShadow({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = evaluateSuccessorFreshCompositeShadow({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(privateKey.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_SHADOW);
  assert(privateKey.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  const notEvaluated = evaluateSuccessorFreshCompositeShadowFromEnvironment({ env: {}, registryPath });
  assert.strictEqual(notEvaluated.status, GATE_STATUS.NOT_EVALUATED);
  assert.strictEqual(notEvaluated.verified, false);

  const missingRequired = evaluateSuccessorFreshCompositeShadowFromEnvironment({ env: { REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW: '1' }, registryPath });
  assert.strictEqual(missingRequired.status, GATE_STATUS.MISSING_REQUIRED);

  const partial = evaluateSuccessorFreshCompositeShadowFromEnvironment({ env: { SUCCESSOR_FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: 'candidate.json' }, registryPath });
  assert.strictEqual(partial.status, GATE_STATUS.HOLD);
  assert.strictEqual(partial.reasonCode, 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_PARTIAL_INPUT');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p71-shadow-'));
  const candidatePath = path.join(dir, 'candidate.json');
  const evidencePath = path.join(dir, 'evidence.json');
  fs.writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const envResult = evaluateSuccessorFreshCompositeShadowFromEnvironment({
    env: {
      SUCCESSOR_FRESH_COMPOSITE_SHADOW_CANDIDATE_PATH: candidatePath,
      SUCCESSOR_FRESH_COMPOSITE_SHADOW_EVIDENCE_PATH: evidencePath,
      REQUIRE_SUCCESSOR_FRESH_COMPOSITE_SHADOW: '1',
    },
    registryPath,
  });
  assert.strictEqual(envResult.status, GATE_STATUS.VERIFIED);
  assert.strictEqual(envResult.verified, true);
  assert.strictEqual(envResult.shadowComparisonMatch, true);

  assert.throws(() => parseArgs(['--candidate', 'a.json', '--candidate', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--private-key', 'secret.pem']), /private or secret key argument rejected/);

  fs.rmSync(dir, { recursive: true, force: true });
  process.stdout.write('P71 successor fresh composite shadow release gate tests passed\n');
})();
