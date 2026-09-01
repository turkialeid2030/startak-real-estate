'use strict';

const assert = require('assert');
const {
  ATTESTATION_STATUS,
  evaluateSecurityEvidenceAttestation,
} = require('../../src/security/security-evidence-attestation.js');

function baseline() {
  return {
    evidenceId: 'sec-evidence-1',
    environment: 'staging',
    targetRef: 'db-ref-1',
    issuerRef: 'ci-runtime-harness',
    contentHash: 'sha256:abc123',
    expectedContentHash: 'sha256:abc123',
    issuedAt: '2026-09-01T08:00:00Z',
    verifiedAt: '2026-09-01T08:05:00Z',
    assessedAt: '2026-09-01T08:10:00Z',
    maxAgeSeconds: 3600,
    trustedIssuerRefs: ['ci-runtime-harness'],
    expectedEnvironment: 'staging',
    expectedTargetRef: 'db-ref-1',
  };
}

(function testCompleteAttestationIsBounded() {
  const result = evaluateSecurityEvidenceAttestation(baseline());
  assert.strictEqual(result.status, ATTESTATION_STATUS.ATTESTATION_EVIDENCE_COMPLETE);
  assert.strictEqual(result.cryptographicSignatureVerifiedByThisModule, false);
  assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testScopeMismatchFailsClosed() {
  const input = baseline();
  input.expectedTargetRef = 'db-ref-2';
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_SCOPE_MISMATCH);
})();

(function testHashMismatchFailsClosed() {
  const input = baseline();
  input.expectedContentHash = 'sha256:def456';
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_HASH_MISMATCH);
})();

(function testUntrustedIssuerFailsClosed() {
  const input = baseline();
  input.trustedIssuerRefs = ['other-harness'];
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_UNTRUSTED_ISSUER);
})();

(function testStaleEvidenceFailsClosed() {
  const input = baseline();
  input.assessedAt = '2026-09-01T10:10:01Z';
  input.maxAgeSeconds = 3600;
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_STALE_EVIDENCE);
})();

(function testInvalidTimeOrderFailsClosed() {
  const input = baseline();
  input.verifiedAt = '2026-09-01T07:59:00Z';
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_ATTESTATION_METADATA);
})();

(function testTrustedIssuerListRequired() {
  const input = baseline();
  input.trustedIssuerRefs = [];
  const result = evaluateSecurityEvidenceAttestation(input);
  assert.strictEqual(result.status, ATTESTATION_STATUS.HOLD_ATTESTATION_METADATA);
})();

(function testMaxAgeMustBeExplicit() {
  const input = baseline();
  delete input.maxAgeSeconds;
  assert.throws(() => evaluateSecurityEvidenceAttestation(input), /maxAgeSeconds/);
})();

console.log('SECURITY_EVIDENCE_ATTESTATION_V1=PASS');
