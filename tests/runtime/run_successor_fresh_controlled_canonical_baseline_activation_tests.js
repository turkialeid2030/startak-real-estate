'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AUTHORITY } = require('../../src/qualification/canonical-baseline-registry');
const {
  ACTION,
  STATUS,
  executeSuccessorFreshControlledCanonicalBaselineChange,
} = require('../../src/qualification/successor-fresh-controlled-canonical-baseline-activation-executor');
const {
  parseArgs,
  createAtomicRegistryWriter,
} = require('../../tools/successor-fresh-controlled-canonical-baseline-activation');
const {
  buildSuccessorFreshActiveFixture,
} = require('../fixtures/successor_fresh_active_fixture');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function baseInput(fixture) {
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
    operatorRef: 'operator:p78-regression',
  };
}

(async function run() {
  const fixture = buildSuccessorFreshActiveFixture();
  const common = baseInput(fixture);

  const dryActivation = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    action: ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-dry-activate',
    executedAt: '2026-09-10T23:45:00.000Z',
  });
  assert.strictEqual(dryActivation.status, STATUS.SUCCESSOR_FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED);
  assert.strictEqual(dryActivation.verified, true);
  assert.strictEqual(dryActivation.dryRun, true);
  assert.strictEqual(dryActivation.mutationPerformed, false);
  assert.strictEqual(dryActivation.activationApplied, false);
  assert.strictEqual(dryActivation.preWriteP76LegacyVerified, true);
  assert.strictEqual(dryActivation.targetP76SuccessorCompositeVerified, true);
  assert.strictEqual(dryActivation.p77ReleaseGateRequiredAfterMutation, true);
  assert.strictEqual(dryActivation.postChangeReleaseVerifySatisfied, false);
  assert.strictEqual(dryActivation.releaseStillBlocked, true);
  for (const key of Object.keys(AUTHORITY)) assert.strictEqual(dryActivation[key], false);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p78-successor-'));
  try {
    const registryPath = path.join(tempDir, 'canonical-baseline.json');
    fs.writeFileSync(registryPath, fixture.currentRegistryContent, { encoding: 'utf8', mode: 0o600 });
    const applyActivation = await executeSuccessorFreshControlledCanonicalBaselineChange({
      ...common,
      action: ACTION.ACTIVATE,
      dryRun: false,
      currentRegistry: fixture.currentRegistry,
      currentRegistryContent: fixture.currentRegistryContent,
      executionId: 'p78-apply-activate-temp',
      executedAt: '2026-09-10T23:46:00.000Z',
      registryWriter: createAtomicRegistryWriter(registryPath),
    });
    assert.strictEqual(applyActivation.status, STATUS.SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
    assert.strictEqual(applyActivation.verified, true);
    assert.strictEqual(applyActivation.mutationPerformed, true);
    assert.strictEqual(applyActivation.activationApplied, true);
    assert.strictEqual(applyActivation.postWriteP76Verified, true);
    assert.strictEqual(applyActivation.postChangeReleaseVerifySatisfied, false);
    assert.strictEqual(fs.readFileSync(registryPath, 'utf8'), fixture.activeRegistryContent);

    const dryRollback = await executeSuccessorFreshControlledCanonicalBaselineChange({
      ...common,
      action: ACTION.ROLLBACK,
      currentRegistry: fixture.activeRegistry,
      currentRegistryContent: fixture.activeRegistryContent,
      executionId: 'p78-dry-rollback',
      executedAt: '2026-09-10T23:47:00.000Z',
    });
    assert.strictEqual(dryRollback.status, STATUS.SUCCESSOR_FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED);
    assert.strictEqual(dryRollback.verified, true);
    assert.strictEqual(dryRollback.mutationPerformed, false);
    assert.strictEqual(dryRollback.activationApplied, true);
    assert.strictEqual(dryRollback.rollbackApplied, false);
    assert.strictEqual(dryRollback.targetP76LegacyVerified, true);

    const applyRollback = await executeSuccessorFreshControlledCanonicalBaselineChange({
      ...common,
      action: ACTION.ROLLBACK,
      dryRun: false,
      currentRegistry: fixture.activeRegistry,
      currentRegistryContent: fixture.activeRegistryContent,
      executionId: 'p78-apply-rollback-temp',
      executedAt: '2026-09-10T23:48:00.000Z',
      registryWriter: createAtomicRegistryWriter(registryPath),
    });
    assert.strictEqual(applyRollback.status, STATUS.SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
    assert.strictEqual(applyRollback.verified, true);
    assert.strictEqual(applyRollback.mutationPerformed, true);
    assert.strictEqual(applyRollback.activationApplied, false);
    assert.strictEqual(applyRollback.rollbackApplied, true);
    assert.strictEqual(applyRollback.postWriteP76Verified, true);
    assert.strictEqual(fs.readFileSync(registryPath, 'utf8'), fixture.currentRegistryContent);

    fs.writeFileSync(registryPath, `${fixture.currentRegistryContent} `, 'utf8');
    const staleWriter = createAtomicRegistryWriter(registryPath);
    await assert.rejects(
      staleWriter({
        expectedPriorRegistryHashSha256: fixture.activationChangeContract.rollbackRegistryHashSha256,
        expectedPriorContent: fixture.currentRegistryContent,
        nextRegistryHashSha256: fixture.activationChangeContract.proposedRegistryHashSha256,
        nextContentSha256: fixture.activationChangeContract.proposedRegistryContentSha256,
        nextContent: fixture.activationChangeContract.proposedRegistryContent,
      }),
      /CANONICAL_REGISTRY_PRIOR_CONTENT_MISMATCH/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const noWriter = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    action: ACTION.ACTIVATE,
    dryRun: false,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-no-writer',
    executedAt: '2026-09-10T23:49:00.000Z',
  });
  assert.strictEqual(noWriter.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION);
  assert(noWriter.blockers.includes('REGISTRY_WRITER_REQUIRED_FOR_APPLY'));

  const badDecision = { ...fixture.signedOwnerDecision, signatureBase64: Buffer.alloc(256, 7).toString('base64') };
  const badSignature = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    signedOwnerDecision: badDecision,
    action: ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-bad-signature',
    executedAt: '2026-09-10T23:50:00.000Z',
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION);
  assert(badSignature.blockers.includes('SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID'));

  const tamperedContract = clone(fixture.activationChangeContract);
  tamperedContract.successorFreshActivationChangeContractHashSha256 = 'f'.repeat(64);
  const badContract = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    activationChangeContract: tamperedContract,
    action: ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-bad-contract',
    executedAt: '2026-09-10T23:51:00.000Z',
  });
  assert.strictEqual(badContract.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION);
  assert(badContract.blockers.includes('P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH'));

  const escalated = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    releaseAuthorized: true,
    action: ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-escalated',
    executedAt: '2026-09-10T23:52:00.000Z',
  });
  assert.strictEqual(escalated.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION);
  assert(escalated.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const forbidden = await executeSuccessorFreshControlledCanonicalBaselineChange({
    ...common,
    nested: { privateKeyPem: 'forbidden' },
    action: ACTION.ACTIVATE,
    currentRegistry: fixture.currentRegistry,
    currentRegistryContent: fixture.currentRegistryContent,
    executionId: 'p78-key-material',
    executedAt: '2026-09-10T23:53:00.000Z',
  });
  assert.strictEqual(forbidden.status, STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION);
  assert(forbidden.blockers.some((x) => x.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:')));

  assert.throws(() => parseArgs(['--private-key', 'x.pem']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--action', 'activate', '--action', 'rollback']), /duplicate argument/);
  assert.throws(() => parseArgs([
    '--action', 'activate', '--registry', 'r', '--activation-contract', 'c', '--review-packet', 'p', '--reviewer-lifecycle', 'l',
    '--activation-plan', 'a', '--candidate', 'x', '--shadow', 's', '--rehearsal', 'h', '--safety-guard', 'g',
    '--owner-authority-registry', 'o', '--expected-owner-authority-registry-sha256', '1'.repeat(64), '--signed-owner-decision', 'd',
    '--execution-id', 'e', '--operator-ref', 'op', '--executed-at', '2026-09-10T23:54:00.000Z', '--apply',
  ]), /--apply requires --confirm-exact-registry-mutation/);
  assert.throws(() => parseArgs([
    '--action', 'activate', '--registry', 'r', '--activation-contract', 'c', '--review-packet', 'p', '--reviewer-lifecycle', 'l',
    '--activation-plan', 'a', '--candidate', 'x', '--shadow', 's', '--rehearsal', 'h', '--safety-guard', 'g',
    '--owner-authority-registry', 'o', '--expected-owner-authority-registry-sha256', '1'.repeat(64), '--signed-owner-decision', 'd',
    '--execution-id', 'e', '--operator-ref', 'op', '--executed-at', '2026-09-10T23:54:00.000Z', '--apply', '--confirm-exact-registry-mutation',
  ]), /expectedContractHash/);

  process.stdout.write('P78 successor fresh controlled canonical baseline activation tests passed\n');
})();
