'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P53_STATUS } = require('../../src/qualification/fresh-composite-shadow-release-gate');
const {
  STATUS,
  p53ShadowCore,
  runFreshCompositeCutoverRehearsal,
} = require('../../src/qualification/fresh-composite-cutover-rehearsal');
const { parseArgs } = require('../../tools/fresh-composite-cutover-rehearsal');

const hashObject = (value) => crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
const h = (char) => char.repeat(64);

function shadowFixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const shadow = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    shadowMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: 'cycle:p54',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    freshReviewerLifecycleLockHashSha256: h('2'),
    freshActivationPlanHashSha256: h('3'),
    freshCompositeRegistryCandidateHashSha256: h('4'),
    currentRegistryHashSha256: current.registryHashSha256,
    candidateRegistryHashSha256: h('5'),
    candidateRegistryContentSha256: h('6'),
    freshCompositeEvidenceHashSha256: h('7'),
  };
  shadow.freshShadowEvaluationHashSha256 = hashObject(p53ShadowCore(shadow));
  return {
    ...shadow,
    status: P53_STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE,
    verified: true,
    blockers: [],
    shadowComparisonMatch: true,
    shadowOnly: true,
    candidateOnly: true,
    authoritativeBaselineRemainsLegacy: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

(() => {
  const shadow = shadowFixture();
  const input = {
    currentRegistry,
    freshShadowEvaluation: shadow,
    rehearsalId: 'rehearsal:p54',
    preparedByRef: 'operator:p54',
    preparedAt: '2026-09-10T12:30:00.000Z',
  };
  const success = runFreshCompositeCutoverRehearsal(input);
  assert.strictEqual(success.status, STATUS.FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.cutoverSimulated, true);
  assert.strictEqual(success.rollbackSimulated, true);
  assert.strictEqual(success.rollbackRestoresExactAuthoritativeRegistry, true);
  assert.strictEqual(success.transitions.length, 3);
  assert.strictEqual(success.transitions[0].mode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(success.transitions[1].mode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(success.transitions[2].mode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(success.transitions[0].registryHashSha256, success.transitions[2].registryHashSha256);
  assert.strictEqual(success.actualRegistryMutationPerformed, false);
  assert.strictEqual(success.activationApplied, false);
  assert.strictEqual(success.reactivationAuthorized, false);
  assert.strictEqual(success.releaseAuthorized, false);

  const deterministic = runFreshCompositeCutoverRehearsal(input);
  assert.strictEqual(deterministic.freshCutoverRehearsalHashSha256, success.freshCutoverRehearsalHashSha256);

  const tampered = { ...shadow, candidateRegistryHashSha256: h('8') };
  const tamperedResult = runFreshCompositeCutoverRehearsal({ ...input, freshShadowEvaluation: tampered });
  assert(tamperedResult.blockers.includes('P53_FRESH_SHADOW_HASH_MISMATCH'));

  const wrongStatus = { ...shadow, status: 'NOT_READY' };
  const statusResult = runFreshCompositeCutoverRehearsal({ ...input, freshShadowEvaluation: wrongStatus });
  assert(statusResult.blockers.includes('P53_FRESH_SHADOW_MATCH_REQUIRED'));

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.evidenceStatus = 'FABRICATED';
  const driftResult = runFreshCompositeCutoverRehearsal({ ...input, currentRegistry: driftedRegistry });
  assert(driftResult.blockers.includes('CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'));

  const escalation = runFreshCompositeCutoverRehearsal({ ...input, releaseAuthorized: true });
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = runFreshCompositeCutoverRehearsal({ ...input, privateKeyPem: 'forbidden' });
  assert(privateKey.blockers.includes('PRIVATE_SIGNING_KEY_INPUT_REJECTED'));

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private signing key argument rejected/);
  assert.throws(() => parseArgs(['--shadow', 'a.json', '--shadow', 'b.json']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--shadow', 'a.json']), /missing required argument/);

  console.log('P54 fresh composite cutover rehearsal: PASS');
})();
