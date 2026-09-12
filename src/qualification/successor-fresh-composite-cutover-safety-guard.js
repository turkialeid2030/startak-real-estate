'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { validateP67ReviewerLifecycleLock } = require('./successor-fresh-activation-plan');
const { validateSuccessorFreshActivationPlan } = require('./successor-fresh-composite-registry-candidate');
const { validateP71Shadow } = require('./successor-fresh-composite-cutover-rehearsal');
const { STATUS: P72_STATUS } = require('./successor-fresh-composite-cutover-rehearsal');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD: 'HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD',
  SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED: 'SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function requiredSha256(value, field) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
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
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.activationAuthorized != null && value.activationAuthorized !== false)
    || (value.activationApplied != null && value.activationApplied !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeMode: context.current?.activeMode || MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: context.current?.registryHashSha256 || null,
    currentRegistryContentSha256: context.shadow?.currentRegistryContentSha256 || null,
    successorFreshReviewerLifecycleLockHashSha256: context.lifecycle?.successorFreshReviewerLifecycleLockHashSha256 || null,
    successorFreshActivationPlanHashSha256: context.plan?.successorFreshActivationPlanHashSha256 || null,
    successorFreshShadowEvaluationHashSha256: context.shadow?.successorFreshShadowEvaluationHashSha256 || null,
    successorFreshCutoverRehearsalHashSha256: context.rehearsal?.successorFreshCutoverRehearsalHashSha256 || null,
    successorFreshCutoverSafetyGuardHashSha256: null,
    reviewerLockVerified: false,
    activationPlanVerified: false,
    shadowMatchVerified: false,
    rollbackRehearsalVerified: false,
    exactRollbackLogicalIdentityVerified: false,
    exactRollbackRawContentIdentityVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function p72RehearsalCore(rehearsal) {
  return {
    schemaVersion: rehearsal.schemaVersion,
    rehearsalId: rehearsal.rehearsalId,
    cycleId: rehearsal.cycleId,
    preparedByRef: rehearsal.preparedByRef,
    preparedAt: rehearsal.preparedAt,
    successorFreshReactivationGovernanceCycleHashSha256: rehearsal.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: rehearsal.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: rehearsal.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: rehearsal.successorFreshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: rehearsal.currentRegistryHashSha256,
    currentRegistryContentSha256: rehearsal.currentRegistryContentSha256,
    candidateRegistryHashSha256: rehearsal.candidateRegistryHashSha256,
    candidateRegistryContentSha256: rehearsal.candidateRegistryContentSha256,
    successorFreshShadowEvaluationHashSha256: rehearsal.successorFreshShadowEvaluationHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: rehearsal.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: rehearsal.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: rehearsal.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: rehearsal.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: rehearsal.predecessorCorrectivePreventiveActionSha256,
    transitions: rehearsal.transitions,
  };
}

function validateP72Rehearsal(rehearsal, shadow, current, currentRegistryContent) {
  const blockers = [];
  if (!rehearsal || rehearsal.status !== P72_STATUS.SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION) {
    return ['P72_SUCCESSOR_FRESH_CUTOVER_REHEARSAL_REQUIRED'];
  }
  if (
    rehearsal.verified !== true
    || rehearsal.cutoverSimulated !== true
    || rehearsal.rollbackSimulated !== true
    || rehearsal.rollbackRestoresExactAuthoritativeRegistry !== true
    || rehearsal.rollbackRestoresExactAuthoritativeRegistryContent !== true
    || rehearsal.actualRegistryMutationPerformed !== false
    || rehearsal.actualReleaseGateModeChanged !== false
    || rehearsal.actualDeploymentMutationPerformed !== false
    || rehearsal.simulationOnly !== true
    || rehearsal.activationAuthorized !== false
    || rehearsal.activationApplied !== false
    || rehearsal.reactivationAuthorized !== false
    || rehearsal.currentBaselineMutationPerformed !== false
    || rehearsal.successorFreshCutoverSafetyEvidenceRequired !== true
    || rehearsal.successorFreshOwnerActivationAuthorizationRequired !== true
    || rehearsal.successorFreshActivationChangeContractRequired !== true
    || rehearsal.successorFreshModeVerifierRequired !== true
    || rehearsal.postActivationReleaseVerifyRequired !== true
    || rehearsal.releaseStillBlocked !== true
    || !allAuthorityFalse(rehearsal)
  ) blockers.push('P72_SUCCESSOR_FRESH_REHEARSAL_BOUNDARY_INVALID');

  try {
    const rehearsalHash = requiredSha256(rehearsal.successorFreshCutoverRehearsalHashSha256, 'successorFreshCutoverRehearsalHashSha256');
    if (sha256Object(p72RehearsalCore(rehearsal)) !== rehearsalHash) blockers.push('P72_SUCCESSOR_FRESH_REHEARSAL_HASH_MISMATCH');
    if (rehearsal.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P72_CURRENT_REGISTRY_HASH_BINDING_MISMATCH');
    if (sha256Text(currentRegistryContent) !== rehearsal.currentRegistryContentSha256) blockers.push('P72_CURRENT_REGISTRY_CONTENT_BINDING_MISMATCH');
    if (rehearsal.successorFreshShadowEvaluationHashSha256 !== shadow.successorFreshShadowEvaluationHashSha256) blockers.push('P72_SHADOW_BINDING_MISMATCH');
    if (rehearsal.cycleId !== shadow.cycleId) blockers.push('P72_CYCLE_BINDING_MISMATCH');
    if (rehearsal.successorFreshReviewerLifecycleLockHashSha256 !== shadow.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P72_REVIEWER_LOCK_BINDING_MISMATCH');
    if (rehearsal.successorFreshActivationPlanHashSha256 !== shadow.successorFreshActivationPlanHashSha256) blockers.push('P72_ACTIVATION_PLAN_BINDING_MISMATCH');
    if (rehearsal.successorFreshCompositeRegistryCandidateHashSha256 !== shadow.successorFreshCompositeRegistryCandidateHashSha256) blockers.push('P72_CANDIDATE_BINDING_MISMATCH');
    if (rehearsal.candidateRegistryHashSha256 !== shadow.candidateRegistryHashSha256) blockers.push('P72_CANDIDATE_LOGICAL_HASH_BINDING_MISMATCH');
    if (rehearsal.candidateRegistryContentSha256 !== shadow.candidateRegistryContentSha256) blockers.push('P72_CANDIDATE_CONTENT_HASH_BINDING_MISMATCH');
    for (const field of [
      'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256',
      'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) if (rehearsal[field] !== shadow[field]) blockers.push(`P72_${field.toUpperCase()}_BINDING_MISMATCH`);
  } catch (error) {
    blockers.push(error.message);
  }

  const transitions = rehearsal.transitions;
  if (!Array.isArray(transitions) || transitions.length !== 3) {
    blockers.push('P72_THREE_STATE_TRANSITION_REQUIRED');
  } else {
    const [initial, cutover, rollback] = transitions;
    if (
      initial.sequence !== 0
      || initial.mode !== MODE.LEGACY_FILE_SHA256
      || initial.registryHashSha256 !== current.registryHashSha256
      || initial.registryContentSha256 !== sha256Text(currentRegistryContent)
      || initial.authoritative !== true
      || initial.simulated !== false
    ) blockers.push('P72_INITIAL_STATE_INVALID');
    if (
      cutover.sequence !== 1
      || cutover.mode !== MODE.GOVERNED_COMPOSITE_BASELINE
      || cutover.registrySchemaVersion !== 4
      || cutover.sourceCandidateRegistryHashSha256 !== shadow.candidateRegistryHashSha256
      || cutover.sourceCandidateRegistryContentSha256 !== shadow.candidateRegistryContentSha256
      || cutover.sourceSuccessorFreshCompositeEvidenceHashSha256 !== shadow.successorFreshCompositeEvidenceHashSha256
      || cutover.sourceSuccessorFreshShadowEvaluationHashSha256 !== shadow.successorFreshShadowEvaluationHashSha256
      || cutover.authoritative !== false
      || cutover.simulated !== true
    ) blockers.push('P72_SIMULATED_CUTOVER_STATE_INVALID');
    if (
      rollback.sequence !== 2
      || rollback.mode !== MODE.LEGACY_FILE_SHA256
      || rollback.registryHashSha256 !== initial.registryHashSha256
      || rollback.registryContentSha256 !== initial.registryContentSha256
      || rollback.authoritative !== true
      || rollback.simulated !== true
      || rollback.restoresInitialRegistryHashExactly !== true
      || rollback.restoresInitialRegistryContentHashExactly !== true
    ) blockers.push('P72_EXACT_LOGICAL_AND_RAW_ROLLBACK_NOT_PROVEN');
  }
  return blockers;
}

function evaluateSuccessorFreshCompositeCutoverSafetyGuard({
  currentRegistry,
  currentRegistryContent,
  successorReviewPacket,
  reviewerLifecycle,
  activationPlan,
  successorFreshShadowEvaluation,
  successorFreshRehearsalResult,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial(callerOverrides);
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  const context = {
    current,
    lifecycle: reviewerLifecycle,
    plan: activationPlan,
    shadow: successorFreshShadowEvaluation,
    rehearsal: successorFreshRehearsalResult,
  };
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], context);
  }
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') {
    return hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED'], context);
  }
  try {
    const parsed = JSON.parse(currentRegistryContent);
    if (stableStringify(parsed) !== stableStringify(currentRegistry)) return hold(['CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH'], context);
  } catch (_) {
    return hold(['CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON'], context);
  }

  const blockers = [
    ...validateP67ReviewerLifecycleLock({ packet: successorReviewPacket, reviewerLifecycle }),
    ...validateSuccessorFreshActivationPlan(activationPlan),
    ...validateP71Shadow(successorFreshShadowEvaluation, current, currentRegistry, currentRegistryContent),
    ...validateP72Rehearsal(successorFreshRehearsalResult, successorFreshShadowEvaluation || {}, current, currentRegistryContent),
  ];

  if (activationPlan && reviewerLifecycle) {
    if (activationPlan.successorFreshReviewerLifecycleLockHashSha256 !== reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P68_P67_REVIEWER_LOCK_BINDING_MISMATCH');
    if (activationPlan.successorFreshReactivationGovernanceCycleHashSha256 !== reviewerLifecycle.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P68_P67_CYCLE_HASH_BINDING_MISMATCH');
    if (activationPlan.successorFreshBaselineManifest?.expectedPriorRegistryHashSha256 !== current.registryHashSha256) blockers.push('P68_CURRENT_REGISTRY_HASH_BINDING_MISMATCH');
    if (activationPlan.successorFreshBaselineManifest?.expectedPriorRegistryContentSha256 !== sha256Text(currentRegistryContent)) blockers.push('P68_CURRENT_REGISTRY_CONTENT_BINDING_MISMATCH');
  }
  if (successorFreshShadowEvaluation && activationPlan) {
    if (successorFreshShadowEvaluation.successorFreshActivationPlanHashSha256 !== activationPlan.successorFreshActivationPlanHashSha256) blockers.push('P71_P68_ACTIVATION_PLAN_BINDING_MISMATCH');
    if (successorFreshShadowEvaluation.successorFreshReviewerLifecycleLockHashSha256 !== reviewerLifecycle?.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P71_P67_REVIEWER_LOCK_BINDING_MISMATCH');
  }

  if (blockers.length > 0) return hold(blockers, context);

  const shadow = successorFreshShadowEvaluation;
  const rehearsal = successorFreshRehearsalResult;
  const core = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    proposedRegistrySchemaVersion: 4,
    cycleId: activationPlan.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: activationPlan.successorFreshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    currentRegistryContentSha256: sha256Text(currentRegistryContent),
    successorFreshReviewerLifecycleLockHashSha256: reviewerLifecycle.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: activationPlan.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: activationPlan.successorFreshBaselineManifestHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: shadow.successorFreshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    candidateRegistryContentSha256: shadow.candidateRegistryContentSha256,
    successorFreshCompositeEvidenceHashSha256: shadow.successorFreshCompositeEvidenceHashSha256,
    successorFreshShadowEvaluationHashSha256: shadow.successorFreshShadowEvaluationHashSha256,
    successorFreshCutoverRehearsalHashSha256: rehearsal.successorFreshCutoverRehearsalHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: shadow.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: shadow.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: shadow.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: shadow.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: shadow.predecessorCorrectivePreventiveActionSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshCutoverSafetyGuardHashSha256: sha256Object(core),
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackLogicalIdentityVerified: true,
    exactRollbackRawContentIdentityVerified: true,
    safetyPrerequisitesSatisfiedForSuccessorFreshOwnerAuthorization: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorFreshSafetyAuthorityReusable: false,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P73 proves the P67 reviewer lock, P68 activation plan, P71 schema-v4 successor shadow match and P72 exact logical/raw rollback rehearsal are mutually bound to the same still-authoritative legacy registry and successor governance cycle. It is a safety prerequisite only and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  p72RehearsalCore,
  validateP72Rehearsal,
  evaluateSuccessorFreshCompositeCutoverSafetyGuard,
};
