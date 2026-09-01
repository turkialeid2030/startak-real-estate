'use strict';

const { ACTION_STATUS } = require('./index');

const REVIEW_WORKFLOW_STATUS = Object.freeze({
  READY_FOR_ACTION_REVIEW: 'READY_FOR_ACTION_REVIEW',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_MISSING_HISTORY: 'HOLD_MISSING_HISTORY',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_PROFESSIONAL_REVIEW: 'HOLD_PROFESSIONAL_REVIEW',
  READY_FOR_HUMAN_CLOSURE: 'READY_FOR_HUMAN_CLOSURE',
  CLOSED: 'CLOSED',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildDecisionActionReviewWorkflow({
  caseId,
  projectId,
  action,
  history,
  evidenceState = {},
  professionalReview = null,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(action, 'action');
  requiredObject(history, 'history');
  requiredObject(evidenceState, 'evidenceState');

  if (action.caseId !== scopedCaseId || action.projectId !== scopedProjectId
    || history.caseId !== scopedCaseId || history.projectId !== scopedProjectId
    || history.actionId !== action.actionId) {
    const error = new Error('ACTION_REVIEW_SCOPE_MISMATCH');
    error.code = REVIEW_WORKFLOW_STATUS.HOLD_SCOPE_MISMATCH;
    throw error;
  }

  const requiredEvidenceKeys = Array.isArray(action.requiredEvidenceKeys) ? action.requiredEvidenceKeys : [];
  const missingEvidenceKeys = requiredEvidenceKeys.filter((key) => evidenceState[key] !== true);
  const needsProfessionalReview = action.requiresLicensedProfessional === true;
  const professionalReviewSatisfied = !needsProfessionalReview
    || (professionalReview && professionalReview.outcome === 'SATISFIED'
      && typeof professionalReview.professionalType === 'string'
      && professionalReview.professionalType.trim()
      && typeof professionalReview.providerRef === 'string'
      && professionalReview.providerRef.trim());

  let status = REVIEW_WORKFLOW_STATUS.READY_FOR_ACTION_REVIEW;
  const reasonCodes = [];

  if (history.currentStatus === ACTION_STATUS.CLOSED) {
    status = REVIEW_WORKFLOW_STATUS.CLOSED;
  } else if (missingEvidenceKeys.length) {
    status = REVIEW_WORKFLOW_STATUS.HOLD_EVIDENCE;
    reasonCodes.push('REQUIRED_EVIDENCE_NOT_SATISFIED');
  } else if (!professionalReviewSatisfied) {
    status = REVIEW_WORKFLOW_STATUS.HOLD_PROFESSIONAL_REVIEW;
    reasonCodes.push('LICENSED_PROFESSIONAL_REVIEW_REQUIRED');
  } else {
    status = REVIEW_WORKFLOW_STATUS.READY_FOR_HUMAN_CLOSURE;
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    actionId: action.actionId,
    actionType: action.type,
    currentStatus: history.currentStatus,
    workflowStatus: status,
    reasonCodes: Object.freeze(reasonCodes),
    missingEvidenceKeys: Object.freeze(missingEvidenceKeys),
    requiresLicensedProfessional: needsProfessionalReview,
    professionalReviewSatisfied: Boolean(professionalReviewSatisfied),
    canRequestHumanClosure: status === REVIEW_WORKFLOW_STATUS.READY_FOR_HUMAN_CLOSURE,
    canReopen: history.currentStatus === ACTION_STATUS.CLOSED,
    allowedNextStatuses: Object.freeze((() => {
      if (status === REVIEW_WORKFLOW_STATUS.CLOSED) return [ACTION_STATUS.BLOCKED];
      if (status === REVIEW_WORKFLOW_STATUS.HOLD_EVIDENCE || status === REVIEW_WORKFLOW_STATUS.HOLD_PROFESSIONAL_REVIEW) {
        return history.currentStatus === ACTION_STATUS.OPEN ? [ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.BLOCKED] : [ACTION_STATUS.BLOCKED];
      }
      if (history.currentStatus === ACTION_STATUS.OPEN) return [ACTION_STATUS.IN_PROGRESS];
      if ([ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.BLOCKED].includes(history.currentStatus)) return [ACTION_STATUS.SATISFIED_PENDING_REVIEW];
      if (history.currentStatus === ACTION_STATUS.SATISFIED_PENDING_REVIEW) return [ACTION_STATUS.CLOSED];
      return [];
    })()),
    humanClosureRequired: true,
    transactionAuthorized: false,
    semantics: 'This workflow projects whether a governed decision action has sufficient evidence and professional review to proceed toward human closure. It does not mutate state, approve a transaction, or replace the immutable action-history transition rules.',
  });
}

function buildDecisionActionReviewRegister({ caseId, projectId, actions, actionHistories, evidenceByActionId = {}, professionalReviewByActionId = {} } = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  if (!Array.isArray(actions)) throw new TypeError('actions must be an array');
  if (!Array.isArray(actionHistories)) throw new TypeError('actionHistories must be an array');
  requiredObject(evidenceByActionId, 'evidenceByActionId');
  requiredObject(professionalReviewByActionId, 'professionalReviewByActionId');

  const histories = new Map(actionHistories.map((item) => [item.actionId, item]));
  const workflows = [];
  for (const action of actions) {
    const history = histories.get(action.actionId);
    if (!history) throw new Error(`MISSING_ACTION_HISTORY: ${action.actionId}`);
    workflows.push(buildDecisionActionReviewWorkflow({
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      action,
      history,
      evidenceState: evidenceByActionId[action.actionId] || {},
      professionalReview: professionalReviewByActionId[action.actionId] || null,
    }));
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    workflows: Object.freeze(workflows),
    readyForHumanClosureCount: workflows.filter((item) => item.canRequestHumanClosure).length,
    blockedCount: workflows.filter((item) => [REVIEW_WORKFLOW_STATUS.HOLD_EVIDENCE, REVIEW_WORKFLOW_STATUS.HOLD_PROFESSIONAL_REVIEW].includes(item.workflowStatus)).length,
    closedCount: workflows.filter((item) => item.workflowStatus === REVIEW_WORKFLOW_STATUS.CLOSED).length,
    allClosed: workflows.length > 0 && workflows.every((item) => item.workflowStatus === REVIEW_WORKFLOW_STATUS.CLOSED),
    transactionAuthorized: false,
  });
}

module.exports = {
  REVIEW_WORKFLOW_STATUS,
  buildDecisionActionReviewWorkflow,
  buildDecisionActionReviewRegister,
};
