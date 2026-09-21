'use strict';

const assert = require('assert');
const { sha256 } = require('../../src/standards/standards-registry');
const intake = require('../../tools/e2c-trust-root-designation-intake');

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAwflQOU5wbcZDk4TXCc3I
SsEzRVrBr2WhGtOgZk1zHgFApFv30TPpm/uFaPMEJDUDvvJskhaEAU6tFvp2TuKI
WvC2uc9YLS8J6Rgrm9gue6+RRnL6ltnhPoY9C9LtWclFBWZHCtyRfUH6ZgoCb/cv
N9To6ZrQAOnDFXzOJ1woS8oZzrAfcQBB8MepGWXR5QqdpywhCbF8FMeyGswbLfay
EO8wQNR/Ie27Ba3vwq584vNcQLwc5POXonOyiDma0QB4B5Zbyc6s1GMdysMwHWHi
a9onLykYsRkFmB0/Li9NKtMVFeKwRB+n8IWK+8QdEPqgFGxet+02KFztUNgBAd9B
iCVeqGML5ednmjy0dnpmikT6M/PthrFIuzTRJmU4IICx02uGRMptTo4J2gQ298sU
auIBwIPMxKAnKO7Eq9aGtXV0xLCCtYi79NHGGfL4/P+QWZJwIzV8s/lRf3ZofXKg
b67mPBjQFv42G2WR7uU3cPmQQcVa2WPy899pIXAuNxKpAgMBAAE=
-----END PUBLIC KEY-----`;

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

function registry(subject = 'human:external-verifier-test') {
  return {
    registryId: 'e2c-test-registry',
    status: 'EXTERNALLY_GOVERNED',
    governanceOwnerRef: 'github:test-owner',
    verifiers: [
      {
        verifierId: 'e2c-verifier-test-1',
        verifierSubjectRef: subject,
        authorityClass: 'E2C_EXTERNAL_AUTHORITY_VALIDATION',
        publicKeyPem: PUBLIC_KEY_PEM,
        publicKeySha256: sha256(PUBLIC_KEY_PEM),
        governanceEvidenceRef: 'evidence:test-only',
        activeFrom: '2026-09-21T00:00:00Z',
        activeUntil: null,
      },
    ],
  };
}

test('parseArgs requires registry and accepts optional reviewer subjects', () => {
  assert.throws(() => intake.parseArgs(['--reviewer-subjects', 'reviewers.json']), /--registry is required/);
  const args = intake.parseArgs(['--registry', 'registry.json', '--reviewer-subjects', 'reviewers.json']);
  assert.strictEqual(args.registry, 'registry.json');
  assert.strictEqual(args.reviewerSubjects, 'reviewers.json');
});

test('extractReviewerSubjects normalizes and deduplicates subjects', () => {
  assert.deepStrictEqual(
    intake.extractReviewerSubjects({ reviewerSubjects: [' human:reviewer-a ', 'human:reviewer-a', 'human:reviewer-b'] }),
    ['human:reviewer-a', 'human:reviewer-b'],
  );
});

test('designation intake rejects unresolved placeholders', () => {
  const value = registry();
  value.verifiers[0].governanceEvidenceRef = '<REAL_GOVERNANCE_EVIDENCE>';
  assert.throws(
    () => intake.prepareTrustRootCandidate({ registry: value, reviewerSubjects: [] }),
    /unresolved template placeholders/,
  );
});

test('designation intake normalizes public registry and emits no authority', () => {
  const result = intake.prepareTrustRootCandidate({
    registry: registry(),
    reviewerSubjects: ['human:reviewer-a'],
  });
  assert.strictEqual(result.status, intake.READY_STATUS);
  assert.match(result.registryHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(result.registry.registryHashSha256, result.registryHashSha256);
  assert.deepStrictEqual(result.reviewerSubjectsChecked, ['human:reviewer-a']);
  assert.strictEqual(result.selfValidationCollisionDetected, false);
  assert.strictEqual(result.independentOutOfBandPinPresent, false);
  assert.strictEqual(result.privateKeyAccepted, false);
  assert.strictEqual(result.privateKeyRequired, false);
  assert.strictEqual(result.signingPerformed, false);
  assert.strictEqual(result.authorityEffect, 'NONE');
});

test('designation intake rejects direct verifier/reviewer subject collision', () => {
  assert.throws(
    () => intake.prepareTrustRootCandidate({
      registry: registry('human:reviewer-a'),
      reviewerSubjects: ['human:reviewer-a'],
    }),
    /E2C_VERIFIER_SELF_VALIDATION_RISK:human:reviewer-a/,
  );
});

test('designation intake delegates public-key hash validation to repository implementation', () => {
  const value = registry();
  value.verifiers[0].publicKeySha256 = '0'.repeat(64);
  assert.throws(
    () => intake.prepareTrustRootCandidate({ registry: value, reviewerSubjects: [] }),
    /TRUSTED_VERIFIER_PUBLIC_KEY_HASH_MISMATCH/,
  );
});

if (!process.exitCode) {
  console.log(`E2C_TRUST_ROOT_DESIGNATION_INTAKE_TESTS=PASS ${passed}/${passed}`);
  console.log('PUBLIC_TEST_KEY_ONLY=true');
  console.log('PRIVATE_KEYS_USED=false');
  console.log('OUT_OF_BAND_PIN_CREATED=false');
  console.log('SIGNATURES_CREATED=false');
  console.log('AUTHORITY_EFFECT=NONE');
}
