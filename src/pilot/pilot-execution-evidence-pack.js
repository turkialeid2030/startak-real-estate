'use strict';

const PILOT_EXECUTION_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_READINESS: 'HOLD_READINESS',
  HOLD_EXECUTION_EVIDENCE: 'HOLD_EXECUTION_EVIDENCE',
  HOLD_INCIDENTS: 'HOLD_INCIDENTS',
  HOLD_USER_LIMIT: 'HOLD_USER_LIMIT',
  HOLD_ROLLBACK: 'HOLD_ROLLBACK',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildPilotExecutionEvidencePack({
  caseId,
  projectId,
  readiness,
  execution,
  users = [],
  incidents = [],
  rollback,
  evidenceRefs = [],
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(readiness, 'readiness');
  requiredObject(execution, 'execution');
  requiredObject(rollback, 'rollback');
  if (!Array.isArray(users)) throw new TypeError('users must be an array');
  if (!Array.isArray(incidents)) throw new TypeError('incidents must be an array');
  if (!Array.isArray(evidenceRefs)) throw new TypeError('evidenceRefs must be an array');

  if (readiness.caseId !== scopedCaseId || readiness.projectId !== scopedProjectId
      || execution.caseId !== scopedCaseId || execution.projectId !== scopedProjectId) {
    const error = new Error('PILOT_EXECUTION_SCOPE_MISMATCH');
    error.code = PILOT_EXECUTION_STATUS.HOLD_SCOPE_MISMATCH;
    throw error;
  }

  if (readiness.status !== 'READY_FOR_CONTROLLED_PILOT') {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: PILOT_EXECUTION_STATUS.HOLD_READINESS,
      reasonCodes: Object.freeze(['CONTROLLED_PILOT_READINESS_REQUIRED']),
      productionReady: false,
      transactionAuthorized: false,
    });
  }

  if (users.length === 0 || users.length > 5 || users.some((u) => !u || u.inviteOnly !== true || u.verified !== true)) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT,
      reasonCodes: Object.freeze(['PILOT_USERS_MUST_BE_VERIFIED_INVITE_ONLY_AND_AT_MOST_FIVE']),
      productionReady: false,
      transactionAuthorized: false,
    });
  }

  const requiredExecutionChecks = [
    'studyCompleted',
    'committeeFlowExercised',
    'outcomeFeedbackExercised',
    'learningReviewExercised',
    'caseIsolationObserved',
    'errorLoggingObserved',
    'realBrowserPathObserved',
  ];
  const failedChecks = requiredExecutionChecks.filter((key) => execution[key] !== true);
  if (failedChecks.length || !execution.startedAt || !execution.completedAt) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE,
      reasonCodes: Object.freeze(failedChecks.length ? failedChecks.map((k) => `MISSING_${k.toUpperCase()}`) : ['PILOT_EXECUTION_TIMESTAMPS_REQUIRED']),
      productionReady: false,
      transactionAuthorized: false,
    });
  }

  const unresolvedCriticalIncidents = incidents.filter((item) => item && item.severity === 'CRITICAL' && item.resolved !== true);
  const leakageIncidents = incidents.filter((item) => item && item.type === 'DATA_LEAKAGE');
  if (unresolvedCriticalIncidents.length || leakageIncidents.length) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: PILOT_EXECUTION_STATUS.HOLD_INCIDENTS,
      reasonCodes: Object.freeze([
        ...(unresolvedCriticalIncidents.length ? ['UNRESOLVED_CRITICAL_INCIDENTS'] : []),
        ...(leakageIncidents.length ? ['DATA_LEAKAGE_INCIDENT_RECORDED'] : []),
      ]),
      productionReady: false,
      transactionAuthorized: false,
    });
  }

  if (rollback.documented !== true || rollback.exercised !== true || !rollback.evidenceRef) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: PILOT_EXECUTION_STATUS.HOLD_ROLLBACK,
      reasonCodes: Object.freeze(['DOCUMENTED_AND_EXERCISED_ROLLBACK_REQUIRED']),
      productionReady: false,
      transactionAuthorized: false,
    });
  }

  const normalizedRefs = evidenceRefs.map((ref, index) => requiredString(ref, `evidenceRefs[${index}]`));
  if (!normalizedRefs.length) throw new Error('PILOT_EVIDENCE_REFS_REQUIRED');

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status: PILOT_EXECUTION_STATUS.EVIDENCE_PACK_COMPLETE,
    pilotWindow: Object.freeze({ startedAt: execution.startedAt, completedAt: execution.completedAt }),
    participantCount: users.length,
    incidentCount: incidents.length,
    unresolvedCriticalIncidentCount: unresolvedCriticalIncidents.length,
    dataLeakageIncidentCount: leakageIncidents.length,
    rollbackEvidenceRef: String(rollback.evidenceRef),
    evidenceRefs: Object.freeze(normalizedRefs),
    lifecycleEvidence: Object.freeze({
      study: execution.studyCompleted === true,
      committee: execution.committeeFlowExercised === true,
      outcome: execution.outcomeFeedbackExercised === true,
      learning: execution.learningReviewExercised === true,
    }),
    readyForProductionReadinessAudit: true,
    productionReady: false,
    productionSecurityVerified: false,
    legalApprovalEstablished: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'This pack records bounded controlled-pilot execution evidence. Completion only permits a production-readiness audit; it is not production approval, security certification, legal approval, or transaction authorization.',
  });
}

module.exports = {
  PILOT_EXECUTION_STATUS,
  buildPilotExecutionEvidencePack,
};
