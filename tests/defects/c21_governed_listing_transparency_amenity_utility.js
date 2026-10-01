'use strict';

const assert = require('assert');
const {
  REVIEW_STATUS,
  LISTING_STATUS,
  AMENITY_CLASS,
  AMENITY_STATE,
  AMENITY_METRIC_TYPE,
  createGovernedListingEvidence,
  verifyListingIntegrity,
  createGovernedAmenityEvidence,
  verifyAmenityIntegrity,
  createProfessionalAmenityUtilityAssessment,
  verifyUtilityAssessmentIntegrity,
  createGovernedListingAmenityReviewPolicy,
  verifyPolicyIntegrity,
  evaluateGovernedListingAmenityReview,
} = require('../../src/strategy/governed-listing-transparency-amenity-utility');

const AS_OF = '2026-10-01T12:00:00Z';
const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);

function listing(id, dedup, price, area, overrides = {}) {
  return createGovernedListingEvidence({
    listingEvidenceId: id,
    caseId: 'CASE-21',
    propertyRef: 'PROP-21',
    marketScopeRef: 'RIYADH-21',
    listingRef: `LISTING-${id}`,
    deduplicationKey: dedup,
    listingStatus: LISTING_STATUS.ACTIVE,
    askingPriceSar: price,
    areaSqm: area,
    sourceProviderId: 'BROKER-SOURCE-21',
    sourceTier: 'B_COMMERCIAL_CORROBORATION',
    sourceRecordId: `REC-${id}`,
    sourceRecordHashSha256: H1,
    sourceReference: `SOURCE-${id}`,
    provenanceVerified: true,
    publishedAt: '2026-09-29T08:00:00Z',
    observedAt: '2026-09-30T08:00:00Z',
    reviewedAt: '2026-09-30T10:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    reviewedByRef: 'LISTING-REVIEWER-21',
    reviewEvidenceRef: `REVIEW-${id}`,
    ...overrides,
  });
}

function amenity(id, amenityClass, state, metricType, metricValue, overrides = {}) {
  return createGovernedAmenityEvidence({
    amenityEvidenceId: id,
    caseId: 'CASE-21',
    propertyRef: 'PROP-21',
    marketScopeRef: 'RIYADH-21',
    amenityRef: `AMENITY-${id}`,
    amenityClass,
    amenityState: state,
    metricType,
    metricValue,
    sourceProviderId: 'OFFICIAL-GEO-21',
    sourceTier: 'A_OFFICIAL_AUTHORITATIVE',
    sourceRecordId: `REC-${id}`,
    sourceRecordHashSha256: H2,
    sourceReference: `SOURCE-${id}`,
    provenanceVerified: true,
    observedAt: '2026-09-28T08:00:00Z',
    knownAt: '2026-09-29T08:00:00Z',
    reviewedAt: '2026-09-30T10:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    reviewedByRef: 'AMENITY-REVIEWER-21',
    reviewEvidenceRef: `REVIEW-${id}`,
    ...overrides,
  });
}

function assessment(id, amenityRecord, score, weight, overrides = {}) {
  return createProfessionalAmenityUtilityAssessment({
    assessmentId: id,
    caseId: 'CASE-21',
    propertyRef: 'PROP-21',
    amenityEvidenceHashSha256: amenityRecord.amenityEvidenceHashSha256,
    utilityScore: score,
    importanceWeight: weight,
    rationaleRef: `RATIONALE-${id}`,
    preparedByRef: 'PROFESSIONAL-21',
    preparedAt: '2026-09-30T10:15:00Z',
    reviewedByRef: 'UTILITY-REVIEWER-21',
    reviewedAt: '2026-09-30T10:30:00Z',
    reviewEvidenceRef: `UTILITY-REVIEW-${id}`,
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function policy(listings, amenities, assessments, overrides = {}) {
  return createGovernedListingAmenityReviewPolicy({
    policyId: 'POLICY-21',
    caseId: 'CASE-21',
    propertyRef: 'PROP-21',
    marketScopeRef: 'RIYADH-21',
    allowedListingSourceTiers: ['B_COMMERCIAL_CORROBORATION'],
    allowedAmenitySourceTiers: ['A_OFFICIAL_AUTHORITATIVE'],
    allowedListingStatuses: [LISTING_STATUS.ACTIVE, LISTING_STATUS.UNDER_OFFER],
    allowedAmenityClasses: [AMENITY_CLASS.EDUCATION, AMENITY_CLASS.HEALTHCARE, AMENITY_CLASS.PUBLIC_TRANSPORT],
    requiredAmenityClasses: [AMENITY_CLASS.EDUCATION, AMENITY_CLASS.HEALTHCARE],
    listingHashesSha256: listings.map((r) => r.listingEvidenceHashSha256),
    amenityHashesSha256: amenities.map((r) => r.amenityEvidenceHashSha256),
    utilityAssessmentHashesSha256: assessments.map((r) => r.utilityAssessmentHashSha256),
    allowPlannedProposedReviewContext: true,
    reviewedByRef: 'GOVERNANCE-21',
    reviewEvidenceRef: 'POLICY-REVIEW-21',
    reviewedAt: '2026-09-30T11:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function fixture() {
  const listings = [
    listing('L1', 'DEDUP-1', 1000000, 500),
    listing('L2', 'DEDUP-2', 1200000, 600),
  ];
  const education = amenity('A1', AMENITY_CLASS.EDUCATION, AMENITY_STATE.EXISTING_VERIFIED, AMENITY_METRIC_TYPE.DISTANCE_METERS_EXTERNAL, 800);
  const healthcare = amenity('A2', AMENITY_CLASS.HEALTHCARE, AMENITY_STATE.EXISTING_VERIFIED, AMENITY_METRIC_TYPE.DRIVE_TIME_MINUTES_EXTERNAL, 7);
  const plannedTransit = amenity('A3', AMENITY_CLASS.PUBLIC_TRANSPORT, AMENITY_STATE.PLANNED_NOT_DELIVERED, AMENITY_METRIC_TYPE.DISTANCE_METERS_EXTERNAL, 500);
  const amenities = [education, healthcare, plannedTransit];
  const assessments = [assessment('U1', education, 80, 0.6), assessment('U2', healthcare, 60, 0.4)];
  const reviewPolicy = policy(listings, amenities, assessments);
  return { listings, amenities, assessments, reviewPolicy };
}

const f = fixture();
for (const r of f.listings) assert(verifyListingIntegrity(r));
for (const r of f.amenities) assert(verifyAmenityIntegrity(r));
for (const r of f.assessments) assert(verifyUtilityAssessmentIntegrity(r));
assert(verifyPolicyIntegrity(f.reviewPolicy));

const ready = evaluateGovernedListingAmenityReview({
  listings: f.listings,
  amenities: f.amenities,
  utilityAssessments: f.assessments,
  reviewPolicy: f.reviewPolicy,
  asOf: AS_OF,
});
assert.strictEqual(ready.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_LISTING_AMENITY_REVIEW);
assert.strictEqual(ready.professionalListingAmenityReviewReady, true);
assert.strictEqual(ready.review.listingTransparency.listingCount, 2);
assert.strictEqual(ready.review.listingTransparency.activeOrUnderOfferCount, 2);
assert.strictEqual(ready.review.listingTransparency.closedTransactionEvidenceCount, 0);
assert.strictEqual(ready.review.listingTransparency.meanAskingPricePerSqmSar, 2000);
assert.strictEqual(ready.review.amenityUtility.existingVerifiedAmenityCount, 2);
assert.strictEqual(ready.review.amenityUtility.plannedNotDeliveredCount, 1);
assert.strictEqual(ready.review.amenityUtility.weightedProfessionalUtilityScore, 72);
assert.strictEqual(ready.recommendation, null);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.productionAuthorized, false);
assert.strictEqual(ready.publicAiAuthorized, false);
assert.strictEqual(ready.commercialGoLive, 'HOLD');
assert.strictEqual(ready.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(ready.geospatialInferenceAllowed, false);
assert.strictEqual(ready.askingToClosedTransactionPromotionAllowed, false);
assert.strictEqual(ready.automaticInvestmentRanking, false);
assert.strictEqual(ready.automaticValuationUse, false);
assert.strictEqual(ready.valuationCalculated, false);
assert.strictEqual(ready.avmCalculated, false);
assert.strictEqual(ready.npvCalculated, false);
assert.strictEqual(ready.irrCalculated, false);

const duplicateListings = [f.listings[0], listing('L3', 'DEDUP-1', 1100000, 550)];
const duplicatePolicy = policy(duplicateListings, f.amenities, f.assessments, { policyId: 'POLICY-DUP-21' });
const duplicate = evaluateGovernedListingAmenityReview({ listings: duplicateListings, amenities: f.amenities, utilityAssessments: f.assessments, reviewPolicy: duplicatePolicy, asOf: AS_OF });
assert.strictEqual(duplicate.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(duplicate.blockers.some((b) => b.startsWith('C21_INTEGRITY_DUPLICATE_LISTING_DEDUP_KEY')));
assert.strictEqual(duplicate.review, null);

const planned = f.amenities[2];
const badAssessments = [...f.assessments, assessment('U3', planned, 95, 0.2)];
const badPolicy = policy(f.listings, f.amenities, badAssessments, { policyId: 'POLICY-PLANNED-UTILITY-21' });
const badUtility = evaluateGovernedListingAmenityReview({ listings: f.listings, amenities: f.amenities, utilityAssessments: badAssessments, reviewPolicy: badPolicy, asOf: AS_OF });
assert.strictEqual(badUtility.status, REVIEW_STATUS.HOLD_EVIDENCE);
assert(badUtility.blockers.some((b) => b.startsWith('C21_EVIDENCE_UTILITY_NON_EXISTING_AMENITY')));

const noHealthcare = f.amenities.filter((r) => r.amenityClass !== AMENITY_CLASS.HEALTHCARE);
const noHealthcareAssessments = f.assessments.filter((r) => r.amenityEvidenceHashSha256 !== f.amenities[1].amenityEvidenceHashSha256);
const noHealthcarePolicy = policy(f.listings, noHealthcare, noHealthcareAssessments, { policyId: 'POLICY-COVERAGE-21' });
const coverage = evaluateGovernedListingAmenityReview({ listings: f.listings, amenities: noHealthcare, utilityAssessments: noHealthcareAssessments, reviewPolicy: noHealthcarePolicy, asOf: AS_OF });
assert.strictEqual(coverage.status, REVIEW_STATUS.HOLD_COVERAGE);
assert(coverage.blockers.includes(`C21_COVERAGE_REQUIRED_AMENITY_CLASS:${AMENITY_CLASS.HEALTHCARE}`));

const staleAmenity = amenity('A2-STALE', AMENITY_CLASS.HEALTHCARE, AMENITY_STATE.EXISTING_VERIFIED, AMENITY_METRIC_TYPE.DRIVE_TIME_MINUTES_EXTERNAL, 7, { validUntil: '2026-09-30T12:00:00Z' });
const staleAmenities = [f.amenities[0], staleAmenity, f.amenities[2]];
const staleAssessments = [assessment('U1-S', staleAmenities[0], 80, 0.6), assessment('U2-S', staleAmenity, 60, 0.4)];
const stalePolicy = policy(f.listings, staleAmenities, staleAssessments, { policyId: 'POLICY-STALE-21' });
const stale = evaluateGovernedListingAmenityReview({ listings: f.listings, amenities: staleAmenities, utilityAssessments: staleAssessments, reviewPolicy: stalePolicy, asOf: AS_OF });
assert.strictEqual(stale.status, REVIEW_STATUS.HOLD_WINDOW);
assert(stale.blockers.some((b) => b.startsWith('C21_WINDOW_AMENITY_STALE')));

const otherPropertyListing = listing('L-OTHER', 'DEDUP-OTHER', 900000, 450, { propertyRef: 'PROP-OTHER' });
const contextListings = [otherPropertyListing, f.listings[1]];
const contextPolicy = policy(contextListings, f.amenities, f.assessments, { policyId: 'POLICY-CONTEXT-21' });
const context = evaluateGovernedListingAmenityReview({ listings: contextListings, amenities: f.amenities, utilityAssessments: f.assessments, reviewPolicy: contextPolicy, asOf: AS_OF });
assert.strictEqual(context.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(context.blockers.some((b) => b.startsWith('C21_CONTEXT_LISTING')));

const tampered = { ...f.listings[0], askingPriceSar: 999999 };
const tamperListings = [tampered, f.listings[1]];
const tamper = evaluateGovernedListingAmenityReview({ listings: tamperListings, amenities: f.amenities, utilityAssessments: f.assessments, reviewPolicy: f.reviewPolicy, asOf: AS_OF });
assert.strictEqual(tamper.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tamper.blockers.some((b) => b.startsWith('C21_INTEGRITY_LISTING')));

assert.throws(() => createProfessionalAmenityUtilityAssessment({
  assessmentId: 'BAD', caseId: 'CASE-21', propertyRef: 'PROP-21', amenityEvidenceHashSha256: H3,
  utilityScore: 101, importanceWeight: 0.5, rationaleRef: 'R', preparedByRef: 'P', preparedAt: '2026-09-30T10:00:00Z',
  reviewedByRef: 'R', reviewedAt: '2026-09-30T11:00:00Z', reviewEvidenceRef: 'E', validUntil: '2026-10-03T12:00:00Z',
}), /C21_UTILITY_SCORE_INVALID/);

console.log('C21_GOVERNED_LISTING_TRANSPARENCY_AMENITY_UTILITY=PASS');