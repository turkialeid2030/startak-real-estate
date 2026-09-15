'use strict';

const OVERALL_DECISION_STATUS = Object.freeze({
  INCOMPLETE: 'INCOMPLETE',
  HOLD: 'HOLD',
  FINANCIAL_PASS: 'FINANCIAL_PASS',
  DUE_DILIGENCE_REQUIRED: 'DUE_DILIGENCE_REQUIRED',
  READY_FOR_IC: 'READY_FOR_IC',
  IC_APPROVED: 'IC_APPROVED',
  REJECT: 'REJECT',
  NOT_AUTHORIZED_FOR_TRANSACTION: 'NOT_AUTHORIZED_FOR_TRANSACTION',
});

const TRANSACTION_AUTHORITY = Object.freeze({
  NONE: 'NONE',
  ANALYSIS_ONLY: 'ANALYSIS_ONLY',
  INTERNAL_REVIEW: 'INTERNAL_REVIEW',
  IC_AUTHORIZED: 'IC_AUTHORIZED',
  EXECUTION_AUTHORIZED: 'EXECUTION_AUTHORIZED',
});

const EVIDENCE_READINESS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  INSUFFICIENT: 'INSUFFICIENT',
  PARTIAL: 'PARTIAL',
  SUFFICIENT_FOR_ANALYSIS: 'SUFFICIENT_FOR_ANALYSIS',
  SUFFICIENT_FOR_IC: 'SUFFICIENT_FOR_IC',
  STALE: 'STALE',
  CONFLICTED: 'CONFLICTED',
});

const COMPLETE_DD = new Set(['PASS', 'COMPLETE', 'CLEARED', 'NOT_APPLICABLE']);
const FINANCIAL_FAIL = new Set(['FAIL', 'REJECT', 'FAILED', 'FINANCIALLY_UNATTRACTIVE']);
const FINANCIAL_PASS = new Set(['PASS', 'PASSED', 'FINANCIAL_PASS', 'FINANCIALLY_ATTRACTIVE']);

function normalize(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function evaluateOverallDecisionGate(input = {}) {
  const reasons = [];
  const financial = normalize(input.financialDecision);
  const evidence = normalize(input.evidenceReadiness);
  const authority = normalize(input.transactionAuthority || TRANSACTION_AUTHORITY.ANALYSIS_ONLY);
  const requiredApprovals = Array.isArray(input.requiredApprovals) ? input.requiredApprovals : [];
  const missingEvidence = Array.isArray(input.missingEvidence) ? input.missingEvidence : [];
  const criticalRiskFlags = Array.isArray(input.criticalRiskFlags) ? input.criticalRiskFlags : [];
  const dd = [input.legalStatus, input.regulatoryStatus, input.technicalStatus].map(normalize);
  const financing = normalize(input.financingStatus || 'NOT_APPLICABLE');
  const valuation = normalize(input.valuationReadiness);

  if (!input.modelVersion || !financial || !evidence || !valuation || dd.some((x) => !x)) {
    reasons.push('CRITICAL_GATE_INPUT_INCOMPLETE');
    return result(OVERALL_DECISION_STATUS.INCOMPLETE, reasons, authority, input.modelVersion);
  }
  if (FINANCIAL_FAIL.has(financial)) {
    reasons.push('FINANCIAL_ANALYSIS_FAILED');
    return result(OVERALL_DECISION_STATUS.REJECT, reasons, authority, input.modelVersion);
  }
  if (!FINANCIAL_PASS.has(financial)) {
    reasons.push('FINANCIAL_ANALYSIS_NOT_PASSED');
    return result(OVERALL_DECISION_STATUS.HOLD, reasons, authority, input.modelVersion);
  }
  reasons.push('FINANCIAL_ANALYSIS_PASSED_NOT_INVESTMENT_APPROVAL');

  if (criticalRiskFlags.length) {
    reasons.push('CRITICAL_RISK_FLAGS_PRESENT');
    return result(OVERALL_DECISION_STATUS.HOLD, reasons, authority, input.modelVersion);
  }
  if (missingEvidence.length || evidence !== EVIDENCE_READINESS.SUFFICIENT_FOR_IC) {
    reasons.push(evidence === EVIDENCE_READINESS.STALE ? 'EVIDENCE_STALE' : evidence === EVIDENCE_READINESS.CONFLICTED ? 'EVIDENCE_CONFLICTED' : 'EVIDENCE_NOT_SUFFICIENT_FOR_IC');
    return result(OVERALL_DECISION_STATUS.DUE_DILIGENCE_REQUIRED, reasons, authority, input.modelVersion);
  }
  if (!['READY', 'SUFFICIENT_FOR_IC', 'COMPLETE', 'PASS'].includes(valuation)) {
    reasons.push('VALUATION_READINESS_INCOMPLETE');
    return result(OVERALL_DECISION_STATUS.DUE_DILIGENCE_REQUIRED, reasons, authority, input.modelVersion);
  }
  if (dd.some((x) => !COMPLETE_DD.has(x)) || !COMPLETE_DD.has(financing)) {
    reasons.push('DUE_DILIGENCE_GATE_INCOMPLETE');
    return result(OVERALL_DECISION_STATUS.DUE_DILIGENCE_REQUIRED, reasons, authority, input.modelVersion);
  }
  const outstanding = requiredApprovals.filter((approval) => !approval || normalize(approval.status) !== 'GRANTED');
  if (outstanding.length) {
    reasons.push('REQUIRED_APPROVALS_OUTSTANDING');
    return result(OVERALL_DECISION_STATUS.HOLD, reasons, authority, input.modelVersion);
  }
  if (authority === TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED) {
    reasons.push('READY_FOR_IC_TRANSACTION_AUTHORITY_SEPARATE');
    return result(OVERALL_DECISION_STATUS.READY_FOR_IC, reasons, authority, input.modelVersion);
  }
  reasons.push('READY_FOR_INVESTMENT_COMMITTEE_REVIEW');
  return result(OVERALL_DECISION_STATUS.READY_FOR_IC, reasons, authority, input.modelVersion);
}

function result(status, reasonCodes, transactionAuthority, modelVersion) {
  return Object.freeze({
    status,
    reasonCodes: Object.freeze([...reasonCodes]),
    transactionAuthority: transactionAuthority || TRANSACTION_AUTHORITY.ANALYSIS_ONLY,
    modelVersion: modelVersion || null,
    financialPassIsInvestmentApproval: false,
    transactionAuthorized: transactionAuthority === TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED,
  });
}

module.exports = { OVERALL_DECISION_STATUS, TRANSACTION_AUTHORITY, EVIDENCE_READINESS, evaluateOverallDecisionGate };
