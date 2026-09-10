'use strict';

const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P58_STATUS,
  verifyFreshDualModeCanonicalRegistry,
} = require('./fresh-dual-mode-canonical-registry-verifier');
const {
  STATUS: P60_STATUS,
  ACTION: P60_ACTION,
} = require('./fresh-controlled-canonical-baseline-activation-executor');

const STATUS = Object.freeze({
  HOLD_FRESH_POST_ACTIVATION_VERIFICATION: 'HOLD_FRESH_POST_ACTIVATION_VERIFICATION',
  FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED: 'FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED',
  FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY: 'FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY',
});

const PASS = 'PASS';
const FAIL = 'FAIL';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const P59_FRESH_VERIFICATION_MODE = 'FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION';

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
    || (value.releaseStillBlocked != null && value.releaseStillBlocked !== true)
    || (value.rollbackRequired != null && value.rollbackRequired !== false)
    || (value.automaticRollbackMutationPerformed != null && value.automaticRollbackMutationPerformed !== false);
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_POST_ACTIVATION_VERIFICATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    postActivationVerificationPassed: false,
    p60ActivationReceiptVerified: false,
    p58ObservedFreshCompositeVerified: false,
    p59ReleaseGateEvidenceConsistent: false,
    releaseVerifyEvidenceHashSha256: null,
    rollbackRequired: false,
    rollbackTrigger: null,
    rollbackTriggerHashSha256: null,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p60ControlledRollbackExecutionRequired: false,
    postRollbackReleaseVerifyRequired: false,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfiedBySuppliedEvidence: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function p60ReceiptCore(execution) {
  return {
    schemaVersion: execution.schemaVersion,
    action: execution.action,
    executionId: execution.executionId,
    operatorRef: execution.operatorRef,
    executedAt: execution.executedAt,
    dryRun: execution.dryRun,
    targetPath: execution.targetPath,
    cycleId: execution.cycleId,
    freshReactivationGovernanceCycleHashSha256: execution.freshReactivationGovernanceCycleHashSha256,
    freshReviewerLifecycleLockHashSha256: execution.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: execution.freshActivationPlanHashSha256,
    freshActivationChangeContractHashSha256: execution.freshActivationChangeContractHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: execution.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: execution.ownerAuthorityRegistryHashSha256,
    priorRegistryHashSha256: execution.priorRegistryHashSha256,
    priorRegistryContentSha256: execution.priorRegistryContentSha256,
    targetRegistryHashSha256: execution.targetRegistryHashSha256,
    targetRegistryContentSha256: execution.targetRegistryContentSha256,
    mutationPerformed: execution.mutationPerformed,
    observedRegistryHashSha256: execution.observedRegistryHashSha256,
    observedRegistryContentSha256: execution.observedRegistryContentSha256,
    postWriteP58Verified: execution.postWriteP58Verified,
  };
}

function validateAppliedP60Activation(execution, contract) {
  const blockers = [];
  if (!execution || execution.status !== P60_STATUS.FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY) {
    return ['P60_APPLIED_FRESH_ACTIVATION_RECEIPT_REQUIRED'];
  }
  if (
    execution.verified !== true
    || execution.action !== P60_ACTION.ACTIVATE
    || execution.dryRun !== false
    || execution.mutationPerformed !== true
    || execution.activationApplied !== true
    || execution.rollbackApplied !== false
    || execution.postWriteP58Verified !== true
    || execution.p59ReleaseGateRequiredAfterMutation !== true
    || execution.postChangeReleaseVerifyRequired !== true
    || execution.postChangeReleaseVerifySatisfied !== false
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P60_APPLIED_FRESH_ACTIVATION_BOUNDARY_INVALID');

  if (!contract || typeof contract !== 'object') blockers.push('P57_ACTIVATION_CHANGE_CONTRACT_REQUIRED');
  else {
    if (execution.freshActivationChangeContractHashSha256 !== contract.freshActivationChangeContractHashSha256) blockers.push('P60_P57_CONTRACT_BINDING_MISMATCH');
    if (execution.cycleId !== contract.cycleId) blockers.push('P60_CYCLE_BINDING_MISMATCH');
    if (execution.freshReactivationGovernanceCycleHashSha256 !== contract.freshReactivationGovernanceCycleHashSha256) blockers.push('P60_GOVERNANCE_CYCLE_HASH_BINDING_MISMATCH');
    if (execution.freshReviewerLifecycleLockHashSha256 !== contract.freshReviewerLifecycleLockHashSha256) blockers.push('P60_REVIEWER_LOCK_BINDING_MISMATCH');
    if (execution.freshActivationPlanHashSha256 !== contract.freshActivationPlanHashSha256) blockers.push('P60_ACTIVATION_PLAN_BINDING_MISMATCH');
    if (execution.verifiedFreshOwnerAuthorizationRecordHashSha256 !== contract.verifiedFreshOwnerAuthorizationRecordHashSha256) blockers.push('P60_OWNER_AUTHORIZATION_BINDING_MISMATCH');
    if (execution.ownerAuthorityRegistryHashSha256 !== contract.ownerAuthorityRegistryHashSha256) blockers.push('P60_OWNER_TRUST_ROOT_BINDING_MISMATCH');
    if (execution.priorRegistryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('P60_PRIOR_REGISTRY_BINDING_MISMATCH');
    if (execution.targetRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P60_TARGET_REGISTRY_BINDING_MISMATCH');
    if (execution.targetRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P60_TARGET_CONTENT_BINDING_MISMATCH');
    if (execution.observedRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P60_OBSERVED_REGISTRY_BINDING_MISMATCH');
    if (execution.observedRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P60_OBSERVED_CONTENT_BINDING_MISMATCH');
  }

  if (!SHA256_RE.test(execution.executionReceiptHashSha256 || '') || sha256Object(p60ReceiptCore(execution)) !== execution.executionReceiptHashSha256) {
    blockers.push('P60_EXECUTION_RECEIPT_HASH_MISMATCH');
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
    testDiscoveryAndRegression: requiredString(value.testDiscoveryAndRegression, 'releaseVerifyEvidence.testDiscoveryAndRegression').toUpperCase(),
    productionBuild: requiredString(value.productionBuild, 'releaseVerifyEvidence.productionBuild').toUpperCase(),
    packageVerification: requiredString(value.packageVerification, 'releaseVerifyEvidence.packageVerification').toUpperCase(),
    npmAuditReleaseThreshold: requiredString(value.npmAuditReleaseThreshold, 'releaseVerifyEvidence.npmAuditReleaseThreshold').toUpperCase(),
    canonicalBaselineRegistryVerification: requiredString(value.canonicalBaselineRegistryVerification, 'releaseVerifyEvidence.canonicalBaselineRegistryVerification').toUpperCase(),
    activeMode: requiredString(value.activeMode, 'releaseVerifyEvidence.activeMode'),
    registrySchemaVersion: value.registrySchemaVersion,
    verificationMode: requiredString(value.verificationMode, 'releaseVerifyEvidence.verificationMode'),
    registryHashSha256: requiredSha256(value.registryHashSha256, 'releaseVerifyEvidence.registryHashSha256'),
    registryContentSha256: requiredSha256(value.registryContentSha256, 'releaseVerifyEvidence.registryContentSha256'),
    evidenceRef: requiredString(value.evidenceRef, 'releaseVerifyEvidence.evidenceRef'),
    evidenceArtifactSha256: requiredSha256(value.evidenceArtifactSha256, 'releaseVerifyEvidence.evidenceArtifactSha256'),
  };
  if (normalized.schemaVersion !== 1) throw new TypeError('releaseVerifyEvidence.schemaVersion must equal 1');
  if (normalized.registrySchemaVersion !== 3) throw new TypeError('releaseVerifyEvidence.registrySchemaVersion must equal 3');
  for (const field of [
    'releaseVerifyResult',
    'testDiscoveryAndRegression',
    'productionBuild',
    'packageVerification',
    'npmAuditReleaseThreshold',
    'canonicalBaselineRegistryVerification',
  ]) {
    if (![PASS, FAIL].includes(normalized[field])) throw new TypeError(`releaseVerifyEvidence.${field} must be PASS or FAIL`);
  }
  return deepFreeze({ ...normalized, releaseVerifyEvidenceHashSha256: sha256Object(normalized) });
}

function buildRollbackTrigger({ contract, activationExecution, observedRegistryHashSha256, observedRegistryContentSha256, reasonCodes }) {
  const normalizedReasons = [...new Set(reasonCodes)].sort();
  const core = {
    schemaVersion: 1,
    triggerType: 'FRESH_PREBOUND_CANONICAL_BASELINE_ROLLBACK_REQUIRED',
    rollbackAction: P60_ACTION.ROLLBACK,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    freshActivationChangeContractHashSha256: contract.freshActivationChangeContractHashSha256,
    cycleId: contract.cycleId,
    observedCompositeRegistryHashSha256: observedRegistryHashSha256,
    observedCompositeRegistryContentSha256: observedRegistryContentSha256,
    rollbackRegistryHashSha256: contract.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: contract.rollbackRegistryContentSha256,
    reasonCodes: normalizedReasons,
  };
  return deepFreeze({
    ...core,
    rollbackTriggerHashSha256: sha256Object(core),
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p60ControlledRollbackExecutionRequired: true,
    rollbackLimitedToP57PreboundLegacyState: true,
    postRollbackReleaseVerifyRequired: true,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
  });
}

function rollbackRequired({ contract, activationExecution, observedRegistryHashSha256 = null, observedRegistryContentSha256 = null, reasonCodes, releaseVerifyEvidence = null }) {
  const rollbackTrigger = buildRollbackTrigger({
    contract,
    activationExecution,
    observedRegistryHashSha256,
    observedRegistryContentSha256,
    reasonCodes,
  });
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationPassed: false,
    p60ActivationReceiptVerified: true,
    p58ObservedFreshCompositeVerified: false,
    p59ReleaseGateEvidenceConsistent: false,
    releaseVerifyEvidenceHashSha256: releaseVerifyEvidence?.releaseVerifyEvidenceHashSha256 || null,
    rollbackRequired: true,
    rollbackTrigger,
    rollbackTriggerHashSha256: rollbackTrigger.rollbackTriggerHashSha256,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p60ControlledRollbackExecutionRequired: true,
    postRollbackReleaseVerifyRequired: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfiedBySuppliedEvidence: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P61 emits only a deterministic rollback trigger bound to the exact P57 legacy rollback image. It never mutates the canonical registry automatically; P60 controlled rollback execution and a subsequent post-rollback Release Verify remain required.',
  });
}

function evaluateFreshPostActivationVerification({
  activationExecution,
  observedRegistry,
  observedRegistryContent,
  activationChangeContract,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  releaseVerifyEvidence = null,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({
    activationExecution,
    observedRegistry,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    signedOwnerDecision,
    releaseVerifyEvidence,
    callerOverrides,
  });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const executionBlockers = validateAppliedP60Activation(activationExecution, activationChangeContract);
  if (executionBlockers.length > 0) return hold(executionBlockers);

  if (!observedRegistry || typeof observedRegistry !== 'object' || Array.isArray(observedRegistry)) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      reasonCodes: ['POST_ACTIVATION_OBSERVED_REGISTRY_REQUIRED'],
    });
  }
  if (typeof observedRegistryContent !== 'string' || observedRegistryContent === '') {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256: sha256Object(observedRegistry),
      reasonCodes: ['POST_ACTIVATION_OBSERVED_REGISTRY_CONTENT_REQUIRED'],
    });
  }

  const observedRegistryHashSha256 = sha256Object(observedRegistry);
  const observedRegistryContentSha256 = sha256Text(observedRegistryContent);
  const identityReasons = [];
  if (observedRegistryHashSha256 !== activationChangeContract.proposedRegistryHashSha256) identityReasons.push('POST_ACTIVATION_REGISTRY_LOGICAL_HASH_MISMATCH');
  if (observedRegistryContentSha256 !== activationChangeContract.proposedRegistryContentSha256) identityReasons.push('POST_ACTIVATION_REGISTRY_CONTENT_HASH_MISMATCH');
  if (observedRegistryContent !== activationChangeContract.proposedRegistryContent) identityReasons.push('POST_ACTIVATION_REGISTRY_RAW_CONTENT_MISMATCH');
  if (stableStringify(observedRegistry) !== stableStringify(activationChangeContract.proposedRegistry)) identityReasons.push('POST_ACTIVATION_REGISTRY_OBJECT_MISMATCH');
  if (identityReasons.length > 0) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: identityReasons,
    });
  }

  const p58 = verifyFreshDualModeCanonicalRegistry({
    registry: observedRegistry,
    observedRegistryContent,
    activationChangeContract,
    activationPlan,
    freshCompositeCandidate,
    safetyGuard,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    signedOwnerDecision,
  });
  if (
    p58.status !== P58_STATUS.FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_FRESH_OWNER_AUTHORIZATION
    || p58.verified !== true
  ) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: ['P58_POST_ACTIVATION_FRESH_COMPOSITE_VERIFICATION_FAILED', ...(p58.blockers || [])],
    });
  }

  if (releaseVerifyEvidence == null) {
    return hold(['POST_CHANGE_RELEASE_VERIFY_EVIDENCE_REQUIRED'], {
      p60ActivationReceiptVerified: true,
      p58ObservedFreshCompositeVerified: true,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
    });
  }

  let evidence;
  try {
    evidence = normalizeReleaseVerifyEvidence(releaseVerifyEvidence);
  } catch (error) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: [`POST_CHANGE_RELEASE_VERIFY_EVIDENCE_INVALID:${error.message}`],
    });
  }

  const reasons = [];
  const passFields = [
    'releaseVerifyResult',
    'testDiscoveryAndRegression',
    'productionBuild',
    'packageVerification',
    'npmAuditReleaseThreshold',
    'canonicalBaselineRegistryVerification',
  ];
  for (const field of passFields) if (evidence[field] !== PASS) reasons.push(`POST_CHANGE_${field.toUpperCase()}_NOT_PASS`);
  if (evidence.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) reasons.push('POST_CHANGE_ACTIVE_MODE_NOT_FRESH_COMPOSITE');
  if (evidence.verificationMode !== P59_FRESH_VERIFICATION_MODE) reasons.push('POST_CHANGE_P59_FRESH_VERIFICATION_MODE_MISMATCH');
  if (evidence.registryHashSha256 !== observedRegistryHashSha256) reasons.push('POST_CHANGE_RELEASE_VERIFY_REGISTRY_HASH_MISMATCH');
  if (evidence.registryContentSha256 !== observedRegistryContentSha256) reasons.push('POST_CHANGE_RELEASE_VERIFY_CONTENT_HASH_MISMATCH');
  if (evidence.sourceCommitSha !== activationPlan?.freshSuccessorBaselineManifest?.qualifiedSourceCommitSha) reasons.push('POST_CHANGE_RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH');
  if (Date.parse(evidence.completedAt) < Date.parse(activationExecution.executedAt)) reasons.push('POST_CHANGE_RELEASE_VERIFY_PRECEDES_ACTIVATION');

  if (reasons.length > 0) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: reasons,
      releaseVerifyEvidence: evidence,
    });
  }

  const verificationCore = {
    schemaVersion: 1,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    freshActivationChangeContractHashSha256: activationChangeContract.freshActivationChangeContractHashSha256,
    observedRegistryHashSha256,
    observedRegistryContentSha256,
    p58RegistryHashSha256: p58.registryHashSha256,
    p58RegistryContentSha256: p58.registryContentSha256,
    releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
  };

  return deepFreeze({
    ...verificationCore,
    status: STATUS.FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationHashSha256: sha256Object(verificationCore),
    postActivationVerificationPassed: true,
    p60ActivationReceiptVerified: true,
    p58ObservedFreshCompositeVerified: true,
    p59ReleaseGateEvidenceConsistent: true,
    rollbackRequired: false,
    rollbackTrigger: null,
    rollbackTriggerHashSha256: null,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p60ControlledRollbackExecutionRequired: false,
    postRollbackReleaseVerifyRequired: false,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfiedBySuppliedEvidence: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P61 verifies deterministic consistency between the applied P60 receipt, the exact observed schema-v3 registry, P58 cryptographic governance evidence and supplied P59-style post-change Release Verify evidence. It does not authenticate the external Release Verify artifact itself and grants no release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  P59_FRESH_VERIFICATION_MODE,
  p60ReceiptCore,
  validateAppliedP60Activation,
  normalizeReleaseVerifyEvidence,
  buildRollbackTrigger,
  evaluateFreshPostActivationVerification,
};
