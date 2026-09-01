'use strict';

const assert = require('assert');
const { PILOT_READINESS_STATUS, buildControlledPilotReadinessV2 } = require('../../src/pilot/controlled-pilot-readiness-v2');

function baseInput(overrides = {}) {
  return {
    caseId: 'case-pilot-1',
    projectId: 'project-pilot-1',
    studyOrchestration: {
      caseId: 'case-pilot-1',
      projectId: 'project-pilot-1',
      status: 'READY_FOR_AI_AND_HUMAN_REVIEW',
      humanDecisionRequired: true,
      transactionAuthorized: false,
    },
    securityTrustGate: {
      status: 'READY_FOR_INDEPENDENT_SECURITY_REVIEW',
      productionSecurityVerifiedByThisModule: false,
      transactionAuthorized: false,
    },
    verificationEvidence: {
      releaseVerifyPassed: true,
      comprehensiveVerifyPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      dataLeakageObserved: false,
    },
    pilotControls: {
      maxUsers: 5,
      inviteOnly: true,
      caseIsolationRequired: true,
      noProductionTransactionExecution: true,
      errorLoggingEnabled: true,
      rollbackPlanDocumented: true,
      userVerificationRequired: true,
    },
    lifecycleExercise: {
      caseId: 'case-pilot-1',
      projectId: 'project-pilot-1',
      studyToCommitteeExercised: true,
      committeeDecisionToOutcomeExercised: true,
      outcomeToLearningExercised: true,
      syntheticOrQuasiRealCaseDeclared: true,
      noAutomatedDecisionObserved: true,
      noTransactionAuthorizationObserved: true,
      evidenceRefs: ['pilot-e2e-artifact-1'],
    },
    ...overrides,
  };
}

(function readyPath() {
  const result = buildControlledPilotReadinessV2(baseInput());
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT);
  assert.strictEqual(result.readyForControlledPilot, true);
  assert.strictEqual(result.productionSecurityVerified, false);
  assert.strictEqual(result.productionDeploymentAuthorized, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function studyHold() {
  const input = baseInput();
  input.studyOrchestration = { ...input.studyOrchestration, status: 'HOLD_EVIDENCE' };
  const result = buildControlledPilotReadinessV2(input);
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.HOLD_STUDY_FLOW);
})();

(function securityHold() {
  const input = baseInput();
  input.securityTrustGate = { ...input.securityTrustGate, status: 'HOLD_ATTESTATION_EVIDENCE' };
  const result = buildControlledPilotReadinessV2(input);
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.HOLD_SECURITY);
})();

(function verificationHold() {
  const input = baseInput();
  input.verificationEvidence = { ...input.verificationEvidence, realBrowserE2ePassed: false };
  const result = buildControlledPilotReadinessV2(input);
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.HOLD_VERIFICATION);
})();

(function pilotGuardrailsHold() {
  const input = baseInput();
  input.pilotControls = { ...input.pilotControls, maxUsers: 6 };
  const result = buildControlledPilotReadinessV2(input);
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS);
})();

(function lifecycleHold() {
  const input = baseInput();
  input.lifecycleExercise = { ...input.lifecycleExercise, outcomeToLearningExercised: false };
  const result = buildControlledPilotReadinessV2(input);
  assert.strictEqual(result.status, PILOT_READINESS_STATUS.HOLD_LIFECYCLE_EXERCISE);
})();

(function scopeIsolation() {
  const input = baseInput();
  input.lifecycleExercise = { ...input.lifecycleExercise, projectId: 'project-other' };
  assert.throws(() => buildControlledPilotReadinessV2(input), /LIFECYCLEEXERCISE_SCOPE_MISMATCH/);
})();

console.log('CONTROLLED_PILOT_READINESS_V2=PASS');
