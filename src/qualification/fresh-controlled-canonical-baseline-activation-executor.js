'use strict';

const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P57_STATUS,
  createFreshActivationChangeContract,
} = require('./fresh-activation-change-contract');
const {
  STATUS: P58_STATUS,
  verifyFreshDualModeCanonicalRegistry,
} = require('./fresh-dual-mode-canonical-registry-verifier');

const TARGET_PATH = 'config/governance/canonical-baseline.json';

const ACTION = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  ROLLBACK: 'ROLLBACK',
});

const STATUS = Object.freeze({
  HOLD_FRESH_ACTIVATION_EXECUTION: 'HOLD_FRESH_ACTIVATION_EXECUTION',
  FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED: 'FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED',
  FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY: 'FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY',
  FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED: 'FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED',
  FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED: 'FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED',
  FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY: 'FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY',
  FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED: 'FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED',
});

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
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false)
    || (value.postChangeReleaseVerifySatisfied != null && value.postChangeReleaseVerifySatisfied !== false);
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_ACTIVATION_EXECUTION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    action: extra.action || null,
    dryRun: extra.dryRun !== false,
    targetPath: TARGET_PATH,
    executionReceiptHashSha256: null,
    mutationPerformed: extra.mutationPerformed === undefined ? false : extra.mutationPerformed,
    mutationOutcome: extra.mutationOutcome || 'NOT_PERFORMED',
    activationApplied: extra.activationApplied === undefined ? false : extra.activationApplied,
    rollbackApplied: extra.rollbackApplied === undefined ? false : extra.rollbackApplied,
    postWriteP58Verified: false,
    p59ReleaseGateRequiredAfterMutation: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    rollbackRequired: extra.rollbackRequired === true,
    manualInterventionRequired: extra.manualInterventionRequired === true,
    activationAuthorized: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: extra.currentBaselineMutationPerformed === undefined ? false : extra.currentBaselineMutationPerformed,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function recomputeP57({
  activationChangeContract,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
}) {
  if (!activationChangeContract || activationChangeContract.status !== P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED) {
    return { ok: false, blockers: ['P57_FRESH_ACTIVATION_CHANGE_CONTRACT_REQUIRED'] };
  }
  const recomputed = createFreshActivationChangeContract({
    currentRegistry: activationChangeContract.rollbackRegistry,
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
  if (
    recomputed.status !== P57_STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED
    || recomputed.verified !== true
  ) {
    return { ok: false, blockers: recomputed.blockers?.length ? recomputed.blockers : ['P57_RECOMPUTATION_FAILED'] };
  }
  if (recomputed.freshActivationChangeContractHashSha256 !== activationChangeContract.freshActivationChangeContractHashSha256) {
    return { ok: false, blockers: ['P57_RECOMPUTED_CONTRACT_HASH_MISMATCH'] };
  }
  return { ok: true, recomputed };
}

function verifyLegacyState({ registry, content, contract }) {
  const result = verifyFreshDualModeCanonicalRegistry({
    registry,
    observedRegistryContent: content,
  });
  const blockers = [];
  if (result.status !== P58_STATUS.LEGACY_BASELINE_VERIFIED || result.verified !== true) {
    blockers.push('P58_LEGACY_BASELINE_VERIFICATION_REQUIRED', ...(result.blockers || []));
  }
  if (contract) {
    if (result.registryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('CURRENT_LEGACY_REGISTRY_HASH_DOES_NOT_MATCH_P57_PRIOR');
    if (result.registryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('CURRENT_LEGACY_REGISTRY_HASH_DOES_NOT_MATCH_P57_ROLLBACK');
    if (stableStringify(registry) !== stableStringify(contract.rollbackRegistry)) blockers.push('CURRENT_LEGACY_REGISTRY_OBJECT_DOES_NOT_MATCH_P57_ROLLBACK');
    if (content !== contract.rollbackRegistryContent) blockers.push('CURRENT_LEGACY_REGISTRY_CONTENT_DOES_NOT_MATCH_P57_ROLLBACK');
    if (sha256Text(content || '') !== contract.rollbackRegistryContentSha256) blockers.push('CURRENT_LEGACY_REGISTRY_CONTENT_HASH_DOES_NOT_MATCH_P57_ROLLBACK');
  }
  return blockers.length > 0 ? { ok: false, blockers, result } : { ok: true, result };
}

function verifyFreshCompositeState({
  registry,
  content,
  activationChangeContract,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
}) {
  const result = verifyFreshDualModeCanonicalRegistry({
    registry,
    observedRegistryContent: content,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
  });
  const blockers = [];
  if (
    result.status !== P58_STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION
    || result.verified !== true
  ) blockers.push('P58_FRESH_COMPOSITE_VERIFICATION_REQUIRED', ...(result.blockers || []));
  return blockers.length > 0 ? { ok: false, blockers, result } : { ok: true, result };
}

function executionCore({ action, executionId, operatorRef, executedAt, dryRun, contract, priorHash, priorContentHash, targetHash, targetContentHash }) {
  return {
    schemaVersion: 1,
    action,
    executionId: requiredString(executionId, 'executionId'),
    operatorRef: requiredString(operatorRef, 'operatorRef'),
    executedAt: iso(executedAt, 'executedAt'),
    dryRun,
    targetPath: TARGET_PATH,
    cycleId: contract.cycleId,
    freshReactivationGovernanceCycleHashSha256: contract.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: contract.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: contract.freshActivationPlanHashSha256,
    freshActivationChangeContractHashSha256: contract.freshActivationChangeContractHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: contract.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: contract.ownerAuthorityRegistryHashSha256,
    priorRegistryHashSha256: priorHash,
    priorRegistryContentSha256: priorContentHash,
    targetRegistryHashSha256: targetHash,
    targetRegistryContentSha256: targetContentHash,
  };
}

function successfulReceipt(core, extra = {}) {
  const receiptCore = {
    ...core,
    mutationPerformed: extra.mutationPerformed === true,
    observedRegistryHashSha256: extra.observedRegistryHashSha256 || null,
    observedRegistryContentSha256: extra.observedRegistryContentSha256 || null,
    postWriteP58Verified: extra.postWriteP58Verified === true,
  };
  return {
    receiptCore,
    executionReceiptHashSha256: sha256Object(receiptCore),
  };
}

async function executeFreshControlledCanonicalBaselineChange({
  action = ACTION.ACTIVATE,
  dryRun = true,
  currentRegistry,
  currentRegistryContent,
  activationChangeContract,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  executionId,
  operatorRef,
  executedAt,
  targetPath = TARGET_PATH,
  registryWriter = null,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({
    currentRegistry,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    signedOwnerDecision,
    callerOverrides,
  });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`], { action, dryRun });
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED'], { action, dryRun });

  try {
    if (!Object.values(ACTION).includes(action)) throw new TypeError('action must be ACTIVATE or ROLLBACK');
    if (typeof dryRun !== 'boolean') throw new TypeError('dryRun must be boolean');
    if (targetPath !== TARGET_PATH) throw new TypeError('TARGET_PATH_MUST_BE_CANONICAL_BASELINE_REGISTRY');
    if (!currentRegistry || typeof currentRegistry !== 'object' || Array.isArray(currentRegistry)) throw new TypeError('currentRegistry must be an object');
    if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') throw new TypeError('currentRegistryContent must be supplied as exact observed bytes');
    requiredString(executionId, 'executionId');
    requiredString(operatorRef, 'operatorRef');
    const executedAtIso = iso(executedAt, 'executedAt');
    const preparedAt = Date.parse(activationChangeContract?.preparedAt || '');
    if (!Number.isFinite(preparedAt)) throw new TypeError('P57 preparedAt must be a valid date/time');
    if (Date.parse(executedAtIso) < preparedAt) throw new TypeError('execution cannot precede P57 preparation');
  } catch (error) {
    return hold([error.message], { action, dryRun });
  }

  const p57 = recomputeP57({
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
  });
  if (!p57.ok) return hold(p57.blockers, { action, dryRun });

  if (action === ACTION.ACTIVATE) {
    const prior = verifyLegacyState({
      registry: currentRegistry,
      content: currentRegistryContent,
      contract: activationChangeContract,
    });
    if (!prior.ok) return hold(prior.blockers, { action, dryRun });

    const targetRegistry = activationChangeContract.proposedRegistry;
    const targetContent = activationChangeContract.proposedRegistryContent;
    const target = verifyFreshCompositeState({
      registry: targetRegistry,
      content: targetContent,
      activationChangeContract,
      activationPlan,
      freshCompositeCandidate,
      safetyGuard,
      freshOwnerAuthorityRegistry,
      expectedFreshOwnerAuthorityRegistryHashSha256,
      signedOwnerDecision,
    });
    if (!target.ok) return hold(target.blockers, { action, dryRun });

    const core = executionCore({
      action,
      executionId,
      operatorRef,
      executedAt,
      dryRun,
      contract: activationChangeContract,
      priorHash: prior.result.registryHashSha256,
      priorContentHash: sha256Text(currentRegistryContent),
      targetHash: target.result.registryHashSha256,
      targetContentHash: target.result.registryContentSha256,
    });

    if (dryRun) {
      const receipt = successfulReceipt(core, { mutationPerformed: false });
      return deepFreeze({
        ...core,
        status: STATUS.FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED,
        verified: true,
        blockers: Object.freeze([]),
        executionReceiptHashSha256: receipt.executionReceiptHashSha256,
        mutationPerformed: false,
        mutationOutcome: 'NOT_PERFORMED_DRY_RUN',
        activationApplied: false,
        rollbackApplied: false,
        preWriteP57Recomputed: true,
        preWriteP58LegacyVerified: true,
        targetP58FreshCompositeVerified: true,
        postWriteP58Verified: false,
        p59ReleaseGateRequiredAfterMutation: true,
        postChangeReleaseVerifyRequired: true,
        postChangeReleaseVerifySatisfied: false,
        rollbackRequired: false,
        manualInterventionRequired: false,
        activationAuthorized: false,
        reactivationAuthorized: false,
        currentBaselineMutationPerformed: false,
        releaseStillBlocked: true,
        ...AUTHORITY,
      });
    }

    if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_APPLY'], { action, dryRun });
    let write;
    try {
      write = await registryWriter({
        action,
        targetPath,
        expectedPriorRegistryHashSha256: prior.result.registryHashSha256,
        expectedPriorContent: currentRegistryContent,
        nextRegistryHashSha256: target.result.registryHashSha256,
        nextContentSha256: target.result.registryContentSha256,
        nextContent: targetContent,
      });
    } catch (error) {
      return hold([`REGISTRY_WRITER_ERROR:${error.message}`], {
        action,
        dryRun,
        mutationPerformed: null,
        mutationOutcome: 'UNKNOWN_AFTER_WRITER_ERROR',
        activationApplied: null,
        currentBaselineMutationPerformed: null,
        manualInterventionRequired: true,
      });
    }
    if (!write || write.applied !== true || !write.observedRegistry || typeof write.observedContent !== 'string') {
      return hold(['REGISTRY_WRITER_DID_NOT_RETURN_VERIFIABLE_APPLIED_STATE'], {
        action,
        dryRun,
        mutationPerformed: null,
        mutationOutcome: 'UNKNOWN_AFTER_WRITER_RESPONSE',
        activationApplied: null,
        currentBaselineMutationPerformed: null,
        manualInterventionRequired: true,
      });
    }

    const post = verifyFreshCompositeState({
      registry: write.observedRegistry,
      content: write.observedContent,
      activationChangeContract,
      activationPlan,
      freshCompositeCandidate,
      safetyGuard,
      freshOwnerAuthorityRegistry,
      expectedFreshOwnerAuthorityRegistryHashSha256,
      signedOwnerDecision,
    });
    const observedHash = sha256Object(write.observedRegistry);
    const observedContentHash = sha256Text(write.observedContent);
    const receipt = successfulReceipt(core, {
      mutationPerformed: true,
      observedRegistryHashSha256: observedHash,
      observedRegistryContentSha256: observedContentHash,
      postWriteP58Verified: post.ok,
    });

    if (!post.ok) {
      return deepFreeze({
        ...core,
        status: STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED,
        verified: false,
        blockers: Object.freeze([...new Set(post.blockers)]),
        executionReceiptHashSha256: receipt.executionReceiptHashSha256,
        mutationPerformed: true,
        mutationOutcome: 'APPLIED_BUT_POST_WRITE_P58_FAILED',
        activationApplied: true,
        rollbackApplied: false,
        observedRegistryHashSha256: observedHash,
        observedRegistryContentSha256: observedContentHash,
        preWriteP57Recomputed: true,
        preWriteP58LegacyVerified: true,
        targetP58FreshCompositeVerified: true,
        postWriteP58Verified: false,
        p59ReleaseGateRequiredAfterMutation: true,
        postChangeReleaseVerifyRequired: true,
        postChangeReleaseVerifySatisfied: false,
        rollbackRequired: true,
        manualInterventionRequired: true,
        activationAuthorized: false,
        reactivationAuthorized: false,
        currentBaselineMutationPerformed: true,
        releaseStillBlocked: true,
        ...AUTHORITY,
      });
    }

    return deepFreeze({
      ...core,
      status: STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: receipt.executionReceiptHashSha256,
      mutationPerformed: true,
      mutationOutcome: 'APPLIED_AND_POST_WRITE_P58_VERIFIED',
      activationApplied: true,
      rollbackApplied: false,
      observedRegistryHashSha256: observedHash,
      observedRegistryContentSha256: observedContentHash,
      preWriteP57Recomputed: true,
      preWriteP58LegacyVerified: true,
      targetP58FreshCompositeVerified: true,
      postWriteP58Verified: true,
      p59ReleaseGateRequiredAfterMutation: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      rollbackRequired: false,
      manualInterventionRequired: false,
      activationAuthorized: false,
      reactivationAuthorized: false,
      currentBaselineMutationPerformed: true,
      releaseStillBlocked: true,
      ...AUTHORITY,
    });
  }

  const prior = verifyFreshCompositeState({
    registry: currentRegistry,
    content: currentRegistryContent,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
  });
  if (!prior.ok) return hold(prior.blockers, { action, dryRun });
  if (stableStringify(currentRegistry) !== stableStringify(activationChangeContract.proposedRegistry)) {
    return hold(['CURRENT_FRESH_COMPOSITE_REGISTRY_DOES_NOT_MATCH_P57_PROPOSED_REGISTRY'], { action, dryRun });
  }
  if (currentRegistryContent !== activationChangeContract.proposedRegistryContent) {
    return hold(['CURRENT_FRESH_COMPOSITE_CONTENT_DOES_NOT_MATCH_P57_PROPOSED_CONTENT'], { action, dryRun });
  }

  const targetRegistry = activationChangeContract.rollbackRegistry;
  const targetContent = activationChangeContract.rollbackRegistryContent;
  const target = verifyLegacyState({ registry: targetRegistry, content: targetContent, contract: activationChangeContract });
  if (!target.ok) return hold(target.blockers, { action, dryRun });

  const core = executionCore({
    action,
    executionId,
    operatorRef,
    executedAt,
    dryRun,
    contract: activationChangeContract,
    priorHash: prior.result.registryHashSha256,
    priorContentHash: sha256Text(currentRegistryContent),
    targetHash: target.result.registryHashSha256,
    targetContentHash: sha256Text(targetContent),
  });

  if (dryRun) {
    const receipt = successfulReceipt(core, { mutationPerformed: false });
    return deepFreeze({
      ...core,
      status: STATUS.FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: receipt.executionReceiptHashSha256,
      mutationPerformed: false,
      mutationOutcome: 'NOT_PERFORMED_DRY_RUN',
      activationApplied: false,
      rollbackApplied: false,
      preWriteP57Recomputed: true,
      preWriteP58FreshCompositeVerified: true,
      targetP58LegacyVerified: true,
      postWriteP58Verified: false,
      p59ReleaseGateRequiredAfterMutation: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      rollbackRequired: false,
      manualInterventionRequired: false,
      activationAuthorized: false,
      reactivationAuthorized: false,
      currentBaselineMutationPerformed: false,
      releaseStillBlocked: true,
      ...AUTHORITY,
    });
  }

  if (typeof registryWriter !== 'function') return hold(['REGISTRY_WRITER_REQUIRED_FOR_APPLY'], { action, dryRun });
  let write;
  try {
    write = await registryWriter({
      action,
      targetPath,
      expectedPriorRegistryHashSha256: prior.result.registryHashSha256,
      expectedPriorContent: currentRegistryContent,
      nextRegistryHashSha256: target.result.registryHashSha256,
      nextContentSha256: sha256Text(targetContent),
      nextContent: targetContent,
    });
  } catch (error) {
    return hold([`REGISTRY_WRITER_ERROR:${error.message}`], {
      action,
      dryRun,
      mutationPerformed: null,
      mutationOutcome: 'UNKNOWN_AFTER_WRITER_ERROR',
      rollbackApplied: null,
      currentBaselineMutationPerformed: null,
      manualInterventionRequired: true,
    });
  }
  if (!write || write.applied !== true || !write.observedRegistry || typeof write.observedContent !== 'string') {
    return hold(['REGISTRY_WRITER_DID_NOT_RETURN_VERIFIABLE_APPLIED_STATE'], {
      action,
      dryRun,
      mutationPerformed: null,
      mutationOutcome: 'UNKNOWN_AFTER_WRITER_RESPONSE',
      rollbackApplied: null,
      currentBaselineMutationPerformed: null,
      manualInterventionRequired: true,
    });
  }

  const post = verifyLegacyState({ registry: write.observedRegistry, content: write.observedContent, contract: activationChangeContract });
  const observedHash = sha256Object(write.observedRegistry);
  const observedContentHash = sha256Text(write.observedContent);
  const receipt = successfulReceipt(core, {
    mutationPerformed: true,
    observedRegistryHashSha256: observedHash,
    observedRegistryContentSha256: observedContentHash,
    postWriteP58Verified: post.ok,
  });

  if (!post.ok) {
    return deepFreeze({
      ...core,
      status: STATUS.FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED,
      verified: false,
      blockers: Object.freeze([...new Set(post.blockers)]),
      executionReceiptHashSha256: receipt.executionReceiptHashSha256,
      mutationPerformed: true,
      mutationOutcome: 'ROLLBACK_APPLIED_BUT_POST_WRITE_P58_FAILED',
      activationApplied: false,
      rollbackApplied: true,
      observedRegistryHashSha256: observedHash,
      observedRegistryContentSha256: observedContentHash,
      preWriteP57Recomputed: true,
      preWriteP58FreshCompositeVerified: true,
      targetP58LegacyVerified: true,
      postWriteP58Verified: false,
      p59ReleaseGateRequiredAfterMutation: true,
      postChangeReleaseVerifyRequired: true,
      postChangeReleaseVerifySatisfied: false,
      rollbackRequired: false,
      manualInterventionRequired: true,
      activationAuthorized: false,
      reactivationAuthorized: false,
      currentBaselineMutationPerformed: true,
      releaseStillBlocked: true,
      ...AUTHORITY,
    });
  }

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY,
    verified: true,
    blockers: Object.freeze([]),
    executionReceiptHashSha256: receipt.executionReceiptHashSha256,
    mutationPerformed: true,
    mutationOutcome: 'ROLLBACK_APPLIED_AND_POST_WRITE_P58_VERIFIED',
    activationApplied: false,
    rollbackApplied: true,
    observedRegistryHashSha256: observedHash,
    observedRegistryContentSha256: observedContentHash,
    preWriteP57Recomputed: true,
    preWriteP58FreshCompositeVerified: true,
    targetP58LegacyVerified: true,
    postWriteP58Verified: true,
    p59ReleaseGateRequiredAfterMutation: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfied: false,
    rollbackRequired: false,
    manualInterventionRequired: false,
    activationAuthorized: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

module.exports = {
  TARGET_PATH,
  ACTION,
  STATUS,
  recomputeP57,
  verifyLegacyState,
  verifyFreshCompositeState,
  executeFreshControlledCanonicalBaselineChange,
};
