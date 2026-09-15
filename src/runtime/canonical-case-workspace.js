'use strict';

const {
  assembleExecutableInvestmentCase,
} = require('../project-model/executable-case-orchestrator');

const WORKSPACE_STATUS = Object.freeze({
  CASE_ASSEMBLED: 'CASE_ASSEMBLED',
  CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS: 'CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS',
});

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function createCanonicalCaseWorkspace({
  workspaceId,
  projectId,
  caseId,
  projectProfile,
  studyType,
  inputs,
  engineResult,
  verdict,
  domainOutputs = {},
  analyticalPackage = null,
  standardsContext = null,
  attribution = {},
}) {
  const normalizedWorkspaceId = requiredString(workspaceId, 'workspaceId');
  const normalizedProjectId = requiredString(projectId, 'projectId');
  const normalizedCaseId = requiredString(caseId, 'caseId');
  assertPlainObject(projectProfile, 'projectProfile');
  assertPlainObject(inputs, 'inputs');
  assertPlainObject(engineResult, 'engineResult');
  assertPlainObject(domainOutputs, 'domainOutputs');
  assertPlainObject(attribution, 'attribution');

  if (projectProfile.projectId !== normalizedProjectId) {
    const error = new Error('Project profile does not belong to the requested workspace project');
    error.code = 'WORKSPACE_PROJECT_ISOLATION_VIOLATION';
    throw error;
  }

  const assembled = assembleExecutableInvestmentCase({
    profile: projectProfile,
    caseId: normalizedCaseId,
    studyType,
    inputs,
    engineResult,
    verdict,
    domainOutputs,
    analyticalPackage,
    standardsContext,
  });

  const status = assembled.status === WORKSPACE_STATUS.CASE_ASSEMBLED
    ? WORKSPACE_STATUS.CASE_ASSEMBLED
    : WORKSPACE_STATUS.CASE_ASSEMBLED_WITH_LIFECYCLE_GAPS;

  return deepFreeze({
    schemaVersion: 1,
    workspaceId: normalizedWorkspaceId,
    projectId: normalizedProjectId,
    caseId: normalizedCaseId,
    status,
    attribution: {
      actorId: attribution.actorId || null,
      actorRole: attribution.actorRole || null,
      source: attribution.source || 'IN_APP',
    },
    executableCase: assembled.executableCase,
    orchestration: {
      status: assembled.status,
      unresolvedLifecycleSections: assembled.unresolvedLifecycleSections,
      reasonCodes: assembled.reasonCodes,
      boundaries: assembled.boundaries,
      humanDecisionRequired: assembled.humanDecisionRequired,
      transactionAuthorized: false,
    },
    authority: {
      operatingMode: assembled.executableCase.authority.operatingMode,
      professionalReportExternalIssuanceAuthorized: false,
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      transactionAuthorized: false,
    },
  });
}

module.exports = {
  WORKSPACE_STATUS,
  createCanonicalCaseWorkspace,
};
