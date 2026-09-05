'use strict';

const { evaluateXlsxDependencyCandidate } = require('./dependency-policy');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireSha256(value, field) {
  const normalized = requireString(value, field);
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    const error = new Error(`${field} must be a SHA-256 hex digest`);
    error.code = 'XLSX_SOURCE_SHA256_INVALID';
    throw error;
  }
  return normalized.toLowerCase();
}

function authorizeXlsxPassiveParserInvocation({
  dependencyCandidate,
  preflightResult,
  caseId,
  projectId,
  sourceHashSha256,
  parserProfileId,
  parserProfileVersion,
} = {}) {
  const dependencyReview = evaluateXlsxDependencyCandidate(dependencyCandidate);
  if (!dependencyReview.parserInvocationAuthorized) {
    const error = new Error('XLSX dependency has not passed the IA-6 dependency approval gate');
    error.code = 'XLSX_DEPENDENCY_NOT_APPROVED';
    error.dependencyDecision = dependencyReview.decision;
    error.reasonCodes = [...dependencyReview.reasonCodes];
    throw error;
  }

  if (!preflightResult || typeof preflightResult !== 'object') {
    const error = new Error('XLSX OPC preflight result is required');
    error.code = 'XLSX_PREFLIGHT_REQUIRED';
    throw error;
  }

  if (preflightResult.status !== 'READY_FOR_PASSIVE_PARSER' || preflightResult.parserInvocationAuthorized !== true) {
    const error = new Error('XLSX OPC preflight has not authorized passive parser invocation');
    error.code = 'XLSX_PREFLIGHT_NOT_READY';
    throw error;
  }

  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  const normalizedHash = requireSha256(sourceHashSha256, 'sourceHashSha256');
  const normalizedProfileId = requireString(parserProfileId, 'parserProfileId');
  const normalizedProfileVersion = requireString(parserProfileVersion, 'parserProfileVersion');

  return deepFreeze({
    schemaVersion: 1,
    status: 'PASSIVE_PARSER_INVOCATION_AUTHORIZED',
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    sourceHashSha256: normalizedHash,
    parserProfileId: normalizedProfileId,
    parserProfileVersion: normalizedProfileVersion,
    dependencyReview,
    preflightVersion: preflightResult.preflightVersion,
    parserInvocationAuthorized: true,
    formulaEvaluationAuthorized: false,
    macroExecutionAuthorized: false,
    externalLinkResolutionAuthorized: false,
    sourceAuthorityPromoted: false,
    evidenceVerified: false,
    canonicalMutationPerformed: false,
    transactionAuthorized: false,
  });
}

module.exports = {
  authorizeXlsxPassiveParserInvocation,
};
