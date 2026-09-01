'use strict';

const { IC_CASE_STATUS } = require('./index');

const DECISION_RECORD_STATUS = Object.freeze({
  RECORDED: 'RECORDED',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_COMMITTEE_STATUS: 'HOLD_COMMITTEE_STATUS',
  HOLD_GOVERNANCE: 'HOLD_GOVERNANCE',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function buildHumanCommitteeDecisionRecord({
  caseId,
  projectId,
  committeeDecision,
  dossierRef,
  recordedBy,
  recordedAt,
} = {}) {
  const scopedCaseId = requiredString(caseId, 'caseId');
  const scopedProjectId = requiredString(projectId, 'projectId');
  requiredObject(committeeDecision, 'committeeDecision');
  const scopedDossierRef = requiredString(dossierRef, 'dossierRef');
  const recorder = requiredString(recordedBy, 'recordedBy');
  const timestamp = requiredString(recordedAt, 'recordedAt');

  if (committeeDecision.caseId !== scopedCaseId || committeeDecision.projectId !== scopedProjectId) {
    const error = new Error('COMMITTEE_DECISION_SCOPE_MISMATCH');
    error.code = DECISION_RECORD_STATUS.HOLD_SCOPE_MISMATCH;
    throw error;
  }

  if (committeeDecision.status !== IC_CASE_STATUS.DECIDED_BY_HUMANS || committeeDecision.humanDecision !== true || committeeDecision.automatedDecision !== false) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: DECISION_RECORD_STATUS.HOLD_COMMITTEE_STATUS,
      reasonCodes: Object.freeze(['HUMAN_COMMITTEE_DECISION_REQUIRED']),
      humanDecisionConfirmed: false,
      transactionAuthorized: false,
    });
  }

  const governance = committeeDecision.governance;
  if (!governance || governance.quorumMet !== true || (governance.declarationGaps || []).length > 0) {
    return Object.freeze({
      schemaVersion: 1,
      caseId: scopedCaseId,
      projectId: scopedProjectId,
      status: DECISION_RECORD_STATUS.HOLD_GOVERNANCE,
      reasonCodes: Object.freeze(['COMMITTEE_GOVERNANCE_NOT_SATISFIED']),
      humanDecisionConfirmed: false,
      transactionAuthorized: false,
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId: scopedCaseId,
    projectId: scopedProjectId,
    status: DECISION_RECORD_STATUS.RECORDED,
    dossierRef: scopedDossierRef,
    decision: committeeDecision.decision,
    conditions: Object.freeze([...(committeeDecision.conditions || [])]),
    rationale: committeeDecision.rationale || null,
    decidedAt: committeeDecision.decidedAt || null,
    voteSummary: committeeDecision.voteSummary || null,
    governance,
    recordedBy: recorder,
    recordedAt: timestamp,
    humanDecisionConfirmed: true,
    automatedDecision: false,
    transactionAuthorized: false,
    semantics: 'This record preserves a human committee decision and its governance evidence. It does not execute a transaction, satisfy external legal or regulatory approvals, or delegate authority to AI.',
  });
}

module.exports = {
  DECISION_RECORD_STATUS,
  buildHumanCommitteeDecisionRecord,
};
