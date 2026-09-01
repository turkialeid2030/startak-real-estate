'use strict';

const assert = require('assert');
const { SECURITY_READINESS_STATUS } = require('../../src/security/security-readiness-orchestrator.js');
const { IDENTITY_RUNTIME_STATUS } = require('../../src/security/runtime-identity-verification.js');
const {
  PRODUCTION_SECURITY_STATUS,
  buildProductionSecurityReadinessGate,
} = require('../../src/security/production-security-readiness-gate.js');

function baseline() {
  return {
    baseSecurityAssessment: {
      status: SECURITY_READINESS_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW,
    },
    runtimeIdentityAssessment: {
      status: IDENTITY_RUNTIME_STATUS.VERIFICATION_EVIDENCE_COMPLETE,
      environment: 'staging',
      identityProviderRef: 'idp-ref-1',
      issuer: 'https://issuer.example',
      audience: 'startak-api',
      evidenceRefs: ['identity-runtime-1'],
    },
    expectedIdentityScope: {
      environment: 'staging',
      identityProviderRef: 'idp-ref-1',
      issuer: 'https://issuer.example',
      audience: 'startak-api',
    },
  };
}

(function testReadyStillRequiresIndependentReview() {
  const result = buildProductionSecurityReadinessGate(baseline());
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW);
  assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
  assert.strictEqual(result.productionIdentityVerifiedByThisModule, false);
  assert.strictEqual(result.independentSecurityReviewRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testBaseSecurityFailureFailsClosed() {
  const input = baseline();
  input.baseSecurityAssessment.status = SECURITY_READINESS_STATUS.HOLD_RLS_EVIDENCE;
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_BASE_SECURITY_READINESS);
})();

(function testIdentityRuntimeFailureFailsClosed() {
  const input = baseline();
  input.runtimeIdentityAssessment.status = IDENTITY_RUNTIME_STATUS.HOLD_JWKS_TRUST;
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_RUNTIME_IDENTITY_EVIDENCE);
})();

(function testEnvironmentMismatchFailsClosed() {
  const input = baseline();
  input.runtimeIdentityAssessment.environment = 'production';
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_IDENTITY_SCOPE_MISMATCH);
})();

(function testProviderMismatchFailsClosed() {
  const input = baseline();
  input.runtimeIdentityAssessment.identityProviderRef = 'idp-ref-2';
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_IDENTITY_SCOPE_MISMATCH);
})();

(function testIssuerMismatchFailsClosed() {
  const input = baseline();
  input.runtimeIdentityAssessment.issuer = 'https://other.example';
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_IDENTITY_SCOPE_MISMATCH);
})();

(function testAudienceMismatchFailsClosed() {
  const input = baseline();
  input.runtimeIdentityAssessment.audience = 'other-api';
  const result = buildProductionSecurityReadinessGate(input);
  assert.strictEqual(result.status, PRODUCTION_SECURITY_STATUS.HOLD_IDENTITY_SCOPE_MISMATCH);
})();

(function testExpectedScopeIsRequired() {
  const input = baseline();
  delete input.expectedIdentityScope;
  assert.throws(() => buildProductionSecurityReadinessGate(input), /expectedIdentityScope is required/);
})();

console.log('PRODUCTION_SECURITY_READINESS_GATE_V1=PASS');
