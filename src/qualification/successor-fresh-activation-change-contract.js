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
  STATUS: P74_STATUS,
  verifySuccessorFreshOwnerActivationAuthorization,
} = require('./successor-fresh-owner-activation-authorization');
const {
  STATUS: P69_STATUS,
  createSuccessorFreshCompositeRegistryCandidate,
} = require('./successor-fresh-composite-registry-candidate');
const { validateP69Candidate } = require('./successor-fresh-composite-evidence-verifier');

const TARGET_PATH = 'config/governance/canonical-baseline.json';
const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT: 'HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT',
  SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED: 'SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED',
});

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
    || (value.activationApplied != null && value.activationApplied !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    targetPath: TARGET_PATH,
    successorFreshActivationChangeContractHashSha256: null,
    ownerActivationAuthorizationVerified: false,
    ownerSignatureVerified: false,
    ownerTrustRootVerified: false,
    activationAuthorizationEvidenceBound: false,
    rollbackRestoresExactCurrentLogicalRegistry: false,
    rollbackRestoresExactCurrentRawRegistry: false,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorFreshActivationContractReusable: false,
    successorFreshDualModeRegistryVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function verifySuccessorCandidateBindings(candidate, activationPlan, safetyGuard, current, currentRegistryContent) {
  const blockers = [...validateP69Candidate(candidate)];
  if (!candidate || !activationPlan || !safetyGuard) return [...new Set(blockers)];
  const contentHash = sha256Text(currentRegistryContent);
  if (candidate.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P69_CURRENT_REGISTRY_HASH_BINDING_MISMATCH');
  if (candidate.currentRegistryContentSha256 !== contentHash) blockers.push('P69_CURRENT_REGISTRY_CONTENT_BINDING_MISMATCH');
  if (candidate.cycleId !== activationPlan.cycleId) blockers.push('P69_P68_CYCLE_MISMATCH');
  if (candidate.successorFreshReactivationGovernanceCycleHashSha256 !== activationPlan.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P69_P68_CYCLE_HASH_MISMATCH');
  if (candidate.successorFreshReviewerLifecycleLockHashSha256 !== activationPlan.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P69_P68_REVIEWER_LOCK_MISMATCH');
  if (candidate.successorFreshActivationPlanHashSha256 !== activationPlan.successorFreshActivationPlanHashSha256) blockers.push('P69_P68_ACTIVATION_PLAN_MISMATCH');
  if (candidate.successorFreshBaselineManifestHashSha256 !== activationPlan.successorFreshBaselineManifestHashSha256) blockers.push('P69_P68_BASELINE_MANIFEST_MISMATCH');
  if (safetyGuard.successorFreshCompositeRegistryCandidateHashSha256 !== candidate.successorFreshCompositeRegistryCandidateHashSha256) blockers.push('P73_P69_CANDIDATE_RECORD_MISMATCH');
  if (safetyGuard.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('P73_P69_CANDIDATE_LOGICAL_HASH_MISMATCH');
  if (safetyGuard.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) blockers.push('P73_P69_CANDIDATE_CONTENT_HASH_MISMATCH');
  const recomputed = createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry: JSON.parse(currentRegistryContent), currentRegistryContent });
  if (recomputed.status !== P69_STATUS.SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE || recomputed.verified !== true) blockers.push('P69_CANDIDATE_RECOMPUTATION_FAILED');
  else {
    if (recomputed.successorFreshCompositeRegistryCandidateHashSha256 !== candidate.successorFreshCompositeRegistryCandidateHashSha256) blockers.push('P69_CANDIDATE_RECOMPUTATION_HASH_MISMATCH');
    if (recomputed.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('P69_CANDIDATE_RECOMPUTATION_LOGICAL_HASH_MISMATCH');
    if (recomputed.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) blockers.push('P69_CANDIDATE_RECOMPUTATION_CONTENT_HASH_MISMATCH');
  }
  return [...new Set(blockers)];
}

function createSuccessorFreshActivationChangeContract({
  currentRegistry,
  currentRegistryContent,
  successorReviewPacket,
  reviewerLifecycle,
  activationPlan,
  successorFreshCompositeCandidate,
  successorFreshShadowEvaluation,
  successorFreshRehearsalResult,
  safetyGuard,
  successorFreshOwnerAuthorityRegistry,
  expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  contractId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  const forbidden = findForbiddenKeyMaterial(callerOverrides);
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED']);
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') return hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED']);
  try {
    const parsed = JSON.parse(currentRegistryContent);
    if (stableStringify(parsed) !== stableStringify(currentRegistry)) return hold(['CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH']);
  } catch (_) {
    return hold(['CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON']);
  }

  const candidateBlockers = verifySuccessorCandidateBindings(
    successorFreshCompositeCandidate,
    activationPlan,
    safetyGuard,
    current,
    currentRegistryContent,
  );
  if (candidateBlockers.length > 0) return hold(candidateBlockers, { currentRegistryHashSha256: current.registryHashSha256 });

  const ownerAuthorization = verifySuccessorFreshOwnerActivationAuthorization({
    safetyGuard,
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
    successorFreshOwnerAuthorityRegistry,
    expectedSuccessorFreshOwnerAuthorityRegistryHashSha256,
    decision: signedOwnerDecision,
  });
  if (
    ownerAuthorization.status !== P74_STATUS.SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED
    || ownerAuthorization.verified !== true
    || ownerAuthorization.ownerActivationAuthorizationVerified !== true
    || ownerAuthorization.ownerSignatureVerified !== true
    || ownerAuthorization.ownerTrustRootVerified !== true
    || ownerAuthorization.activationAuthorized !== false
    || ownerAuthorization.activationApplied !== false
    || ownerAuthorization.releaseStillBlocked !== true
  ) {
    return hold(ownerAuthorization.blockers?.length ? ownerAuthorization.blockers : ['P74_SUCCESSOR_FRESH_OWNER_AUTHORIZATION_REQUIRED']);
  }

  let id;
  let preparer;
  let preparedAtIso;
  try {
    id = requiredString(contractId, 'contractId');
    preparer = requiredString(preparedByRef, 'preparedByRef');
    preparedAtIso = iso(preparedAt, 'preparedAt');
  } catch (error) {
    return hold([error.message]);
  }
  if (preparer !== activationPlan.preparedByRef || preparer !== ownerAuthorization.ownerActorRef) return hold(['SUCCESSOR_FRESH_ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_CYCLE_OWNER']);
  const ownerDecisionAt = ownerAuthorization.verifiedOwnerAuthorizationRecord?.decidedAt;
  if (!ownerDecisionAt || Date.parse(preparedAtIso) < Date.parse(ownerDecisionAt)) return hold(['SUCCESSOR_FRESH_ACTIVATION_CONTRACT_PRECEDES_VERIFIED_OWNER_DECISION']);

  const proposedRegistry = JSON.parse(JSON.stringify(successorFreshCompositeCandidate.proposedRegistry));
  const proposedRegistryContent = successorFreshCompositeCandidate.proposedRegistryContent;
  if (proposedRegistry.schemaVersion !== 4 || proposedRegistry.activeMode !== MODE.GOVERNED_COMPOSITE_BASELINE) return hold(['P69_PROPOSED_SCHEMA_V4_REGISTRY_REQUIRED']);
  if (canonicalContent(proposedRegistry) !== proposedRegistryContent) return hold(['P69_PROPOSED_REGISTRY_CONTENT_NOT_CANONICAL']);
  if (sha256Object(proposedRegistry) !== successorFreshCompositeCandidate.candidateRegistryHashSha256) return hold(['P69_PROPOSED_REGISTRY_LOGICAL_HASH_MISMATCH']);
  if (sha256Text(proposedRegistryContent) !== successorFreshCompositeCandidate.candidateRegistryContentSha256) return hold(['P69_PROPOSED_REGISTRY_CONTENT_HASH_MISMATCH']);

  const rollbackRegistry = JSON.parse(JSON.stringify(currentRegistry));
  const rollbackRegistryContent = currentRegistryContent;
  const rollbackRegistryHashSha256 = sha256Object(rollbackRegistry);
  const rollbackRegistryContentSha256 = sha256Text(rollbackRegistryContent);
  if (rollbackRegistryHashSha256 !== current.registryHashSha256) return hold(['ROLLBACK_REGISTRY_DOES_NOT_RESTORE_CURRENT_LOGICAL_HASH']);
  if (rollbackRegistryContentSha256 !== safetyGuard.currentRegistryContentSha256) return hold(['ROLLBACK_REGISTRY_DOES_NOT_RESTORE_EXACT_CURRENT_RAW_CONTENT']);

  const core = {
    schemaVersion: 1,
    contractId: id,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    targetPath: TARGET_PATH,
    expectedPriorMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    proposedRegistrySchemaVersion: 4,
    cycleId: activationPlan.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: activationPlan.successorFreshReactivationGovernanceCycleHashSha256,
    expectedPriorRegistryHashSha256: current.registryHashSha256,
    expectedPriorRegistryContentSha256: sha256Text(currentRegistryContent),
    successorFreshReviewerLifecycleLockHashSha256: activationPlan.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: activationPlan.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: activationPlan.successorFreshBaselineManifestHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: successorFreshCompositeCandidate.successorFreshCompositeRegistryCandidateHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: safetyGuard.successorFreshCutoverSafetyGuardHashSha256,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: ownerAuthorization.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    successorOwnerAuthorityRegistryHashSha256: ownerAuthorization.successorOwnerAuthorityRegistryHashSha256,
    proposedRegistryHashSha256: successorFreshCompositeCandidate.candidateRegistryHashSha256,
    proposedRegistryContentSha256: successorFreshCompositeCandidate.candidateRegistryContentSha256,
    rollbackRegistryHashSha256,
    rollbackRegistryContentSha256,
    predecessorIncidentCloseoutPacketHashSha256: safetyGuard.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: safetyGuard.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: safetyGuard.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: safetyGuard.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: safetyGuard.predecessorCorrectivePreventiveActionSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshActivationChangeContractHashSha256: sha256Object(core),
    proposedRegistry: deepFreeze(proposedRegistry),
    proposedRegistryContent,
    rollbackRegistry: deepFreeze(rollbackRegistry),
    rollbackRegistryContent,
    ownerActivationAuthorizationVerified: true,
    ownerSignatureVerified: true,
    ownerTrustRootVerified: true,
    activationAuthorizationEvidenceBound: true,
    rollbackRestoresExactCurrentLogicalRegistry: true,
    rollbackRestoresExactCurrentRawRegistry: true,
    proposedRegistryRepresentsPostActivationStateOnly: true,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorFreshActivationContractReusable: false,
    successorFreshDualModeRegistryVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P75 binds a cryptographically re-verified P74 successor-owner authorization to the exact P69 schema-v4 proposed registry and the exact current legacy rollback bytes. The contract is deterministic evidence only; it performs no registry mutation and grants no release, merge, deploy or go-live authority.',
  });
}

module.exports = {
  TARGET_PATH,
  STATUS,
  verifySuccessorCandidateBindings,
  createSuccessorFreshActivationChangeContract,
};
