'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createDecisionAction,
  buildDecisionActionRegister,
  ACTION_TYPE,
} = require('../../src/decision-actions');
const {
  createActionStateHistory,
  transitionActionState,
} = require('../../src/decision-actions/state-history');
const { ACTION_STATUS } = require('../../src/decision-actions');
const {
  POST_DECISION_STATUS,
  buildPostDecisionGovernanceWorkspace,
} = require('../../src/runtime/post-decision-governance-workspace');

const projectId = 'PROJECT-POST-001';
const caseId = 'CASE-POST-001';
const canonicalWorkspace = Object.freeze({
  workspaceId: 'WS-POST-001',
  projectId,
  caseId,
  authority: Object.freeze({ transactionAuthorized: false }),
});

const humanDecisionRecord = Object.freeze({
  schemaVersion: 1,
  projectId,
  caseId,
  status: 'RECORDED',
  dossierRef: 'DOSSIER-POST-001',
  decision: 'CONDITIONAL_APPROVAL',
  humanDecisionConfirmed: true,
  automatedDecision: false,
  transactionAuthorized: false,
});

let result = buildPostDecisionGovernanceWorkspace({ canonicalWorkspace });
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_COMMITTEE_DECISION);
assert(result.reasonCodes.includes('RECORDED_HUMAN_COMMITTEE_DECISION_REQUIRED'));
assert.strictEqual(result.transactionAuthorized, false);

result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
});
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_ACTION_REGISTER);

const action = createDecisionAction({
  actionId: 'ACTION-POST-001',
  caseId,
  projectId,
  type: ACTION_TYPE.EVIDENCE,
  description: 'Obtain verified closing evidence',
  ownerId: 'OWNER-001',
  requiredEvidenceKeys: ['closingEvidence'],
  sourceDecisionRef: 'DOSSIER-POST-001',
});
const actionRegister = buildDecisionActionRegister({ caseId, projectId, actions: [action] });

result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
  actionRegister,
});
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_ACTION_HISTORY);
assert(result.reasonCodes.includes('MISSING_ACTION_HISTORY:ACTION-POST-001'));

const openHistory = createActionStateHistory({
  action,
  actorId: 'ACTOR-001',
  occurredAt: '2026-09-08T18:00:00Z',
});
result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
  actionRegister,
  actionHistories: [openHistory],
  evidenceByActionId: { 'ACTION-POST-001': { closingEvidence: true } },
});
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_ACTION_REVIEW);
assert.strictEqual(result.actionReviewRegister.readyForHumanClosureCount, 1);
assert.strictEqual(result.authority.transactionAuthorized, false);

let history = transitionActionState({
  history: openHistory,
  toStatus: ACTION_STATUS.IN_PROGRESS,
  actorId: 'ACTOR-001',
  occurredAt: '2026-09-08T18:10:00Z',
  reasonCode: 'WORK_STARTED',
});
history = transitionActionState({
  history,
  toStatus: ACTION_STATUS.SATISFIED_PENDING_REVIEW,
  actorId: 'ACTOR-001',
  occurredAt: '2026-09-08T18:20:00Z',
  reasonCode: 'EVIDENCE_SATISFIED',
  evidenceRefs: ['EVIDENCE-001'],
});
history = transitionActionState({
  history,
  toStatus: ACTION_STATUS.CLOSED,
  actorId: 'HUMAN-REVIEWER-001',
  occurredAt: '2026-09-08T18:30:00Z',
  reasonCode: 'HUMAN_CLOSURE_REVIEW_COMPLETED',
  evidenceRefs: ['EVIDENCE-001'],
});

result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
  actionRegister,
  actionHistories: [history],
  evidenceByActionId: { 'ACTION-POST-001': { closingEvidence: true } },
});
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_OUTCOME_EVIDENCE);
assert.strictEqual(result.actionReviewRegister.allClosed, true);

result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
  actionRegister,
  actionHistories: [history],
  evidenceByActionId: { 'ACTION-POST-001': { closingEvidence: true } },
  outcomeSnapshot: {
    projectId,
    caseId,
    verified: false,
    evidenceRef: null,
    observedAt: '2027-09-08T00:00:00Z',
  },
});
assert.strictEqual(result.status, POST_DECISION_STATUS.HOLD_OUTCOME_REVIEW);
assert.strictEqual(result.outcomeFeedback.status, 'HOLD_OUTCOME_EVIDENCE');

result = buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: humanDecisionRecord,
  actionRegister,
  actionHistories: [history],
  evidenceByActionId: { 'ACTION-POST-001': { closingEvidence: true } },
  outcomeSnapshot: {
    projectId,
    caseId,
    verified: true,
    evidenceRef: 'OUTCOME-EVIDENCE-001',
    observedAt: '2027-09-08T00:00:00Z',
    upstreamEvidenceChanged: true,
  },
  comparisonItems: [{
    id: 'NOI-VARIANCE',
    label: 'NOI',
    plannedValue: 100,
    actualValue: 88,
    materialVariance: true,
    explanation: 'Verified actual NOI below underwriting',
    evidenceRef: 'OUTCOME-EVIDENCE-001',
  }],
});
assert.strictEqual(result.status, POST_DECISION_STATUS.READY_FOR_LEARNING_REVIEW);
assert.strictEqual(result.outcomeFeedback.reanalysisRequired, true);
assert.strictEqual(result.learningReview.status, 'READY_FOR_LEARNING_REVIEW');
assert.strictEqual(result.learningReview.learningCandidateCount, 1);
assert.strictEqual(result.learningReview.mayUpdatePolicyAutomatically, false);
assert.strictEqual(result.learningReview.mayUpdateModelAutomatically, false);
assert.strictEqual(result.learningReview.mayRewritePriorDecision, false);
assert.strictEqual(result.learningApplicationStatus, 'PROPOSAL_ONLY_REQUIRES_HUMAN_GOVERNANCE');
assert.strictEqual(result.authority.automatedPolicyUpdateAuthorized, false);
assert.strictEqual(result.authority.automatedModelUpdateAuthorized, false);
assert.strictEqual(result.authority.automatedRuleActivationAuthorized, false);
assert.strictEqual(result.authority.priorDecisionRewriteAuthorized, false);
assert.strictEqual(result.authority.releaseAuthorized, false);
assert.strictEqual(result.authority.mergeAuthorized, false);
assert.strictEqual(result.authority.deploymentAuthorized, false);
assert.strictEqual(result.authority.transactionAuthorized, false);
assert(Object.isFrozen(result));
assert(Object.isFrozen(result.learningReview));

assert.throws(() => buildPostDecisionGovernanceWorkspace({
  canonicalWorkspace,
  decisionRecord: { ...humanDecisionRecord, projectId: 'OTHER-PROJECT' },
}), /DECISIONRECORD_SCOPE_MISMATCH/);

const panelSource = fs.readFileSync(path.join(__dirname, '../../src/components/PostDecisionGovernancePanel.jsx'), 'utf8');
const canonicalPanelSource = fs.readFileSync(path.join(__dirname, '../../src/components/CanonicalCaseWorkspacePanel.jsx'), 'utf8');
assert(panelSource.includes('buildPostDecisionGovernanceWorkspace'));
assert(panelSource.includes('OutcomeMonitoringPanel'));
assert(panelSource.includes('لا تحديث تلقائي للنموذج أو السياسات أو المعايير'));
assert(!panelSource.includes('window.'));
assert(canonicalPanelSource.includes('PostDecisionGovernancePanel'));
assert(canonicalPanelSource.includes('<PostDecisionGovernancePanel canonicalWorkspace={workspace} />'));

console.log('POST_DECISION_GOVERNANCE_WORKSPACE=PASS');
