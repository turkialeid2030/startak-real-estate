'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const {
  validateP62CloseoutReady,
} = require('./fresh-post-rollback-verification-incident-closeout');
const {
  STATUS: P63_STATUS,
  verifyFreshHumanIncidentCloseoutDecision,
} = require('./fresh-human-incident-closeout-decision');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE: 'HOLD_SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE',
  SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED: 'SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_REUSE_FIELDS = Object.freeze([
  'freshReviewerDesignationHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'verifiedFreshReviewRecordHashSha256',
  'freshActivationPlanHashSha256',
  'freshCutoverSafetyGuardHashSha256',
  'verifiedFreshOwnerAuthorizationRecordHashSha256',
  'freshActivationChangeContractHashSha256',
  'activationExecutionReceiptHashSha256',
  'rollbackTriggerHashSha256',
  'rollbackExecutionReceiptHashSha256',
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
function findForbiddenReuse(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REUSE_FIELDS.includes(key) && child != null) return `${path}.${key}`;
    const nested = findForbiddenReuse(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false)
    || (value.incidentClosureTreatedAsReleaseAuthorization != null && value.incidentClosureTreatedAsReleaseAuthorization !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    successorFreshGovernanceCycleOpened: false,
    predecessorP63Reverified: false,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorFreshReviewerArtifactsAccepted: false,
    predecessorFreshOwnerAuthorizationAccepted: false,
    predecessorFreshActivationPlanAccepted: false,
    predecessorFreshActivationContractAccepted: false,
    predecessorFreshRollbackEvidenceAcceptedAsAuthority: false,
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
    ...extra,
  });
}

function validateSuppliedP63AgainstRecomputed(p63, recomputed) {
  const blockers = [];
  if (!p63 || p63.status !== P63_STATUS.FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED) {
    return ['P63_VERIFIED_FRESH_INCIDENT_CLOSURE_REQUIRED'];
  }
  if (
    p63.verified !== true
    || p63.incidentClosed !== true
    || p63.humanIncidentCloseoutDecisionVerified !== true
    || p63.automaticIncidentCloseoutPerformed !== false
    || p63.incidentAuthorityIdentityCryptographicallyVerified !== true
    || p63.incidentAuthorityTrustRootVerified !== true
    || p63.incidentCloseoutSignatureVerified !== true
    || p63.governanceResetReady !== true
    || p63.failedFreshActivationCycleReusable !== false
    || p63.historicalFreshActivationCycleOnly !== true
    || p63.newGovernanceCycleRequired !== true
    || p63.reactivationAllowed !== false
    || p63.releaseStillBlocked !== true
    || !allAuthorityFalse(p63)
  ) blockers.push('P63_FRESH_INCIDENT_CLOSURE_BOUNDARY_INVALID');
  if (recomputed.status !== P63_STATUS.FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED || recomputed.verified !== true) blockers.push('P63_RECOMPUTATION_DID_NOT_CLOSE_INCIDENT');
  if (p63.verifiedFreshIncidentCloseoutDecisionRecordHashSha256 !== recomputed.verifiedFreshIncidentCloseoutDecisionRecordHashSha256) blockers.push('P63_DECISION_RECORD_HASH_MISMATCH');
  if (p63.governanceResetRecordHashSha256 !== recomputed.governanceResetRecordHashSha256) blockers.push('P63_GOVERNANCE_RESET_RECORD_HASH_MISMATCH');
  if (stableStringify(p63.governanceResetRecord) !== stableStringify(recomputed.governanceResetRecord)) blockers.push('P63_GOVERNANCE_RESET_RECORD_OBJECT_MISMATCH');
  return blockers;
}

function normalizeSuccessorCycleScope(scope, predecessorClosedAt, predecessorCycleId) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new TypeError('cycleScope must be an object');
  const forbiddenKey = findForbiddenKeyMaterial(scope);
  if (forbiddenKey) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbiddenKey}`);
  const forbiddenReuse = findForbiddenReuse(scope);
  if (forbiddenReuse) throw new TypeError(`PRIOR_FRESH_GOVERNANCE_ARTIFACT_REUSE_NOT_ALLOWED:${forbiddenReuse}`);
  if (callerAuthorityEscalated(scope)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  const preparedAt = iso(scope.preparedAt, 'cycleScope.preparedAt');
  if (Date.parse(preparedAt) < Date.parse(predecessorClosedAt)) throw new TypeError('SUCCESSOR_FRESH_CYCLE_PREPARATION_PRECEDES_INCIDENT_CLOSURE');
  const cycleId = requiredString(scope.cycleId, 'cycleScope.cycleId');
  if (cycleId === predecessorCycleId) throw new TypeError('SUCCESSOR_FRESH_CYCLE_ID_MUST_DIFFER_FROM_FAILED_CYCLE');
  const requestedTargetMode = requiredString(scope.requestedTargetMode, 'cycleScope.requestedTargetMode');
  if (requestedTargetMode !== MODE.GOVERNED_COMPOSITE_BASELINE) throw new TypeError('SUCCESSOR_FRESH_CYCLE_TARGET_MODE_INVALID');
  return deepFreeze({
    cycleId,
    ownerActorRef: requiredString(scope.ownerActorRef, 'cycleScope.ownerActorRef'),
    preparedAt,
    requestedTargetMode,
    qualifiedSourceCommitSha: requiredCommit(scope.qualifiedSourceCommitSha, 'cycleScope.qualifiedSourceCommitSha'),
    releaseArtifactSha256: requiredSha256(scope.releaseArtifactSha256, 'cycleScope.releaseArtifactSha256'),
    environmentConfigSha256: requiredSha256(scope.environmentConfigSha256, 'cycleScope.environmentConfigSha256'),
    cycleRationaleRef: requiredString(scope.cycleRationaleRef, 'cycleScope.cycleRationaleRef'),
    cycleEvidenceArtifactSha256: requiredSha256(scope.cycleEvidenceArtifactSha256, 'cycleScope.cycleEvidenceArtifactSha256'),
  });
}

function openSuccessorFreshReactivationGovernanceCycle({
  p62,
  p63,
  incidentAuthorityRegistry,
  expectedIncidentAuthorityRegistryHashSha256,
  signedIncidentDecision,
  currentRegistry,
  currentRegistryContent,
  cycleScope,
  ...callerOverrides
} = {}) {
  const forbiddenKey = findForbiddenKeyMaterial({ p62, p63, incidentAuthorityRegistry, signedIncidentDecision, currentRegistry, cycleScope, callerOverrides });
  if (forbiddenKey) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbiddenKey}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const p62Blockers = validateP62CloseoutReady(p62);
  if (p62Blockers.length > 0) return hold(p62Blockers);

  const recomputedP63 = verifyFreshHumanIncidentCloseoutDecision({
    p62,
    incidentAuthorityRegistry,
    expectedIncidentAuthorityRegistryHashSha256,
    signedDecision: signedIncidentDecision,
  });
  const p63Blockers = validateSuppliedP63AgainstRecomputed(p63, recomputedP63);
  if (p63Blockers.length > 0) return hold(p63Blockers);

  if (!currentRegistry || typeof currentRegistry !== 'object' || Array.isArray(currentRegistry)) return hold(['CURRENT_CANONICAL_BASELINE_REGISTRY_REQUIRED'], { predecessorP63Reverified: true });
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') return hold(['CURRENT_CANONICAL_BASELINE_REGISTRY_CONTENT_REQUIRED'], { predecessorP63Reverified: true });
  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_BASELINE_MUST_BE_CONFIRMED_LEGACY'], { predecessorP63Reverified: true });
  const expectedLegacyHash = p62.incidentCloseoutPacket.restoredLegacyRegistryHashSha256;
  const expectedLegacyContentHash = p62.incidentCloseoutPacket.restoredLegacyRegistryContentSha256;
  const observedContentHash = sha256Text(currentRegistryContent);
  if (observed.registryHashSha256 !== expectedLegacyHash) return hold(['CURRENT_LEGACY_REGISTRY_DOES_NOT_MATCH_P62_RESTORED_BASELINE'], { predecessorP63Reverified: true, observedRegistryHashSha256: observed.registryHashSha256, observedRegistryContentSha256: observedContentHash });
  if (observedContentHash !== expectedLegacyContentHash) return hold(['CURRENT_LEGACY_REGISTRY_CONTENT_DOES_NOT_MATCH_P62_RESTORED_BASELINE'], { predecessorP63Reverified: true, observedRegistryHashSha256: observed.registryHashSha256, observedRegistryContentSha256: observedContentHash });

  let scope;
  try {
    scope = normalizeSuccessorCycleScope(cycleScope, p63.decidedAt, p62.incidentCloseoutPacket.cycleId);
  } catch (error) {
    return hold([error.message], { predecessorP63Reverified: true, observedRegistryHashSha256: observed.registryHashSha256, observedRegistryContentSha256: observedContentHash });
  }

  const predecessorCycle = deepFreeze({
    incidentId: p62.incidentCloseoutPacket.incidentId,
    incidentRef: p62.incidentCloseoutPacket.incidentRef,
    failedFreshCycleId: p62.incidentCloseoutPacket.cycleId,
    failedFreshReactivationGovernanceCycleHashSha256: p62.incidentCloseoutPacket.freshReactivationGovernanceCycleHashSha256,
    incidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256,
    verifiedFreshIncidentCloseoutDecisionRecordHashSha256: p63.verifiedFreshIncidentCloseoutDecisionRecordHashSha256,
    governanceResetRecordHashSha256: p63.governanceResetRecordHashSha256,
    rootCauseAnalysisSha256: p63.rootCauseAnalysisSha256,
    correctivePreventiveActionSha256: p63.correctivePreventiveActionSha256,
    restoredLegacyRegistryHashSha256: expectedLegacyHash,
    restoredLegacyRegistryContentSha256: expectedLegacyContentHash,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorAuthoritiesReusable: false,
  });

  const core = {
    schemaVersion: 1,
    cycleKind: 'SUCCESSOR_FRESH_REACTIVATION_AFTER_FRESH_INCIDENT',
    cycleId: scope.cycleId,
    ownerActorRef: scope.ownerActorRef,
    preparedAt: scope.preparedAt,
    currentAuthoritativeMode: MODE.LEGACY_FILE_SHA256,
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: observedContentHash,
    requestedTargetMode: scope.requestedTargetMode,
    qualifiedSourceCommitSha: scope.qualifiedSourceCommitSha,
    releaseArtifactSha256: scope.releaseArtifactSha256,
    environmentConfigSha256: scope.environmentConfigSha256,
    cycleRationaleRef: scope.cycleRationaleRef,
    cycleEvidenceArtifactSha256: scope.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: p63.verifiedFreshIncidentCloseoutDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: p63.governanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: p63.rootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: p63.correctivePreventiveActionSha256,
  };
  const cycleHash = sha256Object(core);

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_REACTIVATION_GOVERNANCE_CYCLE_OPEN_NOT_AUTHORIZED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshReactivationGovernanceCycleHashSha256: cycleHash,
    successorFreshGovernanceCycleOpened: true,
    predecessorP63Reverified: true,
    predecessorCycle,
    predecessorFailedFreshCycleHistoricalOnly: true,
    predecessorFreshReviewerArtifactsAccepted: false,
    predecessorFreshOwnerAuthorizationAccepted: false,
    predecessorFreshActivationPlanAccepted: false,
    predecessorFreshActivationContractAccepted: false,
    predecessorFreshRollbackEvidenceAcceptedAsAuthority: false,
    freshIndependentReviewerDesignationRequired: true,
    freshIndependentReviewRequired: true,
    freshReviewerLifecycleLockRequired: true,
    freshActivationPlanRequired: true,
    freshShadowEvidenceRequired: true,
    freshCutoverRehearsalRequired: true,
    freshCutoverSafetyEvidenceRequired: true,
    freshOwnerActivationAuthorizationRequired: true,
    freshActivationChangeContractRequired: true,
    postActivationReleaseVerifyRequired: true,
    incidentClosureTreatedAsReleaseAuthorization: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P64 opens only a successor fresh governance envelope after re-verifying the P63 cryptographic human closeout against P62. The failed fresh activation cycle remains historical and contributes no reviewer, owner, plan, contract, rollback, release or mutation authority to the successor cycle.',
  });
}

module.exports = {
  STATUS,
  FORBIDDEN_REUSE_FIELDS,
  validateSuppliedP63AgainstRecomputed,
  normalizeSuccessorCycleScope,
  openSuccessorFreshReactivationGovernanceCycle,
};
