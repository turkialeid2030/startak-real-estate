'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ACTION_STATUS, ACTION_TYPE, createDecisionAction } = require('../../src/decision-actions');
const { createActionStateHistory, transitionActionState } = require('../../src/decision-actions/state-history');
const {
  REVIEW_WORKFLOW_STATUS,
  buildDecisionActionReviewWorkflow,
  buildDecisionActionReviewRegister,
} = require('../../src/decision-actions/review-workflow');

function baselineAction() {
  return createDecisionAction({
    actionId: 'action-1',
    caseId: 'case-1',
    projectId: 'project-1',
    type: ACTION_TYPE.EVIDENCE,
    description: 'Resolve title evidence gap',
    ownerId: 'owner-1',
    requiredEvidenceKeys: ['title_verified'],
    sourceDecisionRef: 'dd-1',
  });
}

(function evidenceHoldFailsClosed() {
  const action = baselineAction();
  const history = createActionStateHistory({ action, actorId: 'actor-1', occurredAt: '2026-09-01T10:00:00Z' });
  const result = buildDecisionActionReviewWorkflow({
    caseId: action.caseId,
    projectId: action.projectId,
    action,
    history,
    evidenceState: { title_verified: false },
  });
  assert.strictEqual(result.workflowStatus, REVIEW_WORKFLOW_STATUS.HOLD_EVIDENCE);
  assert.strictEqual(result.canRequestHumanClosure, false);
  assert(result.missingEvidenceKeys.includes('title_verified'));
})();

(function evidenceSatisfiedMovesTowardHumanClosure() {
  const action = baselineAction();
  let history = createActionStateHistory({ action, actorId: 'actor-1', occurredAt: '2026-09-01T10:00:00Z' });
  history = transitionActionState({ history, toStatus: ACTION_STATUS.IN_PROGRESS, actorId: 'actor-1', occurredAt: '2026-09-01T10:01:00Z', reasonCode: 'WORK_STARTED' });
  const result = buildDecisionActionReviewWorkflow({
    caseId: action.caseId,
    projectId: action.projectId,
    action,
    history,
    evidenceState: { title_verified: true },
  });
  assert.strictEqual(result.workflowStatus, REVIEW_WORKFLOW_STATUS.READY_FOR_HUMAN_CLOSURE);
  assert.strictEqual(result.canRequestHumanClosure, true);
  assert(result.allowedNextStatuses.includes(ACTION_STATUS.SATISFIED_PENDING_REVIEW));
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function professionalReviewRequirementFailsClosed() {
  const action = createDecisionAction({
    actionId: 'action-2',
    caseId: 'case-1',
    projectId: 'project-1',
    type: ACTION_TYPE.LEGAL_REVIEW,
    description: 'Licensed legal review required',
    ownerId: 'owner-2',
    requiresLicensedProfessional: true,
    requiredEvidenceKeys: [],
    sourceDecisionRef: 'dd-2',
  });
  const history = createActionStateHistory({ action, actorId: 'actor-1', occurredAt: '2026-09-01T10:00:00Z' });
  const result = buildDecisionActionReviewWorkflow({ caseId: 'case-1', projectId: 'project-1', action, history });
  assert.strictEqual(result.workflowStatus, REVIEW_WORKFLOW_STATUS.HOLD_PROFESSIONAL_REVIEW);
})();

(function closedActionCanOnlyReopenThroughControlledPath() {
  const action = baselineAction();
  let history = createActionStateHistory({ action, actorId: 'actor-1', occurredAt: '2026-09-01T10:00:00Z' });
  history = transitionActionState({ history, toStatus: ACTION_STATUS.IN_PROGRESS, actorId: 'actor-1', occurredAt: '2026-09-01T10:01:00Z', reasonCode: 'WORK_STARTED' });
  history = transitionActionState({ history, toStatus: ACTION_STATUS.SATISFIED_PENDING_REVIEW, actorId: 'actor-1', occurredAt: '2026-09-01T10:02:00Z', reasonCode: 'EVIDENCE_SATISFIED', evidenceRefs: ['ev-title'] });
  history = transitionActionState({ history, toStatus: ACTION_STATUS.CLOSED, actorId: 'reviewer-1', occurredAt: '2026-09-01T10:03:00Z', reasonCode: 'HUMAN_REVIEW_COMPLETE', evidenceRefs: ['ev-title'] });
  const result = buildDecisionActionReviewWorkflow({ caseId: 'case-1', projectId: 'project-1', action, history, evidenceState: { title_verified: true } });
  assert.strictEqual(result.workflowStatus, REVIEW_WORKFLOW_STATUS.CLOSED);
  assert.deepStrictEqual(result.allowedNextStatuses, [ACTION_STATUS.BLOCKED]);
  assert.strictEqual(result.canReopen, true);
})();

(function registerSummaryIsDeterministic() {
  const action = baselineAction();
  const history = createActionStateHistory({ action, actorId: 'actor-1', occurredAt: '2026-09-01T10:00:00Z' });
  const result = buildDecisionActionReviewRegister({
    caseId: 'case-1',
    projectId: 'project-1',
    actions: [action],
    actionHistories: [history],
    evidenceByActionId: { 'action-1': { title_verified: false } },
  });
  assert.strictEqual(result.blockedCount, 1);
  assert.strictEqual(result.closedCount, 0);
  assert.strictEqual(result.allClosed, false);
})();

(function productionUiPanelRemainsImplementedButAmbientInjectionIsRemoved() {
  const root = path.resolve(__dirname, '../..');
  const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
  const panel = fs.readFileSync(path.join(root, 'src/components/InvestmentCommitteeDossierPanel.jsx'), 'utf8');
  assert(!main.includes('__STARTAK_INVESTMENT_COMMITTEE_DOSSIER__'));
  assert(!main.includes('__STARTAK_DECISION_ACTION_REVIEW_REGISTER__'));
  assert(!main.includes('InvestmentCommitteeDossierPanel'));
  assert(panel.includes('ملف قرار لجنة الاستثمار'));
  assert(panel.includes('حدود الحوكمة'));
  assert(!main.includes('case-1'));
  assert(!main.includes('project-1'));
})();

console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1=PASS');
