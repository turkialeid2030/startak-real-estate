'use strict';

const crypto = require('crypto');
const {
  STATUS: P24_STATUS,
} = require('./canonical-baseline-reconstitution');

const STATUS = Object.freeze({
  HOLD_REVIEWER_DESIGNATION: 'HOLD_REVIEWER_DESIGNATION',
  REVIEWER_DESIGNATION_ACTIVE: 'REVIEWER_DESIGNATION_ACTIVE',
});

const DEFAULT_REVIEWER = Object.freeze({
  reviewerRef: 'reviewer:saeed-pending',
  reviewerDisplayName: 'سعيد المراجع',
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

function iso(value, field) {
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

function proposalQualified(proposal) {
  return Boolean(
    proposal
    && proposal.status === P24_STATUS.READY_FOR_HUMAN_REBASELINE_GOVERNANCE
    && typeof proposal.proposalHashSha256 === 'string'
    && SHA256_RE.test(proposal.proposalHashSha256)
    && typeof proposal.preparedByRef === 'string'
    && proposal.preparedByRef.trim() !== ''
    && proposal.automaticBaselineSwitchAllowed === false
    && proposal.canonicalBaselineChanged === false
  );
}

function hold(blockers, proposal = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_REVIEWER_DESIGNATION,
    proposalId: proposal?.proposalId || null,
    proposalHashSha256: proposal?.proposalHashSha256 || null,
    blockers: Object.freeze([...blockers]),
    ownerMayDesignateReviewer: true,
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    reviewerIdentityTrustBindingRequiredBeforeAcceptedReview: true,
    designationHashSha256: null,
    ...AUTHORITY,
  });
}

function createCanonicalRebaselineReviewerDesignation({
  proposal,
  designationId,
  assignedByRef,
  reviewerRef = DEFAULT_REVIEWER.reviewerRef,
  reviewerDisplayName = DEFAULT_REVIEWER.reviewerDisplayName,
  designationSourceRef,
  designationArtifactSha256,
  designatedAt,
  replacesDesignationHashSha256 = null,
} = {}) {
  if (!proposalQualified(proposal)) return hold(['P24_REBASELINE_PROPOSAL_NOT_QUALIFIED'], proposal);

  let core;
  try {
    const owner = requiredString(assignedByRef, 'assignedByRef');
    const assignedReviewerRef = requiredString(reviewerRef, 'reviewerRef');
    if (owner !== proposal.preparedByRef) throw new TypeError('REVIEWER_DESIGNATION_MUST_BE_MADE_BY_PROPOSAL_OWNER');
    if (assignedReviewerRef === owner) throw new TypeError('OWNER_AND_INDEPENDENT_REVIEWER_MUST_DIFFER');

    core = {
      schemaVersion: 1,
      designationId: requiredString(designationId, 'designationId'),
      proposalId: proposal.proposalId,
      proposalHashSha256: proposal.proposalHashSha256.toLowerCase(),
      assignedByRef: owner,
      supersedesProposalReviewerRef: requiredString(proposal.independentReviewerRef, 'proposal.independentReviewerRef'),
      reviewerRef: assignedReviewerRef,
      reviewerDisplayName: requiredString(reviewerDisplayName, 'reviewerDisplayName'),
      designationSourceRef: requiredString(designationSourceRef, 'designationSourceRef'),
      designationArtifactSha256: requiredSha256(designationArtifactSha256, 'designationArtifactSha256'),
      designatedAt: iso(designatedAt, 'designatedAt'),
      replacesDesignationHashSha256: replacesDesignationHashSha256 == null
        ? null
        : requiredSha256(replacesDesignationHashSha256, 'replacesDesignationHashSha256'),
    };
  } catch (error) {
    return hold([error.message], proposal);
  }

  return deepFreeze({
    ...core,
    status: STATUS.REVIEWER_DESIGNATION_ACTIVE,
    designationHashSha256: sha256(core),
    blockers: Object.freeze([]),
    ownerMayDesignateReviewer: true,
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    replacementRequiresNewDesignationRecord: true,
    reviewerIdentityCryptographicallyVerifiedHere: false,
    reviewerIdentityTrustBindingRequiredBeforeAcceptedReview: true,
    reviewerDecisionRecorded: false,
    automaticReviewApprovalAllowed: false,
    automaticBaselineSwitchAllowed: false,
    ...AUTHORITY,
    semantics: 'The owner may designate or replace the independent-review workflow assignee before an independent review decision is accepted. This record names the current reviewer candidate only; it is not an independent review, does not cryptographically prove reviewer identity, and grants no release, merge, deployment, go-live or transaction authority.',
  });
}

function verifyCanonicalRebaselineReviewerDesignation(designation, { proposal, ownerActorRef } = {}) {
  if (!designation || designation.status !== STATUS.REVIEWER_DESIGNATION_ACTIVE) return false;
  if (!proposalQualified(proposal)) return false;
  if (designation.proposalId !== proposal.proposalId || designation.proposalHashSha256 !== proposal.proposalHashSha256.toLowerCase()) return false;
  if (designation.assignedByRef !== proposal.preparedByRef || designation.assignedByRef !== ownerActorRef) return false;
  if (designation.reviewerRef === designation.assignedByRef) return false;
  if (designation.supersedesProposalReviewerRef !== proposal.independentReviewerRef) return false;
  if (!SHA256_RE.test(designation.designationArtifactSha256 || '')) return false;
  if (designation.replacesDesignationHashSha256 != null && !SHA256_RE.test(designation.replacesDesignationHashSha256)) return false;

  const core = {
    schemaVersion: 1,
    designationId: designation.designationId,
    proposalId: designation.proposalId,
    proposalHashSha256: designation.proposalHashSha256,
    assignedByRef: designation.assignedByRef,
    supersedesProposalReviewerRef: designation.supersedesProposalReviewerRef,
    reviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    designationSourceRef: designation.designationSourceRef,
    designationArtifactSha256: designation.designationArtifactSha256,
    designatedAt: designation.designatedAt,
    replacesDesignationHashSha256: designation.replacesDesignationHashSha256,
  };
  return sha256(core) === designation.designationHashSha256;
}

module.exports = {
  STATUS,
  DEFAULT_REVIEWER,
  AUTHORITY,
  createCanonicalRebaselineReviewerDesignation,
  verifyCanonicalRebaselineReviewerDesignation,
};
