'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildControlledPilotReadinessV2, PILOT_READINESS_STATUS } = require('../../src/pilot/controlled-pilot-readiness-v2');
const { buildPilotExecutionEvidencePack, PILOT_EXECUTION_STATUS } = require('../../src/pilot/pilot-execution-evidence-pack');

const ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(ROOT, 'runtime-evidence', 'deep-platform');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function baseReadinessInput() {
  return {
    caseId: 'case-deep-1',
    projectId: 'project-deep-1',
    studyOrchestration: {
      caseId: 'case-deep-1', projectId: 'project-deep-1',
      status: 'READY_FOR_AI_AND_HUMAN_REVIEW', humanDecisionRequired: true, transactionAuthorized: false,
    },
    securityTrustGate: {
      status: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW',
      productionSecurityVerifiedByThisModule: false, transactionAuthorized: false,
    },
    verificationEvidence: {
      releaseVerifyPassed: true, comprehensiveVerifyPassed: true, realBrowserE2ePassed: true,
      fatalConsoleErrors: 0, dataLeakageObserved: false,
    },
    pilotControls: {
      maxUsers: 5, inviteOnly: true, caseIsolationRequired: true,
      noProductionTransactionExecution: true, errorLoggingEnabled: true,
      rollbackPlanDocumented: true, userVerificationRequired: true,
    },
    lifecycleExercise: {
      caseId: 'case-deep-1', projectId: 'project-deep-1',
      studyToCommitteeExercised: true, committeeDecisionToOutcomeExercised: true,
      outcomeToLearningExercised: true, syntheticOrQuasiRealCaseDeclared: true,
      noAutomatedDecisionObserved: true, noTransactionAuthorizationObserved: true,
      evidenceRefs: ['ev-study', 'ev-committee', 'ev-outcome', 'ev-learning'],
    },
  };
}

const results = [];
function record(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); throw error; }
}

record('ready path is bounded and non-production', () => {
  const r = buildControlledPilotReadinessV2(baseReadinessInput());
  assert.strictEqual(r.status, PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT);
  assert.strictEqual(r.readyForControlledPilot, true);
  assert.strictEqual(r.productionSecurityVerified, false);
  assert.strictEqual(r.productionDeploymentAuthorized, false);
  assert.strictEqual(r.transactionAuthorized, false);
});

const readinessMutations = [
  ['study hold', (x) => { x.studyOrchestration.status = 'HOLD_EVIDENCE'; }, PILOT_READINESS_STATUS.HOLD_STUDY_FLOW],
  ['security hold', (x) => { x.securityTrustGate.status = 'HOLD_RUNTIME_EVIDENCE'; }, PILOT_READINESS_STATUS.HOLD_SECURITY],
  ['release hold', (x) => { x.verificationEvidence.releaseVerifyPassed = false; }, PILOT_READINESS_STATUS.HOLD_VERIFICATION],
  ['browser hold', (x) => { x.verificationEvidence.realBrowserE2ePassed = false; }, PILOT_READINESS_STATUS.HOLD_VERIFICATION],
  ['console hold', (x) => { x.verificationEvidence.fatalConsoleErrors = 1; }, PILOT_READINESS_STATUS.HOLD_VERIFICATION],
  ['leakage hold', (x) => { x.verificationEvidence.dataLeakageObserved = true; }, PILOT_READINESS_STATUS.HOLD_VERIFICATION],
  ['user limit hold', (x) => { x.pilotControls.maxUsers = 6; }, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS],
  ['invite hold', (x) => { x.pilotControls.inviteOnly = false; }, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS],
  ['isolation hold', (x) => { x.pilotControls.caseIsolationRequired = false; }, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS],
  ['transaction guard hold', (x) => { x.pilotControls.noProductionTransactionExecution = false; }, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS],
  ['rollback documentation hold', (x) => { x.pilotControls.rollbackPlanDocumented = false; }, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS],
  ['lifecycle hold', (x) => { x.lifecycleExercise.outcomeToLearningExercised = false; }, PILOT_READINESS_STATUS.HOLD_LIFECYCLE_EXERCISE],
];
for (const [name, mutate, expected] of readinessMutations) {
  record(name, () => {
    const input = baseReadinessInput();
    mutate(input);
    const r = buildControlledPilotReadinessV2(input);
    assert.strictEqual(r.status, expected);
    assert.strictEqual(r.readyForControlledPilot, false);
    assert.strictEqual(r.transactionAuthorized, false);
  });
}

record('scope mismatch throws fail-closed', () => {
  const input = baseReadinessInput();
  input.lifecycleExercise.projectId = 'other-project';
  assert.throws(() => buildControlledPilotReadinessV2(input), /SCOPE_MISMATCH/);
});

function baseExecution(readiness) {
  return {
    caseId: 'case-deep-1', projectId: 'project-deep-1', readiness,
    execution: {
      caseId: 'case-deep-1', projectId: 'project-deep-1',
      startedAt: '2026-09-01T08:00:00Z', completedAt: '2026-09-01T12:00:00Z',
      studyCompleted: true, committeeFlowExercised: true, outcomeFeedbackExercised: true,
      learningReviewExercised: true, caseIsolationObserved: true, errorLoggingObserved: true,
      realBrowserPathObserved: true,
    },
    users: [
      { userRef: 'u1', verified: true, inviteOnly: true },
      { userRef: 'u2', verified: true, inviteOnly: true },
    ],
    incidents: [],
    rollback: { documented: true, exercised: true, evidenceRef: 'rollback-1' },
    evidenceRefs: ['pilot-run-1', 'browser-1', 'logs-1', 'rollback-1'],
  };
}

record('pilot evidence pack complete path remains non-production', () => {
  const readiness = buildControlledPilotReadinessV2(baseReadinessInput());
  const p = buildPilotExecutionEvidencePack(baseExecution(readiness));
  assert.strictEqual(p.status, PILOT_EXECUTION_STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(p.readyForProductionReadinessAudit, true);
  assert.strictEqual(p.productionReady, false);
  assert.strictEqual(p.transactionAuthorized, false);
});

const executionMutations = [
  ['execution incomplete', (x) => { x.execution.learningReviewExercised = false; }, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE],
  ['unverified user', (x) => { x.users[0].verified = false; }, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT],
  ['too many users', (x) => { x.users = Array.from({ length: 6 }, (_, i) => ({ userRef: `u${i}`, verified: true, inviteOnly: true })); }, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT],
  ['critical incident', (x) => { x.incidents = [{ severity: 'CRITICAL', resolved: false, type: 'RUNTIME' }]; }, PILOT_EXECUTION_STATUS.HOLD_INCIDENTS],
  ['data leakage incident', (x) => { x.incidents = [{ severity: 'LOW', resolved: true, type: 'DATA_LEAKAGE' }]; }, PILOT_EXECUTION_STATUS.HOLD_INCIDENTS],
  ['rollback not exercised', (x) => { x.rollback.exercised = false; }, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK],
];
for (const [name, mutate, expected] of executionMutations) {
  record(name, () => {
    const readiness = buildControlledPilotReadinessV2(baseReadinessInput());
    const input = baseExecution(readiness);
    mutate(input);
    const p = buildPilotExecutionEvidencePack(input);
    assert.strictEqual(p.status, expected);
    assert.strictEqual(p.productionReady, false);
    assert.strictEqual(p.transactionAuthorized, false);
  });
}

const summary = {
  schemaVersion: 2,
  dimensions: ['fail-closed-precedence', 'scope-isolation', 'pilot-controls', 'incident-safety', 'rollback', 'human-authority', 'non-production-boundary', 'participant-identity', 'evidence-binding'],
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length,
  results,
};
fs.writeFileSync(path.join(EVIDENCE_DIR, 'lifecycle-fail-closed-stress.json'), JSON.stringify(summary, null, 2));
console.log(`LIFECYCLE_FAIL_CLOSED_STRESS_V1=PASS checks=${results.length}`);
