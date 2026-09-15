'use strict';

const { STANDARD_STATUS, REVIEW_STATUS, deepFreeze, isStrictIsoDate } = require('./contracts');

const LIFECYCLE_STATE = Object.freeze({
  DETECTED: 'DETECTED',
  SOURCE_VERIFICATION: 'SOURCE_VERIFICATION',
  CLASSIFIED: 'CLASSIFIED',
  IMPACT_ASSESSMENT: 'IMPACT_ASSESSMENT',
  IMPLEMENTATION: 'IMPLEMENTATION',
  CONFORMANCE_TEST: 'CONFORMANCE_TEST',
  PROFESSIONAL_LEGAL_REVIEW: 'PROFESSIONAL_LEGAL_REVIEW',
  RELEASE_APPROVAL: 'RELEASE_APPROVAL',
  ACTIVATED: 'ACTIVATED',
  MONITORING: 'MONITORING',
  HOLD_SOURCE_UNVERIFIED: 'HOLD_SOURCE_UNVERIFIED',
  HOLD_VERSION_UNVERIFIED: 'HOLD_VERSION_UNVERIFIED',
  HOLD_IMPACT_INCOMPLETE: 'HOLD_IMPACT_INCOMPLETE',
  HOLD_TEST_FAILURE: 'HOLD_TEST_FAILURE',
  HOLD_REVIEW_REQUIRED: 'HOLD_REVIEW_REQUIRED',
  HOLD_RELEASE_APPROVAL: 'HOLD_RELEASE_APPROVAL',
  SUSPENDED: 'SUSPENDED',
});

const ACTOR_TYPE = Object.freeze({
  HUMAN: 'HUMAN',
  SYSTEM: 'SYSTEM',
  AI: 'AI',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [LIFECYCLE_STATE.DETECTED]: [LIFECYCLE_STATE.SOURCE_VERIFICATION, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.SOURCE_VERIFICATION]: [LIFECYCLE_STATE.CLASSIFIED, LIFECYCLE_STATE.HOLD_SOURCE_UNVERIFIED, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_SOURCE_UNVERIFIED]: [LIFECYCLE_STATE.SOURCE_VERIFICATION, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.CLASSIFIED]: [LIFECYCLE_STATE.IMPACT_ASSESSMENT, LIFECYCLE_STATE.HOLD_VERSION_UNVERIFIED, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_VERSION_UNVERIFIED]: [LIFECYCLE_STATE.CLASSIFIED, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.IMPACT_ASSESSMENT]: [LIFECYCLE_STATE.IMPLEMENTATION, LIFECYCLE_STATE.HOLD_IMPACT_INCOMPLETE, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_IMPACT_INCOMPLETE]: [LIFECYCLE_STATE.IMPACT_ASSESSMENT, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.IMPLEMENTATION]: [LIFECYCLE_STATE.CONFORMANCE_TEST, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.CONFORMANCE_TEST]: [LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW, LIFECYCLE_STATE.HOLD_TEST_FAILURE, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_TEST_FAILURE]: [LIFECYCLE_STATE.CONFORMANCE_TEST, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW]: [LIFECYCLE_STATE.RELEASE_APPROVAL, LIFECYCLE_STATE.HOLD_REVIEW_REQUIRED, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_REVIEW_REQUIRED]: [LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.RELEASE_APPROVAL]: [LIFECYCLE_STATE.ACTIVATED, LIFECYCLE_STATE.HOLD_RELEASE_APPROVAL, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.HOLD_RELEASE_APPROVAL]: [LIFECYCLE_STATE.RELEASE_APPROVAL, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.ACTIVATED]: [LIFECYCLE_STATE.MONITORING, LIFECYCLE_STATE.SUSPENDED],
  [LIFECYCLE_STATE.MONITORING]: [LIFECYCLE_STATE.SUSPENDED],
});

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
}

function normalizeTimestamp(value, field) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function createStandardLifecycle({ standardId, currentStandardStatus, detectedAt, detectedBy, detectionEvidenceRefs = [] } = {}) {
  assertString(standardId, 'standardId');
  if (!Object.values(STANDARD_STATUS).includes(currentStandardStatus)) throw new TypeError('currentStandardStatus is invalid');
  assertString(detectedBy, 'detectedBy');
  if (!Array.isArray(detectionEvidenceRefs)) throw new TypeError('detectionEvidenceRefs must be an array');
  return deepFreeze({
    schemaVersion: 1,
    lifecycleVersion: 'W7C_STANDARD_ACTIVATION_V1',
    standardId,
    currentStandardStatus,
    lifecycleState: LIFECYCLE_STATE.DETECTED,
    sourceVerified: false,
    officialSource: false,
    sourceEvidenceRef: null,
    verifiedVersion: null,
    effectiveDate: null,
    verifiedSourceStatus: null,
    impactAnalysisId: null,
    implementationVersion: null,
    affectedArtifactRefs: [],
    conformanceTestRunId: null,
    regressionTestRunId: null,
    conformancePassed: false,
    regressionPassed: false,
    professionalReviewStatus: REVIEW_STATUS.PENDING,
    professionalReviewApprovalId: null,
    legalReviewStatus: REVIEW_STATUS.PENDING,
    legalReviewApprovalId: null,
    releaseApprovalId: null,
    activationApprovalId: null,
    activatedAt: null,
    proposedStandardStatus: null,
    productionEnforcementAuthorized: false,
    transactionAuthorized: false,
    history: [],
    detectedAt: normalizeTimestamp(detectedAt, 'detectedAt'),
    detectedBy,
    detectionEvidenceRefs: [...detectionEvidenceRefs],
  });
}

function assertAllowed(fromState, toState) {
  if (!(ALLOWED_TRANSITIONS[fromState] || []).includes(toState)) {
    const error = new Error(`STANDARD_LIFECYCLE_TRANSITION_FORBIDDEN:${fromState}->${toState}`);
    error.code = 'STANDARD_LIFECYCLE_TRANSITION_FORBIDDEN';
    throw error;
  }
}

function approvedOrNotRequired(status) {
  return status === REVIEW_STATUS.APPROVED || status === REVIEW_STATUS.NOT_REQUIRED;
}

function gateReasons(record, toState, data, actorType, occurredDate) {
  const reasons = [];
  const from = record.lifecycleState;

  if (from === LIFECYCLE_STATE.SOURCE_VERIFICATION && toState === LIFECYCLE_STATE.CLASSIFIED) {
    if (data.sourceVerified !== true) reasons.push('STANDARD_SOURCE_UNVERIFIED');
    if (data.officialSource !== true) reasons.push('STANDARD_OFFICIAL_SOURCE_UNVERIFIED');
    if (!data.sourceEvidenceRef) reasons.push('STANDARD_SOURCE_EVIDENCE_MISSING');
  }

  if (from === LIFECYCLE_STATE.CLASSIFIED && toState === LIFECYCLE_STATE.IMPACT_ASSESSMENT) {
    if (!data.verifiedVersion && !record.verifiedVersion) reasons.push('STANDARD_VERSION_UNVERIFIED');
    const status = data.verifiedSourceStatus || record.verifiedSourceStatus;
    if (!Object.values(STANDARD_STATUS).includes(status)) reasons.push('STANDARD_STATUS_UNVERIFIED');
    const effectiveDate = data.effectiveDate || record.effectiveDate;
    if (effectiveDate && !isStrictIsoDate(effectiveDate)) reasons.push('STANDARD_EFFECTIVE_DATE_INVALID');
  }

  if (from === LIFECYCLE_STATE.IMPACT_ASSESSMENT && toState === LIFECYCLE_STATE.IMPLEMENTATION) {
    if (!data.impactAnalysisId && !record.impactAnalysisId) reasons.push('STANDARD_IMPACT_ANALYSIS_INCOMPLETE');
  }

  if (from === LIFECYCLE_STATE.IMPLEMENTATION && toState === LIFECYCLE_STATE.CONFORMANCE_TEST) {
    if (!data.implementationVersion && !record.implementationVersion) reasons.push('STANDARD_IMPLEMENTATION_VERSION_MISSING');
    const refs = data.affectedArtifactRefs || record.affectedArtifactRefs;
    if (!Array.isArray(refs) || refs.length === 0) reasons.push('STANDARD_AFFECTED_ARTIFACTS_MISSING');
  }

  if (from === LIFECYCLE_STATE.CONFORMANCE_TEST && toState === LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW) {
    if (data.conformancePassed !== true) reasons.push('STANDARD_CONFORMANCE_TEST_FAILED');
    if (data.regressionPassed !== true) reasons.push('STANDARD_REGRESSION_TEST_FAILED');
    if (!data.conformanceTestRunId) reasons.push('STANDARD_CONFORMANCE_RUN_MISSING');
    if (!data.regressionTestRunId) reasons.push('STANDARD_REGRESSION_RUN_MISSING');
  }

  if (from === LIFECYCLE_STATE.PROFESSIONAL_LEGAL_REVIEW && toState === LIFECYCLE_STATE.RELEASE_APPROVAL) {
    const professionalStatus = data.professionalReviewStatus || record.professionalReviewStatus;
    const legalStatus = data.legalReviewStatus || record.legalReviewStatus;
    if (!approvedOrNotRequired(professionalStatus)) reasons.push('STANDARD_PROFESSIONAL_REVIEW_UNAPPROVED');
    if (!approvedOrNotRequired(legalStatus)) reasons.push('STANDARD_LEGAL_REVIEW_UNAPPROVED');
    if (professionalStatus === REVIEW_STATUS.APPROVED && !data.professionalReviewApprovalId && !record.professionalReviewApprovalId) reasons.push('STANDARD_PROFESSIONAL_REVIEW_APPROVAL_MISSING');
    if (legalStatus === REVIEW_STATUS.APPROVED && !data.legalReviewApprovalId && !record.legalReviewApprovalId) reasons.push('STANDARD_LEGAL_REVIEW_APPROVAL_MISSING');
    if (actorType === ACTOR_TYPE.AI) reasons.push('AI_CANNOT_APPROVE_STANDARD_REVIEW');
  }

  if (from === LIFECYCLE_STATE.RELEASE_APPROVAL && toState === LIFECYCLE_STATE.ACTIVATED) {
    if (actorType !== ACTOR_TYPE.HUMAN) reasons.push('HUMAN_STANDARD_ACTIVATION_REQUIRED');
    if (!data.releaseApprovalId && !record.releaseApprovalId) reasons.push('STANDARD_RELEASE_APPROVAL_MISSING');
    if (!data.activationApprovalId && !record.activationApprovalId) reasons.push('STANDARD_ACTIVATION_APPROVAL_MISSING');
    const sourceStatus = data.verifiedSourceStatus || record.verifiedSourceStatus;
    const effectiveDate = data.effectiveDate || record.effectiveDate;
    if (sourceStatus === STANDARD_STATUS.DRAFT) reasons.push('DRAFT_STANDARD_CANNOT_ACTIVATE');
    if ([STANDARD_STATUS.RETIRED, STANDARD_STATUS.SUPERSEDED, STANDARD_STATUS.SUSPENDED].includes(sourceStatus)) reasons.push('INACTIVE_STANDARD_CANNOT_ACTIVATE');
    if (sourceStatus === STANDARD_STATUS.UNDER_REVIEW) reasons.push('UNDER_REVIEW_STANDARD_CANNOT_ACTIVATE');
    if (sourceStatus === STANDARD_STATUS.FUTURE) {
      if (!isStrictIsoDate(effectiveDate)) reasons.push('FUTURE_STANDARD_EFFECTIVE_DATE_UNVERIFIED');
      else if (!isStrictIsoDate(occurredDate) || occurredDate < effectiveDate) reasons.push('FUTURE_STANDARD_NOT_YET_EFFECTIVE');
    }
  }

  return reasons;
}

function advanceStandardLifecycle(record, {
  toState,
  actorId,
  actorType = ACTOR_TYPE.HUMAN,
  occurredAt,
  reason,
  evidenceRefs = [],
  data = {},
} = {}) {
  if (!record || typeof record !== 'object') throw new TypeError('lifecycle record is required');
  if (!Object.values(LIFECYCLE_STATE).includes(toState)) throw new TypeError('toState is invalid');
  if (!Object.values(ACTOR_TYPE).includes(actorType)) throw new TypeError('actorType is invalid');
  assertString(actorId, 'actorId');
  assertString(reason, 'reason');
  if (!Array.isArray(evidenceRefs)) throw new TypeError('evidenceRefs must be an array');
  assertAllowed(record.lifecycleState, toState);

  const timestamp = normalizeTimestamp(occurredAt, 'occurredAt');
  const occurredDate = timestamp.slice(0, 10);
  const reasons = gateReasons(record, toState, data, actorType, occurredDate);
  if (reasons.length) {
    const error = new Error(reasons.join('|'));
    error.code = 'STANDARD_LIFECYCLE_GATE_BLOCKED';
    error.gateReasons = reasons;
    throw error;
  }

  const next = {
    ...record,
    lifecycleState: toState,
    history: [...record.history, {
      transitionId: `${record.standardId}:${record.history.length + 1}`,
      fromState: record.lifecycleState,
      toState,
      actorId,
      actorType,
      occurredAt: timestamp,
      reason,
      evidenceRefs: [...evidenceRefs],
    }],
  };

  for (const field of [
    'sourceVerified', 'officialSource', 'sourceEvidenceRef', 'verifiedVersion', 'effectiveDate',
    'verifiedSourceStatus', 'impactAnalysisId', 'implementationVersion', 'affectedArtifactRefs',
    'conformanceTestRunId', 'regressionTestRunId', 'conformancePassed', 'regressionPassed',
    'professionalReviewStatus', 'professionalReviewApprovalId', 'legalReviewStatus',
    'legalReviewApprovalId', 'releaseApprovalId', 'activationApprovalId',
  ]) {
    if (Object.prototype.hasOwnProperty.call(data, field)) next[field] = Array.isArray(data[field]) ? [...data[field]] : data[field];
  }

  if (toState === LIFECYCLE_STATE.ACTIVATED) {
    next.activatedAt = timestamp;
    next.proposedStandardStatus = STANDARD_STATUS.ACTIVE;
    next.productionEnforcementAuthorized = true;
  }

  next.transactionAuthorized = false;
  return deepFreeze(next);
}

module.exports = {
  LIFECYCLE_STATE,
  ACTOR_TYPE,
  ALLOWED_TRANSITIONS,
  createStandardLifecycle,
  advanceStandardLifecycle,
};