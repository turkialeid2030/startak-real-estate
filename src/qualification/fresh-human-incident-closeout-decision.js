'use strict';

const crypto = require('crypto');
const { AUTHORITY, stableStringify } = require('./canonical-baseline-registry');
const { STATUS: P62_STATUS } = require('./fresh-post-rollback-verification-incident-closeout');

const PURPOSE = 'FRESH_INCIDENT_CLOSEOUT_DECISION';
const DECISION = Object.freeze({ CLOSE_INCIDENT: 'CLOSE_INCIDENT', KEEP_INCIDENT_OPEN: 'KEEP_INCIDENT_OPEN' });
const STATUS = Object.freeze({
  HOLD_P62_FRESH_CLOSEOUT_PACKET: 'HOLD_P62_FRESH_CLOSEOUT_PACKET',
  HOLD_FRESH_INCIDENT_CLOSEOUT_TRUST_ROOT: 'HOLD_FRESH_INCIDENT_CLOSEOUT_TRUST_ROOT',
  HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION: 'HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION',
  READY_FOR_EXTERNAL_FRESH_INCIDENT_AUTHORITY_SIGNATURE: 'READY_FOR_EXTERNAL_FRESH_INCIDENT_AUTHORITY_SIGNATURE',
  FRESH_INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED: 'FRESH_INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED',
  FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED: 'FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED',
});
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const REUSE_BOUNDARY = Object.freeze({
  reactivationAllowed: false,
  failedFreshActivationCycleReusable: false,
  previousFreshOwnerAuthorizationReusable: false,
  previousFreshReviewerApprovalReusable: false,
  previousFreshActivationPlanReusable: false,
  previousFreshActivationContractReusable: false,
  previousFreshRollbackTriggerReusable: false,
  historicalFreshActivationCycleOnly: true,
  newGovernanceCycleRequired: true,
  newIndependentReviewRequired: true,
  newActivationPlanRequired: true,
  newOwnerAuthorizationRequired: true,
  releaseStillBlocked: true,
});

function requiredString(value, field) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`); return value.trim(); }
function requiredSha256(value, field) { const normalized = requiredString(value, field).toLowerCase(); if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`); return normalized; }
function requiredCommit(value, field) { const normalized = requiredString(value, field).toLowerCase(); if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character Git commit SHA`); return normalized; }
function iso(value, field) { const raw = requiredString(value, field); const parsed = new Date(raw); if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`); return parsed.toISOString(); }
function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function sha256Object(value) { return sha256Text(stableStringify(value)); }
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(deepFreeze); return Object.freeze(value); }
function allAuthorityFalse(value) { return Boolean(value && typeof value === 'object' && Object.keys(AUTHORITY).every((field) => value[field] === false)); }
function findForbiddenKeyMaterial(value, path = '$', seen = new Set()) { if (!value || typeof value !== 'object') return null; if (seen.has(value)) return null; seen.add(value); for (const [key, child] of Object.entries(value)) { if (/private[-_]?key/i.test(key) || /secret[-_]?key/i.test(key)) return `${path}.${key}`; const nested = findForbiddenKeyMaterial(child, `${path}.${key}`, seen); if (nested) return nested; } return null; }
function callerAuthorityEscalated(value) { if (!value || typeof value !== 'object') return false; return Object.keys(AUTHORITY).some((key) => value[key] != null && value[key] !== false) || (value.reactivationAllowed != null && value.reactivationAllowed !== false) || (value.failedFreshActivationCycleReusable != null && value.failedFreshActivationCycleReusable !== false) || (value.releaseStillBlocked != null && value.releaseStillBlocked !== true); }
function hold(status, blockers, extra = {}) { return deepFreeze({ schemaVersion: 1, status, verified: false, blockers: Object.freeze([...new Set(blockers)]), incidentClosed: false, humanIncidentCloseoutDecisionVerified: false, automaticIncidentCloseoutPerformed: false, incidentAuthorityIdentityCryptographicallyVerified: false, incidentAuthorityTrustRootVerified: false, incidentCloseoutSignatureVerified: false, governanceResetReady: false, externalIncidentArtifactContentVerifiedHere: false, productionEvidenceEstablishedHere: false, ...REUSE_BOUNDARY, ...AUTHORITY, ...extra }); }

function p62PacketCore(packet) {
  return {
    schemaVersion: packet.schemaVersion,
    incidentId: packet.incidentId,
    incidentRef: packet.incidentRef,
    closeoutPreparedByRef: packet.closeoutPreparedByRef,
    closeoutPreparedAt: packet.closeoutPreparedAt,
    cycleId: packet.cycleId,
    freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256,
    freshActivationChangeContractHashSha256: packet.freshActivationChangeContractHashSha256,
    activationExecutionReceiptHashSha256: packet.activationExecutionReceiptHashSha256,
    rollbackTriggerHashSha256: packet.rollbackTriggerHashSha256,
    rollbackExecutionReceiptHashSha256: packet.rollbackExecutionReceiptHashSha256,
    restoredLegacyRegistryHashSha256: packet.restoredLegacyRegistryHashSha256,
    restoredLegacyRegistryContentSha256: packet.restoredLegacyRegistryContentSha256,
    postRollbackReleaseVerifyEvidenceHashSha256: packet.postRollbackReleaseVerifyEvidenceHashSha256,
    postRollbackReleaseVerifyRunId: packet.postRollbackReleaseVerifyRunId,
    postRollbackReleaseVerifySourceCommitSha: packet.postRollbackReleaseVerifySourceCommitSha,
    postRollbackReleaseVerifyCompletedAt: packet.postRollbackReleaseVerifyCompletedAt,
    rollbackReasonCodes: Array.isArray(packet.rollbackReasonCodes) ? [...packet.rollbackReasonCodes] : [],
  };
}

function validateP62CloseoutReady(p62) {
  const blockers = [];
  if (!p62 || p62.status !== P62_STATUS.FRESH_POST_ROLLBACK_RELEASE_VERIFY_EVIDENCE_CONSISTENT_INCIDENT_CLOSEOUT_READY) return ['P62_FRESH_INCIDENT_CLOSEOUT_READY_RESULT_REQUIRED'];
  if (p62.verified !== true || p62.postRollbackVerificationPassed !== true || p62.restoredExactP57LegacyRegistry !== true || p62.rollbackTriggerVerified !== true || p62.rollbackExecutionVerified !== true || p62.postRollbackReleaseVerifyEvidenceConsistent !== true || p62.incidentCloseoutReady !== true || p62.incidentClosed !== false || p62.humanIncidentCloseoutRequired !== true || p62.automaticIncidentCloseoutPerformed !== false || p62.failedFreshActivationCycleReusable !== false || p62.reactivationAllowed !== false || p62.reactivationRequiresNewGovernanceCycle !== true || p62.releaseStillBlocked !== true || !allAuthorityFalse(p62)) blockers.push('P62_FRESH_CLOSEOUT_BOUNDARY_INVALID');
  const packet = p62.incidentCloseoutPacket;
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return [...blockers, 'P62_FRESH_INCIDENT_CLOSEOUT_PACKET_REQUIRED'];
  if (packet.restoredExactP57LegacyRegistry !== true || packet.postRollbackReleaseVerifyEvidenceConsistent !== true || packet.incidentCloseoutReady !== true || packet.incidentClosed !== false || packet.humanIncidentCloseoutRequired !== true || packet.automaticIncidentCloseoutPerformed !== false || packet.failedFreshActivationCycleReusable !== false || packet.reactivationAllowed !== false || packet.reactivationRequiresNewGovernanceCycle !== true || packet.releaseStillBlocked !== true || !allAuthorityFalse(packet)) blockers.push('P62_FRESH_CLOSEOUT_PACKET_BOUNDARY_INVALID');
  try {
    requiredString(packet.incidentId, 'packet.incidentId'); requiredString(packet.incidentRef, 'packet.incidentRef'); requiredString(packet.closeoutPreparedByRef, 'packet.closeoutPreparedByRef'); iso(packet.closeoutPreparedAt, 'packet.closeoutPreparedAt'); requiredString(packet.cycleId, 'packet.cycleId'); requiredSha256(packet.freshReactivationGovernanceCycleHashSha256, 'packet.freshReactivationGovernanceCycleHashSha256'); requiredSha256(packet.freshActivationChangeContractHashSha256, 'packet.freshActivationChangeContractHashSha256'); requiredSha256(packet.activationExecutionReceiptHashSha256, 'packet.activationExecutionReceiptHashSha256'); requiredSha256(packet.rollbackTriggerHashSha256, 'packet.rollbackTriggerHashSha256'); requiredSha256(packet.rollbackExecutionReceiptHashSha256, 'packet.rollbackExecutionReceiptHashSha256'); requiredSha256(packet.restoredLegacyRegistryHashSha256, 'packet.restoredLegacyRegistryHashSha256'); requiredSha256(packet.restoredLegacyRegistryContentSha256, 'packet.restoredLegacyRegistryContentSha256'); requiredSha256(packet.postRollbackReleaseVerifyEvidenceHashSha256, 'packet.postRollbackReleaseVerifyEvidenceHashSha256'); requiredString(packet.postRollbackReleaseVerifyRunId, 'packet.postRollbackReleaseVerifyRunId'); requiredCommit(packet.postRollbackReleaseVerifySourceCommitSha, 'packet.postRollbackReleaseVerifySourceCommitSha'); iso(packet.postRollbackReleaseVerifyCompletedAt, 'packet.postRollbackReleaseVerifyCompletedAt');
    if (!Array.isArray(packet.rollbackReasonCodes) || packet.rollbackReasonCodes.length === 0) blockers.push('P62_ROLLBACK_REASON_CODES_REQUIRED');
    const packetHash = requiredSha256(packet.incidentCloseoutPacketHashSha256, 'packet.incidentCloseoutPacketHashSha256');
    if (sha256Object(p62PacketCore(packet)) !== packetHash) blockers.push('P62_FRESH_INCIDENT_CLOSEOUT_PACKET_HASH_MISMATCH');
    if (p62.incidentCloseoutPacketHashSha256 !== packetHash) blockers.push('P62_RESULT_PACKET_HASH_MISMATCH');
    if (p62.postRollbackVerificationHashSha256 !== packetHash) blockers.push('P62_POST_ROLLBACK_VERIFICATION_HASH_MISMATCH');
  } catch (error) { blockers.push(error.message); }
  return blockers;
}

function normalizeFreshIncidentAuthorityRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('incidentAuthorityRegistry must be an object');
  if (registry.schemaVersion !== 1) throw new TypeError('incidentAuthorityRegistry.schemaVersion must equal 1');
  if (!Array.isArray(registry.authorities) || registry.authorities.length === 0) throw new TypeError('incidentAuthorityRegistry.authorities must be non-empty');
  const seen = new Set();
  const authorities = registry.authorities.map((record) => {
    const incidentAuthorityId = requiredString(record.incidentAuthorityId, 'authority.incidentAuthorityId');
    if (seen.has(incidentAuthorityId)) throw new TypeError(`DUPLICATE_INCIDENT_AUTHORITY_ID:${incidentAuthorityId}`);
    seen.add(incidentAuthorityId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'authority.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'authority.publicKeySha256');
    if (sha256Text(publicKeyPem) !== publicKeySha256) throw new TypeError(`INCIDENT_AUTHORITY_PUBLIC_KEY_HASH_MISMATCH:${incidentAuthorityId}`);
    if (findForbiddenKeyMaterial(record)) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:authority:${incidentAuthorityId}`);
    return deepFreeze({ incidentAuthorityId, actorRef: requiredString(record.actorRef, 'authority.actorRef'), publicKeyPem, publicKeySha256, governanceEvidenceRef: requiredString(record.governanceEvidenceRef, 'authority.governanceEvidenceRef'), activeFrom: iso(record.activeFrom, 'authority.activeFrom'), activeUntil: record.activeUntil ? iso(record.activeUntil, 'authority.activeUntil') : null, allowedPurpose: requiredString(record.allowedPurpose, 'authority.allowedPurpose') });
  });
  const core = { schemaVersion: 1, registryId: requiredString(registry.registryId, 'incidentAuthorityRegistry.registryId'), governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'incidentAuthorityRegistry.governanceArtifactSha256'), authorities };
  return deepFreeze({ ...core, incidentAuthorityRegistryHashSha256: sha256Object(core) });
}

function normalizeFreshIncidentDecisionInput({ p62, decision } = {}) {
  const packet = p62.incidentCloseoutPacket;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw new TypeError('decision must be an object');
  const forbidden = findForbiddenKeyMaterial(decision); if (forbidden) throw new TypeError(`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`); if (callerAuthorityEscalated(decision)) throw new TypeError('CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED');
  if (decision.incidentId != null && requiredString(decision.incidentId, 'decision.incidentId') !== packet.incidentId) throw new TypeError('INCIDENT_ID_MISMATCH');
  if (decision.incidentRef != null && requiredString(decision.incidentRef, 'decision.incidentRef') !== packet.incidentRef) throw new TypeError('INCIDENT_REF_MISMATCH');
  if (decision.cycleId != null && requiredString(decision.cycleId, 'decision.cycleId') !== packet.cycleId) throw new TypeError('FRESH_CYCLE_ID_MISMATCH');
  if (decision.incidentCloseoutPacketHashSha256 != null && requiredSha256(decision.incidentCloseoutPacketHashSha256, 'decision.incidentCloseoutPacketHashSha256') !== packet.incidentCloseoutPacketHashSha256) throw new TypeError('INCIDENT_CLOSEOUT_PACKET_SCOPE_MISMATCH');
  const result = requiredString(decision.decision, 'decision.decision'); if (!Object.values(DECISION).includes(result)) throw new TypeError('decision.decision invalid');
  const decidedAt = iso(decision.decidedAt, 'decision.decidedAt'); if (Date.parse(decidedAt) < Date.parse(packet.closeoutPreparedAt)) throw new TypeError('FRESH_INCIDENT_CLOSEOUT_DECISION_PRECEDES_P62_PREPARATION');
  const actorRef = requiredString(decision.actorRef, 'decision.actorRef'); if (actorRef === packet.closeoutPreparedByRef) throw new TypeError('CLOSEOUT_PREPARER_AND_APPROVING_ACTOR_MUST_DIFFER');
  let rootCauseAnalysisRef = null; let rootCauseAnalysisSha256 = null; let correctivePreventiveActionRef = null; let correctivePreventiveActionSha256 = null;
  if (result === DECISION.CLOSE_INCIDENT) { rootCauseAnalysisRef = requiredString(decision.rootCauseAnalysisRef, 'decision.rootCauseAnalysisRef'); rootCauseAnalysisSha256 = requiredSha256(decision.rootCauseAnalysisSha256, 'decision.rootCauseAnalysisSha256'); correctivePreventiveActionRef = requiredString(decision.correctivePreventiveActionRef, 'decision.correctivePreventiveActionRef'); correctivePreventiveActionSha256 = requiredSha256(decision.correctivePreventiveActionSha256, 'decision.correctivePreventiveActionSha256'); }
  const signatureAlgorithm = requiredString(decision.signatureAlgorithm, 'decision.signatureAlgorithm'); if (signatureAlgorithm !== 'RSA-SHA256') throw new TypeError('FRESH_INCIDENT_CLOSEOUT_SIGNATURE_ALGORITHM_INVALID');
  return deepFreeze({ incidentId: packet.incidentId, incidentRef: packet.incidentRef, cycleId: packet.cycleId, incidentCloseoutPacketHashSha256: packet.incidentCloseoutPacketHashSha256, decisionId: requiredString(decision.decisionId, 'decision.decisionId'), incidentAuthorityId: requiredString(decision.incidentAuthorityId, 'decision.incidentAuthorityId'), actorRef, decision: result, decisionSourceRef: requiredString(decision.decisionSourceRef, 'decision.decisionSourceRef'), decisionArtifactSha256: requiredSha256(decision.decisionArtifactSha256, 'decision.decisionArtifactSha256'), decidedAt, rationaleRef: requiredString(decision.rationaleRef, 'decision.rationaleRef'), rootCauseAnalysisRef, rootCauseAnalysisSha256, correctivePreventiveActionRef, correctivePreventiveActionSha256, signatureAlgorithm });
}

function createFreshIncidentCloseoutSigningPayload({ p62, decision } = {}) {
  const blockers = validateP62CloseoutReady(p62); if (blockers.length > 0) throw new TypeError(blockers[0]);
  const normalized = normalizeFreshIncidentDecisionInput({ p62, decision }); const packet = p62.incidentCloseoutPacket;
  return deepFreeze({ schemaVersion: 1, purpose: PURPOSE, incidentId: normalized.incidentId, incidentRef: normalized.incidentRef, cycleId: normalized.cycleId, incidentCloseoutPacketHashSha256: normalized.incidentCloseoutPacketHashSha256, postRollbackVerificationHashSha256: p62.postRollbackVerificationHashSha256, freshReactivationGovernanceCycleHashSha256: packet.freshReactivationGovernanceCycleHashSha256, freshActivationChangeContractHashSha256: packet.freshActivationChangeContractHashSha256, activationExecutionReceiptHashSha256: packet.activationExecutionReceiptHashSha256, rollbackTriggerHashSha256: packet.rollbackTriggerHashSha256, rollbackExecutionReceiptHashSha256: packet.rollbackExecutionReceiptHashSha256, restoredLegacyRegistryHashSha256: packet.restoredLegacyRegistryHashSha256, restoredLegacyRegistryContentSha256: packet.restoredLegacyRegistryContentSha256, postRollbackReleaseVerifyEvidenceHashSha256: packet.postRollbackReleaseVerifyEvidenceHashSha256, decision: normalized });
}

function prepareFreshIncidentCloseoutSigningPackage({ p62, decision } = {}) {
  try { const payload = createFreshIncidentCloseoutSigningPayload({ p62, decision }); const signingBytes = stableStringify(payload); return deepFreeze({ schemaVersion: 1, status: STATUS.READY_FOR_EXTERNAL_FRESH_INCIDENT_AUTHORITY_SIGNATURE, verified: true, blockers: Object.freeze([]), purpose: PURPOSE, signingPayload: payload, signingPayloadSha256: sha256Text(signingBytes), signingBytes, signatureAlgorithm: 'RSA-SHA256', incidentClosed: false, humanIncidentCloseoutDecisionVerified: false, externalSignatureRequired: true, privateSigningKeyAccepted: false, governanceResetReady: false, ...REUSE_BOUNDARY, ...AUTHORITY }); } catch (error) { return hold(STATUS.HOLD_P62_FRESH_CLOSEOUT_PACKET, [error.message]); }
}

function verifyFreshHumanIncidentCloseoutDecision({ p62, incidentAuthorityRegistry, expectedIncidentAuthorityRegistryHashSha256, signedDecision, ...callerOverrides } = {}) {
  const forbidden = findForbiddenKeyMaterial({ p62, incidentAuthorityRegistry, signedDecision, callerOverrides }); if (forbidden) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, [`PRIVATE_OR_SECRET_KEY_MATERIAL_REJECTED:${forbidden}`]); if (callerAuthorityEscalated(callerOverrides)) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, ['CALLER_AUTHORITY_ESCALATION_NOT_ALLOWED']);
  const packetBlockers = validateP62CloseoutReady(p62); if (packetBlockers.length > 0) return hold(STATUS.HOLD_P62_FRESH_CLOSEOUT_PACKET, packetBlockers);
  let registry; let expectedRegistryHash; try { registry = normalizeFreshIncidentAuthorityRegistry(incidentAuthorityRegistry); expectedRegistryHash = requiredSha256(expectedIncidentAuthorityRegistryHashSha256, 'expectedIncidentAuthorityRegistryHashSha256'); } catch (error) { return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_TRUST_ROOT, [error.message]); }
  if (registry.incidentAuthorityRegistryHashSha256 !== expectedRegistryHash) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_TRUST_ROOT, ['FRESH_INCIDENT_AUTHORITY_REGISTRY_HASH_MISMATCH']);
  let normalizedDecision; let payload; let signatureBase64; try { normalizedDecision = normalizeFreshIncidentDecisionInput({ p62, decision: signedDecision }); payload = createFreshIncidentCloseoutSigningPayload({ p62, decision: signedDecision }); signatureBase64 = requiredString(signedDecision.signatureBase64, 'signedDecision.signatureBase64'); } catch (error) { return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, [error.message], { incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityTrustRootVerified: true }); }
  const authority = registry.authorities.find((entry) => entry.incidentAuthorityId === normalizedDecision.incidentAuthorityId); if (!authority) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, ['FRESH_INCIDENT_AUTHORITY_NOT_FOUND'], { incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityTrustRootVerified: true });
  const authorityBlockers = []; if (authority.actorRef !== normalizedDecision.actorRef) authorityBlockers.push('FRESH_INCIDENT_AUTHORITY_ACTOR_MISMATCH'); if (authority.allowedPurpose !== PURPOSE) authorityBlockers.push('FRESH_INCIDENT_AUTHORITY_PURPOSE_MISMATCH'); const decidedMs = Date.parse(normalizedDecision.decidedAt); if (decidedMs < Date.parse(authority.activeFrom)) authorityBlockers.push('FRESH_INCIDENT_AUTHORITY_NOT_ACTIVE_YET'); if (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil)) authorityBlockers.push('FRESH_INCIDENT_AUTHORITY_EXPIRED'); if (authorityBlockers.length > 0) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, authorityBlockers, { incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityTrustRootVerified: true });
  let signatureVerified = false; try { signatureVerified = crypto.verify('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), crypto.createPublicKey(authority.publicKeyPem), Buffer.from(signatureBase64, 'base64')); } catch (error) { return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, [`FRESH_INCIDENT_SIGNATURE_VERIFICATION_ERROR:${error.message}`], { incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityTrustRootVerified: true }); }
  if (!signatureVerified) return hold(STATUS.HOLD_FRESH_INCIDENT_CLOSEOUT_ATTESTATION, ['FRESH_INCIDENT_CLOSEOUT_SIGNATURE_INVALID'], { incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityTrustRootVerified: true });
  const verifiedDecisionCore = { schemaVersion: 1, purpose: PURPOSE, incidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256, postRollbackVerificationHashSha256: p62.postRollbackVerificationHashSha256, incidentAuthorityRegistryHashSha256: registry.incidentAuthorityRegistryHashSha256, incidentAuthorityId: normalizedDecision.incidentAuthorityId, actorRef: normalizedDecision.actorRef, decisionId: normalizedDecision.decisionId, decision: normalizedDecision.decision, decidedAt: normalizedDecision.decidedAt, decisionArtifactSha256: normalizedDecision.decisionArtifactSha256, signingPayloadSha256: sha256Text(stableStringify(payload)), signatureSha256: sha256Text(signatureBase64) };
  const verifiedFreshIncidentCloseoutDecisionRecordHashSha256 = sha256Object(verifiedDecisionCore);
  if (normalizedDecision.decision === DECISION.KEEP_INCIDENT_OPEN) return deepFreeze({ ...verifiedDecisionCore, status: STATUS.FRESH_INCIDENT_REMAINS_OPEN_HUMAN_DECISION_VERIFIED, verified: true, blockers: Object.freeze([]), verifiedFreshIncidentCloseoutDecisionRecordHashSha256, incidentClosed: false, humanIncidentCloseoutDecisionVerified: true, automaticIncidentCloseoutPerformed: false, incidentAuthorityIdentityCryptographicallyVerified: true, incidentAuthorityTrustRootVerified: true, incidentCloseoutSignatureVerified: true, governanceResetReady: false, externalIncidentArtifactContentVerifiedHere: false, productionEvidenceEstablishedHere: false, ...REUSE_BOUNDARY, ...AUTHORITY });
  const resetCore = { schemaVersion: 1, resetType: 'FAILED_FRESH_ACTIVATION_CYCLE_HISTORICAL_NON_REUSABLE', incidentId: p62.incidentCloseoutPacket.incidentId, incidentRef: p62.incidentCloseoutPacket.incidentRef, cycleId: p62.incidentCloseoutPacket.cycleId, freshReactivationGovernanceCycleHashSha256: p62.incidentCloseoutPacket.freshReactivationGovernanceCycleHashSha256, incidentCloseoutPacketHashSha256: p62.incidentCloseoutPacketHashSha256, verifiedFreshIncidentCloseoutDecisionRecordHashSha256, rootCauseAnalysisRef: normalizedDecision.rootCauseAnalysisRef, rootCauseAnalysisSha256: normalizedDecision.rootCauseAnalysisSha256, correctivePreventiveActionRef: normalizedDecision.correctivePreventiveActionRef, correctivePreventiveActionSha256: normalizedDecision.correctivePreventiveActionSha256, closedAt: normalizedDecision.decidedAt };
  const governanceResetRecord = deepFreeze({ ...resetCore, governanceResetRecordHashSha256: sha256Object(resetCore), failedFreshActivationCycleArchived: true, ...REUSE_BOUNDARY, ...AUTHORITY });
  return deepFreeze({ ...verifiedDecisionCore, status: STATUS.FRESH_INCIDENT_CLOSED_BY_VERIFIED_HUMAN_DECISION_GOVERNANCE_RESET_REACTIVATION_BLOCKED, verified: true, blockers: Object.freeze([]), verifiedFreshIncidentCloseoutDecisionRecordHashSha256, incidentClosed: true, humanIncidentCloseoutDecisionVerified: true, automaticIncidentCloseoutPerformed: false, incidentAuthorityIdentityCryptographicallyVerified: true, incidentAuthorityTrustRootVerified: true, incidentCloseoutSignatureVerified: true, governanceResetReady: true, governanceResetRecord, governanceResetRecordHashSha256: governanceResetRecord.governanceResetRecordHashSha256, rootCauseAnalysisRef: normalizedDecision.rootCauseAnalysisRef, rootCauseAnalysisSha256: normalizedDecision.rootCauseAnalysisSha256, correctivePreventiveActionRef: normalizedDecision.correctivePreventiveActionRef, correctivePreventiveActionSha256: normalizedDecision.correctivePreventiveActionSha256, externalIncidentArtifactContentVerifiedHere: false, productionEvidenceEstablishedHere: false, ...REUSE_BOUNDARY, ...AUTHORITY });
}

module.exports = { PURPOSE, DECISION, STATUS, REUSE_BOUNDARY, p62PacketCore, validateP62CloseoutReady, normalizeFreshIncidentAuthorityRegistry, normalizeFreshIncidentDecisionInput, createFreshIncidentCloseoutSigningPayload, prepareFreshIncidentCloseoutSigningPackage, verifyFreshHumanIncidentCloseoutDecision };
