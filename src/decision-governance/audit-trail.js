'use strict';

const AUDIT_ACTION = Object.freeze({
  DEAL_CREATED: 'DEAL_CREATED', INPUT_CHANGED: 'INPUT_CHANGED', ASSUMPTION_CHANGED: 'ASSUMPTION_CHANGED',
  EVIDENCE_ADDED: 'EVIDENCE_ADDED', EVIDENCE_REMOVED: 'EVIDENCE_REMOVED', FINANCIAL_RECALCULATED: 'FINANCIAL_RECALCULATED',
  DECISION_CHANGED: 'DECISION_CHANGED', VERSION_SAVED: 'VERSION_SAVED', EXPORT_CREATED: 'EXPORT_CREATED',
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED', APPROVAL_GRANTED: 'APPROVAL_GRANTED', APPROVAL_REJECTED: 'APPROVAL_REJECTED',
});

function createAuditEvent(input = {}) {
  if (!input.dealId) throw new TypeError('dealId is required');
  if (!input.versionId) throw new TypeError('versionId is required');
  if (!Object.values(AUDIT_ACTION).includes(input.actionType)) throw new TypeError('valid actionType is required');
  if (!input.modelVersion) throw new TypeError('modelVersion is required');
  const timestamp = input.timestamp || new Date().toISOString();
  if (!Number.isFinite(new Date(timestamp).getTime())) throw new TypeError('timestamp must be valid');
  return Object.freeze({
    trailType: 'LOCAL_HISTORY',
    enterpriseAuditTrail: false,
    dealId: input.dealId,
    versionId: input.versionId,
    previousVersionId: input.previousVersionId || null,
    actorId: input.actorId || null,
    timestamp,
    actionType: input.actionType,
    changedFields: Object.freeze([...(input.changedFields || [])]),
    previousValues: Object.freeze({ ...(input.previousValues || {}) }),
    newValues: Object.freeze({ ...(input.newValues || {}) }),
    reason: input.reason || null,
    decisionBefore: input.decisionBefore || null,
    decisionAfter: input.decisionAfter || null,
    modelVersion: input.modelVersion,
    assumptionVersion: input.assumptionVersion || null,
  });
}

function validateAuditEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('audit event must be an object');
  if (event.trailType !== 'LOCAL_HISTORY') throw new TypeError('trailType must equal LOCAL_HISTORY');
  if (event.enterpriseAuditTrail !== false) throw new TypeError('enterpriseAuditTrail must be false for local history');
  if (typeof event.dealId !== 'string' || !event.dealId.trim()) throw new TypeError('dealId is required');
  if (typeof event.versionId !== 'string' || !event.versionId.trim()) throw new TypeError('versionId is required');
  if (!Object.values(AUDIT_ACTION).includes(event.actionType)) throw new TypeError('valid actionType is required');
  if (typeof event.modelVersion !== 'string' || !event.modelVersion.trim()) throw new TypeError('modelVersion is required');
  if (!Number.isFinite(new Date(event.timestamp).getTime())) throw new TypeError('timestamp must be valid');
  if (!Array.isArray(event.changedFields) || event.changedFields.some((field) => typeof field !== 'string')) {
    throw new TypeError('changedFields must be an array of strings');
  }
  if (!event.previousValues || typeof event.previousValues !== 'object' || Array.isArray(event.previousValues)) {
    throw new TypeError('previousValues must be an object');
  }
  if (!event.newValues || typeof event.newValues !== 'object' || Array.isArray(event.newValues)) {
    throw new TypeError('newValues must be an object');
  }
  return event;
}

module.exports = { AUDIT_ACTION, createAuditEvent, validateAuditEvent };
