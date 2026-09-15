'use strict';

const { OPERATING_MODE } = require('../compliance/decision-support');

const ASSIGNMENT_STATE = Object.freeze({
  DRAFT: 'DRAFT',
  SCOPE_REVIEW: 'SCOPE_REVIEW',
  CONFLICT_REVIEW: 'CONFLICT_REVIEW',
  COMPETENCE_REVIEW: 'COMPETENCE_REVIEW',
  DATA_AVAILABILITY_REVIEW: 'DATA_AVAILABILITY_REVIEW',
  TERMS_REVIEW: 'TERMS_REVIEW',
  AUTHORIZED_FOR_ANALYSIS: 'AUTHORIZED_FOR_ANALYSIS',
  HOLD_SCOPE_INCOMPLETE: 'HOLD_SCOPE_INCOMPLETE',
  HOLD_CONFLICT_REVIEW_REQUIRED: 'HOLD_CONFLICT_REVIEW_REQUIRED',
  DECLINED_CONFLICT: 'DECLINED_CONFLICT',
  HOLD_SPECIALIST_REQUIRED: 'HOLD_SPECIALIST_REQUIRED',
  DECLINED_OUTSIDE_COMPETENCE: 'DECLINED_OUTSIDE_COMPETENCE',
  HOLD_DATA_INSUFFICIENT: 'HOLD_DATA_INSUFFICIENT',
  DECLINED_TERMS: 'DECLINED_TERMS',
  CANCELLED: 'CANCELLED',
});

const CONFLICT_STATUS = Object.freeze({
  CLEAR: 'CLEAR',
  DISCLOSURE_REQUIRED: 'DISCLOSURE_REQUIRED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  CANNOT_PROCEED: 'CANNOT_PROCEED',
});

const COMPETENCE_STATUS = Object.freeze({
  COMPETENT: 'COMPETENT',
  SPECIALIST_REQUIRED: 'SPECIALIST_REQUIRED',
  OUTSIDE_COMPETENCE: 'OUTSIDE_COMPETENCE',
  PROFESSIONAL_REVIEW_REQUIRED: 'PROFESSIONAL_REVIEW_REQUIRED',
});

const DATA_AVAILABILITY_STATUS = Object.freeze({
  SUFFICIENT_FOR_ANALYSIS: 'SUFFICIENT_FOR_ANALYSIS',
  PARTIAL_REVIEW_REQUIRED: 'PARTIAL_REVIEW_REQUIRED',
  INSUFFICIENT: 'INSUFFICIENT',
});

const TERMINAL_STATES = Object.freeze(new Set([
  ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS,
  ASSIGNMENT_STATE.DECLINED_CONFLICT,
  ASSIGNMENT_STATE.DECLINED_OUTSIDE_COMPETENCE,
  ASSIGNMENT_STATE.DECLINED_TERMS,
  ASSIGNMENT_STATE.CANCELLED,
]));

const ALLOWED_TRANSITIONS = Object.freeze({
  [ASSIGNMENT_STATE.DRAFT]: Object.freeze([ASSIGNMENT_STATE.SCOPE_REVIEW, ASSIGNMENT_STATE.HOLD_SCOPE_INCOMPLETE, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.HOLD_SCOPE_INCOMPLETE]: Object.freeze([ASSIGNMENT_STATE.SCOPE_REVIEW, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.SCOPE_REVIEW]: Object.freeze([ASSIGNMENT_STATE.CONFLICT_REVIEW, ASSIGNMENT_STATE.HOLD_SCOPE_INCOMPLETE, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.CONFLICT_REVIEW]: Object.freeze([
    ASSIGNMENT_STATE.COMPETENCE_REVIEW,
    ASSIGNMENT_STATE.HOLD_CONFLICT_REVIEW_REQUIRED,
    ASSIGNMENT_STATE.DECLINED_CONFLICT,
    ASSIGNMENT_STATE.CANCELLED,
  ]),
  [ASSIGNMENT_STATE.HOLD_CONFLICT_REVIEW_REQUIRED]: Object.freeze([ASSIGNMENT_STATE.CONFLICT_REVIEW, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.COMPETENCE_REVIEW]: Object.freeze([
    ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW,
    ASSIGNMENT_STATE.HOLD_SPECIALIST_REQUIRED,
    ASSIGNMENT_STATE.DECLINED_OUTSIDE_COMPETENCE,
    ASSIGNMENT_STATE.CANCELLED,
  ]),
  [ASSIGNMENT_STATE.HOLD_SPECIALIST_REQUIRED]: Object.freeze([ASSIGNMENT_STATE.COMPETENCE_REVIEW, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW]: Object.freeze([ASSIGNMENT_STATE.TERMS_REVIEW, ASSIGNMENT_STATE.HOLD_DATA_INSUFFICIENT, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.HOLD_DATA_INSUFFICIENT]: Object.freeze([ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, ASSIGNMENT_STATE.CANCELLED]),
  [ASSIGNMENT_STATE.TERMS_REVIEW]: Object.freeze([ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS, ASSIGNMENT_STATE.DECLINED_TERMS, ASSIGNMENT_STATE.CANCELLED]),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (value instanceof Set) return Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
}

function assertStringArray(value, field, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new TypeError(`${field} must be an array of non-empty strings with at least ${min} item(s)`);
  }
}

function isStrictIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeTimestamp(value, field) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function scopeCompleteness(assignment) {
  const missing = [];
  const stringFields = [
    'engagementId', 'caseId', 'clientPartyId', 'purposeCode', 'intendedUseCode',
    'jurisdiction', 'basisOfValueCode', 'valuedPropertyInterestId', 'scopeVersion',
  ];
  for (const field of stringFields) {
    if (typeof assignment?.[field] !== 'string' || assignment[field].trim() === '') missing.push(field);
  }
  if (!isStrictIsoDate(assignment?.valuationDate)) missing.push('valuationDate');
  if (!Array.isArray(assignment?.intendedUserPartyIds) || assignment.intendedUserPartyIds.length === 0) missing.push('intendedUserPartyIds');
  if (!Array.isArray(assignment?.propertyInterestIds) || assignment.propertyInterestIds.length === 0) missing.push('propertyInterestIds');
  if (assignment?.valuedPropertyInterestId && !assignment?.propertyInterestIds?.includes(assignment.valuedPropertyInterestId)) {
    missing.push('valuedPropertyInterestId:not_in_propertyInterestIds');
  }
  for (const field of ['assumptions', 'specialAssumptions', 'relianceRestrictions', 'limitations', 'plannedInspectionScope', 'plannedDataScope']) {
    if (!Array.isArray(assignment?.[field])) missing.push(field);
  }
  return deepFreeze({ complete: missing.length === 0, missing });
}

function createProfessionalAssignment(input) {
  if (!input || typeof input !== 'object') throw new TypeError('assignment input is required');
  assertNonEmptyString(input.engagementId, 'engagementId');
  assertNonEmptyString(input.caseId, 'caseId');
  assertNonEmptyString(input.clientPartyId, 'clientPartyId');
  assertStringArray(input.intendedUserPartyIds, 'intendedUserPartyIds', { min: 1 });
  assertStringArray(input.propertyInterestIds, 'propertyInterestIds', { min: 1 });
  assertNonEmptyString(input.purposeCode, 'purposeCode');
  assertNonEmptyString(input.intendedUseCode, 'intendedUseCode');
  assertNonEmptyString(input.jurisdiction, 'jurisdiction');
  assertNonEmptyString(input.basisOfValueCode, 'basisOfValueCode');
  assertNonEmptyString(input.valuedPropertyInterestId, 'valuedPropertyInterestId');
  assertNonEmptyString(input.scopeVersion, 'scopeVersion');
  if (!isStrictIsoDate(input.valuationDate)) throw new TypeError('valuationDate must be a real ISO date YYYY-MM-DD');
  if (!input.propertyInterestIds.includes(input.valuedPropertyInterestId)) {
    throw new TypeError('VALUED_PROPERTY_INTEREST_NOT_IN_ENGAGEMENT_SCOPE');
  }
  for (const field of ['assumptions', 'specialAssumptions', 'relianceRestrictions', 'limitations', 'plannedInspectionScope', 'plannedDataScope']) {
    assertStringArray(input[field] || [], field);
  }

  const createdAt = normalizeTimestamp(input.createdAt, 'createdAt');
  return deepFreeze({
    schemaVersion: 1,
    operatingMode: OPERATING_MODE.UNLICENSED_DECISION_SUPPORT,
    engagementId: input.engagementId,
    caseId: input.caseId,
    clientPartyId: input.clientPartyId,
    intendedUserPartyIds: [...input.intendedUserPartyIds],
    purposeCode: input.purposeCode,
    intendedUseCode: input.intendedUseCode,
    jurisdiction: input.jurisdiction,
    valuationDate: input.valuationDate,
    reportDate: input.reportDate || null,
    engagementDate: input.engagementDate || null,
    basisOfValueCode: input.basisOfValueCode,
    propertyInterestIds: [...input.propertyInterestIds],
    valuedPropertyInterestId: input.valuedPropertyInterestId,
    scopeVersion: input.scopeVersion,
    assumptions: [...(input.assumptions || [])],
    specialAssumptions: [...(input.specialAssumptions || [])],
    relianceRestrictions: [...(input.relianceRestrictions || [])],
    limitations: [...(input.limitations || [])],
    plannedInspectionScope: [...(input.plannedInspectionScope || [])],
    plannedDataScope: [...(input.plannedDataScope || [])],
    reviewerPartyId: input.reviewerPartyId || null,
    conflictStatus: null,
    competenceStatus: null,
    dataAvailabilityStatus: null,
    termsAcceptanceEvidenceRef: null,
    analysisAuthorizationId: null,
    specialistPartyId: null,
    specialistAcceptanceEvidenceRef: null,
    professionalReviewPartyId: null,
    conflictReviewApprovalId: null,
    conflictDisclosureAcknowledgementRef: null,
    dataReviewApprovalId: null,
    assignmentState: ASSIGNMENT_STATE.DRAFT,
    transitionHistory: [],
    createdAt,
    createdBy: input.createdBy || null,
    updatedAt: createdAt,
    professionalValuationAuthorized: false,
    certifiedValuationAuthorized: false,
    transactionAuthorized: false,
  });
}

function assertTransitionAllowed(fromState, toState) {
  const allowed = ALLOWED_TRANSITIONS[fromState] || [];
  if (!allowed.includes(toState)) {
    const error = new Error(`ASSIGNMENT_TRANSITION_FORBIDDEN:${fromState}->${toState}`);
    error.code = 'ASSIGNMENT_TRANSITION_FORBIDDEN';
    throw error;
  }
}

function evaluateTransitionGate(assignment, toState, gateData = {}) {
  const reasons = [];
  const fromState = assignment.assignmentState;

  if (toState === ASSIGNMENT_STATE.SCOPE_REVIEW) {
    const scope = scopeCompleteness(assignment);
    if (!scope.complete) reasons.push(`VALUATION_SCOPE_INCOMPLETE:${scope.missing.join(',')}`);
  }

  if (fromState === ASSIGNMENT_STATE.SCOPE_REVIEW && toState === ASSIGNMENT_STATE.CONFLICT_REVIEW) {
    const scope = scopeCompleteness(assignment);
    if (!scope.complete) reasons.push(`VALUATION_SCOPE_INCOMPLETE:${scope.missing.join(',')}`);
  }

  if (fromState === ASSIGNMENT_STATE.CONFLICT_REVIEW) {
    const status = gateData.conflictStatus || assignment.conflictStatus;
    if (!Object.values(CONFLICT_STATUS).includes(status)) reasons.push('CONFLICT_STATUS_REQUIRED');
    if (toState === ASSIGNMENT_STATE.COMPETENCE_REVIEW) {
      if (status === CONFLICT_STATUS.CANNOT_PROCEED) reasons.push('CONFLICT_CANNOT_PROCEED');
      if (status === CONFLICT_STATUS.REVIEW_REQUIRED && !gateData.conflictReviewApprovalId && !assignment.conflictReviewApprovalId) {
        reasons.push('CONFLICT_REVIEW_APPROVAL_REQUIRED');
      }
      if (status === CONFLICT_STATUS.DISCLOSURE_REQUIRED
        && !gateData.conflictDisclosureAcknowledgementRef
        && !assignment.conflictDisclosureAcknowledgementRef) {
        reasons.push('CONFLICT_DISCLOSURE_ACKNOWLEDGEMENT_REQUIRED');
      }
    }
    if (toState === ASSIGNMENT_STATE.DECLINED_CONFLICT && status !== CONFLICT_STATUS.CANNOT_PROCEED) {
      reasons.push('DECLINED_CONFLICT_REQUIRES_CANNOT_PROCEED');
    }
  }

  if (fromState === ASSIGNMENT_STATE.COMPETENCE_REVIEW) {
    const status = gateData.competenceStatus || assignment.competenceStatus;
    if (!Object.values(COMPETENCE_STATUS).includes(status)) reasons.push('COMPETENCE_STATUS_REQUIRED');
    if (toState === ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW) {
      if (status === COMPETENCE_STATUS.OUTSIDE_COMPETENCE) reasons.push('OUTSIDE_COMPETENCE');
      if (status === COMPETENCE_STATUS.SPECIALIST_REQUIRED
        && !(gateData.specialistPartyId || assignment.specialistPartyId)
        && !(gateData.specialistAcceptanceEvidenceRef || assignment.specialistAcceptanceEvidenceRef)) {
        reasons.push('SPECIALIST_REQUIRED');
      }
      if (status === COMPETENCE_STATUS.SPECIALIST_REQUIRED) {
        if (!gateData.specialistPartyId && !assignment.specialistPartyId) reasons.push('SPECIALIST_PARTY_REQUIRED');
        if (!gateData.specialistAcceptanceEvidenceRef && !assignment.specialistAcceptanceEvidenceRef) reasons.push('SPECIALIST_ACCEPTANCE_EVIDENCE_REQUIRED');
      }
      if (status === COMPETENCE_STATUS.PROFESSIONAL_REVIEW_REQUIRED
        && !gateData.professionalReviewPartyId
        && !assignment.professionalReviewPartyId) {
        reasons.push('PROFESSIONAL_REVIEW_PARTY_REQUIRED');
      }
    }
    if (toState === ASSIGNMENT_STATE.DECLINED_OUTSIDE_COMPETENCE && status !== COMPETENCE_STATUS.OUTSIDE_COMPETENCE) {
      reasons.push('DECLINE_REQUIRES_OUTSIDE_COMPETENCE');
    }
  }

  if (fromState === ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW) {
    const status = gateData.dataAvailabilityStatus || assignment.dataAvailabilityStatus;
    if (!Object.values(DATA_AVAILABILITY_STATUS).includes(status)) reasons.push('DATA_AVAILABILITY_STATUS_REQUIRED');
    if (toState === ASSIGNMENT_STATE.TERMS_REVIEW) {
      if (status === DATA_AVAILABILITY_STATUS.INSUFFICIENT) reasons.push('DATA_INSUFFICIENT');
      if (status === DATA_AVAILABILITY_STATUS.PARTIAL_REVIEW_REQUIRED
        && !gateData.dataReviewApprovalId
        && !assignment.dataReviewApprovalId) reasons.push('DATA_REVIEW_APPROVAL_REQUIRED');
    }
  }

  if (fromState === ASSIGNMENT_STATE.TERMS_REVIEW && toState === ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS) {
    if (!gateData.termsAcceptanceEvidenceRef && !assignment.termsAcceptanceEvidenceRef) reasons.push('TERMS_ACCEPTANCE_EVIDENCE_REQUIRED');
    if (!gateData.analysisAuthorizationId && !assignment.analysisAuthorizationId) reasons.push('ANALYSIS_AUTHORIZATION_REQUIRED');
  }

  return deepFreeze({ pass: reasons.length === 0, reasons });
}

function transitionAssignment(assignment, {
  toState,
  actorId,
  occurredAt,
  reason,
  evidenceRefs = [],
  gateData = {},
} = {}) {
  if (!assignment || typeof assignment !== 'object') throw new TypeError('assignment is required');
  if (!Object.values(ASSIGNMENT_STATE).includes(toState)) throw new TypeError('toState is invalid');
  assertNonEmptyString(actorId, 'actorId');
  assertNonEmptyString(reason, 'reason');
  assertStringArray(evidenceRefs, 'evidenceRefs');
  if (TERMINAL_STATES.has(assignment.assignmentState)) {
    const error = new Error(`ASSIGNMENT_TERMINAL_STATE:${assignment.assignmentState}`);
    error.code = 'ASSIGNMENT_TERMINAL_STATE';
    throw error;
  }
  assertTransitionAllowed(assignment.assignmentState, toState);

  const gate = evaluateTransitionGate(assignment, toState, gateData);
  if (!gate.pass) {
    const error = new Error(gate.reasons.join('|'));
    error.code = gate.reasons.some((entry) => entry.startsWith('VALUATION_SCOPE_INCOMPLETE'))
      ? 'VALUATION_SCOPE_INCOMPLETE'
      : 'ASSIGNMENT_GATE_BLOCKED';
    error.gateReasons = gate.reasons;
    throw error;
  }

  const timestamp = normalizeTimestamp(occurredAt, 'occurredAt');
  const transition = deepFreeze({
    transitionId: `${assignment.engagementId}:${assignment.transitionHistory.length + 1}`,
    transitionVersion: 1,
    fromState: assignment.assignmentState,
    toState,
    actorId,
    occurredAt: timestamp,
    reason,
    evidenceRefs: [...evidenceRefs],
  });

  const next = {
    ...assignment,
    assignmentState: toState,
    updatedAt: timestamp,
    transitionHistory: [...assignment.transitionHistory, transition],
  };

  for (const field of [
    'conflictStatus', 'competenceStatus', 'dataAvailabilityStatus',
    'termsAcceptanceEvidenceRef', 'analysisAuthorizationId', 'specialistPartyId',
    'specialistAcceptanceEvidenceRef', 'professionalReviewPartyId',
    'conflictReviewApprovalId', 'conflictDisclosureAcknowledgementRef', 'dataReviewApprovalId',
  ]) {
    if (Object.prototype.hasOwnProperty.call(gateData, field)) next[field] = gateData[field];
  }

  // This state authorizes only bounded analysis workflow progression. It never upgrades
  // the platform to licensed/certified valuation or transaction execution authority.
  next.professionalValuationAuthorized = false;
  next.certifiedValuationAuthorized = false;
  next.transactionAuthorized = false;
  next.operatingMode = OPERATING_MODE.UNLICENSED_DECISION_SUPPORT;

  return deepFreeze(next);
}

module.exports = {
  ASSIGNMENT_STATE,
  CONFLICT_STATUS,
  COMPETENCE_STATUS,
  DATA_AVAILABILITY_STATUS,
  ALLOWED_TRANSITIONS,
  scopeCompleteness,
  createProfessionalAssignment,
  evaluateTransitionGate,
  transitionAssignment,
};