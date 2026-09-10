'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P68_STATUS } = require('./successor-fresh-activation-plan');

const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE: 'HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE',
  SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE: 'SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_PREDECESSOR_REUSE_FIELDS = Object.freeze([
  'freshCompositeRegistryCandidateHashSha256',
  'freshActivationPlanHashSha256',
  'freshReviewerLifecycleLockHashSha256',
  'verifiedFreshReviewRecordHashSha256',
  'verifiedFreshOwnerAuthorizationRecordHashSha256',
  'freshCutoverSafetyGuardHashSha256',
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
  const v = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(v)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return v;
}
function requiredCommit(value, field) {
  const v = requiredString(value, field).toLowerCase();
  if (!COMMIT_RE.test(v)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return v;
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
    if (FORBIDDEN_PREDECESSOR_REUSE_FIELDS.includes(key) && child != null) return `${path}.${key}`;
    const nested = findForbiddenReuse(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
}
function callerAuthorityEscalated(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false)
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.activationAuthorized != null && value.activationAuthorized !== false)
    || (value.activationApplied != null && value.activationApplied !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false);
}
function hold(blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    candidateOnly: true,
    candidateRegistryHashSha256: null,
    candidateRegistryContentSha256: null,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshCompositeEvidenceVerificationRequired: true,
    successorFreshShadowVerificationRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function successorManifestCore(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    baselineId: manifest.baselineId,
    baselineType: manifest.baselineType,
    cycleId: manifest.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
    releaseArtifactSha256: manifest.releaseArtifactSha256,
    environmentConfigSha256: manifest.environmentConfigSha256,
    expectedPriorRegistryHashSha256: manifest.expectedPriorRegistryHashSha256,
    expectedPriorRegistryContentSha256: manifest.expectedPriorRegistryContentSha256,
    successorFreshReviewPacketHashSha256: manifest.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: manifest.successorFreshReviewerDesignationHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: manifest.successorFreshReviewerLifecycleLockHashSha256,
    verifiedSuccessorFreshReviewRecordHashSha256: manifest.verifiedSuccessorFreshReviewRecordHashSha256,
    cycleEvidenceArtifactSha256: manifest.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: manifest.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: manifest.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: manifest.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: manifest.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: manifest.predecessorCorrectivePreventiveActionSha256,
  };
}
function p68PlanCore(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    activationChangeId: plan.activationChangeId,
    cycleId: plan.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: plan.successorFreshReactivationGovernanceCycleHashSha256,
    preparedByRef: plan.preparedByRef,
    preparedAt: plan.preparedAt,
    successorFreshReviewerLifecycleLockHashSha256: plan.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshBaselineManifest: plan.successorFreshBaselineManifest,
    successorFreshBaselineManifestHashSha256: plan.successorFreshBaselineManifestHashSha256,
    targetActivationContract: plan.targetActivationContract,
  };
}

function validateSuccessorFreshActivationPlan(plan) {
  const blockers = [];
  if (!plan || plan.status !== P68_STATUS.SUCCESSOR_FRESH_ACTIVATION_PLAN_READY_NOT_AUTHORIZED) return ['P68_SUCCESSOR_FRESH_ACTIVATION_PLAN_REQUIRED'];
  if (
    plan.verified !== true
    || plan.explicitActivationChangeRequired !== true
    || plan.activationAuthorized !== false
    || plan.activationApplied !== false
    || plan.automaticBaselineSwitchAllowed !== false
    || plan.reactivationAuthorized !== false
    || plan.currentBaselineMutationPerformed !== false
    || plan.predecessorActivationPlanReusable !== false
    || plan.predecessorOwnerAuthorizationReusable !== false
    || plan.predecessorActivationContractReusable !== false
    || plan.successorFreshCompositeRegistryCandidateRequired !== true
    || plan.successorFreshShadowEvidenceRequired !== true
    || plan.successorFreshCutoverRehearsalRequired !== true
    || plan.successorFreshCutoverSafetyEvidenceRequired !== true
    || plan.successorFreshOwnerActivationAuthorizationRequired !== true
    || plan.successorFreshActivationChangeContractRequired !== true
    || plan.postChangeReleaseVerifyRequired !== true
    || plan.releaseStillBlocked !== true
    || !allAuthorityFalse(plan)
  ) blockers.push('P68_SUCCESSOR_FRESH_ACTIVATION_PLAN_BOUNDARY_INVALID');
  try {
    const manifest = plan.successorFreshBaselineManifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('P68_SUCCESSOR_FRESH_BASELINE_MANIFEST_REQUIRED');
    const manifestHash = requiredSha256(plan.successorFreshBaselineManifestHashSha256, 'successorFreshBaselineManifestHashSha256');
    if (sha256Object(successorManifestCore(manifest)) !== manifestHash) blockers.push('P68_SUCCESSOR_FRESH_BASELINE_MANIFEST_HASH_MISMATCH');
    const planHash = requiredSha256(plan.successorFreshActivationPlanHashSha256, 'successorFreshActivationPlanHashSha256');
    if (sha256Object(p68PlanCore(plan)) !== planHash) blockers.push('P68_SUCCESSOR_FRESH_ACTIVATION_PLAN_HASH_MISMATCH');
    if (manifest.cycleId !== plan.cycleId) blockers.push('P68_MANIFEST_CYCLE_MISMATCH');
    if (manifest.successorFreshReactivationGovernanceCycleHashSha256 !== plan.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P68_MANIFEST_CYCLE_HASH_MISMATCH');
    if (manifest.successorFreshReviewerLifecycleLockHashSha256 !== plan.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P68_MANIFEST_REVIEWER_LOCK_MISMATCH');
    requiredCommit(manifest.qualifiedSourceCommitSha, 'manifest.qualifiedSourceCommitSha');
    for (const field of [
      'releaseArtifactSha256', 'environmentConfigSha256', 'expectedPriorRegistryHashSha256', 'expectedPriorRegistryContentSha256',
      'successorFreshReviewPacketHashSha256', 'successorFreshReviewerDesignationHashSha256', 'successorFreshReviewerLifecycleLockHashSha256',
      'verifiedSuccessorFreshReviewRecordHashSha256', 'cycleEvidenceArtifactSha256', 'predecessorIncidentCloseoutPacketHashSha256',
      'predecessorHumanDecisionRecordHashSha256', 'predecessorGovernanceResetRecordHashSha256', 'predecessorRootCauseAnalysisSha256',
      'predecessorCorrectivePreventiveActionSha256',
    ]) requiredSha256(manifest[field], `manifest.${field}`);
    if (!plan.targetActivationContract || plan.targetActivationContract.targetPath !== 'config/governance/canonical-baseline.json') blockers.push('P68_TARGET_PATH_INVALID');
    if (plan.targetActivationContract?.expectedPriorMode !== MODE.LEGACY_FILE_SHA256 || plan.targetActivationContract?.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P68_TARGET_MODES_INVALID');
    if (plan.targetActivationContract?.expectedPriorRegistryHashSha256 !== manifest.expectedPriorRegistryHashSha256) blockers.push('P68_TARGET_PRIOR_REGISTRY_HASH_MISMATCH');
    if (plan.targetActivationContract?.expectedPriorRegistryContentSha256 !== manifest.expectedPriorRegistryContentSha256) blockers.push('P68_TARGET_PRIOR_REGISTRY_CONTENT_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function createSuccessorFreshCompositeRegistryCandidate({ activationPlan, currentRegistry, currentRegistryContent, ...callerOverrides } = {}) {
  const keyMaterial = findForbiddenKeyMaterial(callerOverrides);
  if (keyMaterial) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${keyMaterial}`]);
  const forbiddenReuse = findForbiddenReuse(callerOverrides);
  if (forbiddenReuse) return hold([`PREDECESSOR_FRESH_ARTIFACT_REUSE_NOT_ALLOWED:${forbiddenReuse}`]);
  if (callerAuthorityEscalated(callerOverrides)) return hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);

  const planBlockers = validateSuccessorFreshActivationPlan(activationPlan);
  if (planBlockers.length > 0) return hold(planBlockers);
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') return hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED']);

  const observed = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (observed.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return hold(['CURRENT_LEGACY_CANONICAL_BASELINE_REQUIRED']);
  const manifest = activationPlan.successorFreshBaselineManifest;
  const observedContentHash = sha256Text(currentRegistryContent);
  if (observed.registryHashSha256 !== manifest.expectedPriorRegistryHashSha256) return hold(['CURRENT_REGISTRY_HASH_DOES_NOT_MATCH_P68_EXPECTED_PRIOR']);
  if (observedContentHash !== manifest.expectedPriorRegistryContentSha256) return hold(['CURRENT_REGISTRY_CONTENT_HASH_DOES_NOT_MATCH_P68_EXPECTED_PRIOR']);
  let parsedCurrent;
  try { parsedCurrent = JSON.parse(currentRegistryContent); } catch (_) { return hold(['CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON']); }
  if (stableStringify(parsedCurrent) !== stableStringify(currentRegistry)) return hold(['CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH']);

  const governedCompositeBaseline = deepFreeze({
    baselineId: manifest.baselineId,
    baselineType: manifest.baselineType,
    cycleId: manifest.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: manifest.successorFreshReactivationGovernanceCycleHashSha256,
    qualifiedSourceCommitSha: manifest.qualifiedSourceCommitSha,
    releaseArtifactSha256: manifest.releaseArtifactSha256,
    environmentConfigSha256: manifest.environmentConfigSha256,
    expectedPriorRegistryHashSha256: manifest.expectedPriorRegistryHashSha256,
    expectedPriorRegistryContentSha256: manifest.expectedPriorRegistryContentSha256,
    successorFreshReviewPacketHashSha256: manifest.successorFreshReviewPacketHashSha256,
    successorFreshReviewerDesignationHashSha256: manifest.successorFreshReviewerDesignationHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: manifest.successorFreshReviewerLifecycleLockHashSha256,
    verifiedSuccessorFreshReviewRecordHashSha256: manifest.verifiedSuccessorFreshReviewRecordHashSha256,
    successorFreshBaselineManifestHashSha256: activationPlan.successorFreshBaselineManifestHashSha256,
    cycleEvidenceArtifactSha256: manifest.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: manifest.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: manifest.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: manifest.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: manifest.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: manifest.predecessorCorrectivePreventiveActionSha256,
  });

  const proposedRegistry = deepFreeze({
    schemaVersion: 4,
    activeMode: MODE.GOVERNED_COMPOSITE_BASELINE,
    legacyBaseline: JSON.parse(JSON.stringify(currentRegistry.legacyBaseline)),
    governedCompositeBaseline,
    successorFreshReactivationGovernanceCycleHashSha256: activationPlan.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: activationPlan.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: activationPlan.successorFreshActivationPlanHashSha256,
    activationApplied: true,
    canonicalBaselineChanged: true,
    legacyCanonicalEvidenceClosed: false,
    existingE2iCanonicalEvidenceSatisfied: false,
    ...AUTHORITY,
  });
  const proposedRegistryContent = canonicalContent(proposedRegistry);
  const core = {
    schemaVersion: 1,
    cycleId: activationPlan.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: activationPlan.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerLifecycleLockHashSha256: activationPlan.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: activationPlan.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: activationPlan.successorFreshBaselineManifestHashSha256,
    currentRegistryHashSha256: observed.registryHashSha256,
    currentRegistryContentSha256: observedContentHash,
    targetPath: activationPlan.targetActivationContract.targetPath,
    proposedRegistrySchemaVersion: 4,
    proposedRegistryHashSha256: sha256Object(proposedRegistry),
    proposedRegistryContentSha256: sha256Text(proposedRegistryContent),
  };

  return deepFreeze({
    ...core,
    status: STATUS.SUCCESSOR_FRESH_COMPOSITE_REGISTRY_CANDIDATE_READY_NOT_ACTIVE,
    verified: true,
    blockers: Object.freeze([]),
    successorFreshCompositeRegistryCandidateHashSha256: sha256Object(core),
    proposedRegistry,
    proposedRegistryContent,
    candidateRegistryHashSha256: core.proposedRegistryHashSha256,
    candidateRegistryContentSha256: core.proposedRegistryContentSha256,
    candidateOnly: true,
    activeRegistryChanged: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    predecessorFreshCompositeCandidateReusable: false,
    successorFreshCompositeEvidenceVerificationRequired: true,
    successorFreshShadowVerificationRequired: true,
    successorFreshCutoverRehearsalRequired: true,
    successorFreshCutoverSafetyEvidenceRequired: true,
    successorFreshOwnerActivationAuthorizationRequired: true,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P69 prepares a schema-v4 successor fresh governed-composite candidate bound to P68 and the exact restored legacy raw bytes. It is intentionally not active and cannot reuse the failed P51 candidate or any predecessor authority. A successor-specific verifier and the complete evidence/safety/owner/change-contract chain remain mandatory.',
  });
}

module.exports = {
  STATUS,
  FORBIDDEN_PREDECESSOR_REUSE_FIELDS,
  successorManifestCore,
  p68PlanCore,
  validateSuccessorFreshActivationPlan,
  createSuccessorFreshCompositeRegistryCandidate,
};
