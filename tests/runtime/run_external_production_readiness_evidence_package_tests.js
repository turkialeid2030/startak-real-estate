'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  verifyReadinessEvidenceSignature,
} = require('../../src/standards/production-evidence-go-live-readiness');
const {
  PACKAGE_STATUS,
  BUNDLE_STATUS,
  EXTERNAL_PRODUCTION_EVIDENCE_TYPES,
  SIGNING_POLICY,
  createExternalProductionReadinessEvidencePackage,
  createExternalProductionReadinessEvidenceAcquisitionBundle,
} = require('../../src/qualification/external-production-readiness-evidence-package');

const results = [];
const COMMIT = 'a'.repeat(40);
const CLOSEOUT_HASH = 'b'.repeat(64);
const ARTIFACT_HASH = 'c'.repeat(64);
const ENV_HASH = 'd'.repeat(64);

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

function input(evidenceType, index = 0, overrides = {}) {
  return {
    evidenceType,
    evidenceId: `external-evidence-${index + 1}`,
    upstreamCloseoutPacketHashSha256: CLOSEOUT_HASH,
    releaseCandidateId: 'rc-startak-001',
    sourceCommitSha: COMMIT,
    artifactSha256: ARTIFACT_HASH,
    environmentRef: 'production:startak-real-estate',
    environmentConfigSha256: ENV_HASH,
    verifierId: `external-verifier-${index + 1}`,
    sourceRef: `secure-external://production-evidence/${index + 1}`,
    evidenceArtifactSha256: String(index + 1).repeat(64),
    verifiedAt: '2026-09-11T01:00:00.000Z',
    expiresAt: '2026-10-11T01:00:00.000Z',
    result: EVIDENCE_RESULT.VERIFIED,
    scopeRef: `startak-real-estate:e2i:${evidenceType}`,
    ...overrides,
  };
}

(async () => {
  await test('EXTERNAL-E2I-PACKAGE-01', async () => {
    const pkg = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW),
    );
    assert.strictEqual(pkg.status, PACKAGE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE);
    assert.strictEqual(pkg.evidenceType, EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW);
    assert.strictEqual(pkg.payload.result, EVIDENCE_RESULT.VERIFIED);
    assert.strictEqual(pkg.signatureRequired, true);
    assert.strictEqual(pkg.e2iAcceptancePending, true);
    assert.strictEqual(pkg.externalEvidenceBlockerClosed, false);
    for (const value of Object.values(pkg.authority)) assert.strictEqual(value, false);
  });

  await test('EXTERNAL-E2I-PACKAGE-02', async () => {
    const bundle = createExternalProductionReadinessEvidenceAcquisitionBundle({
      evidenceInputs: EXTERNAL_PRODUCTION_EVIDENCE_TYPES.map((type, index) => input(type, index)),
    });
    assert.strictEqual(bundle.status, BUNDLE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURES);
    assert.strictEqual(bundle.packages.length, 5);
    assert.deepStrictEqual(bundle.missingEvidenceTypes, []);
    assert.strictEqual(bundle.allFiveNonCanonicalEvidenceClassesPrepared, true);
    assert.strictEqual(bundle.canonicalSourceEvidenceHandledSeparately, true);
    assert.strictEqual(bundle.e2iAcceptancePending, true);
    for (const value of Object.values(bundle.authority)) assert.strictEqual(value, false);
  });

  await test('EXTERNAL-E2I-PACKAGE-03', async () => {
    const bundle = createExternalProductionReadinessEvidenceAcquisitionBundle({
      evidenceInputs: EXTERNAL_PRODUCTION_EVIDENCE_TYPES.slice(0, 4).map((type, index) => input(type, index)),
    });
    assert.strictEqual(bundle.status, BUNDLE_STATUS.EXTERNAL_READINESS_EVIDENCE_ACQUISITION_INCOMPLETE);
    assert.strictEqual(bundle.missingEvidenceTypes.length, 1);
    assert.strictEqual(bundle.allFiveNonCanonicalEvidenceClassesPrepared, false);
  });

  await test('EXTERNAL-E2I-PACKAGE-04', async () => {
    const type = EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW;
    assert.throws(
      () => createExternalProductionReadinessEvidenceAcquisitionBundle({ evidenceInputs: [input(type, 0), input(type, 1)] }),
      /duplicate external evidence type/,
    );
  });

  await test('EXTERNAL-E2I-PACKAGE-05', async () => {
    assert.throws(
      () => createExternalProductionReadinessEvidencePackage(input(EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON)),
      /five non-canonical E2I external production evidence types/,
    );
  });

  await test('EXTERNAL-E2I-PACKAGE-06', async () => {
    const first = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW),
    );
    const second = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW),
    );
    assert.strictEqual(first.signingPayloadSha256, second.signingPayloadSha256);
    assert.strictEqual(first.signingPayloadBase64, second.signingPayloadBase64);
  });

  await test('EXTERNAL-E2I-PACKAGE-07', async () => {
    const rawSource = 'secure-external://sensitive/legal-review/123';
    const pkg = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW, 0, { sourceRef: rawSource }),
    );
    const serialized = JSON.stringify(pkg);
    assert.ok(!serialized.includes(rawSource));
    assert.ok(pkg.payload.sourceRef.startsWith('sha256:'));
  });

  await test('EXTERNAL-E2I-PACKAGE-08', async () => {
    const pkg = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION),
    );
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signature = crypto.sign('RSA-SHA256', Buffer.from(pkg.signingPayloadBase64, 'base64'), privateKey);
    const signedRecord = { ...pkg.payload, signatureBase64: signature.toString('base64') };
    const verifier = { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) };
    assert.strictEqual(verifyReadinessEvidenceSignature(signedRecord, verifier, SIGNING_POLICY), true);
  });

  await test('EXTERNAL-E2I-PACKAGE-09', async () => {
    const pkg = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION),
    );
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signature = crypto.sign('RSA-SHA256', Buffer.from(pkg.signingPayloadBase64, 'base64'), privateKey);
    const tampered = {
      ...pkg.payload,
      environmentRef: 'production:tampered',
      signatureBase64: signature.toString('base64'),
    };
    const verifier = { publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) };
    assert.strictEqual(verifyReadinessEvidenceSignature(tampered, verifier, SIGNING_POLICY), false);
  });

  await test('EXTERNAL-E2I-PACKAGE-10', async () => {
    const pkg = createExternalProductionReadinessEvidencePackage(
      input(EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW, 0, {
        privateKey: 'must-not-be-serialized',
        secret: 'must-not-be-serialized',
      }),
    );
    const serialized = JSON.stringify(pkg);
    assert.ok(!serialized.includes('must-not-be-serialized'));
    assert.strictEqual(pkg.privateSigningKeyAccepted, false);
  });

  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`EXTERNAL_PRODUCTION_READINESS_EVIDENCE_PACKAGE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('EXTERNAL_PRODUCTION_READINESS_EVIDENCE_PACKAGE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
