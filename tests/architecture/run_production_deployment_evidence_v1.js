'use strict';

const assert = require('assert');
const {
  PRODUCTION_DEPLOYMENT_EVIDENCE_STATUS: STATUS,
  buildProductionDeploymentEvidence,
} = require('../../src/production-readiness/production-deployment-evidence');
const {
  PRODUCTION_READINESS_STATUS,
  buildProductionReadinessAudit,
} = require('../../src/production-readiness/production-readiness-audit');

function validInput() {
  return {
    caseId: 'CASE-DEPLOY-001',
    projectId: 'PROJECT-DEPLOY-001',
    environment: {
      targetDeclared: true,
      name: 'production-sa-central-1',
      kind: 'PRODUCTION',
      url: 'https://example.invalid',
    },
    release: {
      version: '2026.09.01.1',
      commitSha: 'f199432ca54722362cd5bf465a72d0f78d746d80',
      releaseRef: 'evidence://release/2026.09.01.1',
      artifactDigest: 'sha256:caller-supplied-example',
    },
    execution: {
      deploymentCompleted: true,
      deploymentProcedureDocumented: true,
      healthCheckPassed: true,
      smokeTestsPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      pageErrors: 0,
      deployedAt: '2026-09-01T12:00:00Z',
      runtimeVerifiedAt: '2026-09-01T12:05:00Z',
      evidenceCapturedAt: '2026-09-01T12:10:00Z',
    },
    observability: {
      monitoringConfigured: true,
      alertingConfigured: true,
      errorTrackingConfigured: true,
      healthMonitoringConfigured: true,
      evidenceRef: 'evidence://observability/2026.09.01.1',
    },
    rollback: {
      rollbackProcedureDocumented: true,
      rollbackExercised: true,
      restoredKnownGoodRelease: true,
      evidenceRef: 'evidence://rollback/2026.09.01.1',
    },
    recovery: {
      backupEvidencePresent: true,
      restoreTestCompleted: true,
      restoreEvidenceRef: 'evidence://restore/2026.09.01.1',
    },
    evidenceRefs: [
      'evidence://release/2026.09.01.1',
      'evidence://observability/2026.09.01.1',
      'evidence://rollback/2026.09.01.1',
      'evidence://restore/2026.09.01.1',
    ],
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete pack is bounded and review-only', () => {
  const result = buildProductionDeploymentEvidence(validInput());
  assert.strictEqual(result.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(result.readyForProductionReadinessAudit, true);
  assert.strictEqual(result.targetEnvironmentDeclared, true);
  assert.strictEqual(result.releaseVersionDeclared, true);
  assert.strictEqual(result.monitoringConfigured, true);
  assert.strictEqual(result.alertingConfigured, true);
  assert.strictEqual(result.deploymentProcedureDocumented, true);
  assert.strictEqual(result.rollbackProcedureDocumented, true);
  assert.strictEqual(result.productionDeploymentAuthorized, false);
  assert.strictEqual(result.productionSecurityCertified, false);
  assert.strictEqual(result.legalApprovalEstablished, false);
  assert.strictEqual(result.humanApprovalRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
});

check('scope fails closed', () => {
  const input = validInput();
  input.caseId = '';
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_SCOPE);
});

check('environment fails closed', () => {
  const input = validInput();
  input.environment.kind = 'PREVIEW';
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_ENVIRONMENT);
});

check('release identity requires full commit SHA', () => {
  const input = validInput();
  input.release.commitSha = 'f199432';
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_RELEASE_IDENTITY);
});

check('deployment execution fails closed', () => {
  const input = validInput();
  input.execution.deploymentCompleted = false;
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_EXECUTION);
});

check('runtime errors fail closed', () => {
  const input = validInput();
  input.execution.pageErrors = 1;
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_RUNTIME_VERIFICATION);
});

check('observability fails closed', () => {
  const input = validInput();
  input.observability.alertingConfigured = false;
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_OBSERVABILITY);
});

check('rollback must be exercised', () => {
  const input = validInput();
  input.rollback.rollbackExercised = false;
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_ROLLBACK);
});

check('restore test evidence is required', () => {
  const input = validInput();
  input.recovery.restoreEvidenceRef = '';
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_RECOVERY);
});

check('timeline must be valid and ordered', () => {
  const input = validInput();
  input.execution.runtimeVerifiedAt = '2026-09-01T11:59:00Z';
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_TIMELINE);
});

check('evidence references are mandatory', () => {
  const input = validInput();
  input.evidenceRefs = [];
  assert.strictEqual(buildProductionDeploymentEvidence(input).status, STATUS.HOLD_EVIDENCE_REFS);
});

check('deployment evidence pack integrates with production readiness audit', () => {
  const deploymentEvidence = buildProductionDeploymentEvidence(validInput());
  const caseId = deploymentEvidence.caseId;
  const projectId = deploymentEvidence.projectId;
  const scoped = (obj) => ({ caseId, projectId, ...obj });

  const audit = buildProductionReadinessAudit({
    caseId,
    projectId,
    pilotEvidencePack: scoped({ status: 'EVIDENCE_PACK_COMPLETE', readyForProductionReadinessAudit: true }),
    securityReview: scoped({
      status: 'EVIDENCE_PACK_COMPLETE',
      readyForProductionReadinessAudit: true,
      independentReviewCompleted: true,
      runtimeIdentityEvidenceReferenced: true,
      runtimeRlsEvidenceReferenced: true,
      findings: [],
    }),
    dataReadiness: scoped({
      caseIsolationVerified: true,
      tenantIsolationVerified: true,
      provenanceControlsVerified: true,
      retentionControlsVerified: true,
      privacyControlsVerified: true,
      noDataLeakageObserved: true,
    }),
    aiGovernance: scoped({
      humanFinalAuthority: true,
      noAutonomousTransaction: true,
      staleAiInvalidationVerified: true,
      boundedOutputsVerified: true,
      modelOrPromptVersionEvidencePresent: true,
    }),
    complianceReview: scoped({
      status: 'EVIDENCE_PACK_COMPLETE',
      readyForProductionReadinessAudit: true,
      classificationReviewCompleted: true,
      regulatedScopeResolved: true,
      legalCounselOrAuthorizedReviewerCompleted: true,
      softwareDoesNotSelfEstablishLegalApproval: true,
      legalApprovalEstablished: false,
    }),
    reliabilityEvidence: scoped({
      releaseVerifyPassed: true,
      comprehensiveVerifyPassed: true,
      deepPlatformVerifyPassed: true,
      realBrowserE2ePassed: true,
      fatalConsoleErrors: 0,
      pageErrors: 0,
      observabilityEvidencePresent: true,
    }),
    recoveryEvidence: scoped({
      backupEvidencePresent: true,
      restoreTestCompleted: true,
      rollbackExercised: true,
      restoreEvidenceRef: deploymentEvidence.recovery.restoreEvidenceRef,
    }),
    deploymentEvidence,
    evidenceRefs: deploymentEvidence.evidenceRefs,
  });

  assert.strictEqual(audit.status, PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW);
  assert.strictEqual(audit.readyForHumanProductionReview, true);
  assert.strictEqual(audit.productionDeploymentAuthorized, false);
});

console.log(`PRODUCTION_DEPLOYMENT_EVIDENCE_V1=PASS checks=${checks}`);
