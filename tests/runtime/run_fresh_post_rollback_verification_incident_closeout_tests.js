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
  STATUS: P61_STATUS,
  P59_FRESH_VERIFICATION_MODE,
  evaluateFreshPostActivationVerification,
} = require('../../src/qualification/fresh-post-activation-verification-rollback-trigger');
const {
  STATUS,
  LEGACY_VERIFICATION_MODE,
  evaluateFreshPostRollbackVerification,
} = require('../../src/qualification/fresh-post-rollback-verification-incident-closeout');
const { parseArgs } = require('../../tools/fresh-post-rollback-verification-incident-closeout');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const h = (char) => char.repeat(64);
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function activationPlanFixture(currentHash) {
  const manifest = {
    schemaVersion: 1,
    baselineId: 'fresh-reactivation:cycle:p62',
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    cycleId: 'cycle:p62',
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
    activationChangeId: 'activation:p62',
    cycleId: manifest.cycleId,
    freshReactivationGovernanceCycleHashSha256: manifest.freshReactivationGovernanceCycleHashSha256,
    preparedByRef: 'owner:p62',
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
      authorityId: 'owner-authority:p62',
      actorRef: plan.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(String(publicKeyPem).trim()),
      governanceEvidenceRef: 'governance:owner:p62',
      activeFrom: '2026-09-10T00:00:00.000Z',
      activeUntil: '2026-09-11T00:00:00.000Z',
      allowedPurpose: PURPOSE,
    }],
  };
  const normalized = normalizeFreshOwnerAuthorityRegistry(authorityRegistry);
  const unsignedDecision = {
    decisionId: 'decision:p62',
    authorityId: 'owner-authority:p62',
    actorRef: plan.preparedByRef,
    decision: DECISION,
    decisionSourceRef: 'decision-source:p62',
    decisionArtifactSha256: h('e'),
    decidedAt: '2026-09-10T12:30:00.000Z',
    rationaleRef: 'rationale:p62',
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
    contractId: 'contract:p62',
    preparedByRef: plan.preparedByRef,
    preparedAt: '2026-09-10T12:45:00.000Z',
  });
  assert.strictEqual(contract.status, P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED);
  return { plan, candidate, guard, authorityRegistry, expectedRegistryHash: normalized.ownerAuthorityRegistryHashSha256, unsignedDecision, signedOwnerDecision, contract };
}

async function executeActivation(fixture) {
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
    executionId: 'activation-execution:p62',
    operatorRef: 'operator:p62',
    executedAt: '2026-09-10T13:00:00.000Z',
    registryWriter: async ({ nextContent }) => ({ applied: true, observedContent: nextContent, observedRegistry: JSON.parse(nextContent) }),
  });
  assert.strictEqual(result.status, P60_STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  return result;
}

function postActivationFailEvidence(fixture) {
  return {
    schemaVersion: 1,
    runId: 'release-verify:activation-fail:p62',
    sourceCommitSha: fixture.plan.freshSuccessorBaselineManifest.qualifiedSourceCommitSha,
    completedAt: '2026-09-10T13:10:00.000Z',
    releaseVerifyResult: 'FAIL',
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
    evidenceRef: 'github-actions:activation-fail:p62',
    evidenceArtifactSha256: h('f'),
  };
}

function triggerRollback(fixture, activationExecution) {
  const decision = evaluateFreshPostActivationVerification({
    activationExecution,
    observedRegistry: fixture.contract.proposedRegistry,
    observedRegistryContent: fixture.contract.proposedRegistryContent,
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
    releaseVerifyEvidence: postActivationFailEvidence(fixture),
  });
  assert.strictEqual(decision.status, P61_STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY);
  return decision;
}

async function executeRollback(fixture) {
  const result = await executeFreshControlledCanonicalBaselineChange({
    action: P60_ACTION.ROLLBACK,
    dryRun: false,
    currentRegistry: fixture.contract.proposedRegistry,
    currentRegistryContent: fixture.contract.proposedRegistryContent,
    activationChangeContract: fixture.contract,
    activationPlan: fixture.plan,
    freshCompositeCandidate: fixture.candidate,
    safetyGuard: fixture.guard,
    freshOwnerAuthorityRegistry: fixture.authorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256: fixture.expectedRegistryHash,
    signedOwnerDecision: fixture.signedOwnerDecision,
    executionId: 'rollback-execution:p62',
    operatorRef: 'operator:p62',
    executedAt: '2026-09-10T13:20:00.000Z',
    registryWriter: async ({ nextContent }) => ({ applied: true, observedContent: nextContent, observedRegistry: JSON.parse(nextContent) }),
  });
  assert.strictEqual(result.status, P60_STATUS.FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY);
  return result;
}

const expectedRollbackCommit = 'b'.repeat(40);
function postRollbackEvidence(fixture, overrides = {}) {
  return {
    schemaVersion: 1,
    runId: 'release-verify:rollback:p62',
    sourceCommitSha: expectedRollbackCommit,
    completedAt: '2026-09-10T13:30:00.000Z',
    releaseVerifyResult: 'PASS',
    testDiscoveryAndRegression: 'PASS',
    productionBuild: 'PASS',
    packageVerification: 'PASS',
    npmAuditReleaseThreshold: 'PASS',
    canonicalBaselineRegistryVerification: 'PASS',
    activeMode: MODE.LEGACY_FILE_SHA256,
    registrySchemaVersion: 1,
    verificationMode: LEGACY_VERIFICATION_MODE,
    registryHashSha256: fixture.contract.rollbackRegistryHashSha256,
    registryContentSha256: fixture.contract.rollbackRegistryContentSha256,
    evidenceRef: 'github-actions:rollback:p62',
    evidenceArtifactSha256: h('9'),
    ...overrides,
  };
}

function evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, overrides = {}) {
  return {
    activationChangeContract: fixture.contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution,
    observedRegistry: fixture.contract.rollbackRegistry,
    observedRegistryContent: fixture.contract.rollbackRegistryContent,
    releaseVerifyEvidence: postRollbackEvidence(fixture),
    expectedReleaseVerifyCommitSha: expectedRollbackCommit,
    incidentId: 'incident:p62',
    incidentRef: 'incident-ref:p62',
    closeoutPreparedByRef: 'incident-preparer:p62',
    closeoutPreparedAt: '2026-09-10T13:40:00.000Z',
    ...overrides,
  };
}

(async () => {
  const fixture = buildFixture();
  const activationExecution = await executeActivation(fixture);
  const rollbackDecision = triggerRollback(fixture, activationExecution);
  const rollbackExecution = await executeRollback(fixture);

  const success = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution));
  assert.strictEqual(success.status, STATUS.FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY);
  assert.strictEqual(success.verified, true);
  assert.strictEqual(success.postRollbackVerificationPassed, true);
  assert.strictEqual(success.restoredExactP57LegacyRegistry, true);
  assert.strictEqual(success.rollbackTriggerVerified, true);
  assert.strictEqual(success.rollbackExecutionVerified, true);
  assert.strictEqual(success.postRollbackReleaseVerifyEvidenceConsistent, true);
  assert.strictEqual(success.incidentCloseoutReady, true);
  assert.strictEqual(success.incidentClosed, false);
  assert.strictEqual(success.failedFreshActivationCycleReusable, false);
  assert.strictEqual(success.reactivationAllowed, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.match(success.incidentCloseoutPacketHashSha256, /^[a-f0-9]{64}$/);

  const deterministic = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution));
  assert.strictEqual(deterministic.incidentCloseoutPacketHashSha256, success.incidentCloseoutPacketHashSha256);
  assert.strictEqual(deterministic.postRollbackVerificationHashSha256, success.postRollbackVerificationHashSha256);

  const missingEvidence = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, { releaseVerifyEvidence: null }));
  assert.strictEqual(missingEvidence.status, STATUS.HOLD_FRESH_POST_ROLLBACK_VERIFICATION);
  assert(missingEvidence.blockers.includes('POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_REQUIRED'));
  assert.strictEqual(missingEvidence.incidentCloseoutReady, false);

  const failedRelease = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, {
    releaseVerifyEvidence: postRollbackEvidence(fixture, { releaseVerifyResult: 'FAIL' }),
  }));
  assert.strictEqual(failedRelease.status, STATUS.FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN);
  assert.strictEqual(failedRelease.incidentClosed, false);
  assert.strictEqual(failedRelease.releaseStillBlocked, true);

  const wrongMode = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, {
    releaseVerifyEvidence: postRollbackEvidence(fixture, { activeMode: MODE.GOVERNED_COMPOSITE_BASELINE }),
  }));
  assert(wrongMode.blockers.includes('POST_ROLLBACK_ACTIVE_MODE_NOT_LEGACY'));

  const wrongCommit = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, {
    releaseVerifyEvidence: postRollbackEvidence(fixture, { sourceCommitSha: 'c'.repeat(40) }),
  }));
  assert(wrongCommit.blockers.includes('POST_ROLLBACK_RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH'));

  const earlyEvidence = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, {
    releaseVerifyEvidence: postRollbackEvidence(fixture, { completedAt: '2026-09-10T13:19:59.000Z' }),
  }));
  assert(earlyEvidence.blockers.includes('POST_ROLLBACK_RELEASE_VERIFY_PRECEDES_ROLLBACK'));

  const restoredDrift = JSON.parse(JSON.stringify(fixture.contract.rollbackRegistry));
  restoredDrift.releaseAuthorized = true;
  const drift = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, {
    observedRegistry: restoredDrift,
    observedRegistryContent: canonicalContent(restoredDrift),
  }));
  assert.strictEqual(drift.status, STATUS.FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN);
  assert(drift.blockers.some((code) => code.includes('POST_ROLLBACK')));

  const tamperedTrigger = JSON.parse(JSON.stringify(rollbackDecision));
  tamperedTrigger.rollbackTrigger.reasonCodes = ['tampered'];
  const triggerHold = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, tamperedTrigger, rollbackExecution));
  assert.strictEqual(triggerHold.status, STATUS.HOLD_FRESH_POST_ROLLBACK_VERIFICATION);
  assert(triggerHold.blockers.includes('P61_ROLLBACK_TRIGGER_HASH_MISMATCH'));

  const tamperedRollbackExecution = { ...rollbackExecution, observedRegistryHashSha256: h('0') };
  const rollbackReceiptHold = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, tamperedRollbackExecution));
  assert.strictEqual(rollbackReceiptHold.status, STATUS.HOLD_FRESH_POST_ROLLBACK_VERIFICATION);
  assert(rollbackReceiptHold.blockers.includes('P60_ROLLBACK_EXECUTION_RECEIPT_HASH_MISMATCH'));

  const earlyCloseout = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, { closeoutPreparedAt: '2026-09-10T13:29:59.000Z' }));
  assert(earlyCloseout.blockers.includes('INCIDENT_CLOSEOUT_PREPARATION_PRECEDES_POST_ROLLBACK_RELEASE_VERIFY'));

  const escalation = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, { incidentClosed: true }));
  assert(escalation.blockers.includes('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'));

  const privateKey = evaluateFreshPostRollbackVerification(evalInput(fixture, activationExecution, rollbackDecision, rollbackExecution, { privateKeyPem: 'forbidden' }));
  assert(privateKey.blockers.some((code) => code.startsWith('PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED')));

  const parsed = parseArgs([
    '--activation-contract', 'contract.json',
    '--activation-execution', 'activation.json',
    '--rollback-decision', 'decision.json',
    '--rollback-execution', 'rollback.json',
    '--observed-registry', 'registry.json',
    '--release-verify-evidence', 'rv.json',
    '--expected-release-verify-commit-sha', expectedRollbackCommit,
    '--incident-id', 'incident:p62',
    '--incident-ref', 'incident-ref:p62',
    '--closeout-prepared-by-ref', 'preparer:p62',
    '--closeout-prepared-at', '2026-09-10T13:40:00.000Z',
  ]);
  assert.strictEqual(parsed.rollbackDecisionPath, 'decision.json');
  assert.throws(() => parseArgs(['--private-key', 'secret']), /private or secret signing key argument rejected/);
  assert.throws(() => parseArgs(['--unknown', 'x']), /unknown argument/);
  assert.throws(() => parseArgs(['--incident-id', 'a', '--incident-id', 'b']), /duplicate argument/);

  console.log('P62 fresh post-rollback verification and incident closeout: PASS');
})();
