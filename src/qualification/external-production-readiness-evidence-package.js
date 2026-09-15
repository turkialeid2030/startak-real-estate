'use strict';

const crypto = require('crypto');
const {
  EVIDENCE_TYPE,
  EVIDENCE_RESULT,
  createReadinessEvidenceSigningPayload,
} = require('../standards/production-evidence-go-live-readiness');

const PACKAGE_STATUS = Object.freeze({
  READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE: 'READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE',
});

const BUNDLE_STATUS = Object.freeze({
  EXTERNAL_READINESS_EVIDENCE_ACQUISITION_INCOMPLETE: 'EXTERNAL_READINESS_EVIDENCE_ACQUISITION_INCOMPLETE',
  READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURES: 'READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURES',
});

const EXTERNAL_PRODUCTION_EVIDENCE_TYPES = Object.freeze([
  EVIDENCE_TYPE.SAUDI_LEGAL_OPERATING_MODE_REVIEW,
  EVIDENCE_TYPE.PDPL_DATA_GOVERNANCE_REVIEW,
  EVIDENCE_TYPE.PROFESSIONAL_STANDARDS_SCOPE_REVIEW,
  EVIDENCE_TYPE.PRODUCTION_EXECUTION_CHAIN_CONFIRMATION,
  EVIDENCE_TYPE.OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION,
]);

const SIGNING_POLICY = Object.freeze({
  requiredEvidenceTypes: EXTERNAL_PRODUCTION_EVIDENCE_TYPES,
  allowedEvidenceResults: Object.freeze(Object.values(EVIDENCE_RESULT)),
  signatureAlgorithmsAllowed: Object.freeze(['RSA-SHA256']),
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionSecurityValidated: false,
  legalApprovalEstablished: false,
  professionalAuthorityEstablished: false,
  externalEvidenceAuthenticityValidatedHere: false,
  externalEvidenceBlockerClosed: false,
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

function normalizeEvidenceType(value) {
  const evidenceType = requiredString(value, 'evidenceType');
  if (!EXTERNAL_PRODUCTION_EVIDENCE_TYPES.includes(evidenceType)) {
    throw new TypeError(`evidenceType must be one of the five non-canonical E2I external production evidence types: ${evidenceType}`);
  }
  return evidenceType;
}

function normalizeEvidenceResult(value) {
  const result = requiredString(value, 'result');
  if (!Object.values(EVIDENCE_RESULT).includes(result)) throw new TypeError(`result is not allowed: ${result}`);
  return result;
}

function createExternalProductionReadinessEvidencePackage({
  evidenceType,
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
  result = EVIDENCE_RESULT.VERIFIED,
  scopeRef,
} = {}) {
  const normalizedEvidenceType = normalizeEvidenceType(evidenceType);
  const normalizedResult = normalizeEvidenceResult(result);
  const opaqueSourceRef = `sha256:${sha256Text(requiredString(sourceRef, 'sourceRef'))}`;

  const unsignedRecord = {
    evidenceId: requiredString(evidenceId, 'evidenceId'),
    evidenceType: normalizedEvidenceType,
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
    result: normalizedResult,
    scopeRef: requiredString(scopeRef, 'scopeRef'),
    signatureAlgorithm: 'RSA-SHA256',
  };

  const payload = createReadinessEvidenceSigningPayload(unsignedRecord, SIGNING_POLICY);
  const signingBytes = Buffer.from(stableStringify(payload), 'utf8');
  const signingPayloadSha256 = crypto.createHash('sha256').update(signingBytes).digest('hex');

  return Object.freeze({
    schemaVersion: 1,
    status: PACKAGE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE,
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
    privateSigningKeyAccepted: false,
    authority: AUTHORITY,
    semantics: 'This package prepares the exact unsigned E2I signing payload for one non-canonical external production-readiness evidence class. It does not sign evidence, authenticate a verifier, validate an out-of-band trust root, establish legal or professional approval, close an external-evidence blocker, authorize release/merge/deployment/go-live/transactions, or constitute E2I acceptance.',
  });
}

function createExternalProductionReadinessEvidenceAcquisitionBundle({ evidenceInputs = [] } = {}) {
  if (!Array.isArray(evidenceInputs)) throw new TypeError('evidenceInputs must be an array');

  const seen = new Set();
  const packages = evidenceInputs.map((input, index) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`evidenceInputs[${index}] must be an object`);
    const evidenceType = normalizeEvidenceType(input.evidenceType);
    if (seen.has(evidenceType)) throw new TypeError(`duplicate external evidence type: ${evidenceType}`);
    seen.add(evidenceType);
    return createExternalProductionReadinessEvidencePackage(input);
  });

  const missingEvidenceTypes = EXTERNAL_PRODUCTION_EVIDENCE_TYPES.filter((type) => !seen.has(type));
  const status = missingEvidenceTypes.length === 0
    ? BUNDLE_STATUS.READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURES
    : BUNDLE_STATUS.EXTERNAL_READINESS_EVIDENCE_ACQUISITION_INCOMPLETE;

  return Object.freeze({
    schemaVersion: 1,
    status,
    requiredEvidenceTypes: EXTERNAL_PRODUCTION_EVIDENCE_TYPES,
    preparedEvidenceTypes: Object.freeze([...seen]),
    missingEvidenceTypes: Object.freeze([...missingEvidenceTypes]),
    packages: Object.freeze(packages),
    allFiveNonCanonicalEvidenceClassesPrepared: missingEvidenceTypes.length === 0,
    signaturesStillRequired: packages.length > 0,
    e2iAcceptancePending: true,
    canonicalSourceEvidenceHandledSeparately: true,
    privateSigningKeyAccepted: false,
    authority: AUTHORITY,
    semantics: 'This bundle is an acquisition/signing handoff only. Complete preparation of all five non-canonical E2I evidence classes does not mean they are authentic, signed, accepted, or sufficient for go-live. CANONICAL_SOURCE_HASH_COMPARISON remains on its existing separately governed operator/package path, and E2I remains the final acceptance boundary.',
  });
}

module.exports = {
  PACKAGE_STATUS,
  BUNDLE_STATUS,
  EXTERNAL_PRODUCTION_EVIDENCE_TYPES,
  SIGNING_POLICY,
  AUTHORITY,
  createExternalProductionReadinessEvidencePackage,
  createExternalProductionReadinessEvidenceAcquisitionBundle,
};
