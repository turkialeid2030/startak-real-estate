'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const POST_ROLLBACK_REVIEW_OUTCOME = Object.freeze({
  ACCEPT_RESTORED_SERVICE: 'ACCEPT_RESTORED_SERVICE',
  ACCEPT_WITH_MONITORING_CONDITIONS: 'ACCEPT_WITH_MONITORING_CONDITIONS',
  HOLD_SERVICE: 'HOLD_SERVICE',
  ESCALATE_INCIDENT: 'ESCALATE_INCIDENT',
});

const POST_ROLLBACK_REVIEW_STATUS = Object.freeze({
  REVIEW_RECORDED: 'REVIEW_RECORDED',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_ROLLBACK_EVIDENCE: 'HOLD_ROLLBACK_EVIDENCE',
  HOLD_REVIEW_METADATA: 'HOLD_REVIEW_METADATA',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_CONDITIONS: 'HOLD_CONDITIONS',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    humanPostRollbackReviewRecorded: false,
    restoredServiceAcceptedByHuman: false,
    monitoringConditionsRemain: false,
    serviceHoldRequiredByHuman: false,
    escalationRequiredByHuman: false,
    productionUseAuthorizedByThisModule: false,
    rollbackVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeConditions(conditions) {
  if (!Array.isArray(conditions)) return null;
  const ids = new Set();
  const normalized = [];
  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return null;
    if (!nonEmptyString(condition.conditionId)
        || !nonEmptyString(condition.description)
        || !nonEmptyString(condition.ownerRef)
        || !nonEmptyString(condition.monitoringEvidenceRef)) return null;
    const conditionId = condition.conditionId.trim();
    if (ids.has(conditionId)) return null;
    ids.add(conditionId);
    normalized.push(Object.freeze({
      conditionId,
      description: condition.description.trim(),
      ownerRef: condition.ownerRef.trim(),
      monitoringEvidenceRef: condition.monitoringEvidenceRef.trim(),
      escalationRequiredOnBreach: condition.escalationRequiredOnBreach !== false,
    }));
  }
  return Object.freeze(normalized);
}

function recordPostRollbackHumanReview({
  caseId,
  projectId,
  rollbackEvidence,
  review,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!rollbackEvidence || rollbackEvidence.caseId !== caseId || rollbackEvidence.projectId !== projectId) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_SCOPE, ['rollback evidence scope mismatch'], context);
  }

  const rollbackReady =
    rollbackEvidence.status === 'EVIDENCE_PACK_COMPLETE' &&
    rollbackEvidence.rollbackExecutionEvidenceRecorded === true &&
    rollbackEvidence.targetReleaseRuntimeEvidenceRecorded === true &&
    rollbackEvidence.readyForHumanRollbackReview === true &&
    rollbackEvidence.rollbackVerifiedByThisModule === false &&
    rollbackEvidence.productionUseAuthorizedByThisModule === false &&
    rollbackEvidence.transactionAuthorized === false;
  if (!rollbackReady) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_ROLLBACK_EVIDENCE, ['complete bounded rollback execution/runtime evidence is required'], context);
  }

  const reviewedAt = explicitTimezoneTimestamp(review?.reviewedAt);
  const metadataValid = review
    && nonEmptyString(review.reviewId)
    && nonEmptyString(review.reviewedByRef)
    && nonEmptyString(review.reviewEvidenceRef)
    && reviewedAt
    && Object.values(POST_ROLLBACK_REVIEW_OUTCOME).includes(review.outcome)
    && review.conflictDeclarationCompleted === true;
  if (!metadataValid) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_REVIEW_METADATA, ['human post-rollback review identity, outcome, timezone-explicit timestamp, conflict declaration, and evidence reference are required'], context);
  }

  const evidenceCapturedAt = explicitTimezoneTimestamp(rollbackEvidence.runtime?.evidenceCapturedAt);
  if (!evidenceCapturedAt || reviewedAt.epochMs < evidenceCapturedAt.epochMs) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_TIMELINE, ['post-rollback human review must occur at or after rollback runtime evidence capture'], context);
  }

  const acknowledgements = review.acknowledgements || {};
  const acknowledgementKeys = [
    'rollbackDecisionReviewed',
    'rollbackPlanReviewed',
    'rollbackExecutionReviewed',
    'targetReleaseIdentityReviewed',
    'runtimeEvidenceReviewed',
    'humanAccountabilityAccepted',
  ];
  if (!acknowledgementKeys.every((key) => acknowledgements[key] === true)) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all post-rollback human review acknowledgements are required'], context);
  }

  const normalizedConditions = normalizeConditions(review.monitoringConditions || []);
  if (normalizedConditions === null) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_CONDITIONS, ['monitoring conditions must be unique and include owner/evidence references'], context);
  }
  if (review.outcome === POST_ROLLBACK_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS && normalizedConditions.length === 0) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_CONDITIONS, ['conditional restored-service acceptance requires at least one explicit monitoring condition'], context);
  }
  if (review.outcome === POST_ROLLBACK_REVIEW_OUTCOME.ACCEPT_RESTORED_SERVICE && normalizedConditions.length > 0) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_CONDITIONS, ['unconditional restored-service acceptance cannot carry hidden monitoring conditions'], context);
  }
  if ([POST_ROLLBACK_REVIEW_OUTCOME.HOLD_SERVICE, POST_ROLLBACK_REVIEW_OUTCOME.ESCALATE_INCIDENT].includes(review.outcome)
      && normalizedConditions.length > 0) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_CONDITIONS, ['hold/escalation outcomes cannot be represented as conditional service acceptance'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(rollbackEvidence.evidenceRefs || []),
    rollbackEvidence.humanRollbackDecision?.decisionEvidenceRef,
    rollbackEvidence.execution?.executionEvidenceRef,
    rollbackEvidence.runtime?.runtimeEvidenceRef,
    review.reviewedByRef,
    review.reviewEvidenceRef,
    ...normalizedConditions.flatMap((condition) => [condition.ownerRef, condition.monitoringEvidenceRef]),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(POST_ROLLBACK_REVIEW_STATUS.HOLD_EVIDENCE_CHAIN, ['post-rollback human-review evidence chain is incomplete'], context);
  }

  const accepted = [
    POST_ROLLBACK_REVIEW_OUTCOME.ACCEPT_RESTORED_SERVICE,
    POST_ROLLBACK_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS,
  ].includes(review.outcome);

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: POST_ROLLBACK_REVIEW_STATUS.REVIEW_RECORDED,
    reasons: Object.freeze([]),
    review: Object.freeze({
      reviewId: review.reviewId.trim(),
      outcome: review.outcome,
      reviewedByRef: review.reviewedByRef.trim(),
      reviewedAt: reviewedAt.canonical,
      reviewEvidenceRef: review.reviewEvidenceRef.trim(),
      conflictDeclarationCompleted: true,
      acknowledgements: Object.freeze(Object.fromEntries(acknowledgementKeys.map((key) => [key, true]))),
      monitoringConditions: normalizedConditions,
    }),
    restoredRelease: Object.freeze({
      appVersion: rollbackEvidence.rollbackPlan.targetRelease.appVersion,
      buildId: rollbackEvidence.rollbackPlan.targetRelease.buildId,
      sourceCommit: rollbackEvidence.rollbackPlan.targetRelease.sourceCommit,
      releaseRef: rollbackEvidence.rollbackPlan.targetRelease.releaseRef,
      runtimeEvidenceRef: rollbackEvidence.runtime.runtimeEvidenceRef,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanPostRollbackReviewRecorded: true,
    restoredServiceAcceptedByHuman: accepted,
    monitoringConditionsRemain: review.outcome === POST_ROLLBACK_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS,
    serviceHoldRequiredByHuman: review.outcome === POST_ROLLBACK_REVIEW_OUTCOME.HOLD_SERVICE,
    escalationRequiredByHuman: review.outcome === POST_ROLLBACK_REVIEW_OUTCOME.ESCALATE_INCIDENT,
    productionUseAuthorizedByThisModule: false,
    rollbackVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'REVIEW_RECORDED preserves an accountable human decision after reviewing the supplied rollback execution and restored-release runtime evidence. ACCEPT outcomes record human operational acceptance only; the software does not independently authorize production use, attest the external rollback, certify security/legal/valuation status, or authorize an investment transaction. HOLD_SERVICE and ESCALATE_INCIDENT remain explicit human operational outcomes.',
  });
}

module.exports = {
  POST_ROLLBACK_REVIEW_OUTCOME,
  POST_ROLLBACK_REVIEW_STATUS,
  recordPostRollbackHumanReview,
};
