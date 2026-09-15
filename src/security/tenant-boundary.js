'use strict';

const TENANT_SECURITY_STATUS = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  DENIED: 'DENIED',
  HOLD_IDENTITY: 'HOLD_IDENTITY',
});

function normalizeIdentity(identity) {
  if (!identity || typeof identity !== 'object') return null;
  const explicitActorId = String(identity.actorId || '').trim();
  const subject = String(identity.subject || '').trim();
  if (explicitActorId && subject && explicitActorId !== subject) return null;

  const actorId = explicitActorId || subject;
  const tenantId = String(identity.tenantId || '').trim();
  if (!actorId || !tenantId) return null;

  const roles = Array.isArray(identity.roles)
    ? [...new Set(identity.roles.map((role) => String(role).trim()).filter(Boolean))]
    : [];

  return Object.freeze({
    actorId,
    subject: subject || actorId,
    tenantId,
    roles: Object.freeze(roles),
  });
}

function assertTenantScopedAccess({ identity, resourceTenantId, action = 'READ' } = {}) {
  const normalized = normalizeIdentity(identity);
  const targetTenant = String(resourceTenantId || '').trim();
  if (!normalized || !targetTenant) {
    return Object.freeze({ status: TENANT_SECURITY_STATUS.HOLD_IDENTITY, allowed: false, reason: 'IDENTITY_OR_RESOURCE_TENANT_MISSING' });
  }
  if (normalized.tenantId !== targetTenant) {
    return Object.freeze({
      status: TENANT_SECURITY_STATUS.DENIED,
      allowed: false,
      reason: 'CROSS_TENANT_ACCESS_DENIED',
      actorId: normalized.actorId,
      actorTenantId: normalized.tenantId,
      resourceTenantId: targetTenant,
      action: String(action),
    });
  }
  return Object.freeze({
    status: TENANT_SECURITY_STATUS.AUTHORIZED,
    allowed: true,
    reason: 'TENANT_MATCH',
    actorId: normalized.actorId,
    actorTenantId: normalized.tenantId,
    resourceTenantId: targetTenant,
    action: String(action),
  });
}

function requireTenantScopedAccess(args) {
  const decision = assertTenantScopedAccess(args);
  if (!decision.allowed) {
    const error = new Error(decision.reason);
    error.code = decision.reason;
    error.securityDecision = decision;
    throw error;
  }
  return decision;
}

function bindTenantToRecord(record, identity) {
  const normalized = normalizeIdentity(identity);
  if (!normalized) {
    const error = new Error('IDENTITY_OR_RESOURCE_TENANT_MISSING');
    error.code = 'IDENTITY_OR_RESOURCE_TENANT_MISSING';
    throw error;
  }
  if (!record || typeof record !== 'object') throw new TypeError('record is required');
  if (record.tenantId && String(record.tenantId) !== normalized.tenantId) {
    const error = new Error('CROSS_TENANT_WRITE_DENIED');
    error.code = 'CROSS_TENANT_WRITE_DENIED';
    throw error;
  }
  return Object.freeze({ ...record, tenantId: normalized.tenantId });
}

module.exports = {
  TENANT_SECURITY_STATUS,
  normalizeIdentity,
  assertTenantScopedAccess,
  requireTenantScopedAccess,
  bindTenantToRecord,
};