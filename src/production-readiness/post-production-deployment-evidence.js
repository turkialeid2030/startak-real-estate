'use strict';

const { explicitTimezoneTimestamp } = require('./controlled-production-activation');

const POST_PRODUCTION_DEPLOYMENT_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_ACTIVATION: 'HOLD_ACTIVATION',
  HOLD_RELEASE: 'HOLD_RELEASE',
  HOLD_TARGET: 'HOLD_TARGET',
  HOLD_EXECUTION: 'HOLD_EXECUTION',
  HOLD_RUNTIME: 'HOLD_RUNTIME',
  HOLD_OBSERVABILITY: 'HOLD_OBSERVABILITY',
  HOLD_ROLLBACK: 'HOLD_ROLLBACK',
  HOLD_INCIDENTS: 'HOLD_INCIDENTS',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_EVIDENCE_CHAIN: 'HOLD_EVIDENCE_CHAIN',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCommitSha(value) {
  return nonEmptyString(value) && /^[a-f0-9]{40}$/i.test(value.trim());
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
    productionExecutionEvidenceRecorded: false,
    releaseIdentityObserved: false,
    runtimeVerificationRecorded: false,
    observabilityEvidenceRecorded: false,
    rollbackReadinessRecorded: false,
    readyForPostDeploymentHumanReview: false,
    productionDeploymentVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildPostProductionDeploymentEvidence({
  caseId,
  projectId,
  activation,
  execution,
  runtimeVerification,
  observability,
  rollback,
  incidents = [],
  evidenceRefs = [],
} = {}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }
  if (!activation || activation.caseId !== caseId || activation.projectId !== projectId) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_SCOPE, ['controlled production activation scope mismatch'], context);
  }

  const activationValid =
    activation.status === 'READY_FOR_CONTROLLED_PRODUCTION_ACTIVATION' &&
    activation.humanApprovalConfirmed === true &&
    activation.conditionsResolved === true &&
    activation.stagingEvidenceConfirmed === true &&
    activation.releaseIdentityBound === true &&
    activation.productionTargetDeclared === true &&
    activation.changeWindowValidated === true &&
    activation.humanOperatorValidated === true &&
    activation.deploymentExecutionReadyForAuthorizedOperator === true &&
    activation.deploymentExecutionAuthorizedByThisModule === false &&
    activation.deploymentExecuted === false &&
    activation.transactionAuthorized === false;
  if (!activationValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_ACTIVATION, ['controlled production activation gate must be ready and remain non-executing'], context);
  }

  if (!execution || typeof execution !== 'object' || Array.isArray(execution)) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_EXECUTION, ['execution evidence object required'], context);
  }

  const releaseValid =
    nonEmptyString(execution.appVersion) &&
    nonEmptyString(execution.buildId) &&
    isCommitSha(execution.sourceCommit) &&
    execution.appVersion.trim() === activation.sourceRelease.appVersion &&
    execution.buildId.trim() === activation.sourceRelease.buildId &&
    execution.sourceCommit.trim().toLowerCase() === activation.sourceRelease.sourceCommit.toLowerCase() &&
    (!activation.sourceRelease.artifactDigest || execution.artifactDigest === activation.sourceRelease.artifactDigest);
  if (!releaseValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_RELEASE, ['executed production release must exactly match the human-approved source-bound staged release'], context);
  }

  const targetValid =
    nonEmptyString(execution.targetRef) &&
    execution.targetRef.trim() === activation.productionTarget.targetRef &&
    nonEmptyString(execution.targetName) &&
    execution.targetName.trim() === activation.productionTarget.name;
  if (!targetValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_TARGET, ['execution target must exactly match the approved production target'], context);
  }

  const operatorMatches =
    nonEmptyString(execution.performedByRef) &&
    execution.performedByRef.trim() === activation.operator.operatorRef;
  const executionMetadataValid =
    execution.deploymentCompleted === true &&
    nonEmptyString(execution.executionId) &&
    nonEmptyString(execution.executionEvidenceRef) &&
    nonEmptyString(execution.changeWindowId) &&
    execution.changeWindowId.trim() === activation.changeWindow.windowId &&
    operatorMatches;
  if (!executionMetadataValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_EXECUTION, ['deployment completion, execution identity, approved operator, change-window binding, and execution evidence are required'], context);
  }

  const startedAt = explicitTimezoneTimestamp(execution.startedAt);
  const completedAt = explicitTimezoneTimestamp(execution.completedAt);
  const windowStart = explicitTimezoneTimestamp(activation.changeWindow.startsAt);
  const windowEnd = explicitTimezoneTimestamp(activation.changeWindow.endsAt);
  const decisionAt = explicitTimezoneTimestamp(activation.humanDecision.decidedAt);
  const timelineExecutionValid =
    startedAt && completedAt && windowStart && windowEnd && decisionAt &&
    startedAt.epochMs >= windowStart.epochMs &&
    completedAt.epochMs <= windowEnd.epochMs &&
    completedAt.epochMs >= startedAt.epochMs &&
    startedAt.epochMs >= decisionAt.epochMs;
  if (!timelineExecutionValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_TIMELINE, ['production execution must occur after human approval and wholly inside the approved change window'], context);
  }

  const runtimeVerifiedAt = explicitTimezoneTimestamp(runtimeVerification?.verifiedAt);
  const evidenceCapturedAt = explicitTimezoneTimestamp(runtimeVerification?.evidenceCapturedAt);
  const runtimeValid =
    runtimeVerification &&
    runtimeVerification.healthCheckPassed === true &&
    runtimeVerification.smokeTestsPassed === true &&
    runtimeVerification.realBrowserE2ePassed === true &&
    runtimeVerification.fatalConsoleErrors === 0 &&
    runtimeVerification.pageErrors === 0 &&
    nonEmptyString(runtimeVerification.runtimeEvidenceRef) &&
    nonEmptyString(runtimeVerification.observedBuildId) &&
    runtimeVerification.observedBuildId.trim() === activation.sourceRelease.buildId &&
    isCommitSha(runtimeVerification.observedSourceCommit) &&
    runtimeVerification.observedSourceCommit.trim().toLowerCase() === activation.sourceRelease.sourceCommit.toLowerCase() &&
    runtimeVerifiedAt && evidenceCapturedAt &&
    runtimeVerifiedAt.epochMs >= completedAt.epochMs &&
    evidenceCapturedAt.epochMs >= runtimeVerifiedAt.epochMs;
  if (!runtimeValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_RUNTIME, ['post-deployment runtime checks, observed release identity, zero fatal/page errors, and ordered runtime evidence are required'], context);
  }

  const observabilityValid =
    observability &&
    observability.monitoringConfigured === true &&
    observability.alertingConfigured === true &&
    observability.errorTrackingConfigured === true &&
    observability.healthMonitoringConfigured === true &&
    nonEmptyString(observability.evidenceRef);
  if (!observabilityValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_OBSERVABILITY, ['live monitoring, alerting, error tracking, health monitoring, and evidence reference are required'], context);
  }

  const rollbackValid =
    rollback &&
    rollback.rollbackProcedureAvailable === true &&
    rollback.rollbackTargetVerified === true &&
    nonEmptyString(rollback.knownGoodReleaseRef) &&
    nonEmptyString(rollback.evidenceRef);
  if (!rollbackValid) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_ROLLBACK, ['production rollback procedure and verified known-good target evidence are required'], context);
  }

  if (!Array.isArray(incidents)) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_INCIDENTS, ['incidents must be an array'], context);
  }
  const unresolvedBlockingIncidents = incidents.filter((incident) => {
    const severity = String(incident?.severity || '').toUpperCase();
    return ['CRITICAL', 'HIGH'].includes(severity) && incident?.resolved !== true;
  });
  const leakageIncidents = incidents.filter((incident) => String(incident?.type || '').toUpperCase() === 'DATA_LEAKAGE');
  if (unresolvedBlockingIncidents.length || leakageIncidents.length) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_INCIDENTS, [
      ...(unresolvedBlockingIncidents.length ? ['UNRESOLVED_CRITICAL_OR_HIGH_PRODUCTION_INCIDENT'] : []),
      ...(leakageIncidents.length ? ['DATA_LEAKAGE_INCIDENT_RECORDED'] : []),
    ], context);
  }

  const suppliedRefs = cleanRefs(evidenceRefs);
  const requiredRefs = cleanRefs([
    ...(activation.evidenceRefs || []),
    activation.productionTarget.targetRef,
    activation.operator.operatorRef,
    activation.operator.authorizationBasisRef,
    execution.executionEvidenceRef,
    execution.performedByRef,
    runtimeVerification.runtimeEvidenceRef,
    observability.evidenceRef,
    rollback.knownGoodReleaseRef,
    rollback.evidenceRef,
  ]);
  const missingRefs = requiredRefs.filter((ref) => !suppliedRefs.includes(ref));
  if (!suppliedRefs.length || missingRefs.length) {
    return hold(POST_PRODUCTION_DEPLOYMENT_STATUS.HOLD_EVIDENCE_CHAIN, ['post-deployment evidence chain is incomplete'], context);
  }

  return Object.freeze({
    schemaVersion: 1,
    caseId,
    projectId,
    status: POST_PRODUCTION_DEPLOYMENT_STATUS.EVIDENCE_PACK_COMPLETE,
    reasons: Object.freeze([]),
    execution: Object.freeze({
      executionId: execution.executionId.trim(),
      performedByRef: execution.performedByRef.trim(),
      changeWindowId: execution.changeWindowId.trim(),
      startedAt: startedAt.canonical,
      completedAt: completedAt.canonical,
      executionEvidenceRef: execution.executionEvidenceRef.trim(),
    }),
    release: Object.freeze({
      appVersion: execution.appVersion.trim(),
      buildId: execution.buildId.trim(),
      sourceCommit: execution.sourceCommit.trim().toLowerCase(),
      artifactDigest: nonEmptyString(execution.artifactDigest) ? execution.artifactDigest.trim() : null,
      releaseIdentityObservedAtRuntime: true,
    }),
    target: Object.freeze({
      name: execution.targetName.trim(),
      targetRef: execution.targetRef.trim(),
      kind: 'PRODUCTION',
    }),
    runtime: Object.freeze({
      verifiedAt: runtimeVerifiedAt.canonical,
      evidenceCapturedAt: evidenceCapturedAt.canonical,
      runtimeEvidenceRef: runtimeVerification.runtimeEvidenceRef.trim(),
      healthCheckPassed: true,
      smokeTestsPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      pageErrors: 0,
    }),
    incidentSummary: Object.freeze({
      total: incidents.length,
      unresolvedBlocking: unresolvedBlockingIncidents.length,
      dataLeakage: leakageIncidents.length,
    }),
    rollback: Object.freeze({
      knownGoodReleaseRef: rollback.knownGoodReleaseRef.trim(),
      evidenceRef: rollback.evidenceRef.trim(),
      rollbackProcedureAvailable: true,
      rollbackTargetVerified: true,
    }),
    evidenceRefs: Object.freeze(suppliedRefs),
    productionExecutionEvidenceRecorded: true,
    releaseIdentityObserved: true,
    runtimeVerificationRecorded: true,
    observabilityEvidenceRecorded: true,
    rollbackReadinessRecorded: true,
    readyForPostDeploymentHumanReview: true,
    productionDeploymentVerifiedByThisModule: false,
    productionUseAuthorizedByThisModule: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'EVIDENCE_PACK_COMPLETE records internally consistent caller-supplied evidence that the human-approved release was executed against the approved production target and observed by post-deployment checks. This software does not independently attest that the external deployment actually occurred, authorize production use, certify security/legal/valuation status, or authorize an investment transaction. A separate accountable human post-deployment review remains required.',
  });
}

module.exports = {
  POST_PRODUCTION_DEPLOYMENT_STATUS,
  buildPostProductionDeploymentEvidence,
};
