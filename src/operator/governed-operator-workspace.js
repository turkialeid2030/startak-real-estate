'use strict';

const crypto = require('crypto');

const ROLE = Object.freeze({
  VIEWER: 'VIEWER',
  ANALYST: 'ANALYST',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER',
  OPS_ADMIN: 'OPS_ADMIN',
});

const ACTION = Object.freeze({
  VIEW_CASE: 'VIEW_CASE',
  VIEW_EVIDENCE: 'VIEW_EVIDENCE',
  REQUEST_EVIDENCE: 'REQUEST_EVIDENCE',
  SUBMIT_ANALYST_NOTE: 'SUBMIT_ANALYST_NOTE',
  SUBMIT_REVIEW_DISPOSITION: 'SUBMIT_REVIEW_DISPOSITION',
  GENERATE_DRAFT_REPORT: 'GENERATE_DRAFT_REPORT',
  ACKNOWLEDGE_HOLD: 'ACKNOWLEDGE_HOLD',
  HUMAN_REVIEW_ACKNOWLEDGEMENT: 'HUMAN_REVIEW_ACKNOWLEDGEMENT',
  OPERATIONS_TRIAGE: 'OPERATIONS_TRIAGE',
});

const STATUS = Object.freeze({
  ALLOWED: 'ALLOWED',
  DENIED_PERMISSION: 'DENIED_PERMISSION',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_TEMPORAL: 'HOLD_TEMPORAL',
  HOLD_AUTHORITY_INJECTION: 'HOLD_AUTHORITY_INJECTION',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLE.VIEWER]: Object.freeze([ACTION.VIEW_CASE, ACTION.VIEW_EVIDENCE]),
  [ROLE.ANALYST]: Object.freeze([
    ACTION.VIEW_CASE, ACTION.VIEW_EVIDENCE, ACTION.REQUEST_EVIDENCE,
    ACTION.SUBMIT_ANALYST_NOTE, ACTION.GENERATE_DRAFT_REPORT,
  ]),
  [ROLE.REVIEWER]: Object.freeze([
    ACTION.VIEW_CASE, ACTION.VIEW_EVIDENCE, ACTION.REQUEST_EVIDENCE,
    ACTION.SUBMIT_ANALYST_NOTE, ACTION.SUBMIT_REVIEW_DISPOSITION,
    ACTION.GENERATE_DRAFT_REPORT, ACTION.ACKNOWLEDGE_HOLD,
  ]),
  [ROLE.APPROVER]: Object.freeze([
    ACTION.VIEW_CASE, ACTION.VIEW_EVIDENCE, ACTION.REQUEST_EVIDENCE,
    ACTION.SUBMIT_ANALYST_NOTE, ACTION.SUBMIT_REVIEW_DISPOSITION,
    ACTION.GENERATE_DRAFT_REPORT, ACTION.ACKNOWLEDGE_HOLD,
    ACTION.HUMAN_REVIEW_ACKNOWLEDGEMENT,
  ]),
  [ROLE.OPS_ADMIN]: Object.freeze([
    ACTION.VIEW_CASE, ACTION.VIEW_EVIDENCE, ACTION.ACKNOWLEDGE_HOLD,
    ACTION.OPERATIONS_TRIAGE,
  ]),
});

const SHA256_RE = /^[a-f0-9]{64}$/;
const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'transactionAuthorized',
  'approvalAuthorized',
  'publicAiAuthorized',
  'productionDeploymentAuthorized',
  'commercialGoLive',
  'canonicalBaselineActivationAuthorized',
  'autonomousActionExecuted',
  'decisionStateOverride',
  'deterministicStateOverride',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value;
}

function requireSha(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(code);
  return value;
}

function requireIso(value, code) {
  requireText(value, code);
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
  return value;
}

function hasForbiddenAuthorityKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbiddenAuthorityKey);
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_AUTHORITY_KEYS.has(key) || hasForbiddenAuthorityKey(nested));
}

function sessionMaterial(input) {
  return {
    sessionId: input.sessionId,
    userRef: input.userRef,
    role: input.role,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    issuedAt: input.issuedAt,
    validUntil: input.validUntil,
    authenticationEvidenceRef: input.authenticationEvidenceRef,
    authenticationEvidenceHashSha256: input.authenticationEvidenceHashSha256,
    permissionSetHashSha256: input.permissionSetHashSha256,
    mfaVerified: input.mfaVerified,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
  };
}

function createOperatorSession(input) {
  if (!input || typeof input !== 'object') throw new Error('C26_SESSION_REQUIRED');
  if (!Object.values(ROLE).includes(input.role)) throw new Error('C26_ROLE_UNKNOWN');
  if (input.transactionAuthorized === true || input.approvalAuthorized === true ||
      input.publicAiAuthorized === true || input.productionDeploymentAuthorized === true ||
      input.canonicalBaselineActivationAuthorized === true) {
    throw new Error('C26_AUTHORITY_INJECTION_FORBIDDEN');
  }
  const permissions = ROLE_PERMISSIONS[input.role];
  const session = sessionMaterial({
    sessionId: requireText(input.sessionId, 'C26_SESSION_ID_REQUIRED'),
    userRef: requireText(input.userRef, 'C26_USER_REF_REQUIRED'),
    role: input.role,
    caseId: requireText(input.caseId, 'C26_CASE_ID_REQUIRED'),
    propertyRef: requireText(input.propertyRef, 'C26_PROPERTY_REF_REQUIRED'),
    issuedAt: requireIso(input.issuedAt, 'C26_ISSUED_AT_INVALID'),
    validUntil: requireIso(input.validUntil, 'C26_VALID_UNTIL_INVALID'),
    authenticationEvidenceRef: requireText(input.authenticationEvidenceRef, 'C26_AUTH_EVIDENCE_REF_REQUIRED'),
    authenticationEvidenceHashSha256: requireSha(input.authenticationEvidenceHashSha256, 'C26_AUTH_EVIDENCE_HASH_INVALID'),
    permissionSetHashSha256: sha256(permissions.slice().sort()),
    mfaVerified: input.mfaVerified === true,
  });
  if (Date.parse(session.validUntil) <= Date.parse(session.issuedAt)) throw new Error('C26_SESSION_WINDOW_INVALID');
  return Object.freeze({ ...session, sessionHashSha256: sha256(session) });
}

function actionMaterial(input) {
  return {
    actionId: input.actionId,
    sessionHashSha256: input.sessionHashSha256,
    caseId: input.caseId,
    propertyRef: input.propertyRef,
    action: input.action,
    payloadHashSha256: input.payloadHashSha256,
    requestedAt: input.requestedAt,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    autonomousActionExecuted: false,
  };
}

function createWorkspaceAction(input) {
  if (!input || typeof input !== 'object') throw new Error('C26_ACTION_REQUIRED');
  if (!Object.values(ACTION).includes(input.action)) throw new Error('C26_ACTION_UNKNOWN');
  if (hasForbiddenAuthorityKey(input.payload)) throw new Error('C26_AUTHORITY_INJECTION_FORBIDDEN');
  if (input.transactionAuthorized === true || input.approvalAuthorized === true ||
      input.publicAiAuthorized === true || input.productionDeploymentAuthorized === true ||
      input.autonomousActionExecuted === true) throw new Error('C26_AUTHORITY_INJECTION_FORBIDDEN');
  const payload = input.payload === undefined ? {} : input.payload;
  const action = actionMaterial({
    actionId: requireText(input.actionId, 'C26_ACTION_ID_REQUIRED'),
    sessionHashSha256: requireSha(input.sessionHashSha256, 'C26_SESSION_HASH_INVALID'),
    caseId: requireText(input.caseId, 'C26_ACTION_CASE_ID_REQUIRED'),
    propertyRef: requireText(input.propertyRef, 'C26_ACTION_PROPERTY_REF_REQUIRED'),
    action: input.action,
    payloadHashSha256: sha256(payload),
    requestedAt: requireIso(input.requestedAt, 'C26_ACTION_REQUESTED_AT_INVALID'),
  });
  return Object.freeze({ ...action, payload: canonicalize(payload), actionHashSha256: sha256(action) });
}

function auditEvent({ status, blocker, session, workspaceAction, caseSnapshot, evaluatedAt }) {
  const material = {
    eventType: 'C26_OPERATOR_WORKSPACE_ACTION_EVALUATED',
    status,
    blocker: blocker || null,
    sessionHashSha256: session.sessionHashSha256,
    actionHashSha256: workspaceAction.actionHashSha256,
    caseResultHashSha256: caseSnapshot.resultHashSha256,
    caseId: caseSnapshot.caseId,
    propertyRef: caseSnapshot.propertyRef,
    deterministicState: caseSnapshot.status,
    evaluatedAt,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    autonomousActionExecuted: false,
  };
  return Object.freeze({ ...material, auditEventHashSha256: sha256(material) });
}

function evaluateOperatorWorkspaceAction({ session, workspaceAction, caseSnapshot, asOf }) {
  requireIso(asOf, 'C26_AS_OF_INVALID');
  if (!session || !workspaceAction || !caseSnapshot) throw new Error('C26_EVALUATION_INPUT_REQUIRED');
  requireSha(caseSnapshot.resultHashSha256, 'C26_CASE_RESULT_HASH_INVALID');
  requireText(caseSnapshot.caseId, 'C26_CASE_SNAPSHOT_ID_REQUIRED');
  requireText(caseSnapshot.propertyRef, 'C26_CASE_SNAPSHOT_PROPERTY_REQUIRED');
  requireText(caseSnapshot.status, 'C26_CASE_SNAPSHOT_STATUS_REQUIRED');

  let status = STATUS.ALLOWED;
  let blocker = null;

  const expectedPermissionHash = Object.values(ROLE).includes(session.role)
    ? sha256(ROLE_PERMISSIONS[session.role].slice().sort()) : null;
  const expectedSessionHash = sha256(sessionMaterial(session));
  const expectedActionHash = sha256(actionMaterial(workspaceAction));

  if (!Object.values(ROLE).includes(session.role) ||
      session.permissionSetHashSha256 !== expectedPermissionHash ||
      session.sessionHashSha256 !== expectedSessionHash ||
      workspaceAction.actionHashSha256 !== expectedActionHash ||
      workspaceAction.payloadHashSha256 !== sha256(workspaceAction.payload)) {
    status = STATUS.HOLD_INTEGRITY;
    blocker = 'C26_INTEGRITY_AUTHORIZATION_OR_ACTION_TAMPERED';
  } else if (Date.parse(asOf) < Date.parse(session.issuedAt) || Date.parse(asOf) > Date.parse(session.validUntil) ||
             Date.parse(workspaceAction.requestedAt) < Date.parse(session.issuedAt) || Date.parse(workspaceAction.requestedAt) > Date.parse(session.validUntil)) {
    status = STATUS.HOLD_TEMPORAL;
    blocker = 'C26_TEMPORAL_SESSION_NOT_VALID';
  } else if (session.caseId !== caseSnapshot.caseId || session.propertyRef !== caseSnapshot.propertyRef ||
             workspaceAction.caseId !== caseSnapshot.caseId || workspaceAction.propertyRef !== caseSnapshot.propertyRef ||
             workspaceAction.sessionHashSha256 !== session.sessionHashSha256) {
    status = STATUS.HOLD_CONTEXT;
    blocker = 'C26_CONTEXT_CASE_PROPERTY_SESSION_MISMATCH';
  } else if (hasForbiddenAuthorityKey(workspaceAction.payload)) {
    status = STATUS.HOLD_AUTHORITY_INJECTION;
    blocker = 'C26_AUTHORITY_INJECTION_FORBIDDEN';
  } else if (!ROLE_PERMISSIONS[session.role].includes(workspaceAction.action)) {
    status = STATUS.DENIED_PERMISSION;
    blocker = `C26_PERMISSION_DENIED:${session.role}:${workspaceAction.action}`;
  }

  const event = auditEvent({ status, blocker, session, workspaceAction, caseSnapshot, evaluatedAt: asOf });
  return Object.freeze({
    status,
    blocker,
    actionAllowed: status === STATUS.ALLOWED,
    role: session.role,
    action: workspaceAction.action,
    caseId: caseSnapshot.caseId,
    propertyRef: caseSnapshot.propertyRef,
    deterministicStateBefore: caseSnapshot.status,
    deterministicStateAfter: caseSnapshot.status,
    deterministicStateOverrideApplied: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    commercialGoLive: 'HOLD',
    canonicalBaselineActivationAuthorized: false,
    autonomousActionExecuted: false,
    auditEvent: event,
    resultHashSha256: sha256(event),
  });
}

module.exports = {
  ROLE,
  ACTION,
  STATUS,
  ROLE_PERMISSIONS,
  createOperatorSession,
  createWorkspaceAction,
  evaluateOperatorWorkspaceAction,
};
