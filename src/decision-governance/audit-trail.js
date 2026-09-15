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

module.exports = { AUDIT_ACTION, createAuditEvent };
