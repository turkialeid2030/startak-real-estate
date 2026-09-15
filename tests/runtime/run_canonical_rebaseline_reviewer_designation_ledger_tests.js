'use strict';

const assert = require('assert');
const {
  createCanonicalBaselineReconstitutionProposal,
} = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  createCanonicalRebaselineReviewerDesignation,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation');
const {
  STATUS,
  createCanonicalRebaselineReviewerDesignationLedger,
  getCurrentReviewerDesignation,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation-ledger');
const {
  STATUS: P26_STATUS,
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../../src/qualification/canonical-rebaseline-independent-review');
const {
  DECISION_RESULT,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-ledger-1',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: H64('b'),
    environmentConfigSha256: H64('c'),
    preparedByRef: 'owner:1',
    independentReviewerRef: 'reviewer:placeholder',
    preparedAt: '2026-09-09T18:00:00Z',
  });
}

function ownerDecision() {
  return {
    decisionId: 'owner-1',
    actorRef: 'owner:1',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'owner:direction',
    decisionArtifactSha256: H64('d'),
    decidedAt: '2026-09-09T19:00:00Z',
    rationaleRef: 'governed-rebaseline',
  };
}

function designation(p, id, reviewerRef, reviewerName, at, artifactChar, replaces = null) {
  return createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: id,
    assignedByRef: 'owner:1',
    reviewerRef,
    reviewerDisplayName: reviewerName,
    designationSourceRef: `owner-governance:${id}`,
    designationArtifactSha256: H64(artifactChar),
    designatedAt: at,
    replacesDesignationHashSha256: replaces,
  });
}

(function run() {
  const p = proposal();
  const saeed = designation(p, 'designation-1', 'reviewer:saeed-pending', 'سعيد المراجع', '2026-09-09T20:00:00Z', 'e');
  const first = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [saeed],
  });
  assert.strictEqual(first.status, STATUS.REVIEWER_DESIGNATION_LEDGER_ACTIVE);
  assert.strictEqual(first.currentReviewerRef, 'reviewer:saeed-pending');
  assert.strictEqual(first.currentReviewerDisplayName, 'سعيد المراجع');
  assert.strictEqual(first.entries.length, 1);
  assert.match(first.ledgerHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(first.ownerMayReplaceReviewerBeforeAcceptedReview, true);
  assert.strictEqual(first.releaseAuthorized, false);
  assert.strictEqual(getCurrentReviewerDesignation(first, [saeed]), saeed);

  const replacement = designation(
    p,
    'designation-2',
    'reviewer:future-final',
    'المراجع النهائي',
    '2026-09-09T21:00:00Z',
    'f',
    saeed.designationHashSha256,
  );
  const second = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [saeed, replacement],
  });
  assert.strictEqual(second.status, STATUS.REVIEWER_DESIGNATION_LEDGER_ACTIVE);
  assert.strictEqual(second.currentReviewerRef, 'reviewer:future-final');
  assert.strictEqual(second.entries.length, 2);
  assert.notStrictEqual(second.ledgerHashSha256, first.ledgerHashSha256);
  assert.strictEqual(getCurrentReviewerDesignation(second, [saeed, replacement]), replacement);

  const packet = createCanonicalRebaselineIndependentReviewPacket({
    proposal: p,
    ownerDecision: ownerDecision(),
    reviewerDesignation: replacement,
    reviewRequestId: 'review-request-current',
    requestedAt: '2026-09-09T21:05:00Z',
  });
  assert.strictEqual(packet.status, P26_STATUS.READY_FOR_INDEPENDENT_REVIEW);
  assert.strictEqual(packet.independentReviewerRef, 'reviewer:future-final');
  assert.strictEqual(packet.reviewerDisplayName, 'المراجع النهائي');

  const brokenReplacement = designation(
    p,
    'designation-broken',
    'reviewer:broken',
    'مراجع غير صالح',
    '2026-09-09T22:00:00Z',
    '1',
    H64('9'),
  );
  const broken = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [saeed, brokenReplacement],
  });
  assert.strictEqual(broken.status, STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER);
  assert.ok(broken.blockers.includes('DESIGNATION_CHAIN_BREAK_AT_INDEX_1'));

  const duplicate = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [saeed, saeed],
  });
  assert.strictEqual(duplicate.status, STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER);
  assert.ok(duplicate.blockers.some((item) => item.startsWith('DUPLICATE_DESIGNATION_ID:')));

  const backwardsTime = designation(
    p,
    'designation-3',
    'reviewer:backwards',
    'مراجع بزمن غير صالح',
    '2026-09-09T19:59:59Z',
    '2',
    saeed.designationHashSha256,
  );
  const timeHold = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [saeed, backwardsTime],
  });
  assert.strictEqual(timeHold.status, STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER);
  assert.ok(timeHold.blockers.includes('DESIGNATION_TIME_MUST_INCREASE_AT_INDEX_1'));

  const wrongOwner = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:someone-else',
    designations: [saeed],
  });
  assert.strictEqual(wrongOwner.status, STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER);

  const tampered = { ...saeed, reviewerDisplayName: 'tampered' };
  const tamperHold = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [tampered],
  });
  assert.strictEqual(tamperHold.status, STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER);

  console.log('canonical rebaseline reviewer designation ledger tests: PASS');
})();
