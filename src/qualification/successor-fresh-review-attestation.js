'use strict';

const crypto = require('crypto');
const { AUTHORITY, stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P65_STATUS } = require('./successor-fresh-independent-review-handoff');

const PURPOSE = 'SUCCESSOR_FRESH_REACTIVATION_INDEPENDENT_REVIEW';
const DECISION = Object.freeze({
  APPROVE: 'APPROVE_SUCCESSOR_FRESH_REACTIVATION_REVIEW',
  REJECT: 'REJECT_SUCCESSOR_FRESH_REACTIVATION_REVIEW',
});
const STATUS = Object.freeze({
  HOLD_SUCCESSOR_FRESH_REVIEW_PACKET: 'HOLD_SUCCESSOR_FRESH_REVIEW_PACKET',
  HOLD_SUCCESSOR_FRESH_REVIEW_TRUST_ROOT: 'HOLD_SUCCESSOR_FRESH_REVIEW_TRUST_ROOT',
  HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION: 'HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION',
  READY_FOR_EXTERNAL_SUCCESSOR_FRESH_REVIEW_SIGNATURE: 'READY_FOR_EXTERNAL_SUCCESSOR_FRESH_REVIEW_SIGNATURE',
  SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED: 'SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED',
  SUCCESSOR_FRESH_REVIEW_REJECTED_CYCLE_BLOCKED: 'SUCCESSOR_FRESH_REVIEW_REJECTED_CYCLE_BLOCKED',
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
    || (value.reactivationAuthorized != null && value.reactivationAuthorized !== false)
    || (value.currentBaselineMutationPerformed != null && value.currentBaselineMutationPerformed !== false)
    || (value.successorFreshReviewAccepted != null && value.successorFreshReviewAccepted !== false);
}
function hold(status, blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    successorFreshReviewAccepted: false,
    successorFreshReviewRejected: false,
    cycleBlockedByReview: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: false,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    successorFreshReviewerLifecycleLockRequired: true,
    successorFreshActivationPlanRequired: false,
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
    successorFreshReactivationGovernanceCycleHashSha256: record.successorFreshReactivationGovernanceCycleHashSha256,
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
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    ownerActorRef: packet.ownerActorRef,
    currentAuthoritativeMode: packet.currentAuthoritativeMode,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    currentRegistryContentSha256: packet.currentRegistryContentSha256,
    requestedTargetMode: packet.requestedTargetMode,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    independentReviewerRef: packet.independentReviewerRef,
    reviewerDisplayName: packet.reviewerDisplayName,
    reviewChecklist: packet.reviewChecklist,
  };
}

function validateP65ReviewPacket(packet) {
  const blockers = [];
  if (!packet || packet.status !== P65_STATUS.SUCCESSOR_FRESH_REVIEW_PACKET_READY_NOT_APPROVED) return ['P65_SUCCESSOR_FRESH_REVIEW_PACKET_REQUIRED'];
  if (
    packet.verified !== true
    || packet.reviewPacketReady !== true
    || packet.successorFreshReviewerDesignated !== true
    || packet.reviewerIdentityCryptographicallyVerified !== false
    || packet.reviewerTrustRootVerified !== false
    || packet.independentReviewAccepted !== false
    || packet.successorFreshCryptographicReviewAttestationRequired !== true
    || packet.successorFreshReviewerLifecycleLockRequired !== true
    || packet.predecessorReviewerAuthorityAccepted !== false
    || packet.predecessorActivationAuthorityAccepted !== false
    || packet.reactivationAuthorized !== false
    || packet.currentBaselineMutationPerformed !== false
    || packet.releaseStillBlocked !== true
    || !allAuthorityFalse(packet)
  ) blockers.push('P65_SUCCESSOR_FRESH_REVIEW_PACKET_BOUNDARY_INVALID');

  const designation = packet.successorFreshReviewerDesignation;
  if (!designation || typeof designation !== 'object' || Array.isArray(designation)) return [...blockers, 'P65_SUCCESSOR_FRESH_REVIEWER_DESIGNATION_REQUIRED'];
  try {
    const designationHash = requiredSha256(designation.successorFreshReviewerDesignationHashSha256, 'successorFreshReviewerDesignationHashSha256');
    if (sha256Object(designationCore(designation)) !== designationHash) blockers.push('P65_SUCCESSOR_FRESH_REVIEWER_DESIGNATION_HASH_MISMATCH');
    if (packet.successorFreshReviewerDesignationHashSha256 !== designationHash) blockers.push('P65_PACKET_DESIGNATION_HASH_MISMATCH');
    if (designation.reviewerRef !== packet.independentReviewerRef) blockers.push('P65_REVIEWER_SCOPE_MISMATCH');
    if (designation.designatedByRef !== packet.ownerActorRef) blockers.push('P65_DESIGNATOR_OWNER_SCOPE_MISMATCH');
    if (designation.reviewerRef === packet.ownerActorRef) blockers.push('P65_OWNER_AND_REVIEWER_MUST_DIFFER');
    const packetHash = requiredSha256(packet.successorFreshReviewPacketHashSha256, 'successorFreshReviewPacketHashSha256');
    if (sha256Object(reviewPacketCore(packet)) !== packetHash) blockers.push('P65_SUCCESSOR_FRESH_REVIEW_PACKET_HASH_MISMATCH');
  } catch (error) {
    blockers.push(error.message);
  }
  return blockers;
}

function normalizeSuccessorReviewerRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('reviewerRegistry must be an object');
  if (registry.schemaVersion !== 1) throw new TypeError('reviewerRegistry.schemaVersion must equal 1');
  if (!Array.isArray(registry.reviewers) || registry.reviewers.length === 0) throw new TypeError('reviewerRegistry.reviewers must be non-empty');
  const seen = new Set();
  const reviewers = registry.reviewers.map((record) => {
    const reviewerId = requiredString(record.reviewerId, 'reviewer.reviewerId');
    if (seen.has(reviewerId)) throw new TypeError(`DUPLICATE_REVIEWER_ID:${reviewerId}`);
    seen.add(reviewerId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'reviewer.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'reviewer.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`REVIEWER_PUBLIC_KEY_HASH_MISMATCH:${reviewerId}`);
    const forbidden = findForbiddenKeyMaterial(record);
    if (forbidden) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`);
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
    schemaVersion: 1,
    registryId: requiredString(registry.registryId, 'reviewerRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'reviewerRegistry.governanceArtifactSha256'),
    reviewers,
  };
  return deepFreeze({ ...core, successorReviewerRegistryHashSha256: sha256Object(core) });
}

function normalizeAttestation(packet, attestation) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) throw new TypeError('attestation must be an object');
  const forbidden = findForbiddenKeyMaterial(attestation);
  if (forbidden) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`);
  if (callerAuthorityEscalated(attestation)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  if (attestation.reviewRequestId != null && requiredString(attestation.reviewRequestId, 'attestation.reviewRequestId') !== packet.reviewRequestId) throw new TypeError('SUCCESSOR_REVIEW_REQUEST_SCOPE_MISMATCH');
  if (attestation.reviewPacketHashSha256 != null && requiredSha256(attestation.reviewPacketHashSha256, 'attestation.reviewPacketHashSha256') !== packet.successorFreshReviewPacketHashSha256) throw new TypeError('SUCCESSOR_REVIEW_PACKET_SCOPE_MISMATCH');
  const decision = requiredString(attestation.decision, 'attestation.decision');
  if (!Object.values(DECISION).includes(decision)) throw new TypeError('attestation.decision invalid');
  const actorRef = requiredString(attestation.actorRef, 'attestation.actorRef');
  if (actorRef !== packet.independentReviewerRef) throw new TypeError('REVIEWER_ACTOR_MUST_MATCH_P65_DESIGNATION');
  if (actorRef === packet.ownerActorRef) throw new TypeError('OWNER_AND_SUCCESSOR_FRESH_INDEPENDENT_REVIEWER_MUST_DIFFER');
  const decidedAt = iso(attestation.decidedAt, 'attestation.decidedAt');
  if (Date.parse(decidedAt) < Date.parse(packet.requestedAt)) throw new TypeError('SUCCESSOR_FRESH_REVIEW_DECISION_PRECEDES_REVIEW_REQUEST');
  const signatureAlgorithm = requiredString(attestation.signatureAlgorithm, 'attestation.signatureAlgorithm');
  if (signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('SUCCESSOR_FRESH_REVIEW_SIGNATURE_ALGORITHM_INVALID');
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

function createSuccessorFreshReviewSigningPayload({ packet, attestation } = {}) {
  const blockers = validateP65ReviewPacket(packet);
  if (blockers.length > 0) throw new TypeError(blockers[0]);
  const normalized = normalizeAttestation(packet, attestation);
  return deepFreeze({
    schemaVersion: 1,
    purpose: PURPOSE,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256,
    cycleId: packet.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: packet.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerDesignationHashSha256: packet.successorFreshReviewerDesignationHashSha256,
    currentRegistryHashSha256: packet.currentRegistryHashSha256,
    currentRegistryContentSha256: packet.currentRegistryContentSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    cycleEvidenceArtifactSha256: packet.cycleEvidenceArtifactSha256,
    predecessorIncidentCloseoutPacketHashSha256: packet.predecessorIncidentCloseoutPacketHashSha256,
    predecessorHumanDecisionRecordHashSha256: packet.predecessorHumanDecisionRecordHashSha256,
    predecessorGovernanceResetRecordHashSha256: packet.predecessorGovernanceResetRecordHashSha256,
    predecessorRootCauseAnalysisSha256: packet.predecessorRootCauseAnalysisSha256,
    predecessorCorrectivePreventiveActionSha256: packet.predecessorCorrectivePreventiveActionSha256,
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
  const packetBlockers = validateP65ReviewPacket(packet);
  if (packetBlockers.length > 0) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_PACKET, packetBlockers) };
  let registry;
  let expectedHash;
  try {
    registry = normalizeSuccessorReviewerRegistry(reviewerRegistry);
    expectedHash = requiredSha256(expectedReviewerRegistryHashSha256, 'expectedReviewerRegistryHashSha256');
  } catch (error) {
    return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_TRUST_ROOT, [error.message], { reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256 }) };
  }
  if (registry.successorReviewerRegistryHashSha256 !== expectedHash) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_TRUST_ROOT, ['SUCCESSOR_FRESH_REVIEWER_REGISTRY_HASH_MISMATCH'], { successorReviewerRegistryHashSha256: registry.successorReviewerRegistryHashSha256 }) };
  let payload;
  try {
    payload = createSuccessorFreshReviewSigningPayload({ packet, attestation });
  } catch (error) {
    return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, [error.message], { reviewPacketHashSha256: packet.successorFreshReviewPacketHashSha256, successorReviewerRegistryHashSha256: registry.successorReviewerRegistryHashSha256 }) };
  }
  const reviewer = registry.reviewers.find((record) => record.reviewerId === payload.reviewerId);
  if (!reviewer) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['REVIEWER_NOT_IN_SUCCESSOR_FRESH_TRUST_REGISTRY']) };
  if (reviewer.reviewerSubjectRef !== payload.actorRef || reviewer.reviewerSubjectRef !== packet.independentReviewerRef) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['SUCCESSOR_FRESH_REVIEWER_SUBJECT_SCOPE_MISMATCH']) };
  if (reviewer.allowedPurpose !== PURPOSE) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['SUCCESSOR_FRESH_REVIEWER_PURPOSE_NOT_ALLOWED']) };
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(reviewer.activeFrom) || (reviewer.activeUntil && decidedMs > Date.parse(reviewer.activeUntil))) return { error: hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['SUCCESSOR_FRESH_REVIEWER_OUTSIDE_ACTIVE_PERIOD']) };
  return { registry, reviewer, payload };
}

function prepareSuccessorFreshReviewAttestation(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, [`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(input)) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, reviewer, payload } = validated;
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_SUCCESSOR_FRESH_REVIEW_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    successorReviewerRegistryHashSha256: registry.successorReviewerRegistryHashSha256,
    reviewerId: reviewer.reviewerId,
    reviewerSubjectRef: reviewer.reviewerSubjectRef,
    reviewerPublicKeySha256: reviewer.publicKeySha256,
    signingPayload: payload,
    signingPayloadHashSha256: sha256Object(payload),
    signingBytesBase64: Buffer.from(stableStringify(payload), 'utf8').toString('base64'),
    privateSigningKeyAccepted: false,
    externalSignatureRequired: true,
    successorFreshReviewAccepted: false,
    successorFreshReviewRejected: false,
    cycleBlockedByReview: false,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    successorFreshReviewerLifecycleLockRequired: true,
    successorFreshActivationPlanRequired: false,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });
}

function verifySuccessorFreshReviewAttestation(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, [`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]);
  if (callerAuthorityEscalated(input)) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const validated = validateInputs(input);
  if (validated.error) return validated.error;
  const { registry, reviewer, payload } = validated;
  const signatureBase64 = typeof input.attestation?.signatureBase64 === 'string' ? input.attestation.signatureBase64.trim() : '';
  if (!signatureBase64) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['SUCCESSOR_FRESH_REVIEW_SIGNATURE_REQUIRED']);
  let valid = false;
  try {
    valid = crypto.verify('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), reviewer.publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch (_) {
    valid = false;
  }
  if (!valid) return hold(STATUS.HOLD_SUCCESSOR_FRESH_REVIEW_ATTESTATION, ['SUCCESSOR_FRESH_REVIEW_SIGNATURE_INVALID']);

  const decisionCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    reviewRequestId: payload.reviewRequestId,
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    cycleId: payload.cycleId,
    successorFreshReactivationGovernanceCycleHashSha256: payload.successorFreshReactivationGovernanceCycleHashSha256,
    successorFreshReviewerDesignationHashSha256: payload.successorFreshReviewerDesignationHashSha256,
    successorReviewerRegistryHashSha256: registry.successorReviewerRegistryHashSha256,
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
  const verifiedSuccessorFreshReviewRecord = deepFreeze({
    ...decisionCore,
    verifiedSuccessorFreshReviewRecordHashSha256: sha256Object(decisionCore),
    signatureAlgorithm: 'RSA-SHA256',
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
  });
  const approved = payload.decision === DECISION.APPROVE;
  return deepFreeze({
    schemaVersion: 1,
    status: approved ? STATUS.SUCCESSOR_FRESH_REVIEW_APPROVED_CRYPTOGRAPHICALLY_VERIFIED : STATUS.SUCCESSOR_FRESH_REVIEW_REJECTED_CYCLE_BLOCKED,
    verified: true,
    blockers: Object.freeze([]),
    reviewPacketHashSha256: payload.reviewPacketHashSha256,
    successorReviewerRegistryHashSha256: registry.successorReviewerRegistryHashSha256,
    verifiedSuccessorFreshReviewRecord,
    verifiedSuccessorFreshReviewRecordHashSha256: verifiedSuccessorFreshReviewRecord.verifiedSuccessorFreshReviewRecordHashSha256,
    successorFreshReviewAccepted: approved,
    successorFreshReviewRejected: !approved,
    cycleBlockedByReview: !approved,
    reviewerIdentityCryptographicallyVerified: true,
    reviewerTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    successorFreshReviewerLifecycleLockRequired: approved,
    successorFreshActivationPlanRequired: approved,
    reactivationAuthorized: false,
    currentBaselineMutationPerformed: false,
    releaseStillBlocked: true,
    ...AUTHORITY,
    semantics: approved
      ? 'P66 cryptographically verifies the successor-cycle independent reviewer decision against the exact P65 packet and pinned successor reviewer trust root. Approval remains review evidence only; lifecycle lock and all later activation governance remain mandatory.'
      : 'P66 cryptographically verifies a rejection of the successor fresh review packet. The successor cycle is blocked and no release, reactivation or mutation authority is granted.',
  });
}

module.exports = {
  PURPOSE,
  DECISION,
  STATUS,
  designationCore,
  reviewPacketCore,
  validateP65ReviewPacket,
  normalizeSuccessorReviewerRegistry,
  normalizeAttestation,
  createSuccessorFreshReviewSigningPayload,
  prepareSuccessorFreshReviewAttestation,
  verifySuccessorFreshReviewAttestation,
};
