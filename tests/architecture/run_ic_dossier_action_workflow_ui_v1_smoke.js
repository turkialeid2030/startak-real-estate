'use strict';
const assert = require('assert');
const { ACTION_TYPE, createDecisionAction } = require('../../src/decision-actions');
const { createActionStateHistory } = require('../../src/decision-actions/state-history');
const { buildDecisionActionReviewWorkflow } = require('../../src/decision-actions/review-workflow');

const action = createDecisionAction({
  actionId:'smoke-a1',
  caseId:'smoke-c1',
  projectId:'smoke-p1',
  type:ACTION_TYPE.EVIDENCE,
  description:'Smoke evidence action',
  ownerId:'owner-1',
  sourceDecisionRef:'dd-smoke',
  requiredEvidenceKeys:['ev'],
});
const history = createActionStateHistory({ action, actorId:'owner-1', occurredAt:'2026-09-01T10:00:00Z' });
const hold = buildDecisionActionReviewWorkflow({
  caseId:'smoke-c1',
  projectId:'smoke-p1',
  action,
  history,
  evidenceState:{},
});
assert.strictEqual(hold.workflowStatus,'HOLD_EVIDENCE');
assert.strictEqual(hold.canRequestHumanClosure,false);

const ready = buildDecisionActionReviewWorkflow({
  caseId:'smoke-c1',
  projectId:'smoke-p1',
  action,
  history,
  evidenceState:{ev:true},
});
assert.strictEqual(ready.workflowStatus,'READY_FOR_HUMAN_CLOSURE');
assert.strictEqual(ready.canRequestHumanClosure,true);
assert.strictEqual(ready.transactionAuthorized,false);
console.log('IC_DOSSIER_ACTION_WORKFLOW_UI_V1_SMOKE=PASS');
