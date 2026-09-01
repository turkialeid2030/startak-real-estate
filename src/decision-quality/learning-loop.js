'use strict';

const { OUTCOME_FEEDBACK_STATUS } = require('./outcome-feedback');

const LEARNING_STATUS = Object.freeze({
  READY_FOR_LEARNING_REVIEW: 'READY_FOR_LEARNING_REVIEW',
  HOLD_OUTCOME_FEEDBACK: 'HOLD_OUTCOME_FEEDBACK',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildDecisionLearningReview({ caseId, projectId, outcomeFeedback } = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(outcomeFeedback, 'outcomeFeedback');

  if (outcomeFeedback.caseId !== scopedCaseId || outcomeFeedback.projectId !== scopedProjectId) {
    const error = new Error('LEARNING_SCOPE_MISMATCH');
    error.code = LEARNING_STATUS.HOLD_SCOPE_MISMATCH;
    throw error;
  }

  if (outcomeFeedback.status !== OUTCOME_FEEDBACK_STATUS.READY_FOR_REVIEW) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: LEARNING_STATUS.HOLD_OUTCOME_FEEDBACK,
      reasonCodes: Object.freeze([`OUTCOME_${String(outcomeFeedback.status || 'UNKNOWN')}`]),
      learningCandidateCount: 0,
      transactionAuthorized: false,
    });
  }

  const candidates = (outcomeFeedback.comparisons || []).map((item) => Object.freeze({
    id: item.id,
    label: item.label,
    plannedValue: item.plannedValue,
    actualValue: item.actualValue,
    materialVariance: item.materialVariance === true,
    evidenceRef: item.evidenceRef || outcomeFeedback.outcomeSnapshot?.evidenceRef || null,
    explanation: item.explanation || null,
    requiresHumanInterpretation: true,
  }));

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status: LEARNING_STATUS.READY_FOR_LEARNING_REVIEW,
    decisionRef: outcomeFeedback.decisionRef || null,
    decision: outcomeFeedback.decision || null,
    reanalysisRequired: outcomeFeedback.reanalysisRequired === true,
    learningCandidates: Object.freeze(candidates),
    learningCandidateCount: candidates.length,
    materialLearningCandidateCount: candidates.filter((item) => item.materialVariance).length,
    requiredActions: outcomeFeedback.requiredActions || null,
    mayUpdatePolicyAutomatically: false,
    mayUpdateModelAutomatically: false,
    mayRewritePriorDecision: false,
    humanInterpretationRequired: true,
    transactionAuthorized: false,
    semantics: 'This learning review preserves verified outcome comparisons as human-review candidates. It does not infer causality, auto-tune models or policies, rewrite the prior decision, or authorize a transaction.',
  });
}

module.exports = {
  LEARNING_STATUS,
  buildDecisionLearningReview,
};
