'use strict';

const { requireVerifiedIdentityContext } = require('../security/verified-identity-context');
const {
  normalizePolicy,
  requireAuthorizedAction,
  createSecurityAuditEvent,
} = require('../security/authorization-audit');

const OPERATIONS_ACTION = Object.freeze({
  INSPECT: 'INSPECT_OPERATIONS',
});

const OPERATIONS_STATUS = Object.freeze({
  HOLD_EXTERNAL_PRODUCTION_EVIDENCE: 'HOLD_EXTERNAL_PRODUCTION_EVIDENCE',
});

const EVIDENCE_STATE = Object.freeze({
  EXTERNAL_EVIDENCE_REQUIRED: 'EXTERNAL_EVIDENCE_REQUIRED',
});

const DEFAULT_OPERATIONS_POLICY = normalizePolicy({
  [OPERATIONS_ACTION.INSPECT]: ['ADMIN'],
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
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

function assertNoCallerAuthorityOverride({
  tenantId,
  actorId,
  roles,
  identityContext,
  productionAuthenticationValidated,
  productionPersistenceValidated,
  releaseAuthorized,
  mergeAuthorized,
  deploymentAuthorized,
  transactionAuthorized,
} = {}) {
  if (
    tenantId != null
    || actorId != null
    || roles != null
    || identityContext != null
    || productionAuthenticationValidated != null
    || productionPersistenceValidated != null
    || releaseAuthorized != null
    || mergeAuthorized != null
    || deploymentAuthorized != null
    || transactionAuthorized != null
  ) {
    fail('CALLER_OPERATIONS_AUTHORITY_OVERRIDE_NOT_ALLOWED');
  }
}

function sanitizePersistenceCapabilities(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return freeze({
    atomicCompareAndSet: input.atomicCompareAndSet === true,
    tenantKeyIsolation: input.tenantKeyIsolation === true,
    structuredTenantScope: input.structuredTenantScope === true,
    // Provider/config metadata is not production evidence and cannot clear this gate.
    externalDatabaseDeploymentRequired: true,
    productionPersistenceValidated: false,
    evidenceState: EVIDENCE_STATE.EXTERNAL_EVIDENCE_REQUIRED,
  });
}

function extractWorkspaceScope(loaded, requestedWorkspaceId) {
  if (!loaded || loaded.status !== 'OK') fail('UNEXPECTED_WORKSPACE_SERVICE_RESPONSE');
  if (!loaded.data) fail('CANONICAL_WORKSPACE_NOT_FOUND');
  const envelope = loaded.data;
  const workspace = envelope.workspace;
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
    fail('INVALID_PERSISTED_CANONICAL_WORKSPACE');
  }
  const workspaceId = requiredString(workspace.workspaceId, 'workspace.workspaceId');
  if (workspaceId !== requestedWorkspaceId || envelope.workspaceId !== requestedWorkspaceId) {
    fail('PERSISTED_WORKSPACE_IDENTITY_MISMATCH');
  }
  if (!Number.isInteger(envelope.version) || envelope.version < 1) {
    fail('INVALID_PERSISTED_WORKSPACE_VERSION');
  }
  const tenantId = requiredString(envelope.tenantId, 'workspaceEnvelope.tenantId');
  const projectId = requiredString(workspace.projectId, 'workspace.projectId');
  const caseId = requiredString(workspace.caseId, 'workspace.caseId');
  return freeze({
    workspaceId,
    workspaceVersion: envelope.version,
    tenantId,
    projectId,
    caseId,
    scopeDerivedFrom: 'AUTHENTICATED_CANONICAL_WORKSPACE',
  });
}

/**
 * Read-only operator inspection boundary.
 *
 * It deliberately exposes only a small allowlisted operational snapshot. It never
 * serializes provider objects, connection strings, JWKS, bearer tokens, cookies,
 * sessions, secrets, or arbitrary environment/configuration data.
 *
 * Passing code capability checks is not production evidence. Live IdP, database,
 * RLS/IDOR, backup/restore, DR, monitoring, incident-response, pentest and other
 * external controls must be evidenced independently before any production status
 * can move beyond HOLD_EXTERNAL_PRODUCTION_EVIDENCE.
 */
function createAuthenticatedOperationsService({
  authenticator,
  workspaceService,
  requiredTenantId,
  persistenceCapabilities = {},
  policy = DEFAULT_OPERATIONS_POLICY,
} = {}) {
  if (!authenticator || typeof authenticator.authenticate !== 'function') {
    throw new TypeError('authenticator.authenticate is required');
  }
  if (!workspaceService || typeof workspaceService.loadWorkspace !== 'function') {
    throw new TypeError('workspaceService.loadWorkspace is required');
  }
  const configuredTenantId = requiredTenantId == null ? null : requiredString(requiredTenantId, 'requiredTenantId');
  const normalizedPolicy = normalizePolicy(policy);
  const safePersistenceCapabilities = sanitizePersistenceCapabilities(persistenceCapabilities);

  async function authenticate(authorizationHeader, nowEpochSeconds) {
    const result = await authenticator.authenticate({
      authorizationHeader,
      requiredTenantId: configuredTenantId || undefined,
      nowEpochSeconds,
    });
    if (!result || result.authorizationReady !== true || !result.identityContext) {
      fail('AUTHENTICATION_REQUIRED');
    }
    return {
      identityContext: result.identityContext,
      identity: requireVerifiedIdentityContext(result.identityContext),
    };
  }

  async function inspectWorkspace({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    operationId,
    occurredAt,
    tenantId,
    actorId,
    roles,
    identityContext,
    productionAuthenticationValidated,
    productionPersistenceValidated,
    releaseAuthorized,
    mergeAuthorized,
    deploymentAuthorized,
    transactionAuthorized,
  } = {}) {
    assertNoCallerAuthorityOverride({
      tenantId,
      actorId,
      roles,
      identityContext,
      productionAuthenticationValidated,
      productionPersistenceValidated,
      releaseAuthorized,
      mergeAuthorized,
      deploymentAuthorized,
      transactionAuthorized,
    });

    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
    const normalizedOperationId = requiredString(operationId, 'operationId');
    const normalizedOccurredAt = requiredString(occurredAt, 'occurredAt');
    const auth = await authenticate(authorizationHeader, nowEpochSeconds);

    requireAuthorizedAction({
      identity: auth.identity,
      action: OPERATIONS_ACTION.INSPECT,
      policy: normalizedPolicy,
    });

    const loaded = await workspaceService.loadWorkspace({
      authorizationHeader,
      workspaceId: normalizedWorkspaceId,
      nowEpochSeconds,
    });
    const scope = extractWorkspaceScope(loaded, normalizedWorkspaceId);
    if (scope.tenantId !== auth.identity.tenantId) fail('AUTHENTICATED_TENANT_SCOPE_MISMATCH');

    const auditEvent = createSecurityAuditEvent({
      eventId: normalizedOperationId,
      occurredAt: normalizedOccurredAt,
      identity: auth.identity,
      action: OPERATIONS_ACTION.INSPECT,
      resourceType: 'CANONICAL_WORKSPACE_OPERATIONS',
      resourceId: normalizedWorkspaceId,
      decision: 'ALLOW',
      reason: 'VERIFIED_ADMIN_READ_ONLY_INSPECTION',
      metadata: {
        workspaceVersion: scope.workspaceVersion,
        productionAuthenticationValidated: false,
        productionPersistenceValidated: false,
      },
    });

    return freeze({
      status: OPERATIONS_STATUS.HOLD_EXTERNAL_PRODUCTION_EVIDENCE,
      scope,
      operator: {
        actorId: auth.identity.actorId,
        authorizationBasis: 'VERIFIED_IDENTITY_AND_ADMIN_RBAC',
      },
      authentication: {
        verifiedIdentityBoundaryRequired: true,
        productionAuthenticationValidated: false,
        evidenceState: EVIDENCE_STATE.EXTERNAL_EVIDENCE_REQUIRED,
      },
      persistence: safePersistenceCapabilities,
      operationalEvidence: {
        liveDatabaseConnectivityValidatedHere: false,
        rlsIdorRuntimeValidatedHere: false,
        backupRestoreValidatedHere: false,
        disasterRecoveryValidatedHere: false,
        monitoringValidatedHere: false,
        incidentResponseValidatedHere: false,
        productionSecretsValidatedHere: false,
        pentestValidatedHere: false,
        evidenceState: EVIDENCE_STATE.EXTERNAL_EVIDENCE_REQUIRED,
      },
      audit: {
        event: auditEvent,
        persisted: false,
      },
      readOnly: true,
      secretsExposed: false,
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
    inspectWorkspace,
    requiredTenantId: configuredTenantId,
    policy: normalizedPolicy,
    persistenceCapabilities: safePersistenceCapabilities,
    authority: Object.freeze({
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
    }),
    semantics: 'Authenticated ADMIN-only read-only operational inspection. Output is deliberately allowlisted and excludes provider/configuration secrets. Code capabilities are not production evidence; external runtime qualification remains mandatory.',
  });
}

module.exports = {
  OPERATIONS_ACTION,
  OPERATIONS_STATUS,
  EVIDENCE_STATE,
  DEFAULT_OPERATIONS_POLICY,
  sanitizePersistenceCapabilities,
  createAuthenticatedOperationsService,
};
