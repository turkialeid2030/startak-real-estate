'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P71_STATUS } = require('./successor-fresh-composite-shadow-release-gate');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL: 'HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL',
  SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION: 'SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION',
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
function hold(blockers, current = null, shadow = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_CUTOVER_REHEARSAL,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    cycleId: shadow?.cycleId || null,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    currentRegistryContentSha256: shadow?.currentRegistryContentSha256 || null,
    successorFreshShadowEvaluationHashSha256: shadow?.successorFreshShadowEvaluationHashSha256 || null,
    successorFreshCutoverRehearsalHashSha256: null,
    cutoverSimulated: false,
    rollbackSimulated: false,
    rollbackRestoresExactAuthoritativeRegistry: false,
    rollbackRestoresExactAuthoritativeRegistryContent: false,
    simulationOnly: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function p71ShadowCore(shadow) {
  return {
    schemaVersion: shadow.schemaVersion,
    authoritativeMode: shadow.authoritativeMode,
    shadowMode: shadow.shadowMode,
    cycleId: shadow.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: shadow.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: shadow.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: shadow.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: shadow.successorFreshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: shadow.currentRegistryHashSha256,
    currentRegistryContentSha256: shadow.currentRegistryContentSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    candidateRegistryContentSha256: shadow.candidateRegistryContentSha256,
    successorFreshCompositeEvidenceHashSha256: shadow.successorFreshCompositeEvidenceHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: shadow.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: shadow.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: shadow.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: shadow.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: shadow.predecessorCorrectivePreventiveActionSha256,
  };
}

function validateP71Shadow(shadow, current, currentRegistry, currentRegistryContent) {
  const blockers = [];
  if (!shadow || shadow.status !== P71_STATUS.SUCCESSOR_FRESH_SHADOW_COMPOSITE_MATCH_NOT_ACTIVE) {
    return ['P71_SUCCESSOR_FRESH_SHADOW_MATCH_REQUIRED'];
  }
  if (
    shadow.verified !== true
    || shadow.shadowComparisonMatch !== true
    || shadow.shadowOnly !== true
    || shadow.candidateOnly !== true
    || shadow.authoritativeBaselineRemainsLegacy !== true
    || shadow.exactPriorRawRegistryVerified !== true
    || shadow.activeRegistryChanged !== false
    || shadow.activationAuthorized !== false
    || shadow.activationApplied !== false
    || shadow.reactivationAuthorized !== false
    || shadow.currentBaselineMutationPerformed !== false
    || shadow.successorFreshCutoverRehearsalRequired !== true
    || shadow.successorFreshCutoverSafetyEvidenceRequired !== true
    || shadow.successorFreshOwnerActivationAuthorizationRequired !== true
    || shadow.successorFreshActivationChangeContractRequired !== true
    || shadow.successorFreshModeVerifierRequired !== true
    || shadow.releaseStillBlocked !== true
    || !allAuthorityFalse(shadow)
  ) blockers.push('P71_SUCCESSOR_FRESH_SHADOW_BOUNDARY_INVALID');
  if (shadow.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || shadow.shadowMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P71_SUCCESSOR_FRESH_SHADOW_MODE_INVALID');
  }
  try {
    const hash = requiredSha256(shadow.successorFreshShadowEvaluationHashSha256, 'successorFreshShadowEvaluationHashSha256');
    if (sha256Object(p71ShadowCore(shadow)) !== hash) blockers.push('P71_SUCCESSOR_FRESH_SHADOW_HASH_MISMATCH');
    if (shadow.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P71_SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_HASH_MISMATCH');
    if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') blockers.push('CURRENT_REGISTRY_RAW_CONTENT_REQUIRED');
    else {
      if (sha256Text(currentRegistryContent) !== shadow.currentRegistryContentSha256) blockers.push('P71_SUCCESSOR_FRESH_SHADOW_CURRENT_REGISTRY_CONTENT_HASH_MISMATCH');
      try {
        const parsed = JSON.parse(currentRegistryContent);
        if (stableStringify(parsed) !== stableStringify(currentRegistry)) blockers.push('CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH');
      } catch (_) {
        blockers.push('CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON');
      }
    }
    for (const field of [
      'successorFreshReactivationGovernanceCycleHashSha256',
      'successorFreshReviewerLifecycleLockHashSha256',
      'successorFreshActivationPlanHashSha256',
      'successorFreshCompositeRegistryCandidateHashSha256',
      'currentRegistryHashSha256',
      'currentRegistryContentSha256',
      'candidateRegistryHashSha256',
      'candidateRegistryContentSha256',
      'successorFreshCompositeEvidenceHashSha256',
      'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256',
      'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) requiredSha256(shadow[field], field);
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function runSuccessorFreshCompositeCutoverRehearsal({
  currentRegistry,
  currentRegistryContent,
  successorFreshShadowEvaluation,
  rehearsalId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial(callerOverrides);
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, successorFreshShadowEvaluation);
  }
  const shadowBlockers = validateP71Shadow(successorFreshShadowEvaluation, current, currentRegistry, currentRegistryContent);
  if (shadowBlockers.length > 0) return hold(shadowBlockers, current, successorFreshShadowEvaluation);

  let id;
  let preparer;
  let preparedAtIso;
  try {
    id = requiredString(rehearsalId, 'rehearsalId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], current, successorFreshShadowEvaluation);
  }

  const shadow = successorFreshShadowEvaluation;
  const initialState = deepFreeze({
    sequence: 0,
    mode: MODE.LEGACY_FILE_SHA256,
    registryHashSha256: current.registryHashSha256,
    registryContentSha256: shadow.currentRegistryContentSha256,
    authoritative: true,
    simulated: false,
  });
  const simulatedCutoverState = deepFreeze({
    sequence: 1,
    mode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registrySchemaVersion: 4,
    cycleId: shadow.cycleId,
    sourceCandidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    sourceCandidateRegistryContentSha256: shadow.candidateRegistryContentSha256,
    sourceSuccessorFreshCompositeEvidenceHashSha256: shadow.successorFreshCompositeEvidenceHashSha256,
    sourceSuccessorFreshShadowEvaluationHashSha256: shadow.successorFreshShadowEvaluationHashSha256,
    authoritative: false,
    simulated: true,
  });
  const simulatedRollbackState = deepFreeze({
    sequence: 2,
    mode: MODE.LEGACY_FILE_SHA256,
    registryHashSha256: current.registryHashSha256,
    registryContentSha256: shadow.currentRegistryContentSha256,
    authoritative: true,
    simulated: true,
    restoresInitialRegistryHashExactly: true,
    restoresInitialRegistryContentHashExactly: true,
  });

  const core = {
    schemaVersion: 1,
    rehearsalId: id,
    cycleId: shadow.cycleId,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    successorFreshReactivationGovernanceCycleHashSha256: shadow.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: shadow.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: shadow.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: shadow.successorFreshCompositeRegistryCandidateHashSha256,
    currentRegistryHashSha256: current.registryHashSha256,
    currentRegistryContentSha256: shadow.currentRegistryContentSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    candidateRegistryContentSha256: shadow.candidateRegistryContentSha256,
    successorFreshShadowEvaluationHashSha256: shadow.successorFreshShadowEvaluationHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: shadow.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: shadow.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: shadow.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: shadow.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: shadow.predecessorCorrectivePreventiveActionSha256,
    transitions: [initialState, simulatedCutoverState, simulatedRollbackState],
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshCutoverRehearsalHashSha256: sha256Object(core),
    cutoverSimulated: true,
    rollbackSimulated: true,
    rollbackRestoresExactAuthoritativeRegistry: simulatedRollbackState.registryHashSha256 === initialState.registryHashSha256,
    rollbackRestoresExactAuthoritativeRegistryContent: simulatedRollbackState.registryContentSha256 === initialState.registryContentSha256,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    simulationOnly: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P72 deterministically rehearses LEGACY_FILE_SHA256 -> the P71-verified schema-v4 successor governed-composite candidate -> the exact starting LEGACY_FILE_SHA256 logical and raw-content hashes. It performs no registry, release-mode or deployment mutation and grants no activation, reactivation or release authority.',
  });
}

module.exports = {
  STATUS,
  p71ShadowCore,
  validateP71Shadow,
  runSuccessorFreshCompositeCutoverRehearsal,
};
