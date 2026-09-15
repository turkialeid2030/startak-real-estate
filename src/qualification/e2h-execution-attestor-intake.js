'use strict';

const crypto = require('crypto');
const { sha256 } = require('../standards/standards-registry');
const {
  E2G_STATUS,
  verifyHumanReleaseAuthorityDecisionPacketIntegrity,
} = require('../standards/human-release-authority-deployment-decision');
const {
  ATTESTATION_TYPE,
  normalizeExecutionAttestorRegistry,
  createExecutionAttestationSigningPayload,
  validatePolicy,
} = require('../standards/execution-attestation-post-deployment-closeout');

const STATUS = Object.freeze({
  HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY: 'HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY',
  HOLD_EXECUTION_ATTESTOR_COVERAGE: 'HOLD_EXECUTION_ATTESTOR_COVERAGE',
  HOLD_EXECUTION_ATTESTOR_SEPARATION: 'HOLD_EXECUTION_ATTESTOR_SEPARATION',
  READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING: 'READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING',
  HOLD_E2G_DECISION_PACKET: 'HOLD_E2G_DECISION_PACKET',
  HOLD_E2H_EXECUTION_ATTESTOR_ROOT: 'HOLD_E2H_EXECUTION_ATTESTOR_ROOT',
  HOLD_E2H_ATTESTATION_SIGNING_REQUEST: 'HOLD_E2H_ATTESTATION_SIGNING_REQUEST',
  READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE: 'READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE',
});

const REQUIRED_ATTESTATION_TYPES = Object.freeze(Object.values(ATTESTATION_TYPE));
const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  mergeExecuted: false,
  deploymentExecuted: false,
  postDeploymentSmokePassed: false,
  rollbackReadinessValidated: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  executionAttestorTrustEstablished: false,
  executionAttestorRegistryPinnedOutOfBand: false,
  executionAttestationAccepted: false,
  signatureCreated: false,
  privateSigningKeyAccepted: false,
  professionalAuthorityEstablished: false,
});

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

function containsForbiddenSecretMaterial(value, path = 'input') {
  if (typeof value === 'string' && /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) return `${path}:PRIVATE_KEY_PEM`;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = containsForbiddenSecretMaterial(value[index], `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(private.?key|secret|password|token|credential)/i.test(key)) return `${path}.${key}`;
    const hit = containsForbiddenSecretMaterial(child, `${path}.${key}`);
    if (hit) return hit;
  }
  return null;
}

function digest(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return value.toLowerCase();
}

function validateRsaPublicKey(attestor) {
  let key;
  try {
    key = crypto.createPublicKey(attestor.publicKeyPem);
  } catch (error) {
    throw new TypeError(`EXECUTION_ATTESTOR_PUBLIC_KEY_INVALID:${attestor.attestorId}`);
  }
  if (key.asymmetricKeyType !== 'rsa') throw new TypeError(`EXECUTION_ATTESTOR_PUBLIC_KEY_MUST_BE_RSA:${attestor.attestorId}`);
  const bits = key.asymmetricKeyDetails?.modulusLength || null;
  if (bits !== null && bits < 2048) throw new TypeError(`EXECUTION_ATTESTOR_RSA_KEY_TOO_SMALL:${attestor.attestorId}`);
  return true;
}

function registryHold(status, blockers, normalizedRegistry = null, coverage = null, distinctSubjects = []) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    requiredAttestationTypes: REQUIRED_ATTESTATION_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry?.registryId || null,
    registryHashSha256: normalizedRegistry?.registryHashSha256 || null,
    outOfBandPinValue: null,
    coverage,
    distinctAttestorSubjects: Object.freeze([...distinctSubjects]),
    allRequiredAttestationTypesCovered: false,
    deploymentSmokeSubjectSeparationSatisfied: false,
    minimumDistinctAttestorSubjectsSatisfied: false,
    outOfBandPinningStillRequired: true,
    authority: AUTHORITY,
  });
}

function buildCoverage(normalizedRegistry) {
  const coverage = {};
  for (const type of REQUIRED_ATTESTATION_TYPES) {
    coverage[type] = Object.freeze(normalizedRegistry.attestors
      .filter((record) => record.allowedAttestationTypes.includes(type))
      .map((record) => Object.freeze({
        attestorId: record.attestorId,
        attestorSubjectRef: record.attestorSubjectRef,
        publicKeySha256: record.publicKeySha256,
      })));
  }
  return deepFreeze(coverage);
}

function prepareExecutionAttestorRegistryIntake({ registry } = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return registryHold(STATUS.HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY, ['EXECUTION_ATTESTOR_REGISTRY_REQUIRED']);
  }
  const forbiddenPath = containsForbiddenSecretMaterial(registry, 'registry');
  if (forbiddenPath) return registryHold(STATUS.HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY, [`FORBIDDEN_SECRET_MATERIAL:${forbiddenPath}`]);

  let normalizedRegistry;
  try {
    normalizedRegistry = normalizeExecutionAttestorRegistry(registry);
    normalizedRegistry.attestors.forEach(validateRsaPublicKey);
  } catch (error) {
    return registryHold(STATUS.HOLD_INVALID_EXECUTION_ATTESTOR_REGISTRY, [error.message]);
  }

  const coverage = buildCoverage(normalizedRegistry);
  const missing = REQUIRED_ATTESTATION_TYPES.filter((type) => coverage[type].length === 0);
  if (missing.length > 0) {
    return registryHold(
      STATUS.HOLD_EXECUTION_ATTESTOR_COVERAGE,
      missing.map((type) => `EXECUTION_ATTESTOR_COVERAGE_MISSING:${type}`),
      normalizedRegistry,
      coverage,
    );
  }

  const subjectTypes = new Map();
  for (const record of normalizedRegistry.attestors) {
    if (!subjectTypes.has(record.attestorSubjectRef)) subjectTypes.set(record.attestorSubjectRef, new Set());
    record.allowedAttestationTypes.forEach((type) => subjectTypes.get(record.attestorSubjectRef).add(type));
  }
  const distinctSubjects = [...subjectTypes.keys()].sort();
  const conflicts = [...subjectTypes.entries()]
    .filter(([, types]) => types.has(ATTESTATION_TYPE.DEPLOYMENT_EXECUTION_ATTESTATION) && types.has(ATTESTATION_TYPE.POST_DEPLOYMENT_SMOKE_VALIDATION))
    .map(([subject]) => subject)
    .sort();

  if (conflicts.length > 0 || distinctSubjects.length < 2) {
    const blockers = conflicts.map((subject) => `DEPLOYMENT_SMOKE_ATTESTOR_SUBJECT_CONFLICT:${subject}`);
    if (distinctSubjects.length < 2) blockers.push('AT_LEAST_TWO_DISTINCT_EXECUTION_ATTESTOR_SUBJECTS_REQUIRED');
    return registryHold(STATUS.HOLD_EXECUTION_ATTESTOR_SEPARATION, blockers, normalizedRegistry, coverage, distinctSubjects);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING,
    blockers: Object.freeze([]),
    requiredAttestationTypes: REQUIRED_ATTESTATION_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry.registryId,
    registryHashSha256: normalizedRegistry.registryHashSha256,
    outOfBandPinValue: normalizedRegistry.registryHashSha256,
    coverage,
    distinctAttestorSubjects: Object.freeze(distinctSubjects),
    allRequiredAttestationTypesCovered: true,
    deploymentSmokeSubjectSeparationSatisfied: true,
    minimumDistinctAttestorSubjectsSatisfied: true,
    outOfBandPinningStillRequired: true,
    authority: AUTHORITY,
    semantics: 'This intake validates public E2H execution-attestor material, attestation-type coverage, RSA key suitability and deployment/smoke actor separation, then emits the deterministic registry hash for independent out-of-band pinning. It does not establish trust, attest execution or authorize any production action.',
  });
}

function requestHold(status, blockers, registryIntake = null, upstream = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    upstreamDecisionPacketId: upstream?.decisionPacketId || null,
    upstreamDecisionPacketHashSha256: upstream?.decisionPacketHashSha256 || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    executionAttestorRegistryHashSha256: registryIntake?.registryHashSha256 || null,
    signingPayload: null,
    signingPayloadCanonicalUtf8: null,
    signingPayloadBase64: null,
    signingPayloadHashSha256: null,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    attestorRecord: null,
    signatureStillRequired: true,
    authority: AUTHORITY,
  });
}

function prepareExecutionAttestationSigningRequest({
  policy,
  upstreamDecisionPacket,
  executionAttestorRegistry,
  expectedExecutionAttestorRegistryHashSha256,
  attestation,
} = {}) {
  const forbidden = containsForbiddenSecretMaterial({ executionAttestorRegistry, attestation }, 'request');
  if (forbidden) return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [`FORBIDDEN_SECRET_MATERIAL:${forbidden}`], null, upstreamDecisionPacket);
  if (attestation && Object.prototype.hasOwnProperty.call(attestation, 'signatureBase64')) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, ['SIGNED_ATTESTATION_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'], null, upstreamDecisionPacket);
  }

  try {
    validatePolicy(policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [error.message], null, upstreamDecisionPacket);
  }

  const upstreamQualified = upstreamDecisionPacket?.status === E2G_STATUS.HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION
    && verifyHumanReleaseAuthorityDecisionPacketIntegrity(upstreamDecisionPacket)
    && policy.requiredUpstreamAuthorizationFlags.every((field) => upstreamDecisionPacket[field] === true);
  if (!upstreamQualified) {
    return requestHold(STATUS.HOLD_E2G_DECISION_PACKET, ['E2G_HUMAN_RELEASE_DECISIONS_NOT_QUALIFIED'], null, upstreamDecisionPacket);
  }

  const registryIntake = prepareExecutionAttestorRegistryIntake({ registry: executionAttestorRegistry });
  if (registryIntake.status !== STATUS.READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING) {
    return requestHold(STATUS.HOLD_E2H_EXECUTION_ATTESTOR_ROOT, registryIntake.blockers, registryIntake, upstreamDecisionPacket);
  }

  let expectedHash;
  try {
    expectedHash = digest(expectedExecutionAttestorRegistryHashSha256, 'expectedExecutionAttestorRegistryHashSha256');
  } catch (error) {
    return requestHold(STATUS.HOLD_E2H_EXECUTION_ATTESTOR_ROOT, [error.message], registryIntake, upstreamDecisionPacket);
  }
  if (expectedHash !== registryIntake.registryHashSha256) {
    return requestHold(STATUS.HOLD_E2H_EXECUTION_ATTESTOR_ROOT, ['EXECUTION_ATTESTOR_REGISTRY_HASH_MISMATCH'], registryIntake, upstreamDecisionPacket);
  }

  let payload;
  try {
    payload = createExecutionAttestationSigningPayload(attestation, policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [error.message], registryIntake, upstreamDecisionPacket);
  }

  const attestor = registryIntake.normalizedRegistry.attestors.find((record) => record.attestorId === payload.attestorId);
  if (!attestor) return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [`EXECUTION_ATTESTOR_NOT_TRUSTED:${payload.attestorId}`], registryIntake, upstreamDecisionPacket);
  if (!attestor.allowedAttestationTypes.includes(payload.attestationType)) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [`EXECUTION_ATTESTOR_TYPE_NOT_ALLOWED:${payload.attestorId}:${payload.attestationType}`], registryIntake, upstreamDecisionPacket);
  }

  const observedMs = Date.parse(payload.observedAt);
  if (observedMs < Date.parse(attestor.activeFrom) || (attestor.activeUntil && observedMs > Date.parse(attestor.activeUntil))) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, [`EXECUTION_ATTESTOR_OUTSIDE_ACTIVE_PERIOD:${payload.attestorId}`], registryIntake, upstreamDecisionPacket);
  }
  if (observedMs < Date.parse(upstreamDecisionPacket.preparedAt)) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, ['ATTESTATION_BEFORE_E2G_DECISION_PACKET'], registryIntake, upstreamDecisionPacket);
  }
  if (payload.expiresAt && Date.parse(payload.expiresAt) < observedMs) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, ['ATTESTATION_EXPIRY_BEFORE_OBSERVATION'], registryIntake, upstreamDecisionPacket);
  }

  const release = upstreamDecisionPacket.releaseCandidate;
  const bindingChecks = [
    ['ATTESTATION_DECISION_PACKET_HASH_MISMATCH', payload.decisionPacketHashSha256, upstreamDecisionPacket.decisionPacketHashSha256],
    ['ATTESTATION_RELEASE_CANDIDATE_MISMATCH', payload.releaseCandidateId, release.releaseCandidateId],
    ['ATTESTATION_SOURCE_COMMIT_MISMATCH', payload.approvedSourceCommitSha, release.sourceCommitSha],
    ['ATTESTATION_ARTIFACT_HASH_MISMATCH', payload.artifactSha256, release.artifactSha256],
    ['ATTESTATION_ENVIRONMENT_MISMATCH', payload.environmentRef, release.environmentRef],
    ['ATTESTATION_ENV_CONFIG_HASH_MISMATCH', payload.environmentConfigSha256, release.environmentConfigSha256],
  ];
  const blockers = bindingChecks.filter(([, actual, expected]) => actual !== expected).map(([code]) => code);
  if (blockers.length > 0) return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, blockers, registryIntake, upstreamDecisionPacket);

  const canonical = stableStringify(payload);
  const payloadHash = sha256(payload);
  if (sha256(canonical) !== payloadHash) {
    return requestHold(STATUS.HOLD_E2H_ATTESTATION_SIGNING_REQUEST, ['SIGNING_PAYLOAD_CANONICALIZATION_HASH_MISMATCH'], registryIntake, upstreamDecisionPacket);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE,
    blockers: Object.freeze([]),
    upstreamDecisionPacketId: upstreamDecisionPacket.decisionPacketId,
    upstreamDecisionPacketHashSha256: upstreamDecisionPacket.decisionPacketHashSha256,
    releaseCandidate: release,
    executionAttestorRegistryId: registryIntake.registryId,
    executionAttestorRegistryHashSha256: registryIntake.registryHashSha256,
    pinnedRegistryHashMatched: true,
    signingPayload: payload,
    signingPayloadCanonicalUtf8: canonical,
    signingPayloadBase64: Buffer.from(canonical, 'utf8').toString('base64'),
    signingPayloadHashSha256: payloadHash,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    attestorRecord: Object.freeze({
      attestorId: attestor.attestorId,
      attestorSubjectRef: attestor.attestorSubjectRef,
      publicKeySha256: attestor.publicKeySha256,
      governanceEvidenceRef: attestor.governanceEvidenceRef,
    }),
    requiredSignedResponseFields: Object.freeze(['signatureBase64']),
    signatureStillRequired: true,
    authority: AUTHORITY,
    semantics: 'The exact E2H attestation payload is ready for an independently controlled external RSA-SHA256 signature. The package never receives a private key, never creates a signature, never attests that an execution event happened, and never converts a signing request into execution or go-live authority.',
  });
}

module.exports = {
  STATUS,
  REQUIRED_ATTESTATION_TYPES,
  AUTHORITY,
  stableStringify,
  containsForbiddenSecretMaterial,
  validateRsaPublicKey,
  buildCoverage,
  prepareExecutionAttestorRegistryIntake,
  prepareExecutionAttestationSigningRequest,
};
