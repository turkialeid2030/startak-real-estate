'use strict';

const AUTHZ_STATUS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  HOLD_IDENTITY: 'HOLD_IDENTITY',
});

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy is required');
  const normalized = {};
  for (const [action, roles] of Object.entries(policy)) {
    if (!Array.isArray(roles) || roles.length === 0) throw new TypeError(`policy action ${action} must list at least one role`);
    normalized[String(action)] = Object.freeze([...new Set(roles.map(String))]);
  }
  return Object.freeze(normalized);
}

function authorizeAction({ identity, action, policy } = {}) {
  const actorId = String(identity?.actorId || '').trim();
  const tenantId = String(identity?.tenantId || '').trim();
  const roles = Array.isArray(identity?.roles) ? [...new Set(identity.roles.map(String))] : [];
  if (!actorId || !tenantId) return Object.freeze({ status: AUTHZ_STATUS.HOLD_IDENTITY, allowed: false, reason: 'IDENTITY_MISSING' });
  const rules = normalizePolicy(policy);
  const requiredRoles = rules[String(action)];
  if (!requiredRoles) return Object.freeze({ status: AUTHZ_STATUS.DENY, allowed: false, reason: 'ACTION_NOT_IN_POLICY', actorId, tenantId, action: String(action) });
  const matchedRoles = roles.filter((role) => requiredRoles.includes(role));
  if (matchedRoles.length === 0) return Object.freeze({ status: AUTHZ_STATUS.DENY, allowed: false, reason: 'ROLE_NOT_AUTHORIZED', actorId, tenantId, action: String(action) });
  return Object.freeze({ status: AUTHZ_STATUS.ALLOW, allowed: true, reason: 'ROLE_AUTHORIZED', actorId, tenantId, action: String(action), matchedRoles: Object.freeze(matchedRoles) });
}

function requireAuthorizedAction(args) {
  const result = authorizeAction(args);
  if (!result.allowed) {
    const error = new Error(result.reason);
    error.code = result.reason;
    error.authorization = result;
    throw error;
  }
  return result;
}

function createSecurityAuditEvent({ eventId, occurredAt, identity, action, resourceType, resourceId, decision, reason, metadata = {} } = {}) {
  const id = String(eventId || '').trim();
  const timestamp = String(occurredAt || '').trim();
  const actorId = String(identity?.actorId || '').trim();
  const tenantId = String(identity?.tenantId || '').trim();
  if (!id || !timestamp || !action || !resourceType || !resourceId || !decision || !reason) throw new TypeError('security audit event missing required fields');
  if (!['ALLOW', 'DENY', 'HOLD_IDENTITY'].includes(String(decision))) throw new TypeError('invalid security audit decision');
  const safeMetadata = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (/token|password|secret|authorization|cookie|session/i.test(key)) continue;
    safeMetadata[String(key)] = value == null ? null : String(value);
  }
  return Object.freeze({
    schemaVersion: 1,
    eventId: id,
    occurredAt: timestamp,
    actorId: actorId || null,
    tenantId: tenantId || null,
    action: String(action),
    resourceType: String(resourceType),
    resourceId: String(resourceId),
    decision: String(decision),
    reason: String(reason),
    metadata: Object.freeze(safeMetadata),
  });
}

module.exports = { AUTHZ_STATUS, normalizePolicy, authorizeAction, requireAuthorizedAction, createSecurityAuditEvent };
