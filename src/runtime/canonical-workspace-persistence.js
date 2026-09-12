'use strict';

const { requireVerifiedIdentityContext } = require('../security/verified-identity-context');
const { createSecurityAuditEvent } = require('../security/authorization-audit');

const PERSISTENCE_STATUS = Object.freeze({
  STORED: 'STORED',
  NOT_FOUND: 'NOT_FOUND',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function storageKey(namespace, tenantId, workspaceId) {
  return `${namespace}:${encodeURIComponent(tenantId)}:${encodeURIComponent(workspaceId)}`;
}

function parseEnvelope(raw, { tenantId, workspaceId }) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    fail('WORKSPACE_PERSISTENCE_CORRUPT_RECORD');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('WORKSPACE_PERSISTENCE_CORRUPT_RECORD');
  if (parsed.schemaVersion !== 1 || !Number.isInteger(parsed.version) || parsed.version < 1) fail('WORKSPACE_PERSISTENCE_CORRUPT_RECORD');
  if (parsed.tenantId !== tenantId || parsed.workspaceId !== workspaceId) fail('WORKSPACE_PERSISTENCE_SCOPE_VIOLATION');
  if (!parsed.workspace || typeof parsed.workspace !== 'object' || parsed.workspace.workspaceId !== workspaceId) fail('WORKSPACE_PERSISTENCE_CORRUPT_RECORD');
  if (!Array.isArray(parsed.history)) fail('WORKSPACE_PERSISTENCE_CORRUPT_RECORD');
  return parsed;
}

/**
 * Creates the durable-workspace persistence boundary used by authenticated runtime code.
 *
 * Preferred providers expose getScoped()/compareAndSetScoped() so tenant/workspace scope
 * is passed as structured values originating from verified identity rather than re-parsed
 * from a storage key. Generic get()/compareAndSet() remains supported for local/test
 * adapters, but browser/host key-value providers do not silently qualify as durable
 * production persistence.
 */
function createCanonicalWorkspacePersistence({
  storageProvider,
  namespace = 'startak:canonical-workspace:v1',
  now = () => new Date().toISOString(),
} = {}) {
  const hasScopedGet = Boolean(storageProvider && typeof storageProvider.getScoped === 'function');
  const hasGenericGet = Boolean(storageProvider && typeof storageProvider.get === 'function');
  if (!hasScopedGet && !hasGenericGet) throw new TypeError('storageProvider.get or storageProvider.getScoped is required');
  const normalizedNamespace = requiredString(namespace, 'namespace');

  const hasScopedCompareAndSet = typeof storageProvider.compareAndSetScoped === 'function';
  const hasGenericCompareAndSet = typeof storageProvider.compareAndSet === 'function';
  const hasAtomicCompareAndSet = hasScopedCompareAndSet || hasGenericCompareAndSet;
  const providerName = typeof storageProvider.providerName === 'function'
    ? storageProvider.providerName()
    : 'UnknownStorageProvider';

  async function providerGet({ key, tenantId, workspaceId }) {
    if (hasScopedGet) {
      return storageProvider.getScoped({
        namespace: normalizedNamespace,
        key,
        tenantId,
        workspaceId,
      });
    }
    return storageProvider.get(key);
  }

  async function providerCompareAndSet({
    key,
    tenantId,
    workspaceId,
    expectedRaw,
    nextRaw,
    expectedVersion,
    nextVersion,
  }) {
    if (hasScopedCompareAndSet) {
      return storageProvider.compareAndSetScoped({
        namespace: normalizedNamespace,
        key,
        tenantId,
        workspaceId,
        expectedRaw,
        nextRaw,
        expectedVersion,
        nextVersion,
      });
    }
    return storageProvider.compareAndSet(key, expectedRaw, nextRaw);
  }

  async function load({ identityContext, workspaceId } = {}) {
    const identity = requireVerifiedIdentityContext(identityContext);
    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
    const key = storageKey(normalizedNamespace, identity.tenantId, normalizedWorkspaceId);
    const raw = await providerGet({
      key,
      tenantId: identity.tenantId,
      workspaceId: normalizedWorkspaceId,
    });
    if (raw == null) return null;
    return deepFreeze(parseEnvelope(String(raw), {
      tenantId: identity.tenantId,
      workspaceId: normalizedWorkspaceId,
    }));
  }

  async function save({
    identityContext,
    workspace,
    expectedVersion,
    operationId,
    occurredAt,
  } = {}) {
    const identity = requireVerifiedIdentityContext(identityContext);
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) throw new TypeError('workspace is required');
    const workspaceId = requiredString(workspace.workspaceId, 'workspace.workspaceId');
    const opId = requiredString(operationId, 'operationId');
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new TypeError('expectedVersion must be an integer >= 0');
    if (!hasAtomicCompareAndSet) fail('ATOMIC_PERSISTENCE_REQUIRED');

    const key = storageKey(normalizedNamespace, identity.tenantId, workspaceId);
    const currentRawValue = await providerGet({
      key,
      tenantId: identity.tenantId,
      workspaceId,
    });
    const currentRaw = currentRawValue == null ? null : String(currentRawValue);
    const current = currentRaw == null
      ? null
      : parseEnvelope(currentRaw, { tenantId: identity.tenantId, workspaceId });
    const currentVersion = current ? current.version : 0;

    if (expectedVersion !== currentVersion) fail('WORKSPACE_VERSION_CONFLICT');
    if (current && (
      current.workspace.projectId !== workspace.projectId
      || current.workspace.caseId !== workspace.caseId
    )) fail('WORKSPACE_RESOURCE_IDENTITY_MISMATCH');

    const timestamp = requiredString(occurredAt || now(), 'occurredAt');
    const auditEvent = createSecurityAuditEvent({
      eventId: opId,
      occurredAt: timestamp,
      identity,
      action: 'SAVE_WORKSPACE',
      resourceType: 'CANONICAL_WORKSPACE',
      resourceId: workspaceId,
      decision: 'ALLOW',
      reason: 'VERIFIED_IDENTITY_AUTHORIZED_PERSISTENCE',
      metadata: {
        provider: providerName,
        previousVersion: currentVersion,
        nextVersion: currentVersion + 1,
      },
    });

    const next = {
      schemaVersion: 1,
      tenantId: identity.tenantId,
      workspaceId,
      version: currentVersion + 1,
      updatedAt: timestamp,
      updatedBy: identity.actorId,
      workspace,
      history: [...(current ? current.history : []), auditEvent],
      authority: {
        productionPersistenceValidated: false,
        externalDatabaseDeploymentRequired: true,
        transactionAuthorized: false,
      },
    };
    const nextRaw = JSON.stringify(next);
    const stored = await providerCompareAndSet({
      key,
      tenantId: identity.tenantId,
      workspaceId,
      expectedRaw: currentRaw,
      nextRaw,
      expectedVersion: currentVersion,
      nextVersion: currentVersion + 1,
    });
    if (stored !== true) fail('WORKSPACE_CONCURRENT_WRITE_CONFLICT');

    return deepFreeze(JSON.parse(nextRaw));
  }

  return Object.freeze({
    load,
    save,
    providerName,
    capabilities: Object.freeze({
      atomicCompareAndSet: hasAtomicCompareAndSet,
      tenantKeyIsolation: true,
      structuredTenantScope: hasScopedGet && hasScopedCompareAndSet,
      productionPersistenceValidated: false,
      externalDatabaseDeploymentRequired: true,
    }),
    semantics: 'This runtime boundary requires atomic storage and scopes records from verified tenant identity. Structured tenant-aware providers are preferred for server/database persistence. The boundary does not prove that a production database, RLS policy, backup, restore, encryption, or disaster-recovery control has been deployed or independently validated.',
  });
}

module.exports = {
  PERSISTENCE_STATUS,
  createCanonicalWorkspacePersistence,
};