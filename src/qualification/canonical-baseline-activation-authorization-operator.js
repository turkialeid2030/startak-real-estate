'use strict';

const crypto = require('crypto');
const {
  STATUS: P39_STATUS,
} = require('./composite-baseline-activation-change-contract');
const {
  AUTHORIZATION_STATUS,
  ACTIVATION_PURPOSE,
  ACTIVATION_DECISION,
  RELEASE_AUTHORITY,
  normalizeActivationAuthorityRegistry,
  createHumanActivationSigningPayload,
  verifyHumanActivationAuthorization,
} = require('./dual-mode-canonical-baseline-registry-verifier');
const { stableStringify } = require('./canonical-baseline-registry');

const STATUS = Object.freeze({
  HOLD_ACTIVATION_AUTHORIZATION_PACKAGE: 'HOLD_ACTIVATION_AUTHORIZATION_PACKAGE',
  READY_FOR_EXTERNAL_OWNER_SIGNATURE: 'READY_FOR_EXTERNAL_OWNER_SIGNATURE',
  VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION: 'VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const FORBIDDEN_KEY_NAMES = new Set([
  'privateKey',
  'privateKeyPem',
  'privateSigningKey',
  'privateSigningKeyPem',
  'signingPrivateKey',
  'secretKey',
]);

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
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

function hold(blockers, contract = null, registryHashSha256 = null) {
  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.HOLD_ACTIVATION_AUTHORIZATION_PACKAGE,
    verified: false,
    blockers: Object.freeze([...new Set(blockers)]),
    activationChangeContractHashSha256: contract?.activationChangeContractHashSha256 || null,
    authorityRegistryHashSha256: registryHashSha256,
    signingPayload: null,
    signingPayloadHashSha256: null,
    signingBytesBase64: null,
    signedAuthorizationVerificationHashSha256: null,
    signatureRequired: true,
    externalSigningRequired: true,
    privateSigningKeyAccepted: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    productionEvidenceEstablishedHere: false,
    ...RELEASE_AUTHORITY,
  });
}

function validateContractBoundary(contract) {
  const blockers = [];
  if (!contract || contract.status !== P39_STATUS.EXPLICIT_ACTIVATION_CHANGE_CONTRACT_READY_NOT_AUTHORIZED) {
    return ['P39_ACTIVATION_CHANGE_CONTRACT_REQUIRED'];
  }
  if (!SHA256_RE.test(contract.activationChangeContractHashSha256 || '')) blockers.push('P39_ACTIVATION_CHANGE_CONTRACT_HASH_INVALID');
  if (typeof contract.preparedByRef !== 'string' || contract.preparedByRef.trim() === '') blockers.push('P39_OWNER_REF_REQUIRED');
  if (contract.activationAuthorizationGranted !== false) blockers.push('P39_MUST_REMAIN_NOT_AUTHORIZED');
  if (contract.actualRegistryMutationPerformed !== false) blockers.push('P39_REGISTRY_MUST_REMAIN_UNMUTATED');
  if (contract.activationApplied !== false || contract.canonicalBaselineChanged !== false) blockers.push('P39_ACTIVATION_MUST_REMAIN_UNAPPLIED');
  for (const field of Object.keys(RELEASE_AUTHORITY)) {
    if (contract[field] !== false) blockers.push(`P39_${field.toUpperCase()}_MUST_REMAIN_FALSE`);
  }
  return blockers;
}

function normalizeExpectedRegistryHash(value) {
  if (typeof value !== 'string' || !SHA256_RE.test(value.trim())) throw new TypeError('expectedActivationAuthorityRegistryHashSha256 must be a SHA-256 hex digest');
  return value.trim().toLowerCase();
}

function prepareCanonicalBaselineActivationAuthorization(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold([`PRIVATE_SIGNING_KEY_MATERIAL_REJECTED:${forbidden}`], input.contract || null);

  const {
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    decision,
  } = input;

  const contractBlockers = validateContractBoundary(contract);
  if (contractBlockers.length > 0) return hold(contractBlockers, contract);

  let registry;
  let expectedRegistryHash;
  try {
    registry = normalizeActivationAuthorityRegistry(activationAuthorityRegistry);
    expectedRegistryHash = normalizeExpectedRegistryHash(expectedActivationAuthorityRegistryHashSha256);
  } catch (error) {
    return hold([error.message], contract);
  }
  if (registry.registryHashSha256 !== expectedRegistryHash) {
    return hold(['ACTIVATION_AUTHORITY_REGISTRY_HASH_MISMATCH'], contract, registry.registryHashSha256);
  }

  let signingPayload;
  try {
    signingPayload = createHumanActivationSigningPayload({ contract, attestation: decision });
  } catch (error) {
    return hold([error.message], contract, registry.registryHashSha256);
  }

  const authority = registry.authorities.find((record) => record.authorityId === signingPayload.authorityId);
  if (!authority) return hold(['ACTIVATION_AUTHORITY_NOT_IN_TRUSTED_REGISTRY'], contract, registry.registryHashSha256);
  if (authority.actorRef !== signingPayload.actorRef) return hold(['ACTIVATION_AUTHORITY_ACTOR_SCOPE_MISMATCH'], contract, registry.registryHashSha256);
  if (signingPayload.actorRef !== contract.preparedByRef) return hold(['ACTIVATION_MUST_BE_AUTHORIZED_BY_P39_OWNER'], contract, registry.registryHashSha256);
  if (authority.allowedPurpose !== ACTIVATION_PURPOSE) return hold(['ACTIVATION_AUTHORITY_PURPOSE_NOT_ALLOWED'], contract, registry.registryHashSha256);

  const decidedMs = Date.parse(signingPayload.decidedAt);
  if (decidedMs < Date.parse(authority.activeFrom) || (authority.activeUntil && decidedMs > Date.parse(authority.activeUntil))) {
    return hold(['ACTIVATION_AUTHORITY_OUTSIDE_ACTIVE_PERIOD'], contract, registry.registryHashSha256);
  }

  const signingBytes = stableStringify(signingPayload);
  const attestationWithoutSignature = deepFreeze({
    authorityId: signingPayload.authorityId,
    actorRef: signingPayload.actorRef,
    decisionId: signingPayload.decisionId,
    decision: ACTIVATION_DECISION,
    decisionSourceRef: signingPayload.decisionSourceRef,
    decisionArtifactSha256: signingPayload.decisionArtifactSha256,
    decidedAt: signingPayload.decidedAt,
    rationaleRef: signingPayload.rationaleRef,
    signatureAlgorithm: 'RSA-SHA256',
  });

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.READY_FOR_EXTERNAL_OWNER_SIGNATURE,
    verified: true,
    blockers: Object.freeze([]),
    purpose: ACTIVATION_PURPOSE,
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    authorityRegistryHashSha256: registry.registryHashSha256,
    authorityId: authority.authorityId,
    ownerActorRef: contract.preparedByRef,
    publicKeySha256: authority.publicKeySha256,
    signingPayload,
    signingPayloadHashSha256: sha256Text(signingBytes),
    signingBytesBase64: Buffer.from(signingBytes, 'utf8').toString('base64'),
    attestationWithoutSignature,
    signatureRequired: true,
    signatureAlgorithm: 'RSA-SHA256',
    externalSigningRequired: true,
    repositorySigningPerformed: false,
    privateSigningKeyAccepted: false,
    activationAuthorizationVerified: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    productionEvidenceEstablishedHere: false,
    ...RELEASE_AUTHORITY,
    semantics: 'P41 prepares the exact deterministic owner-authorization signing bytes for the P40 trust model. Signing must occur outside the repository with the authorized private key. This package does not authorize or apply the baseline change, merge, deployment, go-live or transactions.',
  });
}

function verifyCanonicalBaselineActivationAuthorization(input = {}) {
  const forbidden = findForbiddenKeyMaterial(input);
  if (forbidden) return hold([`PRIVATE_SIGNING_KEY_MATERIAL_REJECTED:${forbidden}`], input.contract || null);

  const {
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    attestation,
  } = input;

  const contractBlockers = validateContractBoundary(contract);
  if (contractBlockers.length > 0) return hold(contractBlockers, contract);

  const verification = verifyHumanActivationAuthorization({
    contract,
    activationAuthorityRegistry,
    expectedActivationAuthorityRegistryHashSha256,
    attestation,
  });
  if (verification.status !== AUTHORIZATION_STATUS.VERIFIED_HUMAN_ACTIVATION_AUTHORIZATION || verification.verified !== true) {
    return hold(verification.blockers || ['SIGNED_OWNER_ACTIVATION_AUTHORIZATION_NOT_VERIFIED'], contract, verification.authorityRegistryHashSha256 || null);
  }

  return deepFreeze({
    schemaVersion: 1,
    status: STATUS.VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION,
    verified: true,
    blockers: Object.freeze([]),
    activationChangeContractHashSha256: contract.activationChangeContractHashSha256,
    authorityRegistryHashSha256: verification.authorityRegistryHashSha256,
    authorityId: verification.authorityId,
    ownerActorRef: verification.authorizedActorRef,
    publicKeySha256: verification.publicKeySha256,
    signedPayloadHashSha256: verification.signedPayloadHashSha256,
    signedAuthorizationVerificationHashSha256: verification.authorizationVerificationHashSha256,
    signatureVerified: true,
    trustRootVerified: true,
    humanDecisionRecordVerified: true,
    privateSigningKeyAccepted: false,
    activationAuthorizationValidatedForP40: true,
    activationAuthorizationGrantedByThisOperator: false,
    activationApplied: false,
    canonicalBaselineChanged: false,
    productionEvidenceEstablishedHere: false,
    ...RELEASE_AUTHORITY,
    semantics: 'P41 verifies the externally signed owner activation authorization using the existing P40 verifier and trust root. Verification proves the decision record binding only; the operator does not mutate the canonical registry or grant release, merge, deployment, go-live or transaction authority.',
  });
}

module.exports = {
  STATUS,
  prepareCanonicalBaselineActivationAuthorization,
  verifyCanonicalBaselineActivationAuthorization,
  findForbiddenKeyMaterial,
};
