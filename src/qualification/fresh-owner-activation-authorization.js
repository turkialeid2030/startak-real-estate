'use strict';

const crypto = require('crypto');
const {
  MODE,
  STATUS: REGISTRY_STATUS,
  AUTHORITY,
  evaluateCurrentCanonicalBaselineRegistry,
  stableStringify,
} = require('./canonical-baseline-registry');
const { STATUS: P55_STATUS } = require('./fresh-composite-cutover-safety-guard');
const { validateFreshActivationPlan } = require('./fresh-composite-registry-candidate');

const PURPOSE = 'FRESH_CANONICAL_BASELINE_ACTIVATION_AUTHORIZATION';
const DECISION = 'AUTHORIZE_FRESH_CANONICAL_BASELINE_ACTIVATION';
const STATUS = Object.freeze({
  HOLD_FRESH_OWNER_ACTIVATION_AUTHORIZATION: 'HOLD_FRESH_OWNER_ACTIVATION_AUTHORIZATION',
  READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE: 'READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE',
  FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED: 'FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const FORBIDDEN_KEY_NAMES = new Set([
  'privateKey', 'privateKeyPem', 'privateSigningKey', 'privateSigningKeyPem',
  'signingPrivateKey', 'signingPrivateKeyPem', 'secretKey', 'secretKeyPem',
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
function findForbiddenKeyMaterial(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_NAMES.has(key) || /private[-_]?key/i.test(key)) return `${path}.${key}`;
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
    status: STATUS.HOLD_FRESH_OWNER_ACTIVATION_AUTHORIZATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    purpose: PURPOSE,
    signatureRequired: true,
    externalSigningRequired: true,
    privateSigningKeyAccepted: false,
    ownerIdentityCryptographicallyVerified: false,
    ownerTrustRootVerified: false,
    ownerActivationAuthorizationVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function p55SafetyCore(guard) {
  return {
    schemaVersion: guard.schemaVersion,
    authoritativeMode: guard.authoritativeMode,
    proposedMode: guard.proposedMode,
    cycleId: guard.cycleId,
    freshReactivationGovernanceCycleHashSha256: guard.freshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: guard.currentRegistryHashSha256,
    freshReviewerLifecycleLockHashSha256: guard.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: guard.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: guard.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: guard.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: guard.candidateRegistryHashSha256,
    candidateRegistryContentSha256: guard.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: guard.freshCompositeEvidenceHashSha256,
    freshShadowEvaluationHashSha256: guard.freshShadowEvaluationHashSha256,
    freshCutoverRehearsalHashSha256: guard.freshCutoverRehearsalHashSha256,
  };
}

function validateP55SafetyGuard(guard, activationPlan, current) {
  const blockers = [];
  if (!guard || guard.status !== P55_STATUS.FRESH_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_AUTHORIZED) {
    return ['P55_FRESH_CUTOVER_SAFETY_GUARD_REQUIRED'];
  }
  if (
    guard.verified !== true
    || guard.reviewerLockVerified !== true
    || guard.activationPlanVerified !== true
    || guard.shadowMatchVerified !== true
    || guard.rollbackRehearsalVerified !== true
    || guard.exactRollbackIdentityVerified !== true
    || guard.safetyPrerequisitesSatisfiedForFreshOwnerAuthorization !== true
    || guard.activationAuthorized !== false
    || guard.activationApplied !== false
    || guard.reactivationAuthorized !== false
    || guard.currentBaselineMutationPerformed !== false
    || guard.freshOwnerActivationAuthorizationRequired !== true
    || guard.freshActivationChangeContractRequired !== true
    || guard.controlledActivationExecutionRequired !== true
    || guard.postActivationReleaseVerifyRequired !== true
    || guard.releaseStillBlocked !== true
    || !allAuthorityFalse(guard)
  ) blockers.push('P55_FRESH_CUTOVER_SAFETY_BOUNDARY_INVALID');
  if (guard.authoritativeMode !== MODE.LEGACY_FILE_SHA256 || guard.proposedMode !== MODE.GOVERNED_COMPOSITE_BASELINE) blockers.push('P55_MODE_SCOPE_INVALID');
  try {
    const expectedHash = requiredSha256(guard.freshCutoverSafetyGuardHashSha256, 'freshCutoverSafetyGuardHashSha256');
    if (sha256Object(p55SafetyCore(guard)) !== expectedHash) blockers.push('P55_FRESH_CUTOVER_SAFETY_HASH_MISMATCH');
    if (guard.currentRegistryHashSha256 !== current.registryHashSha256) blockers.push('P55_CURRENT_REGISTRY_BINDING_MISMATCH');
    if (guard.cycleId !== activationPlan.cycleId) blockers.push('P55_P50_CYCLE_MISMATCH');
    if (guard.freshReactivationGovernanceCycleHashSha256 !== activationPlan.freshReactivationGovernanceCycleHashSha256) blockers.push('P55_P50_CYCLE_HASH_MISMATCH');
    if (guard.freshActivationPlanHashSha256 !== activationPlan.freshActivationPlanHashSha256) blockers.push('P55_P50_ACTIVATION_PLAN_HASH_MISMATCH');
    if (guard.freshReviewerLifecycleLockHashSha256 !== activationPlan.freshReviewerLifecycleLockHashSha256) blockers.push('P55_P50_REVIEWER_LOCK_HASH_MISMATCH');
    if (guard.freshSuccessorBaselineManifestHashSha256 !== activationPlan.freshSuccessorBaselineManifestHashSha256) blockers.push('P55_P50_SUCCESSOR_MANIFEST_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeFreshOwnerAuthorityRegistry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('freshOwnerAuthorityRegistry must be an object');
  if (input.schemaVersion !== 1) throw new TypeError('freshOwnerAuthorityRegistry.schemaVersion must equal 1');
  if (input.purpose !== PURPOSE) throw new TypeError('freshOwnerAuthorityRegistry.purpose mismatch');
  if (!Array.isArray(input.authorities) || input.authorities.length === 0) throw new TypeError('freshOwnerAuthorityRegistry.authorities must be non-empty');
  const ids = new Set();
  const authorities = input.authorities.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`authority[${index}] must be an object`);
    const authorityId = requiredString(record.authorityId, `authority[${index}].authorityId`);
    if (ids.has(authorityId)) throw new TypeError('duplicate owner authorityId');
    ids.add(authorityId);
    const actorRef = requiredString(record.actorRef, `authority[${index}].actorRef`);
    const publicKeyPem = requiredString(record.publicKeyPem, `authority[${index}].publicKeyPem`);
    const publicKeySha256 = requiredSha256(record.publicKeySha256, `authority[${index}].publicKeySha256`);
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError('owner authority publicKeySha256 mismatch');
    const activeFrom = iso(record.activeFrom, `authority[${index}].activeFrom`);
    const activeUntil = record.activeUntil == null ? null : iso(record.activeUntil, `authority[${index}].activeUntil`);
    if (activeUntil && Date.parse(activeUntil) < Date.parse(activeFrom)) throw new TypeError('owner authority activeUntil precedes activeFrom');
    const allowedPurpose = requiredString(record.allowedPurpose, `authority[${index}].allowedPurpose`);
    if (allowedPurpose !== PURPOSE) throw new TypeError('owner authority allowedPurpose mismatch');
    return {
      authorityId,
      actorRef,
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, `authority[${index}].governanceEvidenceRef`),
      activeFrom,
      activeUntil,
      allowedPurpose,
    };
  }).sort((a, b) => a.authorityId.localeCompare(b.authorityId));
  const core = { schemaVersion: 1, purpose: PURPOSE, authorities };
  return deepFreeze({ ...core, ownerAuthorityRegistryHashSha256: sha256Object(core) });
}

function normalizeDecision({ activationPlan, safetyGuard, decision } = {}) {
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
  if (normalized.decision !== DECISION) throw new TypeError('fresh owner authorization decision invalid');
  if (normalized.signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('signatureAlgorithm must equal RSA-SHA256');
  if (normalized.actorRef !== activationPlan.preparedByRef) throw new TypeError('FRESH_ACTIVATION_MUST_BE_AUTHORIZED_BY_CYCLE_OWNER');
  if (Date.parse(normalized.decidedAt) < Date.parse(activationPlan.preparedAt)) throw new TypeError('FRESH_OWNER_DECISION_PRECEDES_ACTIVATION_PLAN');
  if (safetyGuard.freshActivationPlanHashSha256 !== activationPlan.freshActivationPlanHashSha256) throw new TypeError('FRESH_OWNER_DECISION_PLAN_SCOPE_MISMATCH');
  return deepFreeze(normalized);
}

function createFreshOwnerSigningPayload({ safetyGuard, activationPlan, decision } = {}) {
  const normalized = normalizeDecision({ activationPlan, safetyGuard, decision });
  return deepFreeze({
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: safetyGuard.cycleId,
    freshReactivationGovernanceCycleHashSha256: safetyGuard.freshReactivationGovernanceCycleHashSha256,
    currentRegistryHashSha256: safetyGuard.currentRegistryHashSha256,
    freshReviewerLifecycleLockHashSha256: safetyGuard.freshReviewerLifecycleLockHashSha256,
    freshActivationPlanHashSha256: safetyGuard.freshActivationPlanHashSha256,
    freshSuccessorBaselineManifestHashSha256: safetyGuard.freshSuccessorBaselineManifestHashSha256,
    freshCompositeRegistryCandidateHashSha256: safetyGuard.freshCompositeRegistryCandidateHashSha256,
    candidateRegistryHashSha256: safetyGuard.candidateRegistryHashSha256,
    candidateRegistryContentSha256: safetyGuard.candidateRegistryContentSha256,
    freshCompositeEvidenceHashSha256: safetyGuard.freshCompositeEvidenceHashSha256,
    freshShadowEvaluationHashSha256: safetyGuard.freshShadowEvaluationHashSha256,
    freshCutoverRehearsalHashSha256: safetyGuard.freshCutoverRehearsalHashSha256,
    freshCutoverSafetyGuardHashSha256: safetyGuard.freshCutoverSafetyGuardHashSha256,
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
  const { safetyGuard, activationPlan, currentRegistry, freshOwnerAuthorityRegistry, expectedFreshOwnerAuthorityRegistryHashSha256, decision } = input;
  const current = evaluateCurrentCanonicalBaselineRegistry(currentRegistry);
  if (current.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) return { error: hold(['CURRENT_LEGACY_BASELINE_REGISTRY_NOT_CONFIRMED']) };
  const planBlockers = validateFreshActivationPlan(activationPlan);
  if (planBlockers.length > 0) return { error: hold(planBlockers, { currentRegistryHashSha256: current.registryHashSha256 }) };
  const guardBlockers = validateP55SafetyGuard(safetyGuard, activationPlan, current);
  if (guardBlockers.length > 0) return { error: hold(guardBlockers, { freshActivationPlanHashSha256: activationPlan.freshActivationPlanHashSha256 }) };
  let registry;
  let expectedHash;
  let payload;
  try {
    registry = normalizeFreshOwnerAuthorityRegistry(freshOwnerAuthorityRegistry);
    expectedHash = requiredSha256(expectedFreshOwnerAuthorityRegistryHashSha256, 'expectedFreshOwnerAuthorityRegistryHashSha256');
    if (registry.ownerAuthorityRegistryHashSha256 !== expectedHash) throw new TypeError('FRESH_OWNER_AUTHORITY_REGISTRY_HASH_MISMATCH');
    payload = createFreshOwnerSigningPayload({ safetyGuard, activationPlan, decision });
  } catch (error) {
    return { error: hold([error.message], { freshCutoverSafetyGuardHashSha256: safetyGuard?.freshCutoverSafetyGuardHashSha256 || null }) };
  }
  const authority = registry.authorities.find((record) => record.authorityId === payload.authorityId);
  if (!authority) return { error: hold(['FRESH_OWNER_AUTHORITY_NOT_IN_TRUSTED_REGISTRY']) };
  if (authority.actorRef !== payload.actorRef) return { error: hold(['FRESH_OWNER_AUTHORITY_ACTOR_SCOPE_MISMATCH']) };
  if (authority.allowedPurpose !== PURPOSE) return { error: hold(['FRESH_OWNER_AUTHORITY_PURPOSE_NOT_ALLOWED']) };
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) return { error: hold(['FRESH_OWNER_AUTHORITY_OUTSIDE_ACTIVE_PERIOD']) };
  return { current, registry, authority, payload };
}

function prepareFreshOwnerActivationAuthorization(input = {}) {
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
    status: STATUS.READY_FOR_EXTERNAL_FRESH_OWNER_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    ownerActorRef: payload.actorRef,
    authorityId: authority.authorityId,
    freshCutoverSafetyGuardHashSha256: payload.freshCutoverSafetyGuardHashSha256,
    freshActivationPlanHashSha256: payload.freshActivationPlanHashSha256,
    ownerAuthorityRegistryHashSha256: registry.ownerAuthorityRegistryHashSha256,
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
    ownerIdentityCryptographicallyVerified: false,
    ownerTrustRootVerified: true,
    ownerActivationAuthorizationVerified: false,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P56 prepares deterministic signing bytes for the fresh-cycle owner authorization after P55 safety evidence. Signing occurs outside the repository. Preparation grants no activation, reactivation or release authority.',
  });
}

function verifyFreshOwnerActivationAuthorization(input = {}) {
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, authority, payload } = validated;
  const signatureBase64 = typeof input.decision?.signatureBase64 === 'string' ? input.decision.signatureBase64.trim() : '';
  if (!signatureBase64) return hold(['FRESH_OWNER_SIGNATURE_REQUIRED']);
  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), authority.publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch (_) {
    signatureVerified = false;
  }
  if (!signatureVerified) return hold(['FRESH_OWNER_SIGNATURE_INVALID']);

  const decisionRecordCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    freshCutoverSafetyGuardHashSha256: payload.freshCutoverSafetyGuardHashSha256,
    freshActivationPlanHashSha256: payload.freshActivationPlanHashSha256,
    currentRegistryHashSha256: payload.currentRegistryHashSha256,
    ownerAuthorityRegistryHashSha256: registry.ownerAuthorityRegistryHashSha256,
    authorityId: authority.authorityId,
    ownerActorRef: payload.actorRef,
    ownerPublicKeySha256: authority.publicKeySha256,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    signingPayloadHashSha256: sha256Object(payload),
  };
  const verifiedOwnerAuthorizationRecord = deepFreeze({
    ...decisionRecordCore,
    verifiedFreshOwnerAuthorizationRecordHashSha256: sha256Object(decisionRecordCore),
    signatureAlgorithm: 'RSA-SHA256',
    ownerIdentityCryptographicallyVerified: true,
    ownerTrustRootVerified: true,
    ownerSignatureVerified: true,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.FRESH_OWNER_ACTIVATION_AUTHORIZATION_CRYPTOGRAPHICALLY_VERIFIED_NOT_APPLIED,
    verified: true,
    blockers: Object.freeze([]),
    purpose: PURPOSE,
    cycleId: payload.cycleId,
    freshCutoverSafetyGuardHashSha256: payload.freshCutoverSafetyGuardHashSha256,
    freshActivationPlanHashSha256: payload.freshActivationPlanHashSha256,
    ownerAuthorityRegistryHashSha256: registry.ownerAuthorityRegistryHashSha256,
    authorityId: authority.authorityId,
    ownerActorRef: payload.actorRef,
    ownerPublicKeySha256: authority.publicKeySha256,
    verifiedOwnerAuthorizationRecord,
    verifiedFreshOwnerAuthorizationRecordHashSha256: verifiedOwnerAuthorizationRecord.verifiedFreshOwnerAuthorizationRecordHashSha256,
    privateSigningKeyAccepted: false,
    ownerIdentityCryptographicallyVerified: true,
    ownerTrustRootVerified: true,
    ownerSignatureVerified: true,
    ownerActivationAuthorizationVerified: true,
    activationAuthorized: false,
    activationApplied: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    freshActivationChangeContractRequired: true,
    controlledActivationExecutionRequired: true,
    postActivationReleaseVerifyRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: 'P56 cryptographically verifies the fresh-cycle owner decision against the exact P55 safety guard, P50 activation plan and pinned owner trust root. This verified decision is evidence for the next explicit activation-change contract; P56 itself does not activate the baseline or grant release authority.',
  });
}

module.exports = {
  PURPOSE,
  DECISION,
  STATUS,
  p55SafetyCore,
  validateP55SafetyGuard,
  normalizeFreshOwnerAuthorityRegistry,
  createFreshOwnerSigningPayload,
  prepareFreshOwnerActivationAuthorization,
  verifyFreshOwnerActivationAuthorization,
  findForbiddenKeyMaterial,
};
