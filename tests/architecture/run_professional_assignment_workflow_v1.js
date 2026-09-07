'use strict';

const assert = require('assert');
const { OPERATING_MODE } = require('../../src/compliance/decision-support');
const {
  ASSIGNMENT_STATE,
  CONFLICT_STATUS,
  COMPETENCE_STATUS,
  DATA_AVAILABILITY_STATUS,
  createProfessionalAssignment,
  scopeCompleteness,
  transitionAssignment,
} = require('../../src/valuation-assignment');

let checks = 0;
function check(fn) { fn(); checks++; }

function createBase(overrides = {}) {
  return createProfessionalAssignment({
    engagementId: 'ENG-001',
    caseId: 'CASE-001',
    clientPartyId: 'PARTY-CLIENT',
    intendedUserPartyIds: ['PARTY-CLIENT'],
    purposeCode: 'MARKET_VALUE',
    intendedUseCode: 'INTERNAL_DECISION_SUPPORT',
    jurisdiction: 'SAUDI_ARABIA',
    valuationDate: '2026-09-01',
    basisOfValueCode: 'MARKET_VALUE',
    propertyInterestIds: ['PI-OWNERSHIP'],
    valuedPropertyInterestId: 'PI-OWNERSHIP',
    scopeVersion: '1',
    assumptions: [],
    specialAssumptions: [],
    relianceRestrictions: ['CLIENT_ONLY'],
    limitations: [],
    plannedInspectionScope: ['PHYSICAL_INSPECTION_REQUIRED'],
    plannedDataScope: ['TITLE', 'PLANNING', 'MARKET', 'LEASES'],
    reviewerPartyId: 'PARTY-REVIEWER',
    createdAt: '2026-09-07T10:00:00Z',
    createdBy: 'USER-1',
    ...overrides,
  });
}

function move(assignment, toState, gateData = {}, suffix = '') {
  return transitionAssignment(assignment, {
    toState,
    actorId: 'USER-1',
    occurredAt: `2026-09-07T10:${String(10 + assignment.transitionHistory.length).padStart(2, '0')}:00Z`,
    reason: `test transition ${suffix || toState}`,
    evidenceRefs: ['EVIDENCE-1'],
    gateData,
  });
}

const draft = createBase();
check(() => assert.strictEqual(draft.assignmentState, ASSIGNMENT_STATE.DRAFT));
check(() => assert.strictEqual(draft.operatingMode, OPERATING_MODE.UNLICENSED_DECISION_SUPPORT));
check(() => assert.strictEqual(draft.professionalValuationAuthorized, false));
check(() => assert.strictEqual(draft.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(draft.transactionAuthorized, false));
check(() => assert.strictEqual(scopeCompleteness(draft).complete, true));
check(() => assert.ok(Object.isFrozen(draft)));

// Valued interest must be explicit and inside scope.
check(() => assert.throws(
  () => createBase({ valuedPropertyInterestId: 'PI-NOT-IN-SCOPE' }),
  /VALUED_PROPERTY_INTEREST_NOT_IN_ENGAGEMENT_SCOPE/,
));
check(() => assert.throws(
  () => createBase({ valuationDate: '2026-02-31' }),
  /valuationDate must be a real ISO date/,
));

// No direct jump from draft to analysis authorization.
check(() => assert.throws(
  () => move(draft, ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS),
  (error) => error?.code === 'ASSIGNMENT_TRANSITION_FORBIDDEN',
));

// Normal CLEAR/COMPETENT/SUFFICIENT path.
let a = move(draft, ASSIGNMENT_STATE.SCOPE_REVIEW);
check(() => assert.strictEqual(a.assignmentState, ASSIGNMENT_STATE.SCOPE_REVIEW));
a = move(a, ASSIGNMENT_STATE.CONFLICT_REVIEW);
check(() => assert.strictEqual(a.assignmentState, ASSIGNMENT_STATE.CONFLICT_REVIEW));
check(() => assert.throws(
  () => move(a, ASSIGNMENT_STATE.COMPETENCE_REVIEW),
  (error) => error?.code === 'ASSIGNMENT_GATE_BLOCKED' && error.gateReasons.includes('CONFLICT_STATUS_REQUIRED'),
));
a = move(a, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
check(() => assert.strictEqual(a.conflictStatus, CONFLICT_STATUS.CLEAR));
check(() => assert.strictEqual(a.assignmentState, ASSIGNMENT_STATE.COMPETENCE_REVIEW));
check(() => assert.throws(
  () => move(a, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW),
  (error) => error?.gateReasons?.includes('COMPETENCE_STATUS_REQUIRED'),
));
a = move(a, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.COMPETENT });
check(() => assert.strictEqual(a.competenceStatus, COMPETENCE_STATUS.COMPETENT));
check(() => assert.throws(
  () => move(a, ASSIGNMENT_STATE.TERMS_REVIEW),
  (error) => error?.gateReasons?.includes('DATA_AVAILABILITY_STATUS_REQUIRED'),
));
a = move(a, ASSIGNMENT_STATE.TERMS_REVIEW, { dataAvailabilityStatus: DATA_AVAILABILITY_STATUS.SUFFICIENT_FOR_ANALYSIS });
check(() => assert.strictEqual(a.dataAvailabilityStatus, DATA_AVAILABILITY_STATUS.SUFFICIENT_FOR_ANALYSIS));
check(() => assert.throws(
  () => move(a, ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS),
  (error) => error?.gateReasons?.includes('TERMS_ACCEPTANCE_EVIDENCE_REQUIRED')
    && error.gateReasons.includes('ANALYSIS_AUTHORIZATION_REQUIRED'),
));
a = move(a, ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS, {
  termsAcceptanceEvidenceRef: 'TERMS-SIGNED-1',
  analysisAuthorizationId: 'ANALYSIS-AUTH-1',
});
check(() => assert.strictEqual(a.assignmentState, ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS));
check(() => assert.strictEqual(a.termsAcceptanceEvidenceRef, 'TERMS-SIGNED-1'));
check(() => assert.strictEqual(a.analysisAuthorizationId, 'ANALYSIS-AUTH-1'));
check(() => assert.strictEqual(a.professionalValuationAuthorized, false));
check(() => assert.strictEqual(a.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(a.transactionAuthorized, false));
check(() => assert.strictEqual(a.transitionHistory.length, 6));
check(() => assert.ok(Object.isFrozen(a.transitionHistory[0])));
check(() => assert.throws(
  () => move(a, ASSIGNMENT_STATE.CANCELLED),
  (error) => error?.code === 'ASSIGNMENT_TERMINAL_STATE',
));

// CANNOT_PROCEED cannot be bypassed into competence review.
let conflict = move(createBase({ engagementId: 'ENG-CONFLICT' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
conflict = move(conflict, ASSIGNMENT_STATE.CONFLICT_REVIEW);
check(() => assert.throws(
  () => move(conflict, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CANNOT_PROCEED }),
  (error) => error?.gateReasons?.includes('CONFLICT_CANNOT_PROCEED'),
));
conflict = move(conflict, ASSIGNMENT_STATE.DECLINED_CONFLICT, { conflictStatus: CONFLICT_STATUS.CANNOT_PROCEED });
check(() => assert.strictEqual(conflict.assignmentState, ASSIGNMENT_STATE.DECLINED_CONFLICT));
check(() => assert.strictEqual(conflict.transactionAuthorized, false));

// DISCLOSURE_REQUIRED needs explicit acknowledgement.
let disclosure = move(createBase({ engagementId: 'ENG-DISC' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
disclosure = move(disclosure, ASSIGNMENT_STATE.CONFLICT_REVIEW);
check(() => assert.throws(
  () => move(disclosure, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.DISCLOSURE_REQUIRED }),
  (error) => error?.gateReasons?.includes('CONFLICT_DISCLOSURE_ACKNOWLEDGEMENT_REQUIRED'),
));
disclosure = move(disclosure, ASSIGNMENT_STATE.COMPETENCE_REVIEW, {
  conflictStatus: CONFLICT_STATUS.DISCLOSURE_REQUIRED,
  conflictDisclosureAcknowledgementRef: 'DISCLOSURE-ACK-1',
});
check(() => assert.strictEqual(disclosure.conflictDisclosureAcknowledgementRef, 'DISCLOSURE-ACK-1'));

// REVIEW_REQUIRED needs human approval reference.
let reviewConflict = move(createBase({ engagementId: 'ENG-REVIEW-CONFLICT' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
reviewConflict = move(reviewConflict, ASSIGNMENT_STATE.CONFLICT_REVIEW);
check(() => assert.throws(
  () => move(reviewConflict, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.REVIEW_REQUIRED }),
  (error) => error?.gateReasons?.includes('CONFLICT_REVIEW_APPROVAL_REQUIRED'),
));
reviewConflict = move(reviewConflict, ASSIGNMENT_STATE.COMPETENCE_REVIEW, {
  conflictStatus: CONFLICT_STATUS.REVIEW_REQUIRED,
  conflictReviewApprovalId: 'CONFLICT-APPROVAL-1',
});
check(() => assert.strictEqual(reviewConflict.conflictReviewApprovalId, 'CONFLICT-APPROVAL-1'));

// Specialist-required competence cannot progress without both specialist identity and acceptance evidence.
let specialist = move(createBase({ engagementId: 'ENG-SPECIALIST' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
specialist = move(specialist, ASSIGNMENT_STATE.CONFLICT_REVIEW);
specialist = move(specialist, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
check(() => assert.throws(
  () => move(specialist, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.SPECIALIST_REQUIRED }),
  (error) => error?.gateReasons?.includes('SPECIALIST_PARTY_REQUIRED')
    && error.gateReasons.includes('SPECIALIST_ACCEPTANCE_EVIDENCE_REQUIRED'),
));
specialist = move(specialist, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, {
  competenceStatus: COMPETENCE_STATUS.SPECIALIST_REQUIRED,
  specialistPartyId: 'PARTY-SPECIALIST',
  specialistAcceptanceEvidenceRef: 'SPECIALIST-ACCEPT-1',
});
check(() => assert.strictEqual(specialist.specialistPartyId, 'PARTY-SPECIALIST'));

// OUTSIDE_COMPETENCE can decline but not advance.
let outside = move(createBase({ engagementId: 'ENG-OUTSIDE' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
outside = move(outside, ASSIGNMENT_STATE.CONFLICT_REVIEW);
outside = move(outside, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
check(() => assert.throws(
  () => move(outside, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.OUTSIDE_COMPETENCE }),
  (error) => error?.gateReasons?.includes('OUTSIDE_COMPETENCE'),
));
outside = move(outside, ASSIGNMENT_STATE.DECLINED_OUTSIDE_COMPETENCE, { competenceStatus: COMPETENCE_STATUS.OUTSIDE_COMPETENCE });
check(() => assert.strictEqual(outside.assignmentState, ASSIGNMENT_STATE.DECLINED_OUTSIDE_COMPETENCE));

// Partial data requires explicit review approval before terms.
let partial = move(createBase({ engagementId: 'ENG-PARTIAL' }), ASSIGNMENT_STATE.SCOPE_REVIEW);
partial = move(partial, ASSIGNMENT_STATE.CONFLICT_REVIEW);
partial = move(partial, ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
partial = move(partial, ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.COMPETENT });
check(() => assert.throws(
  () => move(partial, ASSIGNMENT_STATE.TERMS_REVIEW, { dataAvailabilityStatus: DATA_AVAILABILITY_STATUS.PARTIAL_REVIEW_REQUIRED }),
  (error) => error?.gateReasons?.includes('DATA_REVIEW_APPROVAL_REQUIRED'),
));
partial = move(partial, ASSIGNMENT_STATE.TERMS_REVIEW, {
  dataAvailabilityStatus: DATA_AVAILABILITY_STATUS.PARTIAL_REVIEW_REQUIRED,
  dataReviewApprovalId: 'DATA-REVIEW-1',
});
check(() => assert.strictEqual(partial.dataReviewApprovalId, 'DATA-REVIEW-1'));

console.log(`PROFESSIONAL_ASSIGNMENT_WORKFLOW_ARCHITECTURE: PASS (${checks} checks)`);