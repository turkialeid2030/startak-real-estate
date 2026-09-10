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
  ACTION: P60_ACTION,
  STATUS: P60_STATUS,
  executeFreshControlledCanonicalBaselineChange,
} = require('../../src/qualification/fresh-controlled-canonical-baseline-activation-executor');
const {
  STATUS,
  P59_FRESH_VERIFICATION_MODE,
  evaluateFreshPostActivationVerification,
} = require('../../src/qualification/fresh-post-activation-verification-rollback-trigger');
const {
  parseArgs,
} = require('../../tools/fresh-post-activation-verification-rollback-trigger');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p61',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p61',
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
    activationChangeId: 'activation:p61',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p61',
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
      authorityId: 'owner-authority:p61',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p61',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalized = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p61',
    authorityId: 'owner-authority:p61',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p61',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p61',
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
    contractId: 'contract:p61',
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

async function buildAppliedExecution(fixture) {
  const result = await executeFreshControlledCanonicalBaselineChange({
    action: P60_ACTION.ACTIVATE,
    dryRun: false,
    currentRegistry,
    currentRegistryContent: canonicalContent(currentRegistry),
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
    executionId: 'execution:p61',
    operatorRef: 'operator:p61',
    executedAt: '2026-09-10T13:00:00.000Z',
    registryWriter: async ({ nextContent }) => ({
      applied: true,
      observedContent: nextContent,
      observedRegistry: JSON.parse(nextContent),
    }),
  });
  assert.strictEqual(result.status, P60_STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  return result;
}

function releaseEvidence(fixture, overrides = {}) {
  return {
    schemaVersion: 1,
    runId: 'release-verify:p61',
    sourceCommitSha: fixture.plan.freshSuccessorBaselineManifest.qualifiedSourceCommitSha,
    completedAt: '2026-09-10T13:15:00.000Z',
    releaseVerifyResult: 'PASS',
    testDiscoveryAndRegression: 'PASS',
    productionBuild: 'PASS',
    packageVerification: 'PASS',
    npmAuditReleaseThreshold: 'PASS',
    canonicalBaselineRegistryVerification: 'PASS',
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registrySchemaVersion: 3,
    verificationMode: P59_FRESH_VERIFICATION_MODE,
    registryHashSha256: fixture.contract.proposedRegistryHashSha256,
    registryContentSha256: fixture.contract.proposedRegistryContentSha256,
    evidenceRef: 'github-actions:release-verify:p61',
    evidenceArtifactSha256: h('f'),
    ...overrides,
  };
}

function evaluateInput(fixture, execution, overrides = {}) {
  return {
    activationExecution: execution,
    observedRegistry: fixture.contract.proposedRegistry,
    observedRegistryContent: fixture.contract.proposedRegistryContent,
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
    releaseVerifyEvidence: releaseEvidence(fixture),
    ...overrides,
  };
}

(async () => {
  const fixture = buildFixture();
  const execution = await buildAppliedExecution(fixture);

  const success = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution));
  assert.strictEqual(success.status, STATUS.FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.postActivationVerificationPassed, true);
  assert.strictEqual(success.p60ActivationReceiptVerified, true);
  assert.strictEqual(success.p58ObservedFreshCompositeVerified, true);
  assert.strictEqual(success.p59ReleaseGateEvidenceConsistent, true);
  assert.strictEqual(success.postChangeReleaseVerifySatisfiedBySuppliedEvidence, true);
  assert.strictEqual(success.releaseVerifyEvidenceAuthenticityVerifiedHere, false);
  assert.strictEqual(success.releaseStillBlocked, true);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.match(success.postActivationVerificationHashSha256, /^[a-f0-9]{64}$/);

  const deterministic = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution));
  assert.strictEqual(deterministic.postActivationVerificationHashSha256, success.postActivationVerificationHashSha256);

  const missingEvidence = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, { releaseVerifyEvidence: null }));
  assert.strictEqual(missingEvidence.status, STATUS.HOLD_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(missingEvidence.blockers.includes('POST_CHANGE_RELEASE_VERIFY_EVIDENCE_REQUIRED'));
  assert.strictEqual(missingEvidence.rollbackRequired, false);

  const failedRelease = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { releaseVerifyResult: 'FAIL' }),
  }));
  assert.strictEqual(failedRelease.status, STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY);
  assert.strictEqual(failedRelease.rollbackRequired, true);
  assert.strictEqual(failedRelease.rollbackTrigger.rollbackAction, P60_ACTION.ROLLBACK);
  assert.strictEqual(failedRelease.rollbackTrigger.rollbackRegistryHashSha256, fixture.contract.rollbackRegistryHashSha256);
  assert.strictEqual(failedRelease.rollbackTrigger.automaticRollbackMutationPerformed, false);
  assert.strictEqual(failedRelease.rollbackTrigger.p60ControlledRollbackExecutionRequired, true);

  const buildFail = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { productionBuild: 'FAIL' }),
  }));
  assert.strictEqual(buildFail.status, STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY);

  const wrongMode = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { activeMode: MODE.LEGACY_FILE_SHA256 }),
  }));
  assert(wrongMode.rollbackTrigger.reasonCodes.includes('POST_CHANGE_ACTIVE_MODE_NOT_FRESH_COMPOSITE'));

  const wrongCommit = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { sourceCommitSha: 'b'.repeat(40) }),
  }));
  assert(wrongCommit.rollbackTrigger.reasonCodes.includes('POST_CHANGE_RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH'));

  const earlyEvidence = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { completedAt: '2026-09-10T12:59:59.000Z' }),
  }));
  assert(earlyEvidence.rollbackTrigger.reasonCodes.includes('POST_CHANGE_RELEASE_VERIFY_PRECEDES_ACTIVATION'));

  const observedDrift = JSON.parse(JSON.stringify(fixture.contract.proposedRegistry));
  observedDrift.governedCompositeBaseline.releaseArtifactSha256 = h('9');
  const drift = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    observedRegistry: observedDrift,
    observedRegistryContent: canonicalContent(observedDrift),
  }));
  assert.strictEqual(drift.status, STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY);
  assert(drift.rollbackTrigger.reasonCodes.some((code) => code.includes('POST_ACTIVATION_REGISTRY')));

  const badSignature = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    signedOwnerDecision: { ...fixture.unsignedDecision, signatureBase64: Buffer.from('bad').toString('base64') },
  }));
  assert.strictEqual(badSignature.status, STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY);
  assert(badSignature.rollbackTrigger.reasonCodes.includes('P58_POST_ACTIVATION_FRESH_COMPOSITE_VERIFICATION_FAILED'));

  const tamperedExecution = { ...execution, observedRegistryHashSha256: h('0') };
  const tamperedReceipt = evaluateFreshPostActivationVerification(evaluateInput(fixture, tamperedExecution));
  assert.strictEqual(tamperedReceipt.status, STATUS.HOLD_FRESH_POST_ACTIVATION_VERIFICATION);
  assert(tamperedReceipt.blockers.includes('P60_EXECUTION_RECEIPT_HASH_MISMATCH'));

  const dryRunExecution = await executeFreshControlledCanonicalBaselineChange({
    action: P60_ACTION.ACTIVATE,
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
    executionId: 'dry-run:p61',
    operatorRef: 'operator:p61',
    executedAt: '2026-09-10T13:00:00.000Z',
  });
  const dryRunRejected = evaluateFreshPostActivationVerification(evaluateInput(fixture, dryRunExecution));
  assert(dryRunRejected.blockers.includes('P60_APPLIED_FRESH_ACTIVATION_RECEIPT_REQUIRED'));

  const privateKey = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, { privateKeyPem: 'forbidden' }));
  assert(privateKey.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  const escalation = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, { releaseAuthorized: true }));
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const failedReleaseAgain = evaluateFreshPostActivationVerification(evaluateInput(fixture, execution, {
    releaseVerifyEvidence: releaseEvidence(fixture, { releaseVerifyResult: 'FAIL' }),
  }));
  assert.strictEqual(failedReleaseAgain.rollbackTriggerHashSha256, failedRelease.rollbackTriggerHashSha256);

  const parsed = parseArgs([
    '--activation-execution', 'execution.json',
    '--observed-registry', 'registry.json',
    '--activation-contract', 'contract.json',
    '--activation-plan', 'plan.json',
    '--candidate', 'candidate.json',
    '--safety-guard', 'guard.json',
    '--owner-authority-registry', 'owner.json',
    '--expected-owner-authority-registry-sha256', h('1'),
    '--signed-owner-decision', 'decision.json',
  ]);
  assert.strictEqual(parsed.observedRegistryPath, 'registry.json');
  assert.throws(() => parseArgs(['--private-key', 'secret']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--activation-execution', 'a', '--activation-execution', 'b']), /duplicate argument/);

  console.log('P61 fresh post-activation verification and rollback trigger: PASS');
})();
