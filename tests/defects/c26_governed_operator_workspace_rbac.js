'use strict';

const assert = require('assert');
const {
  ROLE, ACTION, STATUS,
  createOperatorSession, createWorkspaceAction, evaluateOperatorWorkspaceAction,
} = require('../../src/operator/governed-operator-workspace');

const H = (c) => c.repeat(64);
const CASE = Object.freeze({
  caseId: 'CASE-C26',
  propertyRef: 'PROP-C26',
  status: 'HOLD',
  resultHashSha256: H('9'),
});
const AS_OF = '2026-10-01T17:00:00Z';

function session(role, overrides = {}) {
  return createOperatorSession({
    sessionId: `SESSION-${role}`,
    userRef: `USER-${role}`,
    role,
    caseId: CASE.caseId,
    propertyRef: CASE.propertyRef,
    issuedAt: '2026-10-01T16:00:00Z',
    validUntil: '2026-10-01T18:00:00Z',
    authenticationEvidenceRef: `AUTH-EVIDENCE-${role}`,
    authenticationEvidenceHashSha256: H('a'),
    mfaVerified: true,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    ...overrides,
  });
}

let seq = 0;
function action(s, actionType, payload = {}, overrides = {}) {
  seq += 1;
  return createWorkspaceAction({
    actionId: `ACTION-C26-${seq}`,
    sessionHashSha256: s.sessionHashSha256,
    caseId: CASE.caseId,
    propertyRef: CASE.propertyRef,
    action: actionType,
    payload,
    requestedAt: '2026-10-01T16:30:00Z',
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    productionDeploymentAuthorized: false,
    autonomousActionExecuted: false,
    ...overrides,
  });
}

const viewer = session(ROLE.VIEWER);
const viewResult = evaluateOperatorWorkspaceAction({session: viewer, workspaceAction: action(viewer, ACTION.VIEW_CASE), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(viewResult.status, STATUS.ALLOWED);
assert.strictEqual(viewResult.actionAllowed, true);
assert.strictEqual(viewResult.deterministicStateBefore, 'HOLD');
assert.strictEqual(viewResult.deterministicStateAfter, 'HOLD');
assert.strictEqual(viewResult.deterministicStateOverrideApplied, false);
assert.strictEqual(viewResult.transactionAuthorized, false);
assert.strictEqual(viewResult.approvalAuthorized, false);
assert.strictEqual(viewResult.publicAiAuthorized, false);
assert.strictEqual(viewResult.productionDeploymentAuthorized, false);
assert.strictEqual(viewResult.commercialGoLive, 'HOLD');

const viewerDenied = evaluateOperatorWorkspaceAction({session: viewer, workspaceAction: action(viewer, ACTION.REQUEST_EVIDENCE, {requestRef:'REQ-1'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(viewerDenied.status, STATUS.DENIED_PERMISSION);
assert.strictEqual(viewerDenied.actionAllowed, false);

const analyst = session(ROLE.ANALYST);
const analystRequest = evaluateOperatorWorkspaceAction({session: analyst, workspaceAction: action(analyst, ACTION.REQUEST_EVIDENCE, {requestRef:'REQ-2', evidenceClass:'TITLE_EVIDENCE'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(analystRequest.status, STATUS.ALLOWED);
assert.strictEqual(analystRequest.deterministicStateAfter, 'HOLD');

const reviewer = session(ROLE.REVIEWER);
const review = evaluateOperatorWorkspaceAction({session: reviewer, workspaceAction: action(reviewer, ACTION.SUBMIT_REVIEW_DISPOSITION, {disposition:'EVIDENCE_REQUIRED', reviewEvidenceRef:'HUMAN-REVIEW-EVIDENCE'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(review.status, STATUS.ALLOWED);
assert.strictEqual(review.deterministicStateAfter, 'HOLD');
assert.strictEqual(review.approvalAuthorized, false);

const approver = session(ROLE.APPROVER);
const acknowledgement = evaluateOperatorWorkspaceAction({session: approver, workspaceAction: action(approver, ACTION.HUMAN_REVIEW_ACKNOWLEDGEMENT, {acknowledgementRef:'ACK-1'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(acknowledgement.status, STATUS.ALLOWED);
assert.strictEqual(acknowledgement.approvalAuthorized, false);
assert.strictEqual(acknowledgement.transactionAuthorized, false);
assert.strictEqual(acknowledgement.deterministicStateAfter, 'HOLD');

const ops = session(ROLE.OPS_ADMIN);
const triage = evaluateOperatorWorkspaceAction({session: ops, workspaceAction: action(ops, ACTION.OPERATIONS_TRIAGE, {ticketRef:'OPS-1'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(triage.status, STATUS.ALLOWED);
assert.strictEqual(triage.autonomousActionExecuted, false);

const wrongContext = action(analyst, ACTION.VIEW_CASE, {}, {caseId:'OTHER-CASE'});
const contextResult = evaluateOperatorWorkspaceAction({session: analyst, workspaceAction: wrongContext, caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(contextResult.status, STATUS.HOLD_CONTEXT);
assert.strictEqual(contextResult.blocker, 'C26_CONTEXT_CASE_PROPERTY_SESSION_MISMATCH');

const tamperedSession = {...reviewer, userRef:'ATTACKER'};
const tamperedResult = evaluateOperatorWorkspaceAction({session: tamperedSession, workspaceAction: action(reviewer, ACTION.VIEW_EVIDENCE), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(tamperedResult.status, STATUS.HOLD_INTEGRITY);
assert.strictEqual(tamperedResult.actionAllowed, false);

const expired = session(ROLE.ANALYST, {sessionId:'SESSION-EXPIRED', validUntil:'2026-10-01T16:45:00Z'});
const expiredResult = evaluateOperatorWorkspaceAction({session: expired, workspaceAction: action(expired, ACTION.VIEW_CASE, {}, {requestedAt:'2026-10-01T16:30:00Z'}), caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(expiredResult.status, STATUS.HOLD_TEMPORAL);

assert.throws(() => createWorkspaceAction({
  actionId:'ACTION-INJECTION', sessionHashSha256:approver.sessionHashSha256, caseId:CASE.caseId, propertyRef:CASE.propertyRef,
  action:ACTION.HUMAN_REVIEW_ACKNOWLEDGEMENT, payload:{approvalAuthorized:true}, requestedAt:'2026-10-01T16:30:00Z',
}), /C26_AUTHORITY_INJECTION_FORBIDDEN/);

assert.throws(() => createOperatorSession({
  sessionId:'SESSION-BAD', userRef:'USER-BAD', role:ROLE.APPROVER, caseId:CASE.caseId, propertyRef:CASE.propertyRef,
  issuedAt:'2026-10-01T16:00:00Z', validUntil:'2026-10-01T18:00:00Z', authenticationEvidenceRef:'AUTH', authenticationEvidenceHashSha256:H('b'),
  mfaVerified:true, approvalAuthorized:true,
}), /C26_AUTHORITY_INJECTION_FORBIDDEN/);

const replayAction = action(viewer, ACTION.VIEW_EVIDENCE, {evidenceRef:'E-1'});
const replay1 = evaluateOperatorWorkspaceAction({session: viewer, workspaceAction: replayAction, caseSnapshot: CASE, asOf: AS_OF});
const replay2 = evaluateOperatorWorkspaceAction({session: viewer, workspaceAction: replayAction, caseSnapshot: CASE, asOf: AS_OF});
assert.strictEqual(replay1.auditEvent.auditEventHashSha256, replay2.auditEvent.auditEventHashSha256);
assert.strictEqual(replay1.resultHashSha256, replay2.resultHashSha256);

console.log('C26_GOVERNED_OPERATOR_WORKSPACE_RBAC=PASS');
