'use strict';

const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P76_STATUS,
  verifySuccessorFreshDualModeCanonicalRegistry,
} = require('./successor-fresh-dual-mode-canonical-registry-verifier');
const {
  ACTION: P78_ACTION,
  STATUS: P78_STATUS,
  receiptHash,
} = require('./successor-fresh-controlled-canonical-baseline-activation-executor');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION: 'HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION',
  SUCCESSOR_FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED: 'SUCCESSOR_FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED',
  SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY: 'SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY',
});

const PASS = 'PASS';
const FAIL = 'FAIL';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const P77_SUCCESSOR_VERIFICATION_MODE = 'SUCCESSOR_FRESH_GOVERNED_COMPOSITE_WITH_REVERIFIED_OWNER_AUTHORIZATION';

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
    if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key) || /signing[-_]?key/i.test(key)) return `${path}.${key}`;
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
    status: STATUS.HOLD_SUCCESSOR_FRESH_POST_ACTIVATION_VERIFICATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    postActivationVerificationPassed: false,
    p78ActivationReceiptVerified: extra.p78ActivationReceiptVerified === true,
    p76ObservedSuccessorCompositeVerified: extra.p76ObservedSuccessorCompositeVerified === true,
    p77ReleaseGateEvidenceConsistent: false,
    releaseVerifyEvidenceHashSha256: null,
    rollbackRequired: false,
    rollbackTrigger: null,
    rollbackTriggerHashSha256: null,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p78ControlledRollbackExecutionRequired: false,
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

function p78ExecutionCore(execution) {
  return {
    schemaVersion: execution.schemaVersion,
    action: execution.action,
    executionId: execution.executionId,
    operatorRef: execution.operatorRef,
    executedAt: execution.executedAt,
    dryRun: execution.dryRun,
    targetPath: execution.targetPath,
    cycleId: execution.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: execution.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: execution.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: execution.successorFreshActivationPlanHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: execution.successorFreshCompositeRegistryCandidateHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: execution.successorFreshCutoverSafetyGuardHashSha256,
    successorFreshActivationChangeContractHashSha256: execution.successorFreshActivationChangeContractHashSha256,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: execution.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    successorOwnerAuthorityRegistryHashSha256: execution.successorOwnerAuthorityRegistryHashSha256,
    priorRegistryHashSha256: execution.priorRegistryHashSha256,
    priorRegistryContentSha256: execution.priorRegistryContentSha256,
    targetRegistryHashSha256: execution.targetRegistryHashSha256,
    targetRegistryContentSha256: execution.targetRegistryContentSha256,
  };
}

function validateAppliedP78Activation(execution, contract) {
  const blockers = [];
  if (!execution || execution.status !== P78_STATUS.SUCCESSOR_FRESH_ACTIVATION_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY) {
    return ['P78_APPLIED_SUCCESSOR_FRESH_ACTIVATION_RECEIPT_REQUIRED'];
  }
  if (
    execution.verified !== true
    || execution.action !== P78_ACTION.ACTIVATE
    || execution.dryRun !== false
    || execution.mutationPerformed !== true
    || execution.activationApplied !== true
    || execution.rollbackApplied !== false
    || execution.postWriteP76Verified !== true
    || execution.p77ReleaseGateRequiredAfterMutation !== true
    || execution.postChangeReleaseVerifyRequired !== true
    || execution.postChangeReleaseVerifySatisfied !== false
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P78_APPLIED_SUCCESSOR_FRESH_ACTIVATION_BOUNDARY_INVALID');

  if (!contract || typeof contract !== 'object') blockers.push('P75_ACTIVATION_CHANGE_CONTRACT_REQUIRED');
  else {
    if (execution.successorFreshActivationChangeContractHashSha256 !== contract.successorFreshActivationChangeContractHashSha256) blockers.push('P78_P75_CONTRACT_BINDING_MISMATCH');
    if (execution.cycleId !== contract.cycleId) blockers.push('P78_CYCLE_BINDING_MISMATCH');
    if (execution.successorFreshReactivationGovernanceCycleHashSha256 !== contract.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P78_GOVERNANCE_CYCLE_HASH_BINDING_MISMATCH');
    if (execution.successorFreshReviewerLifecycleLockHashSha256 !== contract.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P78_REVIEWER_LOCK_BINDING_MISMATCH');
    if (execution.successorFreshActivationPlanHashSha256 !== contract.successorFreshActivationPlanHashSha256) blockers.push('P78_ACTIVATION_PLAN_BINDING_MISMATCH');
    if (execution.successorFreshCompositeRegistryCandidateHashSha256 !== contract.successorFreshCompositeRegistryCandidateHashSha256) blockers.push('P78_CANDIDATE_BINDING_MISMATCH');
    if (execution.successorFreshCutoverSafetyGuardHashSha256 !== contract.successorFreshCutoverSafetyGuardHashSha256) blockers.push('P78_SAFETY_GUARD_BINDING_MISMATCH');
    if (execution.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256 !== contract.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256) blockers.push('P78_OWNER_AUTHORIZATION_BINDING_MISMATCH');
    if (execution.successorOwnerAuthorityRegistryHashSha256 !== contract.successorOwnerAuthorityRegistryHashSha256) blockers.push('P78_OWNER_TRUST_ROOT_BINDING_MISMATCH');
    if (execution.priorRegistryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('P78_PRIOR_REGISTRY_BINDING_MISMATCH');
    if (execution.priorRegistryContentSha256 !== contract.expectedPriorRegistryContentSha256) blockers.push('P78_PRIOR_CONTENT_BINDING_MISMATCH');
    if (execution.targetRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P78_TARGET_REGISTRY_BINDING_MISMATCH');
    if (execution.targetRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P78_TARGET_CONTENT_BINDING_MISMATCH');

    const expectedReceipt = receiptHash(
      p78ExecutionCore(execution),
      true,
      contract.proposedRegistryHashSha256,
      contract.proposedRegistryContentSha256,
      true,
    );
    if (!SHA256_RE.test(execution.executionReceiptHashSha256 || '') || expectedReceipt !== execution.executionReceiptHashSha256) {
      blockers.push('P78_EXECUTION_RECEIPT_HASH_MISMATCH');
    }
  }
  return [...new Set(blockers)];
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
  if (normalized.registrySchemaVersion !== 4) throw new TypeError('releaseVerifyEvidence.registrySchemaVersion must equal 4');
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
    triggerType: 'SUCCESSOR_FRESH_PREBOUND_CANONICAL_BASELINE_ROLLBACK_REQUIRED',
    rollbackAction: P78_ACTION.ROLLBACK,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    successorFreshActivationChangeContractHashSha256: contract.successorFreshActivationChangeContractHashSha256,
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
    p78ControlledRollbackExecutionRequired: true,
    rollbackLimitedToP75PreboundLegacyState: true,
    postRollbackReleaseVerifyRequired: true,
    ...AUTHORITY,
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
    status: STATUS.SUCCESSOR_FRESH_ROLLBACK_TRIGGERED_P75_PREBOUND_LEGACY_ONLY,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationPassed: false,
    p78ActivationReceiptVerified: true,
    p76ObservedSuccessorCompositeVerified: false,
    p77ReleaseGateEvidenceConsistent: false,
    releaseVerifyEvidenceHashSha256: releaseVerifyEvidence?.releaseVerifyEvidenceHashSha256 || null,
    rollbackRequired: true,
    rollbackTrigger,
    rollbackTriggerHashSha256: rollbackTrigger.rollbackTriggerHashSha256,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p78ControlledRollbackExecutionRequired: true,
    postRollbackReleaseVerifyRequired: true,
    postChangeReleaseVerifyRequired: true,
    postChangeReleaseVerifySatisfiedBySuppliedEvidence: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P79 emits only a deterministic rollback trigger bound to the exact P75 legacy rollback image. It never mutates the canonical registry automatically; P78 controlled rollback execution and a subsequent post-rollback Release Verify remain required.',
  });
}

function verifierInput(input, registry, content) {
  return {
    registry,
    observedRegistryContent: content,
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

function evaluateSuccessorFreshPostActivationVerification(input = {}) {
  const {
    activationExecution,
    observedRegistry,
    observedRegistryContent,
    activationChangeContract,
    activationPlan,
    releaseVerifyEvidence = null,
    ...callerOverrides
  } = input;

  const forbidden = findForbiddenKeyMaterial({
    activationExecution,
    observedRegistry,
    activationChangeContract,
    activationPlan,
    releaseVerifyEvidence,
    callerOverrides,
  });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const executionBlockers = validateAppliedP78Activation(activationExecution, activationChangeContract);
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
  const observedVerification = verifySuccessorFreshDualModeCanonicalRegistry(verifierInput(input, observedRegistry, observedRegistryContent));
  if (
    observedVerification.status !== P76_STATUS.SUCCESSOR_FRESH_COMPOSITE_BASELINE_VERIFIED_WITH_SUCCESSOR_OWNER_AUTHORIZATION
    || observedVerification.verified !== true
  ) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: ['P76_POST_ACTIVATION_SUCCESSOR_COMPOSITE_VERIFICATION_FAILED', ...(observedVerification.blockers || [])],
    });
  }
  if (
    observedRegistryHashSha256 !== activationChangeContract.proposedRegistryHashSha256
    || observedRegistryContentSha256 !== activationChangeContract.proposedRegistryContentSha256
    || observedRegistryContent !== activationChangeContract.proposedRegistryContent
  ) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: ['POST_ACTIVATION_OBSERVED_STATE_DOES_NOT_MATCH_P75_TARGET'],
    });
  }

  if (releaseVerifyEvidence == null) {
    return hold(['POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_REQUIRED'], {
      p78ActivationReceiptVerified: true,
      p76ObservedSuccessorCompositeVerified: true,
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
      reasonCodes: [`RELEASE_VERIFY_EVIDENCE_INVALID:${error.message}`],
    });
  }

  const failureReasons = [];
  for (const field of [
    'releaseVerifyResult',
    'testDiscoveryAndRegression',
    'productionBuild',
    'packageVerification',
    'npmAuditReleaseThreshold',
    'canonicalBaselineRegistryVerification',
  ]) {
    if (evidence[field] !== PASS) failureReasons.push(`RELEASE_VERIFY_${field.toUpperCase()}_NOT_PASS`);
  }
  if (evidence.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) failureReasons.push('RELEASE_VERIFY_ACTIVE_MODE_MISMATCH');
  if (evidence.registrySchemaVersion !== 4) failureReasons.push('RELEASE_VERIFY_REGISTRY_SCHEMA_MISMATCH');
  if (evidence.verificationMode !== P77_SUCCESSOR_VERIFICATION_MODE) failureReasons.push('RELEASE_VERIFY_P77_VERIFICATION_MODE_MISMATCH');
  if (evidence.registryHashSha256 !== observedRegistryHashSha256) failureReasons.push('RELEASE_VERIFY_REGISTRY_HASH_MISMATCH');
  if (evidence.registryContentSha256 !== observedRegistryContentSha256) failureReasons.push('RELEASE_VERIFY_REGISTRY_CONTENT_HASH_MISMATCH');
  if (evidence.sourceCommitSha !== activationPlan?.successorFreshBaselineManifest?.qualifiedSourceCommitSha) failureReasons.push('RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH');
  if (Date.parse(evidence.completedAt) < Date.parse(activationExecution.executedAt)) failureReasons.push('RELEASE_VERIFY_COMPLETED_BEFORE_ACTIVATION_EXECUTION');

  if (failureReasons.length > 0) {
    return rollbackRequired({
      contract: activationChangeContract,
      activationExecution,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      reasonCodes: failureReasons,
      releaseVerifyEvidence: evidence,
    });
  }

  const core = {
    schemaVersion: 1,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    successorFreshActivationChangeContractHashSha256: activationChangeContract.successorFreshActivationChangeContractHashSha256,
    cycleId: activationChangeContract.cycleId,
    observedRegistryHashSha256,
    observedRegistryContentSha256,
    p77VerificationMode: P77_SUCCESSOR_VERIFICATION_MODE,
    releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_POST_ACTIVATION_RELEASE_VERIFY_EVIDENCE_CONSISTENT_GOVERNANCE_BLOCKED,
    verified: true,
    blockers: Object.freeze([]),
    postActivationVerificationPassed: true,
    p78ActivationReceiptVerified: true,
    p76ObservedSuccessorCompositeVerified: true,
    p77ReleaseGateEvidenceConsistent: true,
    rollbackRequired: false,
    rollbackTrigger: null,
    rollbackTriggerHashSha256: null,
    automaticRollbackMutationAllowed: false,
    automaticRollbackMutationPerformed: false,
    p78ControlledRollbackExecutionRequired: false,
    postRollbackReleaseVerifyRequired: false,
    postChangeReleaseVerifyRequired: false,
    postChangeReleaseVerifySatisfiedBySuppliedEvidence: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    postActivationVerificationHashSha256: sha256Object(core),
    semantics: 'P79 confirms only internal consistency between an applied P78 activation receipt, the observed P76-verified schema-v4 registry and caller-supplied P77-style Release Verify evidence. It does not authenticate the external evidence source or grant release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  P77_SUCCESSOR_VERIFICATION_MODE,
  p78ExecutionCore,
  validateAppliedP78Activation,
  normalizeReleaseVerifyEvidence,
  buildRollbackTrigger,
  evaluateSuccessorFreshPostActivationVerification,
};
