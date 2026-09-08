'use strict';

const {
  buildDecisionActionReviewRegister,
} = require('../decision-actions/review-workflow');
const {
  OUTCOME_FEEDBACK_STATUS,
  buildOutcomeFeedback,
} = require('../decision-quality/outcome-feedback');
const {
  LEARNING_STATUS,
  buildDecisionLearningReview,
} = require('../decision-quality/learning-loop');

const POST_DECISION_STATUS = Object.freeze({
  HOLD_COMMITTEE_DECISION: 'HOLD_COMMITTEE_DECISION',
  HOLD_ACTION_REGISTER: 'HOLD_ACTION_REGISTER',
  HOLD_ACTION_HISTORY: 'HOLD_ACTION_HISTORY',
  HOLD_ACTION_REVIEW: 'HOLD_ACTION_REVIEW',
  HOLD_OUTCOME_EVIDENCE: 'HOLD_OUTCOME_EVIDENCE',
  HOLD_OUTCOME_REVIEW: 'HOLD_OUTCOME_REVIEW',
  READY_FOR_LEARNING_REVIEW: 'READY_FOR_LEARNING_REVIEW',
});

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertScope(value, { projectId, caseId, field }) {
  requiredObject(value, field);
  if (value.projectId !== projectId || value.caseId !== caseId) {
    const error = new Error(`${field.toUpperCase()}_SCOPE_MISMATCH`);
    error.code = 'POST_DECISION_SCOPE_MISMATCH';
    throw error;
  }
}

function authorityBoundary() {
  return {
    professionalValuationAuthorityEstablished: false,
    legalApprovalEstablished: false,
    standardsConformanceEstablished: false,
    automatedPolicyUpdateAuthorized: false,
    automatedModelUpdateAuthorized: false,
    automatedRuleActivationAuthorized: false,
    priorDecisionRewriteAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };
}

function heldEnvelope({
  projectId,
  caseId,
  status,
  reasonCodes,
  decisionRecord = null,
  actionReviewRegister = null,
  outcomeFeedback = null,
  learningReview = null,
}) {
  return deepFreeze({
    schemaVersion: 1,
    projectId,
    caseId,
    status,
    reasonCodes: [...reasonCodes],
    decisionRecord,
    actionReviewRegister,
    outcomeFeedback,
    learningReview,
    authority: authorityBoundary(),
    humanReviewRequired: true,
    transactionAuthorized: false,
    semantics: 'Post-decision governance remains fail-closed. Missing committee, action-review or verified outcome records hold the pipeline; no missing record is inferred and no transaction, policy, model, standard or prior decision is changed automatically.',
  });
}

/**
 * Assemble the controlled post-decision governance path:
 * human committee record -> action review -> verified outcome feedback ->
 * learning-review candidates.
 *
 * This function is deliberately non-mutating. It consumes caller-supplied,
 * scoped records and delegates to the already-qualified action review, outcome
 * feedback and learning-loop engines. It never creates a committee decision,
 * closes an action, verifies an outcome, infers causality, tunes a model or
 * activates a policy/standard.
 */
function buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord = null,
  actionRegister = null,
  actionHistories = [],
  evidenceByActionId = {},
  professionalReviewByActionId = {},
  outcomeSnapshot = null,
  comparisonItems = [],
} = {}) {
  requiredObject(canonicalWorkspace, 'canonicalWorkspace');
  const projectId = requiredString(canonicalWorkspace.projectId, 'canonicalWorkspace.projectId');
  const caseId = requiredString(canonicalWorkspace.caseId, 'canonicalWorkspace.caseId');
  if (!Array.isArray(actionHistories)) throw new TypeError('actionHistories must be an array');
  requiredObject(evidenceByActionId, 'evidenceByActionId');
  requiredObject(professionalReviewByActionId, 'professionalReviewByActionId');
  if (!Array.isArray(comparisonItems)) throw new TypeError('comparisonItems must be an array');

  if (!decisionRecord || typeof decisionRecord !== 'object' || Array.isArray(decisionRecord)
    || decisionRecord.humanDecisionConfirmed !== true
    || decisionRecord.automatedDecision === true) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_COMMITTEE_DECISION,
      reasonCodes: ['RECORDED_HUMAN_COMMITTEE_DECISION_REQUIRED'],
    });
  }
  assertScope(decisionRecord, { projectId, caseId, field: 'decisionRecord' });

  if (!actionRegister || typeof actionRegister !== 'object' || Array.isArray(actionRegister)) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_ACTION_REGISTER,
      reasonCodes: ['SCOPED_DECISION_ACTION_REGISTER_REQUIRED'],
      decisionRecord,
    });
  }
  assertScope(actionRegister, { projectId, caseId, field: 'actionRegister' });

  const actions = Array.isArray(actionRegister.actions) ? actionRegister.actions : [];
  const actionIds = new Set(actions.map((action) => String(action.actionId)));
  const historyById = new Map(actionHistories.map((history) => [String(history?.actionId || ''), history]));
  const missingHistoryIds = [...actionIds].filter((id) => !historyById.has(id));
  if (missingHistoryIds.length) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_ACTION_HISTORY,
      reasonCodes: missingHistoryIds.map((id) => `MISSING_ACTION_HISTORY:${id}`),
      decisionRecord,
    });
  }

  for (const history of actionHistories) {
    assertScope(history, { projectId, caseId, field: 'actionHistory' });
    if (!actionIds.has(String(history.actionId))) {
      const error = new Error(`ACTION_HISTORY_WITHOUT_REGISTERED_ACTION:${history.actionId}`);
      error.code = 'POST_DECISION_ACTION_HISTORY_MISMATCH';
      throw error;
    }
  }

  const actionReviewRegister = buildDecisionActionReviewRegister({
    caseId,
    projectId,
    actions,
    actionHistories,
    evidenceByActionId,
    professionalReviewByActionId,
  });
  const actionReviewComplete = actions.length === 0 || actionReviewRegister.allClosed === true;
  if (!actionReviewComplete) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_ACTION_REVIEW,
      reasonCodes: ['DECISION_ACTIONS_REQUIRE_GOVERNED_HUMAN_CLOSURE'],
      decisionRecord,
      actionReviewRegister,
    });
  }

  if (!outcomeSnapshot || typeof outcomeSnapshot !== 'object' || Array.isArray(outcomeSnapshot)) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_OUTCOME_EVIDENCE,
      reasonCodes: ['VERIFIED_OUTCOME_SNAPSHOT_REQUIRED'],
      decisionRecord,
      actionReviewRegister,
    });
  }

  const outcomeFeedback = buildOutcomeFeedback({
    caseId,
    projectId,
    decisionRecord,
    outcomeSnapshot,
    comparisonItems,
  });
  if (outcomeFeedback.status !== OUTCOME_FEEDBACK_STATUS.READY_FOR_REVIEW) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_OUTCOME_REVIEW,
      reasonCodes: [...(outcomeFeedback.reasonCodes || [`OUTCOME_${String(outcomeFeedback.status || 'UNKNOWN')}`])],
      decisionRecord,
      actionReviewRegister,
      outcomeFeedback,
    });
  }

  const learningReview = buildDecisionLearningReview({
    caseId,
    projectId,
    outcomeFeedback,
  });
  if (learningReview.status !== LEARNING_STATUS.READY_FOR_LEARNING_REVIEW) {
    return heldEnvelope({
      projectId,
      caseId,
      status: POST_DECISION_STATUS.HOLD_OUTCOME_REVIEW,
      reasonCodes: [...(learningReview.reasonCodes || [`LEARNING_${String(learningReview.status || 'UNKNOWN')}`])],
      decisionRecord,
      actionReviewRegister,
      outcomeFeedback,
      learningReview,
    });
  }

  return deepFreeze({
    schemaVersion: 1,
    projectId,
    caseId,
    status: POST_DECISION_STATUS.READY_FOR_LEARNING_REVIEW,
    reasonCodes: [],
    decisionRecord,
    actionReviewRegister,
    outcomeFeedback,
    learningReview,
    authority: authorityBoundary(),
    humanReviewRequired: true,
    learningApplicationStatus: 'PROPOSAL_ONLY_REQUIRES_HUMAN_GOVERNANCE',
    transactionAuthorized: false,
    semantics: 'Verified outcome comparisons are exposed as learning-review candidates only. Causality, policy/model changes, standards/rule activation and prior-decision rewrites require separate governed human processes and are never automatic here.',
  });
}

module.exports = {
  POST_DECISION_STATUS,
  buildPostDecisionGovernanceWorkspace,
};
