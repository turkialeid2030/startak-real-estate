'use strict';

const assert = require('assert');
const {
  PRODUCTION_SECURITY_REVIEW_STATUS: STATUS,
  buildProductionSecurityReviewEvidence,
} = require('../../src/security/production-security-review-evidence');
const { SECURITY_EVIDENCE_TRUST_STATUS } = require('../../src/security/security-evidence-trust-gate');

function validInput() {
  const refs = {
    trust: 'evidence://security/trust-gate/1',
    reviewer: 'reviewer://independent-security-firm/1',
    review: 'evidence://security/review/1',
    method: 'evidence://security/methodology/1',
    pentest: 'evidence://security/pentest/1',
    identity: 'evidence://security/runtime-identity/1',
    rls: 'evidence://security/runtime-rls/1',
    authz: 'evidence://security/authorization/1',
    audit: 'evidence://security/audit/1',
    idor: 'evidence://security/idor/1',
  };
  return {
    caseId: 'CASE-SEC-001',
    projectId: 'PROJECT-SEC-001',
    expectedEnvironment: 'production-sa-central-1',
    securityTrustAssessment: {
      status: SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW,
      expectedEnvironment: 'production-sa-central-1',
    },
    trustGateEvidenceRef: refs.trust,
    independentReview: {
      completed: true,
      reviewerRef: refs.reviewer,
      reviewRef: refs.review,
      methodologyRef: refs.method,
      identityReviewed: true,
      rlsReviewed: true,
      authorizationReviewed: true,
      idorReviewed: true,
      auditLoggingReviewed: true,
      secretsManagementReviewed: true,
      rateLimitingReviewed: true,
      dependencyScanningReviewed: true,
      penetrationTestPerformed: true,
      penetrationTestRef: refs.pentest,
      runtimeIdentityEvidenceRef: refs.identity,
      runtimeRlsEvidenceRef: refs.rls,
      authorizationEvidenceRef: refs.authz,
      auditEvidenceRef: refs.audit,
      idorEvidenceRef: refs.idor,
      findings: [
        { id: 'M-1', severity: 'MEDIUM', resolved: false, findingRef: 'evidence://security/finding/M-1' },
        { id: 'H-1', severity: 'HIGH', resolved: true, findingRef: 'evidence://security/finding/H-1' },
      ],
      reviewedAt: '2026-09-01T13:00:00Z',
      evidenceCapturedAt: '2026-09-01T13:10:00Z',
    },
    evidenceRefs: Object.values(refs),
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('complete independent review evidence is bounded', () => {
  const result = buildProductionSecurityReviewEvidence(validInput());
  assert.strictEqual(result.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(result.readyForProductionReadinessAudit, true);
  assert.strictEqual(result.independentReviewCompleted, true);
  assert.strictEqual(result.runtimeIdentityEvidenceReferenced, true);
  assert.strictEqual(result.runtimeRlsEvidenceReferenced, true);
  assert.strictEqual(result.productionSecurityCertified, false);
  assert.strictEqual(result.legalApprovalEstablished, false);
  assert.strictEqual(result.humanApprovalRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
});

check('scope fails closed', () => {
  const input = validInput();
  input.projectId = '';
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_SCOPE);
});

check('security trust gate must match environment', () => {
  const input = validInput();
  input.securityTrustAssessment.expectedEnvironment = 'staging';
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_TRUST_GATE);
});

check('review metadata required', () => {
  const input = validInput();
  input.independentReview.reviewerRef = '';
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_REVIEW_METADATA);
});

check('review scope must include IDOR', () => {
  const input = validInput();
  input.independentReview.idorReviewed = false;
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_REVIEW_SCOPE);
});

check('penetration-test evidence required', () => {
  const input = validInput();
  input.independentReview.penetrationTestPerformed = false;
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_PENETRATION_TEST);
});

check('unresolved high finding blocks', () => {
  const input = validInput();
  input.independentReview.findings = [{ id: 'H-2', severity: 'HIGH', resolved: false }];
  const result = buildProductionSecurityReviewEvidence(input);
  assert.strictEqual(result.status, STATUS.HOLD_BLOCKING_FINDINGS);
  assert.strictEqual(result.findings.length, 1);
});

check('unresolved critical finding blocks', () => {
  const input = validInput();
  input.independentReview.findings = [{ id: 'C-1', severity: 'CRITICAL', resolved: false }];
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_BLOCKING_FINDINGS);
});

check('timeline must be valid and ordered', () => {
  const input = validInput();
  input.independentReview.evidenceCapturedAt = '2026-09-01T12:59:00Z';
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_TIMELINE);
});

check('runtime RLS evidence reference is mandatory', () => {
  const input = validInput();
  input.independentReview.runtimeRlsEvidenceRef = '';
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_EVIDENCE_REFS);
});

check('complete evidence-reference chain is mandatory', () => {
  const input = validInput();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.independentReview.penetrationTestRef);
  assert.strictEqual(buildProductionSecurityReviewEvidence(input).status, STATUS.HOLD_EVIDENCE_REFS);
});

console.log(`PRODUCTION_SECURITY_REVIEW_EVIDENCE_V1=PASS checks=${checks}`);
