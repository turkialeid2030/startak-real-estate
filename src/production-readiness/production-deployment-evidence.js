'use strict';

const PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_ENVIRONMENT: 'HOLD_ENVIRONMENT',
  HOLD_RELEASE_IDENTITY: 'HOLD_RELEASE_IDENTITY',
  HOLD_EXECUTION: 'HOLD_EXECUTION',
  HOLD_RUNTIME_VERIFICATION: 'HOLD_RUNTIME_VERIFICATION',
  HOLD_OBSERVABILITY: 'HOLD_OBSERVABILITY',
  HOLD_ROLLBACK: 'HOLD_ROLLBACK',
  HOLD_RECOVERY: 'HOLD_RECOVERY',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_EVIDENCE_REFS: 'HOLD_EVIDENCE_REFS',
});

const ALLOWED_ENVIRONMENT_KINDS = new Set(['STAGING', 'PRODUCTION']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCommitSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

function isIsoTimestamp(value) {
  if (!nonEmptyString(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && /T/.test(value);
}

function allTrue(obj, keys) {
  return keys.every((key) => obj && obj[key] === true);
}

function cleanRefs(refs) {
  return Array.isArray(refs) ? refs.filter(nonEmptyString).map((ref) => ref.trim()) : [];
}

function hold(status, reasons, context = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    readyForProductionReadinessAudit: false,
    targetEnvironmentDeclared: false,
    releaseVersionDeclared: false,
    monitoringConfigured: false,
    alertingConfigured: false,
    deploymentProcedureDocumented: false,
    rollbackProcedureDocumented: false,
    releaseRef: null,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
  };
}

function buildProductionDeploymentEvidence({
  caseId,
  projectId,
  environment,
  release,
  execution,
  observability,
  rollback,
  recovery,
  evidenceRefs = [],
}) {
  const context = { caseId, projectId };

  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_SCOPE, ['caseId/projectId required'], context);
  }

  const environmentKind = String(environment?.kind || '').toUpperCase();
  const environmentValid =
    environment?.targetDeclared === true &&
    nonEmptyString(environment?.name) &&
    ALLOWED_ENVIRONMENT_KINDS.has(environmentKind);
  if (!environmentValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_ENVIRONMENT, ['deployment environment must be explicitly declared as STAGING or PRODUCTION'], context);
  }

  const releaseValid =
    nonEmptyString(release?.version) &&
    isCommitSha(release?.commitSha) &&
    nonEmptyString(release?.releaseRef);
  if (!releaseValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_RELEASE_IDENTITY, ['release version, full commit SHA, and releaseRef are required'], context);
  }

  const executionValid = allTrue(execution, ['deploymentCompleted', 'deploymentProcedureDocumented']);
  if (!executionValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_EXECUTION, ['deployment execution/procedure evidence incomplete'], context);
  }

  const runtimeValid =
    allTrue(execution, ['healthCheckPassed', 'smokeTestsPassed', 'realBrowserE2ePassed']) &&
    execution?.fatalConsoleErrors === 0 &&
    execution?.pageErrors === 0;
  if (!runtimeValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_RUNTIME_VERIFICATION, ['runtime health/smoke/browser verification incomplete or runtime errors observed'], context);
  }

  const observabilityValid =
    allTrue(observability, ['monitoringConfigured', 'alertingConfigured', 'errorTrackingConfigured', 'healthMonitoringConfigured']) &&
    nonEmptyString(observability?.evidenceRef);
  if (!observabilityValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_OBSERVABILITY, ['monitoring/alerting/error-tracking evidence incomplete'], context);
  }

  const rollbackValid =
    allTrue(rollback, ['rollbackProcedureDocumented', 'rollbackExercised', 'restoredKnownGoodRelease']) &&
    nonEmptyString(rollback?.evidenceRef);
  if (!rollbackValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_ROLLBACK, ['rollback must be documented, exercised, and restore a known-good release'], context);
  }

  const recoveryValid =
    allTrue(recovery, ['backupEvidencePresent', 'restoreTestCompleted']) &&
    nonEmptyString(recovery?.restoreEvidenceRef);
  if (!recoveryValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_RECOVERY, ['backup/restore execution evidence incomplete'], context);
  }

  const deployedAt = execution?.deployedAt;
  const runtimeVerifiedAt = execution?.runtimeVerifiedAt;
  const evidenceCapturedAt = execution?.evidenceCapturedAt;
  const timelineValid =
    isIsoTimestamp(deployedAt) &&
    isIsoTimestamp(runtimeVerifiedAt) &&
    isIsoTimestamp(evidenceCapturedAt) &&
    Date.parse(deployedAt) <= Date.parse(runtimeVerifiedAt) &&
    Date.parse(runtimeVerifiedAt) <= Date.parse(evidenceCapturedAt);
  if (!timelineValid) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_TIMELINE, ['deployment, runtime verification, and evidence capture timestamps must be valid and ordered'], context);
  }

  const refs = cleanRefs(evidenceRefs);
  const requiredRefs = [release.releaseRef, observability.evidenceRef, rollback.evidenceRef, recovery.restoreEvidenceRef];
  if (refs.length === 0 || requiredRefs.some((ref) => !nonEmptyString(ref))) {
    return hold(PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.HOLD_EVIDENCE_REFS, ['external evidence references are required'], context);
  }

  return {
    caseId,
    projectId,
    status: PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS.EVIDENCE_PACK_COMPLETE,
    reasons: [],
    environment: {
      name: environment.name.trim(),
      kind: environmentKind,
      url: nonEmptyString(environment.url) ? environment.url.trim() : null,
    },
    release: {
      version: release.version.trim(),
      commitSha: release.commitSha.trim(),
      releaseRef: release.releaseRef.trim(),
      artifactDigest: nonEmptyString(release.artifactDigest) ? release.artifactDigest.trim() : null,
    },
    timeline: { deployedAt, runtimeVerifiedAt, evidenceCapturedAt },
    runtime: {
      healthCheckPassed: true,
      smokeTestsPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      pageErrors: 0,
    },
    recovery: {
      backupEvidencePresent: true,
      restoreTestCompleted: true,
      rollbackExercised: true,
      restoreEvidenceRef: recovery.restoreEvidenceRef.trim(),
    },
    evidenceRefs: refs,
    readyForProductionReadinessAudit: true,
    targetEnvironmentDeclared: true,
    releaseVersionDeclared: true,
    monitoringConfigured: true,
    alertingConfigured: true,
    deploymentProcedureDocumented: true,
    rollbackProcedureDocumented: true,
    releaseRef: release.releaseRef.trim(),
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'This pack records caller-supplied deployment execution evidence for human production-readiness review. It does not deploy software, certify security, establish legal approval, or authorize production use or transactions.',
  };
}

module.exports = {
  PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS,
  buildProductionDeploymentEvidence,
};
