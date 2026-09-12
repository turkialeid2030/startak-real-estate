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
  STATUS,
  successorManifestCore,
  p68PlanCore,
  createSuccessorFreshCompositeRegistryCandidate,
} = require('../../src/qualification/successor-fresh-composite-registry-candidate');
const { parseArgs } = require('../../tools/successor-fresh-composite-registry-candidate');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p69:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildPlan(currentRegistry, currentRegistryContent) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifest = {
    schemaVersion: 1,
    baselineId: 'successor-fresh-reactivation:successor-cycle-004',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'successor-cycle-004',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    qualifiedSourceCommitSha: 'c'.repeat(40),
    releaseArtifactSha256: h('release'),
    environmentConfigSha256: h('environment'),
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
    activationChangeId: 'successor-activation-change-002',
    cycleId: manifest.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:successor',
    preparedAt: '2026-09-10T20:30:00.000Z',
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
  const activationPlan = buildPlan(currentRegistry, currentRegistryContent);
  const input = { activationPlan, currentRegistry, currentRegistryContent };

  const result = createSuccessorFreshCompositeRegistryCandidate(input);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.proposedRegistry.schemaVersion, 4);
  assert.strictEqual(result.proposedRegistry.activeMode, 'GOVERNED_COMPOSITE_BASELINE');
  assert.strictEqual(result.proposedRegistry.successorFreshActivationPlanHashSha256, activationPlan.successorFreshActivationPlanHashSha256);
  assert.strictEqual(result.currentRegistryContentSha256, sha256Text(currentRegistryContent));
  assert.strictEqual(result.candidateOnly, true);
  assert.strictEqual(result.activeRegistryChanged, false);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.predecessorFreshCompositeCandidateReusable, false);
  assert.strictEqual(result.successorFreshModeVerifierRequired, true);
  assert.strictEqual(result.releaseStillBlocked, true);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.match(result.successorFreshCompositeRegistryCandidateHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(createSuccessorFreshCompositeRegistryCandidate(input).successorFreshCompositeRegistryCandidateHashSha256, result.successorFreshCompositeRegistryCandidateHashSha256);

  const driftedContent = `${currentRegistryContent} `;
  const drifted = createSuccessorFreshCompositeRegistryCandidate({ ...input, currentRegistryContent: driftedContent });
  assert.strictEqual(drifted.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(drifted.blockers.includes('CURRENT_REGISTRY_CONTENT_HASH_DOES_NOT_MATCH_P68_EXPECTED_PRIOR'));

  const objectMismatchContent = `${JSON.stringify({ ...currentRegistry, ignored: true }, null, 2)}\n`;
  const planForMismatch = buildPlan(currentRegistry, objectMismatchContent);
  const objectMismatch = createSuccessorFreshCompositeRegistryCandidate({ activationPlan: planForMismatch, currentRegistry, currentRegistryContent: objectMismatchContent });
  assert.strictEqual(objectMismatch.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(objectMismatch.blockers.includes('CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH'));

  const tamperedPlan = JSON.parse(JSON.stringify(activationPlan));
  tamperedPlan.successorFreshActivationPlanHashSha256 = h('tampered-plan');
  const badPlan = createSuccessorFreshCompositeRegistryCandidate({ ...input, activationPlan: tamperedPlan });
  assert.strictEqual(badPlan.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(badPlan.blockers.includes('P68_SUCCESSOR_FRESH_ACTIVATION_PLAN_HASH_MISMATCH'));

  const reused = createSuccessorFreshCompositeRegistryCandidate({ ...input, freshCompositeRegistryCandidateHashSha256: h('old-p51') });
  assert.strictEqual(reused.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(reused.blockers.some((x) => x.startsWith('PREDECESSOR_FRESH_ARTIFACT_REUSE_NOT_ALLOWED:')));

  const escalated = createSuccessorFreshCompositeRegistryCandidate({ ...input, activationAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const keyMaterial = createSuccessorFreshCompositeRegistryCandidate({ ...input, nested: { secretKeyPem: 'forbidden' } });
  assert.strictEqual(keyMaterial.status, STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE);
  assert(keyMaterial.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--activation-plan', 'a.json', '--activation-plan', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--private-key', 'secret.pem']), /private or secret key argument rejected/);

  process.stdout.write('P69 successor fresh composite registry candidate tests passed\n');
})();
