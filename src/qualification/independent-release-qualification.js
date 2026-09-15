'use strict';

const crypto = require('crypto');

const INDEPENDENCE_TYPE = Object.freeze({
  INTERNAL_INDEPENDENT: 'INTERNAL_INDEPENDENT',
  EXTERNAL_THIRD_PARTY: 'EXTERNAL_THIRD_PARTY',
});

const REVIEW_DECISION = Object.freeze({ PASS: 'PASS', HOLD: 'HOLD' });

const RELEASE_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_RELEASE_AUTHORITY_REVIEW: 'READY_FOR_RELEASE_AUTHORITY_REVIEW',
  HOLD_SECURITY_QUALIFICATION: 'HOLD_SECURITY_QUALIFICATION',
  HOLD_PERFORMANCE_QUALIFICATION: 'HOLD_PERFORMANCE_QUALIFICATION',
  HOLD_RELEASE_VERIFICATION: 'HOLD_RELEASE_VERIFICATION',
  HOLD_INDEPENDENT_REVIEW: 'HOLD_INDEPENDENT_REVIEW',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
});

const SECURITY_READY = 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION';
const PERFORMANCE_READY = 'READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function requiredSha256(value, field) {
  const value2 = requiredString(value, field);
  if (!SHA256_RE.test(value2)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value2.toLowerCase();
}
function requiredCommitSha(value, field) {
  const value2 = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(value2)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return value2.toLowerCase();
}
function requiredTimestamp(value, field) {
  const value2 = requiredString(value, field);
  const millis = Date.parse(value2);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return { value: value2, millis };
}
function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return value;
}
function bool(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
  return value;
}
function stringArray(value, field, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new TypeError(`${field} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  return value.map((item, i) => requiredString(item, `${field}[${i}]`));
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((o, key) => { if (value[key] !== undefined) o[key] = canonicalize(value[key]); return o; }, {});
  return value;
}
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }

function createCanonicalReleaseEvidence(input = {}) {
  const tested = requiredTimestamp(input.testedAt, 'testedAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < tested.millis) throw new TypeError('reviewedAt must be on or after testedAt');
  const total = nonNegativeInteger(input.regressionTotal, 'regressionTotal');
  const passed = nonNegativeInteger(input.regressionPassed, 'regressionPassed');
  if (passed > total) throw new TypeError('regressionPassed cannot exceed regressionTotal');
  const core = {
    releaseEvidenceId: requiredString(input.releaseEvidenceId, 'releaseEvidenceId'),
    exactCommitSha: requiredCommitSha(input.exactCommitSha, 'exactCommitSha'),
    workflowRunRef: requiredString(input.workflowRunRef, 'workflowRunRef'),
    workflowArtifactHashSha256: requiredSha256(input.workflowArtifactHashSha256, 'workflowArtifactHashSha256'),
    regressionTotal: total,
    regressionPassed: passed,
    testDiscoveryAndRegressionPass: bool(input.testDiscoveryAndRegressionPass, 'testDiscoveryAndRegressionPass'),
    productionBuildPass: bool(input.productionBuildPass, 'productionBuildPass'),
    packageVerificationPass: bool(input.packageVerificationPass, 'packageVerificationPass'),
    auditThresholdPass: bool(input.auditThresholdPass, 'auditThresholdPass'),
    canonicalSourceHashVerificationPass: bool(input.canonicalSourceHashVerificationPass, 'canonicalSourceHashVerificationPass'),
    releaseVerifyPass: bool(input.releaseVerifyPass, 'releaseVerifyPass'),
    testedAt: tested.value,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    reviewedAt: reviewed.value,
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
  };
  return Object.freeze({ ...core, releaseEvidenceHashSha256: hash(core), releaseAuthorized: false, deploymentAuthorized: false });
}

function verifyCanonicalReleaseEvidence(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, reasonCode: 'RELEASE_EVIDENCE_OBJECT_REQUIRED' };
  try {
    const core = {
      releaseEvidenceId: requiredString(record.releaseEvidenceId, 'releaseEvidenceId'),
      exactCommitSha: requiredCommitSha(record.exactCommitSha, 'exactCommitSha'),
      workflowRunRef: requiredString(record.workflowRunRef, 'workflowRunRef'),
      workflowArtifactHashSha256: requiredSha256(record.workflowArtifactHashSha256, 'workflowArtifactHashSha256'),
      regressionTotal: nonNegativeInteger(record.regressionTotal, 'regressionTotal'),
      regressionPassed: nonNegativeInteger(record.regressionPassed, 'regressionPassed'),
      testDiscoveryAndRegressionPass: bool(record.testDiscoveryAndRegressionPass, 'testDiscoveryAndRegressionPass'),
      productionBuildPass: bool(record.productionBuildPass, 'productionBuildPass'),
      packageVerificationPass: bool(record.packageVerificationPass, 'packageVerificationPass'),
      auditThresholdPass: bool(record.auditThresholdPass, 'auditThresholdPass'),
      canonicalSourceHashVerificationPass: bool(record.canonicalSourceHashVerificationPass, 'canonicalSourceHashVerificationPass'),
      releaseVerifyPass: bool(record.releaseVerifyPass, 'releaseVerifyPass'),
      testedAt: requiredTimestamp(record.testedAt, 'testedAt').value,
      preparedBy: requiredString(record.preparedBy, 'preparedBy'),
      reviewedBy: requiredString(record.reviewedBy, 'reviewedBy'),
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
      evidenceRefs: stringArray(record.evidenceRefs, 'evidenceRefs'),
    };
    if (core.regressionPassed > core.regressionTotal) return { valid: false, reasonCode: 'REGRESSION_COUNTS_INVALID' };
    if (Date.parse(core.reviewedAt) < Date.parse(core.testedAt)) return { valid: false, reasonCode: 'RELEASE_REVIEW_TIME_INVALID' };
    const expectedHash = hash(core);
    return { valid: record.releaseEvidenceHashSha256 === expectedHash, reasonCode: record.releaseEvidenceHashSha256 === expectedHash ? null : 'RELEASE_EVIDENCE_HASH_MISMATCH', expectedHash };
  } catch (error) { return { valid: false, reasonCode: 'RELEASE_EVIDENCE_SCHEMA_INVALID', error: error.message }; }
}

function createIndependentReviewRecord(input = {}) {
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  const independenceType = requiredString(input.independenceType, 'independenceType');
  if (!Object.values(INDEPENDENCE_TYPE).includes(independenceType)) throw new TypeError('independenceType unsupported');
  const decision = requiredString(input.decision, 'decision');
  if (!Object.values(REVIEW_DECISION).includes(decision)) throw new TypeError('decision unsupported');
  const core = {
    reviewId: requiredString(input.reviewId, 'reviewId'),
    exactCommitSha: requiredCommitSha(input.exactCommitSha, 'exactCommitSha'),
    reviewerRef: requiredString(input.reviewerRef, 'reviewerRef'),
    reviewerOrganizationRef: requiredString(input.reviewerOrganizationRef, 'reviewerOrganizationRef'),
    independenceType,
    independenceAttestedByReviewer: bool(input.independenceAttestedByReviewer, 'independenceAttestedByReviewer'),
    conflictDeclared: bool(input.conflictDeclared, 'conflictDeclared'),
    reviewedScope: stringArray(input.reviewedScope, 'reviewedScope'),
    reviewReportRef: requiredString(input.reviewReportRef, 'reviewReportRef'),
    reviewReportHashSha256: requiredSha256(input.reviewReportHashSha256, 'reviewReportHashSha256'),
    decision,
    materialOpenFindings: nonNegativeInteger(input.materialOpenFindings, 'materialOpenFindings'),
    findingRefs: stringArray(input.findingRefs || [], 'findingRefs', true),
    reviewedAt: reviewed.value,
  };
  return Object.freeze({ ...core, independentReviewHashSha256: hash(core), reviewerCredentialsVerifiedByThisModule: false, reviewerIndependenceVerifiedByThisModule: false, releaseAuthorized: false });
}

function verifyIndependentReviewRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, reasonCode: 'REVIEW_OBJECT_REQUIRED' };
  try {
    const core = {
      reviewId: requiredString(record.reviewId, 'reviewId'),
      exactCommitSha: requiredCommitSha(record.exactCommitSha, 'exactCommitSha'),
      reviewerRef: requiredString(record.reviewerRef, 'reviewerRef'),
      reviewerOrganizationRef: requiredString(record.reviewerOrganizationRef, 'reviewerOrganizationRef'),
      independenceType: requiredString(record.independenceType, 'independenceType'),
      independenceAttestedByReviewer: bool(record.independenceAttestedByReviewer, 'independenceAttestedByReviewer'),
      conflictDeclared: bool(record.conflictDeclared, 'conflictDeclared'),
      reviewedScope: stringArray(record.reviewedScope, 'reviewedScope'),
      reviewReportRef: requiredString(record.reviewReportRef, 'reviewReportRef'),
      reviewReportHashSha256: requiredSha256(record.reviewReportHashSha256, 'reviewReportHashSha256'),
      decision: requiredString(record.decision, 'decision'),
      materialOpenFindings: nonNegativeInteger(record.materialOpenFindings, 'materialOpenFindings'),
      findingRefs: stringArray(record.findingRefs || [], 'findingRefs', true),
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
    };
    const expectedHash = hash(core);
    return { valid: record.independentReviewHashSha256 === expectedHash, reasonCode: record.independentReviewHashSha256 === expectedHash ? null : 'INDEPENDENT_REVIEW_HASH_MISMATCH', expectedHash };
  } catch (error) { return { valid: false, reasonCode: 'INDEPENDENT_REVIEW_SCHEMA_INVALID', error: error.message }; }
}

function buildIndependentReleaseQualification(input = {}) {
  const qualificationId = requiredString(input.qualificationId, 'qualificationId');
  const exactCommitSha = requiredCommitSha(input.exactCommitSha, 'exactCommitSha');
  const securityRef = requiredString(input.securityQualificationRef, 'securityQualificationRef');
  const securityHash = requiredSha256(input.securityQualificationHashSha256, 'securityQualificationHashSha256');
  const securityStatus = requiredString(input.securityQualificationStatus, 'securityQualificationStatus');
  const performanceRef = requiredString(input.performanceQualificationRef, 'performanceQualificationRef');
  const performanceHash = requiredSha256(input.performanceQualificationHashSha256, 'performanceQualificationHashSha256');
  const performanceStatus = requiredString(input.performanceQualificationStatus, 'performanceQualificationStatus');
  const releaseEvidence = input.releaseEvidence;
  const review = input.independentReview;
  const releaseCheck = verifyCanonicalReleaseEvidence(releaseEvidence);
  const reviewCheck = verifyIndependentReviewRecord(review);

  let status = RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW;
  const issues = [];
  if (!releaseCheck.valid || !reviewCheck.valid) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
    if (!releaseCheck.valid) issues.push(`RELEASE_EVIDENCE:${releaseCheck.reasonCode}`);
    if (!reviewCheck.valid) issues.push(`INDEPENDENT_REVIEW:${reviewCheck.reasonCode}`);
  } else if (releaseEvidence.exactCommitSha !== exactCommitSha || review.exactCommitSha !== exactCommitSha) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH;
    issues.push('EXACT_COMMIT_SCOPE_MISMATCH');
  } else if (securityStatus !== SECURITY_READY) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_SECURITY_QUALIFICATION;
    issues.push(`SECURITY_${securityStatus}`);
  } else if (performanceStatus !== PERFORMANCE_READY) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_PERFORMANCE_QUALIFICATION;
    issues.push(`PERFORMANCE_${performanceStatus}`);
  } else if (!(releaseEvidence.regressionTotal === releaseEvidence.regressionPassed && releaseEvidence.testDiscoveryAndRegressionPass && releaseEvidence.productionBuildPass && releaseEvidence.packageVerificationPass && releaseEvidence.auditThresholdPass && releaseEvidence.canonicalSourceHashVerificationPass && releaseEvidence.releaseVerifyPass)) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION;
    issues.push('CANONICAL_RELEASE_EVIDENCE_NOT_PASSING');
  } else if (releaseEvidence.preparedBy === releaseEvidence.reviewedBy) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_RELEASE_VERIFICATION;
    issues.push('RELEASE_EVIDENCE_NOT_INDEPENDENTLY_REVIEWED');
  } else if (!(review.independenceAttestedByReviewer === true && review.conflictDeclared === false && review.decision === REVIEW_DECISION.PASS && review.materialOpenFindings === 0)) {
    status = RELEASE_QUALIFICATION_STATUS.HOLD_INDEPENDENT_REVIEW;
    issues.push('INDEPENDENT_REVIEW_NOT_CLEAR_PASS');
  }

  const core = {
    qualificationId,
    exactCommitSha,
    securityQualificationRef: securityRef,
    securityQualificationHashSha256: securityHash,
    securityQualificationStatus: securityStatus,
    performanceQualificationRef: performanceRef,
    performanceQualificationHashSha256: performanceHash,
    performanceQualificationStatus: performanceStatus,
    releaseEvidenceHashSha256: releaseEvidence?.releaseEvidenceHashSha256 || null,
    independentReviewHashSha256: review?.independentReviewHashSha256 || null,
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    qualificationHashSha256: hash(core),
    independentEngineeringReviewRecorded: status === RELEASE_QUALIFICATION_STATUS.READY_FOR_RELEASE_AUTHORITY_REVIEW,
    reviewerCredentialsVerifiedByThisModule: false,
    reviewerIndependenceVerifiedByThisModule: false,
    productionSecurityValidated: false,
    productionPerformanceValidated: false,
    pdplComplianceEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    humanReleaseAuthorityApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'READY_FOR_RELEASE_AUTHORITY_REVIEW records that referenced engineering qualification statuses, canonical release evidence, and a caller-supplied independent review record passed deterministic integrity and scope checks. This module does not verify reviewer credentials or independence externally and does not authorize merge, release, deployment, regulated valuation activity, or transactions.',
  });
}

function verifyIndependentReleaseQualification(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, reasonCode: 'QUALIFICATION_OBJECT_REQUIRED' };
  const core = {
    qualificationId: record.qualificationId,
    exactCommitSha: record.exactCommitSha,
    securityQualificationRef: record.securityQualificationRef,
    securityQualificationHashSha256: record.securityQualificationHashSha256,
    securityQualificationStatus: record.securityQualificationStatus,
    performanceQualificationRef: record.performanceQualificationRef,
    performanceQualificationHashSha256: record.performanceQualificationHashSha256,
    performanceQualificationStatus: record.performanceQualificationStatus,
    releaseEvidenceHashSha256: record.releaseEvidenceHashSha256,
    independentReviewHashSha256: record.independentReviewHashSha256,
    status: record.status,
    issues: [...(record.issues || [])],
  };
  const expectedHash = hash(core);
  return { valid: record.qualificationHashSha256 === expectedHash, reasonCode: record.qualificationHashSha256 === expectedHash ? null : 'QUALIFICATION_HASH_MISMATCH', expectedHash };
}

module.exports = {
  INDEPENDENCE_TYPE,
  REVIEW_DECISION,
  RELEASE_QUALIFICATION_STATUS,
  SECURITY_READY,
  PERFORMANCE_READY,
  createCanonicalReleaseEvidence,
  verifyCanonicalReleaseEvidence,
  createIndependentReviewRecord,
  verifyIndependentReviewRecord,
  buildIndependentReleaseQualification,
  verifyIndependentReleaseQualification,
};
