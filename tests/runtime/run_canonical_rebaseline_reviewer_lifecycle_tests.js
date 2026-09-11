'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createCanonicalBaselineReconstitutionProposal } = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  DECISION_RESULT,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  createCanonicalRebaselineReviewerDesignation,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation');
const {
  createCanonicalRebaselineReviewerDesignationLedger,
} = require('../../src/qualification/canonical-rebaseline-reviewer-designation-ledger');
const {
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../../src/qualification/canonical-rebaseline-independent-review');
const {
  normalizeRegistry,
  createIndependentReviewSigningPayload,
  createVerifiedIndependentReviewResponse,
  stableStringify,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');
const {
  STATUS,
  evaluateCanonicalRebaselineReviewerLifecycle,
} = require('../../src/qualification/canonical-rebaseline-reviewer-lifecycle');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
const publicKeySha256 = crypto.createHash('sha256').update(publicKeyPem, 'utf8').digest('hex');

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-lifecycle-1',
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

(function run() {
  const p = proposal();
  const designation = createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'designation-saeed-1',
    assignedByRef: 'owner:1',
    reviewerRef: 'reviewer:saeed-pending',
    reviewerDisplayName: 'سعيد المراجع',
    designationSourceRef: 'owner-governance:saeed',
    designationArtifactSha256: H64('e'),
    designatedAt: '2026-09-09T20:00:00Z',
  });
  const ledger = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [designation],
  });

  const mutable = evaluateCanonicalRebaselineReviewerLifecycle({ ledger });
  assert.strictEqual(mutable.status, STATUS.REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW);
  assert.strictEqual(mutable.ownerMayReplaceReviewerBeforeAcceptedReview, true);
  assert.strictEqual(mutable.reviewerReplacementAllowedNow, true);
  assert.strictEqual(mutable.currentReviewerRef, 'reviewer:saeed-pending');
  assert.strictEqual(mutable.releaseAuthorized, false);

  const packet = createCanonicalRebaselineIndependentReviewPacket({
    proposal: p,
    ownerDecision: ownerDecision(),
    reviewerDesignation: designation,
    reviewRequestId: 'review-request-saeed-lock',
    requestedAt: '2026-09-09T20:10:00Z',
  });

  const registry = {
    registryId: 'reviewer-registry-saeed-v1',
    governanceArtifactSha256: H64('f'),
    reviewers: [{
      reviewerId: 'saeed-reviewer-id',
      reviewerSubjectRef: 'reviewer:saeed-pending',
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: 'governance:saeed-reviewer',
      activeFrom: '2026-09-01T00:00:00Z',
      activeUntil: '2026-12-31T23:59:59Z',
      allowedPurpose: 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW',
    }],
  };
  const registryNormalized = normalizeRegistry(registry);
  const unsigned = {
    decisionId: 'saeed-review-decision-1',
    reviewerId: 'saeed-reviewer-id',
    actorRef: 'reviewer:saeed-pending',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:saeed',
    decisionArtifactSha256: H64('1'),
    decidedAt: '2026-09-09T21:00:00Z',
    rationaleRef: 'reviewed-and-approved',
    signatureAlgorithm: 'RSA-SHA256',
  };
  const payload = createIndependentReviewSigningPayload({ packet, attestation: unsigned });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  const verified = createVerifiedIndependentReviewResponse({
    packet,
    reviewerRegistry: registry,
    expectedReviewerRegistryHashSha256: registryNormalized.registryHashSha256,
    attestation: { ...unsigned, signatureBase64 },
  });

  const locked = evaluateCanonicalRebaselineReviewerLifecycle({
    ledger,
    reviewPacket: packet,
    verifiedReviewResponse: verified,
  });
  assert.strictEqual(locked.status, STATUS.REVIEWER_LOCKED_BY_VERIFIED_REVIEW);
  assert.strictEqual(locked.ownerMayReplaceReviewerBeforeAcceptedReview, false);
  assert.strictEqual(locked.reviewerReplacementAllowedNow, false);
  assert.strictEqual(locked.independentReviewCompleted, true);
  assert.strictEqual(locked.reviewerIdentityCryptographicallyVerified, true);
  assert.match(locked.reviewerLockHashSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(locked.canonicalBaselineChanged, false);
  assert.strictEqual(locked.releaseAuthorized, false);

  const replacement = createCanonicalRebaselineReviewerDesignation({
    proposal: p,
    designationId: 'designation-replacement',
    assignedByRef: 'owner:1',
    reviewerRef: 'reviewer:replacement',
    reviewerDisplayName: 'مراجع بديل',
    designationSourceRef: 'owner-governance:replacement',
    designationArtifactSha256: H64('2'),
    designatedAt: '2026-09-09T22:00:00Z',
    replacesDesignationHashSha256: designation.designationHashSha256,
  });
  const replacementLedger = createCanonicalRebaselineReviewerDesignationLedger({
    proposal: p,
    ownerActorRef: 'owner:1',
    designations: [designation, replacement],
  });
  const stalePacketLock = evaluateCanonicalRebaselineReviewerLifecycle({
    ledger: replacementLedger,
    reviewPacket: packet,
    verifiedReviewResponse: verified,
  });
  assert.strictEqual(stalePacketLock.status, STATUS.HOLD_REVIEWER_LIFECYCLE);
  assert.ok(stalePacketLock.blockers.includes('REVIEW_PACKET_NOT_BOUND_TO_CURRENT_REVIEWER_DESIGNATION'));

  const mismatchedResponse = { ...verified, reviewPacketHashSha256: H64('3') };
  const responseHold = evaluateCanonicalRebaselineReviewerLifecycle({
    ledger,
    reviewPacket: packet,
    verifiedReviewResponse: mismatchedResponse,
  });
  assert.strictEqual(responseHold.status, STATUS.HOLD_REVIEWER_LIFECYCLE);
  assert.ok(responseHold.blockers.includes('VERIFIED_REVIEW_RESPONSE_PACKET_HASH_MISMATCH'));

  const noPacket = evaluateCanonicalRebaselineReviewerLifecycle({
    ledger,
    verifiedReviewResponse: verified,
  });
  assert.strictEqual(noPacket.status, STATUS.HOLD_REVIEWER_LIFECYCLE);

  console.log('canonical rebaseline reviewer lifecycle tests: PASS');
})();
