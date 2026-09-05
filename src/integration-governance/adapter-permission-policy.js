'use strict';

const {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
} = require('./integration-envelope');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeUniqueEnumArray(value, enumObject, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  if (!allowEmpty && value.length === 0) throw new TypeError(`${field} must not be empty`);
  const allowed = new Set(Object.values(enumObject));
  const normalized = [];
  for (const item of value) {
    if (!allowed.has(item)) throw new TypeError(`${field} contains unsupported value: ${item}`);
    if (!normalized.includes(item)) normalized.push(item);
  }
  return Object.freeze(normalized);
}

function normalizeStringArray(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(value.map((item) => requireString(String(item), field)))]);
}

function createAdapterPermissionPolicy({
  policyId,
  adapterId,
  allowedOperations,
  allowedReadDomains = [],
  allowedWriteTargets = [],
  allowedSourceSystems = [],
  caseScope = null,
  projectScope = null,
  requireHumanApprovalForProposedWrites = true,
} = {}) {
  const operations = normalizeUniqueEnumArray(allowedOperations, INTEGRATION_OPERATION, 'allowedOperations');
  const writeTargets = normalizeUniqueEnumArray(allowedWriteTargets, INTEGRATION_WRITE_TARGET, 'allowedWriteTargets', { allowEmpty: true });

  if (operations.includes(INTEGRATION_OPERATION.PROPOSE_WRITE) && !requireHumanApprovalForProposedWrites) {
    const error = new Error('PROPOSE_WRITE permission must require human approval');
    error.code = 'HUMAN_APPROVAL_POLICY_REQUIRED';
    throw error;
  }

  if (!operations.includes(INTEGRATION_OPERATION.PROPOSE_WRITE) && writeTargets.length > 0) {
    throw new TypeError('allowedWriteTargets requires PROPOSE_WRITE in allowedOperations');
  }

  return deepFreeze({
    schemaVersion: 1,
    policyId: requireString(policyId, 'policyId'),
    adapterId: requireString(adapterId, 'adapterId'),
    allowedOperations: operations,
    allowedReadDomains: normalizeStringArray(allowedReadDomains, 'allowedReadDomains'),
    allowedWriteTargets: writeTargets,
    allowedSourceSystems: normalizeStringArray(allowedSourceSystems, 'allowedSourceSystems'),
    caseScope: caseScope == null ? null : requireString(caseScope, 'caseScope'),
    projectScope: projectScope == null ? null : requireString(projectScope, 'projectScope'),
    requireHumanApprovalForProposedWrites: true,
    directWriteAuthorized: false,
    transactionAuthorized: false,
  });
}

function evaluateAdapterPermission({ policy, envelope, domain = null } = {}) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy must be an object');
  if (!envelope || typeof envelope !== 'object') throw new TypeError('envelope must be an object');

  const reasonCodes = [];

  if (policy.adapterId !== envelope.adapterId) reasonCodes.push('ADAPTER_ID_MISMATCH');
  if (!policy.allowedOperations.includes(envelope.operation)) reasonCodes.push('OPERATION_NOT_ALLOWED');
  if (policy.caseScope && policy.caseScope !== envelope.caseId) reasonCodes.push('CASE_SCOPE_NOT_ALLOWED');
  if (policy.projectScope && policy.projectScope !== envelope.projectId) reasonCodes.push('PROJECT_SCOPE_NOT_ALLOWED');
  if (policy.allowedSourceSystems.length > 0 && !policy.allowedSourceSystems.includes(envelope.sourceSystem)) {
    reasonCodes.push('SOURCE_SYSTEM_NOT_ALLOWED');
  }

  if (envelope.operation === INTEGRATION_OPERATION.PROPOSE_WRITE) {
    if (!policy.allowedWriteTargets.includes(envelope.writeTarget)) reasonCodes.push('WRITE_TARGET_NOT_ALLOWED');
    if (envelope.humanApprovalRequired !== true || policy.requireHumanApprovalForProposedWrites !== true) {
      reasonCodes.push('HUMAN_APPROVAL_REQUIRED');
    }
  }

  if ([INTEGRATION_OPERATION.READ, INTEGRATION_OPERATION.EXPORT].includes(envelope.operation) && domain) {
    const normalizedDomain = requireString(domain, 'domain');
    if (policy.allowedReadDomains.length > 0 && !policy.allowedReadDomains.includes(normalizedDomain)) {
      reasonCodes.push('DOMAIN_NOT_ALLOWED');
    }
  }

  return deepFreeze({
    allowed: reasonCodes.length === 0,
    reasonCodes,
    adapterId: envelope.adapterId,
    operation: envelope.operation,
    caseId: envelope.caseId,
    projectId: envelope.projectId,
    writeTarget: envelope.writeTarget || null,
    humanApprovalStillRequired: envelope.operation === INTEGRATION_OPERATION.PROPOSE_WRITE,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'Permission evaluation only determines whether an adapter operation may proceed to the next governed step. It never grants direct write authority or transaction authority.',
  });
}

module.exports = {
  createAdapterPermissionPolicy,
  evaluateAdapterPermission,
};