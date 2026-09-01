'use strict';

const { SECURITY_EVIDENCE_TRUST_STATUS } = require('./security-evidence-trust-gate.js');

const PRODUCTION_SECURITY_REVIEW_STATUS = Object.freeze({
  EVIDENCE_PACK_COMPLETE: 'EVIDENCE_PACK_COMPLETE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_TRUST_GATE: 'HOLD_TRUST_GATE',
  HOLD_REVIEW_METADATA: 'HOLD_REVIEW_METADATA',
  HOLD_REVIEW_SCOPE: 'HOLD_REVIEW_SCOPE',
  HOLD_PENETRATION_TEST: 'HOLD_PENETRATION_TEST',
  HOLD_BLOCKING_FINDINGS: 'HOLD_BLOCKING_FINDINGS',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_EVIDENCE_REFS: 'HOLD_EVIDENCE_REFS',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

function normalizedFindings(findings) {
  if (!Array.isArray(findings)) return [];
  return findings.map((finding, index) => ({
    id: nonEmptyString(finding?.id) ? finding.id.trim() : `FINDING-${index + 1}`,
    severity: String(finding?.severity || 'UNKNOWN').toUpperCase(),
    resolved: finding?.resolved === true,
    findingRef: nonEmptyString(finding?.findingRef) ? finding.findingRef.trim() : null,
  }));
}

function noBlockingFindings(findings) {
  return findings.every((finding) => !['CRITICAL', 'HIGH'].includes(finding.severity) || finding.resolved === true);
}

function hold(status, reasons, context = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    readyForProductionReadinessAudit: false,
    independentReviewCompleted: false,
    runtimeIdentityEvidenceReferenced: false,
    runtimeRlsEvidenceReferenced: false,
    findings: [],
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
  };
}

function buildProductionSecurityReviewEvidence({
  caseId,
  projectId,
  expectedEnvironment,
  securityTrustAssessment,
  trustGateEvidenceRef,
  independentReview,
  evidenceRefs = [],
}) {
  const context = { caseId, projectId };

  if (!nonEmptyString(caseId) || !nonEmptyString(projectId) || !nonEmptyString(expectedEnvironment)) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_SCOPE, ['caseId, projectId, and expectedEnvironment are required'], context);
  }

  const trustReady =
    securityTrustAssessment?.status === SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW &&
    securityTrustAssessment?.expectedEnvironment === expectedEnvironment;
  if (!trustReady) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_TRUST_GATE, ['security evidence trust gate is not ready for the declared environment'], context);
  }

  const reviewMetadataValid =
    independentReview?.completed === true &&
    nonEmptyString(independentReview?.reviewerRef) &&
    nonEmptyString(independentReview?.reviewRef) &&
    nonEmptyString(independentReview?.methodologyRef);
  if (!reviewMetadataValid) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_REVIEW_METADATA, ['independent reviewer, review, and methodology references are required'], context);
  }

  const reviewScopeValid = allTrue(independentReview, [
    'identityReviewed',
    'rlsReviewed',
    'authorizationReviewed',
    'idorReviewed',
    'auditLoggingReviewed',
    'secretsManagementReviewed',
    'rateLimitingReviewed',
    'dependencyScanningReviewed',
  ]);
  if (!reviewScopeValid) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_REVIEW_SCOPE, ['required production security review scope is incomplete'], context);
  }

  const penetrationValid =
    independentReview?.penetrationTestPerformed === true &&
    nonEmptyString(independentReview?.penetrationTestRef);
  if (!penetrationValid) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_PENETRATION_TEST, ['independent penetration-test evidence is required'], context);
  }

  const findings = normalizedFindings(independentReview?.findings);
  if (!noBlockingFindings(findings)) {
    return {
      ...hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_BLOCKING_FINDINGS, ['unresolved HIGH/CRITICAL security findings remain'], context),
      findings,
    };
  }

  const reviewedAt = independentReview?.reviewedAt;
  const evidenceCapturedAt = independentReview?.evidenceCapturedAt;
  const timelineValid =
    isIsoTimestamp(reviewedAt) &&
    isIsoTimestamp(evidenceCapturedAt) &&
    Date.parse(reviewedAt) <= Date.parse(evidenceCapturedAt);
  if (!timelineValid) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_TIMELINE, ['review and evidence-capture timestamps must be valid and ordered'], context);
  }

  const requiredRefs = [
    trustGateEvidenceRef,
    independentReview.reviewerRef,
    independentReview.reviewRef,
    independentReview.methodologyRef,
    independentReview.penetrationTestRef,
    independentReview.runtimeIdentityEvidenceRef,
    independentReview.runtimeRlsEvidenceRef,
    independentReview.authorizationEvidenceRef,
    independentReview.auditEvidenceRef,
    independentReview.idorEvidenceRef,
  ];
  if (requiredRefs.some((ref) => !nonEmptyString(ref))) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_EVIDENCE_REFS, ['runtime identity/RLS/authorization/audit/IDOR and review evidence references are required'], context);
  }

  const refs = cleanRefs(evidenceRefs);
  const normalizedRequiredRefs = requiredRefs.map((ref) => ref.trim());
  if (!normalizedRequiredRefs.every((ref) => refs.includes(ref))) {
    return hold(PRODUCTION_SECURITY_REVIEW_STATUS.HOLD_EVIDENCE_REFS, ['evidenceRefs must contain the complete production security review reference chain'], context);
  }

  return {
    caseId,
    projectId,
    status: PRODUCTION_SECURITY_REVIEW_STATUS.EVIDENCE_PACK_COMPLETE,
    reasons: [],
    expectedEnvironment,
    reviewerRef: independentReview.reviewerRef.trim(),
    reviewRef: independentReview.reviewRef.trim(),
    methodologyRef: independentReview.methodologyRef.trim(),
    penetrationTestRef: independentReview.penetrationTestRef.trim(),
    reviewedAt,
    evidenceCapturedAt,
    findings,
    evidenceRefs: refs,
    readyForProductionReadinessAudit: true,
    independentReviewCompleted: true,
    runtimeIdentityEvidenceReferenced: true,
    runtimeRlsEvidenceReferenced: true,
    productionSecurityCertified: false,
    legalApprovalEstablished: false,
    humanApprovalRequired: true,
    transactionAuthorized: false,
    semantics: 'This pack records caller-supplied independent production-security review evidence after the deterministic security trust gate. It does not perform penetration testing, independently validate the reviewer, certify production security, establish legal approval, or authorize deployment or transactions.',
  };
}

module.exports = {
  PRODUCTION_SECURITY_REVIEW_STATUS,
  buildProductionSecurityReviewEvidence,
};
