'use strict';

const crypto = require('crypto');
const {
  MODE,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P39_STATUS,
} = require('./composite-baseline-activation-change-contract');
const {
  STATUS: P40_STATUS,
  evaluateDualModeCanonicalBaselineRegistry,
} = require('./dual-mode-canonical-baseline-registry-verifier');
const {
  STATUS: P42_STATUS,
  ACTION: P42_ACTION,
} = require('./controlled-canonical-baseline-activation-executor');

const STATUS = Object.freeze({
  HOLD_POST_ACTIVATION_VERIFICATION: 'HOLD_POST_ACTIVATION_VERIFICATION',
  POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED: 'POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED',
  ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY: 'ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY',
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
const PASS = 'PASS';
const FAIL = 'FAIL';

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

function requiredCommit(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character Git commit SHA`);
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

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_POST_ACTIVATION_VERIFICATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    postActivationVerificationPassed: false,
    rollbackRequired: false,
    rollbackTrigger: null,
    automaticRollbackMutationPerformed: false,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    productionEvidenceEstablishedHere: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    ...AUTHORITY,
    ...extra,
  });
}

function validateP39Contract(contract) {
  const blockers = [];
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (!SHA256_RE.test(contract.activationChangeContractHashSha256 || '')) blockers.push('P39_CONTRACT_HASH_INVALID');
  if (!contract.proposedRegistry || contract.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P39_PROPOSED_COMPOSITE_REGISTRY_REQUIRED');
  if (!contract.rollbackRegistry || contract.rollbackRegistry.activeMode !== MODE.LEGACY_FILE_SHA256) blockers.push('P39_PREBOUND_LEGACY_ROLLBACK_REQUIRED');
  if (contract.activationAuthorizationGranted !== false || contract.actualRegistryMutationPerformed !== false || contract.activationApplied !== false) {
    blockers.push('P39_PRE_ACTIVATION_CONTRACT_BOUNDARY_INVALID');
  }
  if (!allAuthorityFalse(contract)) blockers.push('P39_AUTHORITY_ESCALATION_NOT_ALLOWED');
  return blockers;
}

function validateAppliedActivationExecution(execution, contract) {
  const blockers = [];
  if (!execution || execution.status !== P42_STATUS.ACTIVATION_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY) {
    return ['P42_APPLIED_ACTIVATION_RECEIPT_REQUIRED'];
  }
  if (
    execution.verified !== true
    || execution.action !== P42_ACTION.ACTIVATE
    || execution.dryRun !== false
    || execution.mutationPerformed !== true
    || execution.activationApplied !== true
    || execution.rollbackApplied !== false
    || execution.postChangeReleaseVerifyRequired !== true
    || execution.postChangeReleaseVerifySatisfied !== false
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P42_APPLIED_ACTIVATION_BOUNDARY_INVALID');

  if (execution.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256) blockers.push('P42_P39_CONTRACT_BINDING_MISMATCH');
  if (execution.reviewerLockHashSha256 !== contract.reviewerLockHashSha256) blockers.push('P42_REVIEWER_LOCK_BINDING_MISMATCH');
  if (execution.priorRegistryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('P42_PRIOR_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P42_TARGET_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P42_TARGET_CONTENT_BINDING_MISMATCH');
  if (!SHA256_RE.test(execution.signedOwnerAuthorizationVerificationHashSha256 || '')) blockers.push('P42_OWNER_AUTHORIZATION_HASH_INVALID');

  const core = {
    schemaVersion: execution.schemaVersion,
    action: execution.action,
    executionId: execution.executionId,
    operatorRef: execution.operatorRef,
    executedAt: execution.executedAt,
    dryRun: execution.dryRun,
    activationChangeContractHashSha256: execution.activationChangeContractHashSha256,
    reviewerLockHashSha256: execution.reviewerLockHashSha256,
    signedOwnerAuthorizationVerificationHashSha256: execution.signedOwnerAuthorizationVerificationHashSha256,
    priorRegistryHashSha256: execution.priorRegistryHashSha256,
    targetRegistryHashSha256: execution.targetRegistryHashSha256,
    targetRegistryContentSha256: execution.targetRegistryContentSha256,
  };
  if (!SHA256_RE.test(execution.executionReceiptHashSha256 || '') || sha256Object(core) !== execution.executionReceiptHashSha256) {
    blockers.push('P42_EXECUTION_RECEIPT_HASH_MISMATCH');
  }
  return blockers;
}

function normalizeReleaseVerifyEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('releaseVerifyEvidence must be an object');
  const normalized = {
    schemaVersion: value.schemaVersion,
    runId: requiredString(value.runId, 'releaseVerifyEvidence.runId'),
    sourceCommitSha: requiredCommit(value.sourceCommitSha, 'releaseVerifyEvidence.sourceCommitSha'),
    completedAt: iso(value.completedAt, 'releaseVerifyEvidence.completedAt'),
    releaseVerifyResult: requiredString(value.releaseVerifyResult, 'releaseVerifyEvidence.releaseVerifyResult').toUpperCase(),
    canonicalBaselineRegistryVerification: requiredString(value.canonicalBaselineRegistryVerification, 'releaseVerifyEvidence.canonicalBaselineRegistryVerification').toUpperCase(),
    activeMode: requiredString(value.activeMode, 'releaseVerifyEvidence.activeMode'),
    registryHashSha256: requiredSha256(value.registryHashSha256, 'releaseVerifyEvidence.registryHashSha256'),
    testDiscoveryAndRegression: requiredString(value.testDiscoveryAndRegression, 'releaseVerifyEvidence.testDiscoveryAndRegression').toUpperCase(),
    productionBuild: requiredString(value.productionBuild, 'releaseVerifyEvidence.productionBuild').toUpperCase(),
    packageVerification: requiredString(value.packageVerification, 'releaseVerifyEvidence.packageVerification').toUpperCase(),
    npmAuditReleaseThreshold: requiredString(value.npmAuditReleaseThreshold, 'releaseVerifyEvidence.npmAuditReleaseThreshold').toUpperCase(),
    evidenceRef: requiredString(value.evidenceRef, 'releaseVerifyEvidence.evidenceRef'),
    evidenceArtifactSha256: requiredSha256(value.evidenceArtifactSha256, 'releaseVerifyEvidence.evidenceArtifactSha256'),
  };
  if (normalized.schemaVersion !== 1) throw new TypeError('releaseVerifyEvidence.schemaVersion must equal 1');
  for (const field of ['releaseVerifyResult', 'canonicalBaselineRegistryVerification', 'testDiscoveryAndRegression', 'productionBuild', 'packageVerification', 'npmAuditReleaseThreshold']) {
    if (![PASS, FAIL].includes(normalized[field])) throw new TypeError(`releaseVerifyEvidence.${field} must be PASS or FAIL`);
  }
  return deepFreeze({ ...normalized, releaseVerifyEvidenceHashSha256: sha256Object(normalized) });
}

function buildRollbackTrigger({ contract, activationExecution, observedRegistryHashSha256, reasonCodes }) {
  const normalizedReasons = [...new Set(reasonCodes)].sort();
  const core = {
    schemaVersion: 1,
    triggerType: 'PREBOUND_CANONICAL_BASELINE_ROLLBACK_REQUIRED',
    rollbackAction: P42_ACTION.ROLLBACK,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    observedCompositeRegistryHashSha256: observedRegistryHashSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
    reasonCodes: normalizedReasons,
  };
  return deepFreeze({
    ...core,
    rollbackTriggerHashSha256: sha256Object(core),
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p42ControlledRollbackExecutionRequired: true,
    rollbackLimitedToP39PreboundLegacyState: true,
    postRollbackReleaseVerifyRequired: true,
    ...AUTHORITY,
  });
}

function rollbackRequired({ contract, activationExecution, observedRegistryHashSha256, reasonCodes, releaseVerifyEvidence = null }) {
  const rollbackTrigger = buildRollbackTrigger({ contract, activationExecution, observedRegistryHashSha256, reasonCodes });
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationPassed: false,
    rollbackRequired: true,
    rollbackTrigger,
    rollbackTriggerHashSha256: rollbackTrigger.rollbackTriggerHashSha256,
    releaseVerifyEvidenceHashSha256: releaseVerifyEvidence?.releaseVerifyEvidenceHashSha256 || null,
    automaticRollbackMutationPerformed: false,
    postChangeReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    productionEvidenceEstablishedHere: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    ...AUTHORITY,
    semantics: 'P43 deterministically triggers only the exact P39-prebound legacy rollback path after a post-activation safety or Release Verify failure. It does not mutate the registry automatically; the controlled P42 rollback executor and a new post-rollback Release Verify remain required.',
  });
}

function evaluatePostActivationCanonicalBaselineVerification({
  activationExecution,
  observedRegistry,
  contract,
  activationAuthorityRegistry,
  expectedActivationAuthorityRegistryHashSha256,
  activationAttestation,
  releaseVerifyEvidence = null,
} = {}) {
  const contractBlockers = validateP39Contract(contract);
  if (contractBlockers.length > 0) return hold(contractBlockers);
  const executionBlockers = validateAppliedActivationExecution(activationExecution, contract);
  if (executionBlockers.length > 0) return hold(executionBlockers);

  if (!observedRegistry || typeof observedRegistry !== 'object' || Array.isArray(observedRegistry)) {
    return rollbackRequired({
      contract,
      activationExecution,
      observedRegistryHashSha256: null,
      reasonCodes: ['POST_ACTIVATION_OBSERVED_REGISTRY_REQUIRED'],
    });
  }

  const observedRegistryHashSha256 = sha256Object(observedRegistry);
  if (
    observedRegistryHashSha256 !== contract.proposedRegistryHashSha256
    || stableStringify(observedRegistry) !== stableStringify(contract.proposedRegistry)
  ) {
    return rollbackRequired({
      contract,
      activationExecution,
      observedRegistryHashSha256,
      reasonCodes: ['POST_ACTIVATION_REGISTRY_DOES_NOT_MATCH_P39_PROPOSED_COMPOSITE'],
    });
  }

  const p40 = evaluateDualModeCanonicalBaselineRegistry({
    registry: observedRegistry,
    activationChangeContract: contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    activationAttestation,
  });
  if (p40.status !== P40_STATUS.COMPOSITE_BASELINE_VERIFIED_WITH_SIGNED_HUMAN_AUTHORIZATION || p40.verified !== true) {
    return rollbackRequired({
      contract,
      activationExecution,
      observedRegistryHashSha256,
      reasonCodes: ['P40_POST_ACTIVATION_COMPOSITE_VERIFICATION_FAILED', ...(p40.blockers || [])],
    });
  }
  if (p40.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256) {
    return rollbackRequired({
      contract,
      activationExecution,
      observedRegistryHashSha256,
      reasonCodes: ['P40_POST_ACTIVATION_CONTRACT_BINDING_MISMATCH'],
    });
  }

  if (!releaseVerifyEvidence) {
    return hold(['POST_CHANGE_RELEASE_VERIFY_EVIDENCE_REQUIRED'], {
      observedRegistryHashSha256,
      activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    });
  }

  let evidence;
  try {
    evidence = normalizeReleaseVerifyEvidence(releaseVerifyEvidence);
  } catch (error) {
    return hold([error.message], {
      observedRegistryHashSha256,
      activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    });
  }

  const failures = [];
  if (evidence.releaseVerifyResult !== PASS) failures.push('POST_CHANGE_RELEASE_VERIFY_RESULT_FAILED');
  if (evidence.canonicalBaselineRegistryVerification !== PASS) failures.push('POST_CHANGE_CANONICAL_BASELINE_REGISTRY_GATE_FAILED');
  if (evidence.testDiscoveryAndRegression !== PASS) failures.push('POST_CHANGE_REGRESSION_FAILED');
  if (evidence.productionBuild !== PASS) failures.push('POST_CHANGE_PRODUCTION_BUILD_FAILED');
  if (evidence.packageVerification !== PASS) failures.push('POST_CHANGE_PACKAGE_VERIFICATION_FAILED');
  if (evidence.npmAuditReleaseThreshold !== PASS) failures.push('POST_CHANGE_NPM_AUDIT_THRESHOLD_FAILED');
  if (evidence.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) failures.push('POST_CHANGE_ACTIVE_MODE_NOT_COMPOSITE');
  if (evidence.registryHashSha256 !== contract.proposedRegistryHashSha256) failures.push('POST_CHANGE_REGISTRY_HASH_MISMATCH');

  if (failures.length > 0) {
    return rollbackRequired({
      contract,
      activationExecution,
      observedRegistryHashSha256,
      reasonCodes: failures,
      releaseVerifyEvidence: evidence,
    });
  }

  const core = {
    schemaVersion: 1,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    observedRegistryHashSha256,
    p40VerificationHashSha256: p40.activationAuthorizationVerificationHashSha256,
    releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    releaseVerifyRunId: evidence.runId,
    releaseVerifySourceCommitSha: evidence.sourceCommitSha,
    releaseVerifyCompletedAt: evidence.completedAt,
  };
  return deepFreeze({
    ...core,
    status: STATUS.POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationHashSha256: sha256Object(core),
    postActivationVerificationPassed: true,
    rollbackRequired: false,
    rollbackTrigger: null,
    compositeRegistryVerifiedByP40: true,
    signedOwnerAuthorizationVerifiedByP40: true,
    postChangeReleaseVerifyEvidenceConsistent: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    automaticRollbackMutationPerformed: false,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P43 binds the applied P42 activation receipt, observed P40-verified composite registry and supplied post-change Release Verify evidence. Consistency does not authenticate the external CI artifact and does not grant release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  normalizeReleaseVerifyEvidence,
  validateAppliedActivationExecution,
  buildRollbackTrigger,
  evaluatePostActivationCanonicalBaselineVerification,
};
