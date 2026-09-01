'use strict';

const assert = require('assert');
const { PRODUCTION_SECURITY_STATUS } = require('../../src/security/production-security-readiness-gate.js');
const { ATTESTATION_STATUS } = require('../../src/security/security-evidence-attestation.js');
const {
  SECURITY_EVIDENCE_TRUST_STATUS,
  buildSecurityEvidenceTrustGate,
} = require('../../src/security/security-evidence-trust-gate.js');

function attestation(targetRef, overrides = {}) {
  return {
    status: ATTESTATION_STATUS.ATTESTATION_EVIDENCE_COMPLETE,
    evidenceId: `evidence-${targetRef}`,
    environment: 'staging',
    targetRef,
    issuerRef: 'trusted-ci',
    contentHash: `hash-${targetRef}`,
    verifiedAt: '2026-09-01T09:00:00Z',
    assessedAt: '2026-09-01T09:05:00Z',
    ...overrides,
  };
}

function baseline() {
  return {
    productionSecurityAssessment: {
      status: PRODUCTION_SECURITY_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW,
    },
    expectedEnvironment: 'staging',
    requiredTargetRefs: ['runtime-rls', 'runtime-identity'],
    attestations: [attestation('runtime-rls'), attestation('runtime-identity')],
  };
}

(function testReadyForIndependentReviewOnly() {
  const result = buildSecurityEvidenceTrustGate(baseline());
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW);
  assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
  assert.strictEqual(result.cryptographicEvidenceVerifiedByThisModule, false);
  assert.strictEqual(result.independentSecurityReviewRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testBaseSecurityFailureBlocks() {
  const input = baseline();
  input.productionSecurityAssessment.status = PRODUCTION_SECURITY_STATUS.HOLD_RUNTIME_IDENTITY_EVIDENCE;
  const result = buildSecurityEvidenceTrustGate(input);
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.HOLD_PRODUCTION_SECURITY_READINESS);
})();

(function testMissingAttestationBlocks() {
  const input = baseline();
  input.attestations = [attestation('runtime-rls')];
  const result = buildSecurityEvidenceTrustGate(input);
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SET);
  assert(result.reasonCodes.some((code) => code.includes('MISSING_ATTESTATION_TARGET:runtime-identity')));
})();

(function testDuplicateTargetBlocks() {
  const input = baseline();
  input.attestations.push(attestation('runtime-rls', { evidenceId: 'dup' }));
  const result = buildSecurityEvidenceTrustGate(input);
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SET);
})();

(function testScopeMismatchBlocks() {
  const input = baseline();
  input.attestations[1].environment = 'production';
  const result = buildSecurityEvidenceTrustGate(input);
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_SCOPE_MISMATCH);
})();

(function testAttestationFailureBlocks() {
  const input = baseline();
  input.attestations[1].status = ATTESTATION_STATUS.HOLD_HASH_MISMATCH;
  const result = buildSecurityEvidenceTrustGate(input);
  assert.strictEqual(result.status, SECURITY_EVIDENCE_TRUST_STATUS.HOLD_ATTESTATION_EVIDENCE);
})();

(function testInputRequirements() {
  const input = baseline();
  input.requiredTargetRefs = [];
  assert.throws(() => buildSecurityEvidenceTrustGate(input), /non-empty array/);
})();

console.log('SECURITY_EVIDENCE_TRUST_GATE_V1=PASS');
