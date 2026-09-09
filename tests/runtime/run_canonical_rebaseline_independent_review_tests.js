'use strict';

const assert = require('assert');
const {
  createCanonicalBaselineReconstitutionProposal,
} = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  DECISION_RESULT,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  STATUS,
  createCanonicalRebaselineIndependentReviewPacket,
  createIndependentReviewResponse,
} = require('../../src/qualification/canonical-rebaseline-independent-review');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-1',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: H64('b'),
    environmentConfigSha256: H64('c'),
    preparedByRef: 'owner:1',
    independentReviewerRef: 'reviewer:2',
    preparedAt: '2026-09-09T18:00:00Z',
  });
}

function ownerDecision() {
  return {
    decisionId: 'owner-decision-1',
    actorRef: 'owner:1',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'issue:250#owner-approval',
    decisionArtifactSha256: H64('d'),
    decidedAt: '2026-09-09T19:00:00Z',
    rationaleRef: 'governed-rebaseline-approved',
  };
}

function packet() {
  return createCanonicalRebaselineIndependentReviewPacket({
    proposal: proposal(),
    ownerDecision: ownerDecision(),
    reviewRequestId: 'review-request-1',
    requestedAt: '2026-09-09T19:30:00Z',
  });
}

(function run() {
  const good = packet();
  assert.strictEqual(good.status, STATUS.READY_FOR_INDEPENDENT_REVIEW);
  assert.strictEqual(good.independentReviewerRef, 'reviewer:2');
  assert.strictEqual(good.ownerActorRef, 'owner:1');
  assert.strictEqual(good.reviewChecklist.length, 8);
  assert.match(good.reviewPacketHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(good.canonicalBaselineChanged, false);
  assert.strictEqual(good.releaseAuthorized, false);
  assert.strictEqual(Object.isFrozen(good), true);
  assert.strictEqual(Object.isFrozen(good.reviewChecklist), true);

  const repeat = packet();
  assert.strictEqual(repeat.reviewPacketHashSha256, good.reviewPacketHashSha256);

  const badOwner = { ...ownerDecision(), actorRef: 'someone-else' };
  const holdOwner = createCanonicalRebaselineIndependentReviewPacket({
    proposal: proposal(),
    ownerDecision: badOwner,
    reviewRequestId: 'review-request-2',
    requestedAt: '2026-09-09T19:30:00Z',
  });
  assert.strictEqual(holdOwner.status, STATUS.HOLD_REVIEW_HANDOFF);

  const invalidRequest = createCanonicalRebaselineIndependentReviewPacket({
    proposal: proposal(),
    ownerDecision: ownerDecision(),
    reviewRequestId: '',
    requestedAt: '2026-09-09T19:30:00Z',
  });
  assert.strictEqual(invalidRequest.status, STATUS.HOLD_REVIEW_HANDOFF);

  const response = createIndependentReviewResponse({
    packet: good,
    decisionId: 'review-decision-1',
    actorRef: 'reviewer:2',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:1',
    decisionArtifactSha256: H64('e'),
    decidedAt: '2026-09-09T20:00:00Z',
    rationaleRef: 'proposal-reviewed-and-approved',
  });
  assert.strictEqual(response.status, STATUS.REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION);
  assert.strictEqual(response.independentReview.actorRef, 'reviewer:2');
  assert.strictEqual(response.independentReview.result, DECISION_RESULT.APPROVE);
  assert.strictEqual(response.reviewerIdentityCryptographicallyVerified, false);
  assert.strictEqual(response.externalReviewEvidenceAuthenticityVerifiedHere, false);
  assert.strictEqual(response.p25ReevaluationRequired, true);
  assert.strictEqual(response.canonicalBaselineChanged, false);
  assert.strictEqual(response.mergeAuthorized, false);
  assert.match(response.reviewResponseHashSha256, /^[a-f0-9]{64}$/);

  const wrongReviewer = createIndependentReviewResponse({
    packet: good,
    decisionId: 'review-decision-2',
    actorRef: 'intruder:3',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:2',
    decisionArtifactSha256: H64('f'),
    decidedAt: '2026-09-09T20:00:00Z',
    rationaleRef: 'wrong reviewer',
  });
  assert.strictEqual(wrongReviewer.status, STATUS.HOLD_REVIEW_RESPONSE);

  const ownerAsReviewer = createIndependentReviewResponse({
    packet: { ...good, independentReviewerRef: 'owner:1' },
    decisionId: 'review-decision-3',
    actorRef: 'owner:1',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:3',
    decisionArtifactSha256: H64('1'),
    decidedAt: '2026-09-09T20:00:00Z',
    rationaleRef: 'not independent',
  });
  assert.strictEqual(ownerAsReviewer.status, STATUS.HOLD_REVIEW_RESPONSE);

  const badDigest = createIndependentReviewResponse({
    packet: good,
    decisionId: 'review-decision-4',
    actorRef: 'reviewer:2',
    result: DECISION_RESULT.HOLD,
    decisionSourceRef: 'external-review:4',
    decisionArtifactSha256: 'not-a-digest',
    decidedAt: '2026-09-09T20:00:00Z',
    rationaleRef: 'needs changes',
  });
  assert.strictEqual(badDigest.status, STATUS.HOLD_REVIEW_RESPONSE);

  console.log('canonical rebaseline independent review tests: PASS');
})();
