'use strict';

const crypto = require('crypto');
const { MODE, stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P46_STATUS } = require('./fresh-reactivation-governance-cycle');

const STATUS = Object.freeze({
  HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF: 'HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF',
  FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED: 'FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PRIOR_REUSE_FIELDS = Object.freeze([
  'reviewerLockHashSha256',
  'reviewerApprovalHashSha256',
  'priorReviewerLockHashSha256',
  'priorReviewerApprovalHashSha256',
  'activationPlanHashSha256',
  'activationAuthorizationHashSha256',
  'signedOwnerAuthorizationVerificationHashSha256',
  'cutoverSafetyGuardHashSha256',
  'activationChangeContractHashSha256',
]);

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
function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}
function privateKeyPresent(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).some((key) => /private[-_]?key/i.test(key)));
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.reactivationAllowed != null && value.reactivationAllowed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_REACTIVATION_REVIEW_HANDOFF,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    reviewPacketReady: false,
    freshReviewerDesignated: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    priorReviewerAuthorityAccepted: false,
    priorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function p46CycleCore(p46) {
  return {
    schemaVersion: p46.schemaVersion,
    cycleId: p46.cycleId,
    ownerActorRef: p46.ownerActorRef,
    preparedAt: p46.preparedAt,
    currentAuthoritativeMode: p46.currentAuthoritativeMode,
    currentRegistryHashSha256: p46.currentRegistryHashSha256,
    requestedTargetMode: p46.requestedTargetMode,
    qualifiedSourceCommitSha: p46.qualifiedSourceCommitSha,
    releaseArtifactSha256: p46.releaseArtifactSha256,
    environmentConfigSha256: p46.environmentConfigSha256,
    cycleRationaleRef: p46.cycleRationaleRef,
    cycleEvidenceArtifactSha256: p46.cycleEvidenceArtifactSha256,
    priorGovernanceResetRecordHashSha256: p46.priorGovernanceResetRecordHashSha256,
    priorHumanDecisionRecordHashSha256: p46.priorHumanDecisionRecordHashSha256,
  };
}

function validateP46FreshCycle(p46) {
  const blockers = [];
  if (!p46 || p46.status !== P46_STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED) {
    return ['P46_FRESH_REACTIVATION_GOVERNANCE_CYCLE_REQUIRED'];
  }
  if (
    p46.verified !== true
    || p46.freshGovernanceCycleOpened !== true
    || p46.currentAuthoritativeMode !== MODE.LEGACY_FILE_SHA256
    || p46.requestedTargetMode !== MODE.GOVERNED_COMPOSITE_BASELINE
    || p46.priorReviewerApprovalAccepted !== false
    || p46.priorActivationAuthorizationAccepted !== false
    || p46.priorActivationPlanAccepted !== false
    || p46.priorActivationContractAccepted !== false
    || p46.freshIndependentReviewerDesignationRequired !== true
    || p46.freshIndependentReviewRequired !== true
    || p46.freshReviewerLifecycleLockRequired !== true
    || p46.freshActivationPlanRequired !== true
    || p46.freshCutoverSafetyEvidenceRequired !== true
    || p46.freshOwnerActivationAuthorizationRequired !== true
    || p46.freshActivationChangeContractRequired !== true
    || p46.reactivationAuthorized !== false
    || p46.currentBaselineMutationPerformed !== false
    || p46.releaseStillBlocked !== true
    || !allAuthorityFalse(p46)
  ) blockers.push('P46_FRESH_CYCLE_BOUNDARY_INVALID');

  try {
    requiredString(p46.cycleId, 'p46.cycleId');
    requiredString(p46.ownerActorRef, 'p46.ownerActorRef');
    iso(p46.preparedAt, 'p46.preparedAt');
    if (!COMMIT_RE.test(requiredString(p46.qualifiedSourceCommitSha, 'p46.qualifiedSourceCommitSha'))) blockers.push('P46_QUALIFIED_SOURCE_COMMIT_INVALID');
    requiredSha256(p46.currentRegistryHashSha256, 'p46.currentRegistryHashSha256');
    requiredSha256(p46.releaseArtifactSha256, 'p46.releaseArtifactSha256');
    requiredSha256(p46.environmentConfigSha256, 'p46.environmentConfigSha256');
    requiredSha256(p46.cycleEvidenceArtifactSha256, 'p46.cycleEvidenceArtifactSha256');
    requiredSha256(p46.priorGovernanceResetRecordHashSha256, 'p46.priorGovernanceResetRecordHashSha256');
    requiredSha256(p46.priorHumanDecisionRecordHashSha256, 'p46.priorHumanDecisionRecordHashSha256');
    const expected = requiredSha256(p46.freshReactivationGovernanceCycleHashSha256, 'p46.freshReactivationGovernanceCycleHashSha256');
    if (sha256Object(p46CycleCore(p46)) !== expected) blockers.push('P46_FRESH_CYCLE_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeFreshReviewerDesignation({ p46, reviewerDesignation } = {}) {
  if (!reviewerDesignation || typeof reviewerDesignation !== 'object' || Array.isArray(reviewerDesignation)) throw new TypeError('reviewerDesignation must be an object');
  if (privateKeyPresent(reviewerDesignation)) throw new TypeError('PRIVATE_SIGNING_KEY_INPUT_REJECTED');
  if (callerAuthorityEscalated(reviewerDesignation)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  for (const field of FORBIDDEN_PRIOR_REUSE_FIELDS) {
    if (reviewerDesignation[field] != null) throw new TypeError(`PRIOR_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${field}`);
  }

  const designatedByRef = requiredString(reviewerDesignation.designatedByRef, 'reviewerDesignation.designatedByRef');
  if (designatedByRef !== p46.ownerActorRef) throw new TypeError('FRESH_REVIEWER_MUST_BE_DESIGNATED_BY_CYCLE_OWNER');
  const reviewerRef = requiredString(reviewerDesignation.reviewerRef, 'reviewerDesignation.reviewerRef');
  if (reviewerRef === p46.ownerActorRef) throw new TypeError('OWNER_AND_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER');
  const designatedAt = iso(reviewerDesignation.designatedAt, 'reviewerDesignation.designatedAt');
  if (Date.parse(designatedAt) < Date.parse(p46.preparedAt)) throw new TypeError('FRESH_REVIEWER_DESIGNATION_PRECEDES_CYCLE_OPENING');

  const core = {
    schemaVersion: 1,
    designationId: requiredString(reviewerDesignation.designationId, 'reviewerDesignation.designationId'),
    cycleId: p46.cycleId,
    freshReactivationGovernanceCycleHashSha256: p46.freshReactivationGovernanceCycleHashSha256,
    designatedByRef,
    reviewerRef,
    reviewerDisplayName: requiredString(reviewerDesignation.reviewerDisplayName, 'reviewerDesignation.reviewerDisplayName'),
    designatedAt,
    designationSourceRef: requiredString(reviewerDesignation.designationSourceRef, 'reviewerDesignation.designationSourceRef'),
    designationArtifactSha256: requiredSha256(reviewerDesignation.designationArtifactSha256, 'reviewerDesignation.designationArtifactSha256'),
  };
  return deepFreeze({ ...core, freshReviewerDesignationHashSha256: sha256Object(core) });
}

function createFreshReactivationIndependentReviewHandoff({
  p46,
  reviewerDesignation,
  reviewRequestId,
  requestedAt,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const p46Blockers = validateP46FreshCycle(p46);
  if (p46Blockers.length > 0) return hold(p46Blockers);

  let designation;
  let requestId;
  let requestedAtIso;
  try {
    designation = normalizeFreshReviewerDesignation({ p46, reviewerDesignation });
    requestId = requiredString(reviewRequestId, 'reviewRequestId');
    requestedAtIso = iso(requestedAt, 'requestedAt');
    if (Date.parse(requestedAtIso) < Date.parse(designation.designatedAt)) throw new TypeError('FRESH_REVIEW_REQUEST_PRECEDES_REVIEWER_DESIGNATION');
  } catch (error) {
    return hold([error.message], { freshReactivationGovernanceCycleHashSha256: p46.freshReactivationGovernanceCycleHashSha256 });
  }

  const reviewChecklist = Object.freeze([
    'CONFIRM_P45_INCIDENT_CLOSURE_IS_VERIFIED_BUT_NOT_RELEASE_AUTHORITY',
    'CONFIRM_FAILED_ACTIVATION_CYCLE_IS_HISTORICAL_AND_NON_REUSABLE',
    'CONFIRM_CURRENT_AUTHORITATIVE_BASELINE_REMAINS_LEGACY_FILE_SHA256',
    'CONFIRM_FRESH_CYCLE_EXACT_GIT_COMMIT_SCOPE',
    'CONFIRM_FRESH_CYCLE_RELEASE_ARTIFACT_SHA256_SCOPE',
    'CONFIRM_FRESH_CYCLE_ENVIRONMENT_CONFIG_SHA256_SCOPE',
    'REVIEW_FRESH_CYCLE_EVIDENCE_AND_REMEDIATION_RATIONALE',
    'CONFIRM_OWNER_AND_INDEPENDENT_REVIEWER_SEPARATION',
    'CONFIRM_NO_PRIOR_REVIEWER_OR_ACTIVATION_AUTHORITY_WAS_CARRIED_FORWARD',
    'CONFIRM_NO_RELEASE_MERGE_DEPLOYMENT_GO_LIVE_OR_TRANSACTION_AUTHORITY_GRANTED',
  ]);

  const core = {
    schemaVersion: 1,
    reviewRequestId: requestId,
    requestedAt: requestedAtIso,
    cycleId: p46.cycleId,
    freshReactivationGovernanceCycleHashSha256: p46.freshReactivationGovernanceCycleHashSha256,
    ownerActorRef: p46.ownerActorRef,
    currentAuthoritativeMode: p46.currentAuthoritativeMode,
    currentRegistryHashSha256: p46.currentRegistryHashSha256,
    requestedTargetMode: p46.requestedTargetMode,
    qualifiedSourceCommitSha: p46.qualifiedSourceCommitSha,
    releaseArtifactSha256: p46.releaseArtifactSha256,
    environmentConfigSha256: p46.environmentConfigSha256,
    cycleEvidenceArtifactSha256: p46.cycleEvidenceArtifactSha256,
    priorGovernanceResetRecordHashSha256: p46.priorGovernanceResetRecordHashSha256,
    freshReviewerDesignationHashSha256: designation.freshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist,
  };

  const reviewPacketHashSha256 = sha256Object(core);
  return deepFreeze({
    ...core,
    status: STATUS.FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: Object.freeze([]),
    freshReviewerDesignation: designation,
    reviewPacketHashSha256,
    reviewPacketReady: true,
    freshReviewerDesignated: true,
    ownerMayReplaceReviewerBeforeVerifiedReview: true,
    replacementRequiresNewDesignationAndReviewPacket: true,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    freshCryptographicReviewAttestationRequired: true,
    freshReviewerLifecycleLockRequired: true,
    priorReviewerAuthorityAccepted: false,
    priorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    expectedReviewDecisionValues: Object.freeze(['APPROVE_FRESH_REACTIVATION_REVIEW', 'REJECT_FRESH_REACTIVATION_REVIEW']),
    ...AUTHORITY,
    semantics: 'P47 creates a cycle-specific independent-review handoff for P46. The reviewer is newly designated for this cycle and remains replaceable until a later cryptographically verified review locks the lifecycle. No prior reviewer or activation authority is accepted and no release or reactivation authority is granted.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  FORBIDDEN_PRIOR_REUSE_FIELDS,
  validateP46FreshCycle,
  normalizeFreshReviewerDesignation,
  createFreshReactivationIndependentReviewHandoff,
};
