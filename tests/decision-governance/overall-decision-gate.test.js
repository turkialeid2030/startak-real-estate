'use strict';
const assert = require('assert');
const { evaluateOverallDecisionGate, EVIDENCE_READINESS, TRANSACTION_AUTHORITY } = require('../../src/decision-governance/overall-decision-gate');

const base = {
  financialDecision: 'PASS', valuationReadiness: 'READY', evidenceReadiness: EVIDENCE_READINESS.SUFFICIENT_FOR_IC,
  legalStatus: 'PASS', regulatoryStatus: 'PASS', technicalStatus: 'PASS', financingStatus: 'NOT_APPLICABLE',
  criticalRiskFlags: [], requiredApprovals: [], missingEvidence: [], modelVersion: 'decision-governance-v1',
  transactionAuthority: TRANSACTION_AUTHORITY.ANALYSIS_ONLY,
};

function run() {
  let r = evaluateOverallDecisionGate({ ...base, legalStatus: 'UNRESOLVED' });
  assert.strictEqual(r.status, 'DUE_DILIGENCE_REQUIRED');
  assert.strictEqual(r.transactionAuthorized, false);

  r = evaluateOverallDecisionGate({ ...base, evidenceReadiness: EVIDENCE_READINESS.INSUFFICIENT });
  assert.strictEqual(r.status, 'DUE_DILIGENCE_REQUIRED');

  r = evaluateOverallDecisionGate({ ...base, financialDecision: 'FAIL' });
  assert.strictEqual(r.status, 'REJECT');

  r = evaluateOverallDecisionGate(base);
  assert.strictEqual(r.status, 'READY_FOR_IC');
  assert.strictEqual(r.financialPassIsInvestmentApproval, false);
  assert.strictEqual(r.transactionAuthorized, false);

  r = evaluateOverallDecisionGate({ ...base, missingEvidence: ['TITLE'] });
  assert.strictEqual(r.status, 'DUE_DILIGENCE_REQUIRED');

  r = evaluateOverallDecisionGate({ ...base, criticalRiskFlags: ['CRITICAL_TITLE_RISK'] });
  assert.strictEqual(r.status, 'HOLD');

  r = evaluateOverallDecisionGate({ ...base, modelVersion: null });
  assert.strictEqual(r.status, 'INCOMPLETE');

  // Invalid or invented authority values fail closed and cannot be reflected as authorization.
  r = evaluateOverallDecisionGate({ ...base, transactionAuthority: 'FINANCIAL_PASS' });
  assert.strictEqual(r.status, 'INCOMPLETE');
  assert.ok(r.reasonCodes.includes('TRANSACTION_AUTHORITY_INVALID'));
  assert.strictEqual(r.transactionAuthority, TRANSACTION_AUTHORITY.ANALYSIS_ONLY);
  assert.strictEqual(r.transactionAuthorized, false);

  r = evaluateOverallDecisionGate({ ...base, transactionAuthority: TRANSACTION_AUTHORITY.EXECUTION_AUTHORIZED });
  assert.strictEqual(r.status, 'READY_FOR_IC');
  assert.strictEqual(r.financialPassIsInvestmentApproval, false);
  assert.strictEqual(r.transactionAuthorized, true);

  console.log('OVERALL_DECISION_GATE_TESTS=PASS');
}
run();
