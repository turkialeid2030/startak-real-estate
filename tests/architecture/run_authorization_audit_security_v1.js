'use strict';
const assert = require('assert');
const {
  AUTHZ_STATUS,
  normalizePolicy,
  authorizeAction,
  requireAuthorizedAction,
  createSecurityAuditEvent,
} = require('../../src/security/authorization-audit');
let checks = 0;
function check(fn) { fn(); checks++; }

const policy = normalizePolicy({
  VIEW_CASE: ['VIEWER', 'ANALYST', 'ADMIN'],
  EDIT_CASE: ['ANALYST', 'ADMIN'],
  MANAGE_POLICY: ['ADMIN'],
});
const analyst = { actorId: 'U1', tenantId: 'T1', roles: ['ANALYST'] };
const viewer = { actorId: 'U2', tenantId: 'T1', roles: ['VIEWER'] };
const subjectOnly = { subject: 'U3', tenantId: 'T1', roles: ['VIEWER'] };
const mismatchedPrincipal = { actorId: 'FORGED', subject: 'U2', tenantId: 'T1', roles: ['ADMIN'] };

check(() => assert.strictEqual(authorizeAction({ identity: analyst, action: 'VIEW_CASE', policy }).status, AUTHZ_STATUS.ALLOW));
check(() => assert.strictEqual(authorizeAction({ identity: analyst, action: 'EDIT_CASE', policy }).allowed, true));
check(() => assert.strictEqual(authorizeAction({ identity: subjectOnly, action: 'VIEW_CASE', policy }).allowed, true));
check(() => assert.strictEqual(authorizeAction({ identity: mismatchedPrincipal, action: 'MANAGE_POLICY', policy }).status, AUTHZ_STATUS.HOLD_IDENTITY));
check(() => assert.strictEqual(authorizeAction({ identity: viewer, action: 'EDIT_CASE', policy }).reason, 'ROLE_NOT_AUTHORIZED'));
check(() => assert.strictEqual(authorizeAction({ identity: analyst, action: 'UNKNOWN_ACTION', policy }).reason, 'ACTION_NOT_IN_POLICY'));
check(() => assert.strictEqual(authorizeAction({ identity: null, action: 'VIEW_CASE', policy }).status, AUTHZ_STATUS.HOLD_IDENTITY));
check(() => assert.throws(() => requireAuthorizedAction({ identity: viewer, action: 'EDIT_CASE', policy }), (e) => e.code === 'ROLE_NOT_AUTHORIZED'));
check(() => assert.throws(() => requireAuthorizedAction({ identity: mismatchedPrincipal, action: 'MANAGE_POLICY', policy }), (e) => e.code === 'IDENTITY_MISSING'));
check(() => assert.throws(() => normalizePolicy({ VIEW_CASE: [] }), /at least one role/));
check(() => assert.throws(() => normalizePolicy({ VIEW_CASE: [''] }), /at least one role/));

const denied = authorizeAction({ identity: viewer, action: 'EDIT_CASE', policy });
const event = createSecurityAuditEvent({
  eventId: 'EVT-1',
  occurredAt: '2026-09-01T00:00:00Z',
  identity: viewer,
  action: 'EDIT_CASE',
  resourceType: 'CASE',
  resourceId: 'C1',
  decision: denied.status,
  reason: denied.reason,
  metadata: { requestId: 'R1', password: 'must-not-appear', authorizationHeader: 'must-not-appear', source: 'architecture-test' },
});
check(() => assert.strictEqual(event.decision, 'DENY'));
check(() => assert.strictEqual(event.actorId, 'U2'));
check(() => assert.strictEqual(event.tenantId, 'T1'));
check(() => assert.strictEqual(event.metadata.requestId, 'R1'));
check(() => assert.strictEqual(event.metadata.source, 'architecture-test'));
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(event.metadata, 'password'), false));
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(event.metadata, 'authorizationHeader'), false));
check(() => assert.ok(Object.isFrozen(event)));
check(() => assert.ok(Object.isFrozen(event.metadata)));

const mismatchEvent = createSecurityAuditEvent({
  eventId: 'EVT-2',
  occurredAt: '2026-09-01T00:00:00Z',
  identity: mismatchedPrincipal,
  action: 'MANAGE_POLICY',
  resourceType: 'POLICY',
  resourceId: 'P1',
  decision: 'HOLD_IDENTITY',
  reason: 'IDENTITY_MISSING',
});
check(() => assert.strictEqual(mismatchEvent.actorId, null));
check(() => assert.strictEqual(mismatchEvent.tenantId, null));
check(() => assert.throws(() => createSecurityAuditEvent({ eventId: 'X' }), /missing required fields/));

console.log(`AUTHORIZATION_AUDIT_SECURITY_V1: PASS (${checks} checks)`);