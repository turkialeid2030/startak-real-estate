'use strict';

const crypto = require('crypto');
const {
  STATUS: P25_STATUS,
  DECISION_RESULT,
  createCanonicalRebaselineGovernanceDecision,
} = require('./canonical-rebaseline-governance-decision');

const STATUS = Object.freeze({
  HOLD_REVIEW_HANDOFF: 'HOLD_REVIEW_HANDOFF',
  READY_FOR_INDEPENDENT_REVIEW: 'READY_FOR_INDEPENDENT_REVIEW',
  HOLD_REVIEW_RESPONSE: 'HOLD_REVIEW_RESPONSE',
  REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION: 'REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION',
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

const SHA256_RE = /^[a-f0-9]{64}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function timestamp(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

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

function hold(status, blockers, packet = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    packet,
    reviewerIdentityCryptographicallyVerified: false,
    externalReviewEvidenceAuthenticityVerifiedHere: false,
    automaticBaselineSwitchAllowed: false,
    explicitReviewedCodeChangeRequired: true,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
  });
}

function createCanonicalRebaselineIndependentReviewPacket({
  proposal,
  ownerDecision,
  reviewerDesignation = null,
  reviewRequestId,
  requestedAt,
} = {}) {
  let governance;
  try {
    governance = createCanonicalRebaselineGovernanceDecision({
      proposal,
      ownerDecision,
      independentReview: null,
      reviewerDesignation,
    });
  } catch (error) {
    return hold(STATUS.HOLD_REVIEW_HANDOFF, [error.message]);
  }

  if (governance.status !== P25_STATUS.WAITING_FOR_INDEPENDENT_REVIEW) {
    return hold(STATUS.HOLD_REVIEW_HANDOFF, ['P25_NOT_WAITING_FOR_INDEPENDENT_REVIEW']);
  }

  let requestedAtIso;
  let requestId;
  try {
    requestedAtIso = timestamp(requestedAt, 'requestedAt');
    requestId = requiredString(reviewRequestId, 'reviewRequestId');
  } catch (error) {
    return hold(STATUS.HOLD_REVIEW_HANDOFF, [error.message]);
  }

  const core = {
    schemaVersion: 1,
    reviewRequestId: requestId,
    proposalId: proposal.proposalId,
    proposalHashSha256: proposal.proposalHashSha256,
    qualifiedSourceCommitSha: proposal.qualifiedSourceCommitSha,
    releaseArtifactSha256: proposal.releaseArtifactSha256,
    environmentConfigSha256: proposal.environmentConfigSha256,
    legacyCanonicalSha256: proposal.legacyCanonicalSha256,
    legacyCanonicalAvailability: proposal.legacyCanonicalAvailability,
    ownerActorRef: governance.ownerDecision.actorRef,
    ownerDecisionHashSha256: governance.ownerDecision.decisionHashSha256,
    independentReviewerRef: governance.effectiveIndependentReviewerRef,
    reviewerDesignationHashSha256: governance.reviewerDesignationHashSha256,
    reviewerDisplayName: governance.reviewerDisplayName,
    requestedAt: requestedAtIso,
    reviewChecklist: Object.freeze([
      'CONFIRM_LEGACY_CANONICAL_ORIGINAL_IS_RECORDED_AS_UNAVAILABLE',
      'CONFIRM_NO_CLAIM_THAT_LEGACY_SHA256_WAS_REVERIFIED',
      'CONFIRM_SUCCESSOR_BASELINE_IS_BOUND_TO_EXACT_QUALIFIED_GIT_COMMIT',
      'CONFIRM_RELEASE_ARTIFACT_SHA256_SCOPE',
      'CONFIRM_ENVIRONMENT_CONFIG_SHA256_SCOPE',
      'CONFIRM_OWNER_AND_REVIEWER_SEPARATION',
      'REVIEW_E2I_CANONICAL_EVIDENCE_CONTRACT_IMPACT',
      'CONFIRM_NO_RELEASE_MERGE_DEPLOYMENT_GO_LIVE_OR_TRANSACTION_AUTHORITY_GRANTED',
    ]),
  };

  return deepFreeze({
    ...core,
    status: STATUS.READY_FOR_INDEPENDENT_REVIEW,
    reviewPacketHashSha256: sha256(core),
    expectedResponseContract: Object.freeze({
      fields: Object.freeze([
        'decisionId',
        'actorRef',
        'result',
        'decisionSourceRef',
        'decisionArtifactSha256',
        'decidedAt',
        'rationaleRef',
      ]),
      allowedResults: Object.freeze(Object.values(DECISION_RESULT)),
      actorRefMustEqual: governance.effectiveIndependentReviewerRef,
    }),
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    reviewerIdentityCryptographicallyVerified: false,
    externalReviewEvidenceAuthenticityVerifiedHere: false,
    automaticBaselineSwitchAllowed: false,
    explicitReviewedCodeChangeRequired: true,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
    semantics: 'This packet is an auditable handoff to the currently effective independent reviewer. The owner may replace that reviewer through a new valid designation before an independent review is accepted; doing so requires a newly generated review packet. This packet is not the review itself and grants no release authority.',
  });
}

function createIndependentReviewResponse({
  packet,
  decisionId,
  actorRef,
  result,
  decisionSourceRef,
  decisionArtifactSha256,
  decidedAt,
  rationaleRef,
} = {}) {
  if (!packet || packet.status !== STATUS.READY_FOR_INDEPENDENT_REVIEW || !SHA256_RE.test(packet.reviewPacketHashSha256 || '')) {
    return hold(STATUS.HOLD_REVIEW_RESPONSE, ['INDEPENDENT_REVIEW_PACKET_NOT_QUALIFIED']);
  }

  let response;
  try {
    const normalizedResult = requiredString(result, 'result');
    if (!Object.values(DECISION_RESULT).includes(normalizedResult)) throw new TypeError('result invalid');
    response = {
      decisionId: requiredString(decisionId, 'decisionId'),
      actorRef: requiredString(actorRef, 'actorRef'),
      result: normalizedResult,
      decisionSourceRef: requiredString(decisionSourceRef, 'decisionSourceRef'),
      decisionArtifactSha256: requiredSha256(decisionArtifactSha256, 'decisionArtifactSha256'),
      decidedAt: timestamp(decidedAt, 'decidedAt'),
      rationaleRef: requiredString(rationaleRef, 'rationaleRef'),
    };
  } catch (error) {
    return hold(STATUS.HOLD_REVIEW_RESPONSE, [error.message], packet);
  }

  if (response.actorRef !== packet.independentReviewerRef) {
    return hold(STATUS.HOLD_REVIEW_RESPONSE, ['REVIEW_RESPONSE_ACTOR_MUST_MATCH_ASSIGNED_INDEPENDENT_REVIEWER'], packet);
  }
  if (response.actorRef === packet.ownerActorRef) {
    return hold(STATUS.HOLD_REVIEW_RESPONSE, ['OWNER_AND_INDEPENDENT_REVIEWER_MUST_DIFFER'], packet);
  }

  const responseCore = {
    ...response,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
  };

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    independentReview: deepFreeze({ ...response, decisionHashSha256: sha256(response) }),
    reviewResponseHashSha256: sha256(responseCore),
    reviewerIdentityCryptographicallyVerified: false,
    externalReviewEvidenceAuthenticityVerifiedHere: false,
    p25ReevaluationRequired: true,
    automaticBaselineSwitchAllowed: false,
    explicitReviewedCodeChangeRequired: true,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
    semantics: 'This normalized response can be supplied back to P25 together with the same reviewer designation that produced the packet. It does not by itself prove reviewer identity or evidence authenticity, and does not activate the baseline or grant release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  createCanonicalRebaselineIndependentReviewPacket,
  createIndependentReviewResponse,
};
