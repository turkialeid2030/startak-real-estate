'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const { MODE, evaluateCurrentCanonicalBaselineRegistry, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P39_STATUS } = require('../../src/qualification/composite-baseline-activation-change-contract');
const { ACTIVATION_PURPOSE, normalizeActivationAuthorityRegistry } = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const { STATUS: P41_STATUS, prepareCanonicalBaselineActivationAuthorization, verifyCanonicalBaselineActivationAuthorization } = require('../../src/qualification/canonical-baseline-activation-authorization-operator');
const { STATUS: P42_STATUS, ACTION, executeControlledCanonicalBaselineChange } = require('../../src/qualification/controlled-canonical-baseline-activation-executor');
const { STATUS, evaluatePostActivationCanonicalBaselineVerification } = require('../../src/qualification/post-activation-canonical-baseline-verification');

const hashText = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hashObject = (value) => hashText(stableStringify(value));
const canonicalContent = (value) => `${JSON.stringify(value, null, 2)}\n`;

function contractFixture() {
  const legacy = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const manifestHash = '1'.repeat(64);
  const planHash = '2'.repeat(64);
  const reviewerLockHash = '3'.repeat(64);
  const safetyHash = '4'.repeat(64);
  const proposedRegistry = {
    schemaVersion: 2,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: JSON.parse(JSON.stringify(currentRegistry.legacyBaseline)),
    governedCompositeBaseline: {
      baselineId: 'canonical-rebaseline:p43-test',
      baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
      qualifiedSourceCommitSha: 'a'.repeat(40),
      releaseArtifactSha256: 'b'.repeat(64),
      environmentConfigSha256: 'c'.repeat(64),
      supersedesLegacyCanonicalSha256: currentRegistry.legacyBaseline.expectedSha256,
      governanceDecisionHashSha256: 'd'.repeat(64),
      reviewerLockHashSha256: reviewerLockHash,
      successorBaselineManifestHashSha256: manifestHash,
      cutoverSafetyGuardHashSha256: safetyHash,
    },
    activationPlanHashSha256: planHash,
    activationApplied: true,
    canonicalBaselineChanged: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
  const proposedRegistryContent = canonicalContent(proposedRegistry);
  const rollbackRegistry = JSON.parse(JSON.stringify(currentRegistry));
  const rollbackRegistryContent = canonicalContent(rollbackRegistry);
  const core = {
    schemaVersion: 1,
    contractId: 'p39:p43-test',
    preparedByRef: 'owner:test',
    preparedAt: '2026-09-10T09:00:00.000Z',
    targetPath: 'config/governance/canonical-baseline.json',
    expectedPriorMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    expectedPriorRegistryHashSha256: legacy.registryHashSha256,
    activationPlanHashSha256: planHash,
    successorBaselineManifestHashSha256: manifestHash,
    reviewerLockHashSha256: reviewerLockHash,
    cutoverSafetyGuardHashSha256: safetyHash,
    proposedRegistryHashSha256: hashObject(proposedRegistry),
    proposedRegistryContentSha256: hashText(proposedRegistryContent),
    rollbackRegistryHashSha256: legacy.registryHashSha256,
    rollbackRegistryContentSha256: hashText(rollbackRegistryContent),
  };
  return { proposedRegistry, contract: {
    ...core,
    status: P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED,
    activationChangeContractHashSha256: hashObject(core),
    blockers: [],
    proposedRegistry,
    proposedRegistryContent,
    rollbackRegistry,
    rollbackRegistryContent,
    rollbackRestoresExactCurrentLogicalRegistry: true,
    proposedRegistryRepresentsPostActivationStateOnly: true,
    activationAuthorizationGranted: false,
    humanActivationAuthorizationStillRequired: true,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    postActivationReleaseVerifyRequired: true,
    releaseGateImplementationUpdateRequired: true,
    e2iPolicyReviewStillRequired: true,
    productionEvidenceEstablishedHere: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  } };
}

function authorizationFixture(contract) {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(pair.publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const authorityRegistry = {
    registryId: 'activation-authority-registry:p43-test',
    governanceArtifactSha256: '5'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test', actorRef: contract.preparedByRef, publicKeyPem,
      publicKeySha256: hashText(publicKeyPem), governanceEvidenceRef: 'governance:p43-owner-authority',
      activeFrom: '2026-09-01T00:00:00.000Z', activeUntil: '2026-12-31T23:59:59.000Z', allowedPurpose: ACTIVATION_PURPOSE,
    }],
  };
  const normalized = normalizeActivationAuthorityRegistry(authorityRegistry);
  const decision = {
    authorityId: 'owner-authority:test', actorRef: contract.preparedByRef,
    decisionId: 'activation-decision:p43-test', decision: 'AUTHORIZE', decisionSourceRef: 'decision:p43-owner',
    decisionArtifactSha256: '6'.repeat(64), decidedAt: '2026-09-10T09:10:00.000Z',
    rationaleRef: 'rationale:p43-owner', signatureAlgorithm: 'RSA-SHA256',
  };
  const prepared = prepareCanonicalBaselineActivationAuthorization({ contract, activationAuthorityRegistry: authorityRegistry, expectedActivationAuthorityRegistryHashSha256: normalized.registryHashSha256, decision });
  assert.strictEqual(prepared.status, P41_STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE);
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(prepared.signingPayload), 'utf8'), pair.privateKey).toString('base64');
  const attestation = { ...prepared.attestationWithoutSignature, signatureBase64 };
  const verified = verifyCanonicalBaselineActivationAuthorization({ contract, activationAuthorityRegistry: authorityRegistry, expectedActivationAuthorityRegistryHashSha256: normalized.registryHashSha256, attestation });
  assert.strictEqual(verified.status, P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION);
  return { authorityRegistry, expectedHash: normalized.registryHashSha256, attestation, verified };
}

function releaseEvidence(contract, overrides = {}) {
  return {
    schemaVersion: 1,
    runId: 'release-verify:p43-test', sourceCommitSha: 'f'.repeat(40), completedAt: '2026-09-10T09:30:00.000Z',
    releaseVerifyResult: 'PASS', canonicalBaselineRegistryVerification: 'PASS', activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registryHashSha256: contract.proposedRegistryHashSha256, testDiscoveryAndRegression: 'PASS', productionBuild: 'PASS',
    packageVerification: 'PASS', npmAuditReleaseThreshold: 'PASS', evidenceRef: 'ci:release-verify:p43-test', evidenceArtifactSha256: '9'.repeat(64),
    ...overrides,
  };
}

(async () => {
  const { contract, proposedRegistry } = contractFixture();
  const auth = authorizationFixture(contract);
  const activationExecution = await executeControlledCanonicalBaselineChange({
    action: ACTION.ACTIVATE, dryRun: false, currentRegistry, contract,
    activationAuthorityRegistry: auth.authorityRegistry, expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    activationAttestation: auth.attestation, verifiedOwnerAuthorization: auth.verified,
    executionId: 'p42:p43-test', operatorRef: 'operator:test', executedAt: '2026-09-10T09:20:00.000Z',
    registryWriter: async (input) => ({ applied: true, observedContentSha256: input.nextContentSha256 }),
  });
  assert.strictEqual(activationExecution.status, P42_STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);

  const common = { activationExecution, observedRegistry: proposedRegistry, contract, activationAuthorityRegistry: auth.authorityRegistry, expectedActivationAuthorityRegistryHashSha256: auth.expectedHash, activationAttestation: auth.attestation };

  const missing = evaluatePostActivationCanonicalBaselineVerification(common);
  assert.strictEqual(missing.status, STATUS.HOLD_POST_ACTIVATION_VERIFICATION);
  assert(missing.blockers.includes('POST_CHANGE_RELEASE_VERIFY_EVIDENCE_REQUIRED'));

  const success = evaluatePostActivationCanonicalBaselineVerification({ ...common, releaseVerifyEvidence: releaseEvidence(contract) });
  assert.strictEqual(success.status, STATUS.POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED);
  assert.strictEqual(success.postActivationVerificationPassed, true);
  assert.strictEqual(success.rollbackRequired, false);
  assert.strictEqual(success.releaseStillBlocked, true);
  assert.strictEqual(success.releaseVerifyEvidenceAuthenticityVerifiedHere, false);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(success.goLiveAuthorized, false);

  const failed = evaluatePostActivationCanonicalBaselineVerification({ ...common, releaseVerifyEvidence: releaseEvidence(contract, { releaseVerifyResult: 'FAIL', productionBuild: 'FAIL' }) });
  assert.strictEqual(failed.status, STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY);
  assert.strictEqual(failed.rollbackRequired, true);
  assert.strictEqual(failed.automaticRollbackMutationPerformed, false);
  assert.strictEqual(failed.rollbackTrigger.rollbackRegistryHashSha256, contract.rollbackRegistryHashSha256);
  assert.strictEqual(failed.rollbackTrigger.p42ControlledRollbackExecutionRequired, true);
  assert(failed.rollbackTrigger.reasonCodes.includes('POST_CHANGE_RELEASE_VERIFY_RESULT_FAILED'));

  const drifted = JSON.parse(JSON.stringify(proposedRegistry));
  drifted.governedCompositeBaseline.releaseArtifactSha256 = '0'.repeat(64);
  const drift = evaluatePostActivationCanonicalBaselineVerification({ ...common, observedRegistry: drifted });
  assert.strictEqual(drift.status, STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY);

  const receiptHold = evaluatePostActivationCanonicalBaselineVerification({ ...common, activationExecution: { ...activationExecution, executionReceiptHashSha256: '0'.repeat(64) } });
  assert.strictEqual(receiptHold.status, STATUS.HOLD_POST_ACTIVATION_VERIFICATION);
  assert(receiptHold.blockers.includes('P42_EXECUTION_RECEIPT_HASH_MISMATCH'));

  const badAuthorization = evaluatePostActivationCanonicalBaselineVerification({ ...common, activationAttestation: { ...auth.attestation, signatureBase64: Buffer.from('bad').toString('base64') } });
  assert.strictEqual(badAuthorization.status, STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY);

  console.log('P43 post-activation canonical baseline verification and rollback trigger: PASS');
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
