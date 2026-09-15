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
const { validateP69Candidate } = require('./successor-fresh-composite-evidence-verifier');
const {
  STATUS: P75_STATUS,
  createSuccessorFreshActivationChangeContract,
} = require('./successor-fresh-activation-change-contract');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY: 'HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY',
  LEGACY_BASELINE_VERIFIED: 'LEGACY_BASELINE_VERIFIED',
  SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION: 'SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const SUCCESSOR_TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'activeMode',
  'legacyBaseline',
  'governedCompositeBaseline',
  'successorFreshReactivationGovernanceCycleHashSha256',
  'successorFreshReviewerLifecycleLockHashSha256',
  'successorFreshActivationPlanHashSha256',
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
const SUCCESSOR_BASELINE_KEYS = Object.freeze([
  'baselineId',
  'baselineType',
  'cycleId',
  'successorFreshReactivationGovernanceCycleHashSha256',
  'qualifiedSourceCommitSha',
  'releaseArtifactSha256',
  'environmentConfigSha256',
  'expectedPriorRegistryHashSha256',
  'expectedPriorRegistryContentSha256',
  'successorFreshReviewPacketHashSha256',
  'successorFreshReviewerDesignationHashSha256',
  'successorFreshReviewerLifecycleLockHashSha256',
  'verifiedSuccessorFreshReviewRecordHashSha256',
  'successorFreshBaselineManifestHashSha256',
  'cycleEvidenceArtifactSha256',
  'predecessorIncidentCloseoutPacketHashSha256',
  'predecessorHumanDecisionRecordHashSha256',
  'predecessorGovernanceResetRecordHashSha256',
  'predecessorRootCauseAnalysisSha256',
  'predecessorCorrectivePreventiveActionSha256',
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
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.activationAuthorized != null && value.activationAuthorized !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_DUAL_MODE_CANONICAL_REGISTRY,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    activeMode: extra.activeMode || null,
    registrySchemaVersion: extra.registrySchemaVersion || null,
    registryHashSha256: extra.registryHashSha256 || null,
    registryContentSha256: extra.registryContentSha256 || null,
    expectedPriorRegistryHashSha256: extra.expectedPriorRegistryHashSha256 || null,
    expectedPriorRegistryContentSha256: extra.expectedPriorRegistryContentSha256 || null,
    legacyBaselineVerified: false,
    successorCompositeRegistryShapeVerified: false,
    p69CandidateReverified: false,
    p75ActivationChangeContractVerified: false,
    successorOwnerAuthorizationReverified: false,
    rollbackRegistryVerified: false,
    rollbackRawContentVerified: false,
    observedRegistryContentVerified: false,
    activationAppliedObserved: false,
    activationAuthorizedByThisVerifier: false,
    mutationPerformedByThisVerifier: false,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function verifySuccessorCompositeRegistryShape(registry) {
  const blockers = [];
  try {
    exactKeys(registry, SUCCESSOR_TOP_LEVEL_KEYS, 'successor fresh composite canonical registry');
    if (registry.schemaVersion !== 4) throw new TypeError('schemaVersion must equal 4 for successor fresh governed composite baseline');
    if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) throw new TypeError('activeMode must equal GOVERNED_COMPOSITE_BASELINE');

    exactKeys(registry.legacyBaseline, ['expectedSha256', 'sourceAvailability', 'evidenceStatus'], 'legacyBaseline');
    if (requiredSha256(registry.legacyBaseline.expectedSha256, 'legacyBaseline.expectedSha256') !== EXPECTED_CANONICAL_SHA256) {
      throw new TypeError('legacyBaseline.expectedSha256 drifted from pinned historical hash');
    }
    if (registry.legacyBaseline.sourceAvailability !== 'UNAVAILABLE') throw new TypeError('legacyBaseline.sourceAvailability must remain UNAVAILABLE');
    if (registry.legacyBaseline.evidenceStatus !== 'NOT_EVALUATED') throw new TypeError('legacyBaseline.evidenceStatus must remain NOT_EVALUATED');

    exactKeys(registry.governedCompositeBaseline, SUCCESSOR_BASELINE_KEYS, 'governedCompositeBaseline');
    const baseline = registry.governedCompositeBaseline;
    requiredString(baseline.baselineId, 'governedCompositeBaseline.baselineId');
    if (baseline.baselineType !== 'QUALIFIED_GIT_COMMIT_AND_RELEASE_ARTIFACT') throw new TypeError('governedCompositeBaseline.baselineType invalid');
    requiredString(baseline.cycleId, 'governedCompositeBaseline.cycleId');
    if (!COMMIT_RE.test(requiredString(baseline.qualifiedSourceCommitSha, 'governedCompositeBaseline.qualifiedSourceCommitSha'))) {
      throw new TypeError('governedCompositeBaseline.qualifiedSourceCommitSha invalid');
    }
    for (const field of [
      'successorFreshReactivationGovernanceCycleHashSha256',
      'releaseArtifactSha256',
      'environmentConfigSha256',
      'expectedPriorRegistryHashSha256',
      'expectedPriorRegistryContentSha256',
      'successorFreshReviewPacketHashSha256',
      'successorFreshReviewerDesignationHashSha256',
      'successorFreshReviewerLifecycleLockHashSha256',
      'verifiedSuccessorFreshReviewRecordHashSha256',
      'successorFreshBaselineManifestHashSha256',
      'cycleEvidenceArtifactSha256',
      'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256',
      'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) requiredSha256(baseline[field], `governedCompositeBaseline.${field}`);

    requiredSha256(registry.successorFreshReactivationGovernanceCycleHashSha256, 'successorFreshReactivationGovernanceCycleHashSha256');
    requiredSha256(registry.successorFreshReviewerLifecycleLockHashSha256, 'successorFreshReviewerLifecycleLockHashSha256');
    requiredSha256(registry.successorFreshActivationPlanHashSha256, 'successorFreshActivationPlanHashSha256');
    if (baseline.successorFreshReactivationGovernanceCycleHashSha256 !== registry.successorFreshReactivationGovernanceCycleHashSha256) throw new TypeError('successor fresh cycle hash binding mismatch');
    if (baseline.successorFreshReviewerLifecycleLockHashSha256 !== registry.successorFreshReviewerLifecycleLockHashSha256) throw new TypeError('successor fresh reviewer lock hash binding mismatch');
    if (registry.activationApplied !== true) throw new TypeError('activationApplied must equal true for active successor fresh composite registry');
    if (registry.canonicalBaselineChanged !== true) throw new TypeError('canonicalBaselineChanged must equal true for active successor fresh composite registry');
    if (registry.legacyCanonicalEvidenceClosed !== false) throw new TypeError('legacyCanonicalEvidenceClosed must remain false');
    if (registry.existingE2iCanonicalEvidenceSatisfied !== false) throw new TypeError('existingE2iCanonicalEvidenceSatisfied must remain false');
    if (!allAuthorityFalse(registry)) throw new TypeError('release/merge/deployment/go-live/transaction authority must remain false');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function p75ContractCore(contract) {
  return {
    schemaVersion: contract.schemaVersion,
    contractId: contract.contractId,
    preparedByRef: contract.preparedByRef,
    preparedAt: contract.preparedAt,
    targetPath: contract.targetPath,
    expectedPriorMode: contract.expectedPriorMode,
    proposedMode: contract.proposedMode,
    proposedRegistrySchemaVersion: contract.proposedRegistrySchemaVersion,
    cycleId: contract.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: contract.successorFreshReactivationGovernanceCycleHashSha256,
    expectedPriorRegistryHashSha256: contract.expectedPriorRegistryHashSha256,
    expectedPriorRegistryContentSha256: contract.expectedPriorRegistryContentSha256,
    successorFreshReviewerLifecycleLockHashSha256: contract.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: contract.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: contract.successorFreshBaselineManifestHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: contract.successorFreshCompositeRegistryCandidateHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: contract.successorFreshCutoverSafetyGuardHashSha256,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: contract.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    successorOwnerAuthorityRegistryHashSha256: contract.successorOwnerAuthorityRegistryHashSha256,
    proposedRegistryHashSha256: contract.proposedRegistryHashSha256,
    proposedRegistryContentSha256: contract.proposedRegistryContentSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
    predecessorIncidentCloseoutPacketHashSha256: contract.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: contract.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: contract.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: contract.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: contract.predecessorCorrectivePreventiveActionSha256,
  };
}

function validateP75ContractBoundary(contract) {
  const blockers = [];
  if (!contract || contract.status !== P75_STATUS.SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED) {
    return ['P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (
    contract.verified !== true
    || contract.ownerActivationAuthorizationVerified !== true
    || contract.ownerSignatureVerified !== true
    || contract.ownerTrustRootVerified !== true
    || contract.activationAuthorizationEvidenceBound !== true
    || contract.rollbackRestoresExactCurrentLogicalRegistry !== true
    || contract.rollbackRestoresExactCurrentRawRegistry !== true
    || contract.proposedRegistryRepresentsPostActivationStateOnly !== true
    || contract.actualRegistryMutationPerformed !== false
    || contract.actualReleaseGateModeChanged !== false
    || contract.actualDeploymentMutationPerformed !== false
    || contract.activationAuthorized !== false
    || contract.activationApplied !== false
    || contract.reactivationAuthorized !== false
    || contract.currentBaselineMutationPerformed !== false
    || contract.predecessorFreshActivationContractReusable !== false
    || contract.successorFreshDualModeRegistryVerifierRequired !== true
    || contract.controlledActivationExecutionRequired !== true
    || contract.postActivationReleaseVerifyRequired !== true
    || contract.releaseStillBlocked !== true
    || !allAuthorityFalse(contract)
  ) blockers.push('P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_BOUNDARY_INVALID');

  try {
    const contractHash = requiredSha256(contract.successorFreshActivationChangeContractHashSha256, 'successorFreshActivationChangeContractHashSha256');
    if (sha256Object(p75ContractCore(contract)) !== contractHash) blockers.push('P75_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH');
    for (const field of [
      'expectedPriorRegistryHashSha256',
      'expectedPriorRegistryContentSha256',
      'successorFreshReviewerLifecycleLockHashSha256',
      'successorFreshActivationPlanHashSha256',
      'successorFreshBaselineManifestHashSha256',
      'successorFreshCompositeRegistryCandidateHashSha256',
      'successorFreshCutoverSafetyGuardHashSha256',
      'verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256',
      'successorOwnerAuthorityRegistryHashSha256',
      'proposedRegistryHashSha256',
      'proposedRegistryContentSha256',
      'rollbackRegistryHashSha256',
      'rollbackRegistryContentSha256',
      'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256',
      'predecessorGovernanceResetRecordHashSha256',
      'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) requiredSha256(contract[field], field);
    if (contract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || contract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P75_MODE_TRANSITION_INVALID');
    if (contract.proposedRegistrySchemaVersion !== 4) blockers.push('P75_PROPOSED_REGISTRY_SCHEMA_MUST_EQUAL_4');
    if (contract.targetPath !== 'config/governance/canonical-baseline.json') blockers.push('P75_TARGET_PATH_INVALID');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function verifySuccessorFreshDualModeCanonicalRegistry({
  registry,
  observedRegistryContent,
  activationChangeContract,
  successorReviewPacket,
  reviewerLifecycle,
  activationPlan,
  successorFreshCompositeCandidate,
  successorFreshShadowEvaluation,
  successorFreshRehearsalResult,
  safetyGuard,
  successorFreshOwnerAuthorityRegistry,
  expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({
    registry,
    activationChangeContract,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshCompositeCandidate,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    safetyGuard,
    successorFreshOwnerAuthorityRegistry,
    signedOwnerDecision,
    callerOverrides,
  });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return hold(['CANONICAL_REGISTRY_OBJECT_REQUIRED']);

  const computedCanonicalContent = canonicalContent(registry);
  const computedCanonicalContentHash = sha256Text(computedCanonicalContent);

  if (registry.activeMode === MODE.LEGACY_FILE_SHA256) {
    const legacy = evaluateCurrentCanonicalBaselineRegistry(registry);
    if (legacy.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(legacy.blockers || ['LEGACY_BASELINE_NOT_VERIFIED']);
    if (observedRegistryContent != null && observedRegistryContent !== computedCanonicalContent) {
      return hold(['LEGACY_REGISTRY_CONTENT_NOT_CANONICAL'], {
        activeMode: MODE.LEGACY_FILE_SHA256,
        registrySchemaVersion: 1,
        registryHashSha256: legacy.registryHashSha256,
        registryContentSha256: sha256Text(String(observedRegistryContent)),
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
      registryContentSha256: observedRegistryContent == null ? computedCanonicalContentHash : sha256Text(observedRegistryContent),
      legacyBaselineVerified: true,
      successorCompositeRegistryShapeVerified: false,
      p69CandidateReverified: false,
      p75ActivationChangeContractVerified: false,
      successorOwnerAuthorizationReverified: false,
      rollbackRegistryVerified: false,
      rollbackRawContentVerified: false,
      observedRegistryContentVerified: observedRegistryContent != null,
      activationAppliedObserved: false,
      activationAuthorizedByThisVerifier: false,
      mutationPerformedByThisVerifier: false,
      postActivationReleaseVerifyRequired: true,
      releaseStillBlocked: true,
      ...AUTHORITY,
      semantics: 'P76 preserves the strict legacy canonical-baseline verification path. No successor activation evidence is inferred and no mutation or release authority is granted.',
    });
  }

  if (registry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    return hold(['UNSUPPORTED_CANONICAL_BASELINE_MODE'], {
      activeMode: registry.activeMode || null,
      registrySchemaVersion: registry.schemaVersion || null,
      registryHashSha256: sha256Object(registry),
      registryContentSha256: computedCanonicalContentHash,
    });
  }

  const shapeBlockers = verifySuccessorCompositeRegistryShape(registry);
  if (shapeBlockers.length > 0) return hold(shapeBlockers, {
    activeMode: registry.activeMode,
    registrySchemaVersion: registry.schemaVersion,
    registryHashSha256: sha256Object(registry),
    registryContentSha256: computedCanonicalContentHash,
  });

  if (typeof observedRegistryContent !== 'string' || observedRegistryContent === '') {
    return hold(['OBSERVED_ACTIVE_REGISTRY_CONTENT_REQUIRED'], {
      activeMode: registry.activeMode,
      registrySchemaVersion: registry.schemaVersion,
      registryHashSha256: sha256Object(registry),
      registryContentSha256: computedCanonicalContentHash,
    });
  }
  if (observedRegistryContent !== computedCanonicalContent) {
    return hold(['OBSERVED_ACTIVE_REGISTRY_CONTENT_NOT_CANONICAL'], {
      activeMode: registry.activeMode,
      registrySchemaVersion: registry.schemaVersion,
      registryHashSha256: sha256Object(registry),
      registryContentSha256: sha256Text(observedRegistryContent),
    });
  }

  const contractBlockers = validateP75ContractBoundary(activationChangeContract);
  if (contractBlockers.length > 0) return hold(contractBlockers, {
    activeMode: registry.activeMode,
    registrySchemaVersion: registry.schemaVersion,
    registryHashSha256: sha256Object(registry),
    registryContentSha256: sha256Text(observedRegistryContent),
  });

  const candidateBlockers = validateP69Candidate(successorFreshCompositeCandidate);
  if (candidateBlockers.length > 0) return hold(candidateBlockers, {
    activeMode: registry.activeMode,
    registrySchemaVersion: registry.schemaVersion,
    registryHashSha256: sha256Object(registry),
    registryContentSha256: sha256Text(observedRegistryContent),
  });

  const rollbackRegistry = activationChangeContract.rollbackRegistry;
  const rollbackRegistryContent = activationChangeContract.rollbackRegistryContent;
  const rollback = evaluateCurrentCanonicalBaselineRegistry(rollbackRegistry);
  if (rollback.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['P75_ROLLBACK_REGISTRY_NOT_VALID_LEGACY_BASELINE'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }
  if (typeof rollbackRegistryContent !== 'string' || rollbackRegistryContent === '') {
    return hold(['P75_ROLLBACK_REGISTRY_RAW_CONTENT_REQUIRED'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }
  let parsedRollback;
  try { parsedRollback = JSON.parse(rollbackRegistryContent); } catch (_) {
    return hold(['P75_ROLLBACK_REGISTRY_RAW_CONTENT_NOT_JSON'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }
  if (stableStringify(parsedRollback) !== stableStringify(rollbackRegistry)) {
    return hold(['P75_ROLLBACK_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }
  const rollbackContentHash = sha256Text(rollbackRegistryContent);
  if (
    rollback.registryHashSha256 !== activationChangeContract.expectedPriorRegistryHashSha256
    || rollback.registryHashSha256 !== activationChangeContract.rollbackRegistryHashSha256
  ) {
    return hold(['P75_ROLLBACK_REGISTRY_HASH_BINDING_MISMATCH'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }
  if (
    rollbackContentHash !== activationChangeContract.expectedPriorRegistryContentSha256
    || rollbackContentHash !== activationChangeContract.rollbackRegistryContentSha256
  ) {
    return hold(['P75_ROLLBACK_REGISTRY_CONTENT_BINDING_MISMATCH'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }

  const recomputedContract = createSuccessorFreshActivationChangeContract({
    currentRegistry: rollbackRegistry,
    currentRegistryContent: rollbackRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshCompositeCandidate,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    safetyGuard,
    successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
    contractId: activationChangeContract.contractId,
    preparedByRef: activationChangeContract.preparedByRef,
    preparedAt: activationChangeContract.preparedAt,
  });
  if (recomputedContract.status !== P75_STATUS.SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED || recomputedContract.verified !== true) {
    return hold(recomputedContract.blockers?.length ? recomputedContract.blockers : ['P75_CONTRACT_RECOMPUTATION_FAILED'], {
      activeMode: registry.activeMode,
      registrySchemaVersion: 4,
      registryHashSha256: sha256Object(registry),
      registryContentSha256: sha256Text(observedRegistryContent),
    });
  }
  if (recomputedContract.successorFreshActivationChangeContractHashSha256 !== activationChangeContract.successorFreshActivationChangeContractHashSha256) {
    return hold(['P75_RECOMPUTED_CONTRACT_HASH_MISMATCH'], { activeMode: registry.activeMode, registrySchemaVersion: 4 });
  }

  const bindings = [];
  const registryHash = sha256Object(registry);
  const registryContentHash = sha256Text(observedRegistryContent);
  if (registryHash !== activationChangeContract.proposedRegistryHashSha256) bindings.push('ACTIVE_REGISTRY_LOGICAL_HASH_MISMATCH');
  if (registryContentHash !== activationChangeContract.proposedRegistryContentSha256) bindings.push('ACTIVE_REGISTRY_CONTENT_HASH_MISMATCH');
  if (observedRegistryContent !== activationChangeContract.proposedRegistryContent) bindings.push('ACTIVE_REGISTRY_CONTENT_MISMATCH');
  if (stableStringify(registry) !== stableStringify(activationChangeContract.proposedRegistry)) bindings.push('ACTIVE_REGISTRY_OBJECT_MISMATCH');
  if (stableStringify(registry) !== stableStringify(successorFreshCompositeCandidate.proposedRegistry)) bindings.push('ACTIVE_REGISTRY_P69_CANDIDATE_MISMATCH');
  if (activationChangeContract.successorFreshCompositeRegistryCandidateHashSha256 !== successorFreshCompositeCandidate.successorFreshCompositeRegistryCandidateHashSha256) bindings.push('P75_P69_CANDIDATE_RECORD_BINDING_MISMATCH');
  if (registry.successorFreshActivationPlanHashSha256 !== activationChangeContract.successorFreshActivationPlanHashSha256) bindings.push('ACTIVE_REGISTRY_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (registry.successorFreshReviewerLifecycleLockHashSha256 !== activationChangeContract.successorFreshReviewerLifecycleLockHashSha256) bindings.push('ACTIVE_REGISTRY_REVIEWER_LOCK_BINDING_MISMATCH');
  if (registry.successorFreshReactivationGovernanceCycleHashSha256 !== activationChangeContract.successorFreshReactivationGovernanceCycleHashSha256) bindings.push('ACTIVE_REGISTRY_CYCLE_BINDING_MISMATCH');
  if (registry.governedCompositeBaseline.expectedPriorRegistryHashSha256 !== rollback.registryHashSha256) bindings.push('ACTIVE_REGISTRY_PRIOR_LEGACY_HASH_BINDING_MISMATCH');
  if (registry.governedCompositeBaseline.expectedPriorRegistryContentSha256 !== rollbackContentHash) bindings.push('ACTIVE_REGISTRY_PRIOR_LEGACY_CONTENT_BINDING_MISMATCH');
  if (registry.governedCompositeBaseline.successorFreshBaselineManifestHashSha256 !== activationChangeContract.successorFreshBaselineManifestHashSha256) bindings.push('ACTIVE_REGISTRY_BASELINE_MANIFEST_BINDING_MISMATCH');
  for (const field of [
    'predecessorIncidentCloseoutPacketHashSha256',
    'predecessorHumanDecisionRecordHashSha256',
    'predecessorGovernanceResetRecordHashSha256',
    'predecessorRootCauseAnalysisSha256',
    'predecessorCorrectivePreventiveActionSha256',
  ]) {
    if (registry.governedCompositeBaseline[field] !== activationChangeContract[field]) bindings.push(`ACTIVE_REGISTRY_${field.toUpperCase()}_BINDING_MISMATCH`);
  }
  if (bindings.length > 0) return hold(bindings, {
    activeMode: registry.activeMode,
    registrySchemaVersion: 4,
    registryHashSha256: registryHash,
    registryContentSha256: registryContentHash,
    expectedPriorRegistryHashSha256: rollback.registryHashSha256,
    expectedPriorRegistryContentSha256: rollbackContentHash,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION,
    verified: true,
    blockers: Object.freeze([]),
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    registrySchemaVersion: 4,
    registryHashSha256: registryHash,
    registryContentSha256: registryContentHash,
    expectedPriorRegistryHashSha256: rollback.registryHashSha256,
    expectedPriorRegistryContentSha256: rollbackContentHash,
    successorFreshReactivationGovernanceCycleHashSha256: registry.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: registry.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: registry.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: successorFreshCompositeCandidate.successorFreshCompositeRegistryCandidateHashSha256,
    successorFreshActivationChangeContractHashSha256: activationChangeContract.successorFreshActivationChangeContractHashSha256,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: activationChangeContract.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    successorOwnerAuthorityRegistryHashSha256: activationChangeContract.successorOwnerAuthorityRegistryHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: activationChangeContract.successorFreshCutoverSafetyGuardHashSha256,
    legacyBaselineVerified: true,
    successorCompositeRegistryShapeVerified: true,
    p69CandidateReverified: true,
    p75ActivationChangeContractVerified: true,
    successorOwnerAuthorizationReverified: true,
    rollbackRegistryVerified: true,
    rollbackRawContentVerified: true,
    observedRegistryContentVerified: true,
    activationAppliedObserved: true,
    activationAuthorizedByThisVerifier: false,
    mutationPerformedByThisVerifier: false,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P76 verifies an observed schema-v4 successor fresh governed-composite registry only when it exactly matches P75/P69 and P75 is recomputed, thereby re-verifying the P74 owner signature/trust root and exact legacy rollback bytes. P76 performs no mutation and grants no release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  SUCCESSOR_TOP_LEVEL_KEYS,
  SUCCESSOR_BASELINE_KEYS,
  p75ContractCore,
  verifySuccessorCompositeRegistryShape,
  validateP75ContractBoundary,
  verifySuccessorFreshDualModeCanonicalRegistry,
};
