'use strict';

const assert = require('assert');
const {
  VERIFICATION_STATUS,
  evaluateRuntimeRlsVerification,
} = require('../../src/security/runtime-rls-verification.js');

function baseChecks(overrides = {}) {
  return {
    runtimeRoleIsSuperuser: false,
    runtimeRoleBypassesRls: false,
    forceRlsEnabled: true,
    sameTenantCrudAllowed: true,
    crossTenantCrudDenied: true,
    missingTenantContextDenied: true,
    tenantContextResetBetweenRequests: true,
    privilegedPathSeparatelyTested: true,
    ...overrides,
  };
}

function verify(checks) {
  return evaluateRuntimeRlsVerification({
    testedAt: '2026-09-01T08:45:00Z',
    environment: 'synthetic-test',
    targetDatabaseRef: 'postgres://redacted/test',
    evidenceRefs: ['synthetic-evidence-1'],
    checks,
  });
}

(function testCompleteEvidenceSet() {
  const result = verify(baseChecks());
  assert.strictEqual(result.status, VERIFICATION_STATUS.VERIFICATION_EVIDENCE_COMPLETE);
  assert.strictEqual(result.productionSecurityVerifiedByThisModule, false);
  assert.strictEqual(result.requiresIndependentRuntimeEvidence, true);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function testPrivilegedRuntimeRoleFailsClosed() {
  assert.strictEqual(
    verify(baseChecks({ runtimeRoleIsSuperuser: true })).status,
    VERIFICATION_STATUS.HOLD_PRIVILEGED_ROLE
  );
  assert.strictEqual(
    verify(baseChecks({ runtimeRoleBypassesRls: true })).status,
    VERIFICATION_STATUS.HOLD_PRIVILEGED_ROLE
  );
})();

(function testForceRlsRequired() {
  assert.strictEqual(
    verify(baseChecks({ forceRlsEnabled: false })).status,
    VERIFICATION_STATUS.HOLD_FORCE_RLS
  );
})();

(function testTenantIsolationFailuresHold() {
  for (const patch of [
    { crossTenantCrudDenied: false },
    { missingTenantContextDenied: false },
    { sameTenantCrudAllowed: false },
  ]) {
    assert.strictEqual(
      verify(baseChecks(patch)).status,
      VERIFICATION_STATUS.HOLD_CROSS_TENANT_FAILURE
    );
  }
})();

(function testPoolContextResetRequired() {
  assert.strictEqual(
    verify(baseChecks({ tenantContextResetBetweenRequests: false })).status,
    VERIFICATION_STATUS.HOLD_CONTEXT_RESET
  );
})();

(function testPrivilegedPathEvidenceRequired() {
  assert.strictEqual(
    verify(baseChecks({ privilegedPathSeparatelyTested: false })).status,
    VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE
  );
})();

(function testMissingCheckReturnsHoldEvidence() {
  const checks = baseChecks();
  delete checks.crossTenantCrudDenied;
  const result = verify(checks);
  assert.strictEqual(result.status, VERIFICATION_STATUS.HOLD_RUNTIME_EVIDENCE);
  assert.deepStrictEqual(result.missingChecks, ['crossTenantCrudDenied']);
})();

(function testMetadataAndEvidenceAreMandatory() {
  assert.throws(() => evaluateRuntimeRlsVerification({}), /testedAt/);
  assert.throws(() => evaluateRuntimeRlsVerification({
    testedAt: '2026-09-01T08:45:00Z',
    environment: 'test',
    targetDatabaseRef: 'db',
    evidenceRefs: [],
    checks: baseChecks(),
  }), /evidenceRefs/);
})();

console.log('RUNTIME_RLS_VERIFICATION_V1=PASS');
