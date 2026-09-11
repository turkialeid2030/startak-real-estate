'use strict';

const crypto = require('crypto');
const { sha256 } = require('./standards-registry');
const {
  E2H_STATUS,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
} = require('./execution-attestation-post-deployment-closeout');

const E2I_STATUS = Object.freeze({
  HOLD_E2H_CLOSEOUT_PACKET: 'HOLD_E2H_CLOSEOUT_PACKET',
  HOLD_READINESS_TRUST_ROOT: 'HOLD_READINESS_TRUST_ROOT',
  HOLD_READINESS_EVIDENCE_INTEGRITY: 'HOLD_READINESS_EVIDENCE_INTEGRITY',
  HOLD_READINESS_REJECTED: 'HOLD_READINESS_REJECTED',
  WAITING_FOR_PRODUCTION_READINESS_EVIDENCE: 'WAITING_FOR_PRODUCTION_READINESS_EVIDENCE',
  GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT: 'GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT',
});

const EVIDENCE_TYPE = Object.freeze({
  CANONICAL_SOURCE_HASH_COMPARISON: 'CANONICAL_SOURCE_HASH_COMPARISON',
  SAUDI_LEGAL_OPERATING_MODE_REVIEW: 'SAUDI_LEGAL_OPERATING_MODE_REVIEW',
  PDPL_DATA_GOVERNANCE_REVIEW: 'PDPL_DATA_GOVERNANCE_REVIEW',
  PROFESSIONAL_STANDARDS_SCOPE_REVIEW: 'PROFESSIONAL_STANDARDS_SCOPE_REVIEW',
  PRODUCTION_EXECUTION_CHAIN_CONFIRMATION: 'PRODUCTION_EXECUTION_CHAIN_CONFIRMATION',
  OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION: 'OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION',
});

const EVIDENCE_RESULT = Object.freeze({
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}

function digest(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function commitSha(value, field) {
  assertNonEmpty(value, field);
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return value.toLowerCase();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new TypeError('policy must be an object');
  assertNonEmpty(policy.policyId, 'policy.policyId');
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2I_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredUpstreamStatus !== E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE) throw new TypeError('E2I_REQUIRED_UPSTREAM_STATUS_INVALID');
  if (policy.readinessVerifierRegistryRequired !== true) throw new TypeError('E2I_READINESS_VERIFIER_REGISTRY_REQUIRED');
  if (policy.readinessVerifierRegistryHashPinnedOutOfBandRequired !== true) throw new TypeError('E2I_OUT_OF_BAND_READINESS_TRUST_ROOT_REQUIRED');
  if (policy.allRequiredEvidenceMustBeVerifiedForGoLive !== true) throw new TypeError('E2I_ALL_REQUIRED_EVIDENCE_MUST_BE_VERIFIED');
  if (policy.sameVerifierMayVerifyAllEvidenceTypes !== false) throw new TypeError('E2I_SINGLE_VERIFIER_FOR_ALL_EVIDENCE_PROHIBITED');
  if (policy.architecturalStop !== true) throw new TypeError('E2I_MUST_BE_ARCHITECTURAL_STOP');
  for (const field of [
    'callerDeclaredReadinessAccepted',
    'automaticGoLiveApprovalAllowed',
    'automaticProfessionalAuthorityPromotionAllowed',
    'automaticRuleActivationAllowed',
  ]) {
    if (policy[field] !== false) throw new TypeError(`E2I_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  if (!Array.isArray(policy.requiredUpstreamFlags) || policy.requiredUpstreamFlags.length === 0) throw new TypeError('policy.requiredUpstreamFlags must be non-empty');
  if (!Array.isArray(policy.requiredEvidenceTypes) || policy.requiredEvidenceTypes.length === 0) throw new TypeError('policy.requiredEvidenceTypes must be non-empty');
  for (const type of Object.values(EVIDENCE_TYPE)) {
    if (!policy.requiredEvidenceTypes.includes(type)) throw new TypeError(`E2I_REQUIRED_EVIDENCE_TYPE_MISSING:${type}`);
  }
  if (!Array.isArray(policy.allowedEvidenceResults) || policy.allowedEvidenceResults.length === 0) throw new TypeError('policy.allowedEvidenceResults must be non-empty');
  for (const result of Object.values(EVIDENCE_RESULT)) {
    if (!policy.allowedEvidenceResults.includes(result)) throw new TypeError(`E2I_ALLOWED_EVIDENCE_RESULT_MISSING:${result}`);
  }
  if (!Array.isArray(policy.signatureAlgorithmsAllowed) || !policy.signatureAlgorithmsAllowed.includes('RSA-SHA256')) throw new TypeError('E2I_RSA_SHA256_MUST_BE_ALLOWED');
  return true;
}

function normalizeReadinessVerifierRegistry(registry) {
  if (!registry || typeof registry !== 'object') throw new TypeError('readinessVerifierRegistry must be an object');
  assertNonEmpty(registry.registryId, 'readinessVerifierRegistry.registryId');
  assertNonEmpty(registry.governanceArtifactSha256, 'readinessVerifierRegistry.governanceArtifactSha256');
  if (!Array.isArray(registry.verifiers) || registry.verifiers.length === 0) throw new TypeError('readinessVerifierRegistry.verifiers must be non-empty');
  const seen = new Set();
  const verifiers = registry.verifiers.map((record) => {
    for (const field of ['verifierId', 'verifierSubjectRef', 'publicKeyPem', 'publicKeySha256', 'governanceEvidenceRef', 'activeFrom']) {
      assertNonEmpty(record[field], `readinessVerifier.${field}`);
    }
    if (seen.has(record.verifierId)) throw new TypeError(`DUPLICATE_READINESS_VERIFIER_ID:${record.verifierId}`);
    seen.add(record.verifierId);
    if (!Array.isArray(record.allowedEvidenceTypes) || record.allowedEvidenceTypes.length === 0) throw new TypeError(`READINESS_VERIFIER_EVIDENCE_TYPES_REQUIRED:${record.verifierId}`);
    for (const type of record.allowedEvidenceTypes) {
      if (!Object.values(EVIDENCE_TYPE).includes(type)) throw new TypeError(`READINESS_VERIFIER_EVIDENCE_TYPE_INVALID:${record.verifierId}:${type}`);
    }
    const publicKeySha256 = digest(record.publicKeySha256, 'readinessVerifier.publicKeySha256');
    if (sha256(record.publicKeyPem.trim()) !== publicKeySha256) throw new TypeError(`READINESS_VERIFIER_PUBLIC_KEY_HASH_MISMATCH:${record.verifierId}`);
    return deepFreeze({
      verifierId: record.verifierId.trim(),
      verifierSubjectRef: record.verifierSubjectRef.trim(),
      allowedEvidenceTypes: Object.freeze([...record.allowedEvidenceTypes]),
      publicKeyPem: record.publicKeyPem.trim(),
      publicKeySha256,
      governanceEvidenceRef: record.governanceEvidenceRef.trim(),
      activeFrom: iso(record.activeFrom, 'readinessVerifier.activeFrom'),
      activeUntil: nonEmpty(record.activeUntil) ? iso(record.activeUntil, 'readinessVerifier.activeUntil') : null,
    });
  });
  const core = {
    registryId: registry.registryId.trim(),
    governanceArtifactSha256: digest(registry.governanceArtifactSha256, 'readinessVerifierRegistry.governanceArtifactSha256'),
    verifiers,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256(core) });
}

function createReadinessEvidenceSigningPayload(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('readiness evidence record must be an object');
  for (const field of [
    'evidenceId', 'evidenceType', 'upstreamCloseoutPacketHashSha256', 'releaseCandidateId', 'sourceCommitSha',
    'artifactSha256', 'environmentRef', 'environmentConfigSha256', 'verifierId', 'sourceRef',
    'evidenceArtifactSha256', 'verifiedAt', 'result', 'scopeRef', 'signatureAlgorithm',
  ]) assertNonEmpty(record[field], `readinessEvidence.${field}`);
  if (!policy.requiredEvidenceTypes.includes(record.evidenceType)) throw new TypeError(`READINESS_EVIDENCE_TYPE_NOT_ALLOWED:${record.evidenceType}`);
  if (!policy.allowedEvidenceResults.includes(record.result)) throw new TypeError(`READINESS_EVIDENCE_RESULT_NOT_ALLOWED:${record.result}`);
  if (!policy.signatureAlgorithmsAllowed.includes(record.signatureAlgorithm)) throw new TypeError(`READINESS_EVIDENCE_SIGNATURE_ALGORITHM_NOT_ALLOWED:${record.signatureAlgorithm}`);
  return deepFreeze({
    evidenceId: record.evidenceId.trim(),
    evidenceType: record.evidenceType,
    upstreamCloseoutPacketHashSha256: digest(record.upstreamCloseoutPacketHashSha256, 'readinessEvidence.upstreamCloseoutPacketHashSha256'),
    releaseCandidateId: record.releaseCandidateId.trim(),
    sourceCommitSha: commitSha(record.sourceCommitSha, 'readinessEvidence.sourceCommitSha'),
    artifactSha256: digest(record.artifactSha256, 'readinessEvidence.artifactSha256'),
    environmentRef: record.environmentRef.trim(),
    environmentConfigSha256: digest(record.environmentConfigSha256, 'readinessEvidence.environmentConfigSha256'),
    verifierId: record.verifierId.trim(),
    sourceRef: record.sourceRef.trim(),
    evidenceArtifactSha256: digest(record.evidenceArtifactSha256, 'readinessEvidence.evidenceArtifactSha256'),
    verifiedAt: iso(record.verifiedAt, 'readinessEvidence.verifiedAt'),
    expiresAt: nonEmpty(record.expiresAt) ? iso(record.expiresAt, 'readinessEvidence.expiresAt') : null,
    result: record.result,
    scopeRef: record.scopeRef.trim(),
    signatureAlgorithm: record.signatureAlgorithm,
  });
}

function normalizeReadinessEvidence(record, policy) {
  const payload = createReadinessEvidenceSigningPayload(record, policy);
  assertNonEmpty(record.signatureBase64, 'readinessEvidence.signatureBase64');
  const signature = Buffer.from(record.signatureBase64, 'base64');
  if (!signature.length) throw new TypeError(`READINESS_EVIDENCE_SIGNATURE_BASE64_INVALID:${payload.evidenceId}`);
  return deepFreeze({
    ...payload,
    signatureBase64: record.signatureBase64.trim(),
    evidencePayloadHashSha256: sha256(payload),
  });
}

function verifyReadinessEvidenceSignature(record, verifier, policy) {
  if (record.signatureAlgorithm !== 'RSA-SHA256') return false;
  try {
    const payload = createReadinessEvidenceSigningPayload(record, policy);
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      verifier.publicKeyPem,
      Buffer.from(record.signatureBase64, 'base64'),
    );
  } catch (error) {
    return false;
  }
}

function authorityBoundary() {
  return deepFreeze({
    formalStandardsConformanceEstablished: false,
    standardsOrRulesActivated: false,
    saudiProfessionalLicensingEstablished: false,
    certifiedValuationAuthorityEstablished: false,
    externalProfessionalValuationIssuanceAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, readinessPacketId, upstream, policy, blockers, preparedByRef, preparedAtIso, registryHash = null) {
  return deepFreeze({
    schemaVersion: 1,
    readinessPacketId,
    upstreamCloseoutPacketId: upstream?.closeoutPacketId || null,
    upstreamCloseoutPacketHashSha256: upstream?.closeoutPacketHashSha256 || null,
    policyId: policy?.policyId || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    readinessVerifierRegistryHashSha256: registryHash,
    status,
    blockers: Object.freeze([...blockers]),
    readinessEvidence: Object.freeze([]),
    missingEvidenceTypes: Object.freeze([...(policy?.requiredEvidenceTypes || [])]),
    preparedByRef,
    preparedAt: preparedAtIso,
    readinessPacketHashSha256: null,
    goLiveReady: false,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    ...authorityBoundary(),
  });
}

function createProductionEvidenceGoLiveReadinessPacket({
  readinessPacketId,
  upstreamCloseoutPacket,
  policy,
  readinessVerifierRegistry,
  expectedReadinessVerifierRegistryHashSha256,
  readinessEvidence = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(readinessPacketId, 'readinessPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  const upstreamQualified = upstreamCloseoutPacket?.status === E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE
    && verifyExecutionPostDeploymentCloseoutPacketIntegrity(upstreamCloseoutPacket)
    && policy.requiredUpstreamFlags.every((field) => upstreamCloseoutPacket[field] === true);
  if (!upstreamQualified) {
    return hold(E2I_STATUS.HOLD_E2H_CLOSEOUT_PACKET, readinessPacketId.trim(), upstreamCloseoutPacket, policy, ['E2H_EXECUTION_CLOSEOUT_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }

  let registry;
  let expectedHash;
  try {
    registry = normalizeReadinessVerifierRegistry(readinessVerifierRegistry);
    expectedHash = digest(expectedReadinessVerifierRegistryHashSha256, 'expectedReadinessVerifierRegistryHashSha256');
  } catch (error) {
    return hold(E2I_STATUS.HOLD_READINESS_TRUST_ROOT, readinessPacketId.trim(), upstreamCloseoutPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return hold(E2I_STATUS.HOLD_READINESS_TRUST_ROOT, readinessPacketId.trim(), upstreamCloseoutPacket, policy, ['READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  if (!Array.isArray(readinessEvidence)) throw new TypeError('readinessEvidence must be an array');
  let normalized;
  try {
    normalized = readinessEvidence.map((record) => normalizeReadinessEvidence(record, policy));
  } catch (error) {
    return hold(E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY, readinessPacketId.trim(), upstreamCloseoutPacket, policy, [error.message], preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const blockers = [];
  const seenIds = new Set();
  const seenTypes = new Set();
  const verifierById = new Map(registry.verifiers.map((record) => [record.verifierId, record]));
  const release = upstreamCloseoutPacket.releaseCandidate;

  for (const evidence of normalized) {
    if (seenIds.has(evidence.evidenceId)) blockers.push(`DUPLICATE_READINESS_EVIDENCE_ID:${evidence.evidenceId}`);
    seenIds.add(evidence.evidenceId);
    if (seenTypes.has(evidence.evidenceType)) blockers.push(`DUPLICATE_READINESS_EVIDENCE_TYPE:${evidence.evidenceType}`);
    seenTypes.add(evidence.evidenceType);

    const verifier = verifierById.get(evidence.verifierId);
    if (!verifier) {
      blockers.push(`READINESS_VERIFIER_NOT_TRUSTED:${evidence.evidenceId}:${evidence.verifierId}`);
      continue;
    }
    if (!verifier.allowedEvidenceTypes.includes(evidence.evidenceType)) blockers.push(`READINESS_VERIFIER_TYPE_NOT_ALLOWED:${evidence.evidenceId}:${evidence.verifierId}:${evidence.evidenceType}`);
    if (Date.parse(evidence.verifiedAt) < Date.parse(verifier.activeFrom) || (verifier.activeUntil && Date.parse(evidence.verifiedAt) > Date.parse(verifier.activeUntil))) blockers.push(`READINESS_VERIFIER_OUTSIDE_ACTIVE_PERIOD:${evidence.evidenceId}`);
    if (Date.parse(evidence.verifiedAt) < Date.parse(upstreamCloseoutPacket.preparedAt)) blockers.push(`READINESS_EVIDENCE_BEFORE_E2H_CLOSEOUT:${evidence.evidenceId}`);
    if (Date.parse(evidence.verifiedAt) > Date.parse(preparedAtIso)) blockers.push(`READINESS_EVIDENCE_AFTER_PACKET_PREPARATION:${evidence.evidenceId}`);
    if (evidence.expiresAt && Date.parse(evidence.expiresAt) < Date.parse(evidence.verifiedAt)) blockers.push(`READINESS_EVIDENCE_EXPIRY_BEFORE_VERIFICATION:${evidence.evidenceId}`);
    if (evidence.expiresAt && Date.parse(evidence.expiresAt) < Date.parse(preparedAtIso)) blockers.push(`READINESS_EVIDENCE_EXPIRED_AT_PACKET_PREPARATION:${evidence.evidenceId}`);

    if (evidence.upstreamCloseoutPacketHashSha256 !== upstreamCloseoutPacket.closeoutPacketHashSha256) blockers.push(`READINESS_UPSTREAM_CLOSEOUT_HASH_MISMATCH:${evidence.evidenceId}`);
    if (evidence.releaseCandidateId !== release.releaseCandidateId) blockers.push(`READINESS_RELEASE_CANDIDATE_MISMATCH:${evidence.evidenceId}`);
    if (evidence.sourceCommitSha !== release.sourceCommitSha) blockers.push(`READINESS_SOURCE_COMMIT_MISMATCH:${evidence.evidenceId}`);
    if (evidence.artifactSha256 !== release.artifactSha256) blockers.push(`READINESS_ARTIFACT_HASH_MISMATCH:${evidence.evidenceId}`);
    if (evidence.environmentRef !== release.environmentRef) blockers.push(`READINESS_ENVIRONMENT_MISMATCH:${evidence.evidenceId}`);
    if (evidence.environmentConfigSha256 !== release.environmentConfigSha256) blockers.push(`READINESS_ENV_CONFIG_HASH_MISMATCH:${evidence.evidenceId}`);
    if (!verifyReadinessEvidenceSignature(evidence, verifier, policy)) blockers.push(`READINESS_EVIDENCE_SIGNATURE_INVALID:${evidence.evidenceId}`);
  }

  const completeCoverage = policy.requiredEvidenceTypes.every((type) => normalized.some((record) => record.evidenceType === type));
  if (completeCoverage && normalized.length) {
    const verifierSubjects = new Set(normalized.map((record) => verifierById.get(record.verifierId)?.verifierSubjectRef).filter(Boolean));
    if (verifierSubjects.size < 2) blockers.push('SINGLE_VERIFIER_SUBJECT_FOR_ALL_READINESS_EVIDENCE_PROHIBITED');
  }

  if (blockers.length) {
    return hold(E2I_STATUS.HOLD_READINESS_EVIDENCE_INTEGRITY, readinessPacketId.trim(), upstreamCloseoutPacket, policy, blockers, preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const rejected = normalized.filter((record) => record.result === EVIDENCE_RESULT.REJECTED);
  if (rejected.length) {
    return hold(E2I_STATUS.HOLD_READINESS_REJECTED, readinessPacketId.trim(), upstreamCloseoutPacket, policy, rejected.map((record) => `PRODUCTION_READINESS_EVIDENCE_REJECTED:${record.evidenceType}:${record.evidenceId}`), preparedByRef.trim(), preparedAtIso, registry.registryHashSha256);
  }

  const verifiedTypes = new Set(normalized.filter((record) => record.result === EVIDENCE_RESULT.VERIFIED).map((record) => record.evidenceType));
  const missingEvidenceTypes = policy.requiredEvidenceTypes.filter((type) => !verifiedTypes.has(type));
  const goLiveReady = missingEvidenceTypes.length === 0;
  const status = goLiveReady
    ? E2I_STATUS.GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT
    : E2I_STATUS.WAITING_FOR_PRODUCTION_READINESS_EVIDENCE;

  const core = {
    schemaVersion: 1,
    readinessPacketId: readinessPacketId.trim(),
    upstreamCloseoutPacketId: upstreamCloseoutPacket.closeoutPacketId,
    upstreamCloseoutPacketHashSha256: upstreamCloseoutPacket.closeoutPacketHashSha256,
    policyId: policy.policyId,
    releaseCandidate: release,
    readinessVerifierRegistryId: registry.registryId,
    readinessVerifierRegistryHashSha256: registry.registryHashSha256,
    readinessEvidence: normalized,
    missingEvidenceTypes: Object.freeze([...missingEvidenceTypes]),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    readinessPacketHashSha256: sha256(core),
    goLiveReady,
    goLiveOperatingMode: 'UNLICENSED_DECISION_SUPPORT',
    noFurtherInternalGateCanSubstituteForExternalEvidence: true,
    architecturalStop: true,
    ...authorityBoundary(),
    semantics: 'E2I is the final internal engineering readiness aggregator. GO_LIVE_READY is limited to UNLICENSED_DECISION_SUPPORT and requires independently signed production evidence. Internal tests cannot satisfy real external evidence requirements. No further internal engineering gate can substitute for missing legal, professional, privacy, canonical-source, release-authority or production-execution evidence. Successful readiness does not establish certified valuation authority, professional external issuance or transaction authority.',
  });
}

function verifyProductionEvidenceGoLiveReadinessPacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.readinessPacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    readinessPacketId: packet.readinessPacketId,
    upstreamCloseoutPacketId: packet.upstreamCloseoutPacketId,
    upstreamCloseoutPacketHashSha256: packet.upstreamCloseoutPacketHashSha256,
    policyId: packet.policyId,
    releaseCandidate: packet.releaseCandidate,
    readinessVerifierRegistryId: packet.readinessVerifierRegistryId,
    readinessVerifierRegistryHashSha256: packet.readinessVerifierRegistryHashSha256,
    readinessEvidence: packet.readinessEvidence,
    missingEvidenceTypes: packet.missingEvidenceTypes,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.readinessPacketHashSha256.toLowerCase();
}

module.exports = {
  E2I_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  validatePolicy,
  normalizeReadinessVerifierRegistry,
  createReadinessEvidenceSigningPayload,
  normalizeReadinessEvidence,
  verifyReadinessEvidenceSignature,
  createProductionEvidenceGoLiveReadinessPacket,
  verifyProductionEvidenceGoLiveReadinessPacketIntegrity,
};
