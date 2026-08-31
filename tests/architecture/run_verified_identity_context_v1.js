'use strict';

const assert = require('assert');
const {
  IDENTITY_STATUS,
  createVerifiedIdentityContext,
} = require('../../src/security/verified-identity-context');

let checks = 0;
function check(fn) { fn(); checks++; }

const now = 2000000000;
const claims = {
  sub: 'user-1',
  tenant_id: 'tenant-a',
  roles: ['ANALYST', 'ANALYST', 'IC_MEMBER'],
  iss: 'https://id.example.test/',
  aud: 'startak-real-estate',
  exp: now + 3600,
};

const noProof = createVerifiedIdentityContext({ claims, requiredTenantId: 'tenant-a', nowEpochSeconds: now });
check(() => assert.strictEqual(noProof.status, IDENTITY_STATUS.HOLD_TOKEN_VERIFICATION));
check(() => assert.strictEqual(noProof.authorizationReady, false));

const verified = createVerifiedIdentityContext({
  claims,
  tokenVerificationEvidence: { verified: true, verificationRef: 'VERIFY-1' },
  requiredTenantId: 'tenant-a',
  nowEpochSeconds: now,
});
check(() => assert.strictEqual(verified.status, IDENTITY_STATUS.VERIFIED_CONTEXT));
check(() => assert.strictEqual(verified.authorizationReady, true));
check(() => assert.strictEqual(verified.identity.subject, 'user-1'));
check(() => assert.strictEqual(verified.identity.tenantId, 'tenant-a'));
check(() => assert.deepStrictEqual(verified.identity.roles, ['ANALYST', 'IC_MEMBER']));
check(() => assert.strictEqual(verified.identity.verificationRef, 'VERIFY-1'));
check(() => assert.strictEqual(verified.productionIdentityVerifiedByThisModule, false));
check(() => assert.strictEqual(verified.claimBoundary.cryptographicVerificationPerformedHere, false));
check(() => assert.strictEqual(verified.claimBoundary.requiresTrustedServerVerifier, true));

const expired = createVerifiedIdentityContext({
  claims: { ...claims, exp: now },
  tokenVerificationEvidence: { verified: true },
  requiredTenantId: 'tenant-a',
  nowEpochSeconds: now,
});
check(() => assert.strictEqual(expired.status, IDENTITY_STATUS.HOLD_TOKEN_EXPIRED));

const wrongTenant = createVerifiedIdentityContext({
  claims,
  tokenVerificationEvidence: { verified: true },
  requiredTenantId: 'tenant-b',
  nowEpochSeconds: now,
});
check(() => assert.strictEqual(wrongTenant.status, IDENTITY_STATUS.HOLD_TENANT_MEMBERSHIP));
check(() => assert.strictEqual(wrongTenant.authorizationReady, false));

const missingRoles = createVerifiedIdentityContext({
  claims: { ...claims, roles: [] },
  tokenVerificationEvidence: { verified: true },
  requiredTenantId: 'tenant-a',
  nowEpochSeconds: now,
});
check(() => assert.strictEqual(missingRoles.status, IDENTITY_STATUS.HOLD_REQUIRED_CLAIMS));
check(() => assert.ok(missingRoles.reasonCodes.includes('MISSING_OR_INVALID_ROLES')));

const badAudience = createVerifiedIdentityContext({
  claims: { ...claims, aud: [] },
  tokenVerificationEvidence: { verified: true },
  requiredTenantId: 'tenant-a',
  nowEpochSeconds: now,
});
check(() => assert.strictEqual(badAudience.status, IDENTITY_STATUS.HOLD_REQUIRED_CLAIMS));

console.log(`VERIFIED_IDENTITY_CONTEXT_V1: PASS (${checks} checks)`);
