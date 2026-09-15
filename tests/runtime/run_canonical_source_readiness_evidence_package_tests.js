'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
} = require('../../tools/canonical-source-evidence');
const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  verifyReadinessEvidenceSignature,
} = require('../../src/standards/production-evidence-go-live-readiness');
const {
  PACKAGE_STATUS,
  CANONICAL_SIGNING_POLICY,
  createCanonicalSourceReadinessEvidencePackage,
} = require('../../src/qualification/canonical-source-readiness-evidence-package');

const results = [];
const COMMIT = 'a'.repeat(40);
const CLOSEOUT_HASH = 'b'.repeat(64);
const ARTIFACT_HASH = 'c'.repeat(64);
const ENV_HASH = 'd'.repeat(64);
const EVIDENCE_ARTIFACT_HASH = 'e'.repeat(64);

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function canonical(overrides = {}) {
  return {
    status: CANONICAL_SOURCE_STATUS.VERIFIED,
    evaluated: true,
    verified: true,
    expectedSha256: EXPECTED_CANONICAL_SHA256,
    computedSha256: EXPECTED_CANONICAL_SHA256,
    sourcePathProvided: true,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    canonicalSourceEvidence: canonical(),
    evidenceId: 'canonical-source-evidence-001',
    upstreamCloseoutPacketHashSha256: CLOSEOUT_HASH,
    releaseCandidateId: 'rc-startak-001',
    sourceCommitSha: COMMIT,
    artifactSha256: ARTIFACT_HASH,
    environmentRef: 'staging:startak-real-estate',
    environmentConfigSha256: ENV_HASH,
    verifierId: 'external-verifier-canonical-01',
    sourceRef: 'secure-external://canonical/original-artifact',
    evidenceArtifactSha256: EVIDENCE_ARTIFACT_HASH,
    verifiedAt: '2026-09-09T17:20:00.000Z',
    expiresAt: '2026-10-09T17:20:00.000Z',
    scopeRef: 'startak-real-estate:canonical-source-comparison',
    ...overrides,
  };
}

(async () => {
  await test('PRODUCTIZATION-P22-01', async () => {
    const pkg = createCanonicalSourceReadinessEvidencePackage(input());
    assert.strictEqual(pkg.status, PACKAGE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE);
    assert.strictEqual(pkg.evidenceType, EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON);
    assert.strictEqual(pkg.payload.result, EVIDENCE_RESULT.VERIFIED);
    assert.strictEqual(pkg.canonicalSourceHashSha256, EXPECTED_CANONICAL_SHA256);
    assert.strictEqual(pkg.signatureRequired, true);
    assert.strictEqual(pkg.e2iAcceptancePending, true);
    assert.strictEqual(pkg.externalEvidenceBlockerClosed, false);
    for (const value of Object.values(pkg.authority)) assert.strictEqual(value, false);
  });

  await test('PRODUCTIZATION-P22-02', async () => {
    assert.throws(
      () => createCanonicalSourceReadinessEvidencePackage(input({
        canonicalSourceEvidence: canonical({ status: CANONICAL_SOURCE_STATUS.NOT_EVALUATED, evaluated: false, verified: false, computedSha256: null }),
      })),
      /canonicalSourceEvidence must be VERIFIED/,
    );
  });

  await test('PRODUCTIZATION-P22-03', async () => {
    assert.throws(
      () => createCanonicalSourceReadinessEvidencePackage(input({
        canonicalSourceEvidence: canonical({ computedSha256: 'f'.repeat(64) }),
      })),
      /must match the pinned canonical SHA-256/,
    );
  });

  await test('PRODUCTIZATION-P22-04', async () => {
    const first = createCanonicalSourceReadinessEvidencePackage(input());
    const second = createCanonicalSourceReadinessEvidencePackage(input());
    assert.strictEqual(first.signingPayloadSha256, second.signingPayloadSha256);
    assert.strictEqual(first.signingPayloadBase64, second.signingPayloadBase64);
  });

  await test('PRODUCTIZATION-P22-05', async () => {
    const first = createCanonicalSourceReadinessEvidencePackage(input());
    const second = createCanonicalSourceReadinessEvidencePackage(input({ sourceCommitSha: 'f'.repeat(40) }));
    assert.notStrictEqual(first.signingPayloadSha256, second.signingPayloadSha256);
  });

  await test('PRODUCTIZATION-P22-06', async () => {
    const pkg = createCanonicalSourceReadinessEvidencePackage(input());
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signature = crypto.sign(
      'RSA-SHA256',
      Buffer.from(pkg.signingPayloadBase64, 'base64'),
      privateKey,
    );
    const signedRecord = {
      ...pkg.payload,
      signatureBase64: signature.toString('base64'),
    };
    const verifier = {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    };
    assert.strictEqual(
      verifyReadinessEvidenceSignature(signedRecord, verifier, CANONICAL_SIGNING_POLICY),
      true,
    );
  });

  await test('PRODUCTIZATION-P22-07', async () => {
    const pkg = createCanonicalSourceReadinessEvidencePackage(input());
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signature = crypto.sign('RSA-SHA256', Buffer.from(pkg.signingPayloadBase64, 'base64'), privateKey);
    const tampered = {
      ...pkg.payload,
      releaseCandidateId: 'rc-tampered',
      signatureBase64: signature.toString('base64'),
    };
    const verifier = { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) };
    assert.strictEqual(verifyReadinessEvidenceSignature(tampered, verifier, CANONICAL_SIGNING_POLICY), false);
  });

  await test('PRODUCTIZATION-P22-08', async () => {
    const pkg = createCanonicalSourceReadinessEvidencePackage(input());
    const serialized = JSON.stringify(pkg);
    assert.ok(!serialized.includes('secure-external://canonical/original-artifact'));
    assert.ok(!serialized.includes('CANONICAL_ORIGINAL_PATH'));
    assert.ok(pkg.payload.sourceRef.startsWith('sha256:'));
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P22_CANONICAL_E2I_SIGNING_PACKAGE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P22_CANONICAL_E2I_SIGNING_PACKAGE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
