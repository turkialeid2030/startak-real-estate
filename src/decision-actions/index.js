'use strict';

const ACTION_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  SATISFIED_PENDING_REVIEW: 'SATISFIED_PENDING_REVIEW',
  CLOSED: 'CLOSED',
});

const ACTION_TYPE = Object.freeze({
  EVIDENCE: 'EVIDENCE',
  LEGAL_REVIEW: 'LEGAL_REVIEW',
  REGULATORY: 'REGULATORY',
  VALUATION_REVIEW: 'VALUATION_REVIEW',
  TECHNICAL_DD: 'TECHNICAL_DD',
  COMMERCIAL: 'COMMERCIAL',
  FINANCING: 'FINANCING',
  GOVERNANCE: 'GOVERNANCE',
  OTHER: 'OTHER',
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

function createDecisionAction({
  actionId,
  caseId,
  projectId,
  type,
  description,
  ownerId,
  dueDate = null,
  requiresLicensedProfessional = false,
  requiredEvidenceKeys = [],
  sourceDecisionRef,
}) {
  requiredString(actionId, 'actionId');
  requiredString(caseId, 'caseId');
  requiredString(projectId, 'projectId');
  if (!Object.values(ACTION_TYPE).includes(type)) throw new TypeError(`invalid action type: ${type}`);
  requiredString(description, 'description');
  requiredString(ownerId, 'ownerId');
  requiredString(sourceDecisionRef, 'sourceDecisionRef');
  if (dueDate !== null) requiredString(dueDate, 'dueDate');
  if (!Array.isArray(requiredEvidenceKeys)) throw new TypeError('requiredEvidenceKeys must be an array');
  const evidenceKeys = requiredEvidenceKeys.map((key) => requiredString(key, 'requiredEvidenceKeys'));
  return freeze({
    schemaVersion: 1,
    actionId,
    caseId,
    projectId,
    type,
    description,
    ownerId,
    dueDate,
    requiresLicensedProfessional: Boolean(requiresLicensedProfessional),
    requiredEvidenceKeys: evidenceKeys,
    sourceDecisionRef,
    status: ACTION_STATUS.OPEN,
  });
}

function assessActionClosure({ action, evidence = {}, professionalReview = null, reviewerId = null, reviewedAt = null }) {
  if (!action || typeof action !== 'object') throw new TypeError('action is required');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('evidence must be an object');

  const missingEvidence = action.requiredEvidenceKeys.filter((key) => evidence[key] !== true);
  if (missingEvidence.length) {
    return freeze({
      actionId: action.actionId,
      status: ACTION_STATUS.BLOCKED,
      canClose: false,
      reason: 'REQUIRED_EVIDENCE_NOT_SATISFIED',
      missingEvidence,
    });
  }

  if (action.requiresLicensedProfessional) {
    if (!professionalReview || typeof professionalReview !== 'object') {
      return freeze({
        actionId: action.actionId,
        status: ACTION_STATUS.BLOCKED,
        canClose: false,
        reason: 'LICENSED_PROFESSIONAL_REVIEW_REQUIRED',
        missingEvidence: [],
      });
    }
    if (professionalReview.outcome !== 'SATISFIED') {
      return freeze({
        actionId: action.actionId,
        status: ACTION_STATUS.BLOCKED,
        canClose: false,
        reason: 'PROFESSIONAL_REVIEW_NOT_SATISFIED',
        missingEvidence: [],
      });
    }
    requiredString(professionalReview.professionalType, 'professionalReview.professionalType');
    requiredString(professionalReview.providerRef, 'professionalReview.providerRef');
  }

  if (!reviewerId || !reviewedAt) {
    return freeze({
      actionId: action.actionId,
      status: ACTION_STATUS.SATISFIED_PENDING_REVIEW,
      canClose: false,
      reason: 'HUMAN_CLOSURE_REVIEW_REQUIRED',
      missingEvidence: [],
    });
  }

  requiredString(reviewerId, 'reviewerId');
  requiredString(reviewedAt, 'reviewedAt');
  return freeze({
    actionId: action.actionId,
    status: ACTION_STATUS.CLOSED,
    canClose: true,
    reviewedBy: reviewerId,
    reviewedAt,
    professionalReviewRef: professionalReview ? professionalReview.providerRef : null,
    semantics: 'Action closure records evidence and human review. It does not itself authorize a transaction or certify legal/regulatory compliance.',
  });
}

function buildDecisionActionRegister({ caseId, projectId, actions }) {
  requiredString(caseId, 'caseId');
  requiredString(projectId, 'projectId');
  if (!Array.isArray(actions)) throw new TypeError('actions must be an array');
  const ids = new Set();
  for (const action of actions) {
    if (!action || action.caseId !== caseId || action.projectId !== projectId) throw new Error('ACTION_CASE_OR_PROJECT_ISOLATION_VIOLATION');
    if (ids.has(action.actionId)) throw new Error(`DUPLICATE_ACTION_ID: ${action.actionId}`);
    ids.add(action.actionId);
  }
  return freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    actions: actions.map((action) => action),
    openCount: actions.filter((action) => action.status !== ACTION_STATUS.CLOSED).length,
    transactionAuthorized: false,
  });
}

module.exports = {
  ACTION_STATUS,
  ACTION_TYPE,
  createDecisionAction,
  assessActionClosure,
  buildDecisionActionRegister,
};
