'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');
const { STATUS: P24_STATUS } = require('./canonical-baseline-reconstitution');
const { STATUS: P25_STATUS } = require('./canonical-rebaseline-governance-decision');
const { STATUS: P30_STATUS } = require('./canonical-rebaseline-reviewer-lifecycle');

const STATUS = Object.freeze({
  HOLD_ACTIVATION_PLAN: 'HOLD_ACTIVATION_PLAN',
  READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN: 'READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN',
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

function hold(blockers, proposal = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_ACTIVATION_PLAN,
    proposalId: proposal?.proposalId || null,
    proposalHashSha256: proposal?.proposalHashSha256 || null,
    blockers: Object.freeze([...blockers]),
    activationPlanHashSha256: null,
    successorBaselineManifestHashSha256: null,
    explicitCodeChangeRequired: true,
    activationApplied: false,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    ...AUTHORITY,
  });
}

function proposalQualified(proposal) {
  return Boolean(
    proposal
    && proposal.status === P24_STATUS.READY_FOR_HUMAN_REBASELINE_GOVERNANCE
    && SHA256_RE.test(proposal.proposalHashSha256 || '')
    && COMMIT_RE.test(proposal.qualifiedSourceCommitSha || '')
    && SHA256_RE.test(proposal.releaseArtifactSha256 || '')
    && SHA256_RE.test(proposal.environmentConfigSha256 || '')
    && proposal.legacyCanonicalSha256 === EXPECTED_CANONICAL_SHA256
    && proposal.legacyCanonicalAvailability === 'UNAVAILABLE'
    && proposal.automaticBaselineSwitchAllowed === false
    && proposal.canonicalBaselineChanged === false
  );
}

function verifyGovernanceDecision(governanceDecision, proposal) {
  if (!governanceDecision || governanceDecision.status !== P25_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE) {
    return 'P25_REBASELINE_GOVERNANCE_APPROVAL_REQUIRED';
  }
  if (governanceDecision.proposalId !== proposal.proposalId || governanceDecision.proposalHashSha256 !== proposal.proposalHashSha256) {
    return 'GOVERNANCE_DECISION_PROPOSAL_MISMATCH';
  }
  if (
    governanceDecision.qualifiedSourceCommitSha !== proposal.qualifiedSourceCommitSha
    || governanceDecision.releaseArtifactSha256 !== proposal.releaseArtifactSha256
    || governanceDecision.environmentConfigSha256 !== proposal.environmentConfigSha256
    || governanceDecision.legacyCanonicalSha256 !== proposal.legacyCanonicalSha256
  ) return 'GOVERNANCE_DECISION_BASELINE_SCOPE_MISMATCH';

  if (!governanceDecision.ownerDecision || !governanceDecision.independentReview) return 'GOVERNANCE_DECISION_DUAL_APPROVAL_REQUIRED';
  if (governanceDecision.ownerDecision.actorRef !== proposal.preparedByRef) return 'GOVERNANCE_OWNER_SCOPE_MISMATCH';
  if (governanceDecision.independentReview.actorRef !== governanceDecision.effectiveIndependentReviewerRef) return 'GOVERNANCE_REVIEWER_SCOPE_MISMATCH';
  if (governanceDecision.ownerDecision.actorRef === governanceDecision.independentReview.actorRef) return 'OWNER_AND_REVIEWER_MUST_DIFFER';

  const core = {
    schemaVersion: 1,
    proposalId: governanceDecision.proposalId,
    proposalHashSha256: governanceDecision.proposalHashSha256,
    qualifiedSourceCommitSha: governanceDecision.qualifiedSourceCommitSha,
    releaseArtifactSha256: governanceDecision.releaseArtifactSha256,
    environmentConfigSha256: governanceDecision.environmentConfigSha256,
    legacyCanonicalSha256: governanceDecision.legacyCanonicalSha256,
    effectiveIndependentReviewerRef: governanceDecision.effectiveIndependentReviewerRef,
    reviewerDesignationHashSha256: governanceDecision.reviewerDesignationHashSha256,
    ownerDecision: governanceDecision.ownerDecision,
    independentReview: governanceDecision.independentReview,
  };
  if (sha256(core) !== governanceDecision.governanceDecisionHashSha256) return 'GOVERNANCE_DECISION_HASH_INVALID';
  return null;
}

function verifyReviewerLifecycle(reviewerLifecycle, governanceDecision) {
  if (!reviewerLifecycle || reviewerLifecycle.status !== P30_STATUS.REVIEWER_LOCKED_BY_VERIFIED_REVIEW) {
    return 'P30_VERIFIED_REVIEWER_LIFECYCLE_LOCK_REQUIRED';
  }
  if (
    reviewerLifecycle.currentReviewerRef !== governanceDecision.effectiveIndependentReviewerRef
    || reviewerLifecycle.currentDesignationHashSha256 !== governanceDecision.reviewerDesignationHashSha256
  ) return 'REVIEWER_LIFECYCLE_GOVERNANCE_MISMATCH';
  if (
    reviewerLifecycle.independentReviewCompleted !== true
    || reviewerLifecycle.reviewerIdentityCryptographicallyVerified !== true
    || reviewerLifecycle.reviewerRegistryTrustRootVerified !== true
    || reviewerLifecycle.reviewAttestationSignatureVerified !== true
  ) return 'REVIEWER_LIFECYCLE_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE';

  const core = {
    schemaVersion: 1,
    ledgerHashSha256: reviewerLifecycle.ledgerHashSha256,
    currentDesignationHashSha256: reviewerLifecycle.currentDesignationHashSha256,
    currentReviewerRef: reviewerLifecycle.currentReviewerRef,
    currentReviewerDisplayName: reviewerLifecycle.currentReviewerDisplayName,
    reviewRequestId: reviewerLifecycle.reviewRequestId,
    reviewPacketHashSha256: reviewerLifecycle.reviewPacketHashSha256,
    verifiedReviewResponseHashSha256: reviewerLifecycle.verifiedReviewResponseHashSha256,
  };
  if (sha256(core) !== reviewerLifecycle.reviewerLockHashSha256) return 'REVIEWER_LIFECYCLE_LOCK_HASH_INVALID';
  return null;
}

function createCanonicalRebaselineActivationPlan({
  proposal,
  governanceDecision,
  reviewerLifecycle,
  activationChangeId,
  preparedByRef,
  preparedAt,
} = {}) {
  if (!proposalQualified(proposal)) return hold(['P24_REBASELINE_PROPOSAL_NOT_QUALIFIED'], proposal);

  const governanceBlocker = verifyGovernanceDecision(governanceDecision, proposal);
  if (governanceBlocker) return hold([governanceBlocker], proposal);

  const lifecycleBlocker = verifyReviewerLifecycle(reviewerLifecycle, governanceDecision);
  if (lifecycleBlocker) return hold([lifecycleBlocker], proposal);

  let changeId;
  let preparer;
  let preparedAtIso;
  try {
    changeId = requiredString(activationChangeId, 'activationChangeId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], proposal);
  }
  if (preparer !== proposal.preparedByRef) return hold(['ACTIVATION_PLAN_MUST_BE_PREPARED_BY_PROPOSAL_OWNER'], proposal);

  const successorBaselineManifest = deepFreeze({
    schemaVersion: 1,
    baselineId: `canonical-rebaseline:${proposal.proposalId}`,
    baselineType: 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT',
    qualifiedSourceCommitSha: requiredCommit(proposal.qualifiedSourceCommitSha, 'proposal.qualifiedSourceCommitSha'),
    releaseArtifactSha256: requiredSha256(proposal.releaseArtifactSha256, 'proposal.releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(proposal.environmentConfigSha256, 'proposal.environmentConfigSha256'),
    supersedesLegacyCanonicalSha256: requiredSha256(proposal.legacyCanonicalSha256, 'proposal.legacyCanonicalSha256'),
    governanceDecisionHashSha256: requiredSha256(governanceDecision.governanceDecisionHashSha256, 'governanceDecision.governanceDecisionHashSha256'),
    reviewerLockHashSha256: requiredSha256(reviewerLifecycle.reviewerLockHashSha256, 'reviewerLifecycle.reviewerLockHashSha256'),
  });
  const successorBaselineManifestHashSha256 = sha256(successorBaselineManifest);

  const core = {
    schemaVersion: 1,
    activationChangeId: changeId,
    proposalId: proposal.proposalId,
    proposalHashSha256: proposal.proposalHashSha256,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    successorBaselineManifest,
    successorBaselineManifestHashSha256,
    targetActivationContract: {
      targetPath: 'config/governance/canonical-baseline.json',
      expectedPriorMode: 'LEGACY_FILE_SHA256',
      proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
      expectedLegacyCanonicalSha256: EXPECTED_CANONICAL_SHA256,
    },
  };

  return deepFreeze({
    ...core,
    status: STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN,
    activationPlanHashSha256: sha256(core),
    blockers: Object.freeze([]),
    explicitCodeChangeRequired: true,
    activationApplied: false,
    automaticBaselineSwitchAllowed: false,
    postChangeReleaseVerifyRequired: true,
    e2iPolicyReviewRequired: true,
    externalReviewerDecisionAlreadyRequired: true,
    ...AUTHORITY,
    semantics: 'This deterministic plan is only the input to a separate explicit reviewed code change that may activate a governed successor canonical baseline after a real independent review. The plan itself does not modify the active baseline, close the historical evidence gap, satisfy E2I evidence, or grant release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  createCanonicalRebaselineActivationPlan,
  stableStringify,
};
