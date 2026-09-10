'use strict';

const crypto = require('crypto');
const { stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P44_STATUS, AUTHORITY } = require('./post-rollback-canonical-baseline-verification');

const STATUS = Object.freeze({
  HOLD_INCIDENT_CLOSEOUT_ATTESTATION: 'HOLD_INCIDENT_CLOSEOUT_ATTESTATION',
  READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE: 'READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE',
  INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE: 'INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE',
  INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION: 'INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION',
});

const DECISION = Object.freeze({
  CLOSE_INCIDENT: 'CLOSE_INCIDENT',
  KEEP_INCIDENT_OPEN: 'KEEP_INCIDENT_OPEN',
  ESCALATE_INCIDENT: 'ESCALATE_INCIDENT',
});

const PURPOSE = 'CANONICAL_BASELINE_ROLLBACK_INCIDENT_CLOSEOUT';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_KEY_NAMES = new Set([
  'privateKey', 'privateKeyPem', 'privateSigningKey', 'privateSigningKeyPem',
  'signingPrivateKey', 'secretKey', 'secret', 'password', 'bearerToken',
]);

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

function exactKeys(value, allowed, field) {
  const unknown = Object.keys(value || {}).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`${field} contains unknown field(s): ${unknown.sort().join(',')}`);
}

function allAuthorityFalse(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false));
}

function findForbiddenKeyMaterial(value, path = '$', seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_NAMES.has(key)) return `${path}.${key}`;
    const nested = findForbiddenKeyMaterial(child, `${path}.${key}`, seen);
    if (nested) return nested;
  }
  return null;
}

function hold(blockers, p44 = null, registryHashSha256 = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    incidentId: p44?.incidentCloseoutPacket?.incidentId || null,
    incidentCloseoutPacketHashSha256: p44?.incidentCloseoutPacketHashSha256 || null,
    closeoutAuthorityRegistryHashSha256: registryHashSha256,
    signingPayload: null,
    signingPayloadHashSha256: null,
    signingBytesBase64: null,
    incidentClosed: false,
    humanIncidentCloseoutVerified: false,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    privateSigningKeyAccepted: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
  });
}

function validateP44CloseoutReady(p44) {
  const blockers = [];
  if (!p44 || p44.status !== P44_STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY) {
    return ['P44_INCIDENT_CLOSEOUT_READY_EVIDENCE_REQUIRED'];
  }
  if (
    p44.verified !== true
    || p44.postRollbackVerificationPassed !== true
    || p44.restoredExactP39LegacyRegistry !== true
    || p44.rollbackExecutionVerified !== true
    || p44.rollbackTriggerVerified !== true
    || p44.postRollbackReleaseVerifyEvidenceConsistent !== true
    || p44.incidentCloseoutReady !== true
    || p44.incidentClosed !== false
    || p44.humanIncidentCloseoutRequired !== true
    || p44.automaticIncidentCloseoutPerformed !== false
    || p44.reactivationAllowed !== false
    || p44.reactivationRequiresNewGovernanceCycle !== true
    || p44.releaseStillBlocked !== true
    || !allAuthorityFalse(p44)
  ) blockers.push('P44_INCIDENT_CLOSEOUT_BOUNDARY_INVALID');

  const packet = p44.incidentCloseoutPacket;
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return [...blockers, 'P44_INCIDENT_CLOSEOUT_PACKET_REQUIRED'];
  if (
    packet.incidentCloseoutReady !== true
    || packet.incidentClosed !== false
    || packet.humanIncidentCloseoutRequired !== true
    || packet.automaticIncidentCloseoutPerformed !== false
    || packet.restoredExactP39LegacyRegistry !== true
    || packet.postRollbackReleaseVerifyEvidenceConsistent !== true
    || packet.reactivationAllowed !== false
    || packet.reactivationRequiresNewGovernanceCycle !== true
    || packet.releaseStillBlocked !== true
    || !allAuthorityFalse(packet)
  ) blockers.push('P44_INCIDENT_CLOSEOUT_PACKET_BOUNDARY_INVALID');

  const core = {
    schemaVersion: packet.schemaVersion,
    incidentId: packet.incidentId,
    incidentRef: packet.incidentRef,
    closeoutPreparedByRef: packet.closeoutPreparedByRef,
    closeoutPreparedAt: packet.closeoutPreparedAt,
    activationChangeContractHashSha256: packet.activationChangeContractHashSha256,
    activationExecutionReceiptHashSha256: packet.activationExecutionReceiptHashSha256,
    rollbackTriggerHashSha256: packet.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: packet.rollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: packet.restoredLegacyRegistryHashSha256,
    postRollbackReleaseVerifyEvidenceHashSha256: packet.postRollbackReleaseVerifyEvidenceHashSha256,
    postRollbackReleaseVerifyRunId: packet.postRollbackReleaseVerifyRunId,
    postRollbackReleaseVerifySourceCommitSha: packet.postRollbackReleaseVerifySourceCommitSha,
    postRollbackReleaseVerifyCompletedAt: packet.postRollbackReleaseVerifyCompletedAt,
  };
  try {
    requiredString(core.incidentId, 'P44.incidentId');
    requiredString(core.incidentRef, 'P44.incidentRef');
    requiredString(core.closeoutPreparedByRef, 'P44.closeoutPreparedByRef');
    iso(core.closeoutPreparedAt, 'P44.closeoutPreparedAt');
    requiredSha256(core.activationChangeContractHashSha256, 'P44.activationChangeContractHashSha256');
    requiredSha256(core.activationExecutionReceiptHashSha256, 'P44.activationExecutionReceiptHashSha256');
    requiredSha256(core.rollbackTriggerHashSha256, 'P44.rollbackTriggerHashSha256');
    requiredSha256(core.rollbackExecutionReceiptHashSha256, 'P44.rollbackExecutionReceiptHashSha256');
    requiredSha256(core.restoredLegacyRegistryHashSha256, 'P44.restoredLegacyRegistryHashSha256');
    requiredSha256(core.postRollbackReleaseVerifyEvidenceHashSha256, 'P44.postRollbackReleaseVerifyEvidenceHashSha256');
    requiredString(core.postRollbackReleaseVerifyRunId, 'P44.postRollbackReleaseVerifyRunId');
    requiredCommit(core.postRollbackReleaseVerifySourceCommitSha, 'P44.postRollbackReleaseVerifySourceCommitSha');
    iso(core.postRollbackReleaseVerifyCompletedAt, 'P44.postRollbackReleaseVerifyCompletedAt');
  } catch (error) {
    blockers.push(error.message);
  }
  const packetHash = sha256Object(core);
  if (!SHA256_RE.test(packet.incidentCloseoutPacketHashSha256 || '') || packet.incidentCloseoutPacketHashSha256 !== packetHash) blockers.push('P44_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH');
  if (p44.incidentCloseoutPacketHashSha256 !== packetHash) blockers.push('P44_INCIDENT_CLOSEOUT_PACKET_OUTER_HASH_MISMATCH');
  if (p44.postRollbackVerificationHashSha256 !== packetHash) blockers.push('P44_POST_ROLLBACK_VERIFICATION_HASH_MISMATCH');
  return blockers;
}

function normalizeCloseoutAuthorityRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('closeoutAuthorityRegistry must be an object');
  exactKeys(registry, ['registryId', 'governanceArtifactSha256', 'authorities'], 'closeoutAuthorityRegistry');
  if (!Array.isArray(registry.authorities) || registry.authorities.length === 0) throw new TypeError('closeoutAuthorityRegistry.authorities must be non-empty');
  const seen = new Set();
  const authorities = registry.authorities.map((record) => {
    exactKeys(record, ['authorityId', 'actorRef', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom', 'activeUntil', 'allowedPurpose'], 'closeoutAuthority');
    const authorityId = requiredString(record.authorityId, 'closeoutAuthority.authorityId');
    if (seen.has(authorityId)) throw new TypeError(`DUPLICATE_CLOSEOUT_AUTHORITY_ID:${authorityId}`);
    seen.add(authorityId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'closeoutAuthority.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'closeoutAuthority.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`CLOSEOUT_AUTHORITY_PUBLIC_KEY_HASH_MISMATCH:${authorityId}`);
    return deepFreeze({
      authorityId,
      actorRef: requiredString(record.actorRef, 'closeoutAuthority.actorRef'),
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, 'closeoutAuthority.governanceEvidenceRef'),
      activeFrom: iso(record.activeFrom, 'closeoutAuthority.activeFrom'),
      activeUntil: record.activeUntil ? iso(record.activeUntil, 'closeoutAuthority.activeUntil') : null,
      allowedPurpose: requiredString(record.allowedPurpose, 'closeoutAuthority.allowedPurpose'),
    });
  });
  const core = {
    registryId: requiredString(registry.registryId, 'closeoutAuthorityRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'closeoutAuthorityRegistry.governanceArtifactSha256'),
    authorities,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256Object(core) });
}

function normalizeDecision(input, { requireSignature = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('closeout decision must be an object');
  const allowed = [
    'authorityId', 'actorRef', 'decisionId', 'decision', 'decisionSourceRef', 'decisionArtifactSha256',
    'decidedAt', 'rationaleRef', 'rootCauseRef', 'correctiveActionRef', 'lessonsLearnedRef',
    'nextReviewRef', 'escalationRef', 'signatureAlgorithm', 'signatureBase64',
  ];
  exactKeys(input, allowed, 'closeoutDecision');
  const decision = requiredString(input.decision, 'closeoutDecision.decision');
  if (!Object.values(DECISION).includes(decision)) throw new TypeError('closeoutDecision.decision is invalid');
  const signatureAlgorithm = requiredString(input.signatureAlgorithm, 'closeoutDecision.signatureAlgorithm');
  if (signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('CLOSEOUT_SIGNATURE_ALGORITHM_INVALID');
  const normalized = {
    authorityId: requiredString(input.authorityId, 'closeoutDecision.authorityId'),
    actorRef: requiredString(input.actorRef, 'closeoutDecision.actorRef'),
    decisionId: requiredString(input.decisionId, 'closeoutDecision.decisionId'),
    decision,
    decisionSourceRef: requiredString(input.decisionSourceRef, 'closeoutDecision.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(input.decisionArtifactSha256, 'closeoutDecision.decisionArtifactSha256'),
    decidedAt: iso(input.decidedAt, 'closeoutDecision.decidedAt'),
    rationaleRef: requiredString(input.rationaleRef, 'closeoutDecision.rationaleRef'),
    rootCauseRef: input.rootCauseRef ? requiredString(input.rootCauseRef, 'closeoutDecision.rootCauseRef') : null,
    correctiveActionRef: input.correctiveActionRef ? requiredString(input.correctiveActionRef, 'closeoutDecision.correctiveActionRef') : null,
    lessonsLearnedRef: input.lessonsLearnedRef ? requiredString(input.lessonsLearnedRef, 'closeoutDecision.lessonsLearnedRef') : null,
    nextReviewRef: input.nextReviewRef ? requiredString(input.nextReviewRef, 'closeoutDecision.nextReviewRef') : null,
    escalationRef: input.escalationRef ? requiredString(input.escalationRef, 'closeoutDecision.escalationRef') : null,
    signatureAlgorithm,
  };
  if (decision === DECISION.CLOSE_INCIDENT && (!normalized.rootCauseRef || !normalized.correctiveActionRef || !normalized.lessonsLearnedRef)) {
    throw new TypeError('CLOSE_INCIDENT_REQUIRES_ROOT_CAUSE_CORRECTIVE_ACTION_AND_LESSONS_REFS');
  }
  if (decision === DECISION.KEEP_INCIDENT_OPEN && !normalized.nextReviewRef) throw new TypeError('KEEP_INCIDENT_OPEN_REQUIRES_NEXT_REVIEW_REF');
  if (decision === DECISION.ESCALATE_INCIDENT && !normalized.escalationRef) throw new TypeError('ESCALATE_INCIDENT_REQUIRES_ESCALATION_REF');
  if (requireSignature) {
    normalized.signatureBase64 = requiredString(input.signatureBase64, 'closeoutDecision.signatureBase64');
  }
  return deepFreeze(normalized);
}

function createSigningPayload({ p44, decision }) {
  const blockers = validateP44CloseoutReady(p44);
  if (blockers.length) throw new TypeError(blockers.join(','));
  const normalized = normalizeDecision(decision);
  const packet = p44.incidentCloseoutPacket;
  if (Date.parse(normalized.decidedAt) < Date.parse(packet.closeoutPreparedAt)) throw new TypeError('INCIDENT_CLOSEOUT_DECISION_PRECEDES_P44_CLOSEOUT_PACKET');
  if (Date.parse(normalized.decidedAt) < Date.parse(packet.postRollbackReleaseVerifyCompletedAt)) throw new TypeError('INCIDENT_CLOSEOUT_DECISION_PRECEDES_POST_ROLLBACK_RELEASE_VERIFY');
  return deepFreeze({
    schemaVersion: 1,
    purpose: PURPOSE,
    incidentId: packet.incidentId,
    incidentRef: packet.incidentRef,
    incidentCloseoutPacketHashSha256: packet.incidentCloseoutPacketHashSha256,
    postRollbackVerificationHashSha256: p44.postRollbackVerificationHashSha256,
    activationChangeContractHashSha256: packet.activationChangeContractHashSha256,
    activationExecutionReceiptHashSha256: packet.activationExecutionReceiptHashSha256,
    rollbackTriggerHashSha256: packet.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: packet.rollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: packet.restoredLegacyRegistryHashSha256,
    postRollbackReleaseVerifyEvidenceHashSha256: packet.postRollbackReleaseVerifyEvidenceHashSha256,
    authorityId: normalized.authorityId,
    actorRef: normalized.actorRef,
    decisionId: normalized.decisionId,
    decision: normalized.decision,
    decisionSourceRef: normalized.decisionSourceRef,
    decisionArtifactSha256: normalized.decisionArtifactSha256,
    decidedAt: normalized.decidedAt,
    rationaleRef: normalized.rationaleRef,
    rootCauseRef: normalized.rootCauseRef,
    correctiveActionRef: normalized.correctiveActionRef,
    lessonsLearnedRef: normalized.lessonsLearnedRef,
    nextReviewRef: normalized.nextReviewRef,
    escalationRef: normalized.escalationRef,
    signatureAlgorithm: normalized.signatureAlgorithm,
  });
}

function resolveTrustedAuthority({ registry, expectedRegistryHashSha256, payload, p44 }) {
  const expected = requiredSha256(expectedRegistryHashSha256, 'expectedCloseoutAuthorityRegistryHashSha256');
  if (registry.registryHashSha256 !== expected) throw new TypeError('CLOSEOUT_AUTHORITY_REGISTRY_HASH_MISMATCH');
  const authority = registry.authorities.find((record) => record.authorityId === payload.authorityId);
  if (!authority) throw new TypeError('CLOSEOUT_AUTHORITY_NOT_IN_TRUSTED_REGISTRY');
  if (authority.actorRef !== payload.actorRef) throw new TypeError('CLOSEOUT_AUTHORITY_ACTOR_SCOPE_MISMATCH');
  if (authority.allowedPurpose !== PURPOSE) throw new TypeError('CLOSEOUT_AUTHORITY_PURPOSE_NOT_ALLOWED');
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) throw new TypeError('CLOSEOUT_AUTHORITY_OUTSIDE_ACTIVE_PERIOD');
  if (payload.incidentCloseoutPacketHashSha256 !== p44.incidentCloseoutPacketHashSha256) throw new TypeError('CLOSEOUT_PACKET_BINDING_MISMATCH');
  return authority;
}

function prepareHumanIncidentCloseoutAttestation(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`], input.p44 || null);
  const { p44, closeoutAuthorityRegistry, expectedCloseoutAuthorityRegistryHashSha256, decision } = input;
  const p44Blockers = validateP44CloseoutReady(p44);
  if (p44Blockers.length) return hold(p44Blockers, p44);
  let registry;
  let payload;
  let authority;
  try {
    registry = normalizeCloseoutAuthorityRegistry(closeoutAuthorityRegistry);
    payload = createSigningPayload({ p44, decision });
    authority = resolveTrustedAuthority({ registry, expectedRegistryHashSha256: expectedCloseoutAuthorityRegistryHashSha256, payload, p44 });
  } catch (error) {
    return hold([error.message], p44, registry?.registryHashSha256 || null);
  }
  const signingBytes = stableStringify(payload);
  const normalizedDecision = normalizeDecision(decision);
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_INCIDENT_CLOSEOUT_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    incidentId: payload.incidentId,
    incidentRef: payload.incidentRef,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    closeoutAuthorityRegistryHashSha256: registry.registryHashSha256,
    authorityId: authority.authorityId,
    actorRef: authority.actorRef,
    publicKeySha256: authority.publicKeySha256,
    signingPayload: payload,
    signingPayloadHashSha256: sha256Text(signingBytes),
    signingBytesBase64: Buffer.from(signingBytes, 'utf8').toString('base64'),
    attestationWithoutSignature: normalizedDecision,
    signatureRequired: true,
    signatureAlgorithm: 'RSA-SHA256',
    externalSigningRequired: true,
    repositorySigningPerformed: false,
    privateSigningKeyAccepted: false,
    incidentClosed: false,
    humanIncidentCloseoutVerified: false,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    releaseStillBlocked: true,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: 'P45 prepares exact signing bytes for a human incident-closeout decision bound to P44. Signing remains external; preparation does not close the incident, permit reactivation, or grant release, merge, deployment, go-live or transaction authority.',
  });
}

function verifyHumanIncidentCloseoutAttestation(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold([`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`], input.p44 || null);
  const { p44, closeoutAuthorityRegistry, expectedCloseoutAuthorityRegistryHashSha256, attestation } = input;
  const p44Blockers = validateP44CloseoutReady(p44);
  if (p44Blockers.length) return hold(p44Blockers, p44);
  let registry;
  let normalized;
  let payload;
  let authority;
  try {
    registry = normalizeCloseoutAuthorityRegistry(closeoutAuthorityRegistry);
    normalized = normalizeDecision(attestation, { requireSignature: true });
    payload = createSigningPayload({ p44, decision: normalized });
    authority = resolveTrustedAuthority({ registry, expectedRegistryHashSha256: expectedCloseoutAuthorityRegistryHashSha256, payload, p44 });
  } catch (error) {
    return hold([error.message], p44, registry?.registryHashSha256 || null);
  }
  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      authority.publicKeyPem,
      Buffer.from(normalized.signatureBase64, 'base64'),
    );
  } catch (_) {
    signatureVerified = false;
  }
  if (!signatureVerified) return hold(['INCIDENT_CLOSEOUT_SIGNATURE_INVALID'], p44, registry.registryHashSha256);

  const core = {
    schemaVersion: 1,
    incidentId: payload.incidentId,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    closeoutAuthorityRegistryHashSha256: registry.registryHashSha256,
    authorityId: authority.authorityId,
    actorRef: payload.actorRef,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decidedAt: payload.decidedAt,
    signedPayloadHashSha256: sha256Object(payload),
  };
  const closed = payload.decision === DECISION.CLOSE_INCIDENT;
  const escalated = payload.decision === DECISION.ESCALATE_INCIDENT;
  return deepFreeze({
    ...core,
    status: closed
      ? STATUS.INCIDENT_CLOSED_REACTIVATION_REQUIRES_NEW_GOVERNANCE_CYCLE
      : STATUS.INCIDENT_REMAINS_OPEN_BY_HUMAN_DECISION,
    verified: true,
    blockers: Object.freeze([]),
    incidentCloseoutVerificationHashSha256: sha256Object(core),
    signatureVerified: true,
    trustRootVerified: true,
    humanIncidentCloseoutVerified: true,
    incidentClosed: closed,
    incidentRemainsOpen: !closed,
    escalationRequired: escalated,
    automaticIncidentCloseoutPerformed: false,
    reactivationAllowed: false,
    reactivationRequiresNewGovernanceCycle: true,
    failedActivationAuthorityCannotBeReusedForReactivation: true,
    releaseStillBlocked: true,
    existingReleaseGovernanceStillRequired: true,
    privateSigningKeyAccepted: false,
    productionEvidenceEstablishedHere: false,
    ...AUTHORITY,
    semantics: closed
      ? 'A trusted external human signature closes the rollback incident record only. It does not reactivate the failed composite baseline or grant release, merge, deployment, go-live or transaction authority; any future activation requires a new governance cycle.'
      : 'The trusted external human decision keeps or escalates the incident. Release and reactivation remain blocked and all authority flags remain false.',
  });
}

module.exports = {
  STATUS,
  DECISION,
  PURPOSE,
  normalizeCloseoutAuthorityRegistry,
  validateP44CloseoutReady,
  createSigningPayload,
  prepareHumanIncidentCloseoutAttestation,
  verifyHumanIncidentCloseoutAttestation,
  findForbiddenKeyMaterial,
};
