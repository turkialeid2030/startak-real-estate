'use strict';

const crypto = require('crypto');
const { sha256 } = require('../standards/standards-registry');
const {
  E2H_STATUS,
  verifyExecutionPostDeploymentCloseoutPacketIntegrity,
} = require('../standards/execution-attestation-post-deployment-closeout');
const {
  EVIDENCE_TYPE,
  createReadinessEvidenceSigningPayload,
  validatePolicy,
} = require('../standards/production-evidence-go-live-readiness');
const {
  STATUS: REGISTRY_STATUS,
  prepareReadinessVerifierRegistryIntake,
} = require('./readiness-verifier-registry-intake-package');

const STATUS = Object.freeze({
  HOLD_INVALID_READINESS_VERIFIER_REGISTRY: 'HOLD_INVALID_READINESS_VERIFIER_REGISTRY',
  HOLD_READINESS_VERIFIER_RSA_REQUIREMENTS: 'HOLD_READINESS_VERIFIER_RSA_REQUIREMENTS',
  READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING: 'READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING',
  HOLD_E2H_CLOSEOUT_PACKET: 'HOLD_E2H_CLOSEOUT_PACKET',
  HOLD_E2I_READINESS_VERIFIER_ROOT: 'HOLD_E2I_READINESS_VERIFIER_ROOT',
  HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST: 'HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST',
  READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE: 'READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  mergeExecuted: false,
  deploymentExecuted: false,
  postDeploymentSmokePassed: false,
  rollbackReadinessValidated: false,
  goLiveReady: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  readinessVerifierTrustEstablished: false,
  readinessVerifierRegistryPinnedOutOfBand: false,
  readinessEvidenceAccepted: false,
  signatureCreated: false,
  privateSigningKeyAccepted: false,
  legalApprovalEstablished: false,
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

function validateRsaPublicKey(verifier) {
  let key;
  try {
    key = crypto.createPublicKey(verifier.publicKeyPem);
  } catch (error) {
    throw new TypeError(`READINESS_VERIFIER_PUBLIC_KEY_INVALID:${verifier.verifierId}`);
  }
  if (key.asymmetricKeyType !== 'rsa') throw new TypeError(`READINESS_VERIFIER_PUBLIC_KEY_MUST_BE_RSA:${verifier.verifierId}`);
  const bits = key.asymmetricKeyDetails?.modulusLength || null;
  if (bits !== null && bits < 2048) throw new TypeError(`READINESS_VERIFIER_RSA_KEY_TOO_SMALL:${verifier.verifierId}`);
  return true;
}

function registryHold(status, blockers, base = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    requiredEvidenceTypes: Object.freeze(Object.values(EVIDENCE_TYPE)),
    normalizedRegistry: base?.normalizedRegistry || null,
    registryId: base?.registryId || null,
    registryHashSha256: base?.registryHashSha256 || null,
    outOfBandPinValue: null,
    coverage: base?.coverage || null,
    distinctVerifierSubjects: Object.freeze([...(base?.distinctVerifierSubjects || [])]),
    allRequiredEvidenceTypesCovered: base?.allRequiredEvidenceTypesCovered === true,
    minimumDistinctVerifierSubjectsSatisfied: base?.minimumDistinctVerifierSubjectsSatisfied === true,
    rsaSha256VerifierKeysSatisfied: false,
    outOfBandPinningStillRequired: true,
    e2iAcceptancePending: true,
    authority: AUTHORITY,
  });
}

function prepareReadinessVerifierRegistryOperationalIntake({ registry } = {}) {
  const forbiddenPath = containsForbiddenSecretMaterial(registry, 'registry');
  if (forbiddenPath) {
    return registryHold(STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY, [`FORBIDDEN_SECRET_MATERIAL:${forbiddenPath}`]);
  }

  const base = prepareReadinessVerifierRegistryIntake({ registry });
  if (base.status !== REGISTRY_STATUS.READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING) {
    return registryHold(STATUS.HOLD_INVALID_READINESS_VERIFIER_REGISTRY, base.blockers || ['READINESS_VERIFIER_REGISTRY_NOT_READY'], base);
  }

  try {
    base.normalizedRegistry.verifiers.forEach(validateRsaPublicKey);
  } catch (error) {
    return registryHold(STATUS.HOLD_READINESS_VERIFIER_RSA_REQUIREMENTS, [error.message], base);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING,
    blockers: Object.freeze([]),
    requiredEvidenceTypes: Object.freeze(Object.values(EVIDENCE_TYPE)),
    normalizedRegistry: base.normalizedRegistry,
    registryId: base.registryId,
    registryHashSha256: base.registryHashSha256,
    outOfBandPinValue: base.registryHashSha256,
    coverage: base.coverage,
    distinctVerifierSubjects: base.distinctVerifierSubjects,
    allRequiredEvidenceTypesCovered: true,
    minimumDistinctVerifierSubjectsSatisfied: true,
    rsaSha256VerifierKeysSatisfied: true,
    outOfBandPinningStillRequired: true,
    e2iAcceptancePending: true,
    authority: AUTHORITY,
    semantics: 'This operational intake extends the existing E2I registry structural intake with RSA public-key suitability checks required by the E2I RSA-SHA256 signature contract. It emits the deterministic registry hash for independent out-of-band pinning, but does not establish verifier trust or accept readiness evidence.',
  });
}

function requestHold(status, blockers, registryIntake = null, upstream = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    upstreamCloseoutPacketId: upstream?.closeoutPacketId || null,
    upstreamCloseoutPacketHashSha256: upstream?.closeoutPacketHashSha256 || null,
    releaseCandidate: upstream?.releaseCandidate || null,
    readinessVerifierRegistryHashSha256: registryIntake?.registryHashSha256 || null,
    signingPayload: null,
    signingPayloadCanonicalUtf8: null,
    signingPayloadBase64: null,
    signingPayloadHashSha256: null,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    verifierRecord: null,
    signatureStillRequired: true,
    architecturalStopStillEnforced: true,
    authority: AUTHORITY,
  });
}

function prepareReadinessEvidenceSigningRequest({
  policy,
  upstreamCloseoutPacket,
  readinessVerifierRegistry,
  expectedReadinessVerifierRegistryHashSha256,
  evidence,
} = {}) {
  const forbidden = containsForbiddenSecretMaterial({ readinessVerifierRegistry, evidence }, 'request');
  if (forbidden) return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [`FORBIDDEN_SECRET_MATERIAL:${forbidden}`], null, upstreamCloseoutPacket);
  if (evidence && Object.prototype.hasOwnProperty.call(evidence, 'signatureBase64')) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, ['SIGNED_READINESS_EVIDENCE_NOT_ACCEPTED_BY_SIGNING_REQUEST_INTAKE'], null, upstreamCloseoutPacket);
  }

  try {
    validatePolicy(policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [error.message], null, upstreamCloseoutPacket);
  }

  const upstreamQualified = upstreamCloseoutPacket?.status === E2H_STATUS.EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE
    && verifyExecutionPostDeploymentCloseoutPacketIntegrity(upstreamCloseoutPacket)
    && policy.requiredUpstreamFlags.every((field) => upstreamCloseoutPacket[field] === true);
  if (!upstreamQualified) {
    return requestHold(STATUS.HOLD_E2H_CLOSEOUT_PACKET, ['E2H_EXECUTION_CLOSEOUT_NOT_QUALIFIED'], null, upstreamCloseoutPacket);
  }

  const registryIntake = prepareReadinessVerifierRegistryOperationalIntake({ registry: readinessVerifierRegistry });
  if (registryIntake.status !== STATUS.READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING) {
    return requestHold(STATUS.HOLD_E2I_READINESS_VERIFIER_ROOT, registryIntake.blockers, registryIntake, upstreamCloseoutPacket);
  }

  let expectedHash;
  try {
    expectedHash = digest(expectedReadinessVerifierRegistryHashSha256, 'expectedReadinessVerifierRegistryHashSha256');
  } catch (error) {
    return requestHold(STATUS.HOLD_E2I_READINESS_VERIFIER_ROOT, [error.message], registryIntake, upstreamCloseoutPacket);
  }
  if (expectedHash !== registryIntake.registryHashSha256) {
    return requestHold(STATUS.HOLD_E2I_READINESS_VERIFIER_ROOT, ['READINESS_VERIFIER_REGISTRY_HASH_MISMATCH'], registryIntake, upstreamCloseoutPacket);
  }

  let payload;
  try {
    payload = createReadinessEvidenceSigningPayload(evidence, policy);
  } catch (error) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [error.message], registryIntake, upstreamCloseoutPacket);
  }

  const verifier = registryIntake.normalizedRegistry.verifiers.find((record) => record.verifierId === payload.verifierId);
  if (!verifier) return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [`READINESS_VERIFIER_NOT_TRUSTED:${payload.verifierId}`], registryIntake, upstreamCloseoutPacket);
  if (!verifier.allowedEvidenceTypes.includes(payload.evidenceType)) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [`READINESS_VERIFIER_TYPE_NOT_ALLOWED:${payload.verifierId}:${payload.evidenceType}`], registryIntake, upstreamCloseoutPacket);
  }

  const verifiedMs = Date.parse(payload.verifiedAt);
  if (verifiedMs < Date.parse(verifier.activeFrom) || (verifier.activeUntil && verifiedMs > Date.parse(verifier.activeUntil))) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, [`READINESS_VERIFIER_OUTSIDE_ACTIVE_PERIOD:${payload.verifierId}`], registryIntake, upstreamCloseoutPacket);
  }
  if (verifiedMs < Date.parse(upstreamCloseoutPacket.preparedAt)) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, ['READINESS_EVIDENCE_BEFORE_E2H_CLOSEOUT'], registryIntake, upstreamCloseoutPacket);
  }
  if (payload.expiresAt && Date.parse(payload.expiresAt) < verifiedMs) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, ['READINESS_EVIDENCE_EXPIRY_BEFORE_VERIFICATION'], registryIntake, upstreamCloseoutPacket);
  }

  const release = upstreamCloseoutPacket.releaseCandidate;
  const bindingChecks = [
    ['READINESS_UPSTREAM_CLOSEOUT_HASH_MISMATCH', payload.upstreamCloseoutPacketHashSha256, upstreamCloseoutPacket.closeoutPacketHashSha256],
    ['READINESS_RELEASE_CANDIDATE_MISMATCH', payload.releaseCandidateId, release.releaseCandidateId],
    ['READINESS_SOURCE_COMMIT_MISMATCH', payload.sourceCommitSha, release.sourceCommitSha],
    ['READINESS_ARTIFACT_HASH_MISMATCH', payload.artifactSha256, release.artifactSha256],
    ['READINESS_ENVIRONMENT_MISMATCH', payload.environmentRef, release.environmentRef],
    ['READINESS_ENV_CONFIG_HASH_MISMATCH', payload.environmentConfigSha256, release.environmentConfigSha256],
  ];
  const blockers = bindingChecks.filter(([, actual, expected]) => actual !== expected).map(([code]) => code);
  if (blockers.length > 0) return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, blockers, registryIntake, upstreamCloseoutPacket);

  const canonical = stableStringify(payload);
  const payloadHash = sha256(payload);
  if (sha256(canonical) !== payloadHash) {
    return requestHold(STATUS.HOLD_E2I_READINESS_EVIDENCE_SIGNING_REQUEST, ['SIGNING_PAYLOAD_CANONICALIZATION_HASH_MISMATCH'], registryIntake, upstreamCloseoutPacket);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE,
    blockers: Object.freeze([]),
    upstreamCloseoutPacketId: upstreamCloseoutPacket.closeoutPacketId,
    upstreamCloseoutPacketHashSha256: upstreamCloseoutPacket.closeoutPacketHashSha256,
    releaseCandidate: release,
    readinessVerifierRegistryId: registryIntake.registryId,
    readinessVerifierRegistryHashSha256: registryIntake.registryHashSha256,
    pinnedRegistryHashMatched: true,
    signingPayload: payload,
    signingPayloadCanonicalUtf8: canonical,
    signingPayloadBase64: Buffer.from(canonical, 'utf8').toString('base64'),
    signingPayloadHashSha256: payloadHash,
    expectedSignatureAlgorithm: 'RSA-SHA256',
    verifierRecord: Object.freeze({
      verifierId: verifier.verifierId,
      verifierSubjectRef: verifier.verifierSubjectRef,
      publicKeySha256: verifier.publicKeySha256,
      governanceEvidenceRef: verifier.governanceEvidenceRef,
      allowedEvidenceTypes: verifier.allowedEvidenceTypes,
    }),
    requiredSignedResponseFields: Object.freeze(['signatureBase64']),
    signatureStillRequired: true,
    architecturalStopStillEnforced: true,
    authority: AUTHORITY,
    semantics: 'The exact E2I readiness-evidence payload is ready for an independently controlled external RSA-SHA256 signature. This package does not accept a private key, does not create a signature, does not accept the evidence result, and cannot satisfy the E2I architectural stop by itself.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  stableStringify,
  containsForbiddenSecretMaterial,
  validateRsaPublicKey,
  prepareReadinessVerifierRegistryOperationalIntake,
  prepareReadinessEvidenceSigningRequest,
};
