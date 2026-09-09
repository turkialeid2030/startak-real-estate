'use strict';

const SERVICE_STATUS = Object.freeze({
  OK: 'OK',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

/**
 * Composes the bearer authenticator with the canonical workspace runtime.
 *
 * Security boundary:
 * - callers provide only the Authorization header and operation data
 * - caller-supplied identity/actor/tenant metadata is never accepted as authority
 * - optional requiredTenantId is constructor configuration, intended to come from
 *   trusted server routing/configuration rather than request payloads
 * - every runtime call receives identity exclusively from successful authentication
 */
function createAuthenticatedCanonicalWorkspaceService({
  authenticator,
  runtime,
  requiredTenantId,
} = {}) {
  if (!authenticator || typeof authenticator.authenticate !== 'function') {
    throw new TypeError('authenticator.authenticate is required');
  }
  if (!runtime || typeof runtime.loadWorkspace !== 'function' || typeof runtime.saveWorkspace !== 'function') {
    throw new TypeError('runtime with loadWorkspace/saveWorkspace is required');
  }
  const configuredTenantId = requiredTenantId == null ? null : requiredString(requiredTenantId, 'requiredTenantId');

  async function authenticate(authorizationHeader, nowEpochSeconds) {
    const result = await authenticator.authenticate({
      authorizationHeader,
      requiredTenantId: configuredTenantId || undefined,
      nowEpochSeconds,
    });
    if (!result || result.authorizationReady !== true || !result.identityContext) {
      fail('AUTHENTICATION_REQUIRED');
    }
    return result.identityContext;
  }

  async function loadWorkspace({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
  } = {}) {
    const identityContext = await authenticate(authorizationHeader, nowEpochSeconds);
    const data = await runtime.loadWorkspace({
      identityContext,
      workspaceId,
    });
    return freeze({
      status: SERVICE_STATUS.OK,
      data,
      authority: {
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
        productionAuthenticationValidated: false,
        productionPersistenceValidated: false,
      },
    });
  }

  async function saveWorkspace({
    authorizationHeader,
    workspace,
    expectedVersion,
    operationId,
    occurredAt,
    nowEpochSeconds,
  } = {}) {
    const identityContext = await authenticate(authorizationHeader, nowEpochSeconds);
    const data = await runtime.saveWorkspace({
      identityContext,
      workspace,
      expectedVersion,
      operationId,
      occurredAt,
    });
    return freeze({
      status: SERVICE_STATUS.OK,
      data,
      authority: {
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
        productionAuthenticationValidated: false,
        productionPersistenceValidated: false,
      },
    });
  }

  return Object.freeze({
    loadWorkspace,
    saveWorkspace,
    requiredTenantId: configuredTenantId,
    authority: Object.freeze({
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
    }),
    semantics: 'This service composes cryptographic bearer authentication with tenant/RBAC-scoped canonical workspace runtime operations. Identity and tenant authority are derived from successful authentication and trusted server configuration, never caller identity metadata. Production IdP/database/deployment qualification remains external.',
  });
}

module.exports = {
  SERVICE_STATUS,
  createAuthenticatedCanonicalWorkspaceService,
};
