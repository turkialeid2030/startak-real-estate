'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');

const STATUS = Object.freeze({
  LEGACY_CANONICAL_SOURCE_UNAVAILABLE_REBASELINE_REQUIRED: 'LEGACY_CANONICAL_SOURCE_UNAVAILABLE_REBASELINE_REQUIRED',
  READY_FOR_HUMAN_REBASELINE_GOVERNANCE: 'READY_FOR_HUMAN_REBASELINE_GOVERNANCE',
});

const AUTHORITY = Object.freeze({
  legacyCanonicalEvidenceClosed: false,
  canonicalBaselineChanged: false,
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function requiredCommit(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return normalized;
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

function createCanonicalBaselineReconstitutionProposal({
  proposalId,
  qualifiedSourceCommitSha,
  releaseArtifactSha256,
  environmentConfigSha256,
  preparedByRef,
  independentReviewerRef,
  rationaleCode = 'LEGACY_CANONICAL_ORIGINAL_NOT_AVAILABLE_TO_OWNER',
  preparedAt,
} = {}) {
  const proposer = requiredString(preparedByRef, 'preparedByRef');
  const reviewer = requiredString(independentReviewerRef, 'independentReviewerRef');
  if (proposer === reviewer) throw new TypeError('REBASELINE_PROPOSER_REVIEWER_SEPARATION_REQUIRED');

  const timestamp = new Date(requiredString(preparedAt, 'preparedAt'));
  if (Number.isNaN(timestamp.getTime())) throw new TypeError('preparedAt must be a valid date/time');

  const core = {
    schemaVersion: 1,
    proposalId: requiredString(proposalId, 'proposalId'),
    legacyCanonicalSha256: EXPECTED_CANONICAL_SHA256,
    legacyCanonicalAvailability: 'UNAVAILABLE',
    rationaleCode: requiredString(rationaleCode, 'rationaleCode'),
    proposedBaselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: requiredCommit(qualifiedSourceCommitSha, 'qualifiedSourceCommitSha'),
    releaseArtifactSha256: requiredSha256(releaseArtifactSha256, 'releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(environmentConfigSha256, 'environmentConfigSha256'),
    preparedByRef: proposer,
    independentReviewerRef: reviewer,
    preparedAt: timestamp.toISOString(),
  };

  return deepFreeze({
    ...core,
    status: STATUS.READY_FOR_HUMAN_REBASELINE_GOVERNANCE,
    proposalHashSha256: sha256(core),
    requiredHumanActions: Object.freeze([
      'AUTHORITATIVE_OWNER_APPROVAL',
      'INDEPENDENT_REVIEW_APPROVAL',
      'GOVERNANCE_DECISION_TO_SUPERSEDE_LEGACY_FILE_HASH_BASELINE',
      'EXPLICIT_CODE_CHANGE_TO_ACTIVATE_NEW_BASELINE',
      'POST_CHANGE_RELEASE_VERIFY',
    ]),
    automaticBaselineSwitchAllowed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
    semantics: 'The historical canonical original is unavailable. This object is only a re-baseline proposal bound to an exact qualified Git commit, release artifact digest and environment-config digest. It does not prove the legacy file hash, change the active canonical baseline, satisfy E2I canonical-source evidence, or grant release authority. A separate human governance decision and explicit reviewed code change are required before any new canonical baseline becomes active.',
  });
}

function createLegacyCanonicalUnavailableHold({ reason = 'OWNER_DOES_NOT_POSSESS_CANONICAL_ORIGINAL' } = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.LEGACY_CANONICAL_SOURCE_UNAVAILABLE_REBASELINE_REQUIRED,
    reason,
    legacyCanonicalSha256: EXPECTED_CANONICAL_SHA256,
    legacyCanonicalEvidenceClosed: false,
    canonicalBaselineChanged: false,
    rebaselineGovernanceRequired: true,
    ...AUTHORITY,
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  createCanonicalBaselineReconstitutionProposal,
  createLegacyCanonicalUnavailableHold,
};
