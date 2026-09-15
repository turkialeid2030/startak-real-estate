'use strict';

const crypto = require('crypto');
const { EXPECTED_CANONICAL_SHA256 } = require('../../tools/canonical-source-evidence');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { validateP51Candidate } = require('./fresh-composite-evidence-verifier');
const {
  STATUS: P57_STATUS,
  createFreshActivationChangeContract,
} = require('./fresh-activation-change-contract');

const STATUS = Object.freeze({
  HOLD_FRESH_DUAL_MODE_CANONICAL_REGISTRY: 'HOLD_FRESH_DUAL_MODE_CANONICAL_REGISTRY',
  LEGACY_BASELINE_VERIFIED: 'LEGACY_BASELINE_VERIFIED',
  FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION: 'FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FRESH_TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'activeMode',
  'legacyBaseline',
  'governedCompositeBaseline',
  'freshReactivationGovernanceCycleHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'freshActivationPlanHashSha256',
  'activationApplied',
  'canonicalBaselineChanged',
  'legacyCanonicalEvidenceClosed',
  'existingE2iCanonicalEvidenceSatisfied',
  'releaseAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'goLiveAuthorized',
  'transactionAuthorized',
]);
const FRESH_BASELINE_KEYS = Object.freeze([
  'baselineId',
  'baselineType',
  'cycleId',
  'freshReactivationGovernanceCycleHashSha256',
  'qualifiedSourceCommitSha',
  'releaseArtifactSha256',
  'environmentConfigSha256',
  'expectedPriorRegistryHashSha256',
  'reviewPacketHashSha256',
  'freshReviewerDesignationHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'verifiedFreshReviewRecordHashSha256',
  'freshSuccessorBaselineManifestHashSha256',
]);

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function sha256Object(value) {
  return sha256Text(stableStringify(value));
}
function canonicalContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function exactKeys(object, allowed, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(object).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} contains missing or unknown fields`);
  }
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
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_DUAL_MODE_CANONICAL_REGISTRY,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    activeMode: extra.activeMode || null,
    registryHashSha256: extra.registryHashSha256 || null,
    registryContentSha256: extra.registryContentSha256 || null,
    legacyBaselineVerified: false,
    freshCompositeRegistryShapeVerified: false,
    p51CandidateReverified: false,
    p57ActivationChangeContractVerified: false,
    freshOwnerAuthorizationReverified: false,
    rollbackRegistryVerified: false,
    observedRegistryContentVerified: false,
    activationAppliedObserved: false,
    activationAuthorizedByThisVerifier: false,
    mutationPerformedByThisVerifier: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function verifyFreshCompositeRegistryShape(registry) {
  const blockers = [];
  try {
    exactKeys(registry, FRESH_TOP_LEVEL_KEYS, 'fresh composite canonical registry');
    if (registry.schemaVersion !== 3) throw new TypeError('schemaVersion must equal 3 for fresh governed composite baseline');
    if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) throw new TypeError('activeMode must equal GOVERNED_COMPOSITE_BASELINE');

    exactKeys(registry.legacyBaseline, ['expectedSha256', 'sourceAvailability', 'evidenceStatus'], 'legacyBaseline');
    if (requiredSha256(registry.legacyBaseline.expectedSha256, 'legacyBaseline.expectedSha256') !== EXPECTED_CANONICAL_SHA256) {
      throw new TypeError('legacyBaseline.expectedSha256 drifted from pinned historical hash');
    }
    if (registry.legacyBaseline.sourceAvailability !== 'UNAVAILABLE') throw new TypeError('legacyBaseline.sourceAvailability must remain UNAVAILABLE');
    if (registry.legacyBaseline.evidenceStatus !== 'NOT_EVALUATED') throw new TypeError('legacyBaseline.evidenceStatus must remain NOT_EVALUATED');

    exactKeys(registry.governedCompositeBaseline, FRESH_BASELINE_KEYS, 'governedCompositeBaseline');
    const baseline = registry.governedCompositeBaseline;
    requiredString(baseline.baselineId, 'governedCompositeBaseline.baselineId');
    if (baseline.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT') throw new TypeError('governedCompositeBaseline.baselineType invalid');
    requiredString(baseline.cycleId, 'governedCompositeBaseline.cycleId');
    if (!COMMIT_RE.test(requiredString(baseline.qualifiedSourceCommitSha, 'governedCompositeBaseline.qualifiedSourceCommitSha'))) {
      throw new TypeError('governedCompositeBaseline.qualifiedSourceCommitSha invalid');
    }
    for (const field of [
      'freshReactivationGovernanceCycleHashSha256',
      'releaseArtifactSha256',
      'environmentConfigSha256',
      'expectedPriorRegistryHashSha256',
      'reviewPacketHashSha256',
      'freshReviewerDesignationHashSha256',
      'freshReviewerLifecycleLockHashSha256',
      'verifiedFreshReviewRecordHashSha256',
      'freshSuccessorBaselineManifestHashSha256',
    ]) requiredSha256(baseline[field], `governedCompositeBaseline.${field}`);
    requiredSha256(registry.freshReactivationGovernanceCycleHashSha256, 'freshReactivationGovernanceCycleHashSha256');
    requiredSha256(registry.freshReviewerLifecycleLockHashSha256, 'freshReviewerLifecycleLockHashSha256');
    requiredSha256(registry.freshActivationPlanHashSha256, 'freshActivationPlanHashSha256');
    if (baseline.freshReactivationGovernanceCycleHashSha256 !== registry.freshReactivationGovernanceCycleHashSha256) throw new TypeError('fresh cycle hash binding mismatch');
    if (baseline.freshReviewerLifecycleLockHashSha256 !== registry.freshReviewerLifecycleLockHashSha256) throw new TypeError('fresh reviewer lock hash binding mismatch');
    if (registry.activationApplied !== true) throw new TypeError('activationApplied must equal true for active fresh composite registry');
    if (registry.canonicalBaselineChanged !== true) throw new TypeError('canonicalBaselineChanged must equal true for active fresh composite registry');
    if (registry.legacyCanonicalEvidenceClosed !== false) throw new TypeError('legacyCanonicalEvidenceClosed must remain false');
    if (registry.existingE2iCanonicalEvidenceSatisfied !== false) throw new TypeError('existingE2iCanonicalEvidenceSatisfied must remain false');
    if (!allAuthorityFalse(registry)) throw new TypeError('release/merge/deployment/go-live/transaction authority must remain false');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function p57ContractCore(contract) {
  return {
    schemaVersion: contract.schemaVersion,
    contractId: contract.contractId,
    preparedByRef: contract.preparedByRef,
    preparedAt: contract.preparedAt,
    targetPath: contract.targetPath,
    expectedPriorMode: contract.expectedPriorMode,
    proposedMode: contract.proposedMode,
    cycleId: contract.cycleId,
    freshReactivationGovernanceCycleHashSha256: contract.freshReactivationGovernanceCycleHashSha256,
    expectedPriorRegistryHashSha256: contract.expectedPriorRegistryHashSha256,
    freshReviewerLifecycleLockHashSha256: contract.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: contract.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: contract.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: contract.freshCompositeRegistryCandidateHashSha256,
    freshCutoverSafetyGuardHashSha256: contract.freshCutoverSafetyGuardHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: contract.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: contract.ownerAuthorityRegistryHashSha256,
    proposedRegistryHashSha256: contract.proposedRegistryHashSha256,
    proposedRegistryContentSha256: contract.proposedRegistryContentSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
  };
}

function validateP57ContractBoundary(contract) {
  const blockers = [];
  if (!contract || contract.status !== P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED) {
    return ['P57_FRESH_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (
    contract.verified !== true
    || contract.ownerActivationAuthorizationVerified !== true
    || contract.ownerSignatureVerified !== true
    || contract.ownerTrustRootVerified !== true
    || contract.activationAuthorizationEvidenceBound !== true
    || contract.rollbackRestoresExactCurrentLogicalRegistry !== true
    || contract.proposedRegistryRepresentsPostActivationStateOnly !== true
    || contract.actualRegistryMutationPerformed !== false
    || contract.actualReleaseGateModeChanged !== false
    || contract.actualDeploymentMutationPerformed !== false
    || contract.activationAuthorized !== false
    || contract.activationApplied !== false
    || contract.reactivationAuthorized !== false
    || contract.currentBaselineMutationPerformed !== false
    || contract.freshDualModeRegistryVerifierRequired !== true
    || contract.controlledActivationExecutionRequired !== true
    || contract.postActivationReleaseVerifyRequired !== true
    || contract.releaseStillBlocked !== true
    || !allAuthorityFalse(contract)
  ) blockers.push('P57_ACTIVATION_CHANGE_CONTRACT_BOUNDARY_INVALID');

  try {
    const contractHash = requiredSha256(contract.freshActivationChangeContractHashSha256, 'freshActivationChangeContractHashSha256');
    if (sha256Object(p57ContractCore(contract)) !== contractHash) blockers.push('P57_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH');
    for (const field of [
      'expectedPriorRegistryHashSha256',
      'freshReviewerLifecycleLockHashSha256',
      'freshActivationPlanHashSha256',
      'freshSuccessorBaselineManifestHashSha256',
      'freshCompositeRegistryCandidateHashSha256',
      'freshCutoverSafetyGuardHashSha256',
      'verifiedFreshOwnerAuthorizationRecordHashSha256',
      'ownerAuthorityRegistryHashSha256',
      'proposedRegistryHashSha256',
      'proposedRegistryContentSha256',
      'rollbackRegistryHashSha256',
      'rollbackRegistryContentSha256',
    ]) requiredSha256(contract[field], field);
    if (contract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || contract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P57_MODE_TRANSITION_INVALID');
    if (contract.targetPath !== 'config/governance/canonical-baseline.json') blockers.push('P57_TARGET_PATH_INVALID');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function verifyFreshDualModeCanonicalRegistry({
  registry,
  observedRegistryContent,
  activationChangeContract,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({
    registry,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    signedOwnerDecision,
    callerOverrides,
  });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return hold(['CANONICAL_REGISTRY_OBJECT_REQUIRED']);

  const computedContent = canonicalContent(registry);
  const computedContentHash = sha256Text(computedContent);

  if (registry.activeMode === MODE.LEGACY_FILE_SHA256) {
    const legacy = evaluateCurrentCanonicalBaselineRegistry(registry);
    if (legacy.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(legacy.blockers || ['LEGACY_BASELINE_NOT_VERIFIED']);
    if (observedRegistryContent != null && observedRegistryContent !== computedContent) {
      return hold(['LEGACY_REGISTRY_CONTENT_NOT_CANONICAL'], {
        activeMode: MODE.LEGACY_FILE_SHA256,
        registryHashSha256: legacy.registryHashSha256,
        registryContentSha256: computedContentHash,
      });
    }
    return deepFreeze({
      schemaVersion: 1,
      status: STATUS.LEGACY_BASELINE_VERIFIED,
      verified: true,
      blockers: Object.freeze([]),
      activeMode: MODE.LEGACY_FILE_SHA256,
      registrySchemaVersion: 1,
      registryHashSha256: legacy.registryHashSha256,
      registryContentSha256: computedContentHash,
      legacyBaselineVerified: true,
      freshCompositeRegistryShapeVerified: false,
      p51CandidateReverified: false,
      p57ActivationChangeContractVerified: false,
      freshOwnerAuthorizationReverified: false,
      rollbackRegistryVerified: false,
      observedRegistryContentVerified: observedRegistryContent == null ? false : true,
      activationAppliedObserved: false,
      activationAuthorizedByThisVerifier: false,
      mutationPerformedByThisVerifier: false,
      releaseStillBlocked: true,
      ...AUTHORITY,
      semantics: 'P58 preserves the strict legacy canonical-baseline verification path. No fresh activation evidence is inferred and no mutation or release authority is granted.',
    });
  }

  if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    return hold(['UNSUPPORTED_CANONICAL_BASELINE_MODE'], { activeMode: registry.activeMode || null, registryContentSha256: computedContentHash });
  }

  const shapeBlockers = verifyFreshCompositeRegistryShape(registry);
  if (shapeBlockers.length > 0) return hold(shapeBlockers, { activeMode: registry.activeMode, registryContentSha256: computedContentHash });
  if (typeof observedRegistryContent !== 'string' || observedRegistryContent === '') {
    return hold(['OBSERVED_ACTIVE_REGISTRY_CONTENT_REQUIRED'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }
  if (observedRegistryContent !== computedContent) {
    return hold(['OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }

  const contractBlockers = validateP57ContractBoundary(activationChangeContract);
  if (contractBlockers.length > 0) return hold(contractBlockers, { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });

  const candidateBlockers = validateP51Candidate(freshCompositeCandidate);
  if (candidateBlockers.length > 0) return hold(candidateBlockers, { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });

  const rollbackRegistry = activationChangeContract.rollbackRegistry;
  const rollback = evaluateCurrentCanonicalBaselineRegistry(rollbackRegistry);
  if (rollback.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['P57_ROLLBACK_REGISTRY_NOT_VALID_LEGACY_BASELINE'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }
  if (
    rollback.registryHashSha256 !== activationChangeContract.expectedPriorRegistryHashSha256
    || rollback.registryHashSha256 !== activationChangeContract.rollbackRegistryHashSha256
  ) {
    return hold(['P57_ROLLBACK_REGISTRY_HASH_BINDING_MISMATCH'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }
  const rollbackContent = canonicalContent(rollbackRegistry);
  if (
    activationChangeContract.rollbackRegistryContent !== rollbackContent
    || sha256Text(rollbackContent) !== activationChangeContract.rollbackRegistryContentSha256
  ) {
    return hold(['P57_ROLLBACK_REGISTRY_CONTENT_BINDING_MISMATCH'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }

  const recomputedContract = createFreshActivationChangeContract({
    currentRegistry: rollbackRegistry,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: activationChangeContract.contractId,
    preparedByRef: activationChangeContract.preparedByRef,
    preparedAt: activationChangeContract.preparedAt,
  });
  if (recomputedContract.status !== P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED || recomputedContract.verified !== true) {
    return hold(recomputedContract.blockers?.length ? recomputedContract.blockers : ['P57_CONTRACT_RECOMPUTATION_FAILED'], {
      activeMode: registry.activeMode,
      registryHashSha256: sha256Object(registry),
      registryContentSha256: computedContentHash,
    });
  }
  if (recomputedContract.freshActivationChangeContractHashSha256 !== activationChangeContract.freshActivationChangeContractHashSha256) {
    return hold(['P57_RECOMPUTED_CONTRACT_HASH_MISMATCH'], { activeMode: registry.activeMode, registryHashSha256: sha256Object(registry), registryContentSha256: computedContentHash });
  }

  const bindings = [];
  const registryHash = sha256Object(registry);
  if (registryHash !== activationChangeContract.proposedRegistryHashSha256) bindings.push('ACTIVE_REGISTRY_LOGICAL_HASH_MISMATCH');
  if (computedContentHash !== activationChangeContract.proposedRegistryContentSha256) bindings.push('ACTIVE_REGISTRY_CONTENT_HASH_MISMATCH');
  if (observedRegistryContent !== activationChangeContract.proposedRegistryContent) bindings.push('ACTIVE_REGISTRY_CONTENT_MISMATCH');
  if (stableStringify(registry) !== stableStringify(activationChangeContract.proposedRegistry)) bindings.push('ACTIVE_REGISTRY_OBJECT_MISMATCH');
  if (stableStringify(registry) !== stableStringify(freshCompositeCandidate.proposedRegistry)) bindings.push('ACTIVE_REGISTRY_P51_CANDIDATE_MISMATCH');
  if (activationChangeContract.freshCompositeRegistryCandidateHashSha256 !== freshCompositeCandidate.freshCompositeRegistryCandidateHashSha256) bindings.push('P57_P51_CANDIDATE_RECORD_BINDING_MISMATCH');
  if (registry.freshActivationPlanHashSha256 !== activationChangeContract.freshActivationPlanHashSha256) bindings.push('ACTIVE_REGISTRY_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (registry.freshReviewerLifecycleLockHashSha256 !== activationChangeContract.freshReviewerLifecycleLockHashSha256) bindings.push('ACTIVE_REGISTRY_REVIEWER_LOCK_BINDING_MISMATCH');
  if (registry.freshReactivationGovernanceCycleHashSha256 !== activationChangeContract.freshReactivationGovernanceCycleHashSha256) bindings.push('ACTIVE_REGISTRY_CYCLE_BINDING_MISMATCH');
  if (registry.governedCompositeBaseline.expectedPriorRegistryHashSha256 !== rollback.registryHashSha256) bindings.push('ACTIVE_REGISTRY_PRIOR_LEGACY_BINDING_MISMATCH');
  if (bindings.length > 0) return hold(bindings, { activeMode: registry.activeMode, registryHashSha256: registryHash, registryContentSha256: computedContentHash });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION,
    verified: true,
    blockers: Object.freeze([]),
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registrySchemaVersion: 3,
    registryHashSha256: registryHash,
    registryContentSha256: computedContentHash,
    expectedPriorRegistryHashSha256: rollback.registryHashSha256,
    freshReactivationGovernanceCycleHashSha256: registry.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: registry.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: registry.freshActivationPlanHashSha256,
    freshCompositeRegistryCandidateHashSha256: freshCompositeCandidate.freshCompositeRegistryCandidateHashSha256,
    freshActivationChangeContractHashSha256: activationChangeContract.freshActivationChangeContractHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: activationChangeContract.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: activationChangeContract.ownerAuthorityRegistryHashSha256,
    legacyBaselineVerified: true,
    freshCompositeRegistryShapeVerified: true,
    p51CandidateReverified: true,
    p57ActivationChangeContractVerified: true,
    freshOwnerAuthorizationReverified: true,
    rollbackRegistryVerified: true,
    observedRegistryContentVerified: true,
    activationAppliedObserved: true,
    activationAuthorizedByThisVerifier: false,
    mutationPerformedByThisVerifier: false,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P58 verifies an observed schema-v3 fresh governed-composite registry only when it exactly matches the P57 contract and P51 candidate and the P56 owner signature/trust root are re-verified through P57 recomputation. It performs no mutation and grants no release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  FRESH_TOP_LEVEL_KEYS,
  FRESH_BASELINE_KEYS,
  p57ContractCore,
  verifyFreshCompositeRegistryShape,
  validateP57ContractBoundary,
  verifyFreshDualModeCanonicalRegistry,
};
