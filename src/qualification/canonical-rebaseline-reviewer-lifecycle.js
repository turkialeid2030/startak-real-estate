'use strict';

const crypto = require('crypto');
const {
  STATUS: LEDGER_STATUS,
} = require('./canonical-rebaseline-reviewer-designation-ledger');
const {
  STATUS: P26_STATUS,
} = require('./canonical-rebaseline-independent-review');
const {
  STATUS: P27_STATUS,
} = require('./canonical-rebaseline-review-attestation');

const STATUS = Object.freeze({
  HOLD_REVIEWER_LIFECYCLE: 'HOLD_REVIEWER_LIFECYCLE',
  REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW: 'REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW',
  REVIEWER_LOCKED_BY_VERIFIED_REVIEW: 'REVIEWER_LOCKED_BY_VERIFIED_REVIEW',
});

const AUTHORITY = Object.freeze({
  canonicalBaselineChanged: false,
  legacyCanonicalEvidenceClosed: false,
  existingE2iCanonicalEvidenceSatisfied: false,
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hold(blockers, ledger = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_REVIEWER_LIFECYCLE,
    blockers: Object.freeze([...blockers]),
    currentReviewerRef: ledger?.currentReviewerRef || null,
    currentReviewerDisplayName: ledger?.currentReviewerDisplayName || null,
    currentDesignationHashSha256: ledger?.currentDesignationHashSha256 || null,
    ownerMayReplaceReviewerBeforeAcceptedReview: false,
    reviewerReplacementAllowedNow: false,
    reviewerLockHashSha256: null,
    independentReviewCompleted: false,
    ...AUTHORITY,
  });
}

function evaluateCanonicalRebaselineReviewerLifecycle({
  ledger,
  reviewPacket = null,
  verifiedReviewResponse = null,
} = {}) {
  if (!ledger || ledger.status !== LEDGER_STATUS.REVIEWER_DESIGNATION_LEDGER_ACTIVE) {
    return hold(['ACTIVE_REVIEWER_DESIGNATION_LEDGER_REQUIRED'], ledger);
  }

  if (verifiedReviewResponse == null) {
    const core = {
      schemaVersion: 1,
      ledgerHashSha256: ledger.ledgerHashSha256,
      currentDesignationHashSha256: ledger.currentDesignationHashSha256,
      currentReviewerRef: ledger.currentReviewerRef,
      currentReviewerDisplayName: ledger.currentReviewerDisplayName,
    };
    return deepFreeze({
      ...core,
      status: STATUS.REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW,
      lifecycleHashSha256: sha256(core),
      blockers: Object.freeze([]),
      ownerMayReplaceReviewerBeforeAcceptedReview: true,
      reviewerReplacementAllowedNow: true,
      reviewerLockHashSha256: null,
      independentReviewCompleted: false,
      acceptedReviewFreezesReviewerReplacement: true,
      ...AUTHORITY,
      semantics: 'No verified independent-review response is bound to the current reviewer designation. The proposal owner may replace the workflow reviewer by appending a new valid P28/P29 designation before review acceptance.',
    });
  }

  if (!reviewPacket || reviewPacket.status !== P26_STATUS.READY_FOR_INDEPENDENT_REVIEW) {
    return hold(['QUALIFIED_P26_REVIEW_PACKET_REQUIRED_FOR_LOCK'], ledger);
  }
  if (verifiedReviewResponse.status !== P27_STATUS.VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION) {
    return hold(['VERIFIED_P27_REVIEW_RESPONSE_REQUIRED_FOR_LOCK'], ledger);
  }
  if (verifiedReviewResponse.reviewPacketHashSha256 !== reviewPacket.reviewPacketHashSha256) {
    return hold(['VERIFIED_REVIEW_RESPONSE_PACKET_HASH_MISMATCH'], ledger);
  }
  if (reviewPacket.reviewerDesignationHashSha256 !== ledger.currentDesignationHashSha256) {
    return hold(['REVIEW_PACKET_NOT_BOUND_TO_CURRENT_REVIEWER_DESIGNATION'], ledger);
  }
  if (reviewPacket.independentReviewerRef !== ledger.currentReviewerRef) {
    return hold(['REVIEW_PACKET_REVIEWER_NOT_CURRENT'], ledger);
  }
  if (verifiedReviewResponse.reviewerSubjectRef !== ledger.currentReviewerRef) {
    return hold(['VERIFIED_REVIEWER_NOT_CURRENT'], ledger);
  }
  if (
    verifiedReviewResponse.reviewerIdentityCryptographicallyVerified !== true
    || verifiedReviewResponse.reviewerRegistryTrustRootVerified !== true
    || verifiedReviewResponse.reviewAttestationSignatureVerified !== true
  ) {
    return hold(['VERIFIED_REVIEW_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE'], ledger);
  }

  const core = {
    schemaVersion: 1,
    ledgerHashSha256: ledger.ledgerHashSha256,
    currentDesignationHashSha256: ledger.currentDesignationHashSha256,
    currentReviewerRef: ledger.currentReviewerRef,
    currentReviewerDisplayName: ledger.currentReviewerDisplayName,
    reviewRequestId: reviewPacket.reviewRequestId,
    reviewPacketHashSha256: reviewPacket.reviewPacketHashSha256,
    verifiedReviewResponseHashSha256: verifiedReviewResponse.verifiedResponseHashSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.REVIEWER_LOCKED_BY_VERIFIED_REVIEW,
    reviewerLockHashSha256: sha256(core),
    blockers: Object.freeze([]),
    ownerMayReplaceReviewerBeforeAcceptedReview: false,
    reviewerReplacementAllowedNow: false,
    independentReviewCompleted: true,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerRegistryTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    ...AUTHORITY,
    semantics: 'A P27 cryptographically verified review response is bound to the exact P26 packet and the current P29 reviewer designation. Reviewer replacement is therefore frozen for this governance path. This lifecycle lock does not activate the canonical baseline or grant release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  evaluateCanonicalRebaselineReviewerLifecycle,
};
