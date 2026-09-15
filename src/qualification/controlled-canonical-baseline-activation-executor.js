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
  STATUS: P40_STATUS,
  evaluateDualModeCanonicalBaselineRegistry,
} = require('./dual-mode-canonical-baseline-registry-verifier');
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

function iso(value, field) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_ACTIVATION_EXECUTION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    mutationPerformed: false,
    activationApplied: false,
    rollbackApplied: false,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function verifyP39AndOwnerAuthorization({
  contract,
  activationAuthorityRegistry,
  expectedActivationAuthorityRegistryHashSha256,
  activationAttestation,
  verifiedOwnerAuthorization,
}) {
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return { ok: false, blockers: ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'] };
  }
  if (!contract.proposedRegistry || contract.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) {
    return { ok: false, blockers: ['P39_PROPOSED_COMPOSITE_REGISTRY_REQUIRED'] };
  }

  const p40 = evaluateDualModeCanonicalBaselineRegistry({
    registry: contract.proposedRegistry,
    activationChangeContract: contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    activationAttestation,
  });
  if (p40.status !== P40_STATUS.COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION || p40.verified !== true) {
    return { ok: false, blockers: ['P40_COMPOSITE_AND_SIGNED_OWNER_AUTHORIZATION_REQUIRED', ...(p40.blockers || [])] };
  }

  const p41 = verifyCanonicalBaselineActivationAuthorization({
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    attestation: activationAttestation,
  });
  if (p41.status !== P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION || p41.verified !== true) {
    return { ok: false, blockers: ['P41_SIGNED_OWNER_ACTIVATION_AUTHORIZATION_REQUIRED', ...(p41.blockers || [])] };
  }

  if (verifiedOwnerAuthorization) {
    if (
      verifiedOwnerAuthorization.status !== P41_STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION
      || verifiedOwnerAuthorization.verified !== true
      || verifiedOwnerAuthorization.signedAuthorizationVerificationHashSha256 !== p41.signedAuthorizationVerificationHashSha256
      || verifiedOwnerAuthorization.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256
    ) {
      return { ok: false, blockers: ['P41_VERIFIED_OWNER_AUTHORIZATION_BINDING_MISMATCH'] };
    }
  }

  return { ok: true, p40, p41 };
}

function verifyExactLegacyRollback({ contract, legacyRegistry }) {
  const legacy = evaluateCurrentCanonicalBaselineRegistry(legacyRegistry);
  if (legacy.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return { ok: false, blockers: ['LEGACY_ROLLBACK_REGISTRY_NOT_CONFIRMED'] };
  }
  const blockers = [];
  if (contract.expectedPriorRegistryHashSha256 !== legacy.registryHashSha256) blockers.push('P39_EXPECTED_PRIOR_REGISTRY_HASH_MISMATCH');
  if (contract.rollbackRegistryHashSha256 !== legacy.registryHashSha256) blockers.push('P39_ROLLBACK_REGISTRY_HASH_MISMATCH');
  if (stableStringify(contract.rollbackRegistry) !== stableStringify(legacyRegistry)) blockers.push('P39_ROLLBACK_REGISTRY_OBJECT_MISMATCH');
  const content = canonicalFileContent(legacyRegistry);
  if (contract.rollbackRegistryContent !== content || contract.rollbackRegistryContentSha256 !== sha256Text(content)) {
    blockers.push('P39_ROLLBACK_REGISTRY_CONTENT_MISMATCH');
  }
  return blockers.length > 0 ? { ok: false, blockers } : { ok: true, legacy, content };
}

function executionCore({ action, executionId, operatorRef, executedAt, dryRun, contract, p41, priorHash, targetHash, targetContentHash }) {
  return {
    schemaVersion: 1,
    action,
    executionId: requiredString(executionId, 'executionId'),
    operatorRef: requiredString(operatorRef, 'operatorRef'),
    executedAt: iso(executedAt, 'executedAt'),
    dryRun,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    reviewerLockHashSha256: contract.reviewerLockHashSha256,
    signedOwnerAuthorizationVerificationHashSha256: p41.signedAuthorizationVerificationHashSha256,
    priorRegistryHashSha256: priorHash,
    targetRegistryHashSha256: targetHash,
    targetRegistryContentSha256: targetContentHash,
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
  try {
    if (!Object.values(ACTION).includes(action)) throw new TypeError('action must be ACTIVATE or ROLLBACK');
    if (typeof dryRun !== 'boolean') throw new TypeError('dryRun must be boolean');
    if (targetPath !== TARGET_PATH) throw new TypeError('TARGET_PATH_MUST_BE_CANONICAL_BASELINE_REGISTRY');
    requiredString(executionId, 'executionId');
    requiredString(operatorRef, 'operatorRef');
    iso(executedAt, 'executedAt');
  } catch (error) {
    return hold([error.message], { action, dryRun: dryRun !== false });
  }
  if (!currentRegistry || typeof currentRegistry !== 'object' || Array.isArray(currentRegistry)) {
    return hold(['CURRENT_REGISTRY_OBJECT_REQUIRED'], { action, dryRun });
  }

  const evidence = verifyP39AndOwnerAuthorization({
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    activationAttestation,
    verifiedOwnerAuthorization,
  });
  if (!evidence.ok) return hold(evidence.blockers, { action, dryRun });

  if (action === ACTION.ACTIVATE) {
    const rollback = verifyExactLegacyRollback({ contract, legacyRegistry: currentRegistry });
    if (!rollback.ok) return hold(rollback.blockers, { action, dryRun });

    const targetRegistry = contract.proposedRegistry;
    const targetContent = canonicalFileContent(targetRegistry);
    if (contract.proposedRegistryHashSha256 !== sha256Object(targetRegistry)) {
      return hold(['P39_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH'], { action, dryRun });
    }
    if (contract.proposedRegistryContent !== targetContent || contract.proposedRegistryContentSha256 !== sha256Text(targetContent)) {
      return hold(['P39_PROPOSED_REGISTRY_CONTENT_MISMATCH'], { action, dryRun });
    }

    const core = executionCore({
      action, executionId, operatorRef, executedAt, dryRun, contract, p41: evidence.p41,
      priorHash: rollback.legacy.registryHashSha256,
      targetHash: contract.proposedRegistryHashSha256,
      targetContentHash: contract.proposedRegistryContentSha256,
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
        reviewerLockBoundThroughP39: true,
        independentReviewSubstanceReverifiedHere: false,
        postChangeReleaseVerifyRequired: true,
        postChangeReleaseVerifySatisfied: false,
        releaseStillBlocked: true,
        ...AUTHORITY,
      });
    }

    if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'], { action, dryRun });
    const write = await registryWriter({
      action,
      targetPath,
      expectedPriorRegistryHashSha256: rollback.legacy.registryHashSha256,
      expectedPriorContent: rollback.content,
      nextRegistryHashSha256: contract.proposedRegistryHashSha256,
      nextContentSha256: contract.proposedRegistryContentSha256,
      nextContent: targetContent,
    });
    if (!write || write.applied !== true || write.observedContentSha256 !== contract.proposedRegistryContentSha256) {
      return hold(['REGISTRY_WRITER_DID_NOT_CONFIRM_EXACT_ACTIVATION_WRITE'], { action, dryRun });
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
      reviewerLockBoundThroughP39: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      releaseStillBlocked: true,
      ...AUTHORITY,
    });
  }

  if (stableStringify(currentRegistry) !== stableStringify(contract.proposedRegistry)) {
    return hold(['CURRENT_COMPOSITE_REGISTRY_DOES_NOT_MATCH_P39_PROPOSED_REGISTRY'], { action, dryRun });
  }
  if (sha256Object(currentRegistry) !== contract.proposedRegistryHashSha256) {
    return hold(['CURRENT_COMPOSITE_REGISTRY_HASH_MISMATCH'], { action, dryRun });
  }
  const rollback = verifyExactLegacyRollback({ contract, legacyRegistry: contract.rollbackRegistry });
  if (!rollback.ok) return hold(rollback.blockers, { action, dryRun });

  const core = executionCore({
    action, executionId, operatorRef, executedAt, dryRun, contract, p41: evidence.p41,
    priorHash: contract.proposedRegistryHashSha256,
    targetHash: contract.rollbackRegistryHashSha256,
    targetContentHash: contract.rollbackRegistryContentSha256,
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
      targetRegistry: contract.rollbackRegistry,
      targetRegistryContent: rollback.content,
      ownerAuthorizationVerified: true,
      rollbackLimitedToP39PreboundExactLegacyState: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      releaseStillBlocked: true,
      ...AUTHORITY,
    });
  }

  if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_NON_DRY_RUN'], { action, dryRun });
  const write = await registryWriter({
    action,
    targetPath,
    expectedPriorRegistryHashSha256: contract.proposedRegistryHashSha256,
    expectedPriorContent: canonicalFileContent(currentRegistry),
    nextRegistryHashSha256: contract.rollbackRegistryHashSha256,
    nextContentSha256: contract.rollbackRegistryContentSha256,
    nextContent: rollback.content,
  });
  if (!write || write.applied !== true || write.observedContentSha256 !== contract.rollbackRegistryContentSha256) {
    return hold(['REGISTRY_WRITER_DID_NOT_CONFIRM_EXACT_ROLLBACK_WRITE'], { action, dryRun });
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
    rollbackLimitedToP39PreboundExactLegacyState: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

module.exports = {
  STATUS,
  ACTION,
  AUTHORITY,
  executeControlledCanonicalBaselineChange,
  verifyP39AndOwnerAuthorization,
  verifyExactLegacyRollback,
};
