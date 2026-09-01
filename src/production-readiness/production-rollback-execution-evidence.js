'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const PRODUCTION_ROLLBACK_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_HUMAN_DECISION: 'HOLD_HUMAN_DECISION',
  HOLD_PLAN: 'HOLD_PLAN',
  HOLD_RELEASE_BINDING: 'HOLD_RELEASE_BINDING',
  HOLD_EXECUTION: 'HOLD_EXECUTION',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_RUNTIME: 'HOLD_RUNTIME',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function validCommit(value) {
  return nonEmptyString(value) && /^[0-9a-f]{40}$/i.test(value.trim());
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    rollbackExecutionEvidenceRecorded: false,
    targetReleaseRuntimeEvidenceRecorded: false,
    readyForHumanRollbackReview: false,
    rollbackVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function normalizeHumanRollbackDecision(decision) {
  if (!decision || typeof decision !== 'object') return null;

  if (decision.status === 'DECISION_RECORDED'
      && decision.rollbackRequiredByHuman === true
      && decision.rollbackExecuted === false
      && decision.decision?.outcome === 'REQUIRE_ROLLBACK'
      && nonEmptyString(decision.decision?.decidedByRef)
      && nonEmptyString(decision.decision?.decisionEvidenceRef)) {
    const decidedAt = explicitTimezoneTimestamp(decision.decision.decidedAt);
    if (!decidedAt) return null;
    return Object.freeze({
      source: 'CONTINUITY_DECISION',
      decisionId: decision.decision.decisionId,
      decidedByRef: decision.decision.decidedByRef.trim(),
      decisionEvidenceRef: decision.decision.decisionEvidenceRef.trim(),
      decidedAt: decidedAt.canonical,
      decidedEpochMs: decidedAt.epochMs,
      evidenceRefs: cleanRefs(decision.evidenceRefs),
    });
  }

  if (decision.status === 'REVIEW_RECORDED'
      && decision.rollbackRequiredByHuman === true
      && decision.productionUseAuthorizedByThisModule === false
      && decision.review?.outcome === 'REQUIRE_ROLLBACK'
      && nonEmptyString(decision.review?.reviewedByRef)
      && nonEmptyString(decision.review?.reviewEvidenceRef)) {
    const decidedAt = explicitTimezoneTimestamp(decision.review.reviewedAt);
    if (!decidedAt) return null;
    return Object.freeze({
      source: 'POST_DEPLOYMENT_REVIEW',
      decisionId: decision.review.reviewId,
      decidedByRef: decision.review.reviewedByRef.trim(),
      decisionEvidenceRef: decision.review.reviewEvidenceRef.trim(),
      decidedAt: decidedAt.canonical,
      decidedEpochMs: decidedAt.epochMs,
      evidenceRefs: cleanRefs(decision.evidenceRefs),
    });
  }

  return null;
}

function normalizeRelease(release) {
  if (!release || typeof release !== 'object') return null;
  if (!nonEmptyString(release.appVersion)
      || !nonEmptyString(release.buildId)
      || !validCommit(release.sourceCommit)
      || !nonEmptyString(release.releaseRef)) return null;
  return Object.freeze({
    appVersion: release.appVersion.trim(),
    buildId: release.buildId.trim(),
    sourceCommit: release.sourceCommit.trim().toLowerCase(),
    releaseRef: release.releaseRef.trim(),
    artifactDigest: nonEmptyString(release.artifactDigest) ? release.artifactDigest.trim() : null,
  });
}

function buildProductionRollbackExecutionEvidence({
  caseId,
  projectId,
  humanRollbackDecision,
  rollbackPlan,
  execution,
  runtimeVerification,
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!humanRollbackDecision
      || humanRollbackDecision.caseId !== caseId
      || humanRollbackDecision.projectId !== projectId) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_SCOPE, ['human rollback decision scope mismatch'], context);
  }

  const humanDecision = normalizeHumanRollbackDecision(humanRollbackDecision);
  if (!humanDecision) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_HUMAN_DECISION, ['an explicit human REQUIRE_ROLLBACK decision is required'], context);
  }

  const currentRelease = normalizeRelease(rollbackPlan?.currentRelease);
  const targetRelease = normalizeRelease(rollbackPlan?.targetRelease);
  const planValid = rollbackPlan
    && nonEmptyString(rollbackPlan.planId)
    && nonEmptyString(rollbackPlan.approvedByRef)
    && nonEmptyString(rollbackPlan.approvalEvidenceRef)
    && nonEmptyString(rollbackPlan.operatorRef)
    && currentRelease
    && targetRelease;
  if (!planValid) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_PLAN, ['rollback plan, accountable operator, approval evidence, current release, and target release are required'], context);
  }
  const sameRelease = currentRelease.buildId === targetRelease.buildId
    || currentRelease.sourceCommit === targetRelease.sourceCommit
    || currentRelease.releaseRef === targetRelease.releaseRef;
  if (sameRelease) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_RELEASE_BINDING, ['rollback target must be distinct from the current release'], context);
  }

  const startedAt = explicitTimezoneTimestamp(execution?.startedAt);
  const completedAt = explicitTimezoneTimestamp(execution?.completedAt);
  const executionValid = execution
    && execution.rollbackCompleted === true
    && nonEmptyString(execution.executionId)
    && execution.planId === rollbackPlan.planId
    && execution.performedByRef === rollbackPlan.operatorRef
    && nonEmptyString(execution.executionEvidenceRef)
    && startedAt
    && completedAt;
  if (!executionValid) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_EXECUTION, ['rollback execution must be complete, bound to the approved plan/operator, timestamped, and evidenced'], context);
  }
  if (startedAt.epochMs < humanDecision.decidedEpochMs || completedAt.epochMs < startedAt.epochMs) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_TIMELINE, ['rollback execution must begin after the human rollback decision and complete after it starts'], context);
  }

  const executionRelease = normalizeRelease(execution.targetRelease);
  const releaseBound = executionRelease
    && executionRelease.appVersion === targetRelease.appVersion
    && executionRelease.buildId === targetRelease.buildId
    && executionRelease.sourceCommit === targetRelease.sourceCommit
    && executionRelease.releaseRef === targetRelease.releaseRef
    && executionRelease.artifactDigest === targetRelease.artifactDigest;
  if (!releaseBound) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_RELEASE_BINDING, ['executed rollback target must exactly match the approved target release identity'], context);
  }

  const verifiedAt = explicitTimezoneTimestamp(runtimeVerification?.verifiedAt);
  const evidenceCapturedAt = explicitTimezoneTimestamp(runtimeVerification?.evidenceCapturedAt);
  const runtimeValid = runtimeVerification
    && runtimeVerification.healthCheckPassed === true
    && runtimeVerification.smokeTestsPassed === true
    && runtimeVerification.realBrowserE2ePassed === true
    && runtimeVerification.fatalConsoleErrors === 0
    && runtimeVerification.pageErrors === 0
    && runtimeVerification.observedBuildId === targetRelease.buildId
    && String(runtimeVerification.observedSourceCommit || '').toLowerCase() === targetRelease.sourceCommit
    && nonEmptyString(runtimeVerification.runtimeEvidenceRef)
    && verifiedAt
    && evidenceCapturedAt
    && verifiedAt.epochMs >= completedAt.epochMs
    && evidenceCapturedAt.epochMs >= verifiedAt.epochMs;
  if (!runtimeValid) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_RUNTIME, ['post-rollback runtime verification must pass and observe the exact approved target build/source after execution'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...humanDecision.evidenceRefs,
    humanDecision.decidedByRef,
    humanDecision.decisionEvidenceRef,
    rollbackPlan.approvedByRef,
    rollbackPlan.approvalEvidenceRef,
    rollbackPlan.operatorRef,
    currentRelease.releaseRef,
    targetRelease.releaseRef,
    execution.executionEvidenceRef,
    runtimeVerification.runtimeEvidenceRef,
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(PRODUCTION_ROLLBACK_STATUS.HOLD_EVIDENCE_CHAIN, ['rollback evidence reference chain is incomplete'], context);
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: PRODUCTION_ROLLBACK_STATUS.EVIDENCE_PACK_COMPLETE,
    reasons: Object.freeze([]),
    humanRollbackDecision: Object.freeze({
      source: humanDecision.source,
      decisionId: humanDecision.decisionId,
      decidedByRef: humanDecision.decidedByRef,
      decidedAt: humanDecision.decidedAt,
      decisionEvidenceRef: humanDecision.decisionEvidenceRef,
    }),
    rollbackPlan: Object.freeze({
      planId: rollbackPlan.planId.trim(),
      approvedByRef: rollbackPlan.approvedByRef.trim(),
      approvalEvidenceRef: rollbackPlan.approvalEvidenceRef.trim(),
      operatorRef: rollbackPlan.operatorRef.trim(),
      currentRelease,
      targetRelease,
    }),
    execution: Object.freeze({
      executionId: execution.executionId.trim(),
      performedByRef: execution.performedByRef.trim(),
      startedAt: startedAt.canonical,
      completedAt: completedAt.canonical,
      executionEvidenceRef: execution.executionEvidenceRef.trim(),
      targetRelease: executionRelease,
    }),
    runtime: Object.freeze({
      healthCheckPassed: true,
      smokeTestsPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      pageErrors: 0,
      observedBuildId: runtimeVerification.observedBuildId,
      observedSourceCommit: String(runtimeVerification.observedSourceCommit).toLowerCase(),
      verifiedAt: verifiedAt.canonical,
      evidenceCapturedAt: evidenceCapturedAt.canonical,
      runtimeEvidenceRef: runtimeVerification.runtimeEvidenceRef.trim(),
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    rollbackExecutionEvidenceRecorded: true,
    targetReleaseRuntimeEvidenceRecorded: true,
    readyForHumanRollbackReview: true,
    rollbackVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'EVIDENCE_PACK_COMPLETE records caller-supplied evidence that a human-required rollback was executed against the approved target release and that post-rollback runtime checks observed that target identity. The module does not independently attest the external rollback, authorize production use, certify security/legal/valuation status, or authorize an investment transaction. A separate accountable human rollback review remains required.',
  });
}

module.exports = {
  PRODUCTION_ROLLBACK_STATUS,
  normalizeHumanRollbackDecision,
  buildProductionRollbackExecutionEvidence,
};
