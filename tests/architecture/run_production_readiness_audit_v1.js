'use strict';

const assert = require('assert');
const { PRODUCTION_READINESS_STATUS, buildProductionReadinessAudit } = require('../../src/production-readiness/production-readiness-audit');

const scope = { caseId: 'CASE-PR-1', projectId: 'PROJECT-PR-1' };
function base() {
  return {
    ...scope,
    pilotEvidencePack: { ...scope, status: 'EVIDENCE_PACK_COMPLETE', readyForProductionReadinessAudit: true },
    securityReview: { ...scope, independentReviewCompleted: true, runtimeIdentityEvidenceReferenced: true, runtimeRlsEvidenceReferenced: true, findings: [] },
    dataReadiness: { ...scope, caseIsolationVerified: true, tenantIsolationVerified: true, provenanceControlsVerified: true, retentionControlsVerified: true, privacyControlsVerified: true, noDataLeakageObserved: true },
    aiGovernance: { ...scope, humanFinalAuthority: true, noAutonomousTransaction: true, staleAiInvalidationVerified: true, boundedOutputsVerified: true, modelOrPromptVersionEvidencePresent: true },
    complianceReview: { ...scope, classificationReviewCompleted: true, regulatedScopeResolved: true, legalCounselOrAuthorizedReviewerCompleted: true, softwareDoesNotSelfEstablishLegalApproval: true },
    reliabilityEvidence: { ...scope, releaseVerifyPassed: true, comprehensiveVerifyPassed: true, deepPlatformVerifyPassed: true, realBrowserE2ePassed: true, fatalConsoleErrors: 0, pageErrors: 0, observabilityEvidencePresent: true },
    recoveryEvidence: { ...scope, backupEvidencePresent: true, restoreTestCompleted: true, rollbackExercised: true, restoreEvidenceRef: 'restore-test-1' },
    deploymentEvidence: {
      ...scope,
      status: 'EVIDENCE_PACK_COMPLETE',
      readyForProductionReadinessAudit: true,
      targetEnvironmentDeclared: true,
      releaseVersionDeclared: true,
      monitoringConfigured: true,
      alertingConfigured: true,
      deploymentProcedureDocumented: true,
      rollbackProcedureDocumented: true,
      releaseRef: 'release-candidate-1',
    },
    evidenceRefs: ['evidence-pack-1'],
  };
}

const ready = buildProductionReadinessAudit(base());
assert.strictEqual(ready.status, PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW);
assert.strictEqual(ready.readyForHumanProductionReview, true);
assert.strictEqual(ready.productionDeploymentAuthorized, false);
assert.strictEqual(ready.productionSecurityCertified, false);
assert.strictEqual(ready.legalApprovalEstablished, false);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.humanApprovalRequired, true);

const cases = [
  ['pilotEvidencePack', 'readyForProductionReadinessAudit', false, PRODUCTION_READINESS_STATUS.HOLD_PILOT_EVIDENCE],
  ['securityReview', 'runtimeRlsEvidenceReferenced', false, PRODUCTION_READINESS_STATUS.HOLD_SECURITY],
  ['dataReadiness', 'noDataLeakageObserved', false, PRODUCTION_READINESS_STATUS.HOLD_DATA],
  ['aiGovernance', 'humanFinalAuthority', false, PRODUCTION_READINESS_STATUS.HOLD_AI_GOVERNANCE],
  ['complianceReview', 'regulatedScopeResolved', false, PRODUCTION_READINESS_STATUS.HOLD_COMPLIANCE],
  ['reliabilityEvidence', 'deepPlatformVerifyPassed', false, PRODUCTION_READINESS_STATUS.HOLD_RELIABILITY],
  ['recoveryEvidence', 'restoreTestCompleted', false, PRODUCTION_READINESS_STATUS.HOLD_RECOVERY],
  ['deploymentEvidence', 'monitoringConfigured', false, PRODUCTION_READINESS_STATUS.HOLD_DEPLOYMENT_EVIDENCE],
  ['deploymentEvidence', 'readyForProductionReadinessAudit', false, PRODUCTION_READINESS_STATUS.HOLD_DEPLOYMENT_EVIDENCE],
];

for (const [domain, key, value, expected] of cases) {
  const input = base();
  input[domain] = { ...input[domain], [key]: value };
  const result = buildProductionReadinessAudit(input);
  assert.strictEqual(result.status, expected, `${domain}.${key}`);
  assert.strictEqual(result.readyForHumanProductionReview, false);
  assert.strictEqual(result.productionDeploymentAuthorized, false);
  assert.strictEqual(result.transactionAuthorized, false);
}

const blocking = base();
blocking.securityReview = { ...blocking.securityReview, findings: [{ severity: 'HIGH', resolved: false }] };
assert.strictEqual(buildProductionReadinessAudit(blocking).status, PRODUCTION_READINESS_STATUS.HOLD_SECURITY);

const scopeMismatch = base();
scopeMismatch.securityReview = { ...scopeMismatch.securityReview, caseId: 'OTHER' };
assert.strictEqual(buildProductionReadinessAudit(scopeMismatch).status, PRODUCTION_READINESS_STATUS.HOLD_SCOPE);

const noRefs = base();
noRefs.evidenceRefs = ['   '];
assert.strictEqual(buildProductionReadinessAudit(noRefs).status, PRODUCTION_READINESS_STATUS.HOLD_DEPLOYMENT_EVIDENCE);

console.log('PRODUCTION_READINESS_AUDIT_V1=PASS checks=14');
