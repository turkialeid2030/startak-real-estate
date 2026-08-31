'use strict';
const assert = require('assert');
const {
  TENANT_SECURITY_STATUS,
  normalizeIdentity,
  assertTenantScopedAccess,
  requireTenantScopedAccess,
  bindTenantToRecord,
} = require('../../src/security/tenant-boundary');
let checks = 0;
function check(fn) { fn(); checks++; }

const identityA = { actorId: 'U1', tenantId: 'T1', roles: ['ANALYST', 'ANALYST'] };
const identityB = { actorId: 'U2', tenantId: 'T2', roles: ['VIEWER'] };

check(() => assert.deepStrictEqual(normalizeIdentity(identityA).roles, ['ANALYST']));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: identityA, resourceTenantId: 'T1' }).status, TENANT_SECURITY_STATUS.AUTHORIZED));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: identityA, resourceTenantId: 'T1' }).allowed, true));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: identityA, resourceTenantId: 'T2' }).status, TENANT_SECURITY_STATUS.DENIED));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: identityA, resourceTenantId: 'T2' }).reason, 'CROSS_TENANT_ACCESS_DENIED'));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: null, resourceTenantId: 'T1' }).status, TENANT_SECURITY_STATUS.HOLD_IDENTITY));
check(() => assert.strictEqual(assertTenantScopedAccess({ identity: identityA, resourceTenantId: '' }).allowed, false));
check(() => assert.throws(() => requireTenantScopedAccess({ identity: identityB, resourceTenantId: 'T1', action: 'WRITE' }), (e) => e.code === 'CROSS_TENANT_ACCESS_DENIED'));

const bound = bindTenantToRecord({ caseId: 'C1' }, identityA);
check(() => assert.strictEqual(bound.tenantId, 'T1'));
check(() => assert.strictEqual(bound.caseId, 'C1'));
check(() => assert.ok(Object.isFrozen(bound)));
check(() => assert.throws(() => bindTenantToRecord({ caseId: 'C2', tenantId: 'T2' }, identityA), (e) => e.code === 'CROSS_TENANT_WRITE_DENIED'));
check(() => assert.throws(() => bindTenantToRecord({ caseId: 'C3' }, null), (e) => e.code === 'IDENTITY_OR_RESOURCE_TENANT_MISSING'));

console.log(`TENANT_BOUNDARY_SECURITY_V1: PASS (${checks} checks)`);
