'use strict';

const assert = require('assert');
const {
  ACTION_STATUS,
  ACTION_TYPE,
  createDecisionAction,
  assessActionClosure,
  buildDecisionActionRegister,
} = require('../../src/decision-actions');

const legalAction = createDecisionAction({
  actionId: 'ACT-LEGAL-1',
  caseId: 'CASE-A1',
  projectId: 'PROJECT-A1',
  type: ACTION_TYPE.LEGAL_REVIEW,
  description: 'Obtain licensed legal review of title restriction.',
  ownerId: 'OWNER-1',
  dueDate: '2026-09-15',
  requiresLicensedProfessional: true,
  requiredEvidenceKeys: ['titleRestrictionDocument', 'legalReviewDocument'],
  sourceDecisionRef: 'IC-DECISION-1',
});

let assessment = assessActionClosure({ action: legalAction, evidence: {} });
assert.strictEqual(assessment.status, ACTION_STATUS.BLOCKED);
assert.strictEqual(assessment.reason, 'REQUIRED_EVIDENCE_NOT_SATISFIED');
assert.strictEqual(assessment.missingEvidence.length, 2);

assessment = assessActionClosure({
  action: legalAction,
  evidence: { titleRestrictionDocument: true, legalReviewDocument: true },
});
assert.strictEqual(assessment.status, ACTION_STATUS.BLOCKED);
assert.strictEqual(assessment.reason, 'LICENSED_PROFESSIONAL_REVIEW_REQUIRED');

assessment = assessActionClosure({
  action: legalAction,
  evidence: { titleRestrictionDocument: true, legalReviewDocument: true },
  professionalReview: { outcome: 'SATISFIED', professionalType: 'LICENSED_LEGAL_COUNSEL', providerRef: 'PROVIDER-REF-1' },
});
assert.strictEqual(assessment.status, ACTION_STATUS.SATISFIED_PENDING_REVIEW);
assert.strictEqual(assessment.canClose, false);

assessment = assessActionClosure({
  action: legalAction,
  evidence: { titleRestrictionDocument: true, legalReviewDocument: true },
  professionalReview: { outcome: 'SATISFIED', professionalType: 'LICENSED_LEGAL_COUNSEL', providerRef: 'PROVIDER-REF-1' },
  reviewerId: 'HUMAN-REVIEWER-1',
  reviewedAt: '2026-09-10T12:00:00Z',
});
assert.strictEqual(assessment.status, ACTION_STATUS.CLOSED);
assert.strictEqual(assessment.canClose, true);
assert.strictEqual(assessment.professionalReviewRef, 'PROVIDER-REF-1');

const evidenceAction = createDecisionAction({
  actionId: 'ACT-EV-1',
  caseId: 'CASE-A1',
  projectId: 'PROJECT-A1',
  type: ACTION_TYPE.EVIDENCE,
  description: 'Obtain verified utility-availability evidence.',
  ownerId: 'OWNER-2',
  requiredEvidenceKeys: ['utilitiesVerified'],
  sourceDecisionRef: 'IC-DECISION-1',
});

const register = buildDecisionActionRegister({ caseId: 'CASE-A1', projectId: 'PROJECT-A1', actions: [legalAction, evidenceAction] });
assert.strictEqual(register.actions.length, 2);
assert.strictEqual(register.openCount, 2);
assert.strictEqual(register.transactionAuthorized, false);

assert.throws(() => buildDecisionActionRegister({
  caseId: 'CASE-A1',
  projectId: 'PROJECT-A1',
  actions: [{ ...evidenceAction, caseId: 'OTHER' }],
}), /ACTION_CASE_OR_PROJECT_ISOLATION_VIOLATION/);

console.log('DECISION_ACTIONS_V1=PASS');
console.log('PROFESSIONAL_ACTIONS_REQUIRE_LICENSED_REVIEW=PASS');
console.log('ACTION_CLOSURE_REQUIRES_EVIDENCE_AND_HUMAN_REVIEW=PASS');
console.log('ACTION_REGISTER_DOES_NOT_AUTHORIZE_TRANSACTION=PASS');
