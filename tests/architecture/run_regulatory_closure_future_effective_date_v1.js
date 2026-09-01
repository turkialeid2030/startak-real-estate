'use strict';

const assert = require('assert');
const {
  AUTHORIZED_REVIEWER_TYPE,
  REGULATORY_CLASSIFICATION,
  REGULATORY_CLOSURE_STATUS,
  buildRegulatoryClosureEvidence,
} = require('../../src/compliance/regulatory-closure-evidence');

const reviewerRef = 'reviewer://legal/1';
const reviewRef = 'evidence://review/1';
const sourceRef = 'evidence://source/1';
const input = {
  caseId: 'CASE-FUTURE-EFFECTIVE',
  projectId: 'PROJECT-FUTURE-EFFECTIVE',
  jurisdiction: 'SA',
  asOfDate: '2026-09-01T00:00:00Z',
  classificationReview: {
    completed: true,
    reviewerType: AUTHORIZED_REVIEWER_TYPE.LEGAL_COUNSEL,
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
    permittedUses: ['decision support'],
    prohibitedUses: ['legal opinion'],
  },
  sources: [{
    authority: 'SOURCE_AUTHORITY',
    sourceRef,
    versionHash: 'sha256:test',
    effectiveDate: '2026-10-01T00:00:00Z',
    lastVerifiedDate: '2026-08-31T00:00:00Z',
    reviewAfterDate: '2026-12-31T00:00:00Z',
  }],
  evidenceRefs: [reviewerRef, reviewRef, sourceRef],
};

const result = buildRegulatoryClosureEvidence(input);
assert.notStrictEqual(result.status, REGULATORY_CLOSURE_STATUS.EVIDENCE_PACK_COMPLETE, 'future-effective source must not qualify before its effective date');
console.log('REGULATORY_CLOSURE_FUTURE_EFFECTIVE_DATE_V1=PASS checks=1');
