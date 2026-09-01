'use strict';

const CONTROLLED_PRODUCTION_ACTIVATION_STATUS = Object.freeze({
  READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION: 'READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_HUMAN_DECISION: 'HOLD_HUMAN_DECISION',
  HOLD_STAGING_EVIDENCE: 'HOLD_STAGING_EVIDENCE',
  HOLD_RELEASE_BINDING: 'HOLD_RELEASE_BINDING',
  HOLD_CONDITIONS: 'HOLD_CONDITIONS',
  HOLD_TARGET: 'HOLD_TARGET',
  HOLD_CHANGE_WINDOW: 'HOLD_CHANGE_WINDOW',
  HOLD_OPERATOR: 'HOLD_OPERATOR',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

const APPROVED_OUTCOMES = new Set(['APPROVE_CONTROLLED_PRODUCTION', 'APPROVE_WITH_CONDITIONS']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? [...new Set(refs.filter(nonEmptyString).map((ref) => ref.trim()))] : [];
}

function explicitTimezoneTimestamp(value) {
  if (!nonEmptyString(value)) return null;
  const raw = value.trim();
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) return null;
  const epochMs = Date.parse(raw);
  if (!Number.isFinite(epochMs)) return null;
  return { raw, epochMs, canonical: new Date(epochMs).toISOString() };
}

function isCommitSha(value) {
  return nonEmptyString(value) && /^[a-f0-9]{40}$/i.test(value.trim());
}

function hold(status, reasons, context = {}) {
  return Object.freeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons: Object.freeze(reasons),
    humanApprovalConfirmed: false,
    conditionsResolved: false,
    stagingEvidenceConfirmed: false,
    releaseIdentityBound: false,
    productionTargetDeclared: false,
    changeWindowValidated: false,
    humanOperatorValidated: false,
    deploymentExecutionReadyForAuthorizedOperator: false,
    deploymentExecutionAuthorizedByThisModule: false,
    deploymentExecuted: false,
    productionDeploymentVerified: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function validateConditionResolutions(decisionConditions, resolutions, plannedExecutionAt) {
  const conditions = Array.isArray(decisionConditions) ? decisionConditions : [];
  if (!Array.isArray(resolutions)) return { valid: false, reasons: ['conditionResolutions must be an array'], normalized: [] };

  const conditionIds = conditions.map((condition) => nonEmptyString(condition?.conditionId) ? condition.conditionId.trim() : null);
  if (conditionIds.some((id) => !id) || new Set(conditionIds).size !== conditionIds.length) {
    return { valid: false, reasons: ['human decision conditions must have unique non-empty conditionId values'], normalized: [] };
  }

  if (conditions.length === 0) {
    if (resolutions.length !== 0) return { valid: false, reasons: ['condition resolutions supplied for a decision with no conditions'], normalized: [] };
    return { valid: true, reasons: [], normalized: [] };
  }

  const planned = explicitTimezoneTimestamp(plannedExecutionAt);
  const byId = new Map();
  for (const resolution of resolutions) {
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
      return { valid: false, reasons: ['each condition resolution must be an object'], normalized: [] };
    }
    const conditionId = nonEmptyString(resolution.conditionId) ? resolution.conditionId.trim() : null;
    const resolvedAt = explicitTimezoneTimestamp(resolution.resolvedAt);
    if (!conditionId || byId.has(conditionId) || resolution.satisfied !== true
        || !nonEmptyString(resolution.resolvedByRef)
        || !nonEmptyString(resolution.resolutionEvidenceRef)
        || !resolvedAt) {
      return { valid: false, reasons: ['each condition requires one unique satisfied resolution with resolver, timezone-explicit timestamp, and evidence reference'], normalized: [] };
    }
    if (planned && resolvedAt.epochMs > planned.epochMs) {
      return { valid: false, reasons: ['all conditions must be resolved before the planned production execution time'], normalized: [] };
    }
    byId.set(conditionId, {
      conditionId,
      satisfied: true,
      resolvedByRef: resolution.resolvedByRef.trim(),
      resolvedAt: resolvedAt.canonical,
      resolutionEvidenceRef: resolution.resolutionEvidenceRef.trim(),
    });
  }

  if (byId.size !== conditions.length || conditionIds.some((id) => !byId.has(id))) {
    return { valid: false, reasons: ['every human go-live condition must be explicitly resolved before activation'], normalized: [] };
  }

  return { valid: true, reasons: [], normalized: conditionIds.map((id) => byId.get(id)) };
}

function buildControlledProductionActivation({
  caseId,
  projectId,
  humanGoLiveDecision,
  stagingDeploymentEvidence,
  releaseManifest,
  productionTarget,
  changeWindow,
  operator,
  conditionResolutions = [],
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }

  const humanScopeValid = humanGoLiveDecision
    && humanGoLiveDecision.caseId === caseId
    && humanGoLiveDecision.projectId === projectId;
  const stagingScopeValid = stagingDeploymentEvidence
    && stagingDeploymentEvidence.caseId === caseId
    && stagingDeploymentEvidence.projectId === projectId;
  if (!humanScopeValid || !stagingScopeValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_SCOPE, ['human decision and staging evidence must match case/project scope'], context);
  }

  const decision = humanGoLiveDecision.decision || {};
  const humanDecisionValid =
    humanGoLiveDecision.status === 'DECISION_RECORDED' &&
    humanGoLiveDecision.humanDecisionRecorded === true &&
    humanGoLiveDecision.humanGoLiveApproved === true &&
    humanGoLiveDecision.deploymentExecuted === false &&
    humanGoLiveDecision.transactionAuthorized === false &&
    APPROVED_OUTCOMES.has(decision.outcome) &&
    nonEmptyString(decision.decisionId) &&
    nonEmptyString(decision.decidedByRef) &&
    nonEmptyString(decision.decisionEvidenceRef) &&
    explicitTimezoneTimestamp(decision.decidedAt);
  if (!humanDecisionValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_HUMAN_DECISION, ['an explicit approved, scoped, non-executing human go-live decision is required'], context);
  }

  const stagingValid =
    stagingDeploymentEvidence.status === 'EVIDENCE_PACK_COMPLETE' &&
    stagingDeploymentEvidence.environment?.kind === 'STAGING' &&
    stagingDeploymentEvidence.readyForProductionReadinessAudit === true &&
    stagingDeploymentEvidence.productionDeploymentAuthorized === false &&
    stagingDeploymentEvidence.transactionAuthorized === false &&
    nonEmptyString(stagingDeploymentEvidence.release?.version) &&
    isCommitSha(stagingDeploymentEvidence.release?.commitSha) &&
    nonEmptyString(stagingDeploymentEvidence.release?.releaseRef);
  if (!stagingValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_STAGING_EVIDENCE, ['complete STAGING deployment/runtime evidence is required before production activation'], context);
  }

  const manifestValid =
    releaseManifest &&
    releaseManifest.schemaVersion === 1 &&
    nonEmptyString(releaseManifest.appVersion) &&
    nonEmptyString(releaseManifest.buildId) &&
    releaseManifest.sourceCommitBound === true &&
    isCommitSha(releaseManifest.sourceCommit) &&
    releaseManifest.deploymentVerified === false &&
    releaseManifest.productionDeploymentAuthorized === false &&
    releaseManifest.evidenceBoundary === 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF';
  const releaseMatches = manifestValid
    && releaseManifest.appVersion === stagingDeploymentEvidence.release.version
    && releaseManifest.sourceCommit.toLowerCase() === stagingDeploymentEvidence.release.commitSha.toLowerCase();
  if (!releaseMatches) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_RELEASE_BINDING, ['release manifest must be source-bound and exactly match the validated staging release'], context);
  }

  const targetValid =
    productionTarget &&
    productionTarget.targetDeclared === true &&
    String(productionTarget.kind || '').toUpperCase() === 'PRODUCTION' &&
    nonEmptyString(productionTarget.name) &&
    nonEmptyString(productionTarget.targetRef);
  if (!targetValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_TARGET, ['an explicit PRODUCTION target and targetRef are required'], context);
  }

  const windowStart = explicitTimezoneTimestamp(changeWindow?.startsAt);
  const windowEnd = explicitTimezoneTimestamp(changeWindow?.endsAt);
  const plannedExecution = explicitTimezoneTimestamp(changeWindow?.plannedExecutionAt);
  const changeWindowValid =
    nonEmptyString(changeWindow?.windowId) &&
    windowStart && windowEnd && plannedExecution &&
    windowStart.epochMs < windowEnd.epochMs &&
    plannedExecution.epochMs >= windowStart.epochMs &&
    plannedExecution.epochMs <= windowEnd.epochMs &&
    nonEmptyString(changeWindow?.approvedByRef) &&
    nonEmptyString(changeWindow?.approvalEvidenceRef) &&
    changeWindow?.rollbackWindowAcknowledged === true;
  if (!changeWindowValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_CHANGE_WINDOW, ['approved timezone-explicit production change window and planned execution time are required'], context);
  }

  const humanDecisionAt = explicitTimezoneTimestamp(decision.decidedAt);
  if (humanDecisionAt.epochMs > plannedExecution.epochMs) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_CHANGE_WINDOW, ['planned execution cannot precede the recorded human go-live decision'], context);
  }

  const operatorValid =
    operator &&
    nonEmptyString(operator.operatorRef) &&
    operator.verified === true &&
    operator.humanOperator === true &&
    operator.accountabilityAccepted === true &&
    nonEmptyString(operator.authorizationBasisRef);
  if (!operatorValid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_OPERATOR, ['a verified accountable human deployment operator and authorization basis are required'], context);
  }

  const conditionValidation = validateConditionResolutions(decision.conditions || [], conditionResolutions, changeWindow.plannedExecutionAt);
  if (!conditionValidation.valid) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_CONDITIONS, conditionValidation.reasons, context);
  }
  if (decision.outcome === 'APPROVE_CONTROLLED_PRODUCTION' && (decision.conditions || []).length > 0) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_CONDITIONS, ['unconditional controlled-production approval cannot carry conditions'], context);
  }
  if (decision.outcome === 'APPROVE_WITH_CONDITIONS' && (decision.conditions || []).length === 0) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_CONDITIONS, ['conditional approval requires explicit conditions'], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(humanGoLiveDecision.evidenceRefs || []),
    ...(stagingDeploymentEvidence.evidenceRefs || []),
    stagingDeploymentEvidence.release.releaseRef,
    decision.decidedByRef,
    decision.decisionEvidenceRef,
    productionTarget.targetRef,
    changeWindow.approvedByRef,
    changeWindow.approvalEvidenceRef,
    operator.operatorRef,
    operator.authorizationBasisRef,
    ...conditionValidation.normalized.flatMap((resolution) => [resolution.resolvedByRef, resolution.resolutionEvidenceRef]),
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (suppliedRefs.length === 0 || missingRefs.length > 0) {
    return hold(CONTROLLED_PRODUCTION_ACTIVATION_STATUS.HOLD_EVIDENCE_CHAIN, ['controlled production activation evidence chain is incomplete'], context);
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: CONTROLLED_PRODUCTION_ACTIVATION_STATUS.READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION,
    reasons: Object.freeze([]),
    humanDecision: Object.freeze({
      decisionId: decision.decisionId.trim(),
      outcome: decision.outcome,
      decidedByRef: decision.decidedByRef.trim(),
      decidedAt: humanDecisionAt.canonical,
    }),
    sourceRelease: Object.freeze({
      appVersion: releaseManifest.appVersion,
      buildId: releaseManifest.buildId,
      sourceCommit: releaseManifest.sourceCommit.toLowerCase(),
      stagingReleaseRef: stagingDeploymentEvidence.release.releaseRef.trim(),
      artifactDigest: nonEmptyString(stagingDeploymentEvidence.release.artifactDigest)
        ? stagingDeploymentEvidence.release.artifactDigest.trim() : null,
    }),
    productionTarget: Object.freeze({
      name: productionTarget.name.trim(),
      kind: 'PRODUCTION',
      targetRef: productionTarget.targetRef.trim(),
      url: nonEmptyString(productionTarget.url) ? productionTarget.url.trim() : null,
    }),
    changeWindow: Object.freeze({
      windowId: changeWindow.windowId.trim(),
      startsAt: windowStart.canonical,
      endsAt: windowEnd.canonical,
      plannedExecutionAt: plannedExecution.canonical,
      approvedByRef: changeWindow.approvedByRef.trim(),
      approvalEvidenceRef: changeWindow.approvalEvidenceRef.trim(),
    }),
    operator: Object.freeze({
      operatorRef: operator.operatorRef.trim(),
      authorizationBasisRef: operator.authorizationBasisRef.trim(),
      verified: true,
      humanOperator: true,
      accountabilityAccepted: true,
    }),
    conditionResolutions: Object.freeze(conditionValidation.normalized.map((item) => Object.freeze({ ...item }))),
    evidenceRefs: Object.freeze(suppliedRefs),
    humanApprovalConfirmed: true,
    conditionsResolved: true,
    stagingEvidenceConfirmed: true,
    releaseIdentityBound: true,
    productionTargetDeclared: true,
    changeWindowValidated: true,
    humanOperatorValidated: true,
    deploymentExecutionReadyForAuthorizedOperator: true,
    deploymentExecutionAuthorizedByThisModule: false,
    deploymentExecuted: false,
    productionDeploymentVerified: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION confirms that an already-recorded human go-live approval, validated STAGING evidence, immutable source-bound release identity, resolved conditions, production target, change window, operator identity, and evidence chain are consistent. This module does not execute deployment, independently authorize an operator, verify a live production deployment, certify security/legal/valuation status, authorize production use, or authorize an investment transaction. Actual production deployment requires the accountable human operator and separate post-deployment runtime evidence.',
  });
}

module.exports = {
  CONTROLLED_PRODUCTION_ACTIVATION_STATUS,
  explicitTimezoneTimestamp,
  validateConditionResolutions,
  buildControlledProductionActivation,
};
