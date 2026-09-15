'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P49_STATUS } = require('./fresh-reactivation-reviewer-lifecycle-lock');
const { reviewerLockCore } = require('./fresh-reactivation-activation-plan');
const {
  validateFreshActivationPlan,
} = require('./fresh-composite-registry-candidate');
const {
  STATUS: P54_STATUS,
  validateP53Shadow,
} = require('./fresh-composite-cutover-rehearsal');

const STATUS = Object.freeze({
  HOLD_FRESH_CUTOVER_SAFETY_GUARD: 'HOLD_FRESH_CUTOVER_SAFETY_GUARD',
  FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED: 'FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

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
    || (value.activationAuthorized != null && value.activationAuthorized !== false)
    || (value.activationApplied != null && value.activationApplied !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, current = null, lifecycle = null, plan = null, shadow = null, rehearsal = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_CUTOVER_SAFETY_GUARD,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeMode: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    freshReviewerLifecycleLockHashSha256: lifecycle?.freshReviewerLifecycleLockHashSha256 || null,
    freshActivationPlanHashSha256: plan?.freshActivationPlanHashSha256 || null,
    freshShadowEvaluationHashSha256: shadow?.freshShadowEvaluationHashSha256 || null,
    freshCutoverRehearsalHashSha256: rehearsal?.freshCutoverRehearsalHashSha256 || null,
    freshCutoverSafetyGuardHashSha256: null,
    reviewerLockVerified: false,
    activationPlanVerified: false,
    shadowMatchVerified: false,
    rollbackRehearsalVerified: false,
    exactRollbackIdentityVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function validateReviewerLifecycle(lifecycle) {
  const blockers = [];
  if (!lifecycle || lifecycle.status !== P49_STATUS.FRESH_REACTIVATION_REVIEWER_LOCKED_BY_VERIFIED_REVIEW) {
    return ['P49_FRESH_REVIEWER_LIFECYCLE_LOCK_REQUIRED'];
  }
  if (
    lifecycle.verified !== true
    || lifecycle.freshReviewerLifecycleLocked !== true
    || lifecycle.reviewerReplacementAllowedNow !== false
    || lifecycle.independentReviewCompleted !== true
    || lifecycle.reviewerIdentityCryptographicallyVerified !== true
    || lifecycle.reviewerTrustRootVerified !== true
    || lifecycle.reviewAttestationSignatureVerified !== true
    || lifecycle.priorReviewerLifecycleLockReusable !== false
    || lifecycle.priorReviewerApprovalReusable !== false
    || lifecycle.reactivationAuthorized !== false
    || lifecycle.currentBaselineMutationPerformed !== false
    || lifecycle.releaseStillBlocked !== true
    || !allAuthorityFalse(lifecycle)
  ) blockers.push('P49_FRESH_REVIEWER_LIFECYCLE_BOUNDARY_INVALID');
  if (!SHA256_RE.test(lifecycle.freshReviewerLifecycleLockHashSha256 || '')) blockers.push('P49_FRESH_REVIEWER_LIFECYCLE_HASH_INVALID');
  else if (sha256Object(reviewerLockCore(lifecycle)) !== lifecycle.freshReviewerLifecycleLockHashSha256) blockers.push('P49_FRESH_REVIEWER_LIFECYCLE_HASH_MISMATCH');
  return blockers;
}

function rehearsalCore(rehearsal) {
  return {
    schemaVersion: rehearsal.schemaVersion,
    rehearsalId: rehearsal.rehearsalId,
    cycleId: rehearsal.cycleId,
    preparedByRef: rehearsal.preparedByRef,
    preparedAt: rehearsal.preparedAt,
    freshReactivationGovernanceCycleHashSha256: rehearsal.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: rehearsal.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: rehearsal.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: rehearsal.freshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: rehearsal.currentRegistryHashSha256,
    freshShadowEvaluationHashSha256: rehearsal.freshShadowEvaluationHashSha256,
    transitions: rehearsal.transitions,
  };
}

function validateRehearsal(rehearsal, shadow, current) {
  const blockers = [];
  if (!rehearsal || rehearsal.status !== P54_STATUS.FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION) {
    return ['P54_FRESH_CUTOVER_REHEARSAL_REQUIRED'];
  }
  if (
    rehearsal.verified !== true
    || rehearsal.cutoverSimulated !== true
    || rehearsal.rollbackSimulated !== true
    || rehearsal.rollbackRestoresExactAuthoritativeRegistry !== true
    || rehearsal.actualRegistryMutationPerformed !== false
    || rehearsal.actualReleaseGateModeChanged !== false
    || rehearsal.actualDeploymentMutationPerformed !== false
    || rehearsal.simulationOnly !== true
    || rehearsal.activationAuthorized !== false
    || rehearsal.activationApplied !== false
    || rehearsal.reactivationAuthorized !== false
    || rehearsal.currentBaselineMutationPerformed !== false
    || rehearsal.releaseStillBlocked !== true
    || !allAuthorityFalse(rehearsal)
  ) blockers.push('P54_FRESH_REHEARSAL_BOUNDARY_INVALID');
  if (rehearsal.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P54_CURRENT_REGISTRY_BINDING_MISMATCH');
  if (rehearsal.freshShadowEvaluationHashSha256 !== shadow.freshShadowEvaluationHashSha256) blockers.push('P54_SHADOW_BINDING_MISMATCH');
  if (rehearsal.cycleId !== shadow.cycleId) blockers.push('P54_CYCLE_BINDING_MISMATCH');
  if (rehearsal.freshReviewerLifecycleLockHashSha256 !== shadow.freshReviewerLifecycleLockHashSha256) blockers.push('P54_REVIEWER_LOCK_BINDING_MISMATCH');
  if (rehearsal.freshActivationPlanHashSha256 !== shadow.freshActivationPlanHashSha256) blockers.push('P54_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (rehearsal.freshCompositeRegistryCandidateHashSha256 !== shadow.freshCompositeRegistryCandidateHashSha256) blockers.push('P54_CANDIDATE_BINDING_MISMATCH');
  if (!SHA256_RE.test(rehearsal.freshCutoverRehearsalHashSha256 || '')) blockers.push('P54_FRESH_REHEARSAL_HASH_INVALID');
  else if (sha256Object(rehearsalCore(rehearsal)) !== rehearsal.freshCutoverRehearsalHashSha256) blockers.push('P54_FRESH_REHEARSAL_HASH_MISMATCH');

  const transitions = rehearsal.transitions;
  if (!Array.isArray(transitions) || transitions.length !== 3) blockers.push('P54_THREE_STATE_TRANSITION_REQUIRED');
  else {
    const [initial, cutover, rollback] = transitions;
    if (initial.mode !== MODE.LEGACY_FILE_SHA256 || initial.registryHashSha256 !== current.registryHashSha256 || initial.authoritative !== true) blockers.push('P54_INITIAL_STATE_INVALID');
    if (cutover.mode !== MODE.GOVERNED_COMPOSITE_BASELINE || cutover.simulated !== true || cutover.authoritative !== false) blockers.push('P54_SIMULATED_CUTOVER_STATE_INVALID');
    if (rollback.mode !== MODE.LEGACY_FILE_SHA256 || rollback.simulated !== true || rollback.authoritative !== true || rollback.registryHashSha256 !== initial.registryHashSha256 || rollback.restoresInitialRegistryHashExactly !== true) blockers.push('P54_EXACT_ROLLBACK_IDENTITY_NOT_PROVEN');
  }
  return blockers;
}

function evaluateFreshCompositeCutoverSafetyGuard({
  currentRegistry,
  reviewerLifecycle,
  activationPlan,
  freshShadowEvaluation,
  freshRehearsalResult,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, reviewerLifecycle, activationPlan, freshShadowEvaluation, freshRehearsalResult);
  }

  const blockers = [
    ...validateReviewerLifecycle(reviewerLifecycle),
    ...validateFreshActivationPlan(activationPlan),
    ...validateP53Shadow(freshShadowEvaluation, current),
    ...validateRehearsal(freshRehearsalResult, freshShadowEvaluation || {}, current),
  ];

  if (activationPlan && reviewerLifecycle) {
    if (activationPlan.freshReviewerLifecycleLockHashSha256 !== reviewerLifecycle.freshReviewerLifecycleLockHashSha256) blockers.push('P50_P49_REVIEWER_LOCK_BINDING_MISMATCH');
    if (activationPlan.freshReactivationGovernanceCycleHashSha256 !== reviewerLifecycle.freshReactivationGovernanceCycleHashSha256) blockers.push('P50_P49_CYCLE_HASH_BINDING_MISMATCH');
    if (activationPlan.freshSuccessorBaselineManifest?.expectedPriorRegistryHashSha256 !== current.registryHashSha256) blockers.push('P50_CURRENT_REGISTRY_BINDING_MISMATCH');
  }
  if (freshShadowEvaluation && activationPlan) {
    if (freshShadowEvaluation.freshActivationPlanHashSha256 !== activationPlan.freshActivationPlanHashSha256) blockers.push('P53_P50_ACTIVATION_PLAN_BINDING_MISMATCH');
    if (freshShadowEvaluation.freshReviewerLifecycleLockHashSha256 !== reviewerLifecycle?.freshReviewerLifecycleLockHashSha256) blockers.push('P53_P49_REVIEWER_LOCK_BINDING_MISMATCH');
  }

  if (blockers.length > 0) return hold(blockers, current, reviewerLifecycle, activationPlan, freshShadowEvaluation, freshRehearsalResult);

  const core = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: activationPlan.cycleId,
    freshReactivationGovernanceCycleHashSha256: activationPlan.freshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    freshReviewerLifecycleLockHashSha256: reviewerLifecycle.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: activationPlan.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: activationPlan.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: freshShadowEvaluation.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: freshShadowEvaluation.candidateRegistryHashSha256,
    candidateRegistryContentSha256: freshShadowEvaluation.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: freshShadowEvaluation.freshCompositeEvidenceHashSha256,
    freshShadowEvaluationHashSha256: freshShadowEvaluation.freshShadowEvaluationHashSha256,
    freshCutoverRehearsalHashSha256: freshRehearsalResult.freshCutoverRehearsalHashSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    freshCutoverSafetyGuardHashSha256: sha256Object(core),
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackIdentityVerified: true,
    safetyPrerequisitesSatisfiedForFreshOwnerAuthorization: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P55 proves that the fresh P49 reviewer lock, P50 activation plan, P53 shadow match and P54 exact rollback rehearsal are mutually bound to the same still-authoritative legacy registry and fresh governance cycle. It is a safety prerequisite only and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  rehearsalCore,
  validateReviewerLifecycle,
  validateRehearsal,
  evaluateFreshCompositeCutoverSafetyGuard,
};
