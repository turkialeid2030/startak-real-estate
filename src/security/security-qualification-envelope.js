'use strict';

const crypto = require('crypto');
const { SECURITY_EVIDENCE_TRUST_STATUS } = require('./security-evidence-trust-gate.js');

const SECURITY_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SECURITY_VALIDATION: 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION',
  HOLD_UPSTREAM_SECURITY_EVIDENCE: 'HOLD_UPSTREAM_SECURITY_EVIDENCE',
  HOLD_REQUIRED_CONTROL_EVIDENCE: 'HOLD_REQUIRED_CONTROL_EVIDENCE',
  HOLD_ENVIRONMENT_SCOPE: 'HOLD_ENVIRONMENT_SCOPE',
  HOLD_EVIDENCE_FRESHNESS: 'HOLD_EVIDENCE_FRESHNESS',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
  HOLD_REVIEW_METADATA: 'HOLD_REVIEW_METADATA',
});

const SECURITY_EVIDENCE_ENVIRONMENT = Object.freeze({
  CI_TEST: 'CI_TEST',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION',
});

const SECURITY_CONTROL_CLASS = Object.freeze({
  TENANT_ISOLATION_RLS: 'TENANT_ISOLATION_RLS',
  RUNTIME_IDENTITY: 'RUNTIME_IDENTITY',
  AUTHORIZATION: 'AUTHORIZATION',
  STORAGE_SECURITY: 'STORAGE_SECURITY',
  REPLAY_AND_BINDING: 'REPLAY_AND_BINDING',
  AUDIT_AND_TELEMETRY: 'AUDIT_AND_TELEMETRY',
  KEY_ROTATION_AND_BREAK_GLASS: 'KEY_ROTATION_AND_BREAK_GLASS',
  DEPENDENCY_AND_SUPPLY_CHAIN: 'DEPENDENCY_AND_SUPPLY_CHAIN',
  PRIVACY_DATA_PROTECTION: 'PRIVACY_DATA_PROTECTION',
  EXTERNAL_PENETRATION_TEST: 'EXTERNAL_PENETRATION_TEST',
});

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function parseTime(value, field) {
  const normalized = requiredString(value, field);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return { value: normalized, millis };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function createSecurityQualificationEvidence(input = {}) {
  const observed = parseTime(input.observedAt, 'observedAt');
  const reviewed = parseTime(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < observed.millis) throw new TypeError('reviewedAt must not precede observedAt');
  if (!Object.values(SECURITY_EVIDENCE_ENVIRONMENT).includes(input.environmentClass)) throw new TypeError('environmentClass is invalid');
  if (!Object.values(SECURITY_CONTROL_CLASS).includes(input.controlClass)) throw new TypeError('controlClass is invalid');

  const exactCommitSha = requiredString(input.exactCommitSha, 'exactCommitSha');
  if (!/^[a-f0-9]{40}$/i.test(exactCommitSha)) throw new TypeError('exactCommitSha must be a 40-character git SHA');
  const artifactHashSha256 = requiredString(input.artifactHashSha256, 'artifactHashSha256');
  if (!isSha256(artifactHashSha256)) throw new TypeError('artifactHashSha256 must be SHA-256 hex');

  const evidence = {
    evidenceId: requiredString(input.evidenceId, 'evidenceId'),
    controlRef: requiredString(input.controlRef, 'controlRef'),
    controlClass: input.controlClass,
    environmentClass: input.environmentClass,
    environmentRef: requiredString(input.environmentRef, 'environmentRef'),
    exactCommitSha,
    artifactId: requiredString(input.artifactId, 'artifactId'),
    artifactHashSha256: artifactHashSha256.toLowerCase(),
    evidenceRef: requiredString(input.evidenceRef, 'evidenceRef'),
    result: requiredString(input.result, 'result'),
    observedAt: observed.value,
    reviewedAt: reviewed.value,
    reviewerRef: requiredString(input.reviewerRef, 'reviewerRef'),
    issuerRef: requiredString(input.issuerRef, 'issuerRef'),
  };
  return Object.freeze({ ...evidence, evidenceHashSha256: hashObject(evidence) });
}

function verifySecurityQualificationEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return Object.freeze({ valid: false, reason: 'EVIDENCE_REQUIRED' });
  const { evidenceHashSha256, ...payload } = evidence;
  if (!isSha256(evidenceHashSha256)) return Object.freeze({ valid: false, reason: 'EVIDENCE_HASH_INVALID' });
  const expected = hashObject(payload);
  return Object.freeze({ valid: expected === evidenceHashSha256, reason: expected === evidenceHashSha256 ? null : 'EVIDENCE_HASH_MISMATCH' });
}

function buildSecurityQualificationEnvelope({
  qualificationId,
  upstreamSecurityTrustGate,
  targetEnvironmentClass,
  targetEnvironmentRef,
  exactCommitSha,
  requiredControlRefs,
  evidence,
  maximumEvidenceAgeSeconds,
  assessedAt,
  preparedBy,
  reviewedBy,
  preparedAt,
  reviewedAt,
} = {}) {
  const assessed = parseTime(assessedAt, 'assessedAt');
  const prepared = parseTime(preparedAt, 'preparedAt');
  const reviewed = parseTime(reviewedAt, 'reviewedAt');
  if (reviewed.millis < prepared.millis || assessed.millis < reviewed.millis) throw new TypeError('qualification timestamps must satisfy preparedAt <= reviewedAt <= assessedAt');
  if (!upstreamSecurityTrustGate || typeof upstreamSecurityTrustGate !== 'object') throw new TypeError('upstreamSecurityTrustGate is required');
  if (!Object.values(SECURITY_EVIDENCE_ENVIRONMENT).includes(targetEnvironmentClass)) throw new TypeError('targetEnvironmentClass is invalid');
  const environmentRef = requiredString(targetEnvironmentRef, 'targetEnvironmentRef');
  const commitSha = requiredString(exactCommitSha, 'exactCommitSha');
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) throw new TypeError('exactCommitSha must be a 40-character git SHA');
  if (!Number.isFinite(maximumEvidenceAgeSeconds) || maximumEvidenceAgeSeconds < 0) throw new TypeError('maximumEvidenceAgeSeconds must be a finite non-negative number');
  if (!Array.isArray(requiredControlRefs) || requiredControlRefs.length === 0) throw new TypeError('requiredControlRefs must be a non-empty array');
  if (!Array.isArray(evidence) || evidence.length === 0) throw new TypeError('evidence must be a non-empty array');

  const required = [...new Set(requiredControlRefs.map((ref, index) => requiredString(ref, `requiredControlRefs[${index}]`)))];
  const byControl = new Map();
  const reasonCodes = [];
  let status = SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION;

  for (const [index, item] of evidence.entries()) {
    if (!item || typeof item !== 'object') throw new TypeError(`evidence[${index}] must be an object`);
    const controlRef = requiredString(item.controlRef, `evidence[${index}].controlRef`);
    if (byControl.has(controlRef)) {
      status = SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE;
      reasonCodes.push(`DUPLICATE_CONTROL_EVIDENCE:${controlRef}`);
    } else {
      byControl.set(controlRef, item);
    }
  }

  if (upstreamSecurityTrustGate.status !== SECURITY_EVIDENCE_TRUST_STATUS.READY_FOR_INDEPENDENT_SECURITY_REVIEW) {
    status = SECURITY_QUALIFICATION_STATUS.HOLD_UPSTREAM_SECURITY_EVIDENCE;
    reasonCodes.push(`UPSTREAM_${String(upstreamSecurityTrustGate.status || 'UNKNOWN')}`);
  }

  const missing = required.filter((ref) => !byControl.has(ref));
  if (missing.length > 0 && status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) {
    status = SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROL_EVIDENCE;
    reasonCodes.push(...missing.map((ref) => `MISSING_CONTROL_EVIDENCE:${ref}`));
  }

  if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) {
    for (const ref of required) {
      const item = byControl.get(ref);
      if (!verifySecurityQualificationEvidence(item).valid) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
        reasonCodes.push(`EVIDENCE_INTEGRITY:${ref}`);
        break;
      }
      if (item.environmentClass !== targetEnvironmentClass || item.environmentRef !== environmentRef || item.exactCommitSha !== commitSha) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_ENVIRONMENT_SCOPE;
        reasonCodes.push(`EVIDENCE_SCOPE:${ref}`);
        break;
      }
      const itemReviewed = parseTime(item.reviewedAt, `evidence.${ref}.reviewedAt`);
      if (itemReviewed.millis > assessed.millis || (assessed.millis - itemReviewed.millis) / 1000 > maximumEvidenceAgeSeconds) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_FRESHNESS;
        reasonCodes.push(`EVIDENCE_FRESHNESS:${ref}`);
        break;
      }
      if (!requiredString(item.reviewerRef, `evidence.${ref}.reviewerRef`)) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_REVIEW_METADATA;
        reasonCodes.push(`EVIDENCE_REVIEWER:${ref}`);
        break;
      }
    }
  }

  const payload = {
    qualificationId: requiredString(qualificationId, 'qualificationId'),
    status,
    reasonCodes,
    targetEnvironmentClass,
    targetEnvironmentRef: environmentRef,
    exactCommitSha: commitSha,
    requiredControlRefs: required,
    evidenceHashesSha256: required.map((ref) => byControl.get(ref)?.evidenceHashSha256 || null),
    upstreamSecurityTrustStatus: upstreamSecurityTrustGate.status || null,
    maximumEvidenceAgeSeconds,
    assessedAt: assessed.value,
    preparedBy: requiredString(preparedBy, 'preparedBy'),
    reviewedBy: requiredString(reviewedBy, 'reviewedBy'),
    preparedAt: prepared.value,
    reviewedAt: reviewed.value,
    productionSecurityValidated: false,
    pdplComplianceEstablished: false,
    externalPenetrationTestEstablished: false,
    certifiedSecurityEstablished: false,
    cryptographicSignatureVerificationPerformedHere: false,
    liveEnvironmentTestingPerformedHere: false,
    independentSecurityValidationRequired: true,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  };

  return Object.freeze({
    ...payload,
    reasonCodes: Object.freeze([...reasonCodes]),
    requiredControlRefs: Object.freeze([...required]),
    evidenceHashesSha256: Object.freeze([...payload.evidenceHashesSha256]),
    qualificationHashSha256: hashObject(payload),
    semantics: 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION means the caller-supplied, content-addressed control evidence passed deterministic completeness, scope, exact-commit, freshness, review-metadata, upstream-trust-status, and hash-integrity checks. It does not establish production security, PDPL compliance, penetration-test completion, certification, merge authority, or deployment authority.',
  });
}

function verifySecurityQualificationEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return Object.freeze({ valid: false, reason: 'QUALIFICATION_ENVELOPE_REQUIRED' });
  const { qualificationHashSha256, semantics, ...payload } = envelope;
  if (!isSha256(qualificationHashSha256)) return Object.freeze({ valid: false, reason: 'QUALIFICATION_HASH_INVALID' });
  const expected = hashObject(payload);
  return Object.freeze({ valid: expected === qualificationHashSha256, reason: expected === qualificationHashSha256 ? null : 'QUALIFICATION_HASH_MISMATCH' });
}

module.exports = {
  SECURITY_QUALIFICATION_STATUS,
  SECURITY_EVIDENCE_ENVIRONMENT,
  SECURITY_CONTROL_CLASS,
  createSecurityQualificationEvidence,
  verifySecurityQualificationEvidence,
  buildSecurityQualificationEnvelope,
  verifySecurityQualificationEnvelope,
};
