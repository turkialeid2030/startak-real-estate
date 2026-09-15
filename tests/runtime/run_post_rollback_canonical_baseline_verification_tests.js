'use strict';

const assert = require('assert');
const crypto = require('crypto');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P39_STATUS } = require('../../src/qualification/composite-baseline-activation-change-contract');
const {
  ACTIVATION_PURPOSE,
  normalizeActivationAuthorityRegistry,
} = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const {
  STATUS: P41_STATUS,
  prepareCanonicalBaselineActivationAuthorization,
} = require('../../src/qualification/canonical-baseline-activation-authorization-operator');
const {
  STATUS: P42_STATUS,
  ACTION: P42_ACTION,
  executeControlledCanonicalBaselineChange,
} = require('../../src/qualification/controlled-canonical-baseline-activation-executor');
const {
  STATUS: P43_STATUS,
  evaluatePostActivationCanonicalBaselineVerification,
} = require('../../src/qualification/post-activation-canonical-baseline-verification');
const {
  STATUS,
  evaluatePostRollbackCanonicalBaselineVerification,
} = require('../../src/qualification/post-rollback-canonical-baseline-verification');

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
      baselineId: 'canonical-rebaseline:p44-test',
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
    contractId: 'p39:p44-test',
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
  return {
    proposedRegistry,
    contract: {
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
    },
  };
}

function authorizationFixture(contract) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' })).trim();
  const authorityRegistry = {
    registryId: 'activation-authority-registry:p44-test',
    governanceArtifactSha256: '5'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test',
      actorRef: contract.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
      governanceEvidenceRef: 'governance:p44-owner-authority',
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
      allowedPurpose: ACTIVATION_PURPOSE,
    }],
  };
  const normalized = normalizeActivationAuthorityRegistry(authorityRegistry);
  const decision = {
    authorityId: 'owner-authority:test',
    actorRef: contract.preparedByRef,
    decisionId: 'activation-decision:p44-test',
    decision: 'AUTHORIZE',
    decisionSourceRef: 'decision:p44-owner',
    decisionArtifactSha256: '6'.repeat(64),
    decidedAt: '2026-09-10T09:10:00.000Z',
    rationaleRef: 'rationale:p44-owner',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const prepared = prepareCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: normalized.registryHashSha256,
    decision,
  });
  assert.strictEqual(prepared.status, P41_STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE);
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    privateKey,
  ).toString('base64');
  return {
    authorityRegistry,
    expectedHash: normalized.registryHashSha256,
    attestation: { ...prepared.attestationWithoutSignature, signatureBase64 },
  };
}

function releaseEvidence({ result, mode, registryHash, runId, completedAt }) {
  return {
    schemaVersion: 1,
    runId,
    sourceCommitSha: 'e'.repeat(40),
    completedAt,
    releaseVerifyResult: result,
    canonicalBaselineRegistryVerification: result,
    activeMode: mode,
    registryHashSha256: registryHash,
    testDiscoveryAndRegression: result,
    productionBuild: result,
    packageVerification: result,
    npmAuditReleaseThreshold: result,
    evidenceRef: `ci:${runId}`,
    evidenceArtifactSha256: 'f'.repeat(64),
  };
}

(async () => {
  const { contract, proposedRegistry } = contractFixture();
  const auth = authorizationFixture(contract);
  const common = {
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    activationAttestation: auth.attestation,
  };

  const activationExecution = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: P42_ACTION.ACTIVATE,
    dryRun: false,
    executionId: 'p44:activation',
    operatorRef: 'operator:test',
    executedAt: '2026-09-10T09:20:00.000Z',
    registryWriter: async (input) => ({ applied: true, observedContentSha256: input.nextContentSha256 }),
  });
  assert.strictEqual(activationExecution.status, P42_STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);

  const rollbackDecision = evaluatePostActivationCanonicalBaselineVerification({
    ...common,
    activationExecution,
    observedRegistry: proposedRegistry,
    releaseVerifyEvidence: releaseEvidence({
      result: 'FAIL',
      mode: MODE.GOVERNED_COMPOSITE_BASELINE,
      registryHash: contract.proposedRegistryHashSha256,
      runId: 'p43-failed-run',
      completedAt: '2026-09-10T09:30:00.000Z',
    }),
  });
  assert.strictEqual(rollbackDecision.status, P43_STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY);

  const rollbackExecution = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry: proposedRegistry,
    action: P42_ACTION.ROLLBACK,
    dryRun: false,
    executionId: 'p44:rollback',
    operatorRef: 'operator:test',
    executedAt: '2026-09-10T09:35:00.000Z',
    registryWriter: async (input) => ({ applied: true, observedContentSha256: input.nextContentSha256 }),
  });
  assert.strictEqual(rollbackExecution.status, P42_STATUS.ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);

  const goodReleaseEvidence = releaseEvidence({
    result: 'PASS',
    mode: MODE.LEGACY_FILE_SHA256,
    registryHash: contract.rollbackRegistryHashSha256,
    runId: 'p44-post-rollback-pass',
    completedAt: '2026-09-10T09:40:00.000Z',
  });

  const success = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution,
    observedRegistry: currentRegistry,
    releaseVerifyEvidence: goodReleaseEvidence,
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:45:00.000Z',
  });
  assert.strictEqual(success.status, STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY);
  assert.strictEqual(success.postRollbackVerificationPassed, true);
  assert.strictEqual(success.restoredExactP39LegacyRegistry, true);
  assert.strictEqual(success.incidentCloseoutReady, true);
  assert.strictEqual(success.incidentClosed, false);
  assert.strictEqual(success.releaseStillBlocked, true);
  assert.strictEqual(success.releaseAuthorized, false);
  assert.strictEqual(success.reactivationAllowed, false);
  assert.strictEqual(success.incidentCloseoutPacket.restoredLegacyRegistryHashSha256, contract.rollbackRegistryHashSha256);

  const failedRelease = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution,
    observedRegistry: currentRegistry,
    releaseVerifyEvidence: releaseEvidence({
      result: 'FAIL',
      mode: MODE.LEGACY_FILE_SHA256,
      registryHash: contract.rollbackRegistryHashSha256,
      runId: 'p44-post-rollback-fail',
      completedAt: '2026-09-10T09:40:00.000Z',
    }),
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:45:00.000Z',
  });
  assert.strictEqual(failedRelease.status, STATUS.POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN);
  assert.strictEqual(failedRelease.incidentCloseoutReady, false);
  assert.strictEqual(failedRelease.releaseStillBlocked, true);

  const driftedRegistry = JSON.parse(JSON.stringify(currentRegistry));
  driftedRegistry.legacyBaseline.evidenceStatus = 'FABRICATED';
  const drift = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution,
    observedRegistry: driftedRegistry,
    releaseVerifyEvidence: goodReleaseEvidence,
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:45:00.000Z',
  });
  assert.strictEqual(drift.status, STATUS.POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN);
  assert(drift.blockers.includes('POST_ROLLBACK_REGISTRY_HASH_MISMATCH'));

  const tamperedRollbackExecution = { ...rollbackExecution, targetRegistryHashSha256: '0'.repeat(64) };
  const tamper = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution: tamperedRollbackExecution,
    observedRegistry: currentRegistry,
    releaseVerifyEvidence: goodReleaseEvidence,
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:45:00.000Z',
  });
  assert.strictEqual(tamper.status, STATUS.HOLD_POST_ROLLBACK_VERIFICATION);
  assert(tamper.blockers.includes('P42_ROLLBACK_TARGET_REGISTRY_BINDING_MISMATCH'));

  const tamperedTrigger = {
    ...rollbackDecision,
    rollbackTrigger: { ...rollbackDecision.rollbackTrigger, reasonCodes: ['DIFFERENT_REASON'] },
  };
  const triggerTamper = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision: tamperedTrigger,
    rollbackExecution,
    observedRegistry: currentRegistry,
    releaseVerifyEvidence: goodReleaseEvidence,
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:45:00.000Z',
  });
  assert.strictEqual(triggerTamper.status, STATUS.HOLD_POST_ROLLBACK_VERIFICATION);
  assert(triggerTamper.blockers.includes('P43_ROLLBACK_TRIGGER_HASH_MISMATCH'));

  const tooEarly = evaluatePostRollbackCanonicalBaselineVerification({
    contract,
    activationExecution,
    rollbackDecision,
    rollbackExecution,
    observedRegistry: currentRegistry,
    releaseVerifyEvidence: goodReleaseEvidence,
    incidentId: 'incident:p44-test',
    incidentRef: 'incident-system:p44-test',
    closeoutPreparedByRef: 'operator:test',
    closeoutPreparedAt: '2026-09-10T09:39:00.000Z',
  });
  assert.strictEqual(tooEarly.status, STATUS.HOLD_POST_ROLLBACK_VERIFICATION);
  assert(tooEarly.blockers.includes('INCIDENT_CLOSEOUT_PREPARATION_PRECEDES_POST_ROLLBACK_RELEASE_VERIFY'));

  console.log('P44 post-rollback canonical baseline verification: PASS');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
