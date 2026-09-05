'use strict';

const INTEGRATION_OPERATION = Object.freeze({
  READ: 'READ',
  INGEST: 'INGEST',
  PROPOSE_WRITE: 'PROPOSE_WRITE',
  EXPORT: 'EXPORT',
});

const INTEGRATION_WRITE_TARGET = Object.freeze({
  RAW_DOCUMENT: 'RAW_DOCUMENT',
  EXTRACTED_EVIDENCE: 'EXTRACTED_EVIDENCE',
  CANONICAL_INPUT: 'CANONICAL_INPUT',
  AI_INTERPRETATION: 'AI_INTERPRETATION',
  OPERATIONAL_STATE: 'OPERATIONAL_STATE',
});

const FORBIDDEN_DIRECT_WRITE_TARGET = Object.freeze({
  VERIFIED_FACT: 'VERIFIED_FACT',
  DETERMINISTIC_OUTPUT: 'DETERMINISTIC_OUTPUT',
  DECISION_CONTROL: 'DECISION_CONTROL',
  FINAL_INVESTMENT_DECISION: 'FINAL_INVESTMENT_DECISION',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clonePlainData(value, path = 'payload', seen = new Set()) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (value === undefined) return undefined;
  if (typeof value !== 'object') throw new TypeError(`${path} must contain JSON-like data only`);
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  let clone;
  if (Array.isArray(value)) {
    clone = value.map((item, index) => clonePlainData(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must contain plain objects only`);
    }
    clone = {};
    for (const [key, child] of Object.entries(value)) {
      clone[key] = clonePlainData(child, `${path}.${key}`, seen);
    }
  }

  seen.delete(value);
  return clone;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requireEnum(value, enumObject, field) {
  if (!Object.values(enumObject).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(enumObject).join(', ')}`);
  }
  return value;
}

function normalizeIsoTimestamp(value, field) {
  requireString(value, field);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function normalizeSha256(value, field = 'contentHashSha256') {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function assertScopedPayload(payload, caseId, projectId, path = 'payload', seen = new Set()) {
  if (!payload || typeof payload !== 'object') return;
  if (seen.has(payload)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(payload);

  if (!Array.isArray(payload)) {
    if (Object.prototype.hasOwnProperty.call(payload, 'caseId') && payload.caseId !== caseId) {
      const error = new Error(`${path}.caseId does not match integration envelope caseId`);
      error.code = 'INTEGRATION_SCOPE_MISMATCH';
      throw error;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'projectId') && payload.projectId !== projectId) {
      const error = new Error(`${path}.projectId does not match integration envelope projectId`);
      error.code = 'INTEGRATION_SCOPE_MISMATCH';
      throw error;
    }
  }

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      assertScopedPayload(payload[i], caseId, projectId, `${path}[${i}]`, seen);
    }
  } else {
    for (const [key, value] of Object.entries(payload)) {
      if (value && typeof value === 'object') {
        assertScopedPayload(value, caseId, projectId, `${path}.${key}`, seen);
      }
    }
  }
  seen.delete(payload);
}

function normalizeWriteTarget(operation, writeTarget) {
  if (operation !== INTEGRATION_OPERATION.PROPOSE_WRITE) {
    if (writeTarget !== undefined && writeTarget !== null) {
      throw new TypeError('writeTarget is only allowed for PROPOSE_WRITE operations');
    }
    return null;
  }

  if (Object.values(FORBIDDEN_DIRECT_WRITE_TARGET).includes(writeTarget)) {
    const error = new Error(`Integration adapters may not propose direct writes to ${writeTarget}`);
    error.code = 'FORBIDDEN_INTEGRATION_WRITE_TARGET';
    throw error;
  }
  return requireEnum(writeTarget, INTEGRATION_WRITE_TARGET, 'writeTarget');
}

function createIntegrationEnvelope({
  adapterId,
  operation,
  caseId,
  projectId,
  sourceSystem,
  sourceObjectId,
  sourceVersion,
  observedAt,
  payload,
  contentHashSha256,
  requestedBy,
  writeTarget = null,
} = {}) {
  const normalizedOperation = requireEnum(operation, INTEGRATION_OPERATION, 'operation');
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  const rawPayload = requireObject(payload, 'payload');

  assertScopedPayload(rawPayload, normalizedCaseId, normalizedProjectId);
  const normalizedPayload = clonePlainData(rawPayload);

  const normalizedWriteTarget = normalizeWriteTarget(normalizedOperation, writeTarget);
  const humanApprovalRequired = normalizedOperation === INTEGRATION_OPERATION.PROPOSE_WRITE;

  return deepFreeze({
    schemaVersion: 1,
    adapterId: requireString(adapterId, 'adapterId'),
    operation: normalizedOperation,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    sourceSystem: requireString(sourceSystem, 'sourceSystem'),
    sourceObjectId: requireString(sourceObjectId, 'sourceObjectId'),
    sourceVersion: requireString(sourceVersion, 'sourceVersion'),
    observedAt: normalizeIsoTimestamp(observedAt, 'observedAt'),
    payload: normalizedPayload,
    contentHashSha256: normalizeSha256(contentHashSha256),
    requestedBy: requireString(requestedBy, 'requestedBy'),
    writeTarget: normalizedWriteTarget,
    humanApprovalRequired,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'This immutable envelope binds an external integration operation to one STARTAK case/project scope. PROPOSE_WRITE is a proposal only and never grants direct authority over verified facts, deterministic outputs, decision-control state, or final investment decisions.',
  });
}

module.exports = {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
  FORBIDDEN_DIRECT_WRITE_TARGET,
  createIntegrationEnvelope,
  assertScopedPayload,
};
