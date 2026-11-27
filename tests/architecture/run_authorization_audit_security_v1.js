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

check(() => assert.throws(
  () => normalizePolicy({ MANAGE_POLICY: [{toString:()=> 'ADMIN'}] }),
  /valid non-empty strings only/,
));
check(() => assert.throws(
  () => normalizePolicy({ MANAGE_POLICY: ['ADMIN', null] }),
  /valid non-empty strings only/,
));
check(() => assert.throws(
  () => normalizePolicy({ MANAGE_POLICY: ['ADMIN', ' '] }),
  /valid non-empty strings only/,
));
check(() => assert.strictEqual(authorizeAction({
  identity: {actorId:'U2',tenantId:'T1',roles:[{toString:()=> 'ADMIN'}]},
  action: 'MANAGE_POLICY',
  policy,
}).status, AUTHZ_STATUS.HOLD_IDENTITY));


check(() => assert.strictEqual(Object.getPrototypeOf(policy), null));
check(() => assert.strictEqual(
  authorizeAction({ identity: analyst, action: 'toString', policy }).reason, 'ACTION_NOT_IN_POLICY',
));
check(() => assert.strictEqual(
  authorizeAction({ identity: analyst, action: 'constructor', policy }).reason, 'ACTION_NOT_IN_POLICY',
));
check(() => assert.strictEqual(
  authorizeAction({ identity: analyst, action: '__proto__', policy }).reason, 'ACTION_NOT_IN_POLICY',
));
check(() => assert.throws(
  () => normalizePolicy(JSON.parse('{"__proto__":["ADMIN"]}')),
  /reserved policy action/,
));
check(() => assert.throws(
  () => normalizePolicy(JSON.parse('{"constructor":["ADMIN"]}')),
  /reserved policy action/,
));
check(() => assert.strictEqual(authorizeAction({
  identity: analyst,
  action: 'VIEW_CASE',
  policy: Object.assign(Object.create(null), {VIEW_CASE:['ANALYST']}),
}).allowed, true));


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

const untrustedMetadata = JSON.parse(
  '{"__proto__":{"role":"ADMIN"},"constructor":"pollution","prototype":"poison","requestId":"R2","source":"json-input"}',
);
const safeEvent = createSecurityAuditEvent({
  eventId: 'EVT-UNTRUSTED-METADATA',
  occurredAt: '2026-09-01T00:00:00Z',
  identity: viewer,
  action: 'VIEW_CASE',
  resourceType: 'CASE',
  resourceId: 'C2',
  decision: 'ALLOW',
  reason: 'SYNTHETIC_TEST',
  metadata: untrustedMetadata,
});
check(() => assert.strictEqual(Object.getPrototypeOf(safeEvent.metadata), null));
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(safeEvent.metadata, '__proto__'), false));
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(safeEvent.metadata, 'constructor'), false));
check(() => assert.strictEqual(Object.prototype.hasOwnProperty.call(safeEvent.metadata, 'prototype'), false));
check(() => assert.strictEqual(safeEvent.metadata.requestId, 'R2'));
check(() => assert.strictEqual(safeEvent.metadata.source, 'json-input'));
check(() => assert.strictEqual(({}).role, undefined));
check(() => assert.ok(!JSON.stringify(safeEvent).includes('pollution')));
check(() => assert.ok(Object.isFrozen(safeEvent.metadata)));


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

// Credential aliases must not enter persisted authorization audit metadata.
const sensitiveAliases = [
  'apiKey', 'api_key', 'x-api-key', 'API.KEY', 'credential', 'credentials',
  'privateKey', 'private_key', 'access_key', 'client-key', 'signing.key',
  'encryptionKey', 'passphrase', 'Bearer', 'refreshToken', 'password',
  'secret', 'authorization', 'cookie', 'session',
];
const operationalFields = ['requestId', 'keyId', 'status', 'attemptCount', 'durationMs', 'resourceVersion'];
const redactionEvent = createSecurityAuditEvent({
  eventId: 'EVT-ALIAS-REDACTION',
  occurredAt: '2026-11-27T00:00:00Z',
  identity: viewer,
  action: 'VIEW_CASE',
  resourceType: 'CASE',
  resourceId: 'C3',
  decision: 'DENY',
  reason: 'SYNTHETIC_TEST',
  metadata: Object.fromEntries([
    ...sensitiveAliases.map(key => [key, 'SYNTHETIC_SENSITIVE_PLACEHOLDER']),
    ...operationalFields.map(key => [key, 'SYNTHETIC_OPERATIONAL_VALUE']),
  ]),
});
for (const key of sensitiveAliases) {
  check(() => assert.strictEqual(Object.hasOwn(redactionEvent.metadata, key), false, key));
}
for (const key of operationalFields) {
  check(() => assert.strictEqual(redactionEvent.metadata[key], 'SYNTHETIC_OPERATIONAL_VALUE', key));
}
check(() => assert.ok(!JSON.stringify(redactionEvent).includes('SYNTHETIC_SENSITIVE_PLACEHOLDER')));

// Untrusted metadata must be inert: neither getters nor coercion hooks execute.
let metadataCallbackCount = 0;
const inertEvent = createSecurityAuditEvent({
  eventId: 'EVT-INERT-METADATA', occurredAt: '2026-11-28T00:00:00Z',
  identity: viewer, action: 'VIEW_CASE', resourceType: 'CASE', resourceId: 'C4',
  decision: 'DENY', reason: 'SYNTHETIC_TEST',
  metadata: {
    get apiKey() { metadataCallbackCount++; return 'SYNTHETIC_CALLBACK'; },
    get status() { metadataCallbackCount++; return 'SYNTHETIC_CALLBACK'; },
    opaque: { toString() { metadataCallbackCount++; return 'SYNTHETIC_CALLBACK'; } },
    list: [1], zero: 0, active: false, empty: null, missing: undefined,
    bad: NaN, requestId: 'R4',
  },
});
check(() => assert.strictEqual(metadataCallbackCount, 0));
for (const key of ['apiKey', 'status', 'opaque', 'list', 'bad']) {
  check(() => assert.strictEqual(Object.hasOwn(inertEvent.metadata, key), false, key));
}
for (const [key, value] of Object.entries({zero:'0', active:'false', empty:null, missing:null, requestId:'R4'})) {
  check(() => assert.strictEqual(inertEvent.metadata[key], value, key));
}
check(() => assert.ok(!JSON.stringify(inertEvent).includes('SYNTHETIC_CALLBACK')));

console.log(`AUTHORIZATION_AUDIT_SECURITY_V1: PASS (${checks} checks)`);