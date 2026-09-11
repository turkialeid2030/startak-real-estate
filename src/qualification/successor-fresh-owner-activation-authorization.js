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
  STATUS: P73_STATUS,
  evaluateSuccessorFreshCompositeCutoverSafetyGuard,
} = require('./successor-fresh-composite-cutover-safety-guard');
const { validateSuccessorFreshActivationPlan } = require('./successor-fresh-composite-registry-candidate');

const PURPOSE = 'SUCCESSOR_FRESH_CANONICAL_BASELINE_ACTIVATION_AUTHORIZATION';
const DECISION = 'AUTHORIZE_SUCCESSOR_FRESH_CANONICAL_BASELINE_ACTIVATION';
const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION: 'HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION',
  READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE: 'READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE',
  SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED: 'SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

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
function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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
function findPredecessorOwnerAuthorizationReuse(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (
      /^freshOwnerAuthorityRegistry$/i.test(key)
      || /^expectedFreshOwnerAuthorityRegistryHashSha256$/i.test(key)
      || /^verifiedFreshOwnerAuthorizationRecordHashSha256$/i.test(key)
      || /^freshOwnerAuthorization$/i.test(key)
      || /^predecessor.*owner.*authorization/i.test(key)
    ) return `${path}.${key}`;
    const nested = findPredecessorOwnerAuthorizationReuse(child, `${path}.${key}`, seen);
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
    status: STATUS.HOLD_SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    purpose: PURPOSE,
    signatureRequired: true,
    externalSigningRequired: true,
    repositorySigningPerformed: false,
    privateSigningKeyAccepted: false,
    predecessorFreshOwnerAuthorizationReusable: false,
    ownerIdentityCryptographicallyVerified: false,
    ownerTrustRootVerified: false,
    ownerSignatureVerified: false,
    ownerActivationAuthorizationVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function p73SafetyCore(guard) {
  return {
    schemaVersion: guard.schemaVersion,
    authoritativeMode: guard.authoritativeMode,
    proposedMode: guard.proposedMode,
    proposedRegistrySchemaVersion: guard.proposedRegistrySchemaVersion,
    cycleId: guard.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: guard.successorFreshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: guard.currentRegistryHashSha256,
    currentRegistryContentSha256: guard.currentRegistryContentSha256,
    successorFreshReviewerLifecycleLockHashSha256: guard.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: guard.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: guard.successorFreshBaselineManifestHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: guard.successorFreshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: guard.candidateRegistryHashSha256,
    candidateRegistryContentSha256: guard.candidateRegistryContentSha256,
    successorFreshCompositeEvidenceHashSha256: guard.successorFreshCompositeEvidenceHashSha256,
    successorFreshShadowEvaluationHashSha256: guard.successorFreshShadowEvaluationHashSha256,
    successorFreshCutoverRehearsalHashSha256: guard.successorFreshCutoverRehearsalHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: guard.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: guard.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: guard.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: guard.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: guard.predecessorCorrectivePreventiveActionSha256,
  };
}

function validateP73SafetyGuard({
  safetyGuard,
  recomputedSafetyGuard,
  activationPlan,
  current,
  currentRegistryContent,
} = {}) {
  const blockers = [];
  if (!safetyGuard || safetyGuard.status !== P73_STATUS.SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED) {
    return ['P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_REQUIRED'];
  }
  if (
    safetyGuard.verified !== true
    || safetyGuard.reviewerLockVerified !== true
    || safetyGuard.activationPlanVerified !== true
    || safetyGuard.shadowMatchVerified !== true
    || safetyGuard.rollbackRehearsalVerified !== true
    || safetyGuard.exactRollbackLogicalIdentityVerified !== true
    || safetyGuard.exactRollbackRawContentIdentityVerified !== true
    || safetyGuard.safetyPrerequisitesSatisfiedForSuccessorFreshOwnerAuthorization !== true
    || safetyGuard.predecessorFreshSafetyAuthorityReusable !== false
    || safetyGuard.successorFreshOwnerActivationAuthorizationRequired !== true
    || safetyGuard.successorFreshActivationChangeContractRequired !== true
    || safetyGuard.successorFreshModeVerifierRequired !== true
    || safetyGuard.controlledActivationExecutionRequired !== true
    || safetyGuard.postActivationReleaseVerifyRequired !== true
    || safetyGuard.activationAuthorized !== false
    || safetyGuard.activationApplied !== false
    || safetyGuard.reactivationAuthorized !== false
    || safetyGuard.currentBaselineMutationPerformed !== false
    || safetyGuard.releaseStillBlocked !== true
    || !allAuthorityFalse(safetyGuard)
  ) blockers.push('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_BOUNDARY_INVALID');

  if (
    safetyGuard.authoritativeMode !== MODE.LEGACY_FILE_SHA256
    || safetyGuard.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE
    || safetyGuard.proposedRegistrySchemaVersion !== 4
  ) blockers.push('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_MODE_SCOPE_INVALID');

  try {
    const safetyHash = requiredSha256(safetyGuard.successorFreshCutoverSafetyGuardHashSha256, 'successorFreshCutoverSafetyGuardHashSha256');
    if (sha256Object(p73SafetyCore(safetyGuard)) !== safetyHash) blockers.push('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_HASH_MISMATCH');
    if (!recomputedSafetyGuard || recomputedSafetyGuard.status !== P73_STATUS.SUCCESSOR_FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED) {
      blockers.push('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_RECOMPUTATION_FAILED');
    } else if (recomputedSafetyGuard.successorFreshCutoverSafetyGuardHashSha256 !== safetyHash) {
      blockers.push('P73_SUCCESSOR_FRESH_CUTOVER_SAFETY_RECOMPUTATION_HASH_MISMATCH');
    }
    if (safetyGuard.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P73_CURRENT_REGISTRY_HASH_BINDING_MISMATCH');
    if (safetyGuard.currentRegistryContentSha256 !== sha256Text(currentRegistryContent)) blockers.push('P73_CURRENT_REGISTRY_CONTENT_BINDING_MISMATCH');
    if (safetyGuard.cycleId !== activationPlan.cycleId) blockers.push('P73_P68_CYCLE_BINDING_MISMATCH');
    if (safetyGuard.successorFreshReactivationGovernanceCycleHashSha256 !== activationPlan.successorFreshReactivationGovernanceCycleHashSha256) blockers.push('P73_P68_CYCLE_HASH_BINDING_MISMATCH');
    if (safetyGuard.successorFreshActivationPlanHashSha256 !== activationPlan.successorFreshActivationPlanHashSha256) blockers.push('P73_P68_ACTIVATION_PLAN_HASH_MISMATCH');
    if (safetyGuard.successorFreshReviewerLifecycleLockHashSha256 !== activationPlan.successorFreshReviewerLifecycleLockHashSha256) blockers.push('P73_P68_REVIEWER_LOCK_HASH_MISMATCH');
    if (safetyGuard.successorFreshBaselineManifestHashSha256 !== activationPlan.successorFreshBaselineManifestHashSha256) blockers.push('P73_P68_BASELINE_MANIFEST_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeSuccessorFreshOwnerAuthorityRegistry(input, expectedCycleId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('successorFreshOwnerAuthorityRegistry must be an object');
  if (input.schemaVersion !== 1) throw new TypeError('successorFreshOwnerAuthorityRegistry.schemaVersion must equal 1');
  if (input.purpose !== PURPOSE) throw new TypeError('successorFreshOwnerAuthorityRegistry.purpose mismatch');
  const cycleId = requiredString(input.cycleId, 'successorFreshOwnerAuthorityRegistry.cycleId');
  if (cycleId !== expectedCycleId) throw new TypeError('SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY_CYCLE_MISMATCH');
  if (!Array.isArray(input.authorities) || input.authorities.length === 0) throw new TypeError('successorFreshOwnerAuthorityRegistry.authorities must be non-empty');
  const ids = new Set();
  const authorities = input.authorities.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`authority[${index}] must be an object`);
    const authorityId = requiredString(record.authorityId, `authority[${index}].authorityId`);
    if (ids.has(authorityId)) throw new TypeError('duplicate successor owner authorityId');
    ids.add(authorityId);
    const actorRef = requiredString(record.actorRef, `authority[${index}].actorRef`);
    const publicKeyPem = requiredString(record.publicKeyPem, `authority[${index}].publicKeyPem`);
    const publicKeySha256 = requiredSha256(record.publicKeySha256, `authority[${index}].publicKeySha256`);
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError('successor owner authority publicKeySha256 mismatch');
    const activeFrom = iso(record.activeFrom, `authority[${index}].activeFrom`);
    const activeUntil = record.activeUntil == null ? null : iso(record.activeUntil, `authority[${index}].activeUntil`);
    if (activeUntil && Date.parse(activeUntil) < Date.parse(activeFrom)) throw new TypeError('successor owner authority activeUntil precedes activeFrom');
    const allowedPurpose = requiredString(record.allowedPurpose, `authority[${index}].allowedPurpose`);
    if (allowedPurpose !== PURPOSE) throw new TypeError('successor owner authority allowedPurpose mismatch');
    const allowedCycleId = requiredString(record.allowedCycleId, `authority[${index}].allowedCycleId`);
    if (allowedCycleId !== cycleId) throw new TypeError('successor owner authority allowedCycleId mismatch');
    return {
      authorityId,
      actorRef,
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, `authority[${index}].governanceEvidenceRef`),
      activeFrom,
      activeUntil,
      allowedPurpose,
      allowedCycleId,
    };
  }).sort((a, b) => a.authorityId.localeCompare(b.authorityId));
  const core = { schemaVersion: 1, purpose: PURPOSE, cycleId, authorities };
  return deepFreeze({ ...core, successorOwnerAuthorityRegistryHashSha256: sha256Object(core) });
}

function normalizeDecision({ activationPlan, safetyGuard, rehearsal, decision } = {}) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw new TypeError('decision must be an object');
  if (findForbiddenKeyMaterial(decision)) throw new TypeError('PRIVATE_SIGNING_KEY_INPUT_REJECTED');
  const normalized = {
    decisionId: requiredString(decision.decisionId, 'decision.decisionId'),
    authorityId: requiredString(decision.authorityId, 'decision.authorityId'),
    actorRef: requiredString(decision.actorRef, 'decision.actorRef'),
    decision: requiredString(decision.decision, 'decision.decision'),
    decisionSourceRef: requiredString(decision.decisionSourceRef, 'decision.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(decision.decisionArtifactSha256, 'decision.decisionArtifactSha256'),
    decidedAt: iso(decision.decidedAt, 'decision.decidedAt'),
    rationaleRef: requiredString(decision.rationaleRef, 'decision.rationaleRef'),
    signatureAlgorithm: requiredString(decision.signatureAlgorithm, 'decision.signatureAlgorithm'),
  };
  if (normalized.decision !== DECISION) throw new TypeError('successor fresh owner authorization decision invalid');
  if (normalized.signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('signatureAlgorithm must equal RSA-SHA256');
  if (normalized.actorRef !== activationPlan.preparedByRef) throw new TypeError('SUCCESSOR_FRESH_ACTIVATION_MUST_BE_AUTHORIZED_BY_CYCLE_OWNER');
  if (Date.parse(normalized.decidedAt) < Date.parse(activationPlan.preparedAt)) throw new TypeError('SUCCESSOR_FRESH_OWNER_DECISION_PRECEDES_ACTIVATION_PLAN');
  if (rehearsal?.preparedAt && Date.parse(normalized.decidedAt) < Date.parse(rehearsal.preparedAt)) throw new TypeError('SUCCESSOR_FRESH_OWNER_DECISION_PRECEDES_CUTOVER_REHEARSAL');
  if (safetyGuard.successorFreshActivationPlanHashSha256 !== activationPlan.successorFreshActivationPlanHashSha256) throw new TypeError('SUCCESSOR_FRESH_OWNER_DECISION_PLAN_SCOPE_MISMATCH');
  return deepFreeze(normalized);
}

function createSuccessorFreshOwnerSigningPayload({ safetyGuard, activationPlan, rehearsal, decision } = {}) {
  const normalized = normalizeDecision({ activationPlan, safetyGuard, rehearsal, decision });
  return deepFreeze({
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: safetyGuard.cycleId,
    proposedRegistrySchemaVersion: 4,
    successorFreshReactivationGovernanceCycleHashSha256: safetyGuard.successorFreshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: safetyGuard.currentRegistryHashSha256,
    currentRegistryContentSha256: safetyGuard.currentRegistryContentSha256,
    successorFreshReviewerLifecycleLockHashSha256: safetyGuard.successorFreshReviewerLifecycleLockHashSha256,
    successorFreshActivationPlanHashSha256: safetyGuard.successorFreshActivationPlanHashSha256,
    successorFreshBaselineManifestHashSha256: safetyGuard.successorFreshBaselineManifestHashSha256,
    successorFreshCompositeRegistryCandidateHashSha256: safetyGuard.successorFreshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: safetyGuard.candidateRegistryHashSha256,
    candidateRegistryContentSha256: safetyGuard.candidateRegistryContentSha256,
    successorFreshCompositeEvidenceHashSha256: safetyGuard.successorFreshCompositeEvidenceHashSha256,
    successorFreshShadowEvaluationHashSha256: safetyGuard.successorFreshShadowEvaluationHashSha256,
    successorFreshCutoverRehearsalHashSha256: safetyGuard.successorFreshCutoverRehearsalHashSha256,
    successorFreshCutoverSafetyGuardHashSha256: safetyGuard.successorFreshCutoverSafetyGuardHashSha256,
    predecessorIncidentCloseoutPacketHashSha256: safetyGuard.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: safetyGuard.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: safetyGuard.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: safetyGuard.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: safetyGuard.predecessorCorrectivePreventiveActionSha256,
    decisionId: normalized.decisionId,
    authorityId: normalized.authorityId,
    actorRef: normalized.actorRef,
    decision: normalized.decision,
    decisionSourceRef: normalized.decisionSourceRef,
    decisionArtifactSha256: normalized.decisionArtifactSha256,
    decidedAt: normalized.decidedAt,
    rationaleRef: normalized.rationaleRef,
    signatureAlgorithm: normalized.signatureAlgorithm,
  });
}

function validateInputs(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return { error: hold([`PRIVATE_SIGNING_KEY_MATERIAL_REJECTED:${forbidden}`]) };
  if (callerAuthorityEscalated(input)) return { error: hold(['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']) };

  const {
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
    decision,
    ...callerOverrides
  } = input;

  const reuse = findPredecessorOwnerAuthorizationReuse(callerOverrides);
  if (reuse) return { error: hold([`PREDECESSOR_FRESH_OWNER_AUTHORIZATION_REUSE_NOT_ALLOWED:${reuse}`]) };

  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return { error: hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED']) };
  if (typeof currentRegistryContent !== 'string' || currentRegistryContent === '') return { error: hold(['CURRENT_REGISTRY_RAW_CONTENT_REQUIRED']) };
  try {
    const parsed = JSON.parse(currentRegistryContent);
    if (stableStringify(parsed) !== stableStringify(currentRegistry)) return { error: hold(['CURRENT_REGISTRY_OBJECT_AND_RAW_CONTENT_MISMATCH']) };
  } catch (_) {
    return { error: hold(['CURRENT_REGISTRY_RAW_CONTENT_NOT_JSON']) };
  }

  const planBlockers = validateSuccessorFreshActivationPlan(activationPlan);
  if (planBlockers.length > 0) return { error: hold(planBlockers, { currentRegistryHashSha256: current.registryHashSha256 }) };

  const recomputedSafetyGuard = evaluateSuccessorFreshCompositeCutoverSafetyGuard({
    currentRegistry,
    currentRegistryContent,
    successorReviewPacket,
    reviewerLifecycle,
    activationPlan,
    successorFreshShadowEvaluation,
    successorFreshRehearsalResult,
  });
  const guardBlockers = validateP73SafetyGuard({ safetyGuard, recomputedSafetyGuard, activationPlan, current, currentRegistryContent });
  if (guardBlockers.length > 0) return { error: hold(guardBlockers, { successorFreshActivationPlanHashSha256: activationPlan?.successorFreshActivationPlanHashSha256 || null }) };

  let registry;
  let expectedHash;
  let payload;
  try {
    registry = normalizeSuccessorFreshOwnerAuthorityRegistry(successorFreshOwnerAuthorityRegistry, safetyGuard.cycleId);
    expectedHash = requiredSha256(expectedSuccessorFreshOwnerAuthorityRegistryHashSha256, 'expectedSuccessorFreshOwnerAuthorityRegistryHashSha256');
    if (registry.successorOwnerAuthorityRegistryHashSha256 !== expectedHash) throw new TypeError('SUCCESSOR_FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH');
    payload = createSuccessorFreshOwnerSigningPayload({ safetyGuard, activationPlan, rehearsal: successorFreshRehearsalResult, decision });
  } catch (error) {
    return { error: hold([error.message], { successorFreshCutoverSafetyGuardHashSha256: safetyGuard?.successorFreshCutoverSafetyGuardHashSha256 || null }) };
  }

  const authority = registry.authorities.find((record) => record.authorityId === payload.authorityId);
  if (!authority) return { error: hold(['SUCCESSOR_FRESH_OWNER_AUTHORITY_NOT_IN_TRUSTED_REGISTRY']) };
  if (authority.actorRef !== payload.actorRef) return { error: hold(['SUCCESSOR_FRESH_OWNER_AUTHORITY_ACTOR_SCOPE_MISMATCH']) };
  if (authority.allowedPurpose !== PURPOSE) return { error: hold(['SUCCESSOR_FRESH_OWNER_AUTHORITY_PURPOSE_NOT_ALLOWED']) };
  if (authority.allowedCycleId !== payload.cycleId) return { error: hold(['SUCCESSOR_FRESH_OWNER_AUTHORITY_CYCLE_SCOPE_MISMATCH']) };
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) {
    return { error: hold(['SUCCESSOR_FRESH_OWNER_AUTHORITY_OUTSIDE_ACTIVE_PERIOD']) };
  }
  return { current, registry, authority, payload, safetyGuard, activationPlan };
}

function prepareSuccessorFreshOwnerActivationAuthorization(input = {}) {
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, authority, payload } = validated;
  const signingBytes = stableStringify(payload);
  const unsignedDecision = deepFreeze({
    decisionId: payload.decisionId,
    authorityId: payload.authorityId,
    actorRef: payload.actorRef,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    signatureAlgorithm: payload.signatureAlgorithm,
  });
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_SUCCESSOR_FRESH_OWNER_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    proposedRegistrySchemaVersion: 4,
    ownerActorRef: payload.actorRef,
    authorityId: authority.authorityId,
    successorFreshCutoverSafetyGuardHashSha256: payload.successorFreshCutoverSafetyGuardHashSha256,
    successorFreshActivationPlanHashSha256: payload.successorFreshActivationPlanHashSha256,
    successorOwnerAuthorityRegistryHashSha256: registry.successorOwnerAuthorityRegistryHashSha256,
    ownerPublicKeySha256: authority.publicKeySha256,
    signingPayload: payload,
    signingPayloadHashSha256: sha256Text(signingBytes),
    signingBytesBase64: Buffer.from(signingBytes, 'utf8').toString('base64'),
    unsignedDecision,
    signatureRequired: true,
    signatureAlgorithm: 'RSA-SHA256',
    externalSigningRequired: true,
    repositorySigningPerformed: false,
    privateSigningKeyAccepted: false,
    predecessorFreshOwnerAuthorizationReusable: false,
    ownerIdentityCryptographicallyVerified: false,
    ownerTrustRootVerified: true,
    ownerSignatureVerified: false,
    ownerActivationAuthorizationVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P74 prepares deterministic externally signed successor-cycle owner authorization bytes after re-validating the exact P73 safety chain. No private key is accepted, predecessor owner authorization is non-reusable, and preparation grants no activation or release authority.',
  });
}

function decodeBase64Signature(value) {
  const raw = requiredString(value, 'decision.signatureBase64');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) throw new TypeError('SUCCESSOR_FRESH_OWNER_SIGNATURE_ENCODING_INVALID');
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length === 0 || bytes.toString('base64') !== raw) throw new TypeError('SUCCESSOR_FRESH_OWNER_SIGNATURE_ENCODING_INVALID');
  return bytes;
}

function verifySuccessorFreshOwnerActivationAuthorization(input = {}) {
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, authority, payload } = validated;
  let signatureBytes;
  try {
    signatureBytes = decodeBase64Signature(input.decision?.signatureBase64);
  } catch (error) {
    return hold([error.message]);
  }

  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      authority.publicKeyPem,
      signatureBytes,
    );
  } catch (_) {
    signatureVerified = false;
  }
  if (!signatureVerified) return hold(['SUCCESSOR_FRESH_OWNER_SIGNATURE_INVALID']);

  const signingPayloadHashSha256 = sha256Object(payload);
  const signatureSha256 = sha256Bytes(signatureBytes);
  const decisionRecordCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    proposedRegistrySchemaVersion: 4,
    successorFreshCutoverSafetyGuardHashSha256: payload.successorFreshCutoverSafetyGuardHashSha256,
    successorFreshActivationPlanHashSha256: payload.successorFreshActivationPlanHashSha256,
    currentRegistryHashSha256: payload.currentRegistryHashSha256,
    currentRegistryContentSha256: payload.currentRegistryContentSha256,
    candidateRegistryHashSha256: payload.candidateRegistryHashSha256,
    candidateRegistryContentSha256: payload.candidateRegistryContentSha256,
    successorOwnerAuthorityRegistryHashSha256: registry.successorOwnerAuthorityRegistryHashSha256,
    authorityId: authority.authorityId,
    ownerActorRef: payload.actorRef,
    ownerPublicKeySha256: authority.publicKeySha256,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    signingPayloadHashSha256,
    signatureSha256,
    predecessorIncidentCloseoutPacketHashSha256: payload.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: payload.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: payload.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: payload.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: payload.predecessorCorrectivePreventiveActionSha256,
  };
  const verifiedOwnerAuthorizationRecord = deepFreeze({
    ...decisionRecordCore,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: sha256Object(decisionRecordCore),
    signatureAlgorithm: 'RSA-SHA256',
    ownerIdentityCryptographicallyVerified: true,
    ownerTrustRootVerified: true,
    ownerSignatureVerified: true,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.SUCCESSOR_FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED,
    verified: true,
    blockers: Object.freeze([]),
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    proposedRegistrySchemaVersion: 4,
    successorFreshCutoverSafetyGuardHashSha256: payload.successorFreshCutoverSafetyGuardHashSha256,
    successorFreshActivationPlanHashSha256: payload.successorFreshActivationPlanHashSha256,
    successorOwnerAuthorityRegistryHashSha256: registry.successorOwnerAuthorityRegistryHashSha256,
    authorityId: authority.authorityId,
    ownerActorRef: payload.actorRef,
    ownerPublicKeySha256: authority.publicKeySha256,
    verifiedOwnerAuthorizationRecord,
    verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256: verifiedOwnerAuthorizationRecord.verifiedSuccessorFreshOwnerAuthorizationRecordHashSha256,
    privateSigningKeyAccepted: false,
    predecessorFreshOwnerAuthorizationReusable: false,
    ownerIdentityCryptographicallyVerified: true,
    ownerTrustRootVerified: true,
    ownerSignatureVerified: true,
    ownerActivationAuthorizationVerified: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    successorFreshActivationChangeContractRequired: true,
    successorFreshModeVerifierRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P74 cryptographically verifies a new successor-cycle owner decision against the exact P73 safety chain and cycle-scoped pinned owner trust root. The verified decision is evidence for P75 only; P74 does not activate the schema-v4 registry or grant release authority.',
  });
}

module.exports = {
  PURPOSE,
  DECISION,
  STATUS,
  p73SafetyCore,
  validateP73SafetyGuard,
  normalizeSuccessorFreshOwnerAuthorityRegistry,
  createSuccessorFreshOwnerSigningPayload,
  prepareSuccessorFreshOwnerActivationAuthorization,
  verifySuccessorFreshOwnerActivationAuthorization,
  findForbiddenKeyMaterial,
  findPredecessorOwnerAuthorizationReuse,
};
