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
} = require('./composite-baseline-activation-change-contract');
const {
  STATUS: P42_STATUS,
  ACTION: P42_ACTION,
} = require('./controlled-canonical-baseline-activation-executor');
const {
  STATUS: P43_STATUS,
  normalizeReleaseVerifyEvidence,
} = require('./post-activation-canonical-baseline-verification');

const STATUS = Object.freeze({
  HOLD_POST_ROLLBACK_VERIFICATION: 'HOLD_POST_ROLLBACK_VERIFICATION',
  POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN: 'POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN',
  POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY: 'POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const PASS = 'PASS';

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

function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_POST_ROLLBACK_VERIFICATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    postRollbackVerificationPassed: false,
    incidentCloseoutReady: false,
    incidentClosed: false,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    releaseStillBlocked: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    ...extra,
  });
}

function validateContract(contract) {
  const blockers = [];
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (!SHA256_RE.test(contract.activationChangeContractHashSha256 || '')) blockers.push('P39_CONTRACT_HASH_INVALID');
  if (!contract.proposedRegistry || contract.proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P39_PROPOSED_COMPOSITE_REGISTRY_REQUIRED');
  if (!contract.rollbackRegistry || contract.rollbackRegistry.activeMode !== MODE.LEGACY_FILE_SHA256) blockers.push('P39_PREBOUND_LEGACY_ROLLBACK_REQUIRED');
  if (!SHA256_RE.test(contract.proposedRegistryHashSha256 || '')) blockers.push('P39_PROPOSED_REGISTRY_HASH_INVALID');
  if (!SHA256_RE.test(contract.rollbackRegistryHashSha256 || '')) blockers.push('P39_ROLLBACK_REGISTRY_HASH_INVALID');
  if (!SHA256_RE.test(contract.rollbackRegistryContentSha256 || '')) blockers.push('P39_ROLLBACK_CONTENT_HASH_INVALID');
  if (contract.activationAuthorizationGranted !== false || contract.actualRegistryMutationPerformed !== false || contract.activationApplied !== false) {
    blockers.push('P39_PRE_ACTIVATION_CONTRACT_BOUNDARY_INVALID');
  }
  if (!allAuthorityFalse(contract)) blockers.push('P39_AUTHORITY_ESCALATION_NOT_ALLOWED');
  return blockers;
}

function validateActivationExecution(execution, contract) {
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
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P42_ACTIVATION_RECEIPT_BOUNDARY_INVALID');
  if (execution.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256) blockers.push('P42_ACTIVATION_CONTRACT_BINDING_MISMATCH');
  if (execution.reviewerLockHashSha256 !== contract.reviewerLockHashSha256) blockers.push('P42_ACTIVATION_REVIEWER_LOCK_BINDING_MISMATCH');
  if (execution.priorRegistryHashSha256 !== contract.expectedPriorRegistryHashSha256) blockers.push('P42_ACTIVATION_PRIOR_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P42_ACTIVATION_TARGET_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P42_ACTIVATION_TARGET_CONTENT_BINDING_MISMATCH');
  if (!SHA256_RE.test(execution.signedOwnerAuthorizationVerificationHashSha256 || '')) blockers.push('P42_ACTIVATION_OWNER_AUTHORIZATION_HASH_INVALID');

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
    blockers.push('P42_ACTIVATION_EXECUTION_RECEIPT_HASH_MISMATCH');
  }
  return blockers;
}

function validateRollbackDecision(decision, contract, activationExecution) {
  const blockers = [];
  if (!decision || decision.status !== P43_STATUS.ROLLBACK_TRIGGERED_PREBOUND_LEGACY_ONLY) {
    return ['P43_PREBOUND_ROLLBACK_TRIGGER_REQUIRED'];
  }
  if (
    decision.verified !== true
    || decision.rollbackRequired !== true
    || decision.automaticRollbackMutationPerformed !== false
    || decision.releaseStillBlocked !== true
    || !allAuthorityFalse(decision)
  ) blockers.push('P43_ROLLBACK_DECISION_BOUNDARY_INVALID');

  const trigger = decision.rollbackTrigger;
  if (!trigger || trigger.triggerType !== 'PREBOUND_CANONICAL_BASELINE_ROLLBACK_REQUIRED' || trigger.rollbackAction !== P42_ACTION.ROLLBACK) {
    return [...blockers, 'P43_ROLLBACK_TRIGGER_INVALID'];
  }
  if (
    trigger.automaticRollbackMutationAllowed !== false
    || trigger.automaticRollbackMutationPerformed !== false
    || trigger.p42ControlledRollbackExecutionRequired !== true
    || trigger.rollbackLimitedToP39PreboundLegacyState !== true
    || trigger.postRollbackReleaseVerifyRequired !== true
    || !allAuthorityFalse(trigger)
  ) blockers.push('P43_ROLLBACK_TRIGGER_BOUNDARY_INVALID');
  if (trigger.activationExecutionReceiptHashSha256 !== activationExecution.executionReceiptHashSha256) blockers.push('P43_ACTIVATION_RECEIPT_BINDING_MISMATCH');
  if (trigger.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256) blockers.push('P43_CONTRACT_BINDING_MISMATCH');
  if (trigger.rollbackRegistryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('P43_ROLLBACK_REGISTRY_HASH_BINDING_MISMATCH');
  if (trigger.rollbackRegistryContentSha256 !== contract.rollbackRegistryContentSha256) blockers.push('P43_ROLLBACK_CONTENT_HASH_BINDING_MISMATCH');
  if (!Array.isArray(trigger.reasonCodes) || trigger.reasonCodes.length === 0) blockers.push('P43_ROLLBACK_REASON_CODES_REQUIRED');

  const core = {
    schemaVersion: trigger.schemaVersion,
    triggerType: trigger.triggerType,
    rollbackAction: trigger.rollbackAction,
    activationExecutionReceiptHashSha256: trigger.activationExecutionReceiptHashSha256,
    activationChangeContractHashSha256: trigger.activationChangeContractHashSha256,
    observedCompositeRegistryHashSha256: trigger.observedCompositeRegistryHashSha256,
    rollbackRegistryHashSha256: trigger.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: trigger.rollbackRegistryContentSha256,
    reasonCodes: Array.isArray(trigger.reasonCodes) ? [...trigger.reasonCodes] : [],
  };
  if (!SHA256_RE.test(trigger.rollbackTriggerHashSha256 || '') || sha256Object(core) !== trigger.rollbackTriggerHashSha256) {
    blockers.push('P43_ROLLBACK_TRIGGER_HASH_MISMATCH');
  }
  if (decision.rollbackTriggerHashSha256 !== trigger.rollbackTriggerHashSha256) blockers.push('P43_RESULT_TRIGGER_HASH_MISMATCH');
  return blockers;
}

function validateRollbackExecution(execution, contract, activationExecution) {
  const blockers = [];
  if (!execution || execution.status !== P42_STATUS.ROLLBACK_APPLIED_REQUIRES_POST_CHANGE_RELEASE_VERIFY) {
    return ['P42_APPLIED_ROLLBACK_RECEIPT_REQUIRED'];
  }
  if (
    execution.verified !== true
    || execution.action !== P42_ACTION.ROLLBACK
    || execution.dryRun !== false
    || execution.mutationPerformed !== true
    || execution.activationApplied !== false
    || execution.rollbackApplied !== true
    || execution.postChangeReleaseVerifyRequired !== true
    || execution.postChangeReleaseVerifySatisfied !== false
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P42_ROLLBACK_RECEIPT_BOUNDARY_INVALID');
  if (execution.activationChangeContractHashSha256 !== contract.activationChangeContractHashSha256) blockers.push('P42_ROLLBACK_CONTRACT_BINDING_MISMATCH');
  if (execution.reviewerLockHashSha256 !== contract.reviewerLockHashSha256) blockers.push('P42_ROLLBACK_REVIEWER_LOCK_BINDING_MISMATCH');
  if (execution.signedOwnerAuthorizationVerificationHashSha256 !== activationExecution.signedOwnerAuthorizationVerificationHashSha256) blockers.push('P42_ROLLBACK_OWNER_AUTHORIZATION_BINDING_MISMATCH');
  if (execution.priorRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P42_ROLLBACK_PRIOR_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('P42_ROLLBACK_TARGET_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryContentSha256 !== contract.rollbackRegistryContentSha256) blockers.push('P42_ROLLBACK_TARGET_CONTENT_BINDING_MISMATCH');
  if (Date.parse(execution.executedAt) < Date.parse(activationExecution.executedAt)) blockers.push('P42_ROLLBACK_PRECEDES_ACTIVATION');

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
    blockers.push('P42_ROLLBACK_EXECUTION_RECEIPT_HASH_MISMATCH');
  }
  return blockers;
}

function failureResult({ blockers, contract, rollbackDecision, rollbackExecution, observedRegistryHashSha256 = null, releaseVerifyEvidence = null }) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN,
    verified: true,
    blockers: Object.freeze([...new Set(blockers)]),
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
    observedRegistryHashSha256,
    releaseVerifyEvidenceHashSha256: releaseVerifyEvidence?.releaseVerifyEvidenceHashSha256 || null,
    postRollbackVerificationPassed: false,
    incidentCloseoutReady: false,
    incidentClosed: false,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    postRollbackFailureRequiresHumanIncidentHandling: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P44 found the rollback or post-rollback verification incomplete or failed. The incident remains open, release remains blocked, and a future reactivation requires a new governed cycle.',
  });
}

function evaluatePostRollbackCanonicalBaselineVerification({
  contract,
  activationExecution,
  rollbackDecision,
  rollbackExecution,
  observedRegistry,
  releaseVerifyEvidence,
  incidentId,
  incidentRef,
  closeoutPreparedByRef,
  closeoutPreparedAt,
} = {}) {
  const contractBlockers = validateContract(contract);
  if (contractBlockers.length > 0) return hold(contractBlockers);
  const activationBlockers = validateActivationExecution(activationExecution, contract);
  if (activationBlockers.length > 0) return hold(activationBlockers);
  const triggerBlockers = validateRollbackDecision(rollbackDecision, contract, activationExecution);
  if (triggerBlockers.length > 0) return hold(triggerBlockers);
  const rollbackBlockers = validateRollbackExecution(rollbackExecution, contract, activationExecution);
  if (rollbackBlockers.length > 0) return hold(rollbackBlockers);

  if (!observedRegistry || typeof observedRegistry !== 'object' || Array.isArray(observedRegistry)) {
    return failureResult({
      blockers: ['POST_ROLLBACK_OBSERVED_REGISTRY_REQUIRED'],
      contract,
      rollbackDecision,
      rollbackExecution,
    });
  }

  const observed = evaluateCurrentCanonicalBaselineRegistry(observedRegistry);
  const observedRegistryHashSha256 = sha256Object(observedRegistry);
  const expectedContent = canonicalFileContent(contract.rollbackRegistry);
  const observedContent = canonicalFileContent(observedRegistry);
  const restorationFailures = [];
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) restorationFailures.push('POST_ROLLBACK_LEGACY_REGISTRY_NOT_CONFIRMED');
  if (observedRegistryHashSha256 !== contract.rollbackRegistryHashSha256) restorationFailures.push('POST_ROLLBACK_REGISTRY_HASH_MISMATCH');
  if (stableStringify(observedRegistry) !== stableStringify(contract.rollbackRegistry)) restorationFailures.push('POST_ROLLBACK_REGISTRY_OBJECT_MISMATCH');
  if (observedContent !== expectedContent || sha256Text(observedContent) !== contract.rollbackRegistryContentSha256) restorationFailures.push('POST_ROLLBACK_REGISTRY_CONTENT_MISMATCH');
  if (restorationFailures.length > 0) {
    return failureResult({ blockers: restorationFailures, contract, rollbackDecision, rollbackExecution, observedRegistryHashSha256 });
  }

  let evidence;
  try {
    evidence = normalizeReleaseVerifyEvidence(releaseVerifyEvidence);
  } catch (error) {
    return hold([error.message], {
      rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
      rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
      observedRegistryHashSha256,
    });
  }

  const evidenceFailures = [];
  if (evidence.releaseVerifyResult !== PASS) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_RESULT_FAILED');
  if (evidence.canonicalBaselineRegistryVerification !== PASS) evidenceFailures.push('POST_ROLLBACK_CANONICAL_BASELINE_REGISTRY_GATE_FAILED');
  if (evidence.testDiscoveryAndRegression !== PASS) evidenceFailures.push('POST_ROLLBACK_REGRESSION_FAILED');
  if (evidence.productionBuild !== PASS) evidenceFailures.push('POST_ROLLBACK_PRODUCTION_BUILD_FAILED');
  if (evidence.packageVerification !== PASS) evidenceFailures.push('POST_ROLLBACK_PACKAGE_VERIFICATION_FAILED');
  if (evidence.npmAuditReleaseThreshold !== PASS) evidenceFailures.push('POST_ROLLBACK_NPM_AUDIT_THRESHOLD_FAILED');
  if (evidence.activeMode !== MODE.LEGACY_FILE_SHA256) evidenceFailures.push('POST_ROLLBACK_ACTIVE_MODE_NOT_LEGACY');
  if (evidence.registryHashSha256 !== contract.rollbackRegistryHashSha256) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_REGISTRY_HASH_MISMATCH');
  if (Date.parse(evidence.completedAt) < Date.parse(rollbackExecution.executedAt)) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_PRECEDES_ROLLBACK');
  if (evidenceFailures.length > 0) {
    return failureResult({
      blockers: evidenceFailures,
      contract,
      rollbackDecision,
      rollbackExecution,
      observedRegistryHashSha256,
      releaseVerifyEvidence: evidence,
    });
  }

  let normalizedIncidentId;
  let normalizedIncidentRef;
  let normalizedPreparedBy;
  let normalizedPreparedAt;
  try {
    normalizedIncidentId = requiredString(incidentId, 'incidentId');
    normalizedIncidentRef = requiredString(incidentRef, 'incidentRef');
    normalizedPreparedBy = requiredString(closeoutPreparedByRef, 'closeoutPreparedByRef');
    normalizedPreparedAt = iso(closeoutPreparedAt, 'closeoutPreparedAt');
  } catch (error) {
    return hold([error.message], {
      rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
      rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
      observedRegistryHashSha256,
      releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    });
  }
  if (Date.parse(normalizedPreparedAt) < Date.parse(evidence.completedAt)) {
    return hold(['INCIDENT_CLOSEOUT_PREPARATION_PRECEDES_POST_ROLLBACK_RELEASE_VERIFY'], {
      rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
      rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
      observedRegistryHashSha256,
      releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    });
  }

  const core = {
    schemaVersion: 1,
    incidentId: normalizedIncidentId,
    incidentRef: normalizedIncidentRef,
    closeoutPreparedByRef: normalizedPreparedBy,
    closeoutPreparedAt: normalizedPreparedAt,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: observedRegistryHashSha256,
    postRollbackReleaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    postRollbackReleaseVerifyRunId: evidence.runId,
    postRollbackReleaseVerifySourceCommitSha: evidence.sourceCommitSha,
    postRollbackReleaseVerifyCompletedAt: evidence.completedAt,
  };

  const incidentCloseoutPacket = deepFreeze({
    ...core,
    incidentCloseoutPacketHashSha256: sha256Object(core),
    restoredExactP39LegacyRegistry: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    releaseStillBlocked: true,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    ...AUTHORITY,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY,
    verified: true,
    blockers: Object.freeze([]),
    postRollbackVerificationHashSha256: sha256Object(core),
    postRollbackVerificationPassed: true,
    restoredExactP39LegacyRegistry: true,
    rollbackExecutionVerified: true,
    rollbackTriggerVerified: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    incidentCloseoutPacket,
    incidentCloseoutPacketHashSha256: incidentCloseoutPacket.incidentCloseoutPacketHashSha256,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P44 proves only that the exact P39 legacy baseline was restored after the P43-triggered P42 rollback and that supplied post-rollback Release Verify evidence is internally consistent. The incident is merely ready for human closeout; it is not automatically closed and no release or reactivation authority is granted.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  validateActivationExecution,
  validateRollbackDecision,
  validateRollbackExecution,
  evaluatePostRollbackCanonicalBaselineVerification,
};
