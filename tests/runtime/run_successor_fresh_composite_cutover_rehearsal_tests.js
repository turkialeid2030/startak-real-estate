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
const { STATUS: P71_STATUS } = require('../../src/qualification/successor-fresh-composite-shadow-release-gate');
const {
  STATUS,
  p71ShadowCore,
  runSuccessorFreshCompositeCutoverRehearsal,
} = require('../../src/qualification/successor-fresh-composite-cutover-rehearsal');
const {
  parseArgs,
  readBoundedRegularJson,
  run: runOperator,
} = require('../../tools/successor-fresh-composite-cutover-rehearsal');

function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function h(label) { return sha256Text(`p72:${label}`); }
function authorityFalse() { return Object.fromEntries(Object.keys(AUTHORITY).map((key) => [key, false])); }

function buildShadow(currentRegistry, currentRegistryContent) {
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const core = {
    schemaVersion: 1,
    authoritativeMode: 'LEGACY_FILE_SHA256',
    shadowMode: 'GOVERNED_COMPOSITE_BASELINE',
    cycleId: 'successor-cycle-007',
    successorFreshReactivationGovernanceCycleHashSha256: h('cycle'),
    successorFreshReviewerLifecycleLockHashSha256: h('reviewer-lock'),
    successorFreshActivationPlanHashSha256: h('activation-plan'),
    successorFreshCompositeRegistryCandidateHashSha256: h('candidate-record'),
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: sha256Text(currentRegistryContent),
    candidateRegistryHashSha256: h('candidate-logical'),
    candidateRegistryContentSha256: h('candidate-content'),
    successorFreshCompositeEvidenceHashSha256: h('evidence'),
    predecessorIncidentCloseoutPacketHashSha256: h('predecessor-closeout'),
    predecessorHumanDecisionRecordHashSha256: h('predecessor-human'),
    predecessorGovernanceResetRecordHashSha256: h('predecessor-reset'),
    predecessorRootCauseAnalysisSha256: h('predecessor-rca'),
    predecessorCorrectivePreventiveActionSha256: h('predecessor-capa'),
  };
  return {
    ...core,
    status: P71_STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshShadowEvaluationHashSha256: sha256Object(p71ShadowCore(core)),
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    exactPriorRawRegistryVerified: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...authorityFalse(),
  };
}

(function run() {
  const registryPath = path.resolve('config/governance/canonical-baseline.json');
  const currentRegistryContent = fs.readFileSync(registryPath, 'utf8');
  const currentRegistry = JSON.parse(currentRegistryContent);
  const shadow = buildShadow(currentRegistry, currentRegistryContent);
  const baseInput = {
    currentRegistry,
    currentRegistryContent,
    successorFreshShadowEvaluation: shadow,
    rehearsalId: 'successor-cutover-rehearsal-001',
    preparedByRef: 'operator:successor-rehearsal',
    preparedAt: '2026-09-10T21:30:00.000Z',
  };

  const result = runSuccessorFreshCompositeCutoverRehearsal(baseInput);
  assert.strictEqual(result.status, STATUS.SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION);
  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.cutoverSimulated, true);
  assert.strictEqual(result.rollbackSimulated, true);
  assert.strictEqual(result.rollbackRestoresExactAuthoritativeRegistry, true);
  assert.strictEqual(result.rollbackRestoresExactAuthoritativeRegistryContent, true);
  assert.strictEqual(result.simulationOnly, true);
  assert.strictEqual(result.actualRegistryMutationPerformed, false);
  assert.strictEqual(result.actualReleaseGateModeChanged, false);
  assert.strictEqual(result.actualDeploymentMutationPerformed, false);
  assert.strictEqual(result.activationAuthorized, false);
  assert.strictEqual(result.activationApplied, false);
  assert.strictEqual(result.reactivationAuthorized, false);
  assert.strictEqual(result.currentBaselineMutationPerformed, false);
  assert.strictEqual(result.releaseStillBlocked, true);
  assert.strictEqual(result.transitions.length, 3);
  assert.strictEqual(result.transitions[0].registryHashSha256, result.transitions[2].registryHashSha256);
  assert.strictEqual(result.transitions[0].registryContentSha256, result.transitions[2].registryContentSha256);
  assert.strictEqual(result.transitions[1].registrySchemaVersion, 4);
  assert.match(result.successorFreshCutoverRehearsalHashSha256, /^[a-f0-9]{64}$/);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(result[key], false);
  assert.strictEqual(runSuccessorFreshCompositeCutoverRehearsal(baseInput).successorFreshCutoverRehearsalHashSha256, result.successorFreshCutoverRehearsalHashSha256);

  const rawDrift = runSuccessorFreshCompositeCutoverRehearsal({ ...baseInput, currentRegistryContent: `${currentRegistryContent} ` });
  assert.strictEqual(rawDrift.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL);
  assert(rawDrift.blockers.includes('P71_SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CONTENT_HASH_MISMATCH'));

  const malformedRaw = runSuccessorFreshCompositeCutoverRehearsal({ ...baseInput, currentRegistryContent: '{not-json' });
  assert.strictEqual(malformedRaw.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL);
  assert(malformedRaw.blockers.includes('CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON'));

  const tamperedShadow = JSON.parse(JSON.stringify(shadow));
  tamperedShadow.candidateRegistryContentSha256 = h('tampered-candidate-content');
  const badShadow = runSuccessorFreshCompositeCutoverRehearsal({ ...baseInput, successorFreshShadowEvaluation: tamperedShadow });
  assert.strictEqual(badShadow.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL);
  assert(badShadow.blockers.includes('P71_SUCCESSOR_FRESH_SHADOW_HASH_MISMATCH'));

  const escalated = runSuccessorFreshCompositeCutoverRehearsal({ ...baseInput, deploymentAuthorized: true });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = runSuccessorFreshCompositeCutoverRehearsal({ ...baseInput, nested: { secretKeyPem: 'forbidden' } });
  assert.strictEqual(privateKey.status, STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL);
  assert(privateKey.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--shadow', 'a.json', '--shadow', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--private-key', 'secret.pem']), /private or secret key argument rejected/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p72-rehearsal-'));
  const shadowPath = path.join(dir, 'shadow.json');
  const outputPath = path.join(dir, 'result.json');
  fs.writeFileSync(shadowPath, `${JSON.stringify(shadow, null, 2)}\n`);
  assert.strictEqual(readBoundedRegularJson(shadowPath, 'shadow').parsed.status, P71_STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE);
  const exitCode = runOperator([
    '--shadow', shadowPath,
    '--registry', registryPath,
    '--rehearsal-id', 'successor-cutover-rehearsal-cli-001',
    '--prepared-by', 'operator:successor-rehearsal',
    '--prepared-at', '2026-09-10T21:31:00.000Z',
    '--output', outputPath,
  ]);
  assert.strictEqual(exitCode, 0);
  const emitted = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.strictEqual(emitted.status, STATUS.SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION);
  assert.strictEqual(emitted.currentBaselineMutationPerformed, false);

  fs.rmSync(dir, { recursive: true, force: true });
  process.stdout.write('P72 successor fresh composite cutover rehearsal tests passed\n');
})();
