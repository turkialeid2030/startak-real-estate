'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MODE,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('../../src/qualification/canonical-baseline-registry');
const { STATUS: P39_STATUS } = require('../../src/qualification/composite-baseline-activation-change-contract');
const {
  STATUS,
  AUTHORIZATION_STATUS,
  ACTIVATION_PURPOSE,
  normalizeActivationAuthorityRegistry,
  createHumanActivationSigningPayload,
  verifyHumanActivationAuthorization,
  evaluateDualModeCanonicalBaselineRegistry,
} = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const {
  STATUS: GATE_STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('../../tools/canonical-baseline-registry-gate');

const ROOT = path.join(__dirname, '..', '..');
const LEGACY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const legacyRegistry = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf8'));

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
  const legacy = evaluateCurrentCanonicalBaselineRegistry(legacyRegistry);
  assert.strictEqual(legacy.status, 'LEGACY_BASELINE_REGISTRY_CONFIRMED');
  const manifestHash = '1'.repeat(64);
  const planHash = '2'.repeat(64);
  const reviewerLockHash = '3'.repeat(64);
  const safetyHash = '4'.repeat(64);
  const proposedRegistry = {
    schemaVersion: 2,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: JSON.parse(JSON.stringify(legacyRegistry.legacyBaseline)),
    governedCompositeBaseline: {
      baselineId: 'canonical-rebaseline:test-p40',
      baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
      qualifiedSourceCommitSha: 'a'.repeat(40),
      releaseArtifactSha256: 'b'.repeat(64),
      environmentConfigSha256: 'c'.repeat(64),
      supersedesLegacyCanonicalSha256: legacyRegistry.legacyBaseline.expectedSha256,
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
  const rollbackRegistry = JSON.parse(JSON.stringify(legacyRegistry));
  const rollbackRegistryContent = canonicalContent(rollbackRegistry);
  const core = {
    schemaVersion: 1,
    contractId: 'p39:test-p40',
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
  return { proposedRegistry, contract };
}

function buildAuthorizationFixture(contract) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const authorityRegistry = {
    registryId: 'activation-authority-registry:test',
    governanceArtifactSha256: '5'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test',
      actorRef: contract.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem.trim()),
      governanceEvidenceRef: 'governance:test-owner-authority',
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
      allowedPurpose: ACTIVATION_PURPOSE,
    }],
  };
  const normalized = normalizeActivationAuthorityRegistry(authorityRegistry);
  const attestation = {
    authorityId: 'owner-authority:test',
    actorRef: contract.preparedByRef,
    decisionId: 'activation-decision:test',
    decision: 'AUTHORIZE',
    decisionSourceRef: 'decision:test-source',
    decisionArtifactSha256: '6'.repeat(64),
    decidedAt: '2026-09-10T09:10:00.000Z',
    rationaleRef: 'rationale:test',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const payload = createHumanActivationSigningPayload({ contract, attestation });
  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(payload), 'utf8'),
    privateKey,
  ).toString('base64');
  return {
    authorityRegistry,
    expectedAuthorityRegistryHash: normalized.registryHashSha256,
    attestation: { ...attestation, signatureBase64 },
  };
}

(function run() {
  const legacyPass = evaluateDualModeCanonicalBaselineRegistry({ registry: legacyRegistry });
  assert.strictEqual(legacyPass.status, STATUS.LEGACY_BASELINE_VERIFIED);
  assert.strictEqual(legacyPass.verified, true);
  assert.strictEqual(legacyPass.activeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(legacyPass.activationAuthorizedByThisVerifier, false);

  const { proposedRegistry, contract } = buildContractFixture();
  const noContract = evaluateDualModeCanonicalBaselineRegistry({ registry: proposedRegistry });
  assert.strictEqual(noContract.status, STATUS.HOLD_DUAL_MODE_CANONICAL_REGISTRY);
  assert(noContract.blockers.includes('P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'));

  const noAuthorization = evaluateDualModeCanonicalBaselineRegistry({
    registry: proposedRegistry,
    activationChangeContract: contract,
  });
  assert.strictEqual(noAuthorization.status, STATUS.HOLD_DUAL_MODE_CANONICAL_REGISTRY);
  assert(noAuthorization.blockers.includes('SIGNED_HUMAN_ACTIVATION_AUTHORIZATION_REQUIRED'));

  const auth = buildAuthorizationFixture(contract);
  const verifiedAuthorization = verifyHumanActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedAuthorityRegistryHash,
    attestation: auth.attestation,
  });
  assert.strictEqual(verifiedAuthorization.status, AUTHORIZATION_STATUS.VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION);
  assert.strictEqual(verifiedAuthorization.signatureVerified, true);
  assert.strictEqual(verifiedAuthorization.trustRootVerified, true);
  assert.strictEqual(verifiedAuthorization.privateSigningKeyAccepted, false);

  const compositePass = evaluateDualModeCanonicalBaselineRegistry({
    registry: proposedRegistry,
    activationChangeContract: contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedAuthorityRegistryHash,
    activationAttestation: auth.attestation,
  });
  assert.strictEqual(compositePass.status, STATUS.COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION);
  assert.strictEqual(compositePass.verified, true);
  assert.strictEqual(compositePass.p39ActivationChangeContractVerified, true);
  assert.strictEqual(compositePass.signedHumanActivationAuthorizationVerified, true);
  assert.strictEqual(compositePass.activationAuthorizedByThisVerifier, false);
  assert.strictEqual(compositePass.releaseAuthorized, false);
  assert.strictEqual(compositePass.mergeAuthorized, false);
  assert.strictEqual(compositePass.deploymentAuthorized, false);
  assert.strictEqual(compositePass.goLiveAuthorized, false);
  assert.strictEqual(compositePass.transactionAuthorized, false);

  const tamperedRegistry = JSON.parse(JSON.stringify(proposedRegistry));
  tamperedRegistry.governedCompositeBaseline.releaseArtifactSha256 = '9'.repeat(64);
  const tampered = evaluateDualModeCanonicalBaselineRegistry({
    registry: tamperedRegistry,
    activationChangeContract: contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedAuthorityRegistryHash,
    activationAttestation: auth.attestation,
  });
  assert.strictEqual(tampered.status, STATUS.HOLD_DUAL_MODE_CANONICAL_REGISTRY);
  assert(tampered.blockers.includes('P39_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH'));

  const badTrust = verifyHumanActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: '0'.repeat(64),
    attestation: auth.attestation,
  });
  assert.strictEqual(badTrust.status, AUTHORIZATION_STATUS.HOLD_ACTIVATION_AUTHORITY_TRUST_ROOT);

  const badSignature = verifyHumanActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedAuthorityRegistryHash,
    attestation: { ...auth.attestation, signatureBase64: Buffer.from('invalid').toString('base64') },
  });
  assert.strictEqual(badSignature.status, AUTHORIZATION_STATUS.HOLD_HUMAN_ACTIVATION_AUTHORIZATION);
  assert(badSignature.blockers.includes('ACTIVATION_ATTESTATION_SIGNATURE_INVALID'));

  const legacyGate = verifyCanonicalBaselineRegistryFile({ filePath: LEGACY_PATH, env: {} });
  assert.strictEqual(legacyGate.status, GATE_STATUS.VERIFIED);
  assert.strictEqual(legacyGate.activeMode, MODE.LEGACY_FILE_SHA256);
  assert.strictEqual(legacyGate.verificationMode, 'LEGACY_STRICT');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p40-'));
  try {
    const registryPath = path.join(dir, 'canonical-baseline.json');
    const contractPath = path.join(dir, 'contract.json');
    const authorityPath = path.join(dir, 'authority-registry.json');
    const attestationPath = path.join(dir, 'attestation.json');
    fs.writeFileSync(registryPath, JSON.stringify(proposedRegistry));
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(authorityPath, JSON.stringify(auth.authorityRegistry));
    fs.writeFileSync(attestationPath, JSON.stringify(auth.attestation));

    const compositeGateHold = verifyCanonicalBaselineRegistryFile({ filePath: registryPath, env: {} });
    assert.strictEqual(compositeGateHold.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(compositeGateHold.reasonCode, 'COMPOSITE_BASELINE_ACTIVATION_EVIDENCE_REQUIRED');

    const env = {
      CANONICAL_BASELINE_ACTIVATION_CONTRACT_PATH: contractPath,
      CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_PATH: authorityPath,
      CANONICAL_BASELINE_ACTIVATION_ATTESTATION_PATH: attestationPath,
      EXPECTED_CANONICAL_BASELINE_ACTIVATION_AUTHORITY_REGISTRY_SHA256: auth.expectedAuthorityRegistryHash,
    };
    const compositeGatePass = verifyCanonicalBaselineRegistryFile({ filePath: registryPath, env });
    assert.strictEqual(compositeGatePass.status, GATE_STATUS.VERIFIED);
    assert.strictEqual(compositeGatePass.activeMode, MODE.GOVERNED_COMPOSITE_BASELINE);
    assert.strictEqual(compositeGatePass.signedHumanActivationAuthorizationVerified, true);
    assert.strictEqual(compositeGatePass.activationAuthorizationGrantedByGate, false);

    const symlinkContract = path.join(dir, 'contract-link.json');
    fs.symlinkSync(contractPath, symlinkContract);
    const symlinkGate = verifyCanonicalBaselineRegistryFile({
      filePath: registryPath,
      env: { ...env, CANONICAL_BASELINE_ACTIVATION_CONTRACT_PATH: symlinkContract },
    });
    assert.strictEqual(symlinkGate.status, GATE_STATUS.REGISTRY_HOLD);
    assert.strictEqual(symlinkGate.reasonCode, 'CANONICAL_BASELINE_ACTIVATION_CONTRACT_SYMLINK_REJECTED');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P40 dual-mode canonical registry verifier: PASS');
})();
