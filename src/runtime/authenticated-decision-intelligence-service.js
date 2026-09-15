'use strict';

const { buildDecisionIntelligenceWorkspace } = require('../decision-intelligence/workspace');

const DECISION_INTELLIGENCE_SERVICE_STATUS = Object.freeze({
  OK: 'OK',
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

function assertNoCallerScopeOverride({
  caseId,
  projectId,
  tenantId,
  actorId,
  identityContext,
} = {}) {
  if (
    caseId != null
    || projectId != null
    || tenantId != null
    || actorId != null
    || identityContext != null
  ) {
    fail('CALLER_SCOPE_OVERRIDE_NOT_ALLOWED');
  }
}

function extractCanonicalScope(loaded, requestedWorkspaceId) {
  if (!loaded || loaded.status !== 'OK') fail('UNEXPECTED_WORKSPACE_SERVICE_RESPONSE');
  if (loaded.data == null) fail('CANONICAL_WORKSPACE_NOT_FOUND');

  const envelope = loaded.data;
  const workspace = envelope.workspace;
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
    fail('INVALID_PERSISTED_CANONICAL_WORKSPACE');
  }

  const workspaceId = requiredString(workspace.workspaceId, 'workspace.workspaceId');
  const projectId = requiredString(workspace.projectId, 'workspace.projectId');
  const caseId = requiredString(workspace.caseId, 'workspace.caseId');
  const tenantId = requiredString(envelope.tenantId, 'workspaceEnvelope.tenantId');

  if (workspaceId !== requestedWorkspaceId || envelope.workspaceId !== requestedWorkspaceId) {
    fail('PERSISTED_WORKSPACE_IDENTITY_MISMATCH');
  }
  if (!Number.isInteger(envelope.version) || envelope.version < 1) {
    fail('INVALID_PERSISTED_WORKSPACE_VERSION');
  }
  if (workspace.executableCase && typeof workspace.executableCase === 'object') {
    if (workspace.executableCase.projectId && workspace.executableCase.projectId !== projectId) {
      fail('PERSISTED_WORKSPACE_PROJECT_SCOPE_MISMATCH');
    }
    if (workspace.executableCase.caseId && workspace.executableCase.caseId !== caseId) {
      fail('PERSISTED_WORKSPACE_CASE_SCOPE_MISMATCH');
    }
  }

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
 * Read-only Decision Intelligence runtime boundary.
 *
 * The caller may supply analytical artifacts, but may not choose actor, tenant,
 * project, or case scope. Scope is derived exclusively from an authenticated
 * canonical workspace load performed by the upstream workspace service.
 *
 * This module projects already-produced deterministic/upstream artifacts into
 * the existing Decision Intelligence workspace contract. It does not execute
 * an LLM, fetch live market data, persist the projection, or authorize a human,
 * professional, release, deployment, or transaction decision.
 */
function createAuthenticatedDecisionIntelligenceService({
  workspaceService,
  projector = buildDecisionIntelligenceWorkspace,
} = {}) {
  if (!workspaceService || typeof workspaceService.loadWorkspace !== 'function') {
    throw new TypeError('workspaceService.loadWorkspace is required');
  }
  if (typeof projector !== 'function') throw new TypeError('projector must be a function');

  async function projectWorkspace({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    studyOrchestration,
    decisionQuality,
    evidenceRecords = [],
    assumptionRecords = [],
    aiOutputs = [],
    caseId,
    projectId,
    tenantId,
    actorId,
    identityContext,
  } = {}) {
    assertNoCallerScopeOverride({ caseId, projectId, tenantId, actorId, identityContext });
    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');

    const loaded = await workspaceService.loadWorkspace({
      authorizationHeader,
      workspaceId: normalizedWorkspaceId,
      nowEpochSeconds,
    });
    const sourceContext = extractCanonicalScope(loaded, normalizedWorkspaceId);

    const decisionIntelligence = projector({
      caseId: sourceContext.caseId,
      projectId: sourceContext.projectId,
      studyOrchestration,
      decisionQuality,
      evidenceRecords,
      assumptionRecords,
      aiOutputs,
    });

    if (
      !decisionIntelligence
      || decisionIntelligence.caseId !== sourceContext.caseId
      || decisionIntelligence.projectId !== sourceContext.projectId
    ) {
      fail('DECISION_INTELLIGENCE_SCOPE_MISMATCH');
    }

    return freeze({
      status: DECISION_INTELLIGENCE_SERVICE_STATUS.OK,
      sourceContext,
      decisionIntelligence,
      runtimeState: {
        projectionPersisted: false,
        liveDataValidated: false,
        upstreamArtifactProvenanceValidatedHere: false,
        modelCallExecutedHere: false,
      },
      authority: {
        humanDecisionRequired: true,
        professionalReportExternalIssuanceAuthorized: false,
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
    projectWorkspace,
    authority: Object.freeze({
      humanDecisionRequired: true,
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
    }),
    semantics: 'Decision Intelligence scope is derived from an authenticated persisted canonical workspace, not caller project/case/tenant/actor metadata. The projection remains read-only decision support; upstream artifact provenance, live data, LLM execution, production qualification, professional review, and transaction authority remain external.',
  });
}

module.exports = {
  DECISION_INTELLIGENCE_SERVICE_STATUS,
  createAuthenticatedDecisionIntelligenceService,
};
