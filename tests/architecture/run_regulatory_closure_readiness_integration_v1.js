'use strict';

const assert = require('assert');
const {
  REGULATORY_CLASSIFICATION,
  AUTHORIZED_REVIEWER_TYPE,
  buildRegulatoryClosureEvidence,
} = require('../../src/compliance/regulatory-closure-evidence');
const {
  PRODUCTION_READINESS_STATUS,
  buildProductionReadinessAudit,
} = require('../../src/production-readiness/production-readiness-audit');

const caseId = 'CASE-COMP-INT-001';
const projectId = 'PROJECT-COMP-INT-001';
const scoped = (obj) => ({ caseId, projectId, ...obj });
const reviewerRef = 'reviewer://authorized/legal/1';
const reviewRef = 'evidence://regulatory/review/1';
const sourceRef = 'evidence://regulatory/source/1';

const complianceReview = buildRegulatoryClosureEvidence({
  caseId,
  projectId,
  jurisdiction: 'SA',
  asOfDate: '2026-09-01T00:00:00Z',
  classificationReview: {
    completed: true,
    reviewerType: AUTHORIZED_REVIEWER_TYPE.AUTHORIZED_REGULATORY_REVIEWER,
    reviewerRef,
    reviewRef,
    reviewedAt: '2026-08-31T00:00:00Z',
    classification: REGULATORY_CLASSIFICATION.DECISION_SUPPORT_ONLY,
    regulatedScopeResolved: true,
    licensingRequirementResolved: true,
    requiredAuthorizationSatisfied: false,
    authorizationEvidenceRef: null,
    permittedOperatingScopeDefined: true,
    prohibitedClaimsDefined: true,
    privacyRegulatoryReviewCompleted: true,
    termsAndDisclosureReviewCompleted: true,
    humanProfessionalBoundaryDefined: true,
    softwareDoesNotSelfEstablishLegalApproval: true,
    permittedUses: ['internal analytical decision support'],
    prohibitedUses: ['certified valuation', 'legal opinion', 'automatic transaction authorization'],
  },
  sources: [{
    authority: 'AUTHORIZED_SOURCE_OWNER',
    sourceRef,
    versionHash: 'sha256:caller-supplied-regulatory-source-version',
    effectiveDate: '2026-01-01T00:00:00Z',
    lastVerifiedDate: '2026-08-31T00:00:00Z',
    reviewAfterDate: '2026-12-31T00:00:00Z',
  }],
  evidenceRefs: [reviewerRef, reviewRef, sourceRef],
});

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
  complianceReview,
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
    restoreEvidenceRef: 'evidence://restore/1',
  }),
  deploymentEvidence: scoped({
    status: 'EVIDENCE_PACK_COMPLETE',
    readyForProductionReadinessAudit: true,
    targetEnvironmentDeclared: true,
    releaseVersionDeclared: true,
    monitoringConfigured: true,
    alertingConfigured: true,
    deploymentProcedureDocumented: true,
    rollbackProcedureDocumented: true,
    releaseRef: 'evidence://release/1',
  }),
  evidenceRefs: [...complianceReview.evidenceRefs, 'evidence://release/1'],
});

assert.strictEqual(complianceReview.readyForProductionReadinessAudit, true);
assert.strictEqual(complianceReview.legalApprovalEstablished, false);
assert.strictEqual(audit.status, PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW);
assert.strictEqual(audit.readyForHumanProductionReview, true);
assert.strictEqual(audit.legalApprovalEstablished, false);
assert.strictEqual(audit.productionDeploymentAuthorized, false);
assert.strictEqual(audit.transactionAuthorized, false);

console.log('REGULATORY_CLOSURE_READINESS_INTEGRATION_V1=PASS checks=7');
