'use strict';

const assert = require('assert');
const {
  IDENTITY_RUNTIME_STATUS,
  evaluateRuntimeIdentityVerification,
} = require('../../src/security/runtime-identity-verification.js');

function baseline() {
  return {
    testedAt: '2026-09-01T08:58:00Z',
    environment: 'staging',
    identityProviderRef: 'idp-ref-1',
    issuer: 'https://issuer.example',
    audience: 'startak-real-estate',
    evidenceRefs: ['oidc-runtime-run-1'],
    sessionPolicyRequired: true,
    mfaPolicyRequired: true,
    checks: {
      signatureVerified: true,
      issuerValidated: true,
      audienceValidated: true,
      expiryValidated: true,
      jwksTrusted: true,
      tenantClaimValidated: true,
      subjectClaimValidated: true,
      sessionInvalidationValidated: true,
      mfaValidated: true,
    },
  };
}

(function completeEvidenceStillDoesNotCertifyProduction() {
  const result = evaluateRuntimeIdentityVerification(baseline());
  assert.strictEqual(result.status, IDENTITY_RUNTIME_STATUS.VERIFICATION_EVIDENCE_COMPLETE);
  assert.strictEqual(result.productionIdentityVerifiedByThisModule, false);
  assert.strictEqual(result.requiresIndependentRuntimeEvidence, true);
  assert.strictEqual(result.tokenVerificationExecutedHere, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function signatureFailureFailsClosed() {
  const input = baseline();
  input.checks.signatureVerified = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(input).status, IDENTITY_RUNTIME_STATUS.HOLD_SIGNATURE);
})();

(function issuerFailureFailsClosed() {
  const input = baseline();
  input.checks.issuerValidated = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(input).status, IDENTITY_RUNTIME_STATUS.HOLD_ISSUER);
})();

(function audienceFailureFailsClosed() {
  const input = baseline();
  input.checks.audienceValidated = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(input).status, IDENTITY_RUNTIME_STATUS.HOLD_AUDIENCE);
})();

(function jwksTrustFailureFailsClosed() {
  const input = baseline();
  input.checks.jwksTrusted = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(input).status, IDENTITY_RUNTIME_STATUS.HOLD_JWKS_TRUST);
})();

(function tenantClaimFailureFailsClosed() {
  const input = baseline();
  input.checks.tenantClaimValidated = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(input).status, IDENTITY_RUNTIME_STATUS.HOLD_TENANT_CLAIM);
})();

(function sessionAndMfaEvidenceAreRequiredWhenPolicyRequiresThem() {
  const sessionMissing = baseline();
  delete sessionMissing.checks.sessionInvalidationValidated;
  const a = evaluateRuntimeIdentityVerification(sessionMissing);
  assert.strictEqual(a.status, IDENTITY_RUNTIME_STATUS.HOLD_RUNTIME_EVIDENCE);
  assert.ok(a.missingChecks.includes('sessionInvalidationValidated'));

  const mfaFailure = baseline();
  mfaFailure.checks.mfaValidated = false;
  assert.strictEqual(evaluateRuntimeIdentityVerification(mfaFailure).status, IDENTITY_RUNTIME_STATUS.HOLD_MFA_POLICY);
})();

(function evidenceRefsRequired() {
  const input = baseline();
  input.evidenceRefs = [];
  assert.throws(() => evaluateRuntimeIdentityVerification(input), /non-empty array/);
})();

console.log('RUNTIME_IDENTITY_VERIFICATION_V1=PASS');
