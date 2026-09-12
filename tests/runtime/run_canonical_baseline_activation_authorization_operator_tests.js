'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  STATUS: P39_STATUS,
} = require('../../src/qualification/composite-baseline-activation-change-contract');
const {
  ACTIVATION_PURPOSE,
  normalizeActivationAuthorityRegistry,
} = require('../../src/qualification/dual-mode-canonical-baseline-registry-verifier');
const { stableStringify } = require('../../src/qualification/canonical-baseline-registry');
const {
  STATUS,
  prepareCanonicalBaselineActivationAuthorization,
  verifyCanonicalBaselineActivationAuthorization,
} = require('../../src/qualification/canonical-baseline-activation-authorization-operator');
const {
  parseArgs,
  run,
} = require('../../tools/canonical-baseline-activation-authorization');

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function contractFixture() {
  return {
    schemaVersion: 1,
    status: P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED,
    contractId: 'p39:p41-test-contract',
    preparedByRef: 'owner:test',
    activationChangeContractHashSha256: '1'.repeat(64),
    expectedPriorRegistryHashSha256: '2'.repeat(64),
    proposedRegistryHashSha256: '3'.repeat(64),
    proposedRegistryContentSha256: '4'.repeat(64),
    rollbackRegistryHashSha256: '5'.repeat(64),
    reviewerLockHashSha256: '6'.repeat(64),
    activationAuthorizationGranted: false,
    actualRegistryMutationPerformed: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  };
}

function authorizationFixture(contract) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  const authorityRegistry = {
    registryId: 'activation-authority-registry:p41-test',
    governanceArtifactSha256: '7'.repeat(64),
    authorities: [{
      authorityId: 'owner-authority:test',
      actorRef: contract.preparedByRef,
      publicKeyPem,
      publicKeySha256: sha256Text(publicKeyPem),
      governanceEvidenceRef: 'governance:owner-authority-test',
      activeFrom: '2026-09-01T00:00:00.000Z',
      activeUntil: '2026-12-31T23:59:59.000Z',
      allowedPurpose: ACTIVATION_PURPOSE,
    }],
  };
  const normalized = normalizeActivationAuthorityRegistry(authorityRegistry);
  const decision = {
    authorityId: 'owner-authority:test',
    actorRef: contract.preparedByRef,
    decisionId: 'activation-decision:p41-test',
    decision: 'AUTHORIZE',
    decisionSourceRef: 'decision:owner-record',
    decisionArtifactSha256: '8'.repeat(64),
    decidedAt: '2026-09-10T08:50:00.000Z',
    rationaleRef: 'rationale:owner-activation',
    signatureAlgorithm: 'RSA-SHA256',
  };
  return { privateKey, authorityRegistry, expectedHash: normalized.registryHashSha256, decision };
}

(function runTests() {
  const contract = contractFixture();
  const auth = authorizationFixture(contract);

  const prepared = prepareCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    decision: auth.decision,
  });
  assert.strictEqual(prepared.status, STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE);
  assert.strictEqual(prepared.verified, true);
  assert.strictEqual(prepared.signatureRequired, true);
  assert.strictEqual(prepared.externalSigningRequired, true);
  assert.strictEqual(prepared.repositorySigningPerformed, false);
  assert.strictEqual(prepared.privateSigningKeyAccepted, false);
  assert.strictEqual(prepared.activationApplied, false);
  assert.strictEqual(prepared.releaseAuthorized, false);
  assert.strictEqual(prepared.mergeAuthorized, false);
  assert.strictEqual(prepared.deploymentAuthorized, false);
  assert.strictEqual(prepared.goLiveAuthorized, false);
  assert.strictEqual(prepared.transactionAuthorized, false);
  assert.strictEqual(Buffer.from(prepared.signingBytesBase64, 'base64').toString('utf8'), stableStringify(prepared.signingPayload));
  assert.strictEqual(prepared.signingPayloadHashSha256, sha256Text(stableStringify(prepared.signingPayload)));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(prepared.attestationWithoutSignature, 'signatureBase64'), false);

  const signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(prepared.signingPayload), 'utf8'),
    auth.privateKey,
  ).toString('base64');
  const attestation = { ...prepared.attestationWithoutSignature, signatureBase64 };
  const verified = verifyCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    attestation,
  });
  assert.strictEqual(verified.status, STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION);
  assert.strictEqual(verified.verified, true);
  assert.strictEqual(verified.signatureVerified, true);
  assert.strictEqual(verified.trustRootVerified, true);
  assert.strictEqual(verified.humanDecisionRecordVerified, true);
  assert.strictEqual(verified.privateSigningKeyAccepted, false);
  assert.strictEqual(verified.activationAuthorizationValidatedForP40, true);
  assert.strictEqual(verified.activationAuthorizationGrantedByThisOperator, false);
  assert.strictEqual(verified.activationApplied, false);
  assert.strictEqual(verified.releaseAuthorized, false);

  const tamperedSignature = verifyCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    attestation: { ...attestation, signatureBase64: Buffer.from('invalid-signature').toString('base64') },
  });
  assert.strictEqual(tamperedSignature.status, STATUS.HOLD_ACTIVATION_AUTHORIZATION_PACKAGE);
  assert(tamperedSignature.blockers.includes('ACTIVATION_ATTESTATION_SIGNATURE_INVALID'));

  const badTrust = prepareCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: '0'.repeat(64),
    decision: auth.decision,
  });
  assert.strictEqual(badTrust.status, STATUS.HOLD_ACTIVATION_AUTHORIZATION_PACKAGE);
  assert(badTrust.blockers.includes('ACTIVATION_AUTHORITY_REGISTRY_HASH_MISMATCH'));

  const privateKeyRejected = prepareCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry: auth.authorityRegistry,
    expectedActivationAuthorityRegistryHashSha256: auth.expectedHash,
    decision: auth.decision,
    privateKeyPem: 'must-never-be-accepted',
  });
  assert.strictEqual(privateKeyRejected.status, STATUS.HOLD_ACTIVATION_AUTHORIZATION_PACKAGE);
  assert(privateKeyRejected.blockers.some((item) => item.startsWith('PRIVATE_SIGNING_KEY_MATERIAL_REJECTED:')));

  assert.throws(
    () => parseArgs(['prepare', '--private-key', '/tmp/key.pem']),
    /unknown argument: --private-key/,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-p41-'));
  try {
    const contractPath = path.join(dir, 'contract.json');
    const registryPath = path.join(dir, 'authority.json');
    const decisionPath = path.join(dir, 'decision.json');
    const outputPath = path.join(dir, 'package.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract));
    fs.writeFileSync(registryPath, JSON.stringify(auth.authorityRegistry));
    fs.writeFileSync(decisionPath, JSON.stringify(auth.decision));

    const code = run([
      'prepare',
      '--contract', contractPath,
      '--authority-registry', registryPath,
      '--expected-authority-registry-sha256', auth.expectedHash,
      '--decision', decisionPath,
      '--output', outputPath,
    ]);
    assert.strictEqual(code, 0);
    const cliPackage = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.strictEqual(cliPackage.status, STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE);
    assert.strictEqual(cliPackage.privateSigningKeyAccepted, false);
    assert.strictEqual(cliPackage.activationApplied, false);

    const spawned = spawnSync(process.execPath, [
      path.join(__dirname, '..', '..', 'tools', 'canonical-baseline-activation-authorization.js'),
      'prepare',
      '--contract', contractPath,
      '--authority-registry', registryPath,
      '--expected-authority-registry-sha256', auth.expectedHash,
      '--decision', decisionPath,
    ], { encoding: 'utf8' });
    assert.strictEqual(spawned.status, 0, spawned.stderr);
    assert.strictEqual(spawned.stderr, '');
    assert(!spawned.stdout.includes(contractPath));
    assert(!spawned.stdout.includes(registryPath));
    const stdoutPackage = JSON.parse(spawned.stdout);
    assert.strictEqual(stdoutPackage.status, STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('P41 canonical baseline activation authorization operator: PASS');
})();
