'use strict';

const crypto = require('crypto');
const { sha256 } = require('./standards-registry');
const {
  E2E_STATUS,
  verifyRuleImplementationConformanceEvidencePacketIntegrity,
} = require('./rule-implementation-conformance-evidence');
const { normalizeTrustedVerifierRegistry } = require('./external-authority-validation');

const E2F_STATUS = Object.freeze({
  HOLD_E2E_EVIDENCE_PACKET: 'HOLD_E2E_EVIDENCE_PACKET',
  HOLD_TRUST_ROOT: 'HOLD_TRUST_ROOT',
  HOLD_VALIDATION_INTEGRITY: 'HOLD_VALIDATION_INTEGRITY',
  HOLD_EXTERNAL_VALIDATION_REJECTED: 'HOLD_EXTERNAL_VALIDATION_REJECTED',
  WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION: 'WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION',
  WAITING_FOR_PRODUCTION_SECURITY_VALIDATION: 'WAITING_FOR_PRODUCTION_SECURITY_VALIDATION',
  WAITING_FOR_PRODUCTION_PERFORMANCE_VALIDATION: 'WAITING_FOR_PRODUCTION_PERFORMANCE_VALIDATION',
  WAITING_FOR_PRODUCTION_RESILIENCE_VALIDATION: 'WAITING_FOR_PRODUCTION_RESILIENCE_VALIDATION',
  EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY: 'EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY',
});

const VALIDATION_TYPE = Object.freeze({
  EXTERNAL_CONFORMANCE_AUTHENTICITY: 'EXTERNAL_CONFORMANCE_AUTHENTICITY',
  PRODUCTION_SECURITY_VALIDATION: 'PRODUCTION_SECURITY_VALIDATION',
  PRODUCTION_PERFORMANCE_VALIDATION: 'PRODUCTION_PERFORMANCE_VALIDATION',
  PRODUCTION_RESILIENCE_VALIDATION: 'PRODUCTION_RESILIENCE_VALIDATION',
});

const VALIDATION_RESULT = Object.freeze({
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
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
  if (policy.operatingMode !== 'UNLICENSED_DECISION_SUPPORT') throw new TypeError('E2F_OPERATING_MODE_MUST_REMAIN_UNLICENSED_DECISION_SUPPORT');
  if (policy.requiredUpstreamStatus !== E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION) throw new TypeError('E2F_REQUIRED_UPSTREAM_STATUS_INVALID');
  if (policy.trustedVerifierRegistryRequired !== true) throw new TypeError('E2F_TRUSTED_VERIFIER_REGISTRY_REQUIRED');
  if (policy.trustedRegistryHashPinnedOutOfBandRequired !== true) throw new TypeError('E2F_OUT_OF_BAND_TRUST_ROOT_REQUIRED');
  for (const field of [
    'callerDeclaredValidationAccepted',
    'implementationActorMayValidate',
    'formalStandardsConformanceAutoEstablished',
    'automaticRuleActivationAllowed',
    'automaticReleaseAllowed',
    'automaticDeploymentAllowed',
  ]) {
    if (policy[field] !== false) throw new TypeError(`E2F_AUTHORITY_FLAG_MUST_REMAIN_FALSE:${field}`);
  }
  if (!Array.isArray(policy.requiredValidationTypes) || policy.requiredValidationTypes.length === 0) throw new TypeError('policy.requiredValidationTypes must be non-empty');
  for (const type of Object.values(VALIDATION_TYPE)) {
    if (!policy.requiredValidationTypes.includes(type)) throw new TypeError(`E2F_REQUIRED_VALIDATION_TYPE_MISSING:${type}`);
  }
  if (!Array.isArray(policy.allowedValidationResults) || policy.allowedValidationResults.length === 0) throw new TypeError('policy.allowedValidationResults must be non-empty');
  if (!Array.isArray(policy.signatureAlgorithmsAllowed) || !policy.signatureAlgorithmsAllowed.includes('RSA-SHA256')) throw new TypeError('E2F_RSA_SHA256_MUST_BE_ALLOWED');
  return true;
}

function normalizeReleaseCandidate(record, upstreamPacket) {
  if (!record || typeof record !== 'object') throw new TypeError('releaseCandidate must be an object');
  for (const field of ['releaseCandidateId', 'sourceCommitSha', 'artifactSha256', 'environmentRef', 'environmentConfigSha256', 'upstreamEvidencePacketHashSha256']) {
    assertNonEmpty(record[field], `releaseCandidate.${field}`);
  }
  const normalized = {
    releaseCandidateId: record.releaseCandidateId.trim(),
    sourceCommitSha: commitSha(record.sourceCommitSha, 'releaseCandidate.sourceCommitSha'),
    artifactSha256: digest(record.artifactSha256, 'releaseCandidate.artifactSha256'),
    environmentRef: record.environmentRef.trim(),
    environmentConfigSha256: digest(record.environmentConfigSha256, 'releaseCandidate.environmentConfigSha256'),
    upstreamEvidencePacketHashSha256: digest(record.upstreamEvidencePacketHashSha256, 'releaseCandidate.upstreamEvidencePacketHashSha256'),
  };
  if (upstreamPacket && normalized.upstreamEvidencePacketHashSha256 !== upstreamPacket.evidencePacketHashSha256) throw new TypeError('RELEASE_CANDIDATE_UPSTREAM_EVIDENCE_HASH_MISMATCH');
  return deepFreeze(normalized);
}

function createValidationSigningPayload(record, policy) {
  if (!record || typeof record !== 'object') throw new TypeError('validation record must be an object');
  for (const field of ['validationId', 'validationType', 'targetRef', 'subjectArtifactSha256', 'verifierId', 'verificationSourceRef', 'verificationArtifactSha256', 'verifiedAt', 'result', 'signatureAlgorithm']) {
    assertNonEmpty(record[field], `validation.${field}`);
  }
  if (!policy.requiredValidationTypes.includes(record.validationType)) throw new TypeError(`VALIDATION_TYPE_NOT_ALLOWED:${record.validationType}`);
  if (!policy.allowedValidationResults.includes(record.result)) throw new TypeError(`VALIDATION_RESULT_NOT_ALLOWED:${record.result}`);
  if (!policy.signatureAlgorithmsAllowed.includes(record.signatureAlgorithm)) throw new TypeError(`VALIDATION_SIGNATURE_ALGORITHM_NOT_ALLOWED:${record.signatureAlgorithm}`);
  return deepFreeze({
    validationId: record.validationId.trim(),
    validationType: record.validationType,
    targetRef: record.targetRef.trim(),
    subjectArtifactSha256: digest(record.subjectArtifactSha256, 'validation.subjectArtifactSha256'),
    environmentRef: nonEmpty(record.environmentRef) ? record.environmentRef.trim() : null,
    environmentConfigSha256: nonEmpty(record.environmentConfigSha256) ? digest(record.environmentConfigSha256, 'validation.environmentConfigSha256') : null,
    releaseCandidateCommitSha: nonEmpty(record.releaseCandidateCommitSha) ? commitSha(record.releaseCandidateCommitSha, 'validation.releaseCandidateCommitSha') : null,
    verifierId: record.verifierId.trim(),
    verificationSourceRef: record.verificationSourceRef.trim(),
    verificationArtifactSha256: digest(record.verificationArtifactSha256, 'validation.verificationArtifactSha256'),
    verifiedAt: iso(record.verifiedAt, 'validation.verifiedAt'),
    expiresAt: nonEmpty(record.expiresAt) ? iso(record.expiresAt, 'validation.expiresAt') : null,
    result: record.result,
    signatureAlgorithm: record.signatureAlgorithm,
  });
}

function normalizeValidation(record, policy) {
  const payload = createValidationSigningPayload(record, policy);
  assertNonEmpty(record.signatureBase64, 'validation.signatureBase64');
  let signature;
  try {
    signature = Buffer.from(record.signatureBase64, 'base64');
  } catch (error) {
    throw new TypeError(`VALIDATION_SIGNATURE_BASE64_INVALID:${payload.validationId}`);
  }
  if (!signature.length) throw new TypeError(`VALIDATION_SIGNATURE_BASE64_INVALID:${payload.validationId}`);
  return deepFreeze({
    ...payload,
    signatureBase64: record.signatureBase64.trim(),
    validationPayloadHashSha256: sha256(payload),
  });
}

function verifyValidationSignature(record, verifier, policy) {
  if (record.signatureAlgorithm !== 'RSA-SHA256') return false;
  try {
    const payload = createValidationSigningPayload(record, policy);
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
    externalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function hold(status, packetId, upstream, policy, blockers, preparedByRef, preparedAtIso, releaseCandidate = null, registryHash = null) {
  return deepFreeze({
    schemaVersion: 1,
    validationPacketId: packetId,
    upstreamEvidencePacketId: upstream?.evidencePacketId || null,
    upstreamEvidencePacketHashSha256: upstream?.evidencePacketHashSha256 || null,
    policyId: policy?.policyId || null,
    releaseCandidate,
    trustedVerifierRegistryHashSha256: registryHash,
    status,
    blockers: Object.freeze([...blockers]),
    validations: Object.freeze([]),
    preparedByRef,
    preparedAt: preparedAtIso,
    validationPacketHashSha256: null,
    externalConformanceEvidenceAuthenticityValidated: false,
    productionSecurityValidated: false,
    productionPerformanceValidated: false,
    productionResilienceValidated: false,
    productionValidationComplete: false,
    humanReleaseAuthorityRequired: true,
    ...authorityBoundary(),
  });
}

function isVerified(validations, type) {
  return validations.some((item) => item.validationType === type && item.result === VALIDATION_RESULT.VERIFIED);
}

function createExternalConformanceProductionValidationPacket({
  validationPacketId,
  upstreamEvidencePacket,
  policy,
  releaseCandidate,
  trustedVerifierRegistry,
  expectedTrustedRegistryHashSha256,
  validations = [],
  preparedByRef,
  preparedAt,
} = {}) {
  assertNonEmpty(validationPacketId, 'validationPacketId');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  validatePolicy(policy);

  if (upstreamEvidencePacket?.status !== E2E_STATUS.RULE_IMPLEMENTATION_EVIDENCE_READY_FOR_EXTERNAL_CONFORMANCE_VALIDATION || !verifyRuleImplementationConformanceEvidencePacketIntegrity(upstreamEvidencePacket)) {
    return hold(E2F_STATUS.HOLD_E2E_EVIDENCE_PACKET, validationPacketId.trim(), upstreamEvidencePacket, policy, ['E2E_IMPLEMENTATION_CONFORMANCE_EVIDENCE_NOT_QUALIFIED'], preparedByRef.trim(), preparedAtIso);
  }

  let normalizedRelease;
  try {
    normalizedRelease = normalizeReleaseCandidate(releaseCandidate, upstreamEvidencePacket);
  } catch (error) {
    return hold(E2F_STATUS.HOLD_VALIDATION_INTEGRITY, validationPacketId.trim(), upstreamEvidencePacket, policy, [error.message], preparedByRef.trim(), preparedAtIso);
  }

  let registry;
  let expectedHash;
  try {
    registry = normalizeTrustedVerifierRegistry(trustedVerifierRegistry);
    expectedHash = digest(expectedTrustedRegistryHashSha256, 'expectedTrustedRegistryHashSha256');
  } catch (error) {
    return hold(E2F_STATUS.HOLD_TRUST_ROOT, validationPacketId.trim(), upstreamEvidencePacket, policy, [error.message], preparedByRef.trim(), preparedAtIso, normalizedRelease);
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return hold(E2F_STATUS.HOLD_TRUST_ROOT, validationPacketId.trim(), upstreamEvidencePacket, policy, ['TRUSTED_VERIFIER_REGISTRY_HASH_MISMATCH'], preparedByRef.trim(), preparedAtIso, normalizedRelease, registry.registryHashSha256);
  }

  if (!Array.isArray(validations)) throw new TypeError('validations must be an array');
  let normalized;
  try {
    normalized = validations.map((record) => normalizeValidation(record, policy));
  } catch (error) {
    return hold(E2F_STATUS.HOLD_VALIDATION_INTEGRITY, validationPacketId.trim(), upstreamEvidencePacket, policy, [error.message], preparedByRef.trim(), preparedAtIso, normalizedRelease, registry.registryHashSha256);
  }

  const blockers = [];
  const seenIds = new Set();
  const seenTypes = new Set();
  const verifierById = new Map(registry.verifiers.map((record) => [record.verifierId, record]));
  const implementationActors = new Set((upstreamEvidencePacket.implementationEvidence || []).map((record) => record.implementedByRef));
  const conformanceActors = new Set((upstreamEvidencePacket.conformanceEvidence || []).map((record) => record.verifiedByRef));

  for (const validation of normalized) {
    if (seenIds.has(validation.validationId)) blockers.push(`DUPLICATE_VALIDATION_ID:${validation.validationId}`);
    seenIds.add(validation.validationId);
    if (seenTypes.has(validation.validationType)) blockers.push(`DUPLICATE_VALIDATION_TYPE:${validation.validationType}`);
    seenTypes.add(validation.validationType);

    const verifier = verifierById.get(validation.verifierId);
    if (!verifier) {
      blockers.push(`VALIDATION_VERIFIER_NOT_TRUSTED:${validation.validationId}:${validation.verifierId}`);
      continue;
    }
    if (implementationActors.has(verifier.verifierSubjectRef)) blockers.push(`IMPLEMENTATION_ACTOR_EXTERNAL_VALIDATION_PROHIBITED:${validation.validationId}:${verifier.verifierSubjectRef}`);
    if (validation.validationType === VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY && conformanceActors.has(verifier.verifierSubjectRef)) {
      blockers.push(`CONFORMANCE_ACTOR_SELF_AUTHENTICATION_PROHIBITED:${validation.validationId}:${verifier.verifierSubjectRef}`);
    }
    if (Date.parse(validation.verifiedAt) < Date.parse(verifier.activeFrom) || (verifier.activeUntil && Date.parse(validation.verifiedAt) > Date.parse(verifier.activeUntil))) blockers.push(`VALIDATION_VERIFIER_OUTSIDE_ACTIVE_PERIOD:${validation.validationId}`);
    if (Date.parse(validation.verifiedAt) > Date.parse(preparedAtIso)) blockers.push(`VALIDATION_AFTER_PACKET_PREPARATION:${validation.validationId}`);
    if (validation.expiresAt && Date.parse(validation.expiresAt) < Date.parse(validation.verifiedAt)) blockers.push(`VALIDATION_EXPIRY_BEFORE_VERIFICATION:${validation.validationId}`);
    if (validation.expiresAt && Date.parse(validation.expiresAt) < Date.parse(preparedAtIso)) blockers.push(`VALIDATION_EXPIRED_AT_PACKET_PREPARATION:${validation.validationId}`);

    if (validation.validationType === VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY) {
      if (validation.targetRef !== upstreamEvidencePacket.evidencePacketId) blockers.push(`EXTERNAL_CONFORMANCE_TARGET_MISMATCH:${validation.validationId}`);
      if (validation.subjectArtifactSha256 !== upstreamEvidencePacket.evidencePacketHashSha256) blockers.push(`EXTERNAL_CONFORMANCE_HASH_MISMATCH:${validation.validationId}`);
    } else {
      if (validation.targetRef !== normalizedRelease.releaseCandidateId) blockers.push(`PRODUCTION_VALIDATION_TARGET_MISMATCH:${validation.validationId}`);
      if (validation.subjectArtifactSha256 !== normalizedRelease.artifactSha256) blockers.push(`PRODUCTION_VALIDATION_ARTIFACT_HASH_MISMATCH:${validation.validationId}`);
      if (validation.environmentRef !== normalizedRelease.environmentRef) blockers.push(`PRODUCTION_VALIDATION_ENVIRONMENT_MISMATCH:${validation.validationId}`);
      if (validation.environmentConfigSha256 !== normalizedRelease.environmentConfigSha256) blockers.push(`PRODUCTION_VALIDATION_ENV_CONFIG_HASH_MISMATCH:${validation.validationId}`);
      if (validation.releaseCandidateCommitSha !== normalizedRelease.sourceCommitSha) blockers.push(`PRODUCTION_VALIDATION_COMMIT_MISMATCH:${validation.validationId}`);
    }
    if (!verifyValidationSignature(validation, verifier, policy)) blockers.push(`VALIDATION_SIGNATURE_INVALID:${validation.validationId}`);
  }

  if (blockers.length) {
    return hold(E2F_STATUS.HOLD_VALIDATION_INTEGRITY, validationPacketId.trim(), upstreamEvidencePacket, policy, blockers, preparedByRef.trim(), preparedAtIso, normalizedRelease, registry.registryHashSha256);
  }

  const rejected = normalized.filter((record) => record.result === VALIDATION_RESULT.REJECTED);
  if (rejected.length) {
    return hold(E2F_STATUS.HOLD_EXTERNAL_VALIDATION_REJECTED, validationPacketId.trim(), upstreamEvidencePacket, policy, rejected.map((record) => `EXTERNAL_VALIDATION_REJECTED:${record.validationType}:${record.validationId}`), preparedByRef.trim(), preparedAtIso, normalizedRelease, registry.registryHashSha256);
  }

  const externalConformanceValidated = isVerified(normalized, VALIDATION_TYPE.EXTERNAL_CONFORMANCE_AUTHENTICITY);
  const securityValidated = isVerified(normalized, VALIDATION_TYPE.PRODUCTION_SECURITY_VALIDATION);
  const performanceValidated = isVerified(normalized, VALIDATION_TYPE.PRODUCTION_PERFORMANCE_VALIDATION);
  const resilienceValidated = isVerified(normalized, VALIDATION_TYPE.PRODUCTION_RESILIENCE_VALIDATION);
  const complete = externalConformanceValidated && securityValidated && performanceValidated && resilienceValidated;

  const status = !externalConformanceValidated
    ? E2F_STATUS.WAITING_FOR_EXTERNAL_CONFORMANCE_VALIDATION
    : !securityValidated
      ? E2F_STATUS.WAITING_FOR_PRODUCTION_SECURITY_VALIDATION
      : !performanceValidated
        ? E2F_STATUS.WAITING_FOR_PRODUCTION_PERFORMANCE_VALIDATION
        : !resilienceValidated
          ? E2F_STATUS.WAITING_FOR_PRODUCTION_RESILIENCE_VALIDATION
          : E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY;

  const core = {
    schemaVersion: 1,
    validationPacketId: validationPacketId.trim(),
    upstreamEvidencePacketId: upstreamEvidencePacket.evidencePacketId,
    upstreamEvidencePacketHashSha256: upstreamEvidencePacket.evidencePacketHashSha256,
    policyId: policy.policyId,
    releaseCandidate: normalizedRelease,
    trustedVerifierRegistryId: registry.registryId,
    trustedVerifierRegistryHashSha256: registry.registryHashSha256,
    validations: normalized,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
  };

  return deepFreeze({
    ...core,
    status,
    blockers: Object.freeze([]),
    validationPacketHashSha256: sha256(core),
    externalConformanceEvidenceAuthenticityValidated: externalConformanceValidated,
    productionSecurityValidated: securityValidated,
    productionPerformanceValidated: performanceValidated,
    productionResilienceValidated: resilienceValidated,
    productionValidationComplete: complete,
    humanReleaseAuthorityRequired: true,
    ...authorityBoundary(),
    semantics: 'E2F cryptographically validates external-conformance authenticity and production-specific security/performance/resilience attestations against an out-of-band pinned externally governed verifier registry. Completion does not establish formal professional standards conformance, rule activation, Saudi professional licensing, certified valuation authority, external issuance, release, merge, deployment or transaction authorization.',
  });
}

function verifyExternalConformanceProductionValidationPacketIntegrity(packet) {
  if (!packet || !/^[a-f0-9]{64}$/i.test(String(packet.validationPacketHashSha256 || ''))) return false;
  const core = {
    schemaVersion: packet.schemaVersion,
    validationPacketId: packet.validationPacketId,
    upstreamEvidencePacketId: packet.upstreamEvidencePacketId,
    upstreamEvidencePacketHashSha256: packet.upstreamEvidencePacketHashSha256,
    policyId: packet.policyId,
    releaseCandidate: packet.releaseCandidate,
    trustedVerifierRegistryId: packet.trustedVerifierRegistryId,
    trustedVerifierRegistryHashSha256: packet.trustedVerifierRegistryHashSha256,
    validations: packet.validations,
    preparedByRef: packet.preparedByRef,
    preparedAt: packet.preparedAt,
  };
  return sha256(core) === packet.validationPacketHashSha256.toLowerCase();
}

module.exports = {
  E2F_STATUS,
  VALIDATION_TYPE,
  VALIDATION_RESULT,
  validatePolicy,
  normalizeReleaseCandidate,
  createValidationSigningPayload,
  normalizeValidation,
  verifyValidationSignature,
  createExternalConformanceProductionValidationPacket,
  verifyExternalConformanceProductionValidationPacketIntegrity,
};
