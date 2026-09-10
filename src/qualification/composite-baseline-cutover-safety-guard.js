'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P30_STATUS } = require('./canonical-rebaseline-reviewer-lifecycle');
const { STATUS: P31_STATUS } = require('./canonical-rebaseline-activation-plan');
const { STATUS: P36_STATUS } = require('./composite-baseline-shadow-release-gate');
const { STATUS: P37_STATUS } = require('./composite-baseline-cutover-rehearsal');

const STATUS = Object.freeze({
  HOLD_CUTOVER_SAFETY_GUARD: 'HOLD_CUTOVER_SAFETY_GUARD',
  CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED: 'CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED',
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

function sha256Object(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function allAuthorityFalse(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).every((field) => value[field] === false);
}

function hold(blockers, current = null, lifecycle = null, plan = null, shadow = null, rehearsal = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_CUTOVER_SAFETY_GUARD,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeMode: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    reviewerLockHashSha256: lifecycle?.reviewerLockHashSha256 || null,
    activationPlanHashSha256: plan?.activationPlanHashSha256 || null,
    shadowEvaluationHashSha256: shadow?.shadowEvaluationHashSha256 || null,
    rehearsalHashSha256: rehearsal?.rehearsalHashSha256 || null,
    cutoverSafetyGuardHashSha256: null,
    reviewerLockVerified: false,
    activationPlanVerified: false,
    shadowMatchVerified: false,
    rollbackRehearsalVerified: false,
    activationAuthorizationGranted: false,
    activationApplied: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  });
}

function verifyReviewerLifecycle(lifecycle) {
  const blockers = [];
  if (!lifecycle || lifecycle.status !== P30_STATUS.REVIEWER_LOCKED_BY_VERIFIED_REVIEW) {
    return ['P30_VERIFIED_REVIEWER_LIFECYCLE_LOCK_REQUIRED'];
  }
  if (
    lifecycle.independentReviewCompleted !== true
    || lifecycle.reviewerIdentityCryptographicallyVerified !== true
    || lifecycle.reviewerRegistryTrustRootVerified !== true
    || lifecycle.reviewAttestationSignatureVerified !== true
    || lifecycle.reviewerReplacementAllowedNow !== false
    || lifecycle.ownerMayReplaceReviewerBeforeAcceptedReview !== false
    || !allAuthorityFalse(lifecycle)
  ) blockers.push('P30_REVIEWER_LIFECYCLE_BOUNDARY_INVALID');

  if (!SHA256_RE.test(lifecycle.reviewerLockHashSha256 || '')) {
    blockers.push('P30_REVIEWER_LOCK_HASH_INVALID');
    return blockers;
  }

  const core = {
    schemaVersion: lifecycle.schemaVersion,
    ledgerHashSha256: lifecycle.ledgerHashSha256,
    currentDesignationHashSha256: lifecycle.currentDesignationHashSha256,
    currentReviewerRef: lifecycle.currentReviewerRef,
    currentReviewerDisplayName: lifecycle.currentReviewerDisplayName,
    reviewRequestId: lifecycle.reviewRequestId,
    reviewPacketHashSha256: lifecycle.reviewPacketHashSha256,
    verifiedReviewResponseHashSha256: lifecycle.verifiedReviewResponseHashSha256,
  };
  if (sha256Object(core) !== lifecycle.reviewerLockHashSha256) blockers.push('P30_REVIEWER_LOCK_HASH_MISMATCH');
  return blockers;
}

function verifyActivationPlan(plan, lifecycle, currentRegistry) {
  const blockers = [];
  if (!plan || plan.status !== P31_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE_PLAN) {
    return ['P31_ACTIVATION_PLAN_REQUIRED'];
  }
  if (
    plan.explicitCodeChangeRequired !== true
    || plan.activationApplied !== false
    || plan.automaticBaselineSwitchAllowed !== false
    || plan.postChangeReleaseVerifyRequired !== true
    || !allAuthorityFalse(plan)
  ) blockers.push('P31_ACTIVATION_PLAN_BOUNDARY_INVALID');

  if (!SHA256_RE.test(plan.activationPlanHashSha256 || '')) blockers.push('P31_ACTIVATION_PLAN_HASH_INVALID');
  if (!SHA256_RE.test(plan.successorBaselineManifestHashSha256 || '')) blockers.push('P31_SUCCESSOR_MANIFEST_HASH_INVALID');
  const manifest = plan.successorBaselineManifest;
  if (!manifest || typeof manifest !== 'object') {
    blockers.push('P31_SUCCESSOR_MANIFEST_REQUIRED');
  } else {
    if (sha256Object(manifest) !== plan.successorBaselineManifestHashSha256) blockers.push('P31_SUCCESSOR_MANIFEST_HASH_MISMATCH');
    if (manifest.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT') blockers.push('P31_SUCCESSOR_BASELINE_TYPE_INVALID');
    if (manifest.reviewerLockHashSha256 !== lifecycle.reviewerLockHashSha256) blockers.push('P31_REVIEWER_LOCK_BINDING_MISMATCH');
    if (manifest.supersedesLegacyCanonicalSha256 !== currentRegistry.legacyBaseline.expectedSha256) blockers.push('P31_LEGACY_BASELINE_BINDING_MISMATCH');
  }

  const contract = plan.targetActivationContract || {};
  if (
    contract.targetPath !== 'config/governance/canonical-baseline.json'
    || contract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256
    || contract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE
    || contract.expectedLegacyCanonicalSha256 !== currentRegistry.legacyBaseline.expectedSha256
  ) blockers.push('P31_TARGET_ACTIVATION_CONTRACT_INVALID');

  const core = {
    schemaVersion: plan.schemaVersion,
    activationChangeId: plan.activationChangeId,
    proposalId: plan.proposalId,
    proposalHashSha256: plan.proposalHashSha256,
    preparedByRef: plan.preparedByRef,
    preparedAt: plan.preparedAt,
    successorBaselineManifest: plan.successorBaselineManifest,
    successorBaselineManifestHashSha256: plan.successorBaselineManifestHashSha256,
    targetActivationContract: plan.targetActivationContract,
  };
  if (sha256Object(core) !== plan.activationPlanHashSha256) blockers.push('P31_ACTIVATION_PLAN_HASH_MISMATCH');
  return blockers;
}

function verifyShadow(shadow, plan, current) {
  const blockers = [];
  if (!shadow || shadow.status !== P36_STATUS.SHADOW_COMPOSITE_BASELINE_MATCH_NOT_ACTIVE) {
    return ['P36_SHADOW_MATCH_REQUIRED'];
  }
  if (
    shadow.shadowComparisonMatch !== true
    || shadow.shadowOnly !== true
    || shadow.candidateOnly !== true
    || shadow.activationApplied !== false
    || shadow.authoritativeBaselineRemainsLegacy !== true
    || shadow.productionEvidenceEstablishedHere !== false
    || !allAuthorityFalse(shadow)
  ) blockers.push('P36_SHADOW_BOUNDARY_INVALID');
  if (shadow.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || shadow.shadowMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P36_SHADOW_MODE_INVALID');
  if (shadow.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P36_CURRENT_REGISTRY_BINDING_MISMATCH');
  if (shadow.activationPlanHashSha256 !== plan.activationPlanHashSha256) blockers.push('P36_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (shadow.successorBaselineManifestHashSha256 !== plan.successorBaselineManifestHashSha256) blockers.push('P36_SUCCESSOR_MANIFEST_BINDING_MISMATCH');

  const core = {
    schemaVersion: shadow.schemaVersion,
    authoritativeMode: shadow.authoritativeMode,
    shadowMode: shadow.shadowMode,
    currentRegistryHashSha256: shadow.currentRegistryHashSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    compositeEvidenceHashSha256: shadow.compositeEvidenceHashSha256,
    activationPlanHashSha256: shadow.activationPlanHashSha256,
    successorBaselineManifestHashSha256: shadow.successorBaselineManifestHashSha256,
  };
  if (!SHA256_RE.test(shadow.shadowEvaluationHashSha256 || '') || sha256Object(core) !== shadow.shadowEvaluationHashSha256) {
    blockers.push('P36_SHADOW_EVALUATION_HASH_MISMATCH');
  }
  return blockers;
}

function verifyRehearsal(rehearsal, shadow, current) {
  const blockers = [];
  if (!rehearsal || rehearsal.status !== P37_STATUS.CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION) {
    return ['P37_CUTOVER_REHEARSAL_REQUIRED'];
  }
  if (
    rehearsal.cutoverSimulated !== true
    || rehearsal.rollbackSimulated !== true
    || rehearsal.rollbackRestoresExactAuthoritativeRegistry !== true
    || rehearsal.actualRegistryMutationPerformed !== false
    || rehearsal.actualReleaseGateModeChanged !== false
    || rehearsal.actualDeploymentMutationPerformed !== false
    || rehearsal.simulationOnly !== true
    || rehearsal.activationApplied !== false
    || rehearsal.productionEvidenceEstablishedHere !== false
    || !allAuthorityFalse(rehearsal)
  ) blockers.push('P37_REHEARSAL_BOUNDARY_INVALID');

  if (rehearsal.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P37_CURRENT_REGISTRY_BINDING_MISMATCH');
  if (rehearsal.shadowEvaluationHashSha256 !== shadow.shadowEvaluationHashSha256) blockers.push('P37_SHADOW_BINDING_MISMATCH');

  const transitions = rehearsal.transitions;
  if (!Array.isArray(transitions) || transitions.length !== 3) {
    blockers.push('P37_THREE_STATE_TRANSITION_REQUIRED');
  } else {
    const [initial, cutover, rollback] = transitions;
    if (
      initial.sequence !== 0 || initial.mode !== MODE.LEGACY_FILE_SHA256 || initial.authoritative !== true
      || initial.registryHashSha256 !== current.registryHashSha256
    ) blockers.push('P37_INITIAL_STATE_INVALID');
    if (
      cutover.sequence !== 1 || cutover.mode !== MODE.GOVERNED_COMPOSITE_BASELINE
      || cutover.authoritative !== false || cutover.simulated !== true
      || cutover.shadowEvaluationHashSha256 !== shadow.shadowEvaluationHashSha256
    ) blockers.push('P37_SIMULATED_CUTOVER_STATE_INVALID');
    if (
      rollback.sequence !== 2 || rollback.mode !== MODE.LEGACY_FILE_SHA256
      || rollback.authoritative !== true || rollback.simulated !== true
      || rollback.restoresInitialRegistryHashExactly !== true
      || rollback.registryHashSha256 !== initial.registryHashSha256
      || rollback.registryHashSha256 !== current.registryHashSha256
    ) blockers.push('P37_EXACT_ROLLBACK_IDENTITY_NOT_PROVEN');
  }

  const core = {
    schemaVersion: rehearsal.schemaVersion,
    rehearsalId: rehearsal.rehearsalId,
    preparedByRef: rehearsal.preparedByRef,
    preparedAt: rehearsal.preparedAt,
    currentRegistryHashSha256: rehearsal.currentRegistryHashSha256,
    shadowEvaluationHashSha256: rehearsal.shadowEvaluationHashSha256,
    transitions: rehearsal.transitions,
  };
  if (!SHA256_RE.test(rehearsal.rehearsalHashSha256 || '') || sha256Object(core) !== rehearsal.rehearsalHashSha256) {
    blockers.push('P37_REHEARSAL_HASH_MISMATCH');
  }
  return blockers;
}

function evaluateCompositeBaselineCutoverSafetyGuard({
  currentRegistry,
  reviewerLifecycle,
  activationPlan,
  shadowEvaluation,
  rehearsalResult,
} = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, reviewerLifecycle, activationPlan, shadowEvaluation, rehearsalResult);
  }

  const blockers = [
    ...verifyReviewerLifecycle(reviewerLifecycle),
    ...verifyActivationPlan(activationPlan, reviewerLifecycle || {}, currentRegistry || {}),
    ...verifyShadow(shadowEvaluation, activationPlan || {}, current),
    ...verifyRehearsal(rehearsalResult, shadowEvaluation || {}, current),
  ];
  if (blockers.length > 0) return hold(blockers, current, reviewerLifecycle, activationPlan, shadowEvaluation, rehearsalResult);

  const core = {
    schemaVersion: 1,
    authoritativeMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    currentRegistryHashSha256: current.registryHashSha256,
    reviewerLockHashSha256: reviewerLifecycle.reviewerLockHashSha256,
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    successorBaselineManifestHashSha256: activationPlan.successorBaselineManifestHashSha256,
    shadowEvaluationHashSha256: shadowEvaluation.shadowEvaluationHashSha256,
    rehearsalHashSha256: rehearsalResult.rehearsalHashSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED,
    cutoverSafetyGuardHashSha256: sha256Object(core),
    blockers: Object.freeze([]),
    reviewerLockVerified: true,
    activationPlanVerified: true,
    shadowMatchVerified: true,
    rollbackRehearsalVerified: true,
    exactRollbackIdentityVerified: true,
    safetyPrerequisitesSatisfiedForFutureExplicitReviewedActivationChange: true,
    activationAuthorizationGranted: false,
    activationApplied: false,
    explicitReviewedRegistryCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P38 proves that a cryptographically locked independent review, P31 activation plan, P36 shadow match and P37 exact rollback rehearsal are mutually bound to the same still-authoritative legacy registry. It is a safety prerequisite only; it does not authorize or apply baseline activation, merge, deployment, go-live or transactions.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  evaluateCompositeBaselineCutoverSafetyGuard,
};
