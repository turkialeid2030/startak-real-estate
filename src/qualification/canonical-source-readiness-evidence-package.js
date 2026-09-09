'use strict';

const crypto = require('crypto');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
} = require('../../tools/canonical-source-evidence');
const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  createReadinessEvidenceSigningPayload,
} = require('../standards/production-evidence-go-live-readiness');

const PACKAGE_STATUS = Object.freeze({
  READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE: 'READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE',
});

const CANONICAL_SIGNING_POLICY = Object.freeze({
  requiredEvidenceTypes: Object.freeze([EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON]),
  allowedEvidenceResults: Object.freeze([EVIDENCE_RESULT.VERIFIED]),
  signatureAlgorithmsAllowed: Object.freeze(['RSA-SHA256']),
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionSecurityValidated: false,
  externalEvidenceAuthenticityValidatedHere: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character commit SHA`);
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  if (!Number.isFinite(Date.parse(normalized))) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return normalized;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeCanonicalSourceEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('canonicalSourceEvidence must be an object');
  }
  if (value.status !== CANONICAL_SOURCE_STATUS.VERIFIED || value.evaluated !== true || value.verified !== true) {
    throw new TypeError('canonicalSourceEvidence must be VERIFIED');
  }
  const expected = requiredSha256(value.expectedSha256, 'canonicalSourceEvidence.expectedSha256');
  const computed = requiredSha256(value.computedSha256, 'canonicalSourceEvidence.computedSha256');
  if (expected !== EXPECTED_CANONICAL_SHA256 || computed !== EXPECTED_CANONICAL_SHA256) {
    throw new TypeError('canonicalSourceEvidence must match the pinned canonical SHA-256');
  }
  return Object.freeze({ expectedSha256: expected, computedSha256: computed });
}

function createCanonicalSourceReadinessEvidencePackage({
  canonicalSourceEvidence,
  evidenceId,
  upstreamCloseoutPacketHashSha256,
  releaseCandidateId,
  sourceCommitSha,
  artifactSha256,
  environmentRef,
  environmentConfigSha256,
  verifierId,
  sourceRef,
  evidenceArtifactSha256,
  verifiedAt,
  expiresAt,
  scopeRef,
} = {}) {
  const canonical = normalizeCanonicalSourceEvidence(canonicalSourceEvidence);
  const opaqueSourceRef = `sha256:${sha256Text(requiredString(sourceRef, 'sourceRef'))}`;

  const unsignedRecord = {
    evidenceId: requiredString(evidenceId, 'evidenceId'),
    evidenceType: EVIDENCE_TYPE.CANONICAL_SOURCE_HASH_COMPARISON,
    upstreamCloseoutPacketHashSha256: requiredSha256(upstreamCloseoutPacketHashSha256, 'upstreamCloseoutPacketHashSha256'),
    releaseCandidateId: requiredString(releaseCandidateId, 'releaseCandidateId'),
    sourceCommitSha: requiredCommitSha(sourceCommitSha, 'sourceCommitSha'),
    artifactSha256: requiredSha256(artifactSha256, 'artifactSha256'),
    environmentRef: requiredString(environmentRef, 'environmentRef'),
    environmentConfigSha256: requiredSha256(environmentConfigSha256, 'environmentConfigSha256'),
    verifierId: requiredString(verifierId, 'verifierId'),
    sourceRef: opaqueSourceRef,
    evidenceArtifactSha256: requiredSha256(evidenceArtifactSha256, 'evidenceArtifactSha256'),
    verifiedAt: requiredTimestamp(verifiedAt, 'verifiedAt'),
    expiresAt: expiresAt == null ? undefined : requiredTimestamp(expiresAt, 'expiresAt'),
    result: EVIDENCE_RESULT.VERIFIED,
    scopeRef: requiredString(scopeRef, 'scopeRef'),
    signatureAlgorithm: 'RSA-SHA256',
  };

  const payload = createReadinessEvidenceSigningPayload(unsignedRecord, CANONICAL_SIGNING_POLICY);
  const signingBytes = Buffer.from(stableStringify(payload), 'utf8');
  const signingPayloadSha256 = crypto.createHash('sha256').update(signingBytes).digest('hex');

  return Object.freeze({
    schemaVersion: 1,
    status: PACKAGE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE,
    canonicalSourceHashSha256: canonical.computedSha256,
    evidenceType: payload.evidenceType,
    payload,
    signingPayloadBase64: signingBytes.toString('base64'),
    signingPayloadSha256,
    signatureAlgorithm: 'RSA-SHA256',
    signatureRequired: true,
    externalReadinessVerifierRequired: true,
    readinessVerifierRegistryTrustRootRequired: true,
    e2iAcceptancePending: true,
    externalEvidenceBlockerClosed: false,
    authority: AUTHORITY,
    semantics: 'This package converts an already VERIFIED pinned canonical-source comparison into the exact unsigned E2I readiness-evidence signing payload. It does not sign the payload, authenticate a verifier, verify an out-of-band readiness-verifier registry trust root, or close the canonical external-evidence blocker. Acceptance remains pending until an authorized external verifier signs the payload and the existing E2I gate validates that signature and trust root.',
  });
}

module.exports = {
  PACKAGE_STATUS,
  CANONICAL_SIGNING_POLICY,
  AUTHORITY,
  createCanonicalSourceReadinessEvidencePackage,
};
