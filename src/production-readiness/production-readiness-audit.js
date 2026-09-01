'use strict';

const PRODUCTION_READINESS_STATUS = Object.freeze({
  READY_FOR_PRODUCTION_REVIEW: 'READY_FOR_PRODUCTION_REVIEW',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_PILOT_EVIDENCE: 'HOLD_PILOT_EVIDENCE',
  HOLD_SECURITY: 'HOLD_SECURITY',
  HOLD_DATA: 'HOLD_DATA',
  HOLD_AI_GOVERNANCE: 'HOLD_AI_GOVERNANCE',
  HOLD_COMPLIANCE: 'HOLD_COMPLIANCE',
  HOLD_RELIABILITY: 'HOLD_RELIABILITY',
  HOLD_RECOVERY: 'HOLD_RECOVERY',
  HOLD_DEPLOYMENT_EVIDENCE: 'HOLD_DEPLOYMENT_EVIDENCE',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function allTrue(obj, keys) {
  return keys.every((key) => obj && obj[key] === true);
}

function noBlockingFindings(review) {
  const findings = Array.isArray(review?.findings) ? review.findings : [];
  return findings.every((f) => {
    const severity = String(f?.severity || '').toUpperCase();
    const resolved = f?.resolved === true;
    return !['CRITICAL', 'HIGH'].includes(severity) || resolved;
  });
}

function hold(status, reasons, domains) {
  return {
    status,
    reasons,
    domains,
    readyForHumanProductionReview: false,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
  };
}

function buildProductionReadinessAudit({
  caseId,
  projectId,
  pilotEvidencePack,
  securityReview,
  dataReadiness,
  aiGovernance,
  complianceReview,
  reliabilityEvidence,
  recoveryEvidence,
  deploymentEvidence,
  evidenceRefs = [],
}) {
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId)) {
    return hold(PRODUCTION_READINESS_STATUS.HOLD_SCOPE, ['caseId/projectId required'], {});
  }

  const scoped = [pilotEvidencePack, securityReview, dataReadiness, aiGovernance, complianceReview, reliabilityEvidence, recoveryEvidence, deploymentEvidence]
    .filter(Boolean)
    .every((item) => item.caseId === caseId && item.projectId === projectId);
  if (!scoped) return hold(PRODUCTION_READINESS_STATUS.HOLD_SCOPE, ['scope mismatch'], {});

  const domains = {
    pilot: pilotEvidencePack?.status === 'EVIDENCE_PACK_COMPLETE' && pilotEvidencePack?.readyForProductionReadinessAudit === true,
    security: securityReview?.independentReviewCompleted === true && securityReview?.runtimeIdentityEvidenceReferenced === true && securityReview?.runtimeRlsEvidenceReferenced === true && noBlockingFindings(securityReview),
    data: allTrue(dataReadiness, ['caseIsolationVerified', 'tenantIsolationVerified', 'provenanceControlsVerified', 'retentionControlsVerified', 'privacyControlsVerified', 'noDataLeakageObserved']),
    aiGovernance: allTrue(aiGovernance, ['humanFinalAuthority', 'noAutonomousTransaction', 'staleAiInvalidationVerified', 'boundedOutputsVerified', 'modelOrPromptVersionEvidencePresent']),
    compliance: allTrue(complianceReview, ['classificationReviewCompleted', 'regulatedScopeResolved', 'legalCounselOrAuthorizedReviewerCompleted']) && complianceReview?.softwareDoesNotSelfEstablishLegalApproval === true,
    reliability: allTrue(reliabilityEvidence, ['releaseVerifyPassed', 'comprehensiveVerifyPassed', 'deepPlatformVerifyPassed', 'realBrowserE2ePassed']) && reliabilityEvidence?.fatalConsoleErrors === 0 && reliabilityEvidence?.pageErrors === 0 && reliabilityEvidence?.observabilityEvidencePresent === true,
    recovery: allTrue(recoveryEvidence, ['backupEvidencePresent', 'restoreTestCompleted', 'rollbackExercised']) && nonEmptyString(recoveryEvidence?.restoreEvidenceRef),
    deployment: allTrue(deploymentEvidence, ['targetEnvironmentDeclared', 'releaseVersionDeclared', 'monitoringConfigured', 'alertingConfigured', 'deploymentProcedureDocumented', 'rollbackProcedureDocumented']) && nonEmptyString(deploymentEvidence?.releaseRef),
  };

  if (!domains.pilot) return hold(PRODUCTION_READINESS_STATUS.HOLD_PILOT_EVIDENCE, ['pilot execution evidence incomplete'], domains);
  if (!domains.security) return hold(PRODUCTION_READINESS_STATUS.HOLD_SECURITY, ['independent/runtime security evidence incomplete or blocking findings remain'], domains);
  if (!domains.data) return hold(PRODUCTION_READINESS_STATUS.HOLD_DATA, ['data governance/isolation/privacy evidence incomplete'], domains);
  if (!domains.aiGovernance) return hold(PRODUCTION_READINESS_STATUS.HOLD_AI_GOVERNANCE, ['AI governance evidence incomplete'], domains);
  if (!domains.compliance) return hold(PRODUCTION_READINESS_STATUS.HOLD_COMPLIANCE, ['compliance classification/review unresolved'], domains);
  if (!domains.reliability) return hold(PRODUCTION_READINESS_STATUS.HOLD_RELIABILITY, ['verification/observability evidence incomplete'], domains);
  if (!domains.recovery) return hold(PRODUCTION_READINESS_STATUS.HOLD_RECOVERY, ['backup/restore/rollback evidence incomplete'], domains);
  if (!domains.deployment || !Array.isArray(evidenceRefs) || evidenceRefs.filter(nonEmptyString).length === 0) {
    return hold(PRODUCTION_READINESS_STATUS.HOLD_DEPLOYMENT_EVIDENCE, ['deployment/evidence references incomplete'], domains);
  }

  return {
    status: PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW,
    reasons: [],
    domains,
    evidenceRefs: evidenceRefs.filter(nonEmptyString),
    readyForHumanProductionReview: true,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'This state permits human production-readiness review only. It is not production deployment authorization, security certification, legal approval, or transaction authorization.',
  };
}

module.exports = { PRODUCTION_READINESS_STATUS, buildProductionReadinessAudit };
