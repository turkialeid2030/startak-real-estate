'use strict';

const crypto = require('crypto');
const { MODE, STATUS: REGISTRY_STATUS, evaluateCurrentCanonicalBaselineRegistry, stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P45_STATUS } = require('./human-incident-closeout-decision');

const STATUS = Object.freeze({
  HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE: 'HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE',
  FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED: 'FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED',
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
const FORBIDDEN_REUSE_FIELDS = Object.freeze([
  'reviewerLockHashSha256',
  'reviewerApprovalHashSha256',
  'activationPlanHashSha256',
  'activationAuthorizationHashSha256',
  'signedOwnerAuthorizationVerificationHashSha256',
  'cutoverSafetyGuardHashSha256',
  'activationChangeContractHashSha256',
]);

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
function privateKeyPresent(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).some((key) => /private[-_]?key/i.test(key)));
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAllowed != null && value.reactivationAllowed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_FRESH_REACTIVATION_GOVERNANCE_CYCLE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    freshGovernanceCycleOpened: false,
    reactivationAuthorized: false,
    priorReviewerApprovalAccepted: false,
    priorActivationAuthorizationAccepted: false,
    priorActivationPlanAccepted: false,
    priorActivationContractAccepted: false,
    incidentClosureTreatedAsReleaseAuthorization: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function humanDecisionCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    purpose: record.purpose,
    incidentId: record.incidentId,
    incidentRef: record.incidentRef,
    incidentCloseoutPacketHashSha256: record.incidentCloseoutPacketHashSha256,
    incidentAuthorityRegistryHashSha256: record.incidentAuthorityRegistryHashSha256,
    incidentAuthorityId: record.incidentAuthorityId,
    incidentAuthorityActorRef: record.incidentAuthorityActorRef,
    incidentAuthorityPublicKeySha256: record.incidentAuthorityPublicKeySha256,
    decisionId: record.decisionId,
    decision: record.decision,
    decidedAt: record.decidedAt,
    decisionSourceRef: record.decisionSourceRef,
    decisionArtifactSha256: record.decisionArtifactSha256,
    rationaleRef: record.rationaleRef,
    rootCauseAnalysisRef: record.rootCauseAnalysisRef,
    rootCauseAnalysisSha256: record.rootCauseAnalysisSha256,
    correctivePreventiveActionRef: record.correctivePreventiveActionRef,
    correctivePreventiveActionSha256: record.correctivePreventiveActionSha256,
    signingPayloadHashSha256: record.signingPayloadHashSha256,
  };
}

function governanceResetCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    incidentId: record.incidentId,
    incidentRef: record.incidentRef,
    incidentCloseoutPacketHashSha256: record.incidentCloseoutPacketHashSha256,
    humanDecisionRecordHashSha256: record.humanDecisionRecordHashSha256,
    historicalActivationChangeContractHashSha256: record.historicalActivationChangeContractHashSha256,
    historicalActivationExecutionReceiptHashSha256: record.historicalActivationExecutionReceiptHashSha256,
    historicalRollbackTriggerHashSha256: record.historicalRollbackTriggerHashSha256,
    historicalRollbackExecutionReceiptHashSha256: record.historicalRollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: record.restoredLegacyRegistryHashSha256,
    decision: record.decision,
    incidentClosed: record.incidentClosed,
  };
}

function validateP45ClosedDecision(p45) {
  const blockers = [];
  if (!p45 || p45.status !== P45_STATUS.INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED) {
    return ['P45_VERIFIED_HUMAN_INCIDENT_CLOSURE_REQUIRED'];
  }
  if (
    p45.verified !== true
    || p45.incidentClosed !== true
    || p45.humanIncidentCloseoutDecisionVerified !== true
    || p45.automaticIncidentCloseoutPerformed !== false
    || p45.incidentAuthorityIdentityCryptographicallyVerified !== true
    || p45.incidentAuthorityTrustRootVerified !== true
    || p45.incidentCloseoutSignatureVerified !== true
    || p45.reactivationAllowed !== false
    || p45.previousActivationAuthorizationReusable !== false
    || p45.previousReviewerApprovalReusable !== false
    || p45.failedActivationCycleReusable !== false
    || p45.historicalActivationCycleOnly !== true
    || p45.newGovernanceCycleRequired !== true
    || p45.releaseStillBlocked !== true
    || !allAuthorityFalse(p45)
  ) blockers.push('P45_INCIDENT_CLOSURE_BOUNDARY_INVALID');

  const decision = p45.humanDecisionRecord;
  const reset = p45.governanceResetRecord;
  if (!decision || typeof decision !== 'object') return [...blockers, 'P45_HUMAN_DECISION_RECORD_REQUIRED'];
  if (!reset || typeof reset !== 'object') return [...blockers, 'P45_GOVERNANCE_RESET_RECORD_REQUIRED'];
  try {
    const decisionHash = requiredSha256(decision.humanDecisionRecordHashSha256, 'humanDecisionRecordHashSha256');
    if (sha256Object(humanDecisionCore(decision)) !== decisionHash) blockers.push('P45_HUMAN_DECISION_RECORD_HASH_MISMATCH');
    if (p45.humanDecisionRecordHashSha256 !== decisionHash) blockers.push('P45_RESULT_HUMAN_DECISION_HASH_MISMATCH');
    if (decision.decision !== 'CLOSE_INCIDENT') blockers.push('P45_DECISION_MUST_CLOSE_INCIDENT');
    if (
      decision.incidentAuthorityIdentityCryptographicallyVerified !== true
      || decision.incidentAuthorityTrustRootVerified !== true
      || decision.incidentCloseoutSignatureVerified !== true
    ) blockers.push('P45_DECISION_CRYPTOGRAPHIC_GUARANTEES_INCOMPLETE');

    const resetHash = requiredSha256(reset.governanceResetRecordHashSha256, 'governanceResetRecordHashSha256');
    if (sha256Object(governanceResetCore(reset)) !== resetHash) blockers.push('P45_GOVERNANCE_RESET_RECORD_HASH_MISMATCH');
    if (p45.governanceResetRecordHashSha256 !== resetHash) blockers.push('P45_RESULT_GOVERNANCE_RESET_HASH_MISMATCH');
    if (reset.humanDecisionRecordHashSha256 !== decisionHash) blockers.push('P45_RESET_DECISION_BINDING_MISMATCH');
    if (reset.incidentId !== p45.incidentId || reset.incidentRef !== p45.incidentRef) blockers.push('P45_RESET_INCIDENT_SCOPE_MISMATCH');
    if (
      reset.previousActivationCycleHistoricalOnly !== true
      || reset.previousActivationAuthorizationReusable !== false
      || reset.previousReviewerApprovalReusable !== false
      || reset.failedActivationCycleReusable !== false
      || reset.reactivationAllowed !== false
      || reset.newGovernanceCycleRequired !== true
      || reset.releaseStillBlocked !== true
      || !allAuthorityFalse(reset)
    ) blockers.push('P45_GOVERNANCE_RESET_BOUNDARY_INVALID');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeFreshCycleScope(scope, p45) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('cycleScope must be an object');
  if (privateKeyPresent(scope)) throw new TypeError('PRIVATE_SIGNING_KEY_INPUT_REJECTED');
  if (callerAuthorityEscalated(scope)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  for (const field of FORBIDDEN_REUSE_FIELDS) {
    if (scope[field] != null) throw new TypeError(`PRIOR_GOVERNANCE_ARTIFACT_REUSE_NOT_ALLOWED:${field}`);
  }
  const preparedAt = iso(scope.preparedAt, 'cycleScope.preparedAt');
  const closedAt = p45.humanDecisionRecord.decidedAt;
  if (Date.parse(preparedAt) < Date.parse(closedAt)) throw new TypeError('FRESH_CYCLE_PREPARATION_PRECEDES_INCIDENT_CLOSURE');
  const requestedTargetMode = requiredString(scope.requestedTargetMode, 'cycleScope.requestedTargetMode');
  if (requestedTargetMode !== MODE.GOVERNED_COMPOSITE_BASELINE) throw new TypeError('FRESH_CYCLE_TARGET_MODE_INVALID');
  const qualifiedSourceCommitSha = requiredString(scope.qualifiedSourceCommitSha, 'cycleScope.qualifiedSourceCommitSha').toLowerCase();
  if (!COMMIT_RE.test(qualifiedSourceCommitSha)) throw new TypeError('cycleScope.qualifiedSourceCommitSha must be a 40-character Git SHA');
  return deepFreeze({
    cycleId: requiredString(scope.cycleId, 'cycleScope.cycleId'),
    ownerActorRef: requiredString(scope.ownerActorRef, 'cycleScope.ownerActorRef'),
    preparedAt,
    requestedTargetMode,
    qualifiedSourceCommitSha,
    releaseArtifactSha256: requiredSha256(scope.releaseArtifactSha256, 'cycleScope.releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(scope.environmentConfigSha256, 'cycleScope.environmentConfigSha256'),
    cycleRationaleRef: requiredString(scope.cycleRationaleRef, 'cycleScope.cycleRationaleRef'),
    cycleEvidenceArtifactSha256: requiredSha256(scope.cycleEvidenceArtifactSha256, 'cycleScope.cycleEvidenceArtifactSha256'),
  });
}

function openFreshReactivationGovernanceCycle({ p45, currentRegistry, cycleScope, ...callerOverrides } = {}) {
  if (privateKeyPresent(callerOverrides) || privateKeyPresent({ p45, currentRegistry, cycleScope, ...callerOverrides })) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const p45Blockers = validateP45ClosedDecision(p45);
  if (p45Blockers.length > 0) return hold(p45Blockers);

  if (!currentRegistry || typeof currentRegistry !== 'object' || Array.isArray(currentRegistry)) return hold(['CURRENT_CANONICAL_BASELINE_REGISTRY_REQUIRED']);
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_BASELINE_MUST_BE_CONFIRMED_LEGACY']);
  const reset = p45.governanceResetRecord;
  if (observed.registryHashSha256 !== reset.restoredLegacyRegistryHashSha256) return hold(['CURRENT_LEGACY_REGISTRY_DOES_NOT_MATCH_P45_RESTORED_BASELINE'], { observedRegistryHashSha256: observed.registryHashSha256 });

  let scope;
  try {
    scope = normalizeFreshCycleScope(cycleScope, p45);
  } catch (error) {
    return hold([error.message], { observedRegistryHashSha256: observed.registryHashSha256 });
  }

  const priorCycle = deepFreeze({
    incidentId: p45.incidentId,
    incidentRef: p45.incidentRef,
    incidentCloseoutPacketHashSha256: p45.incidentCloseoutPacketHashSha256,
    humanDecisionRecordHashSha256: p45.humanDecisionRecordHashSha256,
    governanceResetRecordHashSha256: p45.governanceResetRecordHashSha256,
    historicalActivationChangeContractHashSha256: reset.historicalActivationChangeContractHashSha256,
    historicalActivationExecutionReceiptHashSha256: reset.historicalActivationExecutionReceiptHashSha256,
    historicalRollbackTriggerHashSha256: reset.historicalRollbackTriggerHashSha256,
    historicalRollbackExecutionReceiptHashSha256: reset.historicalRollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: reset.restoredLegacyRegistryHashSha256,
    priorCycleHistoricalOnly: true,
    priorAuthoritiesReusable: false,
  });

  const core = {
    schemaVersion: 1,
    cycleId: scope.cycleId,
    ownerActorRef: scope.ownerActorRef,
    preparedAt: scope.preparedAt,
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: observed.registryHashSha256,
    requestedTargetMode: scope.requestedTargetMode,
    qualifiedSourceCommitSha: scope.qualifiedSourceCommitSha,
    releaseArtifactSha256: scope.releaseArtifactSha256,
    environmentConfigSha256: scope.environmentConfigSha256,
    cycleRationaleRef: scope.cycleRationaleRef,
    cycleEvidenceArtifactSha256: scope.cycleEvidenceArtifactSha256,
    priorGovernanceResetRecordHashSha256: p45.governanceResetRecordHashSha256,
    priorHumanDecisionRecordHashSha256: p45.humanDecisionRecordHashSha256,
  };
  const cycleHash = sha256Object(core);

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    freshReactivationGovernanceCycleHashSha256: cycleHash,
    freshGovernanceCycleOpened: true,
    priorCycle,
    priorReviewerApprovalAccepted: false,
    priorActivationAuthorizationAccepted: false,
    priorActivationPlanAccepted: false,
    priorActivationContractAccepted: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P46 opens only a fresh governance envelope after verified human incident closure. The failed activation cycle is historical and cannot contribute reviewer, plan, contract, or owner-authorization authority to this cycle. No baseline mutation or release authority is granted.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  FORBIDDEN_REUSE_FIELDS,
  validateP45ClosedDecision,
  normalizeFreshCycleScope,
  openFreshReactivationGovernanceCycle,
};
