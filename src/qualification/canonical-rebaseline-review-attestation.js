'use strict';

const crypto = require('crypto');
const {
  STATUS: P26_STATUS,
} = require('./canonical-rebaseline-independent-review');
const {
  DECISION_RESULT,
} = require('./canonical-rebaseline-governance-decision');

const STATUS = Object.freeze({
  HOLD_REVIEW_PACKET: 'HOLD_REVIEW_PACKET',
  HOLD_REVIEWER_TRUST_ROOT: 'HOLD_REVIEWER_TRUST_ROOT',
  HOLD_REVIEW_ATTESTATION: 'HOLD_REVIEW_ATTESTATION',
  VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION: 'VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION',
});

const AUTHORITY = Object.freeze({
  canonicalBaselineChanged: false,
  legacyCanonicalEvidenceClosed: false,
  existingE2iCanonicalEvidenceSatisfied: false,
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
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

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hold(status, blockers, packet = null, registryHashSha256 = null) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers: Object.freeze([...blockers]),
    reviewRequestId: packet?.reviewRequestId || null,
    reviewPacketHashSha256: packet?.reviewPacketHashSha256 || null,
    reviewerRegistryHashSha256: registryHashSha256,
    reviewerIdentityCryptographicallyVerified: false,
    reviewerRegistryTrustRootVerified: false,
    reviewAttestationSignatureVerified: false,
    externalReviewArtifactContentVerifiedHere: false,
    p25ReevaluationRequired: false,
    automaticBaselineSwitchAllowed: false,
    ...AUTHORITY,
  });
}

function normalizeRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new TypeError('reviewerRegistry must be an object');
  const records = registry.reviewers;
  if (!Array.isArray(records) || records.length === 0) throw new TypeError('reviewerRegistry.reviewers must be non-empty');
  const seen = new Set();
  const reviewers = records.map((record) => {
    const reviewerId = requiredString(record.reviewerId, 'reviewer.reviewerId');
    if (seen.has(reviewerId)) throw new TypeError(`DUPLICATE_REVIEWER_ID:${reviewerId}`);
    seen.add(reviewerId);
    const publicKeyPem = requiredString(record.publicKeyPem, 'reviewer.publicKeyPem');
    const publicKeySha256 = requiredSha256(record.publicKeySha256, 'reviewer.publicKeySha256');
    if (sha256(publicKeyPem) !== publicKeySha256) throw new TypeError(`REVIEWER_PUBLIC_KEY_HASH_MISMATCH:${reviewerId}`);
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
    registryId: requiredString(registry.registryId, 'reviewerRegistry.registryId'),
    governanceArtifactSha256: requiredSha256(registry.governanceArtifactSha256, 'reviewerRegistry.governanceArtifactSha256'),
    reviewers,
  };
  return deepFreeze({ ...core, registryHashSha256: sha256(core) });
}

function createIndependentReviewSigningPayload({ packet, attestation } = {}) {
  if (!packet || packet.status !== P26_STATUS.READY_FOR_INDEPENDENT_REVIEW || !SHA256_RE.test(packet.reviewPacketHashSha256 || '')) {
    throw new TypeError('P26_REVIEW_PACKET_NOT_QUALIFIED');
  }
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) throw new TypeError('attestation must be an object');
  const result = requiredString(attestation.result, 'attestation.result');
  if (!Object.values(DECISION_RESULT).includes(result)) throw new TypeError('attestation.result invalid');
  const algorithm = requiredString(attestation.signatureAlgorithm, 'attestation.signatureAlgorithm');
  if (algorithm !== 'RSA-SHA256') throw new TypeError('REVIEW_ATTESTATION_SIGNATURE_ALGORITHM_INVALID');
  return deepFreeze({
    schemaVersion: 1,
    purpose: 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW',
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    proposalId: packet.proposalId,
    proposalHashSha256: packet.proposalHashSha256,
    qualifiedSourceCommitSha: packet.qualifiedSourceCommitSha,
    releaseArtifactSha256: packet.releaseArtifactSha256,
    environmentConfigSha256: packet.environmentConfigSha256,
    decisionId: requiredString(attestation.decisionId, 'attestation.decisionId'),
    reviewerId: requiredString(attestation.reviewerId, 'attestation.reviewerId'),
    actorRef: requiredString(attestation.actorRef, 'attestation.actorRef'),
    result,
    decisionSourceRef: requiredString(attestation.decisionSourceRef, 'attestation.decisionSourceRef'),
    decisionArtifactSha256: requiredSha256(attestation.decisionArtifactSha256, 'attestation.decisionArtifactSha256'),
    decidedAt: iso(attestation.decidedAt, 'attestation.decidedAt'),
    rationaleRef: requiredString(attestation.rationaleRef, 'attestation.rationaleRef'),
    signatureAlgorithm: algorithm,
  });
}

function createVerifiedIndependentReviewResponse({
  packet,
  reviewerRegistry,
  expectedReviewerRegistryHashSha256,
  attestation,
} = {}) {
  if (!packet || packet.status !== P26_STATUS.READY_FOR_INDEPENDENT_REVIEW || !SHA256_RE.test(packet.reviewPacketHashSha256 || '')) {
    return hold(STATUS.HOLD_REVIEW_PACKET, ['P26_REVIEW_PACKET_NOT_QUALIFIED'], packet);
  }

  let registry;
  let expectedHash;
  try {
    registry = normalizeRegistry(reviewerRegistry);
    expectedHash = requiredSha256(expectedReviewerRegistryHashSha256, 'expectedReviewerRegistryHashSha256');
  } catch (error) {
    return hold(STATUS.HOLD_REVIEWER_TRUST_ROOT, [error.message], packet);
  }
  if (registry.registryHashSha256 !== expectedHash) {
    return hold(STATUS.HOLD_REVIEWER_TRUST_ROOT, ['REVIEWER_REGISTRY_HASH_MISMATCH'], packet, registry.registryHashSha256);
  }

  let payload;
  try {
    payload = createIndependentReviewSigningPayload({ packet, attestation });
  } catch (error) {
    return hold(STATUS.HOLD_REVIEW_ATTESTATION, [error.message], packet, registry.registryHashSha256);
  }

  const reviewer = registry.reviewers.find((record) => record.reviewerId === payload.reviewerId);
  if (!reviewer) return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEWER_NOT_IN_TRUSTED_REGISTRY'], packet, registry.registryHashSha256);
  if (reviewer.reviewerSubjectRef !== packet.independentReviewerRef || payload.actorRef !== packet.independentReviewerRef) {
    return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEWER_SUBJECT_SCOPE_MISMATCH'], packet, registry.registryHashSha256);
  }
  if (payload.actorRef === packet.ownerActorRef) {
    return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['OWNER_AND_INDEPENDENT_REVIEWER_MUST_DIFFER'], packet, registry.registryHashSha256);
  }
  if (reviewer.allowedPurpose !== payload.purpose) {
    return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEWER_PURPOSE_NOT_ALLOWED'], packet, registry.registryHashSha256);
  }
  const decidedMs = Date.parse(payload.decidedAt);
  if (decidedMs < Date.parse(reviewer.activeFrom) || (reviewer.activeUntil && decidedMs > Date.parse(reviewer.activeUntil))) {
    return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEWER_OUTSIDE_ACTIVE_PERIOD'], packet, registry.registryHashSha256);
  }

  const signatureBase64 = typeof attestation?.signatureBase64 === 'string' ? attestation.signatureBase64.trim() : '';
  if (!signatureBase64) return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEW_ATTESTATION_SIGNATURE_REQUIRED'], packet, registry.registryHashSha256);
  let signatureVerified = false;
  try {
    signatureVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(stableStringify(payload), 'utf8'),
      reviewer.publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch (error) {
    signatureVerified = false;
  }
  if (!signatureVerified) return hold(STATUS.HOLD_REVIEW_ATTESTATION, ['REVIEW_ATTESTATION_SIGNATURE_INVALID'], packet, registry.registryHashSha256);

  const independentReview = deepFreeze({
    decisionId: payload.decisionId,
    actorRef: payload.actorRef,
    result: payload.result,
    decisionSourceRef: payload.decisionSourceRef,
    decisionArtifactSha256: payload.decisionArtifactSha256,
    decidedAt: payload.decidedAt,
    rationaleRef: payload.rationaleRef,
  });

  const core = {
    schemaVersion: 1,
    reviewRequestId: packet.reviewRequestId,
    reviewPacketHashSha256: packet.reviewPacketHashSha256,
    reviewerRegistryHashSha256: registry.registryHashSha256,
    reviewerId: payload.reviewerId,
    reviewerSubjectRef: reviewer.reviewerSubjectRef,
    publicKeySha256: reviewer.publicKeySha256,
    independentReview,
    signedPayloadHashSha256: sha256(payload),
  };

  return deepFreeze({
    ...core,
    status: STATUS.VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION,
    verifiedResponseHashSha256: sha256(core),
    reviewerIdentityCryptographicallyVerified: true,
    reviewerRegistryTrustRootVerified: true,
    reviewAttestationSignatureVerified: true,
    externalReviewArtifactContentVerifiedHere: false,
    p25ReevaluationRequired: true,
    automaticBaselineSwitchAllowed: false,
    ...AUTHORITY,
    semantics: 'The reviewer decision metadata is cryptographically bound to the exact P26 review packet and a pinned out-of-band reviewer registry. This verifies the signed decision record, not the substantive contents of the external review artifact, and does not activate the canonical baseline or grant release authority.',
  });
}

module.exports = {
  STATUS,
  AUTHORITY,
  normalizeRegistry,
  createIndependentReviewSigningPayload,
  createVerifiedIndependentReviewResponse,
  stableStringify,
};
