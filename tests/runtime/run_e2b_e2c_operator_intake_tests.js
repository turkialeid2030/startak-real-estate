'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const e2bRequirements = require('../../governance/e2b-external-review-evidence-requirements-2026-09-08.json');
const e2cPolicy = require('../../governance/e2c-external-authority-validation-policy-2026-09-08.json');
const {
  E2B_STATUS,
  createExternalReviewCredentialEvidenceEnvelope,
} = require('../../src/standards/external-review-credential-evidence');
const {
  E2C_STATUS,
  createExternalAuthorityValidationPacket,
} = require('../../src/standards/external-authority-validation');
const e2b = require('../../tools/e2b-external-review-credential-intake');
const e2c = require('../../tools/e2c-external-authority-validation-intake');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

function withArtifactRoot(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'startak-e2b-artifacts-'));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function artifactRecord(root, relativePath, overrides = {}) {
  const bytes = Buffer.from('synthetic byte-binding test fixture; not production evidence\n', 'utf8');
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
  return {
    evidenceId: 'review-test-1',
    artifactId: 'artifact-test-1',
    artifactSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    artifactRelativePath: relativePath,
    ...overrides,
  };
}

test('E2B parseArgs requires governed inputs', () => {
  assert.throws(() => e2b.parseArgs(['--requirements', 'requirements.json']), /--applicability is required/);
});

test('E2B parseArgs accepts optional artifact root', () => {
  const args = e2b.parseArgs([
    '--requirements', 'requirements.json',
    '--applicability', 'applicability.json',
    '--review-evidence', 'reviews.json',
    '--credential-evidence', 'credentials.json',
    '--envelope-id', 'e2b-test',
    '--prepared-by', 'operator:test',
    '--prepared-at', '2026-09-21T10:10:00Z',
    '--artifact-root', 'received-artifacts',
  ]);
  assert.strictEqual(args.artifactRoot, 'received-artifacts');
});

test('E2B array extraction rejects placeholders', () => {
  assert.deepStrictEqual(e2b.extractArray({ reviewEvidence: [] }, 'reviewEvidence', 'review evidence'), []);
  assert.throws(
    () => e2b.extractArray({ reviewEvidence: [{ evidenceId: '<REAL_ID>' }] }, 'reviewEvidence', 'review evidence'),
    /unresolved template placeholders/,
  );
});

test('E2B local artifact binding hashes actual bytes and strips local-only path', () => {
  withArtifactRoot((root) => {
    const record = artifactRecord(root, path.join('reviews', 'review-test.txt'));
    const bound = e2b.bindArtifactBytes([record], {
      artifactRoot: root,
      label: 'review evidence',
      idField: 'evidenceId',
    });
    assert.strictEqual(bound.length, 1);
    assert.strictEqual(bound[0].artifactSha256, record.artifactSha256);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(bound[0], 'artifactRelativePath'), false);
  });
});

test('E2B local artifact binding rejects declared hash mismatch', () => {
  withArtifactRoot((root) => {
    const record = artifactRecord(root, 'review-test.txt', { artifactSha256: 'a'.repeat(64) });
    assert.throws(
      () => e2b.bindArtifactBytes([record], { artifactRoot: root, label: 'review evidence', idField: 'evidenceId' }),
      /artifact hash mismatch/,
    );
  });
});

test('E2B local artifact binding rejects path traversal', () => {
  withArtifactRoot((root) => {
    const outside = `${root}-outside.txt`;
    fs.writeFileSync(outside, 'outside');
    try {
      const record = {
        evidenceId: 'review-test-traversal',
        artifactId: 'artifact-test-traversal',
        artifactSha256: crypto.createHash('sha256').update('outside').digest('hex'),
        artifactRelativePath: `..${path.sep}${path.basename(outside)}`,
      };
      assert.throws(
        () => e2b.bindArtifactBytes([record], { artifactRoot: root, label: 'review evidence', idField: 'evidenceId' }),
        /escapes the artifact root/,
      );
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});

test('E2B rejects artifactRelativePath when local byte binding was not requested', () => {
  const record = {
    evidenceId: 'review-test-unbound-path',
    artifactId: 'artifact-test-unbound-path',
    artifactSha256: 'a'.repeat(64),
    artifactRelativePath: 'review.pdf',
  };
  assert.throws(
    () => e2b.bindArtifactBytes([record], { label: 'review evidence', idField: 'evidenceId' }),
    /--artifact-root was not supplied/,
  );
});

test('E2B local artifact binding rejects symlink artifact paths', () => {
  withArtifactRoot((root) => {
    const real = artifactRecord(root, 'real.txt');
    const link = path.join(root, 'link.txt');
    try {
      fs.symlinkSync(path.join(root, 'real.txt'), link);
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return;
      throw error;
    }
    const record = { ...real, artifactRelativePath: 'link.txt' };
    assert.throws(
      () => e2b.bindArtifactBytes([record], { artifactRoot: root, label: 'review evidence', idField: 'evidenceId' }),
      /symlink component/,
    );
  });
});

test('E2B invalid upstream stays HOLD and matches repository constructor', () => {
  const input = {
    envelopeId: 'e2b-test-hold',
    applicabilityPacket: {},
    requirements: e2bRequirements,
    reviewEvidence: [],
    credentialEvidence: [],
    preparedByRef: 'operator:test',
    preparedAt: '2026-09-21T10:10:00Z',
  };
  const direct = createExternalReviewCredentialEvidenceEnvelope(input);
  const wrapped = e2b.prepareEnvelope(input);
  assert.deepStrictEqual(wrapped, direct);
  assert.strictEqual(wrapped.status, E2B_STATUS.HOLD_APPLICABILITY_PACKET);
  assert.ok(wrapped.blockers.includes('E2_APPLICABILITY_PACKET_NOT_QUALIFIED'));
  assert.strictEqual(wrapped.envelopeHashSha256, null);
  assert.strictEqual(wrapped.releaseAuthorized, false);
  assert.strictEqual(wrapped.mergeAuthorized, false);
  assert.strictEqual(wrapped.deploymentAuthorized, false);
  assert.strictEqual(wrapped.transactionAuthorized, false);
});

test('E2C parseArgs separates signing-request from packet mode', () => {
  const signing = e2c.parseArgs([
    'signing-request',
    '--policy', 'policy.json',
    '--attestation', 'attestation.json',
  ]);
  assert.strictEqual(signing.mode, 'signing-request');
  assert.throws(
    () => e2c.parseArgs(['signing-request', '--policy', 'policy.json', '--attestation', 'a.json', '--registry', 'r.json']),
    /registry is not allowed/,
  );
});

test('E2C signing request uses repository canonical payload and performs no signing', () => {
  const unsigned = {
    attestationId: 'e2c-attestation-test-1',
    validationType: 'REVIEW_EVIDENCE_AUTHENTICITY',
    targetRef: 'review-evidence-1',
    subjectArtifactSha256: 'a'.repeat(64),
    result: 'VERIFIED',
    verifierId: 'external-verifier-test',
    verificationSourceRef: 'evidence:external-test',
    verificationArtifactSha256: 'b'.repeat(64),
    verifiedAt: '2026-09-21T10:11:00Z',
    expiresAt: null,
    signatureAlgorithm: 'RSA-SHA256',
  };
  const request = e2c.prepareAttestationSigningRequest({ policy: e2cPolicy, attestation: unsigned });
  assert.strictEqual(request.status, e2c.SIGNING_REQUEST_STATUS);
  assert.strictEqual(request.attestationId, unsigned.attestationId);
  assert.strictEqual(request.signatureAlgorithm, 'RSA-SHA256');
  assert.strictEqual(request.privateKeyAccepted, false);
  assert.strictEqual(request.signingPerformed, false);
  assert.strictEqual(request.authorityEffect, 'NONE');
  assert.ok(request.signingBytesUtf8.length > 0);
  assert.match(request.signingPayloadHashSha256, /^[a-f0-9]{64}$/);
});

test('E2C signing request rejects pre-signed or placeholder input', () => {
  const base = {
    attestationId: 'e2c-attestation-test-2',
    validationType: 'REVIEW_EVIDENCE_AUTHENTICITY',
    targetRef: 'review-evidence-2',
    subjectArtifactSha256: 'a'.repeat(64),
    result: 'VERIFIED',
    verifierId: 'external-verifier-test',
    verificationSourceRef: 'evidence:external-test',
    verificationArtifactSha256: 'b'.repeat(64),
    verifiedAt: '2026-09-21T10:11:00Z',
    signatureAlgorithm: 'RSA-SHA256',
  };
  assert.throws(
    () => e2c.prepareAttestationSigningRequest({ policy: e2cPolicy, attestation: { ...base, targetRef: '<REAL_TARGET>' } }),
    /unresolved template placeholders/,
  );
  assert.throws(
    () => e2c.prepareAttestationSigningRequest({ policy: e2cPolicy, attestation: { ...base, signatureBase64: 'ZmFrZQ==' } }),
    /requires an unsigned attestation/,
  );
});

test('E2C invalid E2B upstream stays HOLD and matches repository constructor', () => {
  const input = {
    validationPacketId: 'e2c-test-hold',
    externalEvidenceEnvelope: {},
    policy: e2cPolicy,
    trustedVerifierRegistry: {},
    expectedTrustedRegistryHashSha256: 'c'.repeat(64),
    attestations: [],
    preparedByRef: 'operator:test',
    preparedAt: '2026-09-21T10:12:00Z',
  };
  const direct = createExternalAuthorityValidationPacket(input);
  const wrapped = e2c.prepareValidationPacket(input);
  assert.deepStrictEqual(wrapped, direct);
  assert.strictEqual(wrapped.status, E2C_STATUS.HOLD_EXTERNAL_EVIDENCE_ENVELOPE);
  assert.ok(wrapped.blockers.includes('E2B_EXTERNAL_EVIDENCE_ENVELOPE_NOT_QUALIFIED'));
  assert.strictEqual(wrapped.validationPacketHashSha256, null);
  assert.strictEqual(wrapped.releaseAuthorized, false);
  assert.strictEqual(wrapped.mergeAuthorized, false);
  assert.strictEqual(wrapped.deploymentAuthorized, false);
  assert.strictEqual(wrapped.transactionAuthorized, false);
});

if (!process.exitCode) {
  console.log(`E2B_E2C_OPERATOR_INTAKE_TESTS=PASS ${passed}/${passed}`);
  console.log('SYNTHETIC_TEST_FIXTURES_ARE_NOT_PRODUCTION_EVIDENCE=true');
  console.log('PRIVATE_KEYS_USED=false');
  console.log('SIGNATURES_CREATED=false');
  console.log('AUTHORITY_EFFECT=NONE');
}
