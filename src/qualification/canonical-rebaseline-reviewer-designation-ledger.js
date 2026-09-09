'use strict';

const crypto = require('crypto');
const {
  verifyCanonicalRebaselineReviewerDesignation,
} = require('./canonical-rebaseline-reviewer-designation');

const STATUS = Object.freeze({
  HOLD_REVIEWER_DESIGNATION_LEDGER: 'HOLD_REVIEWER_DESIGNATION_LEDGER',
  REVIEWER_DESIGNATION_LEDGER_ACTIVE: 'REVIEWER_DESIGNATION_LEDGER_ACTIVE',
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

function hold(blockers, proposal = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_REVIEWER_DESIGNATION_LEDGER,
    proposalId: proposal?.proposalId || null,
    proposalHashSha256: proposal?.proposalHashSha256 || null,
    blockers: Object.freeze([...blockers]),
    entries: Object.freeze([]),
    currentDesignationHashSha256: null,
    currentReviewerRef: null,
    currentReviewerDisplayName: null,
    ledgerHashSha256: null,
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    independentReviewCompleted: false,
    ...AUTHORITY,
  });
}

function normalizeEntry(designation) {
  return deepFreeze({
    designationId: designation.designationId,
    designationHashSha256: designation.designationHashSha256,
    reviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    assignedByRef: designation.assignedByRef,
    designatedAt: designation.designatedAt,
    replacesDesignationHashSha256: designation.replacesDesignationHashSha256,
    designationSourceRef: designation.designationSourceRef,
    designationArtifactSha256: designation.designationArtifactSha256,
  });
}

function createCanonicalRebaselineReviewerDesignationLedger({
  proposal,
  ownerActorRef,
  designations,
} = {}) {
  if (!proposal || typeof proposal !== 'object') return hold(['PROPOSAL_REQUIRED']);
  if (typeof ownerActorRef !== 'string' || ownerActorRef.trim() === '') return hold(['OWNER_ACTOR_REF_REQUIRED'], proposal);
  if (!Array.isArray(designations) || designations.length === 0) return hold(['AT_LEAST_ONE_REVIEWER_DESIGNATION_REQUIRED'], proposal);

  const owner = ownerActorRef.trim();
  const seenIds = new Set();
  const seenHashes = new Set();
  const entries = [];
  let previous = null;

  for (let index = 0; index < designations.length; index += 1) {
    const designation = designations[index];
    if (!verifyCanonicalRebaselineReviewerDesignation(designation, { proposal, ownerActorRef: owner })) {
      return hold([`REVIEWER_DESIGNATION_INVALID_AT_INDEX_${index}`], proposal);
    }
    if (seenIds.has(designation.designationId)) return hold([`DUPLICATE_DESIGNATION_ID:${designation.designationId}`], proposal);
    if (seenHashes.has(designation.designationHashSha256)) return hold([`DUPLICATE_DESIGNATION_HASH:${designation.designationHashSha256}`], proposal);
    seenIds.add(designation.designationId);
    seenHashes.add(designation.designationHashSha256);

    if (!SHA256_RE.test(designation.designationHashSha256 || '')) {
      return hold([`INVALID_DESIGNATION_HASH_AT_INDEX_${index}`], proposal);
    }

    if (index === 0) {
      if (designation.replacesDesignationHashSha256 != null) {
        return hold(['FIRST_DESIGNATION_MUST_NOT_REPLACE_PRIOR_DESIGNATION'], proposal);
      }
    } else {
      if (designation.replacesDesignationHashSha256 !== previous.designationHashSha256) {
        return hold([`DESIGNATION_CHAIN_BREAK_AT_INDEX_${index}`], proposal);
      }
      if (Date.parse(designation.designatedAt) <= Date.parse(previous.designatedAt)) {
        return hold([`DESIGNATION_TIME_MUST_INCREASE_AT_INDEX_${index}`], proposal);
      }
    }

    const entry = normalizeEntry(designation);
    entries.push(entry);
    previous = designation;
  }

  const current = entries[entries.length - 1];
  const core = {
    schemaVersion: 1,
    proposalId: proposal.proposalId,
    proposalHashSha256: proposal.proposalHashSha256,
    ownerActorRef: owner,
    orderedDesignationHashes: entries.map((entry) => entry.designationHashSha256),
    currentDesignationHashSha256: current.designationHashSha256,
    currentReviewerRef: current.reviewerRef,
    currentReviewerDisplayName: current.reviewerDisplayName,
  };

  return deepFreeze({
    ...core,
    status: STATUS.REVIEWER_DESIGNATION_LEDGER_ACTIVE,
    entries: Object.freeze(entries),
    ledgerHashSha256: sha256(core),
    blockers: Object.freeze([]),
    ownerMayReplaceReviewerBeforeAcceptedReview: true,
    replacementRequiresNewDesignationRecord: true,
    replacementMustReferenceCurrentDesignationHash: true,
    currentReviewerIdentityCryptographicallyVerifiedHere: false,
    independentReviewCompleted: false,
    acceptedReviewFreezesReviewerReplacement: true,
    ...AUTHORITY,
    semantics: 'This append-only ledger preserves reviewer-designation history and identifies the current workflow reviewer. The owner may append a replacement designation before an independent review is accepted. The ledger does not constitute a review, verify reviewer identity, activate the canonical baseline, or grant release authority.',
  });
}

function getCurrentReviewerDesignation(ledger, designations) {
  if (!ledger || ledger.status !== STATUS.REVIEWER_DESIGNATION_LEDGER_ACTIVE) return null;
  if (!Array.isArray(designations)) return null;
  return designations.find((designation) => designation.designationHashSha256 === ledger.currentDesignationHashSha256) || null;
}

module.exports = {
  STATUS,
  AUTHORITY,
  createCanonicalRebaselineReviewerDesignationLedger,
  getCurrentReviewerDesignation,
};
