'use strict';

const crypto = require('crypto');
const { stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P47_STATUS } = require('./fresh-reactivation-independent-review-handoff');

const PURPOSE = 'FRESH_REACTIVATION_INDEPENDENT_REVIEW';
const DECISION = Object.freeze({
  APPROVE: 'APPROVE_FRESH_REACTIVATION_REVIEW',
  REJECT: 'REJECT_FRESH_REACTIVATION_REVIEW',
});
const STATUS = Object.freeze({
  HOLD_FRESH_REACTIVATION_REVIEW_PACKET: 'HOLD_FRESH_REACTIVATION_REVIEW_PACKET',
  HOLD_FRESH_REACTIVATION_REVIEW_TRUST_ROOT: 'HOLD_FRESH_REACTIVATION_REVIEW_TRUST_ROOT',
  HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION: 'HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION',
  READY_FOR_EXTERNAL_FRESH_REVIEW_SIGNATURE: 'READY_FOR_EXTERNAL_FRESH_REVIEW_SIGNATURE',
  FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED: 'FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED',
  FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED: 'FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED',
});
const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
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
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false);
}
function hold(status, blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    freshReviewAccepted: false,
    freshReviewRejected: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    freshReviewerLifecycleLockRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    ...extra,
  });
}

function designationCore(record) {
  return {
    schemaVersion: record.schemaVersion,
    designationId: record.designationId,
    cycleId: record.cycleId,
    freshReactivationGovernanceCycleHashSha256: record.freshReactivationGovernanceCycleHashSha256,
    designatedByRef: record.designatedByRef,
    reviewerRef: record.reviewerRef,
    reviewerDisplayName: record.reviewerDisplayName,
    designatedAt: record.designatedAt,
    designationSourceRef: record.designationSourceRef,
    designationArtifactSha256: record.designationArtifactSha256,
  };
}

function reviewPacketCore(packet) {
  return {
    schemaVersion: packet.schemaVersion,
    reviewRequestId: packet.reviewRequestId,
    requestedAt: packet.requestedAt,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    ownerActorRef: packet.ownerActorRef,
    currentAuthoritativeMode: packet.currentAuthoritativeMode,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    requestedTargetMode: packet.requestedTargetMode,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    priorGovernanceResetRecordHashSha256: packet.priorGovernanceResetRecordHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    independentReviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    reviewChecklist: packet.reviewChecklist,
  };
}

function validateP47ReviewPacket(packet) {
  const blockers = [];
  if (!packet || packet.status !== P47_STATUS.FRESH_REACTIVATION_REVIEW_PACKET_READY_NOT_APPROVED) return ['P47_FRESH_REACTIVATION_REVIEW_PACKET_REQUIRED'];
  if (
    packet.verified !== true
    || packet.reviewPacketReady !== true
    || packet.freshReviewerDesignated !== true
    || packet.reviewerIdentityCryptographicallyVerified !== false
    || packet.reviewerTrustRootVerified !== false
    || packet.independentReviewAccepted !== false
    || packet.freshCryptographicReviewAttestationRequired !== true
    || packet.freshReviewerLifecycleLockRequired !== true
    || packet.priorReviewerAuthorityAccepted !== false
    || packet.priorActivationAuthorityAccepted !== false
    || packet.reactivationAuthorized !== false
    || packet.currentBaselineMutationPerformed !== false
    || packet.releaseStillBlocked !== true
    || !allAuthorityFalse(packet)
  ) blockers.push('P47_REVIEW_PACKET_BOUNDARY_INVALID');

  const designation = packet.freshReviewerDesignation;
  if (!designation || typeof designation !== 'object') return [...blockers, 'P47_FRESH_REVIEWER_DESIGNATION_REQUIRED'];
  try {
    const designationHash = requiredSha256(designation.freshReviewerDesignationHashSha256, 'freshReviewerDesignationHashSha256');
    if (sha256Object(designationCore(designation)) !== designationHash) blockers.push('P47_FRESH_REVIEWER_DESIGNATION_HASH_MISMATCH');
    if (packet.freshReviewerDesignationHashSha256 !== designationHash) blockers.push('P47_PACKET_DESIGNATION_HASH_MISMATCH');
    if (designation.reviewerRef !== packet.independentReviewerRef) blockers.push('P47_REVIEWER_SCOPE_MISMATCH');
    if (designation.designatedByRef !== packet.ownerActorRef) blockers.push('P47_DESIGNATOR_OWNER_SCOPE_MISMATCH');
    if (designation.reviewerRef === packet.ownerActorRef) blockers.push('P47_OWNER_AND_REVIEWER_MUST_DIFFER');
    const packetHash = requiredSha256(packet.reviewPacketHashSha256, 'reviewPacketHashSha256');
    if (sha256Object(reviewPacketCore(packet)) !== packetHash) blockers.push('P47_REVIEW_PACKET_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeReviewerRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('reviewerRegistry must be an object');
  if (!Array.isArray(registry.reviewers) || registry.reviewers.length === 0) throw new TypeError('reviewerRegistry.reviewers must be non-empty');
  const seen = new Set();
  const reviewers = registry.reviewers.map((record) => {
    const reviewerId = requiredString(record.reviewerId, 'reviewer.reviewerId');
    if (seen.has(reviewerId)) throw new TypeError(`DUPLICATE_REVIEWER_ID:${reviewerId}`);
    seen.add(reviewerId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'reviewer.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'reviewer.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`REVIEWER_PUBLIC_KEY_HASH_MISMATCH:${reviewerId}`);
    return deepFreeze({
      reviewerId,
      reviewerSubjectRef: requiredString(record.reviewerSubjectRef, 'reviewer.reviewerSubjectRef'),
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, 'reviewer.governanceEvidenceRef'),
      activeFrom: iso(record.activeFrom, 'reviewer.activeFrom'),
      activeUntil: record.activeUntil ? iso(record.activeUntil, 'reviewer.activeUntil') : null,
      allowedPurpose: requiredString(record.allowedPurpose, 'reviewer.allowedPurpose'),
    });
  });
  const core = {
    registryId: requiredString(registry.registryId, 'reviewerRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'reviewerRegistry.governanceArtifactSha256'),
    reviewers,
  };
  return deepFreeze({ ...core, reviewerRegistryHashSha256: sha256Object(core) });
}

function normalizeAttestation(packet, attestation) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) throw new TypeError('attestation must be an object');
  if (privateKeyPresent(attestation)) throw new TypeError('PRIVATE_SIGNING_KEY_INPUT_REJECTED');
  if (callerAuthorityEscalated(attestation)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  if (attestation.reviewRequestId != null && requiredString(attestation.reviewRequestId, 'attestation.reviewRequestId') !== packet.reviewRequestId) throw new TypeError('REVIEW_REQUEST_SCOPE_MISMATCH');
  if (attestation.reviewPacketHashSha256 != null && requiredSha256(attestation.reviewPacketHashSha256, 'attestation.reviewPacketHashSha256') !== packet.reviewPacketHashSha256) throw new TypeError('REVIEW_PACKET_SCOPE_MISMATCH');

  const decision = requiredString(attestation.decision, 'attestation.decision');
  if (!Object.values(DECISION).includes(decision)) throw new TypeError('attestation.decision invalid');
  const actorRef = requiredString(attestation.actorRef, 'attestation.actorRef');
  if (actorRef !== packet.independentReviewerRef) throw new TypeError('REVIEWER_ACTOR_MUST_MATCH_P47_DESIGNATION');
  if (actorRef === packet.ownerActorRef) throw new TypeError('OWNER_AND_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER');
  const decidedAt = iso(attestation.decidedAt, 'attestation.decidedAt');
  if (Date.parse(decidedAt) < Date.parse(packet.requestedAt)) throw new TypeError('FRESH_REVIEW_DECISION_PRECEDES_REVIEW_REQUEST');
  const signatureAlgorithm = requiredString(attestation.signatureAlgorithm, 'attestation.signatureAlgorithm');
  if (signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('FRESH_REVIEW_SIGNATURE_ALGORITHM_INVALID');

  return deepFreeze({
    decisionId: requiredString(attestation.decisionId, 'attestation.decisionId'),
    reviewerId: requiredString(attestation.reviewerId, 'attestation.reviewerId'),
    actorRef,
    decision,
    decisionSourceRef: requiredString(attestation.decisionSourceRef, 'attestation.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(attestation.decisionArtifactSha256, 'attestation.decisionArtifactSha256'),
    reviewEvidenceRef: requiredString(attestation.reviewEvidenceRef, 'attestation.reviewEvidenceRef'),
    reviewEvidenceSha256: requiredSha256(attestation.reviewEvidenceSha256, 'attestation.reviewEvidenceSha256'),
    decidedAt,
    rationaleRef: requiredString(attestation.rationaleRef, 'attestation.rationaleRef'),
    signatureAlgorithm,
  });
}

function createFreshReviewSigningPayload({ packet, attestation } = {}) {
  const blockers = validateP47ReviewPacket(packet);
  if (blockers.length > 0) throw new TypeError(blockers[0]);
  const normalized = normalizeAttestation(packet, attestation);
  return deepFreeze({
    schemaVersion: 1,
    purpose: PURPOSE,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    freshReviewerDesignationHashSha256: packet.freshReviewerDesignationHashSha256,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    decisionId: normalized.decisionId,
    reviewerId: normalized.reviewerId,
    actorRef: normalized.actorRef,
    decision: normalized.decision,
    decisionSourceRef: normalized.decisionSourceRef,
    decisionArtifactSha256: normalized.decisionArtifactSha256,
    reviewEvidenceRef: normalized.reviewEvidenceRef,
    reviewEvidenceSha256: normalized.reviewEvidenceSha256,
    decidedAt: normalized.decidedAt,
    rationaleRef: normalized.rationaleRef,
    signatureAlgorithm: normalized.signatureAlgorithm,
  });
}

function validateInputs({ packet, reviewerRegistry, expectedReviewerRegistryHashSha256, attestation } = {}) {
  const packetBlockers = validateP47ReviewPacket(packet);
  if (packetBlockers.length > 0) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_PACKET, packetBlockers) };
  let registry;
  let expectedHash;
  try {
    registry = normalizeReviewerRegistry(reviewerRegistry);
    expectedHash = requiredSha256(expectedReviewerRegistryHashSha256, 'expectedReviewerRegistryHashSha256');
  } catch (error) {
    return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_TRUST_ROOT, [error.message], { reviewPacketHashSha256: packet.reviewPacketHashSha256 }) };
  }
  if (registry.reviewerRegistryHashSha256 !== expectedHash) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_TRUST_ROOT, ['FRESH_REVIEWER_REGISTRY_HASH_MISMATCH'], { reviewerRegistryHashSha256: registry.reviewerRegistryHashSha256 }) };

  let payload;
  try {
    payload = createFreshReviewSigningPayload({ packet, attestation });
  } catch (error) {
    return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, [error.message], { reviewPacketHashSha256: packet.reviewPacketHashSha256, reviewerRegistryHashSha256: registry.reviewerRegistryHashSha256 }) };
  }
  const reviewer = registry.reviewers.find((record) => record.reviewerId === payload.reviewerId);
  if (!reviewer) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['REVIEWER_NOT_IN_FRESH_TRUST_REGISTRY']) };
  if (reviewer.reviewerSubjectRef !== payload.actorRef || reviewer.reviewerSubjectRef !== packet.independentReviewerRef) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['FRESH_REVIEWER_SUBJECT_SCOPE_MISMATCH']) };
  if (reviewer.allowedPurpose !== PURPOSE) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['FRESH_REVIEWER_PURPOSE_NOT_ALLOWED']) };
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(reviewer.activeFrom) || (reviewer.activeUntil && decidedMs > Date.parse(reviewer.activeUntil))) return { error: hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['FRESH_REVIEWER_OUTSIDE_ACTIVE_PERIOD']) };
  return { registry, reviewer, payload };
}

function prepareFreshReactivationReviewAttestation(input = {}) {
  if (privateKeyPresent(input)) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(input)) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, reviewer, payload } = validated;
  const attestationWithoutSignature = deepFreeze({
    reviewRequestId: payload.reviewRequestId,
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    decisionId: payload.decisionId,
    reviewerId: payload.reviewerId,
    actorRef: payload.actorRef,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    reviewEvidenceRef: payload.reviewEvidenceRef,
    reviewEvidenceSha256: payload.reviewEvidenceSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    signatureAlgorithm: payload.signatureAlgorithm,
  });
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_FRESH_REVIEW_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    reviewerRegistryHashSha256: registry.reviewerRegistryHashSha256,
    reviewerId: reviewer.reviewerId,
    reviewerSubjectRef: reviewer.reviewerSubjectRef,
    reviewerPublicKeySha256: reviewer.publicKeySha256,
    signingPayload: payload,
    signingPayloadHashSha256: sha256Object(payload),
    signingBytesBase64: Buffer.from(stableStringify(payload), 'utf8').toString('base64'),
    attestationWithoutSignature,
    privateSigningKeyAccepted: false,
    externalSignatureRequired: true,
    freshReviewAccepted: false,
    freshReviewRejected: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    freshReviewerLifecycleLockRequired: true,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function verifyFreshReactivationReviewAttestation(input = {}) {
  if (privateKeyPresent(input)) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  if (callerAuthorityEscalated(input)) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, reviewer, payload } = validated;
  const signatureBase64 = typeof input.attestation?.signatureBase64 === 'string' ? input.attestation.signatureBase64.trim() : '';
  if (!signatureBase64) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['FRESH_REVIEW_SIGNATURE_REQUIRED']);
  let valid = false;
  try {
    valid = crypto.verify('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), reviewer.publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch (_) {
    valid = false;
  }
  if (!valid) return hold(STATUS.HOLD_FRESH_REACTIVATION_REVIEW_ATTESTATION, ['FRESH_REVIEW_SIGNATURE_INVALID']);

  const decisionCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    reviewRequestId: payload.reviewRequestId,
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    cycleId: payload.cycleId,
    freshReactivationGovernanceCycleHashSha256: payload.freshReactivationGovernanceCycleHashSha256,
    freshReviewerDesignationHashSha256: payload.freshReviewerDesignationHashSha256,
    reviewerRegistryHashSha256: registry.reviewerRegistryHashSha256,
    reviewerId: reviewer.reviewerId,
    reviewerSubjectRef: reviewer.reviewerSubjectRef,
    reviewerPublicKeySha256: reviewer.publicKeySha256,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    reviewEvidenceRef: payload.reviewEvidenceRef,
    reviewEvidenceSha256: payload.reviewEvidenceSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    signingPayloadHashSha256: sha256Object(payload),
  };
  const verifiedReviewRecord = deepFreeze({
    ...decisionCore,
    verifiedFreshReviewRecordHashSha256: sha256Object(decisionCore),
    signatureAlgorithm: 'RSA-SHA256',
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
  });
  const approved = payload.decision === DECISION.APPROVE;
  return deepFreeze({
    schemaVersion: 1,
    status: approved ? STATUS.FRESH_REACTIVATION_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED : STATUS.FRESH_REACTIVATION_REVIEW_REJECTED_CYCLE_BLOCKED,
    verified: true,
    blockers: Object.freeze([]),
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    reviewerRegistryHashSha256: registry.reviewerRegistryHashSha256,
    verifiedReviewRecord,
    verifiedFreshReviewRecordHashSha256: verifiedReviewRecord.verifiedFreshReviewRecordHashSha256,
    freshReviewAccepted: approved,
    freshReviewRejected: !approved,
    cycleBlockedByReview: !approved,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    freshReviewerLifecycleLockRequired: approved,
    freshActivationPlanRequired: approved,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: approved
      ? 'P48 cryptographically verifies the fresh independent reviewer decision against the exact P47 packet and pinned trust root. Approval is review evidence only; a fresh reviewer lifecycle lock and all later governance steps remain mandatory.'
      : 'P48 cryptographically verifies a rejection of the fresh review packet. The current reactivation cycle is blocked and grants no reactivation or release authority.',
  });
}

module.exports = {
  PURPOSE,
  DECISION,
  STATUS,
  AUTHORITY,
  validateP47ReviewPacket,
  normalizeReviewerRegistry,
  createFreshReviewSigningPayload,
  prepareFreshReactivationReviewAttestation,
  verifyFreshReactivationReviewAttestation,
};
