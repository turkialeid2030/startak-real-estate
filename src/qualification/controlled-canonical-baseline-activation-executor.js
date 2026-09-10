'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P39_STATUS,
  TARGET_PATH,
} = require('./composite-baseline-activation-change-contract');
const {
  STATUS: P41_STATUS,
  verifyCanonicalBaselineActivationAuthorization,
} = require('./canonical-baseline-activation-authorization-operator');

const STATUS = Object.freeze({
  HOLD_ACTIVATION_EXECUTION: 'HOLD_ACTIVATION_EXECUTION',
  ACTIVATION_DRY_RUN_READY: 'ACTIVATION_DRY_RUN_READY',
  ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY: 'ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY',
  ROLLBACK_DRY_RUN_READY: 'ROLLBACK_DRY_RUN_READY',
  ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY: 'ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY',
});

const ACTION = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  ROLLBACK: 'ROLLBACK',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sha256Object(value) {
  return sha256Text(stableStringify(value));
}

function canonicalFileContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
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
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((key) => value[key] === false));
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_ACTIVATION_EXECUTION,
    blockers: Object.freeze([...new Set(blockers)]),
    dryRun: true,
    mutationPerformed: false,
    activationApplied: false,
    rollbackApplied: false,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    externalIndependentReviewStillRequiredIfNotPreviouslySatisfied: true,
    ...AUTHORITY,
    ...extra,
  });
}

function validateP39ContractAgainstCurrent({ contract, currentRegistry }) {
  const blockers = [];
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (contract.targetPath !== TARGET_PATH) blockers.push('P39_TARGET_PATH_INVALID');
  if (contract.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || contract.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P39_MODE_TRANSITION_INVALID');
  }
  if (
    contract.activationAuthorizationGranted !== false
    || contract.actualRegistryMutationPerformed !== false
    || contract.actualDeploymentMutationPerformed !== false
    || contract.activationApplied !== false
    || contract.canonicalBaselineChanged !== false
    || contract.humanActivationAuthorizationStillRequired !== true
    || contract.postActivationReleaseVerifyRequired !== true
    || !allAuthorityFalse(contract)
  ) blockers.push('P39_AUTHORITY_BOUNDARY_INVALID');

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    blockers.push('CURRENT_REGISTRY_NOT_CONFIRMED_LEGACY_BASELINE');
    return blockers;
  }

  const currentHash = current.registryHashSha256;
  if (requiredSha256(contract.expectedPriorRegistryHashSha256, 'contract.expectedPriorRegistryHashSha256') !== currentHash) {
    blockers.push('P39_EXPECTED_PRIOR_REGISTRY_HASH_MISMATCH');
  }
  if (requiredSha256(contract.rollbackRegistryHashSha256, 'contract.rollbackRegistryHashSha256') !== currentHash) {
    blockers.push('P39_ROLLBACK_REGISTRY_HASH_MISMATCH');
  }
  if (stableStringify(contract.rollbackRegistry) !== stableStringify(currentRegistry)) {
    blockers.push('P39_ROLLBACK_REGISTRY_OBJECT_MISMATCH');
  }
  const rollbackContent = canonicalFileContent(currentRegistry);
  if (contract.rollbackRegistryContent !== rollbackContent || sha256Text(rollbackContent) !== contract.rollbackRegistryContentSha256) {
    blockers.push('P39_ROLLBACK_REGISTRY_CONTENT_MISMATCH');
  }

  if (!contract.proposedRegistry || contract.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    blockers.push('P39_PROPOSED_COMPOSITE_REGISTRY_REQUIRED');
  } else {
    const proposedContent = canonicalFileContent(contract.proposedRegistry);
    if (sha256Object(contract.proposedRegistry) !== contract.proposedRegistryHashSha256) blockers.push('P39_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH');
    if (contract.proposedRegistryContent !== proposedContent || sha256Text(proposedContent) !== contract.proposedRegistryContentSha256) {
      blockers.push('P39_PROPOSED_REGISTRY_CONTENT_MISMATCH');
    }
  }

  const core = {
    schemaVersion: contract.schemaVersion,
    contractId: contract.contractId,
    preparedByRef: contract.preparedByRef,
    preparedAt: contract.preparedAt,
    targetPath: contract.targetPath,
    expectedPriorMode: contract.expectedPriorMode,
    proposedMode: contract.proposedMode,
    expectedPriorRegistryHashSha256: contract.expectedPriorRegistryHashSha256,
    activationPlanHashSha256: contract.activationPlanHashSha256,
    successorBaselineManifestHashSha256: contract.successorBaselineManifestHashSha256,
    reviewerLockHashSha256: contract.reviewerLockHashSha256,
    cutoverSafetyGuardHashSha256: contract.cutoverSafetyGuardHashSha256,
    proposedRegistryHashSha256: contract.proposedRegistryHashSha256,
    proposedRegistryContentSha256: contract.proposedRegistryContentSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
  };
  if (sha256Object(core) !== contract.activationChangeContractHashSha256) blockers.push('P39_ACTIVATION_CHANGE_CONTRACT_HASH_MISMATCH');
  return blockers;
}

function createExecutionReceiptCore({
  action,
  executionId,
  operatorRef,
  executedAt,
  contract,
  ownerAuthorization,
  priorRegistryHashSha256,
  targetRegistryHashSha256,
  targetRegistryContentSha256,
  dryRun,
}) {
  return {
    schemaVersion: 1,
    action,
    executionId,
    operatorRef,
    executedAt,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    reviewerLockHashSha256: contract.reviewerLockHashSha256,
    ownerAuthorizationVerificationHashSha256: ownerAuthorization.authorizationVerificationHashSha256,
    priorRegistryHashSha256,
    targetRegistryHashSha256,
    targetRegistryContentSha256,
    dryRun,
  };
}

async function executeControlledCanonicalBaselineChange({
  action = ACTION.ACTIVATE,
  dryRun = true,
  currentRegistry,
  contract,
  activationAuthorityRegistry,
  expectedActivationAuthorityRegistryHashSha256,
  activationAttestation,
  verifiedOwnerAuthorization = null,
  executionId,
  operatorRef,
  executedAt,
  targetPath = TARGET_PATH,
  registryWriter = null,
} = {}) {
  const blockers = [];
  try {
    if (!Object.values(ACTION).includes(action)) throw new TypeError('action must be ACTIVATE or ROLLBACK');
    if (typeof dryRun !== 'boolean') throw new TypeError('dryRun must be boolean');
    if (targetPath !== TARGET_PATH) throw new TypeError('TARGET_PATH_MUST_BE_CANONICAL_BASELINE_REGISTRY');
    requiredString(executionId, 'executionId');
    requiredString(operatorRef, 'operatorRef');
    iso(executedAt, 'executedAt');
  } catch (error) {
    return hold([error.message]);
  }

  if (!currentRegistry || typeof currentRegistry !== 'object' || Array.isArray(currentRegistry)) {
    return hold(['CURRENT_REGISTRY_OBJECT_REQUIRED']);
  }

  if (action === ACTION.ACTIVATE) {
    try {
      blockers.push(...validateP39ContractAgainstCurrent({ contract, currentRegistry }));
    } catch (error) {
      blockers.push(error.message);
    }
    if (blockers.length > 0) return hold(blockers, { action });

    const independentlyVerifiedOwner = verifyCanonicalBaselineActivationAuthorization({
      contract,
      activationAuthorityRegistry,
      expectedActivationAuthorityRegistryHashSha256,
      attestation: activationAttestation,
    });
    if (independentlyVerifiedOwner.status !== P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION || independentlyVerifiedOwner.verified !== true) {
      return hold(['P41_SIGNED_OWNER_ACTIVATION_AUTHORIZATION_REQUIRED', ...(independentlyVerifiedOwner.blockers || [])], { action });
    }
    if (verifiedOwnerAuthorization) {
      if (
        verifiedOwnerAuthorization.status !== P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION
        || verifiedOwnerAuthorization.verified !== true
        || verifiedOwnerAuthorization.authorizationVerificationHashSha256 !== independentlyVerifiedOwner.authorizationVerificationHashSha256
      ) return hold(['P41_VERIFIED_OWNER_AUTHORIZATION_BINDING_MISMATCH'], { action });
    }

    const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
    const targetRegistry = contract.proposedRegistry;
    const targetContent = canonicalFileContent(targetRegistry);
    const core = createExecutionReceiptCore({
      action,
      executionId: requiredString(executionId, 'executionId'),
      operatorRef: requiredString(operatorRef, 'operatorRef'),
      executedAt: iso(executedAt, 'executedAt'),
      contract,
      ownerAuthorization: independentlyVerifiedOwner,
      priorRegistryHashSha256: current.registryHashSha256,
      targetRegistryHashSha256: contract.proposedRegistryHashSha256,
      targetRegistryContentSha256: contract.proposedRegistryContentSha256,
      dryRun,
    });

    if (dryRun) {
      return deepFreeze({
        ...core,
        status: STATUS.ACTIVATION_DRY_RUN_READY,
        verified: true,
        blockers: Object.freeze([]),
        executionReceiptHashSha256: sha256Object(core),
        mutationPerformed: false,
        activationApplied: false,
        rollbackApplied: false,
        targetRegistry,
        targetRegistryContent: targetContent,
        ownerAuthorizationVerified: true,
        reviewerLockBound: true,
        independentReviewSubstanceReverifiedHere: false,
        postChangeReleaseVerifyRequired: true,
        postChangeReleaseVerifySatisfied: false,
        ...AUTHORITY,
      });
    }

    if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'], { action, dryRun: false });
    const writeResult = await registryWriter({
      targetPath,
      expectedPriorRegistryHashSha256: current.registryHashSha256,
      expectedPriorContent: canonicalFileContent(currentRegistry),
      nextContent: targetContent,
      nextRegistryHashSha256: contract.proposedRegistryHashSha256,
      nextContentSha256: contract.proposedRegistryContentSha256,
      action,
    });
    if (!writeResult || writeResult.applied !== true || writeResult.observedContentSha256 !== contract.proposedRegistryContentSha256) {
      return hold(['REGISTRY_WRITER_DID_NOT_CONFIRM_EXACT_ACTIVATION_WRITE'], { action, dryRun: false });
    }
    return deepFreeze({
      ...core,
      status: STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: sha256Object(core),
      mutationPerformed: true,
      activationApplied: true,
      rollbackApplied: false,
      ownerAuthorizationVerified: true,
      reviewerLockBound: true,
      independentReviewSubstanceReverifiedHere: false,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      releaseStillBlockedPendingPostChangeVerification: true,
      ...AUTHORITY,
    });
  }

  // Rollback requires the current active registry to be the exact P39 proposed
  // registry and uses the exact legacy rollback content already bound in P39.
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return hold(['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'], { action });
  }
  if (stableStringify(currentRegistry) !== stableStringify(contract.proposedRegistry)) {
    return hold(['CURRENT_COMPOSITE_REGISTRY_DOES_NOT_MATCH_P39_PROPOSED_REGISTRY'], { action });
  }
  if (sha256Object(currentRegistry) !== contract.proposedRegistryHashSha256) {
    return hold(['CURRENT_COMPOSITE_REGISTRY_HASH_MISMATCH'], { action });
  }
  const ownerAuthorization = verifyCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    attestation: activationAttestation,
  });
  if (ownerAuthorization.status !== P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION || ownerAuthorization.verified !== true) {
    return hold(['P41_SIGNED_OWNER_ACTIVATION_AUTHORIZATION_REQUIRED_FOR_ROLLBACK', ...(ownerAuthorization.blockers || [])], { action });
  }
  const rollbackRegistry = contract.rollbackRegistry;
  const rollback = evaluateCurrentCanonicalBaselineRegistry(rollbackRegistry);
  if (rollback.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED || rollback.registryHashSha256 !== contract.rollbackRegistryHashSha256) {
    return hold(['P39_ROLLBACK_REGISTRY_NOT_CONFIRMED_EXACT_LEGACY_BASELINE'], { action });
  }
  const rollbackContent = canonicalFileContent(rollbackRegistry);
  if (sha256Text(rollbackContent) !== contract.rollbackRegistryContentSha256 || contract.rollbackRegistryContent !== rollbackContent) {
    return hold(['P39_ROLLBACK_CONTENT_HASH_MISMATCH'], { action });
  }
  const core = createExecutionReceiptCore({
    action,
    executionId: requiredString(executionId, 'executionId'),
    operatorRef: requiredString(operatorRef, 'operatorRef'),
    executedAt: iso(executedAt, 'executedAt'),
    contract,
    ownerAuthorization,
    priorRegistryHashSha256: contract.proposedRegistryHashSha256,
    targetRegistryHashSha256: contract.rollbackRegistryHashSha256,
    targetRegistryContentSha256: contract.rollbackRegistryContentSha256,
    dryRun,
  });
  if (dryRun) {
    return deepFreeze({
      ...core,
      status: STATUS.ROLLBACK_DRY_RUN_READY,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: sha256Object(core),
      mutationPerformed: false,
      activationApplied: false,
      rollbackApplied: false,
      targetRegistry: rollbackRegistry,
      targetRegistryContent: rollbackContent,
      ownerAuthorizationVerified: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      ...AUTHORITY,
    });
  }
  if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'], { action, dryRun: false });
  const writeResult = await registryWriter({
    targetPath,
    expectedPriorRegistryHashSha256: contract.proposedRegistryHashSha256,
    expectedPriorContent: canonicalFileContent(currentRegistry),
    nextContent: rollbackContent,
    nextRegistryHashSha256: contract.rollbackRegistryHashSha256,
    nextContentSha256: contract.rollbackRegistryContentSha256,
    action,
  });
  if (!writeResult || writeResult.applied !== true || writeResult.observedContentSha256 !== contract.rollbackRegistryContentSha256) {
    return hold(['REGISTRY_WRITER_DID_NOT_CONFIRM_EXACT_ROLLBACK_WRITE'], { action, dryRun: false });
  }
  return deepFreeze({
    ...core,
    status: STATUS.ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY,
    verified: true,
    blockers: Object.freeze([]),
    executionReceiptHashSha256: sha256Object(core),
    mutationPerformed: true,
    activationApplied: false,
    rollbackApplied: true,
    ownerAuthorizationVerified: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    releaseStillBlockedPendingPostChangeVerification: true,
    ...AUTHORITY,
  });
}

module.exports = {
  STATUS,
  ACTION,
  AUTHORITY,
  executeControlledCanonicalBaselineChange,
  validateP39ContractAgainstCurrent,
};
