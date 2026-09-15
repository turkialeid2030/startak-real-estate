'use strict';

const assert = require('assert');
const {
  PRODUCTION_READINESS_STATUS,
} = require('../../src/production-readiness/production-readiness-audit');
const {
  INSTITUTIONAL_GO_LIVE_STATUS,
} = require('../../src/production-readiness/institutional-go-live-gate');
const {
  INDEPENDENCE_TYPE,
  REVIEW_DECISION,
  SECURITY_READY,
  PERFORMANCE_READY,
  createCanonicalReleaseEvidence,
  createIndependentReviewRecord,
  buildIndependentReleaseQualification,
} = require('../../src/qualification/independent-release-qualification');
const {
  PRODUCTION_QUALIFICATION_STATUS,
  NEXT_STEP,
  evaluateProductionQualification,
} = require('../../src/runtime/production-qualification-service');

const results = [];

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function readyProductionReadiness(extra = {}) {
  return {
    status: PRODUCTION_READINESS_STATUS.READY_FOR_PRODUCTION_REVIEW,
    readyForHumanProductionReview: true,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    ...extra,
  };
}

function readyInstitutionalGoLive(extra = {}) {
  return {
    caseId: 'case-1',
    projectId: 'project-1',
    status: INSTITUTIONAL_GO_LIVE_STATUS.READY_FOR_HUMAN_GO_LIVE_DECISION,
    readyForHumanGoLiveDecision: true,
    goLiveAuthorized: false,
    productionDeploymentAuthorized: false,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    certifiedValuationEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    ...extra,
  };
}

function independentQualification({ securityStatus = SECURITY_READY, performanceStatus = PERFORMANCE_READY } = {}) {
  const exactCommitSha = 'a'.repeat(40);
  const releaseEvidence = createCanonicalReleaseEvidence({
    releaseEvidenceId: 'release-evidence-1',
    exactCommitSha,
    workflowRunRef: 'workflow-run-1',
    workflowArtifactHashSha256: '1'.repeat(64),
    regressionTotal: 325,
    regressionPassed: 325,
    testDiscoveryAndRegressionPass: true,
    productionBuildPass: true,
    packageVerificationPass: true,
    auditThresholdPass: true,
    canonicalSourceHashVerificationPass: true,
    releaseVerifyPass: true,
    testedAt: '2026-09-09T12:00:00.000Z',
    preparedBy: 'engineer-a',
    reviewedBy: 'reviewer-b',
    reviewedAt: '2026-09-09T12:30:00.000Z',
    evidenceRefs: ['release-ref-1'],
  });
  const independentReview = createIndependentReviewRecord({
    reviewId: 'independent-review-1',
    exactCommitSha,
    reviewerRef: 'reviewer-b',
    reviewerOrganizationRef: 'review-org-1',
    independenceType: INDEPENDENCE_TYPE.EXTERNAL_THIRD_PARTY,
    independenceAttestedByReviewer: true,
    conflictDeclared: false,
    reviewedScope: ['security', 'performance', 'release-evidence'],
    reviewReportRef: 'review-report-1',
    reviewReportHashSha256: '2'.repeat(64),
    decision: REVIEW_DECISION.PASS,
    materialOpenFindings: 0,
    findingRefs: [],
    reviewedAt: '2026-09-09T13:00:00.000Z',
  });
  return buildIndependentReleaseQualification({
    qualificationId: 'qualification-1',
    exactCommitSha,
    securityQualificationRef: 'security-qualification-1',
    securityQualificationHashSha256: '3'.repeat(64),
    securityQualificationStatus: securityStatus,
    performanceQualificationRef: 'performance-qualification-1',
    performanceQualificationHashSha256: '4'.repeat(64),
    performanceQualificationStatus: performanceStatus,
    releaseEvidence,
    independentReview,
  });
}

function completeRefs() {
  return {
    productionReadinessRef: 'production-readiness-evidence-1',
    independentReleaseQualificationRef: 'independent-release-qualification-1',
    institutionalGoLiveRef: 'institutional-go-live-review-1',
  };
}

function readyInput(overrides = {}) {
  return {
    productionReadinessAudit: readyProductionReadiness(),
    independentReleaseQualification: independentQualification(),
    institutionalGoLiveGate: readyInstitutionalGoLive(),
    evidenceRefs: completeRefs(),
    ...overrides,
  };
}

async function expectRejectCode(factory, code) {
  await assert.rejects(
    factory,
    (error) => error && error.code === code,
    `expected rejection code ${code}`,
  );
}

(async () => {
  await test('PRODUCTIZATION-P9-01', async () => {
    const result = evaluateProductionQualification();
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_PRODUCTION_READINESS);
    assert.strictEqual(result.releaseGovernanceReviewEligible, false);
    assert.strictEqual(result.nextStep, NEXT_STEP.COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE);
    assert.strictEqual(result.authority.releaseAuthorized, false);
    assert.strictEqual(result.authority.deploymentAuthorized, false);
    assert.strictEqual(result.authority.transactionAuthorized, false);
  });

  await test('PRODUCTIZATION-P9-02', async () => {
    const result = evaluateProductionQualification(readyInput({
      productionReadinessAudit: {
        ...readyProductionReadiness(),
        status: PRODUCTION_READINESS_STATUS.HOLD_SECURITY,
        readyForHumanProductionReview: false,
      },
    }));
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_PRODUCTION_READINESS);
    assert.strictEqual(result.gates.productionReadiness.ready, false);
  });

  await test('PRODUCTIZATION-P9-03', async () => {
    const qualification = independentQualification();
    const tampered = {
      ...qualification,
      qualificationHashSha256: '0'.repeat(64),
    };
    const result = evaluateProductionQualification(readyInput({ independentReleaseQualification: tampered }));
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY);
    assert.strictEqual(result.gates.independentReleaseQualification.integrityValid, false);
    assert.strictEqual(result.gates.independentReleaseQualification.integrityReasonCode, 'QUALIFICATION_HASH_MISMATCH');
  });

  await test('PRODUCTIZATION-P9-04', async () => {
    const qualification = independentQualification({ securityStatus: 'HOLD_EXTERNAL_SECURITY_VALIDATION' });
    const result = evaluateProductionQualification(readyInput({ independentReleaseQualification: qualification }));
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_INDEPENDENT_RELEASE_QUALIFICATION);
    assert.strictEqual(result.gates.independentReleaseQualification.integrityValid, true);
    assert.strictEqual(result.gates.independentReleaseQualification.ready, false);
  });

  await test('PRODUCTIZATION-P9-05', async () => {
    const result = evaluateProductionQualification(readyInput({
      institutionalGoLiveGate: {
        ...readyInstitutionalGoLive(),
        status: INSTITUTIONAL_GO_LIVE_STATUS.HOLD_REGULATORY_CLOSURE,
        readyForHumanGoLiveDecision: false,
      },
    }));
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_INSTITUTIONAL_GO_LIVE_REVIEW);
    assert.strictEqual(result.gates.institutionalGoLiveReview.ready, false);
  });

  await test('PRODUCTIZATION-P9-06', async () => {
    const result = evaluateProductionQualification(readyInput({ evidenceRefs: {} }));
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.HOLD_EVIDENCE_REFERENCES);
    assert.strictEqual(result.evidenceRefs.productionReadinessRef, null);
    assert.strictEqual(result.releaseGovernanceReviewEligible, false);
  });

  await test('PRODUCTIZATION-P9-07', async () => {
    const result = evaluateProductionQualification(readyInput());
    assert.strictEqual(result.status, PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
    assert.strictEqual(result.releaseGovernanceReviewEligible, true);
    assert.strictEqual(result.nextStep, NEXT_STEP.EXISTING_RELEASE_GOVERNANCE_REVIEW);
    assert.strictEqual(result.gates.productionReadiness.ready, true);
    assert.strictEqual(result.gates.independentReleaseQualification.ready, true);
    assert.strictEqual(result.gates.independentReleaseQualification.integrityValid, true);
    assert.strictEqual(result.gates.institutionalGoLiveReview.ready, true);
    assert.strictEqual(result.evidenceBoundary.productionEvidenceValidatedByThisService, false);
    assert.strictEqual(result.evidenceBoundary.productionAuthenticationValidated, false);
    assert.strictEqual(result.evidenceBoundary.productionPersistenceValidated, false);
    for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
  });

  await test('PRODUCTIZATION-P9-08', async () => {
    const authorityFields = [
      'releaseAuthorized',
      'mergeAuthorized',
      'deploymentAuthorized',
      'goLiveAuthorized',
      'transactionAuthorized',
      'productionAuthenticationValidated',
      'productionPersistenceValidated',
      'productionSecurityValidated',
      'productionPerformanceValidated',
      'legalApprovalEstablished',
      'certifiedValuationEstablished',
    ];
    for (const field of authorityFields) {
      await expectRejectCode(
        () => Promise.resolve().then(() => evaluateProductionQualification({ ...readyInput(), [field]: true })),
        'CALLER_PRODUCTION_QUALIFICATION_AUTHORITY_OVERRIDE_NOT_ALLOWED',
      );
    }
  });

  await test('PRODUCTIZATION-P9-09', async () => {
    const input = readyInput({
      productionReadinessAudit: readyProductionReadiness({ databasePassword: 'must-not-leak' }),
      independentReleaseQualification: { ...independentQualification(), bearerToken: 'must-not-leak' },
      institutionalGoLiveGate: readyInstitutionalGoLive({ jwksPrivateKey: 'must-not-leak' }),
      evidenceRefs: { ...completeRefs(), secret: 'must-not-leak' },
    });
    const result = evaluateProductionQualification(input);
    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes('must-not-leak'), false);
    assert.strictEqual(serialized.includes('databasePassword'), false);
    assert.strictEqual(serialized.includes('bearerToken'), false);
    assert.strictEqual(serialized.includes('jwksPrivateKey'), false);
    assert.deepStrictEqual(Object.keys(result.evidenceRefs).sort(), [
      'independentReleaseQualificationRef',
      'institutionalGoLiveRef',
      'productionReadinessRef',
    ].sort());
    assert.strictEqual(Object.isFrozen(result), true);
    assert.strictEqual(Object.isFrozen(result.gates), true);
    assert.strictEqual(Object.isFrozen(result.authority), true);
    assert.strictEqual(Object.isFrozen(result.evidenceRefs), true);
  });

  const failed = results.filter((row) => row[1] !== 'PASS');
  console.log('');
  console.log('PRODUCTION_QUALIFICATION_TEST_CASES=' + results.length);
  console.log('PRODUCTION_QUALIFICATION_TESTS=' + (failed.length === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
