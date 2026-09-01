'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const POST_DEPLOYMENT_REVIEW_OUTCOME = Object.freeze({
  ACCEPT_PRODUCTION_SERVICE: 'ACCEPT_PRODUCTION_SERVICE',
  ACCEPT_WITH_MONITORING_CONDITIONS: 'ACCEPT_WITH_MONITORING_CONDITIONS',
  HOLD_SERVICE: 'HOLD_SERVICE',
  REQUIRE_ROLLBACK: 'REQUIRE_ROLLBACK',
});

const POST_DEPLOYMENT_REVIEW_STATUS = Object.freeze({
  REVIEW_RECORDED: 'REVIEW_RECORDED',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_DEPLOYMENT_EVIDENCE: 'HOLD_DEPLOYMENT_EVIDENCE',
  HOLD_REVIEW_METADATA: 'HOLD_REVIEW_METADATA',
  HOLD_ACKNOWLEDGEMENTS: 'HOLD_ACKNOWLEDGEMENTS',
  HOLD_CONDITIONS: 'HOLD_CONDITIONS',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
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
    humanPostDeploymentReviewRecorded: false,
    productionServiceUseApprovedByHuman: false,
    monitoringConditionsRemain: false,
    rollbackRequiredByHuman: false,
    productionUseAuthorizedByThisModule: false,
    productionDeploymentVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeMonitoringConditions(conditions) {
  if (!Array.isArray(conditions)) return null;
  const normalized = [];
  const ids = new Set();
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

function recordPostDeploymentHumanReview({
  caseId,
  projectId,
  postDeploymentEvidence,
  review,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!postDeploymentEvidence
      || postDeploymentEvidence.caseId !== caseId
      || postDeploymentEvidence.projectId !== projectId) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_SCOPE, ['post-deployment evidence scope mismatch'], context);
  }

  const deploymentEvidenceReady =
    postDeploymentEvidence.status === 'EVIDENCE_PACK_COMPLETE' &&
    postDeploymentEvidence.productionExecutionEvidenceRecorded === true &&
    postDeploymentEvidence.releaseIdentityObserved === true &&
    postDeploymentEvidence.runtimeVerificationRecorded === true &&
    postDeploymentEvidence.observabilityEvidenceRecorded === true &&
    postDeploymentEvidence.rollbackReadinessRecorded === true &&
    postDeploymentEvidence.readyForPostDeploymentHumanReview === true &&
    postDeploymentEvidence.productionDeploymentVerifiedByThisModule === false &&
    postDeploymentEvidence.productionUseAuthorizedByThisModule === false &&
    postDeploymentEvidence.transactionAuthorized === false;
  if (!deploymentEvidenceReady) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_DEPLOYMENT_EVIDENCE, ['complete bounded post-deployment evidence is required for human review'], context);
  }

  const reviewedAt = explicitTimezoneTimestamp(review?.reviewedAt);
  const reviewMetadataValid =
    review &&
    nonEmptyString(review.reviewId) &&
    nonEmptyString(review.reviewedByRef) &&
    nonEmptyString(review.reviewEvidenceRef) &&
    reviewedAt &&
    Object.values(POST_DEPLOYMENT_REVIEW_OUTCOME).includes(review.outcome) &&
    review.conflictDeclarationCompleted === true;
  if (!reviewMetadataValid) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_REVIEW_METADATA, ['human post-deployment review identity, outcome, timestamp, conflict declaration, and evidence reference are required'], context);
  }

  const evidenceCapturedAt = explicitTimezoneTimestamp(postDeploymentEvidence.runtime?.evidenceCapturedAt);
  if (!evidenceCapturedAt || reviewedAt.epochMs < evidenceCapturedAt.epochMs) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_TIMELINE, ['human review must occur after post-deployment runtime evidence capture'], context);
  }

  const acknowledgements = review.acknowledgements || {};
  const acknowledgementKeys = [
    'releaseIdentityReviewed',
    'runtimeEvidenceReviewed',
    'incidentSummaryReviewed',
    'observabilityReviewed',
    'rollbackReadinessReviewed',
    'humanAccountabilityAccepted',
  ];
  if (!acknowledgementKeys.every((key) => acknowledgements[key] === true)) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_ACKNOWLEDGEMENTS, ['all post-deployment human review acknowledgements are required'], context);
  }

  const normalizedConditions = normalizeMonitoringConditions(review.monitoringConditions || []);
  if (normalizedConditions === null) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_CONDITIONS, ['monitoring conditions must have unique conditionId, description, ownerRef, and monitoringEvidenceRef'], context);
  }
  if (review.outcome === POST_DEPLOYMENT_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS && normalizedConditions.length === 0) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_CONDITIONS, ['conditional production-service acceptance requires at least one explicit monitoring condition'], context);
  }
  if (review.outcome === POST_DEPLOYMENT_REVIEW_OUTCOME.ACCEPT_PRODUCTION_SERVICE && normalizedConditions.length > 0) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_CONDITIONS, ['unconditional production-service acceptance cannot carry monitoring conditions'], context);
  }
  if ([POST_DEPLOYMENT_REVIEW_OUTCOME.HOLD_SERVICE, POST_DEPLOYMENT_REVIEW_OUTCOME.REQUIRE_ROLLBACK].includes(review.outcome)
      && normalizedConditions.length > 0) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_CONDITIONS, ['hold/rollback outcomes cannot be represented as conditional service acceptance'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(postDeploymentEvidence.evidenceRefs || []),
    postDeploymentEvidence.execution?.executionEvidenceRef,
    postDeploymentEvidence.runtime?.runtimeEvidenceRef,
    postDeploymentEvidence.rollback?.evidenceRef,
    review.reviewedByRef,
    review.reviewEvidenceRef,
    ...normalizedConditions.flatMap((condition) => [condition.ownerRef, condition.monitoringEvidenceRef]),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(POST_DEPLOYMENT_REVIEW_STATUS.HOLD_EVIDENCE_CHAIN, ['post-deployment human-review evidence chain is incomplete'], context);
  }

  const productionServiceAccepted = [
    POST_DEPLOYMENT_REVIEW_OUTCOME.ACCEPT_PRODUCTION_SERVICE,
    POST_DEPLOYMENT_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS,
  ].includes(review.outcome);
  const rollbackRequired = review.outcome === POST_DEPLOYMENT_REVIEW_OUTCOME.REQUIRE_ROLLBACK;

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: POST_DEPLOYMENT_REVIEW_STATUS.REVIEW_RECORDED,
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
    productionExecution: Object.freeze({
      executionId: postDeploymentEvidence.execution.executionId,
      appVersion: postDeploymentEvidence.release.appVersion,
      buildId: postDeploymentEvidence.release.buildId,
      sourceCommit: postDeploymentEvidence.release.sourceCommit,
      targetRef: postDeploymentEvidence.target.targetRef,
      runtimeEvidenceRef: postDeploymentEvidence.runtime.runtimeEvidenceRef,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanPostDeploymentReviewRecorded: true,
    productionServiceUseApprovedByHuman: productionServiceAccepted,
    monitoringConditionsRemain: review.outcome === POST_DEPLOYMENT_REVIEW_OUTCOME.ACCEPT_WITH_MONITORING_CONDITIONS,
    rollbackRequiredByHuman: rollbackRequired,
    productionUseAuthorizedByThisModule: false,
    productionDeploymentVerifiedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'REVIEW_RECORDED preserves an explicit human operational decision after post-deployment evidence review. An ACCEPT outcome records human acceptance of production service operation; the software itself does not independently authorize production use, attest the external deployment, certify security/legal/valuation status, or authorize an investment transaction. HOLD_SERVICE and REQUIRE_ROLLBACK remain explicit human operational outcomes.',
  });
}

module.exports = {
  POST_DEPLOYMENT_REVIEW_OUTCOME,
  POST_DEPLOYMENT_REVIEW_STATUS,
  normalizeMonitoringConditions,
  recordPostDeploymentHumanReview,
};
