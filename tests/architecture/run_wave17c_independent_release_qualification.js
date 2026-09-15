'use strict';

const assert = require('assert');
const crypto = require('crypto');
const q = require('../../src/qualification/independent-release-qualification.js');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function expectThrow(fn, pattern) { check(() => assert.throws(fn, pattern)); }

const COMMIT = 'e'.repeat(40);
const OTHER_COMMIT = 'f'.repeat(40);

function releaseEvidence(overrides = {}) {
  return q.createCanonicalReleaseEvidence({
    releaseEvidenceId: overrides.releaseEvidenceId || 'REL-E-1',
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    workflowRunRef: overrides.workflowRunRef || 'GITHUB-ACTIONS-RELEASE-VERIFY-TEST',
    workflowArtifactHashSha256: overrides.workflowArtifactHashSha256 || sha('release-artifact'),
    regressionTotal: overrides.regressionTotal ?? 290,
    regressionPassed: overrides.regressionPassed ?? 290,
    testDiscoveryAndRegressionPass: overrides.testDiscoveryAndRegressionPass ?? true,
    productionBuildPass: overrides.productionBuildPass ?? true,
    packageVerificationPass: overrides.packageVerificationPass ?? true,
    auditThresholdPass: overrides.auditThresholdPass ?? true,
    canonicalSourceHashVerificationPass: overrides.canonicalSourceHashVerificationPass ?? true,
    releaseVerifyPass: overrides.releaseVerifyPass ?? true,
    testedAt: overrides.testedAt || '2026-09-08T06:00:00Z',
    preparedBy: overrides.preparedBy || 'RELEASE-ENGINEER',
    reviewedBy: overrides.reviewedBy || 'RELEASE-REVIEWER',
    reviewedAt: overrides.reviewedAt || '2026-09-08T07:00:00Z',
    evidenceRefs: overrides.evidenceRefs || ['REL-TRACE-1'],
  });
}

function independentReview(overrides = {}) {
  return q.createIndependentReviewRecord({
    reviewId: overrides.reviewId || 'IND-REV-1',
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    reviewerRef: overrides.reviewerRef || 'REVIEWER-REF-1',
    reviewerOrganizationRef: overrides.reviewerOrganizationRef || 'INDEPENDENT-REVIEW-ORG',
    independenceType: overrides.independenceType || q.INDEPENDENCE_TYPE.INTERNAL_INDEPENDENT,
    independenceAttestedByReviewer: overrides.independenceAttestedByReviewer ?? true,
    conflictDeclared: overrides.conflictDeclared ?? false,
    reviewedScope: overrides.reviewedScope || ['SECURITY', 'PERFORMANCE_RESILIENCE', 'RELEASE_REGRESSION'],
    reviewReportRef: overrides.reviewReportRef || 'INDEPENDENT-REVIEW-REPORT-1',
    reviewReportHashSha256: overrides.reviewReportHashSha256 || sha('independent-review-report'),
    decision: overrides.decision || q.REVIEW_DECISION.PASS,
    materialOpenFindings: overrides.materialOpenFindings ?? 0,
    findingRefs: overrides.findingRefs || [],
    reviewedAt: overrides.reviewedAt || '2026-09-08T08:00:00Z',
  });
}

function qualification(rel, rev, overrides = {}) {
  return q.buildIndependentReleaseQualification({
    qualificationId: overrides.qualificationId || 'W17C-Q-1',
    exactCommitSha: overrides.exactCommitSha || COMMIT,
    securityQualificationRef: overrides.securityQualificationRef || 'W17A-SECURITY-QUALIFICATION',
    securityQualificationHashSha256: overrides.securityQualificationHashSha256 || sha('security-qualification'),
    securityQualificationStatus: overrides.securityQualificationStatus || q.SECURITY_READY,
    performanceQualificationRef: overrides.performanceQualificationRef || 'W17B-PERFORMANCE-QUALIFICATION',
    performanceQualificationHashSha256: overrides.performanceQualificationHashSha256 || sha('performance-qualification'),
    performanceQualificationStatus: overrides.performanceQualificationStatus || q.PERFORMANCE_READY,
    releaseEvidence: rel,
    independentReview: rev,
  });
}

[
  'createCanonicalReleaseEvidence', 'verifyCanonicalReleaseEvidence',
  'createIndependentReviewRecord', 'verifyIndependentReviewRecord',
  'buildIndependentReleaseQualification', 'verifyIndependentReleaseQualification',
].forEach((name) => check(() => assert.strictEqual(typeof q[name], 'function', `${name} missing`)));
check(() => assert.deepStrictEqual(Object.values(q.INDEPENDENCE_TYPE), ['INTERNAL_INDEPENDENT', 'EXTERNAL_THIRD_PARTY']));
check(() => assert.deepStrictEqual(Object.values(q.REVIEW_DECISION), ['PASS', 'HOLD']));
check(() => assert.strictEqual(q.SECURITY_READY, 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION'));
check(() => assert.strictEqual(q.PERFORMANCE_READY, 'READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION'));

const rel = releaseEvidence();
const rev = independentReview();
check(() => assert.strictEqual(q.verifyCanonicalReleaseEvidence(rel).valid, true));
check(() => assert.strictEqual(q.verifyIndependentReviewRecord(rev).valid, true));
check(() => assert.strictEqual(rel.releaseAuthorized, false));
check(() => assert.strictEqual(rel.deploymentAuthorized, false));
check(() => assert.strictEqual(rev.reviewerCredentialsVerifiedByThisModule, false));
check(() => assert.strictEqual(rev.reviewerIndependenceVerifiedByThisModule, false));
check(() => assert.strictEqual(rev.releaseAuthorized, false));

const ready = qualification(rel, rev);
check(() => assert.strictEqual(ready.status, q.RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW));
check(() => assert.strictEqual(q.verifyIndependentReleaseQualification(ready).valid, true));
check(() => assert.strictEqual(ready.independentEngineeringReviewRecorded, true));
check(() => assert.strictEqual(ready.reviewerCredentialsVerifiedByThisModule, false));
check(() => assert.strictEqual(ready.reviewerIndependenceVerifiedByThisModule, false));
check(() => assert.strictEqual(ready.productionSecurityValidated, false));
check(() => assert.strictEqual(ready.productionPerformanceValidated, false));
check(() => assert.strictEqual(ready.pdplComplianceEstablished, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorityEstablished, false));
check(() => assert.strictEqual(ready.releaseAuthorized, false));
check(() => assert.strictEqual(ready.mergeAuthorized, false));
check(() => assert.strictEqual(ready.deploymentAuthorized, false));
check(() => assert.strictEqual(ready.humanReleaseAuthorityApprovalRequired, true));
check(() => assert.strictEqual(ready.transactionAuthorized, false));

// Upstream qualification statuses are mandatory and are never inferred.
const securityHold = qualification(rel, rev, { securityQualificationStatus: 'HOLD_REQUIRED_CONTROLS' });
check(() => assert.strictEqual(securityHold.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_SECURITY_QUALIFICATION));
check(() => assert.strictEqual(securityHold.independentEngineeringReviewRecorded, false));
const perfHold = qualification(rel, rev, { performanceQualificationStatus: 'HOLD_PERFORMANCE_SLO' });
check(() => assert.strictEqual(perfHold.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_PERFORMANCE_QUALIFICATION));

// Canonical release verification must be an all-pass, exact-regression record.
const partialRegression = releaseEvidence({ regressionPassed: 289 });
const partialQ = qualification(partialRegression, rev);
check(() => assert.strictEqual(partialQ.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));
const buildFail = qualification(releaseEvidence({ productionBuildPass: false }), rev);
check(() => assert.strictEqual(buildFail.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));
const packageFail = qualification(releaseEvidence({ packageVerificationPass: false }), rev);
check(() => assert.strictEqual(packageFail.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));
const auditFail = qualification(releaseEvidence({ auditThresholdPass: false }), rev);
check(() => assert.strictEqual(auditFail.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));
const releaseFail = qualification(releaseEvidence({ releaseVerifyPass: false }), rev);
check(() => assert.strictEqual(releaseFail.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));
const sameReviewer = qualification(releaseEvidence({ preparedBy: 'SAME', reviewedBy: 'SAME' }), rev);
check(() => assert.strictEqual(sameReviewer.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION));

// Independent review governance is fail-closed, but credentials/independence are not externally verified here.
const reviewHold = qualification(rel, independentReview({ decision: q.REVIEW_DECISION.HOLD }));
check(() => assert.strictEqual(reviewHold.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW));
const materialFinding = qualification(rel, independentReview({ materialOpenFindings: 1, findingRefs: ['FINDING-1'] }));
check(() => assert.strictEqual(materialFinding.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW));
const conflict = qualification(rel, independentReview({ conflictDeclared: true }));
check(() => assert.strictEqual(conflict.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW));
const noAttestation = qualification(rel, independentReview({ independenceAttestedByReviewer: false }));
check(() => assert.strictEqual(noAttestation.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW));

// Exact commit binding cannot be crossed.
const wrongReleaseCommit = qualification(releaseEvidence({ exactCommitSha: OTHER_COMMIT }), rev);
check(() => assert.strictEqual(wrongReleaseCommit.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));
const wrongReviewCommit = qualification(rel, independentReview({ exactCommitSha: OTHER_COMMIT }));
check(() => assert.strictEqual(wrongReviewCommit.status, q.RELEASE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH));

// External-third-party review is accepted only as caller-supplied evidence; authority remains unchanged.
const externalReview = independentReview({ independenceType: q.INDEPENDENCE_TYPE.EXTERNAL_THIRD_PARTY, reviewerOrganizationRef: 'THIRD-PARTY-ORG' });
const externalQ = qualification(rel, externalReview, { qualificationId: 'W17C-Q-EXTERNAL' });
check(() => assert.strictEqual(externalQ.status, q.RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW));
check(() => assert.strictEqual(externalQ.reviewerCredentialsVerifiedByThisModule, false));
check(() => assert.strictEqual(externalQ.releaseAuthorized, false));
check(() => assert.strictEqual(externalQ.deploymentAuthorized, false));

// Content addressing detects mutation.
const tamperedRel = { ...rel, regressionPassed: 1 };
check(() => assert.strictEqual(q.verifyCanonicalReleaseEvidence(tamperedRel).valid, false));
const tamperedReview = { ...rev, decision: q.REVIEW_DECISION.HOLD };
check(() => assert.strictEqual(q.verifyIndependentReviewRecord(tamperedReview).valid, false));
const tamperedQ = { ...ready, status: q.RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW };
check(() => assert.strictEqual(q.verifyIndependentReleaseQualification(tamperedQ).valid, false));

// Schema and temporal invariants.
expectThrow(() => releaseEvidence({ exactCommitSha: 'bad' }), /git commit SHA/);
expectThrow(() => releaseEvidence({ workflowArtifactHashSha256: 'bad' }), /SHA-256/);
expectThrow(() => releaseEvidence({ regressionTotal: 10, regressionPassed: 11 }), /cannot exceed/);
expectThrow(() => releaseEvidence({ testedAt: '2026-09-08T08:00:00Z', reviewedAt: '2026-09-08T07:00:00Z' }), /reviewedAt must be on or after testedAt/);
expectThrow(() => independentReview({ independenceType: 'UNKNOWN' }), /unsupported/);
expectThrow(() => independentReview({ decision: 'UNKNOWN' }), /unsupported/);
expectThrow(() => independentReview({ materialOpenFindings: -1 }), /non-negative integer/);
expectThrow(() => qualification(rel, rev, { exactCommitSha: 'bad' }), /git commit SHA/);

console.log(`WAVE_17C_INDEPENDENT_RELEASE_QUALIFICATION=PASS checks=${checks}`);
