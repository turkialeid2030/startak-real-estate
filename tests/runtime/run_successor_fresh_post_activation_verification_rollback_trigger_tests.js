'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { AUTHORITY } = require('../../src/qualification/canonical-baseline-registry');
const {
  ACTION: P78_ACTION,
  STATUS: P78_STATUS,
  executeSuccessorFreshControlledCanonicalBaselineChange,
} = require('../../src/qualification/successor-fresh-controlled-canonical-baseline-activation-executor');
const {
  STATUS,
  P77_SUCCESSOR_VERIFICATION_MODE,
  normalizeReleaseVerifyEvidence,
  evaluateSuccessorFreshPostActivationVerification,
} = require('../../src/qualification/successor-fresh-post-activation-verification-rollback-trigger');
const { parseArgs } = require('../../tools/successor-fresh-post-activation-verification-rollback-trigger');
const { buildSuccessorFreshActiveFixture } = require('../fixtures/successor_fresh_active_fixture');

function h(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function evidenceInput(fixture) {
  return {
    activationChangeContract: fixture.activationChangeContract,
    successorReviewPacket: fixture.successorReviewPacket,
    reviewerLifecycle: fixture.reviewerLifecycle,
    activationPlan: fixture.activationPlan,
    successorFreshCompositeCandidate: fixture.successorFreshCompositeCandidate,
    successorFreshShadowEvaluation: fixture.successorFreshShadowEvaluation,
    successorFreshRehearsalResult: fixture.successorFreshRehearsalResult,
    safetyGuard: fixture.safetyGuard,
    successorFreshOwnerAuthorityRegistry: fixture.successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: fixture.expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision: fixture.signedOwnerDecision,
  };
}

(async function run() {
  const fixture = buildSuccessorFreshActiveFixture();
  const chain = evidenceInput(fixture);
  const activationExecution = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...chain,
    action: P78_ACTION.ACTIVATE,
    dryRun: false,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p79-activation-execution',
    operatorRef: 'operator:p79-regression',
    executedAt: '2026-09-11T00:10:00.000Z',
    registryWriter: async ({ nextContent }) => ({
      applied: true,
      observedContent: nextContent,
      observedRegistry: JSON.parse(nextContent),
    }),
  });
  assert.strictEqual(activationExecution.status, P78_STATUS.SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  assert.strictEqual(activationExecution.verified, true);

  const releaseVerifyEvidence = {
    schemaVersion: 1,
    runId: 'synthetic-p79-release-verify-1',
    sourceCommitSha: fixture.activationPlan.successorFreshBaselineManifest.qualifiedSourceCommitSha,
    completedAt: '2026-09-11T00:15:00.000Z',
    releaseVerifyResult: 'PASS',
    testDiscoveryAndRegression: 'PASS',
    productionBuild: 'PASS',
    packageVerification: 'PASS',
    npmAuditReleaseThreshold: 'PASS',
    canonicalBaselineRegistryVerification: 'PASS',
    activeMode: 'GOVERNED_COMPOSITE_BASELINE',
    registrySchemaVersion: 4,
    verificationMode: P77_SUCCESSOR_VERIFICATION_MODE,
    registryHashSha256: fixture.activationChangeContract.proposedRegistryHashSha256,
    registryContentSha256: fixture.activationChangeContract.proposedRegistryContentSha256,
    evidenceRef: 'ci://synthetic/p79/release-verify/1',
    evidenceArtifactSha256: h('p79-release-verify-artifact'),
  };
  const normalized = normalizeReleaseVerifyEvidence(releaseVerifyEvidence);
  assert.match(normalized.releaseVerifyEvidenceHashSha256, /^[a-f0-9]{64}$/);

  const input = {
    ...chain,
    activationExecution,
    observedRegistry: fixture.activeRegistry,
    observedRegistryContent: fixture.activeRegistryContent,
    releaseVerifyEvidence,
  };
  const success = evaluateSuccessorFreshPostActivationVerification(input);
  assert.strictEqual(success.status, STATUS.SUCCESSOR_FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.postActivationVerificationPassed, true);
  assert.strictEqual(success.p78ActivationReceiptVerified, true);
  assert.strictEqual(success.p76ObservedSuccessorCompositeVerified, true);
  assert.strictEqual(success.p77ReleaseGateEvidenceConsistent, true);
  assert.strictEqual(success.rollbackRequired, false);
  assert.strictEqual(success.postChangeReleaseVerifySatisfiedBySuppliedEvidence, true);
  assert.strictEqual(success.releaseVerifyEvidenceAuthenticityVerifiedHere, false);
  assert.strictEqual(success.productionEvidenceEstablishedHere, false);
  assert.strictEqual(success.releaseStillBlocked, true);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(success[key], false);

  const missingEvidence = evaluateSuccessorFreshPostActivationVerification({ ...input, releaseVerifyEvidence: null });
  assert.strictEqual(missingEvidence.status, STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(missingEvidence.blockers.includes('POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_REQUIRED'));
  assert.strictEqual(missingEvidence.p78ActivationReceiptVerified, true);
  assert.strictEqual(missingEvidence.p76ObservedSuccessorCompositeVerified, true);
  assert.strictEqual(missingEvidence.rollbackRequired, false);

  const failingEvidence = evaluateSuccessorFreshPostActivationVerification({
    ...input,
    releaseVerifyEvidence: { ...releaseVerifyEvidence, productionBuild: 'FAIL', releaseVerifyResult: 'FAIL' },
  });
  assert.strictEqual(failingEvidence.status, STATUS.SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY);
  assert.strictEqual(failingEvidence.verified, true);
  assert.strictEqual(failingEvidence.rollbackRequired, true);
  assert.strictEqual(failingEvidence.rollbackTrigger.rollbackAction, P78_ACTION.ROLLBACK);
  assert.strictEqual(failingEvidence.rollbackTrigger.rollbackRegistryHashSha256, fixture.activationChangeContract.rollbackRegistryHashSha256);
  assert.strictEqual(failingEvidence.rollbackTrigger.rollbackRegistryContentSha256, fixture.activationChangeContract.rollbackRegistryContentSha256);
  assert.strictEqual(failingEvidence.rollbackTrigger.automaticRollbackMutationAllowed, false);
  assert.strictEqual(failingEvidence.rollbackTrigger.p78ControlledRollbackExecutionRequired, true);
  assert(failingEvidence.rollbackTrigger.reasonCodes.includes('RELEASE_VERIFY_PRODUCTIONBUILD_NOT_PASS'));

  const wrongCommit = evaluateSuccessorFreshPostActivationVerification({
    ...input,
    releaseVerifyEvidence: { ...releaseVerifyEvidence, sourceCommitSha: 'd'.repeat(40) },
  });
  assert.strictEqual(wrongCommit.status, STATUS.SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY);
  assert(wrongCommit.rollbackTrigger.reasonCodes.includes('RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH'));

  const driftedRegistry = clone(fixture.activeRegistry);
  driftedRegistry.canonicalBaselineChanged = false;
  const observedDrift = evaluateSuccessorFreshPostActivationVerification({
    ...input,
    observedRegistry: driftedRegistry,
    observedRegistryContent: `${JSON.stringify(driftedRegistry, null, 2)}\n`,
  });
  assert.strictEqual(observedDrift.status, STATUS.SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY);
  assert(observedDrift.rollbackTrigger.reasonCodes.includes('P76_POST_ACTIVATION_SUCCESSOR_COMPOSITE_VERIFICATION_FAILED'));

  const badReceipt = clone(activationExecution);
  badReceipt.executionReceiptHashSha256 = 'e'.repeat(64);
  const receiptHold = evaluateSuccessorFreshPostActivationVerification({ ...input, activationExecution: badReceipt });
  assert.strictEqual(receiptHold.status, STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(receiptHold.blockers.includes('P78_EXECUTION_RECEIPT_HASH_MISMATCH'));

  const dryReceipt = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...chain,
    action: P78_ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p79-dry-receipt',
    operatorRef: 'operator:p79-regression',
    executedAt: '2026-09-11T00:11:00.000Z',
  });
  const dryHold = evaluateSuccessorFreshPostActivationVerification({ ...input, activationExecution: dryReceipt });
  assert.strictEqual(dryHold.status, STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(dryHold.blockers.includes('P78_APPLIED_SUCCESSOR_FRESH_ACTIVATION_RECEIPT_REQUIRED'));

  const escalation = evaluateSuccessorFreshPostActivationVerification({ ...input, releaseAuthorized: true });
  assert.strictEqual(escalation.status, STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const forbidden = evaluateSuccessorFreshPostActivationVerification({ ...input, nested: { privateKeyPem: 'forbidden' } });
  assert.strictEqual(forbidden.status, STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(forbidden.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--private-key', 'x.pem']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--registry', 'a', '--registry', 'b']), /duplicate argument/);

  process.stdout.write('P79 successor fresh post-activation verification and rollback trigger tests passed\n');
})();
