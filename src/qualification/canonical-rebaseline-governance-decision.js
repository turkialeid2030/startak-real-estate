'use strict';

const crypto = require('crypto');
const {
  STATUS: P24_STATUS,
} = require('./canonical-baseline-reconstitution');
const {
  verifyCanonicalRebaselineReviewerDesignation,
} = require('./canonical-rebaseline-reviewer-designation');

const STATUS = Object.freeze({
  HOLD_REBASELINE_PROPOSAL: 'HOLD_REBASELINE_PROPOSAL',
  HOLD_OWNER_DIRECTION: 'HOLD_OWNER_DIRECTION',
  HOLD_INDEPENDENT_REVIEW: 'HOLD_INDEPENDENT_REVIEW',
  WAITING_FOR_INDEPENDENT_REVIEW: 'WAITING_FOR_INDEPENDENT_REVIEW',
  READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE: 'READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE',
});

const DECISION_RESULT = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  HOLD: 'HOLD',
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

function normalizeDecision(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`${label} must be an object`);
  const result = requiredString(record.result, `${label}.result`);
  if (!Object.values(DECISION_RESULT).includes(result)) throw new TypeError(`${label}.result invalid`);
  const normalized = {
    decisionId: requiredString(record.decisionId, `${label}.decisionId`),
    actorRef: requiredString(record.actorRef, `${label}.actorRef`),
    result,
    decisionSourceRef: requiredString(record.decisionSourceRef, `${label}.decisionSourceRef`),
    decisionArtifactSha256: requiredSha256(record.decisionArtifactSha256, `${label}.decisionArtifactSha256`),
    decidedAt: timestamp(record.decidedAt, `${label}.decidedAt`),
    rationaleRef: requiredString(record.rationaleRef, `${label}.rationaleRef`),
  };
  return deepFreeze({ ...normalized, decisionHashSha256: sha256(normalized) });
}

function proposalQualified(proposal) {
  return Boolean(
    proposal
    && proposal.status === P24_STATUS.READY_FOR_HUMAN_REBASELINE_GOVERNANCE
    && typeof proposal.proposalHashSha256 === 'string'
    && SHA256_RE.test(proposal.proposalHashSha256)
    && proposal.automaticBaselineSwitchAllowed === false
    && proposal.canonicalBaselineChanged === false
    && proposal.legacyCanonicalEvidenceClosed === false
    && proposal.existingE2iCanonicalEvidenceSatisfied === false
  );
}

function resolveReviewer(proposal, ownerActorRef, reviewerDesignation) {
  if (reviewerDesignation == null) {
    return {
      reviewerRef: proposal.independentReviewerRef,
      reviewerDesignationHashSha256: null,
      reviewerDisplayName: null,
    };
  }
  const valid = verifyCanonicalRebaselineReviewerDesignation(reviewerDesignation, {
    proposal,
    ownerActorRef,
  });
  if (!valid) throw new TypeError('REVIEWER_DESIGNATION_INVALID');
  return {
    reviewerRef: reviewerDesignation.reviewerRef,
    reviewerDesignationHashSha256: reviewerDesignation.designationHashSha256,
    reviewerDisplayName: reviewerDesignation.reviewerDisplayName,
  };
}

function hold(status, proposal, blockers, ownerDecision = null, independentReview = null, reviewer = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    proposalId: proposal?.proposalId || null,
    proposalHashSha256: proposal?.proposalHashSha256 || null,
    blockers: Object.freeze([...blockers]),
    ownerDecision,
    independentReview,
    effectiveIndependentReviewerRef: reviewer?.reviewerRef || proposal?.independentReviewerRef || null,
    reviewerDesignationHashSha256: reviewer?.reviewerDesignationHashSha256 || null,
    reviewerDisplayName: reviewer?.reviewerDisplayName || null,
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    automaticBaselineSwitchAllowed: false,
    explicitReviewedCodeChangeRequired: true,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
  });
}

function createCanonicalRebaselineGovernanceDecision({
  proposal,
  ownerDecision,
  independentReview,
  reviewerDesignation = null,
} = {}) {
  if (!proposalQualified(proposal)) {
    return hold(STATUS.HOLD_REBASELINE_PROPOSAL, proposal, ['P24_REBASELINE_PROPOSAL_NOT_QUALIFIED']);
  }

  let owner;
  try {
    owner = normalizeDecision(ownerDecision, 'ownerDecision');
  } catch (error) {
    return hold(STATUS.HOLD_OWNER_DIRECTION, proposal, [error.message]);
  }

  if (owner.actorRef !== proposal.preparedByRef) {
    return hold(STATUS.HOLD_OWNER_DIRECTION, proposal, ['OWNER_DECISION_ACTOR_MUST_MATCH_PROPOSAL_PREPARER'], owner);
  }
  if (owner.result !== DECISION_RESULT.APPROVE) {
    return hold(STATUS.HOLD_OWNER_DIRECTION, proposal, [`OWNER_DIRECTION_${owner.result}`], owner);
  }

  let reviewer;
  try {
    reviewer = resolveReviewer(proposal, owner.actorRef, reviewerDesignation);
  } catch (error) {
    return hold(STATUS.HOLD_INDEPENDENT_REVIEW, proposal, [error.message], owner);
  }

  if (independentReview == null) {
    return hold(STATUS.WAITING_FOR_INDEPENDENT_REVIEW, proposal, ['INDEPENDENT_REVIEW_REQUIRED'], owner, null, reviewer);
  }

  let review;
  try {
    review = normalizeDecision(independentReview, 'independentReview');
  } catch (error) {
    return hold(STATUS.HOLD_INDEPENDENT_REVIEW, proposal, [error.message], owner, null, reviewer);
  }

  if (review.actorRef !== reviewer.reviewerRef) {
    return hold(STATUS.HOLD_INDEPENDENT_REVIEW, proposal, ['INDEPENDENT_REVIEW_ACTOR_MUST_MATCH_EFFECTIVE_REVIEWER'], owner, review, reviewer);
  }
  if (review.actorRef === owner.actorRef) {
    return hold(STATUS.HOLD_INDEPENDENT_REVIEW, proposal, ['OWNER_AND_INDEPENDENT_REVIEWER_MUST_DIFFER'], owner, review, reviewer);
  }
  if (review.result !== DECISION_RESULT.APPROVE) {
    return hold(STATUS.HOLD_INDEPENDENT_REVIEW, proposal, [`INDEPENDENT_REVIEW_${review.result}`], owner, review, reviewer);
  }

  const core = {
    schemaVersion: 1,
    proposalId: proposal.proposalId,
    proposalHashSha256: proposal.proposalHashSha256,
    qualifiedSourceCommitSha: proposal.qualifiedSourceCommitSha,
    releaseArtifactSha256: proposal.releaseArtifactSha256,
    environmentConfigSha256: proposal.environmentConfigSha256,
    legacyCanonicalSha256: proposal.legacyCanonicalSha256,
    effectiveIndependentReviewerRef: reviewer.reviewerRef,
    reviewerDesignationHashSha256: reviewer.reviewerDesignationHashSha256,
    ownerDecision: owner,
    independentReview: review,
  };

  return deepFreeze({
    ...core,
    status: STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE,
    governanceDecisionHashSha256: sha256(core),
    blockers: Object.freeze([]),
    reviewerDisplayName: reviewer.reviewerDisplayName,
    ownerMayReplaceReviewerBeforeAcceptedReview: false,
    automaticBaselineSwitchAllowed: false,
    explicitReviewedCodeChangeRequired: true,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
    semantics: 'Owner direction plus an approved review from the currently effective independent reviewer may make the re-baseline proposal eligible for a separate explicit reviewed code change. An owner reviewer-designation record may replace the original proposal reviewer before review acceptance, but this decision object never changes the canonical baseline or grants release authority.',
  });
}

module.exports = {
  STATUS,
  DECISION_RESULT,
  AUTHORITY,
  createCanonicalRebaselineGovernanceDecision,
};
