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
const { STATUS: P55_STATUS } = require('../../src/qualification/fresh-composite-cutover-safety-guard');
const {
  PURPOSE,
  DECISION,
  p55SafetyCore,
  normalizeFreshOwnerAuthorityRegistry,
  createFreshOwnerSigningPayload,
} = require('../../src/qualification/fresh-owner-activation-authorization');
const {
  STATUS: P57_STATUS,
  createFreshActivationChangeContract,
} = require('../../src/qualification/fresh-activation-change-contract');
const {
  ACTION,
  STATUS,
  executeFreshControlledCanonicalBaselineChange,
} = require('../../src/qualification/fresh-controlled-canonical-baseline-activation-executor');
const {
  parseArgs,
  safeReadJson,
  createAtomicRegistryWriter,
} = require('../../tools/fresh-controlled-canonical-baseline-activation');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p60',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p60',
    freshReactivationGovernanceCycleHashSha256: h('1'),
    qualifiedSourceCommitSha: 'a'.repeat(40),
    releaseArtifactSha256: h('2'),
    environmentConfigSha256: h('3'),
    expectedPriorRegistryHashSha256: currentHash,
    reviewPacketHashSha256: h('4'),
    freshReviewerDesignationHashSha256: h('5'),
    freshReviewerLifecycleLockHashSha256: h('6'),
    verifiedFreshReviewRecordHashSha256: h('7'),
  };
  const manifestHash = hashObject(freshManifestCore(manifest));
  const plan = {
    schemaVersion: 1,
    activationChangeId: 'activation:p60',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p60',
    preparedAt: '2026-09-10T12:00:00.000Z',
    freshReviewerLifecycleLockHashSha256: manifest.freshReviewerLifecycleLockHashSha256,
    freshSuccessorBaselineManifest: manifest,
    freshSuccessorBaselineManifestHashSha256: manifestHash,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: MODE.LEGACY_FILE_SHA256,
      proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
      expectedPriorRegistryHashSha256: currentHash,
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

function safetyGuardFixture(plan, candidate, currentHash) {
  const guard = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: plan.cycleId,
    freshReactivationGovernanceCycleHashSha256: plan.freshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: currentHash,
    freshReviewerLifecycleLockHashSha256: plan.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: plan.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: plan.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: candidate.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: candidate.candidateRegistryHashSha256,
    candidateRegistryContentSha256: candidate.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: h('b'),
    freshShadowEvaluationHashSha256: h('c'),
    freshCutoverRehearsalHashSha256: h('d'),
  };
  guard.freshCutoverSafetyGuardHashSha256 = hashObject(p55SafetyCore(guard));
  return {
    ...guard,
    status: P55_STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED,
    verified: true,
    blockers: [],
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackIdentityVerified: true,
    safetyPrerequisitesSatisfiedForFreshOwnerAuthorization: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function buildFixture() {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const plan = activationPlanFixture(current.registryHashSha256);
  const candidate = createFreshCompositeRegistryCandidate({ activationPlan: plan, currentRegistry });
  const guard = safetyGuardFixture(plan, candidate, current.registryHashSha256);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const authorityRegistry = {
    schemaVersion: 1,
    purpose: PURPOSE,
    authorities: [{
      authorityId: 'owner-authority:p60',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p60',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalized = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p60',
    authorityId: 'owner-authority:p60',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p60',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p60',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const signingPayload = createFreshOwnerSigningPayload({ safetyGuard: guard, activationPlan: plan, decision: unsignedDecision });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(signingPayload), 'utf8'), privateKey).toString('base64');
  const signedOwnerDecision = { ...unsignedDecision, signatureBase64 };
  const contract = createFreshActivationChangeContract({
    currentRegistry,
    activationPlan: plan,
    freshCompositeCandidate: candidate,
    safetyGuard: guard,
    freshOwnerAuthorityRegistry: authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: normalized.ownerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: 'contract:p60',
    preparedByRef: plan.preparedByRef,
    preparedAt: '2026-09-10T12:45:00.000Z',
  });
  assert.strictEqual(contract.status, P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  return {
    plan,
    candidate,
    guard,
    authorityRegistry,
    expectedRegistryHash: normalized.ownerAuthorityRegistryHashSha256,
    unsignedDecision,
    signedOwnerDecision,
    contract,
  };
}

function baseInput(fixture, overrides = {}) {
  return {
    action: ACTION.ACTIVATE,
    dryRun: true,
    currentRegistry,
    currentRegistryContent: canonicalContent(currentRegistry),
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
    executionId: 'execution:p60',
    operatorRef: 'operator:p60',
    executedAt: '2026-09-10T13:00:00.000Z',
    ...overrides,
  };
}

(async () => {
  const fixture = buildFixture();

  const dryRun = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture));
  assert.strictEqual(dryRun.status, STATUS.FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED);
  assert.strictEqual(dryRun.verified, true);
  assert.strictEqual(dryRun.mutationPerformed, false);
  assert.strictEqual(dryRun.preWriteP57Recomputed, true);
  assert.strictEqual(dryRun.preWriteP58LegacyVerified, true);
  assert.strictEqual(dryRun.targetP58FreshCompositeVerified, true);
  assert.strictEqual(dryRun.postChangeReleaseVerifySatisfied, false);
  assert.strictEqual(dryRun.releaseAuthorized, false);
  assert.match(dryRun.executionReceiptHashSha256, /^[a-f0-9]{64}$/);

  const deterministic = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture));
  assert.strictEqual(deterministic.executionReceiptHashSha256, dryRun.executionReceiptHashSha256);

  const early = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, { executedAt: '2026-09-10T12:44:59.000Z' }));
  assert(early.blockers.includes('execution cannot precede P57 preparation'));

  const badSignature = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    signedOwnerDecision: { ...fixture.unsignedDecision, signatureBase64: Buffer.from('bad').toString('base64') },
  }));
  assert(badSignature.blockers.includes('FRESH_OWNER_SIGNATURE_INVALID'));

  const contentDrift = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    currentRegistryContent: `${canonicalContent(currentRegistry)} `,
  }));
  assert(contentDrift.blockers.some((code) => code.includes('LEGACY_REGISTRY_CONTENT')));

  const escalation = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, { releaseAuthorized: true }));
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, { privateKeyPem: 'forbidden' }));
  assert(privateKey.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  const applied = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    dryRun: false,
    registryWriter: async ({ nextContent }) => ({
      applied: true,
      observedContent: nextContent,
      observedRegistry: JSON.parse(nextContent),
    }),
  }));
  assert.strictEqual(applied.status, STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  assert.strictEqual(applied.verified, true);
  assert.strictEqual(applied.mutationPerformed, true);
  assert.strictEqual(applied.activationApplied, true);
  assert.strictEqual(applied.postWriteP58Verified, true);
  assert.strictEqual(applied.p59ReleaseGateRequiredAfterMutation, true);
  assert.strictEqual(applied.postChangeReleaseVerifySatisfied, false);
  assert.strictEqual(applied.releaseStillBlocked, true);

  const corruptedAfterWrite = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    dryRun: false,
    registryWriter: async () => {
      const registry = JSON.parse(JSON.stringify(fixture.contract.proposedRegistry));
      registry.governedCompositeBaseline.releaseArtifactSha256 = h('f');
      return { applied: true, observedRegistry: registry, observedContent: canonicalContent(registry) };
    },
  }));
  assert.strictEqual(corruptedAfterWrite.status, STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED);
  assert.strictEqual(corruptedAfterWrite.verified, false);
  assert.strictEqual(corruptedAfterWrite.rollbackRequired, true);
  assert.strictEqual(corruptedAfterWrite.manualInterventionRequired, true);
  assert.strictEqual(corruptedAfterWrite.releaseAuthorized, false);

  const writerError = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    dryRun: false,
    registryWriter: async () => { throw new Error('simulated failure'); },
  }));
  assert.strictEqual(writerError.status, STATUS.HOLD_FRESH_ACTIVATION_EXECUTION);
  assert.strictEqual(writerError.mutationPerformed, null);
  assert.strictEqual(writerError.mutationOutcome, 'UNKNOWN_AFTER_WRITER_ERROR');
  assert.strictEqual(writerError.manualInterventionRequired, true);

  const rollbackDryRun = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    action: ACTION.ROLLBACK,
    currentRegistry: fixture.contract.proposedRegistry,
    currentRegistryContent: fixture.contract.proposedRegistryContent,
    executionId: 'rollback:p60',
  }));
  assert.strictEqual(rollbackDryRun.status, STATUS.FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED);
  assert.strictEqual(rollbackDryRun.verified, true);
  assert.strictEqual(rollbackDryRun.preWriteP58FreshCompositeVerified, true);
  assert.strictEqual(rollbackDryRun.targetP58LegacyVerified, true);

  const rollbackApplied = await executeFreshControlledCanonicalBaselineChange(baseInput(fixture, {
    action: ACTION.ROLLBACK,
    dryRun: false,
    currentRegistry: fixture.contract.proposedRegistry,
    currentRegistryContent: fixture.contract.proposedRegistryContent,
    executionId: 'rollback-apply:p60',
    registryWriter: async ({ nextContent }) => ({
      applied: true,
      observedContent: nextContent,
      observedRegistry: JSON.parse(nextContent),
    }),
  }));
  assert.strictEqual(rollbackApplied.status, STATUS.FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  assert.strictEqual(rollbackApplied.verified, true);
  assert.strictEqual(rollbackApplied.rollbackApplied, true);
  assert.strictEqual(rollbackApplied.postWriteP58Verified, true);
  assert.strictEqual(rollbackApplied.releaseStillBlocked, true);

  assert.throws(() => parseArgs(['--private-key', 'secret']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--action', 'activate', '--action', 'rollback']), /duplicate argument/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs([
    '--action', 'activate', '--registry', 'r', '--activation-contract', 'c', '--activation-plan', 'p',
    '--candidate', 'q', '--safety-guard', 's', '--owner-authority-registry', 'a',
    '--expected-owner-authority-registry-sha256', h('a'), '--signed-owner-decision', 'd',
    '--execution-id', 'e', '--operator-ref', 'o', '--executed-at', '2026-09-10T13:00:00Z', '--apply',
  ]), /--apply requires --confirm-exact-registry-mutation/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p60-atomic-writer-'));
  try {
    const registryPath = path.join(root, 'registry.json');
    const priorContent = canonicalContent(currentRegistry);
    fs.writeFileSync(registryPath, priorContent, 'utf8');
    const writer = createAtomicRegistryWriter(registryPath);
    const write = await writer({
      expectedPriorRegistryHashSha256: hashObject(currentRegistry),
      expectedPriorContent: priorContent,
      nextRegistryHashSha256: fixture.contract.proposedRegistryHashSha256,
      nextContentSha256: fixture.contract.proposedRegistryContentSha256,
      nextContent: fixture.contract.proposedRegistryContent,
    });
    assert.strictEqual(write.applied, true);
    assert.strictEqual(write.observedContent, fixture.contract.proposedRegistryContent);
    assert.strictEqual(hashObject(write.observedRegistry), fixture.contract.proposedRegistryHashSha256);

    const symlink = path.join(root, 'link.json');
    fs.symlinkSync(registryPath, symlink);
    assert.throws(() => safeReadJson(symlink, 'TEST'), /SYMLINK_REJECTED/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('P60 fresh controlled canonical baseline activation executor: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
