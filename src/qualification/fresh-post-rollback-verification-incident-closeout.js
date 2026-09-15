'use strict';

const crypto = require('crypto');
const {
  MODE,
  AUTHORITY,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  STATUS: P58_STATUS,
  validateP57ContractBoundary,
  verifyFreshDualModeCanonicalRegistry,
} = require('./fresh-dual-mode-canonical-registry-verifier');
const {
  STATUS: P60_STATUS,
  ACTION: P60_ACTION,
} = require('./fresh-controlled-canonical-baseline-activation-executor');
const {
  STATUS: P61_STATUS,
  p60ReceiptCore,
  validateAppliedP60Activation,
} = require('./fresh-post-activation-verification-rollback-trigger');

const STATUS = Object.freeze({
  HOLD_FRESH_POST_ROLLBACK_VERIFICATION: 'HOLD_FRESH_POST_ROLLBACK_VERIFICATION',
  FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN: 'FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN',
  FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY: 'FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY',
});

const PASS = 'PASS';
const FAIL = 'FAIL';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const LEGACY_VERIFICATION_MODE = 'LEGACY_STRICT';

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
    || (value.reactivationAllowed != null && value.reactivationAllowed !== false)
    || (value.incidentClosed != null && value.incidentClosed !== false)
    || (value.releaseStillBlocked != null && value.releaseStillBlocked !== true);
}

function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_POST_ROLLBACK_VERIFICATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    postRollbackVerificationPassed: false,
    restoredExactP57LegacyRegistry: false,
    rollbackTriggerVerified: false,
    rollbackExecutionVerified: false,
    postRollbackReleaseVerifyEvidenceConsistent: false,
    incidentCloseoutReady: false,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    failedFreshActivationCycleReusable: false,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function validateP61RollbackDecision(decision, contract, activationExecution) {
  const blockers = [];
  if (!decision || decision.status !== P61_STATUS.FRESH_ROLLBACK_TRIGGERED_P57_PREBOUND_LEGACY_ONLY) {
    return ['P61_FRESH_PREBOUND_ROLLBACK_TRIGGER_REQUIRED'];
  }
  if (
    decision.verified !== true
    || decision.rollbackRequired !== true
    || decision.automaticRollbackMutationAllowed !== false
    || decision.automaticRollbackMutationPerformed !== false
    || decision.p60ControlledRollbackExecutionRequired !== true
    || decision.postRollbackReleaseVerifyRequired !== true
    || decision.releaseStillBlocked !== true
    || !allAuthorityFalse(decision)
  ) blockers.push('P61_ROLLBACK_DECISION_BOUNDARY_INVALID');

  const trigger = decision.rollbackTrigger;
  if (!trigger || trigger.triggerType !== 'FRESH_PREBOUND_CANONICAL_BASELINE_ROLLBACK_REQUIRED' || trigger.rollbackAction !== P60_ACTION.ROLLBACK) {
    return [...blockers, 'P61_ROLLBACK_TRIGGER_INVALID'];
  }
  if (
    trigger.automaticRollbackMutationAllowed !== false
    || trigger.automaticRollbackMutationPerformed !== false
    || trigger.p60ControlledRollbackExecutionRequired !== true
    || trigger.rollbackLimitedToP57PreboundLegacyState !== true
    || trigger.postRollbackReleaseVerifyRequired !== true
    || !allAuthorityFalse(trigger)
  ) blockers.push('P61_ROLLBACK_TRIGGER_BOUNDARY_INVALID');
  if (trigger.activationExecutionReceiptHashSha256 !== activationExecution.executionReceiptHashSha256) blockers.push('P61_ACTIVATION_RECEIPT_BINDING_MISMATCH');
  if (trigger.freshActivationChangeContractHashSha256 !== contract.freshActivationChangeContractHashSha256) blockers.push('P61_P57_CONTRACT_BINDING_MISMATCH');
  if (trigger.cycleId !== contract.cycleId) blockers.push('P61_CYCLE_BINDING_MISMATCH');
  if (trigger.rollbackRegistryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('P61_ROLLBACK_REGISTRY_HASH_BINDING_MISMATCH');
  if (trigger.rollbackRegistryContentSha256 !== contract.rollbackRegistryContentSha256) blockers.push('P61_ROLLBACK_CONTENT_HASH_BINDING_MISMATCH');
  if (!Array.isArray(trigger.reasonCodes) || trigger.reasonCodes.length === 0) blockers.push('P61_ROLLBACK_REASON_CODES_REQUIRED');

  const core = {
    schemaVersion: trigger.schemaVersion,
    triggerType: trigger.triggerType,
    rollbackAction: trigger.rollbackAction,
    activationExecutionReceiptHashSha256: trigger.activationExecutionReceiptHashSha256,
    freshActivationChangeContractHashSha256: trigger.freshActivationChangeContractHashSha256,
    cycleId: trigger.cycleId,
    observedCompositeRegistryHashSha256: trigger.observedCompositeRegistryHashSha256,
    observedCompositeRegistryContentSha256: trigger.observedCompositeRegistryContentSha256,
    rollbackRegistryHashSha256: trigger.rollbackRegistryHashSha256,
    rollbackRegistryContentSha256: trigger.rollbackRegistryContentSha256,
    reasonCodes: Array.isArray(trigger.reasonCodes) ? [...trigger.reasonCodes] : [],
  };
  if (!SHA256_RE.test(trigger.rollbackTriggerHashSha256 || '') || sha256Object(core) !== trigger.rollbackTriggerHashSha256) blockers.push('P61_ROLLBACK_TRIGGER_HASH_MISMATCH');
  if (decision.rollbackTriggerHashSha256 !== trigger.rollbackTriggerHashSha256) blockers.push('P61_RESULT_TRIGGER_HASH_MISMATCH');
  return blockers;
}

function validateAppliedP60Rollback(execution, contract, activationExecution) {
  const blockers = [];
  if (!execution || execution.status !== P60_STATUS.FRESH_ROLLBACK_APPLIED_POST_WRITE_VERIFIED_REQUIRES_RELEASE_VERIFY) {
    return ['P60_APPLIED_FRESH_ROLLBACK_RECEIPT_REQUIRED'];
  }
  if (
    execution.verified !== true
    || execution.action !== P60_ACTION.ROLLBACK
    || execution.dryRun !== false
    || execution.mutationPerformed !== true
    || execution.activationApplied !== false
    || execution.rollbackApplied !== true
    || execution.postWriteP58Verified !== true
    || execution.p59ReleaseGateRequiredAfterMutation !== true
    || execution.postChangeReleaseVerifyRequired !== true
    || execution.postChangeReleaseVerifySatisfied !== false
    || execution.releaseStillBlocked !== true
    || !allAuthorityFalse(execution)
  ) blockers.push('P60_FRESH_ROLLBACK_RECEIPT_BOUNDARY_INVALID');

  if (execution.freshActivationChangeContractHashSha256 !== contract.freshActivationChangeContractHashSha256) blockers.push('P60_ROLLBACK_P57_CONTRACT_BINDING_MISMATCH');
  if (execution.cycleId !== contract.cycleId) blockers.push('P60_ROLLBACK_CYCLE_BINDING_MISMATCH');
  if (execution.freshReactivationGovernanceCycleHashSha256 !== contract.freshReactivationGovernanceCycleHashSha256) blockers.push('P60_ROLLBACK_GOVERNANCE_CYCLE_HASH_BINDING_MISMATCH');
  if (execution.freshReviewerLifecycleLockHashSha256 !== contract.freshReviewerLifecycleLockHashSha256) blockers.push('P60_ROLLBACK_REVIEWER_LOCK_BINDING_MISMATCH');
  if (execution.freshActivationPlanHashSha256 !== contract.freshActivationPlanHashSha256) blockers.push('P60_ROLLBACK_ACTIVATION_PLAN_BINDING_MISMATCH');
  if (execution.verifiedFreshOwnerAuthorizationRecordHashSha256 !== activationExecution.verifiedFreshOwnerAuthorizationRecordHashSha256) blockers.push('P60_ROLLBACK_OWNER_AUTHORIZATION_BINDING_MISMATCH');
  if (execution.ownerAuthorityRegistryHashSha256 !== activationExecution.ownerAuthorityRegistryHashSha256) blockers.push('P60_ROLLBACK_OWNER_TRUST_ROOT_BINDING_MISMATCH');
  if (execution.priorRegistryHashSha256 !== contract.proposedRegistryHashSha256) blockers.push('P60_ROLLBACK_PRIOR_REGISTRY_BINDING_MISMATCH');
  if (execution.priorRegistryContentSha256 !== contract.proposedRegistryContentSha256) blockers.push('P60_ROLLBACK_PRIOR_CONTENT_BINDING_MISMATCH');
  if (execution.targetRegistryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('P60_ROLLBACK_TARGET_REGISTRY_BINDING_MISMATCH');
  if (execution.targetRegistryContentSha256 !== contract.rollbackRegistryContentSha256) blockers.push('P60_ROLLBACK_TARGET_CONTENT_BINDING_MISMATCH');
  if (execution.observedRegistryHashSha256 !== contract.rollbackRegistryHashSha256) blockers.push('P60_ROLLBACK_OBSERVED_REGISTRY_BINDING_MISMATCH');
  if (execution.observedRegistryContentSha256 !== contract.rollbackRegistryContentSha256) blockers.push('P60_ROLLBACK_OBSERVED_CONTENT_BINDING_MISMATCH');
  if (Date.parse(execution.executedAt) < Date.parse(activationExecution.executedAt)) blockers.push('P60_ROLLBACK_PRECEDES_ACTIVATION');

  if (!SHA256_RE.test(execution.executionReceiptHashSha256 || '') || sha256Object(p60ReceiptCore(execution)) !== execution.executionReceiptHashSha256) blockers.push('P60_ROLLBACK_EXECUTION_RECEIPT_HASH_MISMATCH');
  return blockers;
}

function normalizePostRollbackReleaseVerifyEvidence(value) {
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
  if (normalized.registrySchemaVersion !== 1) throw new TypeError('releaseVerifyEvidence.registrySchemaVersion must equal 1');
  for (const field of ['releaseVerifyResult', 'testDiscoveryAndRegression', 'productionBuild', 'packageVerification', 'npmAuditReleaseThreshold', 'canonicalBaselineRegistryVerification']) {
    if (![PASS, FAIL].includes(normalized[field])) throw new TypeError(`releaseVerifyEvidence.${field} must be PASS or FAIL`);
  }
  return deepFreeze({ ...normalized, releaseVerifyEvidenceHashSha256: sha256Object(normalized) });
}

function failureResult({ blockers, contract, rollbackDecision, rollbackExecution, observedRegistryHashSha256 = null, observedRegistryContentSha256 = null, releaseVerifyEvidence = null }) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.FRESH_POST_ROLLBACK_VERIFICATION_FAILED_INCIDENT_OPEN,
    verified: true,
    blockers: Object.freeze([...new Set(blockers)]),
    freshActivationChangeContractHashSha256: contract.freshActivationChangeContractHashSha256,
    rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
    observedRegistryHashSha256,
    observedRegistryContentSha256,
    releaseVerifyEvidenceHashSha256: releaseVerifyEvidence?.releaseVerifyEvidenceHashSha256 || null,
    postRollbackVerificationPassed: false,
    restoredExactP57LegacyRegistry: false,
    rollbackTriggerVerified: true,
    rollbackExecutionVerified: true,
    postRollbackReleaseVerifyEvidenceConsistent: false,
    incidentCloseoutReady: false,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    failedFreshActivationCycleReusable: false,
    postRollbackFailureRequiresHumanIncidentHandling: true,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P62 found rollback restoration or post-rollback Release Verify evidence incomplete or failed. The incident remains open and the failed fresh activation cycle cannot be reused.',
  });
}

function evaluateFreshPostRollbackVerification({
  activationChangeContract,
  activationExecution,
  rollbackDecision,
  rollbackExecution,
  observedRegistry,
  observedRegistryContent,
  releaseVerifyEvidence = null,
  expectedReleaseVerifyCommitSha,
  incidentId,
  incidentRef,
  closeoutPreparedByRef,
  closeoutPreparedAt,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial({ activationChangeContract, activationExecution, rollbackDecision, rollbackExecution, observedRegistry, releaseVerifyEvidence, callerOverrides });
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const contractBlockers = validateP57ContractBoundary(activationChangeContract);
  if (contractBlockers.length > 0) return hold(contractBlockers);
  const activationBlockers = validateAppliedP60Activation(activationExecution, activationChangeContract);
  if (activationBlockers.length > 0) return hold(activationBlockers);
  const triggerBlockers = validateP61RollbackDecision(rollbackDecision, activationChangeContract, activationExecution);
  if (triggerBlockers.length > 0) return hold(triggerBlockers);
  const rollbackBlockers = validateAppliedP60Rollback(rollbackExecution, activationChangeContract, activationExecution);
  if (rollbackBlockers.length > 0) return hold(rollbackBlockers);

  if (!observedRegistry || typeof observedRegistry !== 'object' || Array.isArray(observedRegistry)) {
    return failureResult({ blockers: ['POST_ROLLBACK_OBSERVED_REGISTRY_REQUIRED'], contract: activationChangeContract, rollbackDecision, rollbackExecution });
  }
  if (typeof observedRegistryContent !== 'string' || observedRegistryContent === '') {
    return failureResult({ blockers: ['POST_ROLLBACK_OBSERVED_REGISTRY_CONTENT_REQUIRED'], contract: activationChangeContract, rollbackDecision, rollbackExecution, observedRegistryHashSha256: sha256Object(observedRegistry) });
  }

  const observedRegistryHashSha256 = sha256Object(observedRegistry);
  const observedRegistryContentSha256 = sha256Text(observedRegistryContent);
  const p58Legacy = verifyFreshDualModeCanonicalRegistry({ registry: observedRegistry, observedRegistryContent });
  const restorationFailures = [];
  if (p58Legacy.status !== P58_STATUS.LEGACY_BASELINE_VERIFIED || p58Legacy.verified !== true) restorationFailures.push('POST_ROLLBACK_P58_LEGACY_VERIFICATION_FAILED', ...(p58Legacy.blockers || []));
  if (observedRegistryHashSha256 !== activationChangeContract.rollbackRegistryHashSha256) restorationFailures.push('POST_ROLLBACK_REGISTRY_LOGICAL_HASH_MISMATCH');
  if (observedRegistryContentSha256 !== activationChangeContract.rollbackRegistryContentSha256) restorationFailures.push('POST_ROLLBACK_REGISTRY_CONTENT_HASH_MISMATCH');
  if (observedRegistryContent !== activationChangeContract.rollbackRegistryContent) restorationFailures.push('POST_ROLLBACK_REGISTRY_RAW_CONTENT_MISMATCH');
  if (stableStringify(observedRegistry) !== stableStringify(activationChangeContract.rollbackRegistry)) restorationFailures.push('POST_ROLLBACK_REGISTRY_OBJECT_MISMATCH');
  if (restorationFailures.length > 0) {
    return failureResult({ blockers: restorationFailures, contract: activationChangeContract, rollbackDecision, rollbackExecution, observedRegistryHashSha256, observedRegistryContentSha256 });
  }

  let expectedCommit;
  try {
    expectedCommit = requiredCommit(expectedReleaseVerifyCommitSha, 'expectedReleaseVerifyCommitSha');
  } catch (error) {
    return hold([error.message], {
      restoredExactP57LegacyRegistry: true,
      rollbackTriggerVerified: true,
      rollbackExecutionVerified: true,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
    });
  }

  if (releaseVerifyEvidence == null) {
    return hold(['POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_REQUIRED'], {
      restoredExactP57LegacyRegistry: true,
      rollbackTriggerVerified: true,
      rollbackExecutionVerified: true,
      observedRegistryHashSha256,
      observedRegistryContentSha256,
      expectedReleaseVerifyCommitSha: expectedCommit,
    });
  }

  let evidence;
  try {
    evidence = normalizePostRollbackReleaseVerifyEvidence(releaseVerifyEvidence);
  } catch (error) {
    return failureResult({ blockers: [`POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_INVALID:${error.message}`], contract: activationChangeContract, rollbackDecision, rollbackExecution, observedRegistryHashSha256, observedRegistryContentSha256 });
  }

  const evidenceFailures = [];
  for (const field of ['releaseVerifyResult', 'testDiscoveryAndRegression', 'productionBuild', 'packageVerification', 'npmAuditReleaseThreshold', 'canonicalBaselineRegistryVerification']) {
    if (evidence[field] !== PASS) evidenceFailures.push(`POST_ROLLBACK_${field.toUpperCase()}_NOT_PASS`);
  }
  if (evidence.activeMode !== MODE.LEGACY_FILE_SHA256) evidenceFailures.push('POST_ROLLBACK_ACTIVE_MODE_NOT_LEGACY');
  if (evidence.verificationMode !== LEGACY_VERIFICATION_MODE) evidenceFailures.push('POST_ROLLBACK_LEGACY_VERIFICATION_MODE_MISMATCH');
  if (evidence.registryHashSha256 !== observedRegistryHashSha256) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_REGISTRY_HASH_MISMATCH');
  if (evidence.registryContentSha256 !== observedRegistryContentSha256) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_CONTENT_HASH_MISMATCH');
  if (evidence.sourceCommitSha !== expectedCommit) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_SOURCE_COMMIT_MISMATCH');
  if (Date.parse(evidence.completedAt) < Date.parse(rollbackExecution.executedAt)) evidenceFailures.push('POST_ROLLBACK_RELEASE_VERIFY_PRECEDES_ROLLBACK');
  if (evidenceFailures.length > 0) {
    return failureResult({ blockers: evidenceFailures, contract: activationChangeContract, rollbackDecision, rollbackExecution, observedRegistryHashSha256, observedRegistryContentSha256, releaseVerifyEvidence: evidence });
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
      restoredExactP57LegacyRegistry: true,
      rollbackTriggerVerified: true,
      rollbackExecutionVerified: true,
      postRollbackReleaseVerifyEvidenceConsistent: true,
      releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    });
  }
  if (Date.parse(normalizedPreparedAt) < Date.parse(evidence.completedAt)) {
    return hold(['INCIDENT_CLOSEOUT_PREPARATION_PRECEDES_POST_ROLLBACK_RELEASE_VERIFY'], {
      restoredExactP57LegacyRegistry: true,
      rollbackTriggerVerified: true,
      rollbackExecutionVerified: true,
      postRollbackReleaseVerifyEvidenceConsistent: true,
      releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    });
  }

  const core = {
    schemaVersion: 1,
    incidentId: normalizedIncidentId,
    incidentRef: normalizedIncidentRef,
    closeoutPreparedByRef: normalizedPreparedBy,
    closeoutPreparedAt: normalizedPreparedAt,
    cycleId: activationChangeContract.cycleId,
    freshReactivationGovernanceCycleHashSha256: activationChangeContract.freshReactivationGovernanceCycleHashSha256,
    freshActivationChangeContractHashSha256: activationChangeContract.freshActivationChangeContractHashSha256,
    activationExecutionReceiptHashSha256: activationExecution.executionReceiptHashSha256,
    rollbackTriggerHashSha256: rollbackDecision.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: rollbackExecution.executionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: observedRegistryHashSha256,
    restoredLegacyRegistryContentSha256: observedRegistryContentSha256,
    postRollbackReleaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    postRollbackReleaseVerifyRunId: evidence.runId,
    postRollbackReleaseVerifySourceCommitSha: evidence.sourceCommitSha,
    postRollbackReleaseVerifyCompletedAt: evidence.completedAt,
    rollbackReasonCodes: Object.freeze([...(rollbackDecision.rollbackTrigger.reasonCodes || [])]),
  };

  const incidentCloseoutPacket = deepFreeze({
    ...core,
    incidentCloseoutPacketHashSha256: sha256Object(core),
    restoredExactP57LegacyRegistry: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    failedFreshActivationCycleReusable: false,
    releaseStillBlocked: true,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    ...AUTHORITY,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY,
    verified: true,
    blockers: Object.freeze([]),
    postRollbackVerificationHashSha256: sha256Object(core),
    postRollbackVerificationPassed: true,
    restoredExactP57LegacyRegistry: true,
    rollbackTriggerVerified: true,
    rollbackExecutionVerified: true,
    postRollbackReleaseVerifyEvidenceConsistent: true,
    releaseVerifyEvidenceHashSha256: evidence.releaseVerifyEvidenceHashSha256,
    releaseVerifyEvidenceAuthenticityVerifiedHere: false,
    productionEvidenceEstablishedHere: false,
    incidentCloseoutReady: true,
    incidentClosed: false,
    humanIncidentCloseoutRequired: true,
    automaticIncidentCloseoutPerformed: false,
    incidentCloseoutPacket,
    incidentCloseoutPacketHashSha256: incidentCloseoutPacket.incidentCloseoutPacketHashSha256,
    failedFreshActivationCycleReusable: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    ...AUTHORITY,
    semantics: 'P62 proves only that the exact P57 legacy baseline was restored after a P61-triggered P60 rollback and that supplied post-rollback Release Verify evidence is internally consistent with a caller-pinned commit. The incident is ready for separate human closeout only.',
  });
}

module.exports = {
  STATUS,
  LEGACY_VERIFICATION_MODE,
  validateP61RollbackDecision,
  validateAppliedP60Rollback,
  normalizePostRollbackReleaseVerifyEvidence,
  evaluateFreshPostRollbackVerification,
};
