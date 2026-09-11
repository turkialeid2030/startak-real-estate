'use strict';

const crypto = require('crypto');
const { sha256 } = require('../standards/standards-registry');
const {
  E2F_STATUS,
  verifyExternalConformanceProductionValidationPacketIntegrity,
} = require('../standards/external-conformance-production-validation');
const {
  DECISION_TYPE,
  normalizeReleaseAuthorityRegistry,
  createReleaseDecisionSigningPayload,
  validatePolicy,
} = require('../standards/human-release-authority-deployment-decision');

const STATUS = Object.freeze({
  HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY: 'HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY',
  HOLD_RELEASE_AUTHORITY_COVERAGE: 'HOLD_RELEASE_AUTHORITY_COVERAGE',
  HOLD_RELEASE_AUTHORITY_SEPARATION: 'HOLD_RELEASE_AUTHORITY_SEPARATION',
  READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING: 'READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING',
  HOLD_E2F_VALIDATION_PACKET: 'HOLD_E2F_VALIDATION_PACKET',
  HOLD_E2G_RELEASE_AUTHORITY_ROOT: 'HOLD_E2G_RELEASE_AUTHORITY_ROOT',
  HOLD_E2G_DECISION_SIGNING_REQUEST: 'HOLD_E2G_DECISION_SIGNING_REQUEST',
  READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE: 'READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE',
});

const REQUIRED_DECISION_TYPES = Object.freeze(Object.values(DECISION_TYPE));
const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  mergeExecuted: false,
  deploymentExecuted: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  releaseAuthorityTrustEstablished: false,
  releaseAuthorityRegistryPinnedOutOfBand: false,
  humanDecisionAccepted: false,
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

function validateRsaPublicKey(authority) {
  let key;
  try {
    key = crypto.createPublicKey(authority.publicKeyPem);
  } catch (error) {
    throw new TypeError(`RELEASE_AUTHORITY_PUBLIC_KEY_INVALID:${authority.authorityId}`);
  }
  if (key.asymmetricKeyType !== 'rsa') throw new TypeError(`RELEASE_AUTHORITY_PUBLIC_KEY_MUST_BE_RSA:${authority.authorityId}`);
  const bits = key.asymmetricKeyDetails?.modulusLength || null;
  if (bits !== null && bits < 2048) throw new TypeError(`RELEASE_AUTHORITY_RSA_KEY_TOO_SMALL:${authority.authorityId}`);
  return true;
}

function registryHold(status, blockers, normalizedRegistry = null, coverage = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    requiredDecisionTypes: REQUIRED_DECISION_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry?.registryId || null,
    registryHashSha256: normalizedRegistry?.registryHashSha256 || null,
    outOfBandPinValue: null,
    coverage,
    distinctAuthoritySubjects: Object.freeze([]),
    allRequiredDecisionTypesCovered: false,
    mergeDeploymentSubjectSeparationSatisfied: false,
    minimumDistinctAuthoritySubjectsSatisfied: false,
    outOfBandPinningStillRequired: true,
    authority: AUTHORITY,
  });
}

function buildCoverage(normalizedRegistry) {
  const coverage = {};
  for (const type of REQUIRED_DECISION_TYPES) {
    coverage[type] = Object.freeze(normalizedRegistry.authorities
      .filter((record) => record.allowedDecisionTypes.includes(type))
      .map((record) => Object.freeze({
        authorityId: record.authorityId,
        authoritySubjectRef: record.authoritySubjectRef,
        publicKeySha256: record.publicKeySha256,
      })));
  }
  return deepFreeze(coverage);
}

function prepareReleaseAuthorityRegistryIntake({ registry } = {}) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return registryHold(STATUS.HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY, ['RELEASE_AUTHORITY_REGISTRY_REQUIRED']);
  }
  const forbiddenPath = containsForbiddenSecretMaterial(registry, 'registry');
  if (forbiddenPath) {
    return registryHold(STATUS.HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY, [`FORBIDDEN_SECRET_MATERIAL:${forbiddenPath}`]);
  }

  let normalizedRegistry;
  try {
    normalizedRegistry = normalizeReleaseAuthorityRegistry(registry);
    normalizedRegistry.authorities.forEach(validateRsaPublicKey);
  } catch (error) {
    return registryHold(STATUS.HOLD_INVALID_RELEASE_AUTHORITY_REGISTRY, [error.message]);
  }

  const coverage = buildCoverage(normalizedRegistry);
  const missing = REQUIRED_DECISION_TYPES.filter((type) => coverage[type].length === 0);
  if (missing.length > 0) {
    return registryHold(
      STATUS.HOLD_RELEASE_AUTHORITY_COVERAGE,
      missing.map((type) => `RELEASE_AUTHORITY_COVERAGE_MISSING:${type}`),
      normalizedRegistry,
      coverage,
    );
  }

  const subjectTypes = new Map();
  for (const authority of normalizedRegistry.authorities) {
    if (!subjectTypes.has(authority.authoritySubjectRef)) subjectTypes.set(authority.authoritySubjectRef, new Set());
    authority.allowedDecisionTypes.forEach((type) => subjectTypes.get(authority.authoritySubjectRef).add(type));
  }
  const conflictingSubjects = [...subjectTypes.entries()]
    .filter(([, types]) => types.has(DECISION_TYPE.MERGE_APPROVAL) && types.has(DECISION_TYPE.DEPLOYMENT_APPROVAL))
    .map(([subject]) => subject)
    .sort();
  const distinctSubjects = [...subjectTypes.keys()].sort();

  if (conflictingSubjects.length > 0 || distinctSubjects.length < 2) {
    const blockers = conflictingSubjects.map((subject) => `MERGE_DEPLOYMENT_AUTHORITY_SUBJECT_CONFLICT:${subject}`);
    if (distinctSubjects.length < 2) blockers.push('AT_LEAST_TWO_DISTINCT_RELEASE_AUTHORITY_SUBJECTS_REQUIRED');
    return deepFreeze({
      ...registryHold(STATUS.HOLD_RELEASE_AUTHORITY_SEPARATION, blockers, normalizedRegistry, coverage),
      distinctAuthoritySubjects: Object.freeze(distinctSubjects),
    });
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING,
    blockers: Object.freeze([]),
    requiredDecisionTypes: REQUIRED_DECISION_TYPES,
    normalizedRegistry,
    registryId: normalizedRegistry.registryId,
    registryHashSha256: normalizedRegistry.registryHashSha256,
    outOfBandPinValue: normalizedRegistry.registryHashSha256,
    coverage,
    distinctAuthoritySubjects: Object.freeze(distinctSubjects),
    allRequiredDecisionTypesCovered: true,
    mergeDeploymentSubjectSeparationSatisfied: true,
    minimumDistinctAuthoritySubjectsSatisfied: true,
    outOfBandPinningStillRequired: true,
    authority: AUTHORITY,
    semantics: 'This intake validates public release-authority material, decision-type coverage, RSA key suitability and merge/deployment actor separation, then emits the deterministic registry hash for independent out-of-band pinning. It does not establish trust or authorize any release action.',
  });
}

function requestHold(status, blockers, registryIntake = null, upstream = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    upstreamValidationPacketId: upstream?.validationPacketId || null,
    upstreamValidationPacketHashSha256: upstream?.validationPacketHashSha256 || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    releaseAuthorityRegistryHashSha256: registryIntake?.registryHashSha256 || null,
    signingPayload: null,
    signingPayloadCanonicalUtf8: null,
    signingPayloadBase64: null,
    signingPayloadHashSha256: null,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    authorityRecord: null,
    signatureStillRequired: true,
    authority: AUTHORITY,
  });
}

function prepareReleaseDecisionSigningRequest({
  policy,
  upstreamValidationPacket,
  releaseAuthorityRegistry,
  expectedReleaseAuthorityRegistryHashSha256,
  decision,
} = {}) {
  const forbidden = containsForbiddenSecretMaterial({ releaseAuthorityRegistry, decision }, 'request');
  if (forbidden) return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [`FORBIDDEN_SECRET_MATERIAL:${forbidden}`], null, upstreamValidationPacket);
  if (decision && Object.prototype.hasOwnProperty.call(decision, 'signatureBase64')) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, ['SIGNED_DECISION_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'], null, upstreamValidationPacket);
  }

  try {
    validatePolicy(policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [error.message], null, upstreamValidationPacket);
  }

  const upstreamQualified = upstreamValidationPacket?.status === E2F_STATUS.EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY
    && verifyExternalConformanceProductionValidationPacketIntegrity(upstreamValidationPacket)
    && policy.requiredUpstreamValidationFlags.every((field) => upstreamValidationPacket[field] === true);
  if (!upstreamQualified) {
    return requestHold(STATUS.HOLD_E2F_VALIDATION_PACKET, ['E2F_PRODUCTION_VALIDATION_NOT_QUALIFIED'], null, upstreamValidationPacket);
  }

  const registryIntake = prepareReleaseAuthorityRegistryIntake({ registry: releaseAuthorityRegistry });
  if (registryIntake.status !== STATUS.READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING) {
    return requestHold(STATUS.HOLD_E2G_RELEASE_AUTHORITY_ROOT, registryIntake.blockers, registryIntake, upstreamValidationPacket);
  }

  let expectedHash;
  try {
    expectedHash = digest(expectedReleaseAuthorityRegistryHashSha256, 'expectedReleaseAuthorityRegistryHashSha256');
  } catch (error) {
    return requestHold(STATUS.HOLD_E2G_RELEASE_AUTHORITY_ROOT, [error.message], registryIntake, upstreamValidationPacket);
  }
  if (expectedHash !== registryIntake.registryHashSha256) {
    return requestHold(STATUS.HOLD_E2G_RELEASE_AUTHORITY_ROOT, ['RELEASE_AUTHORITY_REGISTRY_HASH_MISMATCH'], registryIntake, upstreamValidationPacket);
  }

  let payload;
  try {
    payload = createReleaseDecisionSigningPayload(decision, policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [error.message], registryIntake, upstreamValidationPacket);
  }

  const authority = registryIntake.normalizedRegistry.authorities.find((record) => record.authorityId === payload.authorityId);
  if (!authority) return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [`DECISION_AUTHORITY_NOT_TRUSTED:${payload.authorityId}`], registryIntake, upstreamValidationPacket);
  if (!authority.allowedDecisionTypes.includes(payload.decisionType)) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [`DECISION_AUTHORITY_TYPE_NOT_ALLOWED:${payload.authorityId}:${payload.decisionType}`], registryIntake, upstreamValidationPacket);
  }

  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, [`DECISION_AUTHORITY_OUTSIDE_ACTIVE_PERIOD:${payload.authorityId}`], registryIntake, upstreamValidationPacket);
  }
  if (payload.expiresAt && Date.parse(payload.expiresAt) < decidedMs) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, ['DECISION_EXPIRY_BEFORE_DECISION_TIME'], registryIntake, upstreamValidationPacket);
  }

  const release = upstreamValidationPacket.releaseCandidate;
  const bindingChecks = [
    ['DECISION_RELEASE_CANDIDATE_ID_MISMATCH', payload.releaseCandidateId, release.releaseCandidateId],
    ['DECISION_VALIDATION_PACKET_HASH_MISMATCH', payload.validationPacketHashSha256, upstreamValidationPacket.validationPacketHashSha256],
    ['DECISION_SOURCE_COMMIT_MISMATCH', payload.sourceCommitSha, release.sourceCommitSha],
    ['DECISION_ARTIFACT_HASH_MISMATCH', payload.artifactSha256, release.artifactSha256],
    ['DECISION_ENVIRONMENT_REF_MISMATCH', payload.environmentRef, release.environmentRef],
    ['DECISION_ENVIRONMENT_CONFIG_HASH_MISMATCH', payload.environmentConfigSha256, release.environmentConfigSha256],
  ];
  const bindingBlockers = bindingChecks.filter(([, actual, expected]) => actual !== expected).map(([code]) => code);
  if (bindingBlockers.length > 0) return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, bindingBlockers, registryIntake, upstreamValidationPacket);

  const canonical = stableStringify(payload);
  const payloadHash = sha256(payload);
  if (sha256(canonical) !== payloadHash) {
    return requestHold(STATUS.HOLD_E2G_DECISION_SIGNING_REQUEST, ['SIGNING_PAYLOAD_CANONICALIZATION_HASH_MISMATCH'], registryIntake, upstreamValidationPacket);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE,
    blockers: Object.freeze([]),
    upstreamValidationPacketId: upstreamValidationPacket.validationPacketId,
    upstreamValidationPacketHashSha256: upstreamValidationPacket.validationPacketHashSha256,
    releaseCandidate: release,
    releaseAuthorityRegistryId: registryIntake.registryId,
    releaseAuthorityRegistryHashSha256: registryIntake.registryHashSha256,
    pinnedRegistryHashMatched: true,
    signingPayload: payload,
    signingPayloadCanonicalUtf8: canonical,
    signingPayloadBase64: Buffer.from(canonical, 'utf8').toString('base64'),
    signingPayloadHashSha256: payloadHash,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    authorityRecord: Object.freeze({
      authorityId: authority.authorityId,
      authoritySubjectRef: authority.authoritySubjectRef,
      publicKeySha256: authority.publicKeySha256,
      governanceEvidenceRef: authority.governanceEvidenceRef,
    }),
    requiredSignedResponseFields: Object.freeze(['signatureBase64']),
    signatureStillRequired: true,
    authority: AUTHORITY,
    semantics: 'The canonical UTF-8 payload is ready for an external human authority to sign with the independently controlled RSA private key corresponding to the pinned public key. This package never receives the private key, never creates a signature, and never converts a signing request into authorization.',
  });
}

module.exports = {
  STATUS,
  REQUIRED_DECISION_TYPES,
  AUTHORITY,
  stableStringify,
  containsForbiddenSecretMaterial,
  validateRsaPublicKey,
  buildCoverage,
  prepareReleaseAuthorityRegistryIntake,
  prepareReleaseDecisionSigningRequest,
};
