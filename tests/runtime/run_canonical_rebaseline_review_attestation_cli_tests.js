'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  normalizeRegistry,
  createIndependentReviewSigningPayload,
  stableStringify,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');

const root = path.resolve(__dirname, '../..');
const packetPath = path.join(root, 'governance/operator-templates/current-lineage-review/review-packet.current.json');
const cliPath = path.join(root, 'tools/verify-canonical-rebaseline-review-attestation.js');
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-canonical-review-cli-'));

try {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const publicKeyPem = publicKey.trim();
  const publicKeySha256 = crypto.createHash('sha256').update(publicKeyPem, 'utf8').digest('hex');
  const registry = {
    registryId: 'test-canonical-rebaseline-reviewer-registry',
    governanceArtifactSha256: 'a'.repeat(64),
    reviewers: [
      {
        reviewerId: 'reviewer-said-test',
        reviewerSubjectRef: packet.independentReviewerRef,
        publicKeyPem,
        publicKeySha256,
        governanceEvidenceRef: 'test://canonical-review-governance',
        activeFrom: '2026-09-17T00:00:00.000Z',
        activeUntil: null,
        allowedPurpose: 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW',
      },
    ],
  };
  const normalizedRegistry = normalizeRegistry(registry);

  const attestation = {
    decisionId: 'canonical-review-test-decision-1',
    reviewerId: 'reviewer-said-test',
    actorRef: packet.independentReviewerRef,
    result: 'APPROVE',
    decisionSourceRef: 'test://review-memo',
    decisionArtifactSha256: 'b'.repeat(64),
    decidedAt: '2026-09-17T12:00:00.000Z',
    rationaleRef: 'test://review-rationale',
    signatureAlgorithm: 'RSA-SHA256',
    signatureBase64: '',
  };
  const payload = createIndependentReviewSigningPayload({ packet, attestation });
  attestation.signatureBase64 = crypto.sign(
    'RSA-SHA256',
    Buffer.from(stableStringify(payload), 'utf8'),
    privateKey,
  ).toString('base64');

  const registryPath = path.join(tempDir, 'registry.json');
  const attestationPath = path.join(tempDir, 'attestation.json');
  const outputPath = path.join(tempDir, 'verified.json');
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  fs.writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);

  const ok = spawnSync(process.execPath, [
    cliPath,
    '--packet', packetPath,
    '--reviewer-registry', registryPath,
    '--expected-reviewer-registry-hash', normalizedRegistry.registryHashSha256,
    '--attestation', attestationPath,
    '--output', outputPath,
  ], { encoding: 'utf8' });
  assert.strictEqual(ok.status, 0, ok.stderr || ok.stdout);
  const verified = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.strictEqual(verified.status, 'VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION');
  assert.strictEqual(verified.reviewAttestationSignatureVerified, true);
  assert.strictEqual(verified.reviewerRegistryTrustRootVerified, true);
  assert.strictEqual(verified.reviewerIdentityCryptographicallyVerified, true);
  assert.strictEqual(verified.releaseAuthorized, false);
  assert.strictEqual(verified.mergeAuthorized, false);
  assert.strictEqual(verified.deploymentAuthorized, false);
  assert.strictEqual(verified.goLiveAuthorized, false);
  assert.strictEqual(verified.transactionAuthorized, false);

  const badAttestation = { ...attestation, signatureBase64: Buffer.from('not-a-valid-signature').toString('base64') };
  const badAttestationPath = path.join(tempDir, 'bad-attestation.json');
  fs.writeFileSync(badAttestationPath, `${JSON.stringify(badAttestation, null, 2)}\n`);
  const bad = spawnSync(process.execPath, [
    cliPath,
    '--packet', packetPath,
    '--reviewer-registry', registryPath,
    '--expected-reviewer-registry-hash', normalizedRegistry.registryHashSha256,
    '--attestation', badAttestationPath,
  ], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 1);
  const badResult = JSON.parse(bad.stdout);
  assert.strictEqual(badResult.status, 'HOLD_REVIEW_ATTESTATION');
  assert.ok(badResult.blockers.includes('REVIEW_ATTESTATION_SIGNATURE_INVALID'));

  console.log('canonical rebaseline review attestation CLI: PASS');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
