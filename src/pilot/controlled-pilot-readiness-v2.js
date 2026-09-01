'use strict';

const PILOT_READINESS_STATUS = Object.freeze({
  READY_FOR_CONTROLLED_PILOT: 'READY_FOR_CONTROLLED_PILOT',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STUDY_FLOW: 'HOLD_STUDY_FLOW',
  HOLD_SECURITY: 'HOLD_SECURITY',
  HOLD_VERIFICATION: 'HOLD_VERIFICATION',
  HOLD_PILOT_CONTROLS: 'HOLD_PILOT_CONTROLS',
  HOLD_LIFECYCLE_EXERCISE: 'HOLD_LIFECYCLE_EXERCISE',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function assertScoped(name, value, caseId, projectId) {
  if (!value) return;
  requiredObject(value, name);
  if ((value.caseId && value.caseId !== caseId) || (value.projectId && value.projectId !== projectId)) {
    const error = new Error(`${name.toUpperCase()}_SCOPE_MISMATCH`);
    error.code = PILOT_READINESS_STATUS.HOLD_SCOPE_MISMATCH;
    throw error;
  }
}

function buildControlledPilotReadinessV2({
  caseId,
  projectId,
  studyOrchestration,
  securityTrustGate,
  verificationEvidence,
  pilotControls,
  lifecycleExercise,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(studyOrchestration, 'studyOrchestration');
  requiredObject(securityTrustGate, 'securityTrustGate');
  requiredObject(verificationEvidence, 'verificationEvidence');
  requiredObject(pilotControls, 'pilotControls');
  requiredObject(lifecycleExercise, 'lifecycleExercise');

  for (const [name, value] of Object.entries({ studyOrchestration, lifecycleExercise })) {
    assertScoped(name, value, scopedCaseId, scopedProjectId);
  }

  const reasonCodes = [];
  let status = PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT;

  const studyReady = studyOrchestration.status === 'READY_FOR_AI_AND_HUMAN_REVIEW'
    && studyOrchestration.humanDecisionRequired === true
    && studyOrchestration.transactionAuthorized === false;
  if (!studyReady) {
    status = PILOT_READINESS_STATUS.HOLD_STUDY_FLOW;
    reasonCodes.push('END_TO_END_STUDY_FLOW_NOT_READY');
  }

  const securityReady = securityTrustGate.status === 'READY_FOR_INDEPENDENT_SECURITY_REVIEW'
    && securityTrustGate.productionSecurityVerifiedByThisModule === false
    && securityTrustGate.transactionAuthorized === false;
  if (status === PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT && !securityReady) {
    status = PILOT_READINESS_STATUS.HOLD_SECURITY;
    reasonCodes.push('SECURITY_TRUST_EVIDENCE_NOT_READY_FOR_REVIEW');
  }

  const verificationReady = verificationEvidence.releaseVerifyPassed === true
    && verificationEvidence.comprehensiveVerifyPassed === true
    && verificationEvidence.realBrowserE2ePassed === true
    && verificationEvidence.fatalConsoleErrors === 0
    && verificationEvidence.dataLeakageObserved === false;
  if (status === PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT && !verificationReady) {
    status = PILOT_READINESS_STATUS.HOLD_VERIFICATION;
    reasonCodes.push('RELEASE_OR_BROWSER_VERIFICATION_INCOMPLETE');
  }

  const allowedUsers = Number(pilotControls.maxUsers);
  const pilotControlReady = Number.isInteger(allowedUsers)
    && allowedUsers > 0
    && allowedUsers <= 5
    && pilotControls.inviteOnly === true
    && pilotControls.caseIsolationRequired === true
    && pilotControls.noProductionTransactionExecution === true
    && pilotControls.errorLoggingEnabled === true
    && pilotControls.rollbackPlanDocumented === true
    && pilotControls.userVerificationRequired === true;
  if (status === PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT && !pilotControlReady) {
    status = PILOT_READINESS_STATUS.HOLD_PILOT_CONTROLS;
    reasonCodes.push('CONTROLLED_PILOT_GUARDRAILS_INCOMPLETE');
  }

  const lifecycleReady = lifecycleExercise.studyToCommitteeExercised === true
    && lifecycleExercise.committeeDecisionToOutcomeExercised === true
    && lifecycleExercise.outcomeToLearningExercised === true
    && lifecycleExercise.syntheticOrQuasiRealCaseDeclared === true
    && lifecycleExercise.noAutomatedDecisionObserved === true
    && lifecycleExercise.noTransactionAuthorizationObserved === true
    && Array.isArray(lifecycleExercise.evidenceRefs)
    && lifecycleExercise.evidenceRefs.length > 0;
  if (status === PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT && !lifecycleReady) {
    status = PILOT_READINESS_STATUS.HOLD_LIFECYCLE_EXERCISE;
    reasonCodes.push('STUDY_TO_IC_TO_OUTCOME_TO_LEARNING_EXERCISE_INCOMPLETE');
  }

  return Object.freeze({
    schemaVersion: 2,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    readyForControlledPilot: status === PILOT_READINESS_STATUS.READY_FOR_CONTROLLED_PILOT,
    pilotScope: Object.freeze({
      maxUsers: Number.isFinite(allowedUsers) ? allowedUsers : null,
      inviteOnly: pilotControls.inviteOnly === true,
      noProductionTransactionExecution: pilotControls.noProductionTransactionExecution === true,
    }),
    gates: Object.freeze({
      studyFlow: studyReady,
      securityEvidence: securityReady,
      releaseAndBrowserVerification: verificationReady,
      pilotControls: pilotControlReady,
      lifecycleExercise: lifecycleReady,
    }),
    lifecycleEvidenceRefs: Object.freeze([...(lifecycleExercise.evidenceRefs || [])]),
    independentSecurityReviewRequired: true,
    productionSecurityVerified: false,
    productionDeploymentAuthorized: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'READY_FOR_CONTROLLED_PILOT means the bounded pilot prerequisites supplied to this gate are complete for a small invite-only pilot. It is not production readiness, security certification, legal approval, transaction authorization, or evidence that external systems were integrated.',
  });
}

module.exports = {
  PILOT_READINESS_STATUS,
  buildControlledPilotReadinessV2,
};
