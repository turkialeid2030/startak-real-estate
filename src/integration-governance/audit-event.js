'use strict';

const AUDIT_EVENT_TYPE = Object.freeze({
  SOURCE_INGESTED: 'SOURCE_INGESTED',
  EVIDENCE_EXTRACTED: 'EVIDENCE_EXTRACTED',
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  WRITE_PROPOSED: 'WRITE_PROPOSED',
  WRITE_APPROVED: 'WRITE_APPROVED',
  WRITE_REJECTED: 'WRITE_REJECTED',
  WRITE_COMMITTED: 'WRITE_COMMITTED',
  EXPORT_CREATED: 'EXPORT_CREATED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
});

const AUDIT_ACTOR_TYPE = Object.freeze({
  HUMAN: 'HUMAN',
  SERVICE: 'SERVICE',
  SYSTEM: 'SYSTEM',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
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

function normalizeOptionalSha256(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function normalizeRefs(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(value.map((item) => requireString(String(item), field)))]);
}

function createIntegrationAuditEvent({
  eventId,
  eventType,
  occurredAt,
  actorType,
  actorId,
  caseId,
  projectId,
  action,
  reasonCode,
  correlationId,
  adapterId = null,
  toolId = null,
  sourceRefs = [],
  evidenceRefs = [],
  priorStateHashSha256 = null,
  newStateHashSha256 = null,
  schemaVersionRef,
  engineVersionRef = null,
  metadata = {},
} = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be an object');
  }

  const normalizedEventType = requireEnum(eventType, AUDIT_EVENT_TYPE, 'eventType');
  const normalizedActorType = requireEnum(actorType, AUDIT_ACTOR_TYPE, 'actorType');

  if ([AUDIT_EVENT_TYPE.WRITE_APPROVED, AUDIT_EVENT_TYPE.WRITE_REJECTED].includes(normalizedEventType)
    && normalizedActorType !== AUDIT_ACTOR_TYPE.HUMAN) {
    const error = new Error(`${normalizedEventType} requires a HUMAN actor`);
    error.code = 'HUMAN_AUDIT_ACTOR_REQUIRED';
    throw error;
  }

  return deepFreeze({
    schemaVersion: 1,
    eventId: requireString(eventId, 'eventId'),
    eventType: normalizedEventType,
    occurredAt: normalizeIsoTimestamp(occurredAt, 'occurredAt'),
    actorType: normalizedActorType,
    actorId: requireString(actorId, 'actorId'),
    caseId: requireString(caseId, 'caseId'),
    projectId: requireString(projectId, 'projectId'),
    action: requireString(action, 'action'),
    reasonCode: requireString(reasonCode, 'reasonCode'),
    correlationId: requireString(correlationId, 'correlationId'),
    adapterId: adapterId == null ? null : requireString(adapterId, 'adapterId'),
    toolId: toolId == null ? null : requireString(toolId, 'toolId'),
    sourceRefs: normalizeRefs(sourceRefs, 'sourceRefs'),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    priorStateHashSha256: normalizeOptionalSha256(priorStateHashSha256, 'priorStateHashSha256'),
    newStateHashSha256: normalizeOptionalSha256(newStateHashSha256, 'newStateHashSha256'),
    schemaVersionRef: requireString(schemaVersionRef, 'schemaVersionRef'),
    engineVersionRef: engineVersionRef == null ? null : requireString(engineVersionRef, 'engineVersionRef'),
    metadata: { ...metadata },
    transactionAuthorized: false,
    semantics: 'Immutable audit event for an attributable material integration or decision-state change. Approval/rejection events require a human actor. The audit record documents authority; it does not itself execute or authorize a transaction.',
  });
}

module.exports = {
  AUDIT_EVENT_TYPE,
  AUDIT_ACTOR_TYPE,
  createIntegrationAuditEvent,
};