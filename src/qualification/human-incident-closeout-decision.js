'use strict';

const crypto = require('crypto');
const {
  STATUS: P44_STATUS,
} = require('./post-rollback-canonical-baseline-verification');
const {
  stableStringify,
} = require('./canonical-baseline-registry');

const PURPOSE = 'INCIDENT_CLOSEOUT_DECISION';

const DECISION = Object.freeze({
  CLOSE_INCIDENT: 'CLOSE_INCIDENT',
  KEEP_INCIDENT_OPEN: 'KEEP_INCIDENT_OPEN',
});

const STATUS = Object.freeze({
  HOLD_P44_CLOSEOUT_PACKET: 'HOLD_P44_CLOSEOUT_PACKET',
  HOLD_INCIDENT_CLOSEOUT_TRUST_ROOT: 'HOLD_INCIDENT_CLOSEOUT_TRUST_ROOT',
  HOLD_INCIDENT_CLOSEOUT_ATTESTATION: 'HOLD_INCIDENT_CLOSEOUT_ATTESTATION',
  READY_FOR_EXTERNAL_INCIDENT_AUTHORITY_SIGNATURE: 'READY_FOR_EXTERNAL_INCIDENT_AUTHORITY_SIGNATURE',
  INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED: 'INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED',
  INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED: 'INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
});

const REUSE_BOUNDARY = Object.freeze({
  reactivationAllowed: false,
  previousActivationAuthorizationReusable: false,
  previousReviewerApprovalReusable: false,
  newGovernanceCycleRequired: true,
  newActivationPlanRequired: true,
  newOwnerAuthorizationRequired: true,
  newIndependentReviewRequired: true,
  failedActivationCycleReusable: false,
  historicalActivationCycleOnly: true,
  releaseStillBlocked: true,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;

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

function hold(status, blockers, extra = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    incidentClosed: false,
    humanIncidentCloseoutDecisionVerified: false,
    automaticIncidentCloseoutPerformed: false,
    incidentAuthorityIdentityCryptographicallyVerified: false,
    incidentAuthorityTrustRootVerified: false,
    incidentCloseoutSignatureVerified: false,
    externalIncidentArtifactContentVerifiedHere: false,
    ...REUSE_BOUNDARY,
    ...AUTHORITY,
    ...extra,
  });
}

function p44PacketCore(packet) {
  return {
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
}

function validateP44CloseoutReady(p44) {
  const blockers = [];
  if (!p44 || p44.status !== P44_STATUS.POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY) {
    return ['P44_INCIDENT_CLOSEOUT_READY_RESULT_REQUIRED'];
  }
  if (
    p44.verified !== true
    || p44.postRollbackVerificationPassed !== true
    || p44.restoredExactP39LegacyRegistry !== true
    || p44.incidentCloseoutReady !== true
    || p44.incidentClosed !== false
    || p44.humanIncidentCloseoutRequired !== true
    || p44.automaticIncidentCloseoutPerformed !== false
    || p44.reactivationAllowed !== false
    || p44.reactivationRequiresNewGovernanceCycle !== true
    || p44.releaseStillBlocked !== true
    || !allAuthorityFalse(p44)
  ) blockers.push('P44_CLOSEOUT_BOUNDARY_INVALID');

  const packet = p44.incidentCloseoutPacket;
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return [...blockers, 'P44_INCIDENT_CLOSEOUT_PACKET_REQUIRED'];
  if (
    packet.incidentCloseoutReady !== true
    || packet.incidentClosed !== false
    || packet.humanIncidentCloseoutRequired !== true
    || packet.automaticIncidentCloseoutPerformed !== false
    || packet.reactivationAllowed !== false
    || packet.reactivationRequiresNewGovernanceCycle !== true
    || packet.releaseStillBlocked !== true
    || packet.restoredExactP39LegacyRegistry !== true
    || packet.postRollbackReleaseVerifyEvidenceConsistent !== true
    || !allAuthorityFalse(packet)
  ) blockers.push('P44_PACKET_BOUNDARY_INVALID');

  let packetHash;
  try {
    packetHash = requiredSha256(packet.incidentCloseoutPacketHashSha256, 'incidentCloseoutPacketHashSha256');
    requiredString(packet.incidentId, 'incidentId');
    requiredString(packet.incidentRef, 'incidentRef');
    requiredString(packet.closeoutPreparedByRef, 'closeoutPreparedByRef');
    iso(packet.closeoutPreparedAt, 'closeoutPreparedAt');
    requiredSha256(packet.activationChangeContractHashSha256, 'activationChangeContractHashSha256');
    requiredSha256(packet.activationExecutionReceiptHashSha256, 'activationExecutionReceiptHashSha256');
    requiredSha256(packet.rollbackTriggerHashSha256, 'rollbackTriggerHashSha256');
    requiredSha256(packet.rollbackExecutionReceiptHashSha256, 'rollbackExecutionReceiptHashSha256');
    requiredSha256(packet.restoredLegacyRegistryHashSha256, 'restoredLegacyRegistryHashSha256');
    requiredSha256(packet.postRollbackReleaseVerifyEvidenceHashSha256, 'postRollbackReleaseVerifyEvidenceHashSha256');
    requiredString(packet.postRollbackReleaseVerifyRunId, 'postRollbackReleaseVerifyRunId');
    if (!COMMIT_RE.test(requiredString(packet.postRollbackReleaseVerifySourceCommitSha, 'postRollbackReleaseVerifySourceCommitSha'))) {
      blockers.push('P44_POST_ROLLBACK_SOURCE_COMMIT_INVALID');
    }
    iso(packet.postRollbackReleaseVerifyCompletedAt, 'postRollbackReleaseVerifyCompletedAt');
  } catch (error) {
    blockers.push(error.message);
    return blockers;
  }

  const computed = sha256Object(p44PacketCore(packet));
  if (computed !== packetHash) blockers.push('P44_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH');
  if (p44.incidentCloseoutPacketHashSha256 !== packetHash) blockers.push('P44_RESULT_PACKET_HASH_MISMATCH');
  if (p44.postRollbackVerificationHashSha256 !== packetHash) blockers.push('P44_POST_ROLLBACK_VERIFICATION_HASH_MISMATCH');
  return blockers;
}

function normalizeIncidentAuthorityRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('incidentAuthorityRegistry must be an object');
  if (!Array.isArray(registry.authorities) || registry.authorities.length === 0) throw new TypeError('incidentAuthorityRegistry.authorities must be non-empty');
  const seen = new Set();
  const authorities = registry.authorities.map((record) => {
    const incidentAuthorityId = requiredString(record.incidentAuthorityId, 'authority.incidentAuthorityId');
    if (seen.has(incidentAuthorityId)) throw new TypeError(`DUPLICATE_INCIDENT_AUTHORITY_ID:${incidentAuthorityId}`);
    seen.add(incidentAuthorityId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'authority.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'authority.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`INCIDENT_AUTHORITY_PUBLIC_KEY_HASH_MISMATCH:${incidentAuthorityId}`);
    return deepFreeze({
      incidentAuthorityId,
      actorRef: requiredString(record.actorRef, 'authority.actorRef'),
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: requiredString(record.governanceEvidenceRef, 'authority.governanceEvidenceRef'),
      activeFrom: iso(record.activeFrom, 'authority.activeFrom'),
      activeUntil: record.activeUntil ? iso(record.activeUntil, 'authority.activeUntil') : null,
      allowedPurpose: requiredString(record.allowedPurpose, 'authority.allowedPurpose'),
    });
  });
  const core = {
    registryId: requiredString(registry.registryId, 'incidentAuthorityRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'incidentAuthorityRegistry.governanceArtifactSha256'),
    authorities,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256Object(core) });
}

function normalizeDecisionInput({ p44, decision } = {}) {
  const packet = p44.incidentCloseoutPacket;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw new TypeError('decision must be an object');
  const result = requiredString(decision.decision, 'decision.decision');
  if (!Object.values(DECISION).includes(result)) throw new TypeError('decision.decision invalid');

  const decidedAt = iso(decision.decidedAt, 'decision.decidedAt');
  if (Date.parse(decidedAt) < Date.parse(packet.closeoutPreparedAt)) throw new TypeError('INCIDENT_CLOSEOUT_DECISION_PRECEDES_P44_PREPARATION');

  const actorRef = requiredString(decision.actorRef, 'decision.actorRef');
  if (actorRef === packet.closeoutPreparedByRef) throw new TypeError('CLOSEOUT_PREPARER_AND_APPROVING_ACTOR_MUST_DIFFER');

  let rootCauseAnalysisRef = null;
  let rootCauseAnalysisSha256 = null;
  let correctivePreventiveActionRef = null;
  let correctivePreventiveActionSha256 = null;
  if (result === DECISION.CLOSE_INCIDENT) {
    rootCauseAnalysisRef = requiredString(decision.rootCauseAnalysisRef, 'decision.rootCauseAnalysisRef');
    rootCauseAnalysisSha256 = requiredSha256(decision.rootCauseAnalysisSha256, 'decision.rootCauseAnalysisSha256');
    correctivePreventiveActionRef = requiredString(decision.correctivePreventiveActionRef, 'decision.correctivePreventiveActionRef');
    correctivePreventiveActionSha256 = requiredSha256(decision.correctivePreventiveActionSha256, 'decision.correctivePreventiveActionSha256');
  } else {
    if (decision.rootCauseAnalysisRef != null) rootCauseAnalysisRef = requiredString(decision.rootCauseAnalysisRef, 'decision.rootCauseAnalysisRef');
    if (decision.rootCauseAnalysisSha256 != null) rootCauseAnalysisSha256 = requiredSha256(decision.rootCauseAnalysisSha256, 'decision.rootCauseAnalysisSha256');
    if (decision.correctivePreventiveActionRef != null) correctivePreventiveActionRef = requiredString(decision.correctivePreventiveActionRef, 'decision.correctivePreventiveActionRef');
    if (decision.correctivePreventiveActionSha256 != null) correctivePreventiveActionSha256 = requiredSha256(decision.correctivePreventiveActionSha256, 'decision.correctivePreventiveActionSha256');
  }

  const signatureAlgorithm = requiredString(decision.signatureAlgorithm, 'decision.signatureAlgorithm');
  if (signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('INCIDENT_CLOSEOUT_SIGNATURE_ALGORITHM_INVALID');

  return deepFreeze({
    decisionId: requiredString(decision.decisionId, 'decision.decisionId'),
    incidentAuthorityId: requiredString(decision.incidentAuthorityId, 'decision.incidentAuthorityId'),
    actorRef,
    decision: result,
    decisionSourceRef: requiredString(decision.decisionSourceRef, 'decision.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(decision.decisionArtifactSha256, 'decision.decisionArtifactSha256'),
    decidedAt,
    rationaleRef: requiredString(decision.rationaleRef, 'decision.rationaleRef'),
    rootCauseAnalysisRef,
    rootCauseAnalysisSha256,
    correctivePreventiveActionRef,
    correctivePreventiveActionSha256,
    signatureAlgorithm,
  });
}

function createIncidentCloseoutSigningPayload({ p44, decision } = {}) {
  const p44Blockers = validateP44CloseoutReady(p44);
  if (p44Blockers.length > 0) throw new TypeError(p44Blockers[0]);
  const normalized = normalizeDecisionInput({ p44, decision });
  const packet = p44.incidentCloseoutPacket;
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
    postRollbackReleaseVerifyRunId: packet.postRollbackReleaseVerifyRunId,
    postRollbackReleaseVerifySourceCommitSha: packet.postRollbackReleaseVerifySourceCommitSha,
    decisionId: normalized.decisionId,
    incidentAuthorityId: normalized.incidentAuthorityId,
    actorRef: normalized.actorRef,
    decision: normalized.decision,
    decisionSourceRef: normalized.decisionSourceRef,
    decisionArtifactSha256: normalized.decisionArtifactSha256,
    decidedAt: normalized.decidedAt,
    rationaleRef: normalized.rationaleRef,
    rootCauseAnalysisRef: normalized.rootCauseAnalysisRef,
    rootCauseAnalysisSha256: normalized.rootCauseAnalysisSha256,
    correctivePreventiveActionRef: normalized.correctivePreventiveActionRef,
    correctivePreventiveActionSha256: normalized.correctivePreventiveActionSha256,
    signatureAlgorithm: normalized.signatureAlgorithm,
  });
}

function validateRegistryAndDecision({ p44, incidentAuthorityRegistry, expectedIncidentAuthorityRegistryHashSha256, decision } = {}) {
  const p44Blockers = validateP44CloseoutReady(p44);
  if (p44Blockers.length > 0) return { error: hold(STATUS.HOLD_P44_CLOSEOUT_PACKET, p44Blockers) };

  let registry;
  let expectedHash;
  try {
    registry = normalizeIncidentAuthorityRegistry(incidentAuthorityRegistry);
    expectedHash = requiredSha256(expectedIncidentAuthorityRegistryHashSha256, 'expectedIncidentAuthorityRegistryHashSha256');
  } catch (error) {
    return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_TRUST_ROOT, [error.message], { incidentCloseoutPacketHashSha256: p44.incidentCloseoutPacketHashSha256 }) };
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_TRUST_ROOT, ['INCIDENT_AUTHORITY_REGISTRY_HASH_MISMATCH'], { incidentCloseoutPacketHashSha256: p44.incidentCloseoutPacketHashSha256, incidentAuthorityRegistryHashSha256: registry.registryHashSha256 }) };
  }

  let payload;
  try {
    payload = createIncidentCloseoutSigningPayload({ p44, decision });
  } catch (error) {
    return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, [error.message], { incidentCloseoutPacketHashSha256: p44.incidentCloseoutPacketHashSha256, incidentAuthorityRegistryHashSha256: registry.registryHashSha256 }) };
  }

  const authority = registry.authorities.find((record) => record.incidentAuthorityId === payload.incidentAuthorityId);
  if (!authority) return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_AUTHORITY_NOT_IN_TRUSTED_REGISTRY']) };
  if (authority.actorRef !== payload.actorRef) return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_AUTHORITY_ACTOR_SCOPE_MISMATCH']) };
  if (authority.allowedPurpose !== PURPOSE) return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_AUTHORITY_PURPOSE_NOT_ALLOWED']) };
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) {
    return { error: hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_AUTHORITY_OUTSIDE_ACTIVE_PERIOD']) };
  }
  return { registry, authority, payload };
}

function prepareHumanIncidentCloseoutDecision(input = {}) {
  if (Object.keys(input).some((key) => /private[-_]?key/i.test(key))) {
    return hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  }
  const validated = validateRegistryAndDecision(input);
  if (validated.error) return validated.error;
  const { registry, authority, payload } = validated;
  const attestationWithoutSignature = deepFreeze({
    decisionId: payload.decisionId,
    incidentAuthorityId: payload.incidentAuthorityId,
    actorRef: payload.actorRef,
    decision: payload.decision,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
    rootCauseAnalysisRef: payload.rootCauseAnalysisRef,
    rootCauseAnalysisSha256: payload.rootCauseAnalysisSha256,
    correctivePreventiveActionRef: payload.correctivePreventiveActionRef,
    correctivePreventiveActionSha256: payload.correctivePreventiveActionSha256,
    signatureAlgorithm: payload.signatureAlgorithm,
  });
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_INCIDENT_AUTHORITY_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    incidentId: payload.incidentId,
    incidentRef: payload.incidentRef,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    incidentAuthorityRegistryHashSha256: registry.registryHashSha256,
    incidentAuthorityId: authority.incidentAuthorityId,
    incidentAuthorityActorRef: authority.actorRef,
    incidentAuthorityPublicKeySha256: authority.publicKeySha256,
    signingPayload: payload,
    signingPayloadHashSha256: sha256Object(payload),
    signingBytesBase64: Buffer.from(stableStringify(payload), 'utf8').toString('base64'),
    attestationWithoutSignature,
    privateSigningKeyAccepted: false,
    externalSignatureRequired: true,
    incidentClosed: false,
    humanIncidentCloseoutDecisionVerified: false,
    automaticIncidentCloseoutPerformed: false,
    incidentAuthorityIdentityCryptographicallyVerified: false,
    incidentAuthorityTrustRootVerified: true,
    incidentCloseoutSignatureVerified: false,
    externalIncidentArtifactContentVerifiedHere: false,
    ...REUSE_BOUNDARY,
    ...AUTHORITY,
  });
}

function verifyHumanIncidentCloseoutDecision(input = {}) {
  if (Object.keys(input).some((key) => /private[-_]?key/i.test(key))) {
    return hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['PRIVATE_SIGNING_KEY_INPUT_REJECTED']);
  }
  const validated = validateRegistryAndDecision({ ...input, decision: input.attestation });
  if (validated.error) return validated.error;
  const { registry, authority, payload } = validated;
  const signatureBase64 = typeof input.attestation?.signatureBase64 === 'string' ? input.attestation.signatureBase64.trim() : '';
  if (!signatureBase64) return hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_CLOSEOUT_SIGNATURE_REQUIRED']);

  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      authority.publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch (_) {
    signatureVerified = false;
  }
  if (!signatureVerified) return hold(STATUS.HOLD_INCIDENT_CLOSEOUT_ATTESTATION, ['INCIDENT_CLOSEOUT_SIGNATURE_INVALID']);

  const packet = input.p44.incidentCloseoutPacket;
  const decisionRecordCore = {
    schemaVersion: 1,
    purpose: PURPOSE,
    incidentId: payload.incidentId,
    incidentRef: payload.incidentRef,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    incidentAuthorityRegistryHashSha256: registry.registryHashSha256,
    incidentAuthorityId: authority.incidentAuthorityId,
    incidentAuthorityActorRef: authority.actorRef,
    incidentAuthorityPublicKeySha256: authority.publicKeySha256,
    decisionId: payload.decisionId,
    decision: payload.decision,
    decidedAt: payload.decidedAt,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    rationaleRef: payload.rationaleRef,
    rootCauseAnalysisRef: payload.rootCauseAnalysisRef,
    rootCauseAnalysisSha256: payload.rootCauseAnalysisSha256,
    correctivePreventiveActionRef: payload.correctivePreventiveActionRef,
    correctivePreventiveActionSha256: payload.correctivePreventiveActionSha256,
    signingPayloadHashSha256: sha256Object(payload),
  };
  const humanDecisionRecord = deepFreeze({
    ...decisionRecordCore,
    humanDecisionRecordHashSha256: sha256Object(decisionRecordCore),
    signatureAlgorithm: 'RSA-SHA256',
    incidentAuthorityIdentityCryptographicallyVerified: true,
    incidentAuthorityTrustRootVerified: true,
    incidentCloseoutSignatureVerified: true,
  });

  const closed = payload.decision === DECISION.CLOSE_INCIDENT;
  const closureCore = {
    schemaVersion: 1,
    incidentId: payload.incidentId,
    incidentRef: payload.incidentRef,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    humanDecisionRecordHashSha256: humanDecisionRecord.humanDecisionRecordHashSha256,
    historicalActivationChangeContractHashSha256: packet.activationChangeContractHashSha256,
    historicalActivationExecutionReceiptHashSha256: packet.activationExecutionReceiptHashSha256,
    historicalRollbackTriggerHashSha256: packet.rollbackTriggerHashSha256,
    historicalRollbackExecutionReceiptHashSha256: packet.rollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: packet.restoredLegacyRegistryHashSha256,
    decision: payload.decision,
    incidentClosed: closed,
  };
  const governanceResetRecord = deepFreeze({
    ...closureCore,
    governanceResetRecordHashSha256: sha256Object(closureCore),
    previousActivationCycleHistoricalOnly: true,
    previousActivationAuthorizationReusable: false,
    previousReviewerApprovalReusable: false,
    failedActivationCycleReusable: false,
    reactivationAllowed: false,
    newGovernanceCycleRequired: true,
    newActivationPlanRequired: true,
    newOwnerAuthorizationRequired: true,
    newIndependentReviewRequired: true,
    releaseStillBlocked: true,
    ...AUTHORITY,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: closed
      ? STATUS.INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_REACTIVATION_BLOCKED
      : STATUS.INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED,
    verified: true,
    blockers: Object.freeze([]),
    incidentId: payload.incidentId,
    incidentRef: payload.incidentRef,
    incidentCloseoutPacketHashSha256: payload.incidentCloseoutPacketHashSha256,
    incidentAuthorityRegistryHashSha256: registry.registryHashSha256,
    humanDecisionRecord,
    humanDecisionRecordHashSha256: humanDecisionRecord.humanDecisionRecordHashSha256,
    governanceResetRecord,
    governanceResetRecordHashSha256: governanceResetRecord.governanceResetRecordHashSha256,
    incidentClosed: closed,
    humanIncidentCloseoutDecisionVerified: true,
    automaticIncidentCloseoutPerformed: false,
    incidentAuthorityIdentityCryptographicallyVerified: true,
    incidentAuthorityTrustRootVerified: true,
    incidentCloseoutSignatureVerified: true,
    externalIncidentArtifactContentVerifiedHere: false,
    ...REUSE_BOUNDARY,
    ...AUTHORITY,
    semantics: closed
      ? 'A trusted human incident authority cryptographically closed the exact P44 incident packet. The failed activation cycle is historical only; release remains blocked and any reactivation requires a completely new governance cycle.'
      : 'A trusted human incident authority cryptographically decided to keep the exact P44 incident open. Release and reactivation remain blocked and the failed activation cycle cannot be reused.',
  });
}

module.exports = {
  PURPOSE,
  DECISION,
  STATUS,
  AUTHORITY,
  REUSE_BOUNDARY,
  validateP44CloseoutReady,
  normalizeIncidentAuthorityRegistry,
  createIncidentCloseoutSigningPayload,
  prepareHumanIncidentCloseoutDecision,
  verifyHumanIncidentCloseoutDecision,
};
