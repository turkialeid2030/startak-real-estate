'use strict';

const assert = require('assert');
const {
  REGULATORY_CLASSIFICATION,
  AUTHORIZED_REVIEWER_TYPE,
  REGULATORY_CLOSURE_STATUS: STATUS,
  buildRegulatoryClosureEvidence,
} = require('../../src/compliance/regulatory-closure-evidence');

function base() {
  const reviewerRef = 'reviewer://legal-counsel/1';
  const reviewRef = 'evidence://regulatory/classification-review/1';
  const sourceRef = 'evidence://regulatory/authoritative-source/1';
  return {
    caseId: 'CASE-COMP-001',
    projectId: 'PROJECT-COMP-001',
    jurisdiction: 'SA',
    asOfDate: '2026-09-01T00:00:00Z',
    classificationReview: {
      completed: true,
      reviewerType: AUTHORIZED_REVIEWER_TYPE.LEGAL_COUNSEL,
      reviewerRef,
      reviewRef,
      reviewedAt: '2026-08-30T00:00:00Z',
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
      versionHash: 'sha256:caller-supplied-source-version',
      effectiveDate: '2026-01-01T00:00:00Z',
      lastVerifiedDate: '2026-08-29T00:00:00Z',
      reviewAfterDate: '2026-12-31T00:00:00Z',
    }],
    evidenceRefs: [reviewerRef, reviewRef, sourceRef],
  };
}

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('decision-support classification pack is bounded and review-only', () => {
  const result = buildRegulatoryClosureEvidence(base());
  assert.strictEqual(result.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(result.readyForProductionReadinessAudit, true);
  assert.strictEqual(result.classificationReviewCompleted, true);
  assert.strictEqual(result.regulatedScopeResolved, true);
  assert.strictEqual(result.legalCounselOrAuthorizedReviewerCompleted, true);
  assert.strictEqual(result.softwareDoesNotSelfEstablishLegalApproval, true);
  assert.strictEqual(result.legalApprovalEstablished, false);
  assert.strictEqual(result.productionDeploymentAuthorized, false);
  assert.strictEqual(result.transactionAuthorized, false);
});

check('scope fails closed', () => {
  const input = base();
  input.jurisdiction = '';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_SCOPE);
});

check('authorized review metadata required', () => {
  const input = base();
  input.classificationReview.reviewerRef = '';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_REVIEW);
});

check('future review date fails closed', () => {
  const input = base();
  input.classificationReview.reviewedAt = '2026-10-01T00:00:00Z';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_REVIEW);
});

check('unresolved classification fails closed', () => {
  const input = base();
  input.classificationReview.regulatedScopeResolved = false;
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_CLASSIFICATION);
});

check('regulated classification requires authorization evidence', () => {
  const input = base();
  input.classificationReview.classification = REGULATORY_CLASSIFICATION.REGULATED_REAL_ESTATE_CONSULTATION_ANALYSIS;
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_AUTHORIZATION);
});

check('regulated classification can proceed only with caller-supplied authorization evidence', () => {
  const input = base();
  input.classificationReview.classification = REGULATORY_CLASSIFICATION.LICENSE_OR_AUTHORIZATION_REQUIRED;
  input.classificationReview.requiredAuthorizationSatisfied = true;
  input.classificationReview.authorizationEvidenceRef = 'evidence://regulatory/authorization/1';
  input.evidenceRefs.push(input.classificationReview.authorizationEvidenceRef);
  const result = buildRegulatoryClosureEvidence(input);
  assert.strictEqual(result.status, STATUS.EVIDENCE_PACK_COMPLETE);
  assert.strictEqual(result.authorizationRequired, true);
  assert.strictEqual(result.legalApprovalEstablished, false);
});

check('authoritative source provenance required', () => {
  const input = base();
  input.sources[0].versionHash = '';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_SOURCE_EVIDENCE);
});

check('stale source fails closed', () => {
  const input = base();
  input.sources[0].reviewAfterDate = '2026-08-01T00:00:00Z';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_SOURCE_FRESHNESS);
});

check('future-verified source fails closed', () => {
  const input = base();
  input.sources[0].lastVerifiedDate = '2026-10-01T00:00:00Z';
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_SOURCE_FRESHNESS);
});

check('permitted and prohibited use boundaries are required', () => {
  const input = base();
  input.classificationReview.prohibitedUses = [];
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_OPERATING_BOUNDARIES);
});

check('complete evidence reference chain required', () => {
  const input = base();
  input.evidenceRefs = input.evidenceRefs.filter((ref) => ref !== input.sources[0].sourceRef);
  assert.strictEqual(buildRegulatoryClosureEvidence(input).status, STATUS.HOLD_EVIDENCE_REFS);
});

console.log(`REGULATORY_CLOSURE_EVIDENCE_V1=PASS checks=${checks}`);
