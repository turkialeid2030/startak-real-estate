'use strict';

const { normalizeIdentity } = require('./tenant-boundary');

const AUTHZ_STATUS = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  HOLD_IDENTITY: 'HOLD_IDENTITY',
});

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('policy is required');
  // Never inherit Object.prototype methods (toString, constructor, etc.) as
  // authorization actions. JSON-derived policies may contain "__proto__",
  // which would otherwise mutate a plain object's prototype during assignment.
  const normalized = Object.create(null);
  for (const [action, roles] of Object.entries(policy)) {
    if (['__proto__', 'prototype', 'constructor'].includes(action)) {
      throw new TypeError('reserved policy action is not allowed');
    }
    if (!Array.isArray(roles) || roles.length === 0
      || roles.some((role) => typeof role !== 'string' || !role.trim())) {
      throw new TypeError(`policy action ${action} must list at least one role (valid non-empty strings only)`);
    }
    normalized[action] = Object.freeze([...new Set(roles.map((role) => role.trim()))]);
  }
  return Object.freeze(normalized);
}

function authorizeAction({ identity, action, policy } = {}) {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return Object.freeze({ status: AUTHZ_STATUS.HOLD_IDENTITY, allowed: false, reason: 'IDENTITY_MISSING' });

  const { actorId, tenantId, roles } = normalizedIdentity;
  if (typeof action !== 'string' || !action.trim()) {
    return Object.freeze({ status: AUTHZ_STATUS.DENY, allowed: false, reason: 'ACTION_INVALID', actorId, tenantId, action: null });
  }
  const rules = normalizePolicy(policy);
  const requiredRoles = Object.hasOwn(rules, action) ? rules[action] : null;
  if (!requiredRoles) return Object.freeze({ status: AUTHZ_STATUS.DENY, allowed: false, reason: 'ACTION_NOT_IN_POLICY', actorId, tenantId, action });
  const matchedRoles = roles.filter((role) => requiredRoles.includes(role));
  if (matchedRoles.length === 0) return Object.freeze({ status: AUTHZ_STATUS.DENY, allowed: false, reason: 'ROLE_NOT_AUTHORIZED', actorId, tenantId, action });
  return Object.freeze({ status: AUTHZ_STATUS.ALLOW, allowed: true, reason: 'ROLE_AUTHORIZED', actorId, tenantId, action, matchedRoles: Object.freeze(matchedRoles) });
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
  const required = [eventId, occurredAt, action, resourceType, resourceId, decision, reason];
  if (required.some(value => typeof value !== 'string' || !value.trim())) throw new TypeError('security audit event missing required fields');
  const id = eventId.trim();
  const timestamp = occurredAt.trim();
  const normalizedIdentity = normalizeIdentity(identity);
  const actorId = normalizedIdentity?.actorId || '';
  const tenantId = normalizedIdentity?.tenantId || '';
  if (!id || !timestamp || !action || !resourceType || !resourceId || !decision || !reason) throw new TypeError('security audit event missing required fields');
  if (!['ALLOW', 'DENY', 'HOLD_IDENTITY'].includes(decision)) throw new TypeError('invalid security audit decision');
  // Metadata may originate from parsed JSON. A plain {} would treat
  // "__proto__" as a prototype setter; reserve prototype-related keys and
  // store only inert own fields in a null-prototype audit object.
  const safeMetadata = Object.create(null);
  for (const key of Object.keys(metadata || {})) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/token|password|secret|authorization|cookie|session|apikey|credential|privatekey|accesskey|clientkey|signingkey|encryptionkey|passphrase|bearer/.test(normalizedKey)
      || ['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    // Do not invoke getters or arbitrary object-to-string methods while auditing.
    const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
    const value = descriptor.value;
    if (value != null && typeof value !== 'string' && typeof value !== 'boolean'
      && !(typeof value === 'number' && Number.isFinite(value))) continue;
    safeMetadata[key] = value == null ? null : String(value);
  }
  return Object.freeze({
    schemaVersion: 1,
    eventId: id,
    occurredAt: timestamp,
    actorId: actorId || null,
    tenantId: tenantId || null,
    action,
    resourceType,
    resourceId,
    decision,
    reason,
    metadata: Object.freeze(safeMetadata),
  });
}

module.exports = { AUTHZ_STATUS, normalizePolicy, authorizeAction, requireAuthorizedAction, createSecurityAuditEvent };