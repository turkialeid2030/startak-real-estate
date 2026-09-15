'use strict';

const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P76_STATUS,
  validateP75ContractBoundary,
  verifySuccessorFreshDualModeCanonicalRegistry,
} = require('./successor-fresh-dual-mode-canonical-registry-verifier');

const TARGET_PATH = 'config/governance/canonical-baseline.json';

const ACTION = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  ROLLBACK: 'ROLLBACK',
});

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION: 'HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION',
  SUCCESSOR_FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED: 'SUCCESSOR_FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED',
  SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY: 'SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY',
  SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED: 'SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED',
  SUCCESSOR_FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED: 'SUCCESSOR_FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED',
  SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY: 'SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY',
  SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED: 'SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED',
});

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
    if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key) || /signing[-_]?key/i.test(key)) return `${path}.${key}`;
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
    status: STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_EXECUTION,
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
    postWriteP76Verified: false,
    p77ReleaseGateRequiredAfterMutation: true,
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

function evidenceInput(input) {
  return {
    activationChangeContract: input.activationChangeContract,
    successorReviewPacket: input.successorReviewPacket,
    reviewerLifecycle: input.reviewerLifecycle,
    activationPlan: input.activationPlan,
    successorFreshCompositeCandidate: input.successorFreshCompositeCandidate,
    successorFreshShadowEvaluation: input.successorFreshShadowEvaluation,
    successorFreshRehearsalResult: input.successorFreshRehearsalResult,
    safetyGuard: input.safetyGuard,
    successorFreshOwnerAuthorityRegistry: input.successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256: input.expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision: input.signedOwnerDecision,
  };
}

function verifyLegacyState(registry, content, contract) {
  const result = verifySuccessorFreshDualModeCanonicalRegistry({
    registry,
    observedRegistryContent: content,
  });
  const blockers = [];
  if (result.status !== P76_STATUS.LEGACY_BASELINE_VERIFIED || result.verified !== true) {
    blockers.push('P76_LEGACY_BASELINE_VERIFICATION_REQUIRED', ...(result.blockers || []));
  }
  if (contract) {
    if (result.registryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('CURRENT_LEGACY_REGISTRY_HASH_DOES_NOT_MATCH_P75_PRIOR');
    if (result.registryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('CURRENT_LEGACY_REGISTRY_HASH_DOES_NOT_MATCH_P75_ROLLBACK');
    if (sha256Text(content || '') !== contract.rollbackRegistryContentSha256) blockers.push('CURRENT_LEGACY_REGISTRY_CONTENT_HASH_DOES_NOT_MATCH_P75_ROLLBACK');
    if (content !== contract.rollbackRegistryContent) blockers.push('CURRENT_LEGACY_REGISTRY_CONTENT_DOES_NOT_MATCH_P75_ROLLBACK');
    if (stableStringify(registry) !== stableStringify(contract.rollbackRegistry)) blockers.push('CURRENT_LEGACY_REGISTRY_OBJECT_DOES_NOT_MATCH_P75_ROLLBACK');
  }
  return blockers.length > 0 ? { ok: false, blockers, result } : { ok: true, blockers: [], result };
}

function verifySuccessorState(registry, content, input) {
  const result = verifySuccessorFreshDualModeCanonicalRegistry({
    registry,
    observedRegistryContent: content,
    ...evidenceInput(input),
  });
  const blockers = [];
  if (
    result.status !== P76_STATUS.SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION
    || result.verified !== true
  ) {
    blockers.push('P76_SUCCESSOR_FRESH_COMPOSITE_VERIFICATION_REQUIRED', ...(result.blockers || []));
  }
  return blockers.length > 0 ? { ok: false, blockers, result } : { ok: true, blockers: [], result };
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
    successorFreshReactivationGovernanceCycleHashSha256: contract.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: contract.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: contract.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: contract.successorFreshCompositeRegistryCandidateHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: contract.successorFreshCutoverSafetyGuardHashSha256,
    successorFreshActivationChangeContractHashSha256: contract.successorFreshActivationChangeContractHashSha256,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: contract.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    successorOwnerAuthorityRegistryHashSha256: contract.successorOwnerAuthorityRegistryHashSha256,
    priorRegistryHashSha256: priorHash,
    priorRegistryContentSha256: priorContentHash,
    targetRegistryHashSha256: targetHash,
    targetRegistryContentSha256: targetContentHash,
  };
}

function receiptHash(core, mutationPerformed, observedRegistryHashSha256 = null, observedRegistryContentSha256 = null, postWriteP76Verified = false) {
  return sha256Object({
    ...core,
    mutationPerformed,
    observedRegistryHashSha256,
    observedRegistryContentSha256,
    postWriteP76Verified,
  });
}

async function executeSuccessorFreshControlledCanonicalBaselineChange(input = {}) {
  const {
    action = ACTION.ACTIVATE,
    dryRun = true,
    currentRegistry,
    currentRegistryContent,
    activationChangeContract,
    executionId,
    operatorRef,
    executedAt,
    targetPath = TARGET_PATH,
    registryWriter = null,
    ...callerOverrides
  } = input;

  const forbidden = findForbiddenKeyMaterial({
    currentRegistry,
    activationChangeContract,
    ...evidenceInput(input),
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
    if (!Number.isFinite(preparedAt)) throw new TypeError('P75 preparedAt must be a valid date/time');
    if (Date.parse(executedAtIso) < preparedAt) throw new TypeError('execution cannot precede P75 preparation');
  } catch (error) {
    return hold([error.message], { action, dryRun });
  }

  const contractBlockers = validateP75ContractBoundary(activationChangeContract);
  if (contractBlockers.length > 0) return hold(contractBlockers, { action, dryRun });

  if (action === ACTION.ACTIVATE) {
    const prior = verifyLegacyState(currentRegistry, currentRegistryContent, activationChangeContract);
    if (!prior.ok) return hold(prior.blockers, { action, dryRun });

    const targetRegistry = activationChangeContract.proposedRegistry;
    const targetContent = activationChangeContract.proposedRegistryContent;
    const target = verifySuccessorState(targetRegistry, targetContent, input);
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
      return deepFreeze({
        ...core,
        status: STATUS.SUCCESSOR_FRESH_ACTIVATION_DRY_RUN_READY_NOT_APPLIED,
        verified: true,
        blockers: Object.freeze([]),
        executionReceiptHashSha256: receiptHash(core, false),
        mutationPerformed: false,
        mutationOutcome: 'NOT_PERFORMED_DRY_RUN',
        activationApplied: false,
        rollbackApplied: false,
        preWriteP76LegacyVerified: true,
        targetP76SuccessorCompositeVerified: true,
        postWriteP76Verified: false,
        p77ReleaseGateRequiredAfterMutation: true,
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
        mutationOutcome: 'UNKNOWN_AFTER_UNVERIFIABLE_WRITER_RESPONSE',
        activationApplied: null,
        currentBaselineMutationPerformed: null,
        manualInterventionRequired: true,
      });
    }

    const post = verifySuccessorState(write.observedRegistry, write.observedContent, input);
    const observedHash = sha256Object(write.observedRegistry);
    const observedContentHash = sha256Text(write.observedContent);
    const exactWrite = observedHash === target.result.registryHashSha256
      && observedContentHash === target.result.registryContentSha256
      && write.observedContent === targetContent;
    if (!post.ok || !exactWrite) {
      return deepFreeze({
        ...core,
        status: STATUS.SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFICATION_FAILED_ROLLBACK_REQUIRED,
        verified: false,
        blockers: Object.freeze([...new Set([...(post.blockers || []), ...(exactWrite ? [] : ['POST_WRITE_STATE_DOES_NOT_MATCH_P75_TARGET'])])]),
        executionReceiptHashSha256: receiptHash(core, true, observedHash, observedContentHash, false),
        mutationPerformed: true,
        mutationOutcome: 'APPLIED_BUT_POST_WRITE_VERIFICATION_FAILED',
        activationApplied: true,
        rollbackApplied: false,
        postWriteP76Verified: false,
        p77ReleaseGateRequiredAfterMutation: true,
        postChangeReleaseVerifyRequired: true,
        postChangeReleaseVerifySatisfied: false,
        rollbackRequired: true,
        manualInterventionRequired: false,
        activationAuthorized: false,
        reactivationAuthorized: false,
        currentBaselineMutationPerformed: true,
        releaseStillBlocked: true,
        ...AUTHORITY,
      });
    }

    return deepFreeze({
      ...core,
      status: STATUS.SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: receiptHash(core, true, observedHash, observedContentHash, true),
      mutationPerformed: true,
      mutationOutcome: 'APPLIED_AND_POST_WRITE_P76_VERIFIED',
      activationApplied: true,
      rollbackApplied: false,
      preWriteP76LegacyVerified: true,
      targetP76SuccessorCompositeVerified: true,
      postWriteP76Verified: true,
      p77ReleaseGateRequiredAfterMutation: true,
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

  const active = verifySuccessorState(currentRegistry, currentRegistryContent, input);
  if (!active.ok) return hold(active.blockers, { action, dryRun });
  const targetRegistry = activationChangeContract.rollbackRegistry;
  const targetContent = activationChangeContract.rollbackRegistryContent;
  const target = verifyLegacyState(targetRegistry, targetContent, activationChangeContract);
  if (!target.ok) return hold(target.blockers, { action, dryRun });

  const core = executionCore({
    action,
    executionId,
    operatorRef,
    executedAt,
    dryRun,
    contract: activationChangeContract,
    priorHash: active.result.registryHashSha256,
    priorContentHash: sha256Text(currentRegistryContent),
    targetHash: target.result.registryHashSha256,
    targetContentHash: sha256Text(targetContent),
  });

  if (dryRun) {
    return deepFreeze({
      ...core,
      status: STATUS.SUCCESSOR_FRESH_ROLLBACK_DRY_RUN_READY_NOT_APPLIED,
      verified: true,
      blockers: Object.freeze([]),
      executionReceiptHashSha256: receiptHash(core, false),
      mutationPerformed: false,
      mutationOutcome: 'NOT_PERFORMED_DRY_RUN',
      activationApplied: true,
      rollbackApplied: false,
      preWriteP76SuccessorCompositeVerified: true,
      targetP76LegacyVerified: true,
      postWriteP76Verified: false,
      p77ReleaseGateRequiredAfterMutation: true,
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
      expectedPriorRegistryHashSha256: active.result.registryHashSha256,
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
      mutationOutcome: 'UNKNOWN_AFTER_UNVERIFIABLE_WRITER_RESPONSE',
      rollbackApplied: null,
      currentBaselineMutationPerformed: null,
      manualInterventionRequired: true,
    });
  }

  const post = verifyLegacyState(write.observedRegistry, write.observedContent, activationChangeContract);
  const observedHash = sha256Object(write.observedRegistry);
  const observedContentHash = sha256Text(write.observedContent);
  const exactWrite = observedHash === target.result.registryHashSha256
    && observedContentHash === sha256Text(targetContent)
    && write.observedContent === targetContent;
  if (!post.ok || !exactWrite) {
    return deepFreeze({
      ...core,
      status: STATUS.SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFICATION_FAILED_MANUAL_INTERVENTION_REQUIRED,
      verified: false,
      blockers: Object.freeze([...new Set([...(post.blockers || []), ...(exactWrite ? [] : ['POST_WRITE_STATE_DOES_NOT_MATCH_P75_ROLLBACK'])])]),
      executionReceiptHashSha256: receiptHash(core, true, observedHash, observedContentHash, false),
      mutationPerformed: true,
      mutationOutcome: 'ROLLBACK_APPLIED_BUT_POST_WRITE_VERIFICATION_FAILED',
      activationApplied: false,
      rollbackApplied: true,
      postWriteP76Verified: false,
      p77ReleaseGateRequiredAfterMutation: true,
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
    status: STATUS.SUCCESSOR_FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY,
    verified: true,
    blockers: Object.freeze([]),
    executionReceiptHashSha256: receiptHash(core, true, observedHash, observedContentHash, true),
    mutationPerformed: true,
    mutationOutcome: 'ROLLBACK_APPLIED_AND_POST_WRITE_P76_VERIFIED',
    activationApplied: false,
    rollbackApplied: true,
    preWriteP76SuccessorCompositeVerified: true,
    targetP76LegacyVerified: true,
    postWriteP76Verified: true,
    p77ReleaseGateRequiredAfterMutation: true,
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
  sha256Text,
  sha256Object,
  evidenceInput,
  executionCore,
  receiptHash,
  executeSuccessorFreshControlledCanonicalBaselineChange,
};
