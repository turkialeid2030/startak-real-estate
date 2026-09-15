'use strict';

const { requireVerifiedIdentityContext } = require('../security/verified-identity-context');
const { requireAuthorizedAction, normalizePolicy } = require('../security/authorization-audit');

const WORKSPACE_ACTION = Object.freeze({
  VIEW: 'VIEW_WORKSPACE',
  SAVE: 'SAVE_WORKSPACE',
});

const DEFAULT_WORKSPACE_POLICY = normalizePolicy({
  [WORKSPACE_ACTION.VIEW]: ['VIEWER', 'ANALYST', 'IC_MEMBER', 'ADMIN'],
  [WORKSPACE_ACTION.SAVE]: ['ANALYST', 'ADMIN'],
});

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertCanonicalWorkspace(workspace, identity) {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) throw new TypeError('workspace is required');
  for (const key of ['workspaceId', 'projectId', 'caseId']) {
    if (typeof workspace[key] !== 'string' || workspace[key].trim() === '') throw new TypeError(`workspace.${key} must be a non-empty string`);
  }
  if (workspace.schemaVersion !== 1) fail('UNSUPPORTED_WORKSPACE_SCHEMA');
  if (!workspace.executableCase || typeof workspace.executableCase !== 'object') fail('INVALID_CANONICAL_WORKSPACE');
  if (!workspace.authority || typeof workspace.authority !== 'object') fail('INVALID_CANONICAL_WORKSPACE');

  const authorityMustRemainFalse = [
    'professionalReportExternalIssuanceAuthorized',
    'releaseAuthorized',
    'mergeAuthorized',
    'deploymentAuthorized',
    'transactionAuthorized',
  ];
  if (authorityMustRemainFalse.some((key) => workspace.authority[key] !== false)) {
    fail('WORKSPACE_AUTHORITY_INVARIANT_VIOLATION');
  }

  const attributedActor = String(workspace.attribution?.actorId || '').trim();
  if (attributedActor && attributedActor !== identity.actorId) fail('WORKSPACE_ATTRIBUTION_MISMATCH');
}

function createCanonicalWorkspaceRuntime({ persistence, policy = DEFAULT_WORKSPACE_POLICY } = {}) {
  if (!persistence || typeof persistence.load !== 'function' || typeof persistence.save !== 'function') {
    throw new TypeError('persistence with load/save is required');
  }
  const normalizedPolicy = normalizePolicy(policy);

  async function loadWorkspace({ identityContext, workspaceId } = {}) {
    const identity = requireVerifiedIdentityContext(identityContext);
    requireAuthorizedAction({
      identity,
      action: WORKSPACE_ACTION.VIEW,
      policy: normalizedPolicy,
    });
    return persistence.load({ identityContext, workspaceId });
  }

  async function saveWorkspace({
    identityContext,
    workspace,
    expectedVersion,
    operationId,
    occurredAt,
  } = {}) {
    const identity = requireVerifiedIdentityContext(identityContext);
    requireAuthorizedAction({
      identity,
      action: WORKSPACE_ACTION.SAVE,
      policy: normalizedPolicy,
    });
    assertCanonicalWorkspace(workspace, identity);
    return persistence.save({
      identityContext,
      workspace,
      expectedVersion,
      operationId,
      occurredAt,
    });
  }

  return Object.freeze({
    loadWorkspace,
    saveWorkspace,
    policy: normalizedPolicy,
    authority: Object.freeze({
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
    }),
    semantics: 'Canonical workspace runtime operations require a verified identity context and RBAC authorization. Tenant scope is derived from that identity by the persistence boundary. This code does not establish production IdP, database, compliance, release, deployment, or transaction authority.',
  });
}

module.exports = {
  WORKSPACE_ACTION,
  DEFAULT_WORKSPACE_POLICY,
  createCanonicalWorkspaceRuntime,
};