'use strict';

const { requireVerifiedIdentityContext } = require('../security/verified-identity-context');
const { normalizePolicy, requireAuthorizedAction } = require('../security/authorization-audit');
const { buildCommitteeDecisionDossier } = require('../investment-committee/decision-dossier');
const {
  IC_CASE_STATUS,
  createCommitteeCase,
  recordHumanCommitteeDecision,
} = require('../investment-committee');
const {
  DECISION_RECORD_STATUS,
  buildHumanCommitteeDecisionRecord,
} = require('../investment-committee/human-decision-record');

const IC_RUNTIME_ACTION = Object.freeze({
  PREPARE: 'PREPARE_IC_CASE',
  RECORD_DECISION: 'RECORD_IC_DECISION',
});

const IC_RUNTIME_STATUS = Object.freeze({
  READY_FOR_HUMAN_COMMITTEE: 'READY_FOR_HUMAN_COMMITTEE',
  HOLD_DOSSIER: 'HOLD_DOSSIER',
  HOLD_CONTROL_GATE: 'HOLD_CONTROL_GATE',
  HOLD_GOVERNANCE: 'HOLD_GOVERNANCE',
  HUMAN_DECISION_RECORDED: 'HUMAN_DECISION_RECORDED',
});

const DEFAULT_IC_RUNTIME_POLICY = normalizePolicy({
  [IC_RUNTIME_ACTION.PREPARE]: ['ANALYST', 'IC_MEMBER', 'ADMIN'],
  [IC_RUNTIME_ACTION.RECORD_DECISION]: ['IC_MEMBER', 'ADMIN'],
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
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
  caseId,
  projectId,
  tenantId,
  actorId,
  identityContext,
  preparedBy,
  recordedBy,
} = {}) {
  if (
    caseId != null
    || projectId != null
    || tenantId != null
    || actorId != null
    || identityContext != null
    || preparedBy != null
    || recordedBy != null
  ) {
    fail('CALLER_AUTHORITY_OVERRIDE_NOT_ALLOWED');
  }
}

function extractWorkspaceScope(loaded, requestedWorkspaceId) {
  if (!loaded || loaded.status !== 'OK') fail('UNEXPECTED_WORKSPACE_SERVICE_RESPONSE');
  if (!loaded.data) fail('CANONICAL_WORKSPACE_NOT_FOUND');
  const envelope = loaded.data;
  const workspace = requiredObject(envelope.workspace, 'workspaceEnvelope.workspace');
  const workspaceId = requiredString(workspace.workspaceId, 'workspace.workspaceId');
  if (workspaceId !== requestedWorkspaceId || envelope.workspaceId !== requestedWorkspaceId) {
    fail('PERSISTED_WORKSPACE_IDENTITY_MISMATCH');
  }
  if (!Number.isInteger(envelope.version) || envelope.version < 1) {
    fail('INVALID_PERSISTED_WORKSPACE_VERSION');
  }
  return freeze({
    workspaceId,
    workspaceVersion: envelope.version,
    tenantId: requiredString(envelope.tenantId, 'workspaceEnvelope.tenantId'),
    projectId: requiredString(workspace.projectId, 'workspace.projectId'),
    caseId: requiredString(workspace.caseId, 'workspace.caseId'),
    scopeDerivedFrom: 'AUTHENTICATED_CANONICAL_WORKSPACE',
  });
}

function assertPolicyMatchesCommitteeCase(policy, committeeCase) {
  requiredObject(policy, 'policy');
  requiredObject(committeeCase, 'committeeCase');
  const ref = requiredObject(committeeCase.policyRef, 'committeeCase.policyRef');
  if (policy.policyId !== ref.policyId || policy.version !== ref.version) {
    fail('COMMITTEE_POLICY_VERSION_MISMATCH');
  }
}

function createAuthenticatedInvestmentCommitteeService({
  authenticator,
  workspaceService,
  decisionIntelligenceService,
  requiredTenantId,
  policy = DEFAULT_IC_RUNTIME_POLICY,
} = {}) {
  if (!authenticator || typeof authenticator.authenticate !== 'function') {
    throw new TypeError('authenticator.authenticate is required');
  }
  if (!workspaceService || typeof workspaceService.loadWorkspace !== 'function') {
    throw new TypeError('workspaceService.loadWorkspace is required');
  }
  if (!decisionIntelligenceService || typeof decisionIntelligenceService.projectWorkspace !== 'function') {
    throw new TypeError('decisionIntelligenceService.projectWorkspace is required');
  }
  const configuredTenantId = requiredTenantId == null ? null : requiredString(requiredTenantId, 'requiredTenantId');
  const normalizedPolicy = normalizePolicy(policy);

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

  async function prepareCommitteeCase({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    studyOrchestration,
    decisionQuality,
    evidenceRecords = [],
    assumptionRecords = [],
    aiOutputs = [],
    actionRegister,
    decisionThresholds = null,
    scenarioRisk = null,
    valuation = null,
    financial = null,
    controlGate,
    committeePolicy,
    preparedAt,
    caseId,
    projectId,
    tenantId,
    actorId,
    identityContext,
    preparedBy,
    recordedBy,
  } = {}) {
    assertNoCallerAuthorityOverride({ caseId, projectId, tenantId, actorId, identityContext, preparedBy, recordedBy });
    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
    const auth = await authenticate(authorizationHeader, nowEpochSeconds);
    requireAuthorizedAction({
      identity: auth.identity,
      action: IC_RUNTIME_ACTION.PREPARE,
      policy: normalizedPolicy,
    });

    const projection = await decisionIntelligenceService.projectWorkspace({
      authorizationHeader,
      workspaceId: normalizedWorkspaceId,
      nowEpochSeconds,
      studyOrchestration,
      decisionQuality,
      evidenceRecords,
      assumptionRecords,
      aiOutputs,
    });

    if (projection.sourceContext.tenantId !== auth.identity.tenantId) {
      fail('AUTHENTICATED_TENANT_SCOPE_MISMATCH');
    }
    const sourceContext = projection.sourceContext;
    const dossier = buildCommitteeDecisionDossier({
      caseId: sourceContext.caseId,
      projectId: sourceContext.projectId,
      workspace: projection.decisionIntelligence,
      actionRegister,
      decisionThresholds,
      scenarioRisk,
      valuation,
      financial,
    });

    const baseResult = {
      sourceContext,
      dossier,
      preparedBy: auth.identity.actorId,
      runtimeState: {
        committeeCasePersisted: false,
        decisionRecordPersisted: false,
        individualVoterAuthenticationValidatedHere: false,
        committeeAuthorityValidatedExternally: false,
      },
      authority: {
        humanDecisionRequired: true,
        aiVotePermitted: false,
        automatedDecisionPermitted: false,
        professionalReportExternalIssuanceAuthorized: false,
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
      },
    };

    if (dossier.readyForHumanCommittee !== true) {
      return freeze({
        ...baseResult,
        status: IC_RUNTIME_STATUS.HOLD_DOSSIER,
        committeeCase: null,
      });
    }

    requiredObject(controlGate, 'controlGate');
    requiredObject(committeePolicy, 'committeePolicy');
    if (controlGate.caseId && controlGate.caseId !== sourceContext.caseId) fail('CONTROL_GATE_CASE_SCOPE_MISMATCH');
    if (controlGate.projectId && controlGate.projectId !== sourceContext.projectId) fail('CONTROL_GATE_PROJECT_SCOPE_MISMATCH');

    const committeeCase = createCommitteeCase({
      caseId: sourceContext.caseId,
      projectId: sourceContext.projectId,
      dossier,
      controlGate,
      policy: committeePolicy,
      preparedBy: auth.identity.actorId,
      preparedAt: requiredString(preparedAt, 'preparedAt'),
    });

    return freeze({
      ...baseResult,
      status: committeeCase.status === IC_CASE_STATUS.READY_FOR_COMMITTEE
        ? IC_RUNTIME_STATUS.READY_FOR_HUMAN_COMMITTEE
        : IC_RUNTIME_STATUS.HOLD_CONTROL_GATE,
      committeeCase,
    });
  }

  async function recordHumanDecision({
    authorizationHeader,
    workspaceId,
    nowEpochSeconds,
    preparedPackage,
    committeePolicy,
    attendance,
    votes,
    decision,
    conditions = [],
    rationale,
    decidedAt,
    dossierRef,
    recordedAt,
    caseId,
    projectId,
    tenantId,
    actorId,
    identityContext,
    preparedBy,
    recordedBy,
  } = {}) {
    assertNoCallerAuthorityOverride({ caseId, projectId, tenantId, actorId, identityContext, preparedBy, recordedBy });
    const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
    const auth = await authenticate(authorizationHeader, nowEpochSeconds);
    requireAuthorizedAction({
      identity: auth.identity,
      action: IC_RUNTIME_ACTION.RECORD_DECISION,
      policy: normalizedPolicy,
    });

    requiredObject(preparedPackage, 'preparedPackage');
    if (preparedPackage.status !== IC_RUNTIME_STATUS.READY_FOR_HUMAN_COMMITTEE) {
      fail('COMMITTEE_PACKAGE_NOT_READY');
    }
    const preparedSource = requiredObject(preparedPackage.sourceContext, 'preparedPackage.sourceContext');
    const committeeCase = requiredObject(preparedPackage.committeeCase, 'preparedPackage.committeeCase');

    const loaded = await workspaceService.loadWorkspace({
      authorizationHeader,
      workspaceId: normalizedWorkspaceId,
      nowEpochSeconds,
    });
    const currentSource = extractWorkspaceScope(loaded, normalizedWorkspaceId);

    if (auth.identity.tenantId !== currentSource.tenantId) fail('AUTHENTICATED_TENANT_SCOPE_MISMATCH');
    if (
      preparedSource.workspaceId !== currentSource.workspaceId
      || preparedSource.tenantId !== currentSource.tenantId
      || preparedSource.projectId !== currentSource.projectId
      || preparedSource.caseId !== currentSource.caseId
    ) {
      fail('COMMITTEE_PACKAGE_SCOPE_MISMATCH');
    }
    if (preparedSource.workspaceVersion !== currentSource.workspaceVersion) {
      fail('COMMITTEE_PACKAGE_STALE_WORKSPACE_VERSION');
    }
    if (committeeCase.caseId !== currentSource.caseId || committeeCase.projectId !== currentSource.projectId) {
      fail('COMMITTEE_CASE_SCOPE_MISMATCH');
    }

    assertPolicyMatchesCommitteeCase(committeePolicy, committeeCase);

    const committeeDecision = recordHumanCommitteeDecision({
      committeeCase,
      policy: committeePolicy,
      attendance,
      votes,
      decision,
      conditions,
      rationale,
      decidedAt,
      recordedBy: auth.identity.actorId,
    });

    if (committeeDecision.status !== IC_CASE_STATUS.DECIDED_BY_HUMANS) {
      return freeze({
        status: IC_RUNTIME_STATUS.HOLD_GOVERNANCE,
        sourceContext: currentSource,
        committeeDecision,
        decisionRecord: null,
        recordedBy: auth.identity.actorId,
        runtimeState: {
          decisionRecordPersisted: false,
          individualVoterAuthenticationValidatedHere: false,
          committeeAuthorityValidatedExternally: false,
        },
        authority: {
          humanDecisionRequired: true,
          aiVotePermitted: false,
          automatedDecisionPermitted: false,
          releaseAuthorized: false,
          mergeAuthorized: false,
          deploymentAuthorized: false,
          transactionAuthorized: false,
        },
      });
    }

    const decisionRecord = buildHumanCommitteeDecisionRecord({
      caseId: currentSource.caseId,
      projectId: currentSource.projectId,
      committeeDecision,
      dossierRef: requiredString(dossierRef, 'dossierRef'),
      recordedBy: auth.identity.actorId,
      recordedAt: requiredString(recordedAt, 'recordedAt'),
    });
    if (decisionRecord.status !== DECISION_RECORD_STATUS.RECORDED) {
      fail('HUMAN_DECISION_RECORD_NOT_RECORDED');
    }

    return freeze({
      status: IC_RUNTIME_STATUS.HUMAN_DECISION_RECORDED,
      sourceContext: currentSource,
      committeeDecision,
      decisionRecord,
      recordedBy: auth.identity.actorId,
      runtimeState: {
        decisionRecordPersisted: false,
        individualVoterAuthenticationValidatedHere: false,
        committeeAuthorityValidatedExternally: false,
      },
      authority: {
        humanDecisionRequired: false,
        humanDecisionConfirmed: true,
        aiVotePermitted: false,
        automatedDecisionPermitted: false,
        decisionActionAuthorized: false,
        executionActionCreated: false,
        professionalReportExternalIssuanceAuthorized: false,
        releaseAuthorized: false,
        mergeAuthorized: false,
        deploymentAuthorized: false,
        transactionAuthorized: false,
      },
    });
  }

  return Object.freeze({
    prepareCommitteeCase,
    recordHumanDecision,
    requiredTenantId: configuredTenantId,
    policy: normalizedPolicy,
    authority: Object.freeze({
      humanDecisionRequired: true,
      aiVotePermitted: false,
      automatedDecisionPermitted: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    }),
    semantics: 'This runtime binds authenticated canonical-workspace scope to Decision Intelligence and human investment-committee preparation/recording. Preparation is version-bound to the persisted workspace. Human committee decisions remain non-executing records; individual voter authentication, committee delegated authority, persistence of IC records, professional approvals, contracts, and transaction execution remain separate controlled workflows.',
  });
}

module.exports = {
  IC_RUNTIME_ACTION,
  IC_RUNTIME_STATUS,
  DEFAULT_IC_RUNTIME_POLICY,
  createAuthenticatedInvestmentCommitteeService,
};
