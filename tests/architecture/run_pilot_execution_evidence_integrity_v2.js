'use strict';

const assert = require('assert');
const {
  PILOT_EXECUTION_STATUS,
  parseEvidenceTimestamp,
  buildPilotExecutionEvidencePack,
} = require('../../src/pilot/pilot-execution-evidence-pack');

function readiness(overrides = {}) {
  return { caseId: 'case-1', projectId: 'project-1', status: 'READY_FOR_CONTROLLED_PILOT', ...overrides };
}

function execution(overrides = {}) {
  return {
    caseId: 'case-1', projectId: 'project-1',
    startedAt: '2026-09-01T10:00:00+03:00', completedAt: '2026-09-01T11:30:00+03:00',
    studyCompleted: true, committeeFlowExercised: true, outcomeFeedbackExercised: true,
    learningReviewExercised: true, caseIsolationObserved: true, errorLoggingObserved: true,
    realBrowserPathObserved: true, ...overrides,
  };
}

function users() {
  return [
    { userRef: 'pilot-user-1', inviteOnly: true, verified: true },
    { userRef: 'pilot-user-2', inviteOnly: true, verified: true },
  ];
}

function base(overrides = {}) {
  return {
    caseId: 'case-1', projectId: 'project-1', readiness: readiness(), execution: execution(), users: users(), incidents: [],
    rollback: { documented: true, exercised: true, evidenceRef: 'rollback-proof' },
    evidenceRefs: ['run-log', 'rollback-proof'],
    ...overrides,
  };
}

(function explicitTimezoneParser() {
  assert.strictEqual(parseEvidenceTimestamp('2026-09-01T10:00:00'), null);
  assert.strictEqual(parseEvidenceTimestamp('not-a-date'), null);
  const parsed = parseEvidenceTimestamp('2026-09-01T10:00:00+03:00');
  assert.ok(parsed);
  assert.strictEqual(parsed.canonical, '2026-09-01T07:00:00.000Z');
})();

(function invalidOrTimezoneLessTimestampHolds() {
  for (const startedAt of ['2026-09-01T10:00:00', 'not-a-date', '']) {
    const out = buildPilotExecutionEvidencePack(base({ execution: execution({ startedAt }) }));
    assert.strictEqual(out.status, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE);
    assert.ok(out.reasonCodes.includes('PILOT_EXECUTION_TIMESTAMPS_MUST_BE_VALID_AND_TIMEZONE_EXPLICIT'));
  }
})();

(function chronologyMustAdvance() {
  const same = buildPilotExecutionEvidencePack(base({
    execution: execution({ startedAt: '2026-09-01T10:00:00Z', completedAt: '2026-09-01T10:00:00Z' }),
  }));
  assert.strictEqual(same.status, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE);
  assert.ok(same.reasonCodes.includes('PILOT_EXECUTION_COMPLETED_AT_MUST_BE_AFTER_STARTED_AT'));

  const reversed = buildPilotExecutionEvidencePack(base({
    execution: execution({ startedAt: '2026-09-01T11:00:00Z', completedAt: '2026-09-01T10:00:00Z' }),
  }));
  assert.strictEqual(reversed.status, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE);
})();

(function duplicateOrMissingParticipantIdentityHolds() {
  const duplicate = buildPilotExecutionEvidencePack(base({
    users: [
      { userRef: 'same-user', inviteOnly: true, verified: true },
      { userRef: 'same-user', inviteOnly: true, verified: true },
    ],
  }));
  assert.strictEqual(duplicate.status, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT);

  const missingRef = buildPilotExecutionEvidencePack(base({
    users: [{ userRef: ' ', inviteOnly: true, verified: true }],
  }));
  assert.strictEqual(missingRef.status, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT);
})();

(function rollbackEvidenceMustBeBoundToPack() {
  const out = buildPilotExecutionEvidencePack(base({ evidenceRefs: ['run-log'] }));
  assert.strictEqual(out.status, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK);
  assert.ok(out.reasonCodes.includes('ROLLBACK_EVIDENCE_REF_MUST_BE_BOUND_TO_EVIDENCE_PACK'));
})();

(function blankRollbackRefCannotPassByTruthiness() {
  const out = buildPilotExecutionEvidencePack(base({
    rollback: { documented: true, exercised: true, evidenceRef: '   ' },
  }));
  assert.strictEqual(out.status, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK);
})();

(function evidenceRefsDeduplicateAndWindowCanonicalizes() {
  const out = buildPilotExecutionEvidencePack(base({ evidenceRefs: ['run-log', 'rollback-proof', 'run-log'] }));
  assert.strictEqual(out.status, PILOT_EXECUTION_STATUS.EVIDENCE_PACK_COMPLETE);
  assert.deepStrictEqual(out.evidenceRefs, ['run-log', 'rollback-proof']);
  assert.strictEqual(out.pilotWindow.startedAt, '2026-09-01T07:00:00.000Z');
  assert.strictEqual(out.pilotWindow.completedAt, '2026-09-01T08:30:00.000Z');
  assert.strictEqual(out.pilotWindow.durationMs, 90 * 60 * 1000);
  assert.strictEqual(out.productionReady, false);
  assert.strictEqual(out.productionSecurityVerified, false);
  assert.strictEqual(out.legalApprovalEstablished, false);
  assert.strictEqual(out.transactionAuthorized, false);
})();

console.log('PILOT_EXECUTION_EVIDENCE_INTEGRITY_V2=PASS');
