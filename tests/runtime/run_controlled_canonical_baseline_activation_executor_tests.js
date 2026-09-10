'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const currentRegistry = require('../../config/governance/canonical-baseline.json');
const { MODE, evaluateCurrentCanonicalBaselineRegistry, stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P39_STATUS } = require('../../src/qualification/composite-baseline-activation-change-contract');
const { ACTIVATION_PURPOSE, normalizeActivationAuthorityRegistry } = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
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
const { parseArgs, run: runCli } = require('../../tools/controlled-canonical-baseline-activation');

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
    registryId: 'activation-authority-registry:p42-test',
    governanceArtifactSha256: '5'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test',
      actorRef: contract.preparedByRef,
      publicKeyPem,
      publicKeySha256: hashText(publicKeyPem),
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

(async () => {
  const { contract, proposedRegistry } = contractFixture();
  const auth = authorizationFixture(contract);
  const common = {
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    activationAttestation: auth.attestation,
    verifiedOwnerAuthorization: auth.verified,
    executionId: 'p42:test',
    operatorRef: 'operator:test',
    executedAt: '2026-09-10T09:15:00.000Z',
  };

  let writerCalled = false;
  const dry = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    action: ACTION.ACTIVATE,
    registryWriter: async () => { writerCalled = true; return { applied: true }; },
  });
  assert.strictEqual(dry.status, STATUS.ACTIVATION_DRY_RUN_READY);
  assert.strictEqual(dry.dryRun, true);
  assert.strictEqual(writerCalled, false);
  assert.strictEqual(dry.mutationPerformed, false);
  assert.strictEqual(dry.activationApplied, false);
  assert.strictEqual(dry.releaseAuthorized, false);
  assert.strictEqual(dry.targetRegistry.activeMode, MODE.GOVERNED_COMPOSITE_BASELINE);
  assert.strictEqual(dry.signedOwnerAuthorizationVerificationHashSha256, auth.verified.signedAuthorizationVerificationHashSha256);

  const noWriter = await executeControlledCanonicalBaselineChange({ ...common, currentRegistry, dryRun: false });
  assert.strictEqual(noWriter.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(noWriter.blockers.includes('REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'));

  let writeInput;
  const applied = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    dryRun: false,
    registryWriter: async (input) => {
      writeInput = input;
      return { applied: true, observedContentSha256: input.nextContentSha256 };
    },
  });
  assert.strictEqual(applied.status, STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY);
  assert.strictEqual(applied.activationApplied, true);
  assert.strictEqual(applied.releaseAuthorized, false);
  assert.strictEqual(writeInput.expectedPriorContent, canonicalContent(currentRegistry));
  assert.strictEqual(writeInput.nextContent, contract.proposedRegistryContent);

  const writerFail = await executeControlledCanonicalBaselineChange({
    ...common,
    currentRegistry,
    dryRun: false,
    registryWriter: async () => ({ applied: false }),
  });
  assert.strictEqual(writerFail.status, STATUS.HOLD_ACTIVATION_EXECUTION);

  const fakeVerified = { ...auth.verified, signedAuthorizationVerificationHashSha256: '0'.repeat(64) };
  const mismatch = await executeControlledCanonicalBaselineChange({ ...common, currentRegistry, verifiedOwnerAuthorization: fakeVerified });
  assert.strictEqual(mismatch.status, STATUS.HOLD_ACTIVATION_EXECUTION);
  assert(mismatch.blockers.includes('P41_VERIFIED_OWNER_AUTHORIZATION_BINDING_MISMATCH'));

  const rollbackDry = await executeControlledCanonicalBaselineChange({ ...common, currentRegistry: proposedRegistry, action: ACTION.ROLLBACK });
  assert.strictEqual(rollbackDry.status, STATUS.ROLLBACK_DRY_RUN_READY);
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
  assert.strictEqual(rollbackApplied.rollbackApplied, true);
  assert.strictEqual(rollbackApplied.releaseAuthorized, false);

  const wrongRollback = await executeControlledCanonicalBaselineChange({ ...common, currentRegistry, action: ACTION.ROLLBACK });
  assert.strictEqual(wrongRollback.status, STATUS.HOLD_ACTIVATION_EXECUTION);

  assert.throws(() => parseArgs(['--private-key', '/tmp/key.pem']), /private signing key argument rejected/);

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
      '--action', 'activate', '--registry', registryPath, '--contract', contractPath,
      '--authority-registry', authorityPath, '--expected-authority-registry-sha256', auth.expectedHash,
      '--attestation', attestationPath, '--execution-id', 'p42-cli:test', '--operator-ref', 'operator:test',
      '--executed-at', '2026-09-10T09:20:00.000Z', '--output', outputPath,
    ]);
    assert.strictEqual(code, 0);
    assert.strictEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')).status, STATUS.ACTIVATION_DRY_RUN_READY);
    assert.strictEqual(JSON.parse(fs.readFileSync(registryPath, 'utf8')).activeMode, MODE.LEGACY_FILE_SHA256);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P42 controlled canonical baseline activation executor: PASS');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
