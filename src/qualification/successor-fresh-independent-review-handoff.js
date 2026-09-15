'use strict';

const crypto = require('crypto');
const { MODE, AUTHORITY, stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P64_STATUS } = require('./successor-fresh-reactivation-governance-cycle');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_REVIEW_HANDOFF: 'HOLD_SUCCESSOR_FRESH_REVIEW_HANDOFF',
  SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED: 'SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PREDECESSOR_REUSE_FIELDS = Object.freeze([
  'predecessorReviewerRef',
  'predecessorReviewerDesignationHashSha256',
  'freshReviewerDesignationHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'verifiedFreshReviewRecordHashSha256',
  'freshActivationPlanHashSha256',
  'freshCutoverSafetyGuardHashSha256',
  'verifiedFreshOwnerAuthorizationRecordHashSha256',
  'freshActivationChangeContractHashSha256',
  'activationExecutionReceiptHashSha256',
  'rollbackTriggerHashSha256',
  'rollbackExecutionReceiptHashSha256',
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
function requiredCommit(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character Git commit SHA`);
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
function findForbiddenKeyMaterial(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key)) return `${path}.${key}`;
    const nested = findForbiddenKeyMaterial(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
}
function findForbiddenReuse(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PREDECESSOR_REUSE_FIELDS.includes(key) && child != null) return `${path}.${key}`;
    const nested = findForbiddenReuse(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false)
    || (value.independentReviewAccepted != null && value.independentReviewAccepted !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_HANDOFF,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    reviewPacketReady: false,
    successorFreshReviewerDesignated: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function p64CycleCore(p64) {
  return {
    schemaVersion: p64.schemaVersion,
    cycleKind: p64.cycleKind,
    cycleId: p64.cycleId,
    ownerActorRef: p64.ownerActorRef,
    preparedAt: p64.preparedAt,
    currentAuthoritativeMode: p64.currentAuthoritativeMode,
    currentRegistryHashSha256: p64.currentRegistryHashSha256,
    currentRegistryContentSha256: p64.currentRegistryContentSha256,
    requestedTargetMode: p64.requestedTargetMode,
    qualifiedSourceCommitSha: p64.qualifiedSourceCommitSha,
    releaseArtifactSha256: p64.releaseArtifactSha256,
    environmentConfigSha256: p64.environmentConfigSha256,
    cycleRationaleRef: p64.cycleRationaleRef,
    cycleEvidenceArtifactSha256: p64.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: p64.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: p64.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: p64.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: p64.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: p64.predecessorCorrectivePreventiveActionSha256,
  };
}

function validateP64SuccessorCycle(p64) {
  const blockers = [];
  if (!p64 || p64.status !== P64_STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED) return ['P64_SUCCESSOR_FRESH_GOVERNANCE_CYCLE_REQUIRED'];
  if (
    p64.verified !== true
    || p64.successorFreshGovernanceCycleOpened !== true
    || p64.predecessorP63Reverified !== true
    || p64.predecessorFailedFreshCycleHistoricalOnly !== true
    || p64.predecessorFreshReviewerArtifactsAccepted !== false
    || p64.predecessorFreshOwnerAuthorizationAccepted !== false
    || p64.predecessorFreshActivationPlanAccepted !== false
    || p64.predecessorFreshActivationContractAccepted !== false
    || p64.predecessorFreshRollbackEvidenceAcceptedAsAuthority !== false
    || p64.currentAuthoritativeMode !== MODE.LEGACY_FILE_SHA256
    || p64.requestedTargetMode !== MODE.GOVERNED_COMPOSITE_BASELINE
    || p64.freshIndependentReviewerDesignationRequired !== true
    || p64.freshIndependentReviewRequired !== true
    || p64.freshReviewerLifecycleLockRequired !== true
    || p64.freshActivationPlanRequired !== true
    || p64.freshShadowEvidenceRequired !== true
    || p64.freshCutoverRehearsalRequired !== true
    || p64.freshCutoverSafetyEvidenceRequired !== true
    || p64.freshOwnerActivationAuthorizationRequired !== true
    || p64.freshActivationChangeContractRequired !== true
    || p64.reactivationAuthorized !== false
    || p64.currentBaselineMutationPerformed !== false
    || p64.releaseStillBlocked !== true
    || !allAuthorityFalse(p64)
  ) blockers.push('P64_SUCCESSOR_FRESH_CYCLE_BOUNDARY_INVALID');
  try {
    requiredString(p64.cycleId, 'p64.cycleId');
    requiredString(p64.ownerActorRef, 'p64.ownerActorRef');
    iso(p64.preparedAt, 'p64.preparedAt');
    requiredCommit(p64.qualifiedSourceCommitSha, 'p64.qualifiedSourceCommitSha');
    for (const field of [
      'currentRegistryHashSha256', 'currentRegistryContentSha256', 'releaseArtifactSha256', 'environmentConfigSha256',
      'cycleEvidenceArtifactSha256', 'predecessorIncidentCloseoutPacketHashSha256', 'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256', 'predecessorRootCauseAnalysisSha256', 'predecessorCorrectivePreventiveActionSha256',
    ]) requiredSha256(p64[field], `p64.${field}`);
    const expected = requiredSha256(p64.successorFreshReactivationGovernanceCycleHashSha256, 'p64.successorFreshReactivationGovernanceCycleHashSha256');
    if (sha256Object(p64CycleCore(p64)) !== expected) blockers.push('P64_SUCCESSOR_FRESH_CYCLE_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeSuccessorFreshReviewerDesignation({ p64, reviewerDesignation } = {}) {
  if (!reviewerDesignation || typeof reviewerDesignation !== 'object' || Array.isArray(reviewerDesignation)) throw new TypeError('reviewerDesignation must be an object');
  const forbiddenKey = findForbiddenKeyMaterial(reviewerDesignation);
  if (forbiddenKey) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbiddenKey}`);
  const forbiddenReuse = findForbiddenReuse(reviewerDesignation);
  if (forbiddenReuse) throw new TypeError(`PREDECESSOR_FRESH_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${forbiddenReuse}`);
  if (callerAuthorityEscalated(reviewerDesignation)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  const designatedByRef = requiredString(reviewerDesignation.designatedByRef, 'reviewerDesignation.designatedByRef');
  if (designatedByRef !== p64.ownerActorRef) throw new TypeError('SUCCESSOR_FRESH_REVIEWER_MUST_BE_DESIGNATED_BY_CYCLE_OWNER');
  const reviewerRef = requiredString(reviewerDesignation.reviewerRef, 'reviewerDesignation.reviewerRef');
  if (reviewerRef === p64.ownerActorRef) throw new TypeError('OWNER_AND_SUCCESSOR_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER');
  const designatedAt = iso(reviewerDesignation.designatedAt, 'reviewerDesignation.designatedAt');
  if (Date.parse(designatedAt) < Date.parse(p64.preparedAt)) throw new TypeError('SUCCESSOR_FRESH_REVIEWER_DESIGNATION_PRECEDES_CYCLE_OPENING');
  const core = {
    schemaVersion: 1,
    designationId: requiredString(reviewerDesignation.designationId, 'reviewerDesignation.designationId'),
    cycleId: p64.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: p64.successorFreshReactivationGovernanceCycleHashSha256,
    designatedByRef,
    reviewerRef,
    reviewerDisplayName: requiredString(reviewerDesignation.reviewerDisplayName, 'reviewerDesignation.reviewerDisplayName'),
    designatedAt,
    designationSourceRef: requiredString(reviewerDesignation.designationSourceRef, 'reviewerDesignation.designationSourceRef'),
    designationArtifactSha256: requiredSha256(reviewerDesignation.designationArtifactSha256, 'reviewerDesignation.designationArtifactSha256'),
  };
  return deepFreeze({ ...core, successorFreshReviewerDesignationHashSha256: sha256Object(core) });
}

function createSuccessorFreshIndependentReviewHandoff({ p64, reviewerDesignation, reviewRequestId, requestedAt, ...callerOverrides } = {}) {
  const forbiddenKey = findForbiddenKeyMaterial(callerOverrides);
  if (forbiddenKey) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbiddenKey}`]);
  const forbiddenReuse = findForbiddenReuse(callerOverrides);
  if (forbiddenReuse) return hold([`PREDECESSOR_FRESH_REVIEW_OR_ACTIVATION_ARTIFACT_REUSE_NOT_ALLOWED:${forbiddenReuse}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const p64Blockers = validateP64SuccessorCycle(p64);
  if (p64Blockers.length > 0) return hold(p64Blockers);
  let designation;
  let requestId;
  let requestedAtIso;
  try {
    designation = normalizeSuccessorFreshReviewerDesignation({ p64, reviewerDesignation });
    requestId = requiredString(reviewRequestId, 'reviewRequestId');
    requestedAtIso = iso(requestedAt, 'requestedAt');
    if (Date.parse(requestedAtIso) < Date.parse(designation.designatedAt)) throw new TypeError('SUCCESSOR_FRESH_REVIEW_REQUEST_PRECEDES_REVIEWER_DESIGNATION');
  } catch (error) {
    return hold([error.message], { successorFreshReactivationGovernanceCycleHashSha256: p64.successorFreshReactivationGovernanceCycleHashSha256 });
  }

  const reviewChecklist = Object.freeze([
    'CONFIRM_P63_HUMAN_INCIDENT_CLOSURE_WAS_CRYPTOGRAPHICALLY_REVERIFIED_BY_P64',
    'CONFIRM_PREDECESSOR_FRESH_ACTIVATION_CYCLE_IS_HISTORICAL_AND_NON_REUSABLE',
    'CONFIRM_RCA_AND_CAPA_HASHES_ARE_BOUND_TO_SUCCESSOR_CYCLE',
    'CONFIRM_CURRENT_AUTHORITATIVE_BASELINE_REMAINS_LEGACY_FILE_SHA256',
    'CONFIRM_SUCCESSOR_CYCLE_EXACT_GIT_COMMIT_SCOPE',
    'CONFIRM_SUCCESSOR_RELEASE_ARTIFACT_SHA256_SCOPE',
    'CONFIRM_SUCCESSOR_ENVIRONMENT_CONFIG_SHA256_SCOPE',
    'REVIEW_SUCCESSOR_CYCLE_EVIDENCE_AND_REMEDIATION_RATIONALE',
    'CONFIRM_OWNER_AND_NEW_INDEPENDENT_REVIEWER_SEPARATION',
    'CONFIRM_NO_PREDECESSOR_REVIEWER_OWNER_PLAN_CONTRACT_OR_ROLLBACK_AUTHORITY_CARRIED_FORWARD',
    'CONFIRM_NO_RELEASE_MERGE_DEPLOYMENT_GO_LIVE_OR_TRANSACTION_AUTHORITY_GRANTED',
  ]);
  const core = {
    schemaVersion: 1,
    reviewRequestId: requestId,
    requestedAt: requestedAtIso,
    cycleId: p64.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: p64.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: p64.ownerActorRef,
    currentAuthoritativeMode: p64.currentAuthoritativeMode,
    currentRegistryHashSha256: p64.currentRegistryHashSha256,
    currentRegistryContentSha256: p64.currentRegistryContentSha256,
    requestedTargetMode: p64.requestedTargetMode,
    qualifiedSourceCommitSha: p64.qualifiedSourceCommitSha,
    releaseArtifactSha256: p64.releaseArtifactSha256,
    environmentConfigSha256: p64.environmentConfigSha256,
    cycleEvidenceArtifactSha256: p64.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: p64.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: p64.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: p64.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: p64.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: p64.predecessorCorrectivePreventiveActionSha256,
    successorFreshReviewerDesignationHashSha256: designation.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: designation.reviewerRef,
    reviewerDisplayName: designation.reviewerDisplayName,
    reviewChecklist,
  };
  const successorFreshReviewPacketHashSha256 = sha256Object(core);
  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReviewerDesignation: designation,
    successorFreshReviewPacketHashSha256,
    reviewPacketReady: true,
    successorFreshReviewerDesignated: true,
    ownerMayReplaceReviewerBeforeVerifiedReview: true,
    replacementRequiresNewDesignationAndReviewPacket: true,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    independentReviewAccepted: false,
    successorFreshCryptographicReviewAttestationRequired: true,
    successorFreshReviewerLifecycleLockRequired: true,
    predecessorReviewerAuthorityAccepted: false,
    predecessorActivationAuthorityAccepted: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    expectedReviewDecisionValues: Object.freeze(['APPROVE_SUCCESSOR_FRESH_REACTIVATION_REVIEW', 'REJECT_SUCCESSOR_FRESH_REACTIVATION_REVIEW']),
    ...AUTHORITY,
    semantics: 'P65 creates only a new independent-review handoff for the P64 successor cycle. The reviewer is newly designated for this cycle and no predecessor fresh reviewer, owner, plan, contract or rollback authority is accepted. A later cryptographic attestation remains mandatory.',
  });
}

module.exports = {
  STATUS,
  FORBIDDEN_PREDECESSOR_REUSE_FIELDS,
  p64CycleCore,
  validateP64SuccessorCycle,
  normalizeSuccessorFreshReviewerDesignation,
  createSuccessorFreshIndependentReviewHandoff,
};
