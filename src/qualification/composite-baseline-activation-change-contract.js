'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: P32_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P31_STATUS } = require('./canonical-rebaseline-activation-plan');
const { STATUS: P38_STATUS } = require('./composite-baseline-cutover-safety-guard');

const STATUS = Object.freeze({
  HOLD_ACTIVATION_CHANGE_CONTRACT: 'HOLD_ACTIVATION_CHANGE_CONTRACT',
  EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED: 'EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED',
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
const TARGET_PATH = 'config/governance/canonical-baseline.json';

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

function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}

function canonicalFileContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hold(blockers, current = null, plan = null, safety = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_ACTIVATION_CHANGE_CONTRACT,
    blockers: Object.freeze([...new Set(blockers)]),
    targetPath: TARGET_PATH,
    currentRegistryHashSha256: current?.registryHashSha256 || null,
    activationPlanHashSha256: plan?.activationPlanHashSha256 || null,
    cutoverSafetyGuardHashSha256: safety?.cutoverSafetyGuardHashSha256 || null,
    activationChangeContractHashSha256: null,
    proposedRegistryHashSha256: null,
    rollbackRegistryHashSha256: null,
    proposedRegistryContentSha256: null,
    rollbackRegistryContentSha256: null,
    activationAuthorizationGranted: false,
    actualRegistryMutationPerformed: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  });
}

function verifyActivationPlan(plan, currentRegistry) {
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
    if (!COMMIT_RE.test(manifest.qualifiedSourceCommitSha || '')) blockers.push('P31_SUCCESSOR_COMMIT_INVALID');
    for (const field of [
      'releaseArtifactSha256',
      'environmentConfigSha256',
      'supersedesLegacyCanonicalSha256',
      'governanceDecisionHashSha256',
      'reviewerLockHashSha256',
    ]) {
      if (!SHA256_RE.test(manifest[field] || '')) blockers.push(`P31_${field.toUpperCase()}_INVALID`);
    }
    if (manifest.supersedesLegacyCanonicalSha256 !== currentRegistry.legacyBaseline.expectedSha256) {
      blockers.push('P31_LEGACY_BASELINE_BINDING_MISMATCH');
    }
  }

  const target = plan.targetActivationContract || {};
  if (
    target.targetPath !== TARGET_PATH
    || target.expectedPriorMode !== MODE.LEGACY_FILE_SHA256
    || target.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE
    || target.expectedLegacyCanonicalSha256 !== currentRegistry.legacyBaseline.expectedSha256
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

function verifySafetyGuard(safety, current, plan) {
  const blockers = [];
  if (!safety || safety.status !== P38_STATUS.CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED) {
    return ['P38_CUTOVER_SAFETY_GUARD_REQUIRED'];
  }
  if (
    safety.reviewerLockVerified !== true
    || safety.activationPlanVerified !== true
    || safety.shadowMatchVerified !== true
    || safety.rollbackRehearsalVerified !== true
    || safety.exactRollbackIdentityVerified !== true
    || safety.safetyPrerequisitesSatisfiedForFutureExplicitReviewedActivationChange !== true
    || safety.activationAuthorizationGranted !== false
    || safety.activationApplied !== false
    || safety.explicitReviewedRegistryCodeChangeStillRequired !== true
    || safety.postActivationReleaseVerifyStillRequired !== true
    || safety.productionEvidenceEstablishedHere !== false
    || !allAuthorityFalse(safety)
  ) blockers.push('P38_CUTOVER_SAFETY_BOUNDARY_INVALID');

  if (safety.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || safety.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P38_MODE_TRANSITION_INVALID');
  }
  if (safety.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P38_CURRENT_REGISTRY_BINDING_MISMATCH');
  if (safety.activationPlanHashSha256 !== plan.activationPlanHashSha256) blockers.push('P38_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (safety.successorBaselineManifestHashSha256 !== plan.successorBaselineManifestHashSha256) blockers.push('P38_SUCCESSOR_MANIFEST_BINDING_MISMATCH');
  if (safety.reviewerLockHashSha256 !== plan.successorBaselineManifest.reviewerLockHashSha256) blockers.push('P38_REVIEWER_LOCK_BINDING_MISMATCH');

  const core = {
    schemaVersion: safety.schemaVersion,
    authoritativeMode: safety.authoritativeMode,
    proposedMode: safety.proposedMode,
    currentRegistryHashSha256: safety.currentRegistryHashSha256,
    reviewerLockHashSha256: safety.reviewerLockHashSha256,
    activationPlanHashSha256: safety.activationPlanHashSha256,
    successorBaselineManifestHashSha256: safety.successorBaselineManifestHashSha256,
    shadowEvaluationHashSha256: safety.shadowEvaluationHashSha256,
    rehearsalHashSha256: safety.rehearsalHashSha256,
  };
  if (!SHA256_RE.test(safety.cutoverSafetyGuardHashSha256 || '') || sha256Object(core) !== safety.cutoverSafetyGuardHashSha256) {
    blockers.push('P38_CUTOVER_SAFETY_GUARD_HASH_MISMATCH');
  }
  return blockers;
}

function createProposedRegistry(currentRegistry, activationPlan, safetyGuard) {
  const manifest = activationPlan.successorBaselineManifest;
  return {
    schemaVersion: 2,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: {
      expectedSha256: currentRegistry.legacyBaseline.expectedSha256,
      sourceAvailability: currentRegistry.legacyBaseline.sourceAvailability,
      evidenceStatus: currentRegistry.legacyBaseline.evidenceStatus,
    },
    governedCompositeBaseline: {
      baselineId: manifest.baselineId,
      baselineType: manifest.baselineType,
      qualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
      releaseArtifactSha256: manifest.releaseArtifactSha256,
      environmentConfigSha256: manifest.environmentConfigSha256,
      supersedesLegacyCanonicalSha256: manifest.supersedesLegacyCanonicalSha256,
      governanceDecisionHashSha256: manifest.governanceDecisionHashSha256,
      reviewerLockHashSha256: manifest.reviewerLockHashSha256,
      successorBaselineManifestHashSha256: activationPlan.successorBaselineManifestHashSha256,
      cutoverSafetyGuardHashSha256: safetyGuard.cutoverSafetyGuardHashSha256,
    },
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    activationApplied: true,
    canonicalBaselineChanged: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
  };
}

function createCompositeBaselineActivationChangeContract({
  currentRegistry,
  activationPlan,
  cutoverSafetyGuard,
  contractId,
  preparedByRef,
  preparedAt,
} = {}) {
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== P32_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED'], current, activationPlan, cutoverSafetyGuard);
  }

  const blockers = [
    ...verifyActivationPlan(activationPlan, currentRegistry || {}),
    ...verifySafetyGuard(cutoverSafetyGuard, current, activationPlan || {}),
  ];
  if (blockers.length > 0) return hold(blockers, current, activationPlan, cutoverSafetyGuard);

  if (typeof contractId !== 'string' || contractId.trim() === '') return hold(['contractId must be a non-empty string'], current, activationPlan, cutoverSafetyGuard);
  if (typeof preparedByRef !== 'string' || preparedByRef.trim() === '') return hold(['preparedByRef must be a non-empty string'], current, activationPlan, cutoverSafetyGuard);
  if (preparedByRef.trim() !== activationPlan.preparedByRef) return hold(['ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_ACTIVATION_PLAN_OWNER'], current, activationPlan, cutoverSafetyGuard);
  const parsedAt = new Date(preparedAt);
  if (!preparedAt || Number.isNaN(parsedAt.getTime())) return hold(['preparedAt must be a valid date/time'], current, activationPlan, cutoverSafetyGuard);

  const proposedRegistry = createProposedRegistry(currentRegistry, activationPlan, cutoverSafetyGuard);
  const rollbackRegistry = JSON.parse(JSON.stringify(currentRegistry));
  const proposedRegistryContent = canonicalFileContent(proposedRegistry);
  const rollbackRegistryContent = canonicalFileContent(rollbackRegistry);
  const proposedRegistryHashSha256 = sha256Object(proposedRegistry);
  const rollbackRegistryHashSha256 = sha256Object(rollbackRegistry);
  const proposedRegistryContentSha256 = sha256Text(proposedRegistryContent);
  const rollbackRegistryContentSha256 = sha256Text(rollbackRegistryContent);

  if (rollbackRegistryHashSha256 !== current.registryHashSha256) {
    return hold(['ROLLBACK_REGISTRY_DOES_NOT_RESTORE_CURRENT_LOGICAL_HASH'], current, activationPlan, cutoverSafetyGuard);
  }

  const core = {
    schemaVersion: 1,
    contractId: contractId.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: parsedAt.toISOString(),
    targetPath: TARGET_PATH,
    expectedPriorMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    expectedPriorRegistryHashSha256: current.registryHashSha256,
    activationPlanHashSha256: activationPlan.activationPlanHashSha256,
    successorBaselineManifestHashSha256: activationPlan.successorBaselineManifestHashSha256,
    reviewerLockHashSha256: activationPlan.successorBaselineManifest.reviewerLockHashSha256,
    cutoverSafetyGuardHashSha256: cutoverSafetyGuard.cutoverSafetyGuardHashSha256,
    proposedRegistryHashSha256,
    proposedRegistryContentSha256,
    rollbackRegistryHashSha256,
    rollbackRegistryContentSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED,
    activationChangeContractHashSha256: sha256Object(core),
    blockers: Object.freeze([]),
    proposedRegistry: deepFreeze(proposedRegistry),
    proposedRegistryContent,
    rollbackRegistry: deepFreeze(rollbackRegistry),
    rollbackRegistryContent,
    rollbackRestoresExactCurrentLogicalRegistry: true,
    proposedRegistryRepresentsPostActivationStateOnly: true,
    activationAuthorizationGranted: false,
    humanActivationAuthorizationStillRequired: true,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    postActivationReleaseVerifyRequired: true,
    releaseGateImplementationUpdateRequired: true,
    e2iPolicyReviewStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P39 deterministically prepares the exact proposed successor-registry content and exact rollback content after P38 safety prerequisites are satisfied. The proposed registry describes a future post-activation state, but this contract does not authorize or perform the file change, merge, deployment, go-live or transaction execution.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  TARGET_PATH,
  createCompositeBaselineActivationChangeContract,
};
