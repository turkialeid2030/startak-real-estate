'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P53_STATUS } = require('./fresh-composite-shadow-release-gate');

const STATUS = Object.freeze({
  HOLD_FRESH_CUTOVER_REHEARSAL: 'HOLD_FRESH_CUTOVER_REHEARSAL',
  FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION: 'FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION',
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
function hold(blockers, current = null, shadow = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_CUTOVER_REHEARSAL,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    cycleId: shadow?.cycleId || null,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    freshShadowEvaluationHashSha256: shadow?.freshShadowEvaluationHashSha256 || null,
    freshCutoverRehearsalHashSha256: null,
    cutoverSimulated: false,
    rollbackSimulated: false,
    rollbackRestoresExactAuthoritativeRegistry: false,
    simulationOnly: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function p53ShadowCore(shadow) {
  return {
    schemaVersion: shadow.schemaVersion,
    authoritativeMode: shadow.authoritativeMode,
    shadowMode: shadow.shadowMode,
    cycleId: shadow.cycleId,
    freshReactivationGovernanceCycleHashSha256: shadow.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: shadow.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: shadow.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: shadow.freshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: shadow.currentRegistryHashSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    candidateRegistryContentSha256: shadow.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: shadow.freshCompositeEvidenceHashSha256,
  };
}

function validateP53Shadow(shadow, current) {
  const blockers = [];
  if (!shadow || shadow.status !== P53_STATUS.FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE) return ['P53_FRESH_SHADOW_MATCH_REQUIRED'];
  if (
    shadow.verified !== true
    || shadow.shadowComparisonMatch !== true
    || shadow.shadowOnly !== true
    || shadow.candidateOnly !== true
    || shadow.authoritativeBaselineRemainsLegacy !== true
    || shadow.activeRegistryChanged !== false
    || shadow.activationAuthorized !== false
    || shadow.activationApplied !== false
    || shadow.reactivationAuthorized !== false
    || shadow.currentBaselineMutationPerformed !== false
    || shadow.freshCutoverRehearsalRequired !== true
    || shadow.freshCutoverSafetyEvidenceRequired !== true
    || shadow.freshOwnerActivationAuthorizationRequired !== true
    || shadow.freshActivationChangeContractRequired !== true
    || shadow.releaseStillBlocked !== true
    || !allAuthorityFalse(shadow)
  ) blockers.push('P53_FRESH_SHADOW_BOUNDARY_INVALID');
  if (shadow.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || shadow.shadowMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P53_FRESH_SHADOW_MODE_INVALID');
  try {
    const hash = requiredSha256(shadow.freshShadowEvaluationHashSha256, 'freshShadowEvaluationHashSha256');
    if (sha256Object(p53ShadowCore(shadow)) !== hash) blockers.push('P53_FRESH_SHADOW_HASH_MISMATCH');
    if (shadow.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P53_FRESH_SHADOW_CURRENT_REGISTRY_HASH_MISMATCH');
    for (const field of [
      'freshReactivationGovernanceCycleHashSha256',
      'freshReviewerLifecycleLockHashSha256',
      'freshActivationPlanHashSha256',
      'freshCompositeRegistryCandidateHashSha256',
      'candidateRegistryHashSha256',
      'candidateRegistryContentSha256',
      'freshCompositeEvidenceHashSha256',
    ]) requiredSha256(shadow[field], field);
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function runFreshCompositeCutoverRehearsal({
  currentRegistry,
  freshShadowEvaluation,
  rehearsalId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, freshShadowEvaluation);
  }
  const shadowBlockers = validateP53Shadow(freshShadowEvaluation, current);
  if (shadowBlockers.length > 0) return hold(shadowBlockers, current, freshShadowEvaluation);

  let id;
  let preparer;
  let preparedAtIso;
  try {
    id = requiredString(rehearsalId, 'rehearsalId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], current, freshShadowEvaluation);
  }

  const initialState = deepFreeze({
    sequence: 0,
    mode: MODE.LEGACY_FILE_SHA256,
    registryHashSha256: current.registryHashSha256,
    authoritative: true,
    simulated: false,
  });
  const simulatedCutoverState = deepFreeze({
    sequence: 1,
    mode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: freshShadowEvaluation.cycleId,
    sourceCandidateRegistryHashSha256: freshShadowEvaluation.candidateRegistryHashSha256,
    sourceCandidateRegistryContentSha256: freshShadowEvaluation.candidateRegistryContentSha256,
    sourceFreshCompositeEvidenceHashSha256: freshShadowEvaluation.freshCompositeEvidenceHashSha256,
    sourceFreshShadowEvaluationHashSha256: freshShadowEvaluation.freshShadowEvaluationHashSha256,
    authoritative: false,
    simulated: true,
  });
  const simulatedRollbackState = deepFreeze({
    sequence: 2,
    mode: MODE.LEGACY_FILE_SHA256,
    registryHashSha256: current.registryHashSha256,
    authoritative: true,
    simulated: true,
    restoresInitialRegistryHashExactly: true,
  });

  const core = {
    schemaVersion: 1,
    rehearsalId: id,
    cycleId: freshShadowEvaluation.cycleId,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    freshReactivationGovernanceCycleHashSha256: freshShadowEvaluation.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: freshShadowEvaluation.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: freshShadowEvaluation.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: freshShadowEvaluation.freshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    freshShadowEvaluationHashSha256: freshShadowEvaluation.freshShadowEvaluationHashSha256,
    transitions: [initialState, simulatedCutoverState, simulatedRollbackState],
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION,
    verified: true,
    blockers: Object.freeze([]),
    freshCutoverRehearsalHashSha256: sha256Object(core),
    cutoverSimulated: true,
    rollbackSimulated: true,
    rollbackRestoresExactAuthoritativeRegistry: simulatedRollbackState.registryHashSha256 === initialState.registryHashSha256,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    simulationOnly: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P54 deterministically rehearses LEGACY_FILE_SHA256 -> the P53 fresh governed-composite candidate -> LEGACY_FILE_SHA256 and proves modeled rollback to the exact starting registry hash. It performs no registry, release-mode or deployment mutation and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  p53ShadowCore,
  validateP53Shadow,
  runFreshCompositeCutoverRehearsal,
};
