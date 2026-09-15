'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { validateFreshActivationPlan } = require('./fresh-composite-registry-candidate');
const { validateP51Candidate } = require('./fresh-composite-evidence-verifier');
const {
  STATUS: P56_STATUS,
  verifyFreshOwnerActivationAuthorization,
} = require('./fresh-owner-activation-authorization');

const TARGET_PATH = 'config/governance/canonical-baseline.json';
const STATUS = Object.freeze({
  HOLD_FRESH_ACTIVATION_CHANGE_CONTRACT: 'HOLD_FRESH_ACTIVATION_CHANGE_CONTRACT',
  FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED: 'FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED',
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
function privateKeyPresent(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some((key) => /private[-_]?key/i.test(key));
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
    status: STATUS.HOLD_FRESH_ACTIVATION_CHANGE_CONTRACT,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    targetPath: TARGET_PATH,
    freshActivationChangeContractHashSha256: null,
    ownerActivationAuthorizationVerified: false,
    activationAuthorizationEvidenceBound: false,
    rollbackRestoresExactCurrentLogicalRegistry: false,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function verifyCandidateBindings(candidate, activationPlan, safetyGuard, current) {
  const blockers = [...validateP51Candidate(candidate), ...validateFreshActivationPlan(activationPlan)];
  if (!candidate || !activationPlan || !safetyGuard) return blockers;
  if (candidate.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P51_CURRENT_REGISTRY_BINDING_MISMATCH');
  if (candidate.cycleId !== activationPlan.cycleId) blockers.push('P51_P50_CYCLE_MISMATCH');
  if (candidate.freshReactivationGovernanceCycleHashSha256 !== activationPlan.freshReactivationGovernanceCycleHashSha256) blockers.push('P51_P50_CYCLE_HASH_MISMATCH');
  if (candidate.freshReviewerLifecycleLockHashSha256 !== activationPlan.freshReviewerLifecycleLockHashSha256) blockers.push('P51_P50_REVIEWER_LOCK_MISMATCH');
  if (candidate.freshActivationPlanHashSha256 !== activationPlan.freshActivationPlanHashSha256) blockers.push('P51_P50_ACTIVATION_PLAN_MISMATCH');
  if (candidate.freshSuccessorBaselineManifestHashSha256 !== activationPlan.freshSuccessorBaselineManifestHashSha256) blockers.push('P51_P50_SUCCESSOR_MANIFEST_MISMATCH');
  if (safetyGuard.freshCompositeRegistryCandidateHashSha256 !== candidate.freshCompositeRegistryCandidateHashSha256) blockers.push('P55_P51_CANDIDATE_RECORD_MISMATCH');
  if (safetyGuard.candidateRegistryHashSha256 !== candidate.candidateRegistryHashSha256) blockers.push('P55_P51_CANDIDATE_LOGICAL_HASH_MISMATCH');
  if (safetyGuard.candidateRegistryContentSha256 !== candidate.candidateRegistryContentSha256) blockers.push('P55_P51_CANDIDATE_CONTENT_HASH_MISMATCH');
  return [...new Set(blockers)];
}

function createFreshActivationChangeContract({
  currentRegistry,
  activationPlan,
  freshCompositeCandidate,
  safetyGuard,
  freshOwnerAuthorityRegistry,
  expectedFreshOwnerAuthorityRegistryHashSha256,
  signedOwnerDecision,
  contractId,
  preparedByRef,
  preparedAt,
  ...callerOverrides
} = {}) {
  if (privateKeyPresent(callerOverrides)) return hold(['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED']);

  const candidateBlockers = verifyCandidateBindings(freshCompositeCandidate, activationPlan, safetyGuard, current);
  if (candidateBlockers.length > 0) return hold(candidateBlockers, { currentRegistryHashSha256: current.registryHashSha256 });

  const ownerAuthorization = verifyFreshOwnerActivationAuthorization({
    currentRegistry,
    safetyGuard,
    activationPlan,
    freshOwnerAuthorityRegistry,
    expectedFreshOwnerAuthorityRegistryHashSha256,
    decision: signedOwnerDecision,
  });
  if (
    ownerAuthorization.status !== P56_STATUS.FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED
    || ownerAuthorization.verified !== true
    || ownerAuthorization.ownerActivationAuthorizationVerified !== true
    || ownerAuthorization.ownerSignatureVerified !== true
    || ownerAuthorization.ownerTrustRootVerified !== true
    || ownerAuthorization.activationAuthorized !== false
    || ownerAuthorization.activationApplied !== false
    || ownerAuthorization.releaseStillBlocked !== true
  ) {
    return hold(ownerAuthorization.blockers?.length ? ownerAuthorization.blockers : ['P56_FRESH_OWNER_AUTHORIZATION_REQUIRED']);
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
  if (preparer !== activationPlan.preparedByRef || preparer !== ownerAuthorization.ownerActorRef) return hold(['FRESH_ACTIVATION_CONTRACT_MUST_BE_PREPARED_BY_CYCLE_OWNER']);
  const ownerDecisionAt = ownerAuthorization.verifiedOwnerAuthorizationRecord?.decidedAt;
  if (!ownerDecisionAt || Date.parse(preparedAtIso) < Date.parse(ownerDecisionAt)) return hold(['FRESH_ACTIVATION_CONTRACT_PRECEDES_VERIFIED_OWNER_DECISION']);

  const proposedRegistry = JSON.parse(JSON.stringify(freshCompositeCandidate.proposedRegistry));
  const proposedRegistryContent = freshCompositeCandidate.proposedRegistryContent;
  if (canonicalContent(proposedRegistry) !== proposedRegistryContent) return hold(['P51_PROPOSED_REGISTRY_CONTENT_NOT_CANONICAL']);
  const rollbackRegistry = JSON.parse(JSON.stringify(currentRegistry));
  const rollbackRegistryContent = canonicalContent(rollbackRegistry);
  const rollbackRegistryHashSha256 = sha256Object(rollbackRegistry);
  const rollbackRegistryContentSha256 = sha256Text(rollbackRegistryContent);
  if (rollbackRegistryHashSha256 !== current.registryHashSha256) return hold(['ROLLBACK_REGISTRY_DOES_NOT_RESTORE_CURRENT_LOGICAL_HASH']);

  const core = {
    schemaVersion: 1,
    contractId: id,
    preparedByRef: preparer,
    preparedAt: preparedAtIso,
    targetPath: TARGET_PATH,
    expectedPriorMode: MODE.LEGACY_FILE_SHA256,
    proposedMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    cycleId: activationPlan.cycleId,
    freshReactivationGovernanceCycleHashSha256: activationPlan.freshReactivationGovernanceCycleHashSha256,
    expectedPriorRegistryHashSha256: current.registryHashSha256,
    freshReviewerLifecycleLockHashSha256: activationPlan.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: activationPlan.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: activationPlan.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: freshCompositeCandidate.freshCompositeRegistryCandidateHashSha256,
    freshCutoverSafetyGuardHashSha256: safetyGuard.freshCutoverSafetyGuardHashSha256,
    verifiedFreshOwnerAuthorizationRecordHashSha256: ownerAuthorization.verifiedFreshOwnerAuthorizationRecordHashSha256,
    ownerAuthorityRegistryHashSha256: ownerAuthorization.ownerAuthorityRegistryHashSha256,
    proposedRegistryHashSha256: freshCompositeCandidate.candidateRegistryHashSha256,
    proposedRegistryContentSha256: freshCompositeCandidate.candidateRegistryContentSha256,
    rollbackRegistryHashSha256,
    rollbackRegistryContentSha256,
  };

  return deepFreeze({
    ...core,
    status: STATUS.FRESH_ACTIVATION_CHANGE_CONTRACT_READY_OWNER_AUTH_VERIFIED_NOT_APPLIED,
    verified: true,
    blockers: Object.freeze([]),
    freshActivationChangeContractHashSha256: sha256Object(core),
    proposedRegistry: deepFreeze(proposedRegistry),
    proposedRegistryContent,
    rollbackRegistry: deepFreeze(rollbackRegistry),
    rollbackRegistryContent,
    ownerActivationAuthorizationVerified: true,
    ownerSignatureVerified: true,
    ownerTrustRootVerified: true,
    activationAuthorizationEvidenceBound: true,
    rollbackRestoresExactCurrentLogicalRegistry: true,
    proposedRegistryRepresentsPostActivationStateOnly: true,
    actualRegistryMutationPerformed: false,
    actualReleaseGateModeChanged: false,
    actualDeploymentMutationPerformed: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshDualModeRegistryVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P57 binds a cryptographically re-verified fresh-owner authorization to the exact P51 schema-v3 proposed registry and exact rollback registry. The contract is deterministic evidence for later verifier/executor slices only; it performs no registry mutation and grants no release authority.',
  });
}

module.exports = {
  TARGET_PATH,
  STATUS,
  verifyCandidateBindings,
  createFreshActivationChangeContract,
};
