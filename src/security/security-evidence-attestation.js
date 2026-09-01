'use strict';

const ATTESTATION_STATUS = Object.freeze({
  ATTESTATION_EVIDENCE_COMPLETE: 'ATTESTATION_EVIDENCE_COMPLETE',
  HOLD_ATTESTATION_METADATA: 'HOLD_ATTESTATION_METADATA',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_HASH_MISMATCH: 'HOLD_HASH_MISMATCH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  HOLD_UNTRUSTED_ISSUER: 'HOLD_UNTRUSTED_ISSUER',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireString(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function parseTimestamp(value, field) {
  const normalized = requireString(value, field);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return { value: normalized, millis };
}

function evaluateSecurityEvidenceAttestation(input = {}) {
  const evidenceId = requireString(input.evidenceId, 'evidenceId');
  const environment = requireString(input.environment, 'environment');
  const targetRef = requireString(input.targetRef, 'targetRef');
  const issuerRef = requireString(input.issuerRef, 'issuerRef');
  const contentHash = requireString(input.contentHash, 'contentHash');
  const expectedContentHash = requireString(input.expectedContentHash, 'expectedContentHash');
  const issued = parseTimestamp(input.issuedAt, 'issuedAt');
  const verified = parseTimestamp(input.verifiedAt, 'verifiedAt');
  const assessed = parseTimestamp(input.assessedAt, 'assessedAt');

  const trustedIssuerRefs = Array.isArray(input.trustedIssuerRefs)
    ? input.trustedIssuerRefs.map((value, index) => requireString(value, `trustedIssuerRefs[${index}]`))
    : [];
  const expectedEnvironment = input.expectedEnvironment == null ? environment : requireString(input.expectedEnvironment, 'expectedEnvironment');
  const expectedTargetRef = input.expectedTargetRef == null ? targetRef : requireString(input.expectedTargetRef, 'expectedTargetRef');
  const maxAgeSeconds = input.maxAgeSeconds;
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) throw new TypeError('maxAgeSeconds must be a finite non-negative number');

  let status = ATTESTATION_STATUS.ATTESTATION_EVIDENCE_COMPLETE;
  const reasonCodes = [];

  if (trustedIssuerRefs.length === 0) {
    status = ATTESTATION_STATUS.HOLD_ATTESTATION_METADATA;
    reasonCodes.push('TRUSTED_ISSUER_LIST_REQUIRED');
  } else if (environment !== expectedEnvironment || targetRef !== expectedTargetRef) {
    status = ATTESTATION_STATUS.HOLD_SCOPE_MISMATCH;
    reasonCodes.push('EVIDENCE_SCOPE_MISMATCH');
  } else if (!trustedIssuerRefs.includes(issuerRef)) {
    status = ATTESTATION_STATUS.HOLD_UNTRUSTED_ISSUER;
    reasonCodes.push('EVIDENCE_ISSUER_NOT_TRUSTED');
  } else if (contentHash !== expectedContentHash) {
    status = ATTESTATION_STATUS.HOLD_HASH_MISMATCH;
    reasonCodes.push('EVIDENCE_CONTENT_HASH_MISMATCH');
  } else if (verified.millis < issued.millis || assessed.millis < verified.millis) {
    status = ATTESTATION_STATUS.HOLD_ATTESTATION_METADATA;
    reasonCodes.push('ATTESTATION_TIME_ORDER_INVALID');
  } else if ((assessed.millis - verified.millis) / 1000 > maxAgeSeconds) {
    status = ATTESTATION_STATUS.HOLD_STALE_EVIDENCE;
    reasonCodes.push('EVIDENCE_EXCEEDS_MAX_AGE');
  }

  return Object.freeze({
    status,
    evidenceId,
    environment,
    targetRef,
    issuerRef,
    contentHash,
    issuedAt: issued.value,
    verifiedAt: verified.value,
    assessedAt: assessed.value,
    maxAgeSeconds,
    reasonCodes: Object.freeze(reasonCodes),
    cryptographicSignatureVerifiedByThisModule: false,
    contentFetchedByThisModule: false,
    issuerTrustEstablishedByThisModule: false,
    productionSecurityVerifiedByThisModule: false,
    transactionAuthorized: false,
    semantics: 'This deterministic evaluator checks caller-supplied security evidence attestation metadata, scope, hash equality, issuer allow-list membership, and freshness. It does not fetch evidence, verify digital signatures, establish issuer trust independently, or certify production security.',
  });
}

module.exports = {
  ATTESTATION_STATUS,
  evaluateSecurityEvidenceAttestation,
};
