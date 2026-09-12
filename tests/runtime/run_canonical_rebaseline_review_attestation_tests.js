'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { createCanonicalBaselineReconstitutionProposal } = require('../../src/qualification/canonical-baseline-reconstitution');
const {
  STATUS: P25_STATUS,
  DECISION_RESULT,
  createCanonicalRebaselineGovernanceDecision,
} = require('../../src/qualification/canonical-rebaseline-governance-decision');
const {
  createCanonicalRebaselineIndependentReviewPacket,
} = require('../../src/qualification/canonical-rebaseline-independent-review');
const {
  STATUS,
  normalizeRegistry,
  createIndependentReviewSigningPayload,
  createVerifiedIndependentReviewResponse,
  stableStringify,
} = require('../../src/qualification/canonical-rebaseline-review-attestation');

const H64 = (c) => c.repeat(64);
const COMMIT = 'a'.repeat(40);

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
const publicKeySha256 = crypto.createHash('sha256').update(publicKeyPem, 'utf8').digest('hex');

function proposal() {
  return createCanonicalBaselineReconstitutionProposal({
    proposalId: 'rebaseline-attestation-1',
    qualifiedSourceCommitSha: COMMIT,
    releaseArtifactSha256: H64('b'),
    environmentConfigSha256: H64('c'),
    preparedByRef: 'owner:1',
    independentReviewerRef: 'reviewer:2',
    preparedAt: '2026-09-09T18:00:00Z',
  });
}

function ownerDecision() {
  return {
    decisionId: 'owner-1',
    actorRef: 'owner:1',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'issue:250',
    decisionArtifactSha256: H64('d'),
    decidedAt: '2026-09-09T19:00:00Z',
    rationaleRef: 'owner-approved-governed-rebaseline',
  };
}

function packet() {
  return createCanonicalRebaselineIndependentReviewPacket({
    proposal: proposal(),
    ownerDecision: ownerDecision(),
    reviewRequestId: 'review-request-crypto-1',
    requestedAt: '2026-09-09T19:30:00Z',
  });
}

function registry() {
  return {
    registryId: 'rebaseline-reviewers-v1',
    governanceArtifactSha256: H64('e'),
    reviewers: [{
      reviewerId: 'reviewer-id-2',
      reviewerSubjectRef: 'reviewer:2',
      publicKeyPem,
      publicKeySha256,
      governanceEvidenceRef: 'governance:reviewer-2',
      activeFrom: '2026-09-01T00:00:00Z',
      activeUntil: '2026-12-31T23:59:59Z',
      allowedPurpose: 'CANONICAL_REBASELINE_INDEPENDENT_REVIEW',
    }],
  };
}

function unsignedAttestation(overrides = {}) {
  return {
    decisionId: 'review-decision-crypto-1',
    reviewerId: 'reviewer-id-2',
    actorRef: 'reviewer:2',
    result: DECISION_RESULT.APPROVE,
    decisionSourceRef: 'external-review:crypto-1',
    decisionArtifactSha256: H64('f'),
    decidedAt: '2026-09-09T20:00:00Z',
    rationaleRef: 'reviewed-and-approved',
    signatureAlgorithm: 'RSA-SHA256',
    ...overrides,
  };
}

function signedAttestation(p = packet(), overrides = {}) {
  const unsigned = unsignedAttestation(overrides);
  const payload = createIndependentReviewSigningPayload({ packet: p, attestation: unsigned });
  const signatureBase64 = crypto.sign('RSA-SHA256', Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...unsigned, signatureBase64 };
}

(function run() {
  const p = packet();
  const r = registry();
  const normalizedRegistry = normalizeRegistry(r);
  assert.match(normalizedRegistry.registryHashSha256, /^[a-f0-9]{64}$/);

  const good = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: r,
    expectedReviewerRegistryHashSha256: normalizedRegistry.registryHashSha256,
    attestation: signedAttestation(p),
  });
  assert.strictEqual(good.status, STATUS.VERIFIED_REVIEW_RESPONSE_READY_FOR_P25_REEVALUATION);
  assert.strictEqual(good.reviewerIdentityCryptographicallyVerified, true);
  assert.strictEqual(good.reviewerRegistryTrustRootVerified, true);
  assert.strictEqual(good.reviewAttestationSignatureVerified, true);
  assert.strictEqual(good.externalReviewArtifactContentVerifiedHere, false);
  assert.strictEqual(good.releaseAuthorized, false);
  assert.strictEqual(good.canonicalBaselineChanged, false);
  assert.strictEqual(Object.isFrozen(good), true);

  const p25 = createCanonicalRebaselineGovernanceDecision({
    proposal: proposal(),
    ownerDecision: ownerDecision(),
    independentReview: good.independentReview,
  });
  assert.strictEqual(p25.status, P25_STATUS.READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE);
  assert.strictEqual(p25.canonicalBaselineChanged, false);

  const badRegistryHash = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: r,
    expectedReviewerRegistryHashSha256: H64('1'),
    attestation: signedAttestation(p),
  });
  assert.strictEqual(badRegistryHash.status, STATUS.HOLD_REVIEWER_TRUST_ROOT);

  const tampered = signedAttestation(p);
  tampered.rationaleRef = 'tampered-after-signing';
  const badSignature = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: r,
    expectedReviewerRegistryHashSha256: normalizedRegistry.registryHashSha256,
    attestation: tampered,
  });
  assert.strictEqual(badSignature.status, STATUS.HOLD_REVIEW_ATTESTATION);
  assert.strictEqual(badSignature.reviewAttestationSignatureVerified, false);

  const wrongSubjectRegistry = registry();
  wrongSubjectRegistry.reviewers[0] = { ...wrongSubjectRegistry.reviewers[0], reviewerSubjectRef: 'reviewer:other' };
  const wrongSubjectNormalized = normalizeRegistry(wrongSubjectRegistry);
  const wrongSubject = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: wrongSubjectRegistry,
    expectedReviewerRegistryHashSha256: wrongSubjectNormalized.registryHashSha256,
    attestation: signedAttestation(p),
  });
  assert.strictEqual(wrongSubject.status, STATUS.HOLD_REVIEW_ATTESTATION);

  const wrongPurposeRegistry = registry();
  wrongPurposeRegistry.reviewers[0] = { ...wrongPurposeRegistry.reviewers[0], allowedPurpose: 'OTHER_PURPOSE' };
  const wrongPurposeNormalized = normalizeRegistry(wrongPurposeRegistry);
  const wrongPurpose = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: wrongPurposeRegistry,
    expectedReviewerRegistryHashSha256: wrongPurposeNormalized.registryHashSha256,
    attestation: signedAttestation(p),
  });
  assert.strictEqual(wrongPurpose.status, STATUS.HOLD_REVIEW_ATTESTATION);

  const expiredRegistry = registry();
  expiredRegistry.reviewers[0] = { ...expiredRegistry.reviewers[0], activeUntil: '2026-09-08T23:59:59Z' };
  const expiredNormalized = normalizeRegistry(expiredRegistry);
  const expired = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: expiredRegistry,
    expectedReviewerRegistryHashSha256: expiredNormalized.registryHashSha256,
    attestation: signedAttestation(p),
  });
  assert.strictEqual(expired.status, STATUS.HOLD_REVIEW_ATTESTATION);

  const missingSignature = createVerifiedIndependentReviewResponse({
    packet: p,
    reviewerRegistry: r,
    expectedReviewerRegistryHashSha256: normalizedRegistry.registryHashSha256,
    attestation: unsignedAttestation(),
  });
  assert.strictEqual(missingSignature.status, STATUS.HOLD_REVIEW_ATTESTATION);

  console.log('canonical rebaseline review attestation tests: PASS');
})();
