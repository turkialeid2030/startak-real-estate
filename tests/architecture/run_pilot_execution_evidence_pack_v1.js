'use strict';

const assert = require('assert');
const { PILOT_EXECUTION_STATUS, buildPilotExecutionEvidencePack } = require('../../src/pilot/pilot-execution-evidence-pack');

function readiness(overrides = {}) {
  return { caseId: 'case-1', projectId: 'project-1', status: 'READY_FOR_CONTROLLED_PILOT', ...overrides };
}
function execution(overrides = {}) {
  return {
    caseId: 'case-1', projectId: 'project-1',
    startedAt: '2026-09-01T10:00:00Z', completedAt: '2026-09-01T11:00:00Z',
    studyCompleted: true, committeeFlowExercised: true, outcomeFeedbackExercised: true,
    learningReviewExercised: true, caseIsolationObserved: true, errorLoggingObserved: true,
    realBrowserPathObserved: true, ...overrides,
  };
}
function users(count = 2) {
  return Array.from({ length: count }, (_, i) => ({ userRef: `u-${i+1}`, inviteOnly: true, verified: true }));
}
function rollback(overrides = {}) {
  return { documented: true, exercised: true, evidenceRef: 'rollback-ev-1', ...overrides };
}

(function readyPath() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(),
    incidents: [{ id: 'i-1', severity: 'LOW', type: 'UI', resolved: true }], rollback: rollback(),
    evidenceRefs: ['pilot-run-log', 'browser-run', 'case-isolation-check'],
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(result.readyForProductionReadinessAudit, true);
  assert.strictEqual(result.productionReady, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function readinessHold() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness({ status: 'HOLD_EVIDENCE' }), execution: execution(), users: users(), rollback: rollback(), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_READINESS);
})();

(function userLimitHold() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(6), rollback: rollback(), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT);
})();

(function executionHold() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution({ learningReviewExercised: false }), users: users(), rollback: rollback(), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE);
})();

(function incidentHold() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(),
    incidents: [{ id: 'i-1', severity: 'CRITICAL', type: 'RUNTIME', resolved: false }], rollback: rollback(), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_INCIDENTS);
})();

(function leakageAlwaysHolds() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(),
    incidents: [{ id: 'i-2', severity: 'LOW', type: 'DATA_LEAKAGE', resolved: true }], rollback: rollback(), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_INCIDENTS);
})();

(function rollbackHold() {
  const result = buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(), rollback: rollback({ exercised: false }), evidenceRefs: ['ev']
  });
  assert.strictEqual(result.status, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK);
})();

(function scopeMismatchFailsClosed() {
  assert.throws(() => buildPilotExecutionEvidencePack({
    caseId: 'case-1', projectId: 'project-1', readiness: readiness({ caseId: 'case-2' }), execution: execution(), users: users(), rollback: rollback(), evidenceRefs: ['ev']
  }), /PILOT_EXECUTION_SCOPE_MISMATCH/);
})();

console.log('PILOT_EXECUTION_EVIDENCE_PACK_V1=PASS');
