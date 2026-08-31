'use strict';
const assert = require('assert');
const { createDecisionAction, ACTION_STATUS } = require('../../src/decision-actions');
const {
  ACTION_EVENT_TYPE,
  createActionStateHistory,
  transitionActionState,
  buildStatefulActionRegister,
} = require('../../src/decision-actions/state-history');

let checks = 0;
function check(fn) { fn(); checks++; }

const action = createDecisionAction({
  actionId: 'ACT-001',
  caseId: 'CASE-001',
  projectId: 'PROJ-001',
  type: 'EVIDENCE',
  description: 'Verify title evidence',
  ownerId: 'OWNER-1',
  requiredEvidenceKeys: ['title_verified'],
  sourceDecisionRef: 'DECISION-001',
});

const h1 = createActionStateHistory({ action, actorId: 'USER-1', occurredAt: '2026-09-01T00:00:00Z' });
check(() => assert.strictEqual(h1.currentStatus, ACTION_STATUS.OPEN));
check(() => assert.strictEqual(h1.events[0].eventType, ACTION_EVENT_TYPE.CREATED));

const h2 = transitionActionState({ history: h1, toStatus: ACTION_STATUS.IN_PROGRESS, actorId: 'USER-1', occurredAt: '2026-09-01T00:01:00Z', reasonCode: 'WORK_STARTED' });
check(() => assert.strictEqual(h2.currentStatus, ACTION_STATUS.IN_PROGRESS));
check(() => assert.strictEqual(h1.currentStatus, ACTION_STATUS.OPEN));
check(() => assert.strictEqual(h2.events.length, 2));

const h3 = transitionActionState({ history: h2, toStatus: ACTION_STATUS.SATISFIED_PENDING_REVIEW, actorId: 'ANALYST-1', occurredAt: '2026-09-01T00:02:00Z', reasonCode: 'EVIDENCE_SATISFIED', evidenceRefs: ['EVID-1'] });
check(() => assert.strictEqual(h3.currentStatus, ACTION_STATUS.SATISFIED_PENDING_REVIEW));

const h4 = transitionActionState({ history: h3, toStatus: ACTION_STATUS.CLOSED, actorId: 'REVIEWER-1', occurredAt: '2026-09-01T00:03:00Z', reasonCode: 'HUMAN_REVIEW_CLOSED', evidenceRefs: ['EVID-1'] });
check(() => assert.strictEqual(h4.currentStatus, ACTION_STATUS.CLOSED));
check(() => assert.strictEqual(h4.events.at(-1).eventType, ACTION_EVENT_TYPE.CLOSED));

assert.throws(() => transitionActionState({ history: h4, toStatus: ACTION_STATUS.IN_PROGRESS, actorId: 'USER-1', occurredAt: '2026-09-01T00:04:00Z', reasonCode: 'INVALID' }), /ILLEGAL_ACTION_STATE_TRANSITION/); checks++;
assert.throws(() => transitionActionState({ history: h4, toStatus: ACTION_STATUS.BLOCKED, actorId: 'SYSTEM', occurredAt: '2026-09-01T00:04:00Z', reasonCode: 'EVIDENCE_REVOKED' }), /ACTION_REOPEN_REQUIRES_EVIDENCE_REVOCATION_REF/); checks++;

const h5 = transitionActionState({ history: h4, toStatus: ACTION_STATUS.BLOCKED, actorId: 'SYSTEM', occurredAt: '2026-09-01T00:05:00Z', reasonCode: 'EVIDENCE_REVOKED', evidenceRefs: ['EVID-1-REVOKED'] });
check(() => assert.strictEqual(h5.currentStatus, ACTION_STATUS.BLOCKED));
check(() => assert.strictEqual(h5.events.at(-1).eventType, ACTION_EVENT_TYPE.REOPENED));

const register = buildStatefulActionRegister({ caseId: 'CASE-001', projectId: 'PROJ-001', actionHistories: [h5] });
check(() => assert.strictEqual(register.openCount, 1));
check(() => assert.strictEqual(register.closedCount, 0));
check(() => assert.strictEqual(register.counts.BLOCKED, 1));
check(() => assert.strictEqual(register.transactionAuthorized, false));

assert.throws(() => buildStatefulActionRegister({ caseId: 'OTHER', projectId: 'PROJ-001', actionHistories: [h5] }), /ACTION_HISTORY_CASE_OR_PROJECT_ISOLATION_VIOLATION/); checks++;

console.log(`DECISION_ACTION_STATE_HISTORY_V1: PASS (${checks} checks)`);
