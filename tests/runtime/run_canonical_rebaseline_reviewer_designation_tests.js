'use strict';

const assert = require('assert');
const {
  createCanonicalBaselineReconstitutionProposal,
} = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  STATUS: P25_STATUS,
  DECISION_RESULT,
  createCanonicalRebaselineGovernanceDecision,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  STATUS: DESIGNATION_STATUS,
  DEFAULT_REVIEWER,
  createCanonicalRebaselineReviewerDesignation,
  verifyCanonicalRebaselineReviewerDesignation,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation');
const {
  STATUS: P26_STATUS,
  createCanonicalRebaselineIndependentReviewPacket,
  createIndependentReviewResponse,
} = require('../../src/qualification/canonical-rebaseline-independent-review');
const {
  createIndependentReviewSigningPayload,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-owner-designation-1',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: H64('b'),
    environmentConfigSha256: H64('c'),
    preparedByRef: 'owner:1',
    independentReviewerRef: 'reviewer:initial-placeholder',
    preparedAt: '2026-09-09T18:00:00Z',
  });
}

function ownerDecision() {
  return {
    decisionId: 'owner-decision-1',
    actorRef: 'owner:1',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'issue:250#owner-direction',
    decisionArtifactSha256: H64('d'),
    decidedAt: '2026-09-09T19:00:00Z',
    rationaleRef: 'owner-approved-governed-reviewer-designation',
  };
}

function designation(p = proposal()) {
  return createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'reviewer-designation-1',
    assignedByRef: 'owner:1',
    designationSourceRef: 'owner-governance:reviewer-designation',
    designationArtifactSha256: H64('e'),
    designatedAt: '2026-09-09T20:00:00Z',
  });
}

(function run() {
  const p = proposal();
  const d = designation(p);

  assert.strictEqual(d.status, DESIGNATION_STATUS.REVIEWER_DESIGNATION_ACTIVE);
  assert.strictEqual(d.reviewerRef, DEFAULT_REVIEWER.reviewerRef);
  assert.strictEqual(d.reviewerDisplayName, 'سعيد المراجع');
  assert.strictEqual(d.ownerMayDesignateReviewer, true);
  assert.strictEqual(d.ownerMayReplaceReviewerBeforeAcceptedReview, true);
  assert.strictEqual(d.reviewerIdentityCryptographicallyVerifiedHere, false);
  assert.strictEqual(d.releaseAuthorized, false);
  assert.strictEqual(verifyCanonicalRebaselineReviewerDesignation(d, { proposal: p, ownerActorRef: 'owner:1' }), true);
  assert.strictEqual(Object.isFrozen(d), true);

  const waiting = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: ownerDecision(),
    independentReview: null,
    reviewerDesignation: d,
  });
  assert.strictEqual(waiting.status, P25_STATUS.WAITING_FOR_INDEPENDENT_REVIEW);
  assert.strictEqual(waiting.effectiveIndependentReviewerRef, 'reviewer:saeed-pending');
  assert.strictEqual(waiting.reviewerDisplayName, 'سعيد المراجع');
  assert.strictEqual(waiting.reviewerDesignationHashSha256, d.designationHashSha256);

  const packet = createCanonicalRebaselineIndependentReviewPacket({
    proposal: p,
    ownerDecision: ownerDecision(),
    reviewerDesignation: d,
    reviewRequestId: 'review-request-saeed-1',
    requestedAt: '2026-09-09T20:10:00Z',
  });
  assert.strictEqual(packet.status, P26_STATUS.READY_FOR_INDEPENDENT_REVIEW);
  assert.strictEqual(packet.independentReviewerRef, 'reviewer:saeed-pending');
  assert.strictEqual(packet.reviewerDisplayName, 'سعيد المراجع');
  assert.strictEqual(packet.reviewerDesignationHashSha256, d.designationHashSha256);
  assert.strictEqual(packet.expectedResponseContract.actorRefMustEqual, 'reviewer:saeed-pending');

  const signingPayload = createIndependentReviewSigningPayload({
    packet,
    attestation: {
      decisionId: 'saeed-review-1',
      reviewerId: 'saeed-registry-id',
      actorRef: 'reviewer:saeed-pending',
      result: DECISION_RESULT.APPROVE,
      decisionSourceRef: 'external-review:saeed-1',
      decisionArtifactSha256: H64('f'),
      decidedAt: '2026-09-09T21:00:00Z',
      rationaleRef: 'review-completed',
      signatureAlgorithm: 'RSA-SHA256',
    },
  });
  assert.strictEqual(signingPayload.actorRef, 'reviewer:saeed-pending');
  assert.strictEqual(signingPayload.reviewPacketHashSha256, packet.reviewPacketHashSha256);

  const normalized = createIndependentReviewResponse({
    packet,
    decisionId: 'saeed-review-1',
    actorRef: 'reviewer:saeed-pending',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:saeed-1',
    decisionArtifactSha256: H64('f'),
    decidedAt: '2026-09-09T21:00:00Z',
    rationaleRef: 'review-completed',
  });
  assert.strictEqual(normalized.status, P26_STATUS.REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION);

  const ready = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: ownerDecision(),
    independentReview: normalized.independentReview,
    reviewerDesignation: d,
  });
  assert.strictEqual(ready.status, P25_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE);
  assert.strictEqual(ready.effectiveIndependentReviewerRef, 'reviewer:saeed-pending');
  assert.strictEqual(ready.canonicalBaselineChanged, false);
  assert.strictEqual(ready.releaseAuthorized, false);

  const replacement = createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'reviewer-designation-2',
    assignedByRef: 'owner:1',
    reviewerRef: 'reviewer:replacement-pending',
    reviewerDisplayName: 'مراجع بديل',
    designationSourceRef: 'owner-governance:reviewer-replacement',
    designationArtifactSha256: H64('1'),
    designatedAt: '2026-09-09T22:00:00Z',
    replacesDesignationHashSha256: d.designationHashSha256,
  });
  assert.strictEqual(replacement.status, DESIGNATION_STATUS.REVIEWER_DESIGNATION_ACTIVE);
  assert.strictEqual(replacement.replacesDesignationHashSha256, d.designationHashSha256);

  const replacementPacket = createCanonicalRebaselineIndependentReviewPacket({
    proposal: p,
    ownerDecision: ownerDecision(),
    reviewerDesignation: replacement,
    reviewRequestId: 'review-request-replacement-1',
    requestedAt: '2026-09-09T22:10:00Z',
  });
  assert.strictEqual(replacementPacket.independentReviewerRef, 'reviewer:replacement-pending');
  assert.notStrictEqual(replacementPacket.reviewPacketHashSha256, packet.reviewPacketHashSha256);

  const ownerAsReviewer = createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'bad-self-designation',
    assignedByRef: 'owner:1',
    reviewerRef: 'owner:1',
    reviewerDisplayName: 'المالك',
    designationSourceRef: 'bad',
    designationArtifactSha256: H64('2'),
    designatedAt: '2026-09-09T22:20:00Z',
  });
  assert.strictEqual(ownerAsReviewer.status, DESIGNATION_STATUS.HOLD_REVIEWER_DESIGNATION);

  const tampered = { ...d, reviewerDisplayName: 'tampered' };
  assert.strictEqual(verifyCanonicalRebaselineReviewerDesignation(tampered, { proposal: p, ownerActorRef: 'owner:1' }), false);

  const wrongReviewWithoutDesignation = createCanonicalRebaselineGovernanceDecision({
    proposal: p,
    ownerDecision: ownerDecision(),
    independentReview: normalized.independentReview,
  });
  assert.strictEqual(wrongReviewWithoutDesignation.status, P25_STATUS.HOLD_INDEPENDENT_REVIEW);

  console.log('canonical rebaseline reviewer designation tests: PASS');
})();
