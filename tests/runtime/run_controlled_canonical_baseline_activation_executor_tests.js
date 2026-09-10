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
const { STATUS: P39_STATUS } = require('../../src/qualification/composite-baseline-activation-change-contract');
const {
  ACTIVATION_PURPOSE,
  normalizeActivationAuthorityRegistry,
} = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const {
  STATUS: P41_STATUS,
  prepareCanonicalBaselineActivationAuthorization,
  verifyCanonicalBaselineActivationAuthorization,
} = require('../../src/qualification/canonical-baseline-activation-authorization-operator');
const {
  STATUS,
  ACTION,
  executeControlledCanonicalBaselineChange,
} = require('../../src/qualification/controlled-canonical-baseline-activation-executor');
const {
  parseArgs,
  run: runCli,
} = require('../../tools/controlled-canonical-baseline-activation');

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function canonicalContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildContractFixture() {
  const legacy = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  assert.strictEqual(legacy.status, 'LEGACY_BASELINE_REGISTRY_CONFIRMED');
  const manifestHash = '1'.repeat(64);
  const planHash = '2'.repeat(64);
  const reviewerLockHash = '3'.repeat(64);
  const safetyHash = '4'.repeat(64);
  const proposedRegistry = {
    schemaVersion: 2,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: JSON.parse(JSON.stringify(currentRegistry.legacyBaseline)),
    governedCompositeBaseline: {
      baselineId: 'canonical-rebaseline:p42-test',
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
    contractId: 'p39:p42-test',
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
    proposedRegistryHashSha256: sha256Object(proposedRegistry),
    proposedRegistryContentSha256: sha256Text(proposedRegistryContent),
    rollbackRegistryHashSha256: legacy.registryHashSha256,
    rollbackRegistryContentSha256: sha256Text(rollbackRegistryContent),
  };
  const contract = {
    ...core,
    status: P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED,
    activationChangeContractHashSha256: sha256Object(core),
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
  };
  return { contract, proposedRegistry };
}

function buildAuthorization(contract) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' }));
  const authorityRegistry = {
    registryId: 'activation-authority-registry:p42-test',
    governanceArtifactSha256: '5'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test',
      actorRef: contract.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: 'governance:p42-owner-authority',
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
      allowedPurpose: ACTIVATION_PURPOSE,
    }],
  };
  const normalized = normalizeActivationAuthorityRegistry(authorityRegistry);
  const decision = {
    authorityId: 'owner-authority:test',
    actorRef: contract.preparedByRef,
    decisionId: 'activation-decision:p42-test',
    decision: 'AUTHORIZE',
    decisionSourceRef: 'decision:p42-owner',
    decisionArtifactSha256: '6'.repeat(64),
    decidedAt: '2026-09-10T09:10:00.000Z',
    rationaleRef: 'rationale:p42-owner',
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
  const attestation = { ...prepared.attestationWithoutSignature, signatureBase64 };
  const verified = verifyCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: normalized.registryHashSha256,
    attestation,
  });
  assert.strictEqual(verified.status, P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION);
  return { authorityRegistry, expectedHash: normalized.registryHashSha256, attestation, verified };
}

(async function runTests() {
  const { contract, proposedRegistry } = buildContractFixture();
  const auth = buildAuthorization(contract);
  const common = {
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    activationAttestation: auth.attestation,
    verifiedOwnerAuthorization: auth.verified,
    executionId: 'p42-execution:test',
    operatorRef: 'operator:test',
    executedAt: '2026-09-10T09:15:00.000Z',
  };

  let writerCalled = false;
  const dryRun = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ACTIVATE,
    registryWriter: async () => { writerCalled = true; return { applied: true }; },
  });
  assert.strictEqual(dryRun.status, STATUS.ACTIVATION_DRY_RUN_READY);
  assert.strictEqual(dryRun.verified, true);
  assert.strictEqual(dryRun.dryRun, true);
  assert.strictEqual(writerCalled, false);
  assert.strictEqual(dryRun.mutationPerformed, false);
  assert.strictEqual(dryRun.activationApplied, false);
  assert.strictEqual(dryRun.releaseAuthorized, false);
  assert.strictEqual(dryRun.targetRegistry.activeMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(dryRun.signedOwnerAuthorizationVerificationHashSha256, auth.verified.signedAuthorizationVerificationHashSha256);

  const noWriter = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ACTIVATE,
    dryRun: false,
  });
  assert.strictEqual(noWriter.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(noWriter.blockers.includes('REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'));

  let activationWrite;
  const applied = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ACTIVATE,
    dryRun: false,
    registryWriter: async (input) => {
      activationWrite = input;
      return { applied: true, observedContentSha256: input.nextContentSha256 };
    },
  });
  assert.strictEqual(applied.status, STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);
  assert.strictEqual(applied.mutationPerformed, true);
  assert.strictEqual(applied.activationApplied, true);
  assert.strictEqual(applied.postChangeReleaseVerifySatisfied, false);
  assert.strictEqual(applied.releaseAuthorized, false);
  assert.strictEqual(activationWrite.expectedPriorContent, canonicalContent(currentRegistry));
  assert.strictEqual(activationWrite.nextContent, contract.proposedRegistryContent);

  const failedWriter = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ACTIVATE,
    dryRun: false,
    registryWriter: async () => ({ applied: false }),
  });
  assert.strictEqual(failedWriter.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(failedWriter.blockers.includes('REGISTRY_WRITER_DID_NOT_CONFIRM_EXACT_ACTIVATION_WRITE'));

  const staleRegistry = JSON.parse(JSON.stringify(currentRegistry));
  staleRegistry.legacyBaseline.evidenceStatus = 'VERIFIED';
  const stale = await executeControlledCanonicalBaselineChange({ ...common, currentRegistry: staleRegistry });
  assert.strictEqual(stale.status, STATUS.HOLD_ACTIVATION_EXECUTION);

  const fakePreverified = { ...auth.verified, signedAuthorizationVerificationHashSha256: '0'.repeat(64) };
  const preverifiedMismatch = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    verifiedOwnerAuthorization: fakePreverified,
  });
  assert.strictEqual(preverifiedMismatch.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(preverifiedMismatch.blockers.includes('P41_VERIFIED_OWNER_AUTHORIZATION_BINDING_MISMATCH'));

  const rollbackDry = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry: proposedRegistry,
    action: ACTION.ROLLBACK,
  });
  assert.strictEqual(rollbackDry.status, STATUS.ROLLBACK_DRY_RUN_READY);
  assert.strictEqual(rollbackDry.mutationPerformed, false);
  assert.strictEqual(rollbackDry.rollbackApplied, false);
  assert.strictEqual(rollbackDry.targetRegistry.activeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(rollbackDry.rollbackLimitedToP39PreboundExactLegacyState, true);

  const rollbackApplied = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry: proposedRegistry,
    action: ACTION.ROLLBACK,
    dryRun: false,
    registryWriter: async (input) => ({ applied: true, observedContentSha256: input.nextContentSha256 }),
  });
  assert.strictEqual(rollbackApplied.status, STATUS.ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);
  assert.strictEqual(rollbackApplied.mutationPerformed, true);
  assert.strictEqual(rollbackApplied.rollbackApplied, true);
  assert.strictEqual(rollbackApplied.releaseAuthorized, false);

  const wrongRollbackSource = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ROLLBACK,
  });
  assert.strictEqual(wrongRollbackSource.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(wrongRollbackSource.blockers.includes('CURRENT_COMPOSITE_REGISTRY_DOES_NOT_MATCH_P39_PROPOSED_REGISTRY'));

  assert.throws(
    () => parseArgs(['--private-key', '/tmp/key.pem']),
    /private signing key argument rejected/,
  );
  assert.throws(
    () => parseArgs(['--apply']),
    /missing required argument|--apply requires/,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p42-cli-'));
  try {
    const registryPath = path.join(dir, 'registry.json');
    const contractPath = path.join(dir, 'contract.json');
    const authorityPath = path.join(dir, 'authority.json');
    const attestationPath = path.join(dir, 'attestation.json');
    const outputPath = path.join(dir, 'output.json');
    fs.writeFileSync(registryPath, canonicalContent(currentRegistry));
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(authorityPath, JSON.stringify(auth.authorityRegistry));
    fs.writeFileSync(attestationPath, JSON.stringify(auth.attestation));
    const code = await runCli([
      '--action', 'activate',
      '--registry', registryPath,
      '--contract', contractPath,
      '--authority-registry', authorityPath,
      '--expected-authority-registry-sha256', auth.expectedHash,
      '--attestation', attestationPath,
      '--execution-id', 'p42-cli:test',
      '--operator-ref', 'operator:test',
      '--executed-at', '2026-09-10T09:20:00.000Z',
      '--output', outputPath,
    ]);
    assert.strictEqual(code, 0);
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.strictEqual(output.status, STATUS.ACTIVATION_DRY_RUN_READY);
    assert.strictEqual(JSON.parse(fs.readFileSync(registryPath, 'utf8')).activeMode, MODE.LEGACY_FILE_SHA256);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P42 controlled canonical baseline activation executor: PASS');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
