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

function hold(caseId, projectId, status, reasonCodes) {
  return Object.freeze({
    schemaVersion: 2,
    caseId,
    projectId,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    productionReady: false,
    transactionAuthorized: false,
  });
}

function parseEvidenceTimestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const raw = value.trim();
  // Require an explicit timezone so pilot chronology is not host-locale dependent.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) return null;
  const epochMs = Date.parse(raw);
  if (!Number.isFinite(epochMs)) return null;
  return Object.freeze({ raw, epochMs, canonical: new Date(epochMs).toISOString() });
}

function normalizeEvidenceRefs(evidenceRefs) {
  const normalized = evidenceRefs.map((ref, index) => requiredString(ref, `evidenceRefs[${index}]`));
  return Object.freeze([...new Set(normalized)]);
}

function validatePilotUsers(users) {
  if (users.length === 0 || users.length > 5) return false;
  const userRefs = [];
  for (const user of users) {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return false;
    if (user.inviteOnly !== true || user.verified !== true) return false;
    if (typeof user.userRef !== 'string' || user.userRef.trim() === '') return false;
    userRefs.push(user.userRef.trim());
  }
  return new Set(userRefs).size === userRefs.length;
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
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_READINESS, ['CONTROLLED_PILOT_READINESS_REQUIRED']);
  }

  if (!validatePilotUsers(users)) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_USER_LIMIT, [
      'PILOT_USERS_MUST_BE_UNIQUE_VERIFIED_INVITE_ONLY_AND_AT_MOST_FIVE',
    ]);
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
  if (failedChecks.length) {
    return hold(
      scopedCaseId,
      scopedProjectId,
      PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE,
      failedChecks.map((key) => `MISSING_${key.toUpperCase()}`),
    );
  }

  const startedAt = parseEvidenceTimestamp(execution.startedAt);
  const completedAt = parseEvidenceTimestamp(execution.completedAt);
  if (!startedAt || !completedAt) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE, [
      'PILOT_EXECUTION_TIMESTAMPS_MUST_BE_VALID_AND_TIMEZONE_EXPLICIT',
    ]);
  }
  if (completedAt.epochMs <= startedAt.epochMs) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_EXECUTION_EVIDENCE, [
      'PILOT_EXECUTION_COMPLETED_AT_MUST_BE_AFTER_STARTED_AT',
    ]);
  }

  const unresolvedCriticalIncidents = incidents.filter((item) => item && item.severity === 'CRITICAL' && item.resolved !== true);
  const leakageIncidents = incidents.filter((item) => item && item.type === 'DATA_LEAKAGE');
  if (unresolvedCriticalIncidents.length || leakageIncidents.length) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_INCIDENTS, [
      ...(unresolvedCriticalIncidents.length ? ['UNRESOLVED_CRITICAL_INCIDENTS'] : []),
      ...(leakageIncidents.length ? ['DATA_LEAKAGE_INCIDENT_RECORDED'] : []),
    ]);
  }

  let rollbackEvidenceRef = null;
  if (rollback.documented === true && rollback.exercised === true
      && typeof rollback.evidenceRef === 'string' && rollback.evidenceRef.trim() !== '') {
    rollbackEvidenceRef = rollback.evidenceRef.trim();
  }
  if (!rollbackEvidenceRef) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK, [
      'DOCUMENTED_AND_EXERCISED_ROLLBACK_WITH_EVIDENCE_REF_REQUIRED',
    ]);
  }

  const normalizedRefs = normalizeEvidenceRefs(evidenceRefs);
  if (!normalizedRefs.length) throw new Error('PILOT_EVIDENCE_REFS_REQUIRED');
  if (!normalizedRefs.includes(rollbackEvidenceRef)) {
    return hold(scopedCaseId, scopedProjectId, PILOT_EXECUTION_STATUS.HOLD_ROLLBACK, [
      'ROLLBACK_EVIDENCE_REF_MUST_BE_BOUND_TO_EVIDENCE_PACK',
    ]);
  }

  return Object.freeze({
    schemaVersion: 2,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status: PILOT_EXECUTION_STATUS.EVIDENCE_PACK_COMPLETE,
    pilotWindow: Object.freeze({
      startedAt: startedAt.canonical,
      completedAt: completedAt.canonical,
      durationMs: completedAt.epochMs - startedAt.epochMs,
    }),
    participantCount: users.length,
    participantRefs: Object.freeze(users.map((user) => user.userRef.trim())),
    incidentCount: incidents.length,
    unresolvedCriticalIncidentCount: unresolvedCriticalIncidents.length,
    dataLeakageIncidentCount: leakageIncidents.length,
    rollbackEvidenceRef,
    evidenceRefs: normalizedRefs,
    lifecycleEvidence: Object.freeze({
      study: execution.studyCompleted === true,
      committee: execution.committeeFlowExercised === true,
      outcome: execution.outcomeFeedbackExercised === true,
      learning: execution.learningReviewExercised === true,
    }),
    evidenceIntegrity: Object.freeze({
      explicitTimezoneRequired: true,
      chronologyValidated: true,
      participantRefsUnique: true,
      evidenceRefsDeduplicated: true,
      rollbackEvidenceBound: true,
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
  parseEvidenceTimestamp,
  buildPilotExecutionEvidencePack,
};
