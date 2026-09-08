'use strict';

const crypto = require('crypto');

const SECURITY_EVIDENCE_ENVIRONMENT = Object.freeze({
  CI_TEST: 'CI_TEST',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION',
});

const SECURITY_CONTROL_CLASS = Object.freeze({
  IDENTITY_AUTHENTICATION: 'IDENTITY_AUTHENTICATION',
  AUTHORIZATION_TENANT_ISOLATION: 'AUTHORIZATION_TENANT_ISOLATION',
  RLS_DATABASE: 'RLS_DATABASE',
  AUDIT_LOGGING: 'AUDIT_LOGGING',
  STORAGE_INTEGRITY: 'STORAGE_INTEGRITY',
  SECRET_KEY_MANAGEMENT: 'SECRET_KEY_MANAGEMENT',
  REPLAY_IDEMPOTENCY: 'REPLAY_IDEMPOTENCY',
  INCIDENT_BREAK_GLASS: 'INCIDENT_BREAK_GLASS',
  VULNERABILITY_DEPENDENCY: 'VULNERABILITY_DEPENDENCY',
  APPLICATION_RUNTIME: 'APPLICATION_RUNTIME',
  BACKUP_RECOVERY: 'BACKUP_RECOVERY',
});

const SECURITY_EVIDENCE_SOURCE_KIND = Object.freeze({
  CI_RUN: 'CI_RUN',
  RUNTIME_ATTESTATION: 'RUNTIME_ATTESTATION',
  DATABASE_RUNTIME_TEST: 'DATABASE_RUNTIME_TEST',
  CONFIGURATION_SNAPSHOT: 'CONFIGURATION_SNAPSHOT',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  PENETRATION_TEST_REPORT: 'PENETRATION_TEST_REPORT',
  DEPENDENCY_SCAN: 'DEPENDENCY_SCAN',
});

const SECURITY_EVIDENCE_OUTCOME = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
});

const SECURITY_QUALIFICATION_STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SECURITY_VALIDATION: 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION',
  HOLD_UPSTREAM_SECURITY_READINESS: 'HOLD_UPSTREAM_SECURITY_READINESS',
  HOLD_REQUIRED_CONTROLS: 'HOLD_REQUIRED_CONTROLS',
  HOLD_EVIDENCE_INTEGRITY: 'HOLD_EVIDENCE_INTEGRITY',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  HOLD_REVIEW_EVIDENCE: 'HOLD_REVIEW_EVIDENCE',
  HOLD_CONTROL_FAILURE: 'HOLD_CONTROL_FAILURE',
});

const READY_UPSTREAM_STATUS = 'READY_FOR_INDEPENDENT_SECURITY_REVIEW';
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredEnum(value, allowed, field) {
  const normalized = requiredString(value, field);
  if (!Object.values(allowed).includes(normalized)) throw new TypeError(`${field} has unsupported value: ${normalized}`);
  return normalized;
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field);
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  return normalized.toLowerCase();
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized.toLowerCase();
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return Object.freeze({ value: normalized, millis });
}

function nonNegativeDays(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
}

function stringArray(value, field, { nonEmpty = true } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) throw new TypeError(`${field} must be ${nonEmpty ? 'a non-empty ' : 'an '}array`);
  return Object.freeze(value.map((item, index) => requiredString(item, `${field}[${index}]`)));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function sha256Object(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function createSecurityQualificationEvidence(input = {}) {
  const observed = requiredTimestamp(input.observedAt, 'observedAt');
  const verified = requiredTimestamp(input.verifiedAt, 'verifiedAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (verified.millis < observed.millis) throw new TypeError('verifiedAt must be on or after observedAt');
  if (reviewed.millis < verified.millis) throw new TypeError('reviewedAt must be on or after verifiedAt');

  const core = {
    evidenceId: requiredString(input.evidenceId, 'evidenceId'),
    controlClass: requiredEnum(input.controlClass, SECURITY_CONTROL_CLASS, 'controlClass'),
    environment: requiredEnum(input.environment, SECURITY_EVIDENCE_ENVIRONMENT, 'environment'),
    targetRef: requiredString(input.targetRef, 'targetRef'),
    exactCommitSha: requiredCommitSha(input.exactCommitSha, 'exactCommitSha'),
    sourceKind: requiredEnum(input.sourceKind, SECURITY_EVIDENCE_SOURCE_KIND, 'sourceKind'),
    sourceArtifactId: requiredString(input.sourceArtifactId, 'sourceArtifactId'),
    sourceArtifactHashSha256: requiredSha256(input.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
    evidenceRef: requiredString(input.evidenceRef, 'evidenceRef'),
    evidenceContentHashSha256: requiredSha256(input.evidenceContentHashSha256, 'evidenceContentHashSha256'),
    outcome: requiredEnum(input.outcome, SECURITY_EVIDENCE_OUTCOME, 'outcome'),
    issuerRef: requiredString(input.issuerRef, 'issuerRef'),
    verificationMethod: requiredString(input.verificationMethod, 'verificationMethod'),
    observedAt: observed.value,
    verifiedAt: verified.value,
    reviewedAt: reviewed.value,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
    notes: input.notes == null ? null : requiredString(input.notes, 'notes'),
  };

  return Object.freeze({
    ...core,
    evidenceHashSha256: sha256Object(core),
    cryptographicSignatureVerifiedByThisModule: false,
    externalSystemQueriedByThisModule: false,
    productionSecurityValidated: false,
    pdplComplianceEstablished: false,
    penetrationTestEstablished: false,
    certifiedSecurityEstablished: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
  });
}

function verifySecurityQualificationEvidence(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'EVIDENCE_OBJECT_REQUIRED' });
  try {
    const core = {
      evidenceId: requiredString(record.evidenceId, 'evidenceId'),
      controlClass: requiredEnum(record.controlClass, SECURITY_CONTROL_CLASS, 'controlClass'),
      environment: requiredEnum(record.environment, SECURITY_EVIDENCE_ENVIRONMENT, 'environment'),
      targetRef: requiredString(record.targetRef, 'targetRef'),
      exactCommitSha: requiredCommitSha(record.exactCommitSha, 'exactCommitSha'),
      sourceKind: requiredEnum(record.sourceKind, SECURITY_EVIDENCE_SOURCE_KIND, 'sourceKind'),
      sourceArtifactId: requiredString(record.sourceArtifactId, 'sourceArtifactId'),
      sourceArtifactHashSha256: requiredSha256(record.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
      evidenceRef: requiredString(record.evidenceRef, 'evidenceRef'),
      evidenceContentHashSha256: requiredSha256(record.evidenceContentHashSha256, 'evidenceContentHashSha256'),
      outcome: requiredEnum(record.outcome, SECURITY_EVIDENCE_OUTCOME, 'outcome'),
      issuerRef: requiredString(record.issuerRef, 'issuerRef'),
      verificationMethod: requiredString(record.verificationMethod, 'verificationMethod'),
      observedAt: requiredTimestamp(record.observedAt, 'observedAt').value,
      verifiedAt: requiredTimestamp(record.verifiedAt, 'verifiedAt').value,
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
      preparedBy: requiredString(record.preparedBy, 'preparedBy'),
      reviewedBy: requiredString(record.reviewedBy, 'reviewedBy'),
      evidenceRefs: [...stringArray(record.evidenceRefs, 'evidenceRefs')],
      notes: record.notes == null ? null : requiredString(record.notes, 'notes'),
    };
    if (Date.parse(core.verifiedAt) < Date.parse(core.observedAt) || Date.parse(core.reviewedAt) < Date.parse(core.verifiedAt)) {
      return Object.freeze({ valid: false, reasonCode: 'EVIDENCE_TIME_ORDER_INVALID' });
    }
    const expectedHash = sha256Object(core);
    if (record.evidenceHashSha256 !== expectedHash) return Object.freeze({ valid: false, reasonCode: 'EVIDENCE_HASH_MISMATCH', expectedHash });
    return Object.freeze({ valid: true, reasonCode: null, expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'EVIDENCE_SCHEMA_INVALID', error: error.message });
  }
}

function normalizeMaximumAgePolicy(policy, requiredControls) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('maximumEvidenceAgeDaysByControl must be an object');
  const normalized = {};
  for (const controlClass of requiredControls) {
    normalized[controlClass] = nonNegativeDays(policy[controlClass], `maximumEvidenceAgeDaysByControl.${controlClass}`);
  }
  return Object.freeze(normalized);
}

function buildSecurityQualificationEnvelope(input = {}) {
  const qualificationId = requiredString(input.qualificationId, 'qualificationId');
  const environment = requiredEnum(input.expectedEnvironment, SECURITY_EVIDENCE_ENVIRONMENT, 'expectedEnvironment');
  const exactCommitSha = requiredCommitSha(input.exactCommitSha, 'exactCommitSha');
  const upstreamSecurityAssessmentRef = requiredString(input.upstreamSecurityAssessmentRef, 'upstreamSecurityAssessmentRef');
  const upstreamSecurityAssessmentHashSha256 = requiredSha256(input.upstreamSecurityAssessmentHashSha256, 'upstreamSecurityAssessmentHashSha256');
  const upstreamSecurityAssessmentStatus = requiredString(input.upstreamSecurityAssessmentStatus, 'upstreamSecurityAssessmentStatus');
  const assessed = requiredTimestamp(input.assessedAt, 'assessedAt');

  const requiredControlsRaw = stringArray(input.requiredControlClasses, 'requiredControlClasses');
  const requiredControls = Object.freeze([...new Set(requiredControlsRaw.map((value) => requiredEnum(value, SECURITY_CONTROL_CLASS, 'requiredControlClasses')))]);
  if (requiredControls.length !== requiredControlsRaw.length) throw new TypeError('requiredControlClasses must not contain duplicates');
  const maximumAge = normalizeMaximumAgePolicy(input.maximumEvidenceAgeDaysByControl, requiredControls);

  if (!Array.isArray(input.evidenceRecords) || input.evidenceRecords.length === 0) throw new TypeError('evidenceRecords must be a non-empty array');
  const records = input.evidenceRecords;
  const evidenceIds = new Set();
  const issues = [];
  const byControl = new Map(requiredControls.map((control) => [control, []]));

  let status = SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION;

  if (upstreamSecurityAssessmentStatus !== READY_UPSTREAM_STATUS) {
    status = SECURITY_QUALIFICATION_STATUS.HOLD_UPSTREAM_SECURITY_READINESS;
    issues.push(`UPSTREAM_SECURITY_${upstreamSecurityAssessmentStatus}`);
  }

  for (const [index, record] of records.entries()) {
    const verification = verifySecurityQualificationEvidence(record);
    if (!verification.valid) {
      if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) status = SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push(`INVALID_EVIDENCE:${index}:${verification.reasonCode}`);
      continue;
    }
    if (evidenceIds.has(record.evidenceId)) {
      if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) status = SECURITY_QUALIFICATION_STATUS.HOLD_EVIDENCE_INTEGRITY;
      issues.push(`DUPLICATE_EVIDENCE_ID:${record.evidenceId}`);
      continue;
    }
    evidenceIds.add(record.evidenceId);
    if (record.environment !== environment || record.exactCommitSha !== exactCommitSha) {
      if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) status = SECURITY_QUALIFICATION_STATUS.HOLD_SCOPE_MISMATCH;
      issues.push(`EVIDENCE_SCOPE_MISMATCH:${record.evidenceId}`);
      continue;
    }
    if (byControl.has(record.controlClass)) byControl.get(record.controlClass).push(record);
  }

  if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) {
    const missing = requiredControls.filter((control) => (byControl.get(control) || []).length === 0);
    if (missing.length > 0) {
      status = SECURITY_QUALIFICATION_STATUS.HOLD_REQUIRED_CONTROLS;
      issues.push(...missing.map((control) => `MISSING_REQUIRED_CONTROL:${control}`));
    }
  }

  if (status === SECURITY_QUALIFICATION_STATUS.READY_FOR_INDEPENDENT_SECURITY_VALIDATION) {
    for (const control of requiredControls) {
      const candidates = byControl.get(control) || [];
      const passing = candidates.filter((record) => record.outcome === SECURITY_EVIDENCE_OUTCOME.PASS);
      if (passing.length === 0) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_CONTROL_FAILURE;
        issues.push(`NO_PASSING_EVIDENCE:${control}`);
        break;
      }
      const freshPassing = passing.filter((record) => {
        const ageDays = (assessed.millis - Date.parse(record.verifiedAt)) / 86400000;
        return ageDays >= 0 && ageDays <= maximumAge[control];
      });
      if (freshPassing.length === 0) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_STALE_EVIDENCE;
        issues.push(`NO_FRESH_PASSING_EVIDENCE:${control}`);
        break;
      }
      const independentlyReviewed = freshPassing.filter((record) => record.preparedBy !== record.reviewedBy);
      if (independentlyReviewed.length === 0) {
        status = SECURITY_QUALIFICATION_STATUS.HOLD_REVIEW_EVIDENCE;
        issues.push(`NO_INDEPENDENT_REVIEW:${control}`);
        break;
      }
    }
  }

  const summaries = Object.freeze(requiredControls.map((control) => {
    const candidates = byControl.get(control) || [];
    return Object.freeze({
      controlClass: control,
      evidenceIds: Object.freeze(candidates.map((record) => record.evidenceId)),
      passingEvidenceIds: Object.freeze(candidates.filter((record) => record.outcome === SECURITY_EVIDENCE_OUTCOME.PASS).map((record) => record.evidenceId)),
      maximumEvidenceAgeDays: maximumAge[control],
    });
  }));

  const core = {
    qualificationId,
    expectedEnvironment: environment,
    exactCommitSha,
    upstreamSecurityAssessmentRef,
    upstreamSecurityAssessmentHashSha256,
    upstreamSecurityAssessmentStatus,
    assessedAt: assessed.value,
    requiredControlClasses: [...requiredControls],
    maximumEvidenceAgeDaysByControl: { ...maximumAge },
    evidenceHashesSha256: records.map((record) => record.evidenceHashSha256 || null),
    status,
    issues: [...issues],
  };

  return Object.freeze({
    ...core,
    controlSummaries: summaries,
    qualificationHashSha256: sha256Object(core),
    evidenceEnvironmentIsExplicit: true,
    testEvidenceCanQualifyProductionScope: false,
    productionSecurityValidated: false,
    pdplComplianceEstablished: false,
    externalPenetrationTestEstablished: false,
    certifiedSecurityEstablished: false,
    independentSecurityValidationRequired: true,
    humanSecurityApprovalRequired: true,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_INDEPENDENT_SECURITY_VALIDATION means only that the caller-supplied, content-addressed security evidence set passed deterministic integrity, exact-commit scope, freshness, outcome, coverage and independent-review checks for the declared environment. CI_TEST or STAGING evidence cannot be reinterpreted as PRODUCTION evidence. This module does not query external systems, execute penetration tests, establish PDPL compliance, certify security, authorize merge/deployment, or authorize transactions.',
  });
}

function verifySecurityQualificationEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return Object.freeze({ valid: false, reasonCode: 'QUALIFICATION_OBJECT_REQUIRED' });
  try {
    const core = {
      qualificationId: requiredString(envelope.qualificationId, 'qualificationId'),
      expectedEnvironment: requiredEnum(envelope.expectedEnvironment, SECURITY_EVIDENCE_ENVIRONMENT, 'expectedEnvironment'),
      exactCommitSha: requiredCommitSha(envelope.exactCommitSha, 'exactCommitSha'),
      upstreamSecurityAssessmentRef: requiredString(envelope.upstreamSecurityAssessmentRef, 'upstreamSecurityAssessmentRef'),
      upstreamSecurityAssessmentHashSha256: requiredSha256(envelope.upstreamSecurityAssessmentHashSha256, 'upstreamSecurityAssessmentHashSha256'),
      upstreamSecurityAssessmentStatus: requiredString(envelope.upstreamSecurityAssessmentStatus, 'upstreamSecurityAssessmentStatus'),
      assessedAt: requiredTimestamp(envelope.assessedAt, 'assessedAt').value,
      requiredControlClasses: [...stringArray(envelope.requiredControlClasses, 'requiredControlClasses')],
      maximumEvidenceAgeDaysByControl: { ...(envelope.maximumEvidenceAgeDaysByControl || {}) },
      evidenceHashesSha256: Array.isArray(envelope.evidenceHashesSha256) ? [...envelope.evidenceHashesSha256] : [],
      status: requiredString(envelope.status, 'status'),
      issues: Array.isArray(envelope.issues) ? [...envelope.issues] : [],
    };
    const expectedHash = sha256Object(core);
    if (envelope.qualificationHashSha256 !== expectedHash) return Object.freeze({ valid: false, reasonCode: 'QUALIFICATION_HASH_MISMATCH', expectedHash });
    return Object.freeze({ valid: true, reasonCode: null, expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'QUALIFICATION_SCHEMA_INVALID', error: error.message });
  }
}

module.exports = {
  SECURITY_EVIDENCE_ENVIRONMENT,
  SECURITY_CONTROL_CLASS,
  SECURITY_EVIDENCE_SOURCE_KIND,
  SECURITY_EVIDENCE_OUTCOME,
  SECURITY_QUALIFICATION_STATUS,
  READY_UPSTREAM_STATUS,
  createSecurityQualificationEvidence,
  verifySecurityQualificationEvidence,
  buildSecurityQualificationEnvelope,
  verifySecurityQualificationEnvelope,
};
