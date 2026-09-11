'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P36_STATUS,
} = require('./composite-baseline-shadow-release-gate');

const STATUS = Object.freeze({
  HOLD_CUTOVER_REHEARSAL: 'HOLD_CUTOVER_REHEARSAL',
  CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION: 'CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION',
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

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function allAuthorityFalse(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).every((field) => value[field] === false);
}

function hold(blockers, current = null, shadow = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_CUTOVER_REHEARSAL,
    blockers: Object.freeze([...new Set(blockers)]),
    authoritativeModeBefore: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    simulatedCutoverMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    authoritativeModeAfterRollback: current?.activeMode || MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    shadowEvaluationHashSha256: shadow?.shadowEvaluationHashSha256 || null,
    rehearsalHashSha256: null,
    cutoverSimulated: false,
    rollbackSimulated: false,
    rollbackRestoresExactAuthoritativeRegistry: false,
    simulationOnly: true,
    activationApplied: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  });
}

function verifyShadowResult(shadow, current) {
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
  ) blockers.push('P36_SHADOW_AUTHORITY_BOUNDARY_INVALID');
  if (shadow.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || shadow.shadowMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P36_SHADOW_MODE_TRANSITION_INVALID');
  }
  if (!SHA256_RE.test(shadow.shadowEvaluationHashSha256 || '')) blockers.push('P36_SHADOW_EVALUATION_HASH_INVALID');
  if (shadow.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P36_SHADOW_CURRENT_REGISTRY_HASH_MISMATCH');

  const shadowCore = {
    schemaVersion: shadow.schemaVersion,
    authoritativeMode: shadow.authoritativeMode,
    shadowMode: shadow.shadowMode,
    currentRegistryHashSha256: shadow.currentRegistryHashSha256,
    candidateRegistryHashSha256: shadow.candidateRegistryHashSha256,
    compositeEvidenceHashSha256: shadow.compositeEvidenceHashSha256,
    activationPlanHashSha256: shadow.activationPlanHashSha256,
    successorBaselineManifestHashSha256: shadow.successorBaselineManifestHashSha256,
  };
  if (sha256Object(shadowCore) !== shadow.shadowEvaluationHashSha256) blockers.push('P36_SHADOW_EVALUATION_HASH_MISMATCH');
  for (const field of [
    'candidateRegistryHashSha256',
    'compositeEvidenceHashSha256',
    'activationPlanHashSha256',
    'successorBaselineManifestHashSha256',
  ]) {
    if (!SHA256_RE.test(shadow[field] || '')) blockers.push(`P36_${field.toUpperCase()}_INVALID`);
  }
  return blockers;
}

function runCompositeBaselineCutoverRehearsal({
  currentRegistry,
  shadowEvaluation,
  rehearsalId,
  preparedByRef,
  preparedAt,
} = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, shadowEvaluation);
  }

  const shadowBlockers = verifyShadowResult(shadowEvaluation, current);
  if (shadowBlockers.length > 0) return hold(shadowBlockers, current, shadowEvaluation);

  let id;
  let preparer;
  let preparedAtIso;
  try {
    id = requiredString(rehearsalId, 'rehearsalId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message], current, shadowEvaluation);
  }

  const initialState = deepFreeze({
    sequence: 0,
    mode: MODE.LEGACY_FILE_SHA256,
    registryHashSha256: current.registryHashSha256,
    authoritative: true,
  });

  const simulatedCutoverState = deepFreeze({
    sequence: 1,
    mode: MODE.GOVERNED_COMPOSITE_BASELINE,
    sourceCandidateRegistryHashSha256: shadowEvaluation.candidateRegistryHashSha256,
    sourceCompositeEvidenceHashSha256: shadowEvaluation.compositeEvidenceHashSha256,
    sourceActivationPlanHashSha256: shadowEvaluation.activationPlanHashSha256,
    sourceSuccessorBaselineManifestHashSha256: shadowEvaluation.successorBaselineManifestHashSha256,
    shadowEvaluationHashSha256: shadowEvaluation.shadowEvaluationHashSha256,
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

  const transitionCore = {
    schemaVersion: 1,
    rehearsalId: id,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    currentRegistryHashSha256: current.registryHashSha256,
    shadowEvaluationHashSha256: shadowEvaluation.shadowEvaluationHashSha256,
    transitions: [initialState, simulatedCutoverState, simulatedRollbackState],
  };

  return deepFreeze({
    ...transitionCore,
    status: STATUS.CUTOVER_REHEARSAL_COMPLETED_NO_ACTIVATION,
    rehearsalHashSha256: sha256Object(transitionCore),
    blockers: Object.freeze([]),
    cutoverSimulated: true,
    rollbackSimulated: true,
    rollbackRestoresExactAuthoritativeRegistry: simulatedRollbackState.registryHashSha256 === initialState.registryHashSha256,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    simulationOnly: true,
    activationApplied: false,
    independentReviewStillRequiredForRealActivation: true,
    explicitActivationCodeChangeStillRequired: true,
    postActivationReleaseVerifyStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'This deterministic rehearsal simulates LEGACY_FILE_SHA256 -> GOVERNED_COMPOSITE_BASELINE -> LEGACY_FILE_SHA256 using a verified P36 shadow result and proves that the modeled rollback returns to the exact starting registry hash. It performs no registry mutation, no release-mode change, no deployment, and grants no release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  runCompositeBaselineCutoverRehearsal,
};
