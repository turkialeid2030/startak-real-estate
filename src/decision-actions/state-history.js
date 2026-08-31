'use strict';

const { ACTION_STATUS } = require('./index');

const ACTION_EVENT_TYPE = Object.freeze({
  CREATED: 'CREATED',
  STARTED: 'STARTED',
  BLOCKED: 'BLOCKED',
  EVIDENCE_SATISFIED: 'EVIDENCE_SATISFIED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [ACTION_STATUS.OPEN]: Object.freeze([ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.BLOCKED]),
  [ACTION_STATUS.IN_PROGRESS]: Object.freeze([ACTION_STATUS.BLOCKED, ACTION_STATUS.SATISFIED_PENDING_REVIEW]),
  [ACTION_STATUS.BLOCKED]: Object.freeze([ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.SATISFIED_PENDING_REVIEW]),
  [ACTION_STATUS.SATISFIED_PENDING_REVIEW]: Object.freeze([ACTION_STATUS.CLOSED, ACTION_STATUS.BLOCKED]),
  [ACTION_STATUS.CLOSED]: Object.freeze([ACTION_STATUS.BLOCKED]),
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function eventTypeForTransition(fromStatus, toStatus) {
  if (fromStatus === null && toStatus === ACTION_STATUS.OPEN) return ACTION_EVENT_TYPE.CREATED;
  if (toStatus === ACTION_STATUS.IN_PROGRESS) return ACTION_EVENT_TYPE.STARTED;
  if (toStatus === ACTION_STATUS.BLOCKED) return fromStatus === ACTION_STATUS.CLOSED ? ACTION_EVENT_TYPE.REOPENED : ACTION_EVENT_TYPE.BLOCKED;
  if (toStatus === ACTION_STATUS.SATISFIED_PENDING_REVIEW) return ACTION_EVENT_TYPE.EVIDENCE_SATISFIED;
  if (toStatus === ACTION_STATUS.CLOSED) return ACTION_EVENT_TYPE.CLOSED;
  throw new Error(`UNMAPPED_ACTION_TRANSITION: ${fromStatus} -> ${toStatus}`);
}

function createActionStateHistory({ action, actorId, occurredAt }) {
  if (!action || typeof action !== 'object') throw new TypeError('action is required');
  requiredString(action.actionId, 'action.actionId');
  requiredString(action.caseId, 'action.caseId');
  requiredString(action.projectId, 'action.projectId');
  requiredString(actorId, 'actorId');
  requiredString(occurredAt, 'occurredAt');
  if (action.status !== ACTION_STATUS.OPEN) throw new Error('ACTION_HISTORY_MUST_START_OPEN');

  const event = freeze({
    sequence: 1,
    eventType: ACTION_EVENT_TYPE.CREATED,
    fromStatus: null,
    toStatus: ACTION_STATUS.OPEN,
    actorId,
    occurredAt,
    reasonCode: 'ACTION_CREATED',
    evidenceRefs: [],
    professionalReviewRef: null,
  });

  return freeze({
    schemaVersion: 1,
    actionId: action.actionId,
    caseId: action.caseId,
    projectId: action.projectId,
    currentStatus: ACTION_STATUS.OPEN,
    events: [event],
    transactionAuthorized: false,
  });
}

function transitionActionState({
  history,
  toStatus,
  actorId,
  occurredAt,
  reasonCode,
  evidenceRefs = [],
  professionalReviewRef = null,
}) {
  if (!history || typeof history !== 'object') throw new TypeError('history is required');
  if (!Object.values(ACTION_STATUS).includes(toStatus)) throw new TypeError(`invalid action status: ${toStatus}`);
  requiredString(actorId, 'actorId');
  requiredString(occurredAt, 'occurredAt');
  requiredString(reasonCode, 'reasonCode');
  if (!Array.isArray(evidenceRefs)) throw new TypeError('evidenceRefs must be an array');

  const fromStatus = history.currentStatus;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) throw new Error(`ILLEGAL_ACTION_STATE_TRANSITION: ${fromStatus} -> ${toStatus}`);

  if (toStatus === ACTION_STATUS.CLOSED && evidenceRefs.length === 0 && !professionalReviewRef) {
    throw new Error('ACTION_CLOSE_REQUIRES_EVIDENCE_OR_PROFESSIONAL_REVIEW_REF');
  }
  if (fromStatus === ACTION_STATUS.CLOSED && toStatus === ACTION_STATUS.BLOCKED && evidenceRefs.length === 0) {
    throw new Error('ACTION_REOPEN_REQUIRES_EVIDENCE_REVOCATION_REF');
  }

  const event = freeze({
    sequence: history.events.length + 1,
    eventType: eventTypeForTransition(fromStatus, toStatus),
    fromStatus,
    toStatus,
    actorId,
    occurredAt,
    reasonCode,
    evidenceRefs: evidenceRefs.map(String),
    professionalReviewRef: professionalReviewRef == null ? null : String(professionalReviewRef),
  });

  return freeze({
    schemaVersion: 1,
    actionId: history.actionId,
    caseId: history.caseId,
    projectId: history.projectId,
    currentStatus: toStatus,
    events: [...history.events, event],
    transactionAuthorized: false,
  });
}

function buildStatefulActionRegister({ caseId, projectId, actionHistories }) {
  requiredString(caseId, 'caseId');
  requiredString(projectId, 'projectId');
  if (!Array.isArray(actionHistories)) throw new TypeError('actionHistories must be an array');

  const ids = new Set();
  for (const history of actionHistories) {
    if (!history || history.caseId !== caseId || history.projectId !== projectId) throw new Error('ACTION_HISTORY_CASE_OR_PROJECT_ISOLATION_VIOLATION');
    if (ids.has(history.actionId)) throw new Error(`DUPLICATE_ACTION_HISTORY_ID: ${history.actionId}`);
    ids.add(history.actionId);
  }

  const counts = Object.fromEntries(Object.values(ACTION_STATUS).map((status) => [status, 0]));
  for (const history of actionHistories) counts[history.currentStatus] += 1;

  return freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    actionHistories: actionHistories.map((history) => history),
    counts,
    openCount: actionHistories.filter((history) => history.currentStatus !== ACTION_STATUS.CLOSED).length,
    closedCount: counts[ACTION_STATUS.CLOSED],
    allClosed: actionHistories.length > 0 && counts[ACTION_STATUS.CLOSED] === actionHistories.length,
    transactionAuthorized: false,
    semantics: 'The register is derived from immutable action event histories. Reopening a previously closed action is required when evidence is revoked or becomes stale; register state alone never authorizes a transaction.',
  });
}

module.exports = {
  ACTION_EVENT_TYPE,
  ALLOWED_TRANSITIONS,
  createActionStateHistory,
  transitionActionState,
  buildStatefulActionRegister,
};
