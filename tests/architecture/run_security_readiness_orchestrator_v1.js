'use strict';

const assert = require('assert');
const { IDENTITY_STATUS } = require('../../src/security/verified-identity-context.js');
const { VERIFICATION_STATUS } = require('../../src/security/runtime-rls-verification.js');
const {
  SECURITY_READINESS_STATUS,
  buildSecurityReadinessAssessment,
} = require('../../src/security/security-readiness-orchestrator.js');

function baseline() {
  return {
    scope: { environment: 'staging', tenantId: 'tenant-a', targetDatabaseRef: 'db-ref-1' },
    identityAssessment: {
      status: IDENTITY_STATUS.VERIFIED_CONTEXT,
      authorizationReady: true,
      identity: { tenantId: 'tenant-a', verificationRef: 'oidc-proof-1' },
    },
    rlsAssessment: {
      status: VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE,
      environment: 'staging',
      targetDatabaseRef: 'db-ref-1',
      evidenceRefs: ['rls-run-1'],
    },
    authorizationEvidence: {
      sameTenantAllowed: true,
      crossTenantDenied: true,
      unknownActionDenied: true,
      evidenceRefs: ['authz-run-1'],
    },
    auditEvidence: {
      allowRecorded: true,
      denyRecorded: true,
      sensitiveMetadataFiltered: true,
      evidenceRefs: ['audit-run-1'],
    },
  };
}

(function testReadyOnlyForIndependentReview() {
  const result = buildSecurityReadinessAssessment(baseline());
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW);
  assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
  assert.strictEqual(result.independentSecurityReviewRequired, true);
  assert.strictEqual(result.databaseTestsExecutedHere, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testIdentityFailureFailsClosed() {
  const input = baseline();
  input.identityAssessment = { status: IDENTITY_STATUS.HOLD_TOKEN_VERIFICATION, authorizationReady: false, identity: null };
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_IDENTITY_EVIDENCE);
})();

(function testTenantScopeMismatchFailsClosed() {
  const input = baseline();
  input.identityAssessment.identity.tenantId = 'tenant-b';
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_SCOPE_MISMATCH);
})();

(function testRlsScopeMismatchFailsClosed() {
  const input = baseline();
  input.rlsAssessment.targetDatabaseRef = 'db-ref-2';
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_SCOPE_MISMATCH);
})();

(function testRlsFailureFailsClosed() {
  const input = baseline();
  input.rlsAssessment.status = VERIFICATION_STATUS.HOLD_CONTEXT_RESET;
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_RLS_EVIDENCE);
})();

(function testAuthorizationEvidenceFailureFailsClosed() {
  const input = baseline();
  input.authorizationEvidence.crossTenantDenied = false;
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_AUTHORIZATION_EVIDENCE);
})();

(function testAuditEvidenceFailureFailsClosed() {
  const input = baseline();
  input.auditEvidence.sensitiveMetadataFiltered = false;
  const result = buildSecurityReadinessAssessment(input);
  assert.strictEqual(result.status, SECURITY_READINESS_STATUS.HOLD_AUDIT_EVIDENCE);
})();

(function testEvidenceRefsRequired() {
  const input = baseline();
  input.authorizationEvidence.evidenceRefs = [];
  assert.throws(() => buildSecurityReadinessAssessment(input), /non-empty array/);
})();

console.log('SECURITY_READINESS_ORCHESTRATOR_V1=PASS');
