'use strict';

const crypto = require('crypto');

const SOURCE_STATUS = Object.freeze({
  CURRENT_EFFECTIVE: 'CURRENT_EFFECTIVE',
  CURRENT_EFFECTIVE_SOURCE_AVAILABLE: 'CURRENT_EFFECTIVE_SOURCE_AVAILABLE',
  CURRENT_SOURCE_AVAILABLE: 'CURRENT_SOURCE_AVAILABLE',
  CURRENT_UNTIL_SUCCESSOR_FINAL: 'CURRENT_UNTIL_SUCCESSOR_FINAL',
  DRAFT_CONSULTATION: 'DRAFT_CONSULTATION',
  CURRENT_OFFICIAL_SOURCE: 'CURRENT_OFFICIAL_SOURCE',
  ACTIVE_REGULATION: 'ACTIVE_REGULATION',
});

const BATCH_STATUS = Object.freeze({
  CORE_SOURCES_VERIFIED_PENDING_APPLICABILITY_REVIEW: 'CORE_SOURCES_VERIFIED_PENDING_APPLICABILITY_REVIEW',
  HOLD_SCHEMA_OR_SOURCE_INTEGRITY: 'HOLD_SCHEMA_OR_SOURCE_INTEGRITY',
  HOLD_DRAFT_ENFORCEMENT_VIOLATION: 'HOLD_DRAFT_ENFORCEMENT_VIOLATION',
  HOLD_PRODUCTION_ENFORCEMENT_ASSERTION: 'HOLD_PRODUCTION_ENFORCEMENT_ASSERTION',
  HOLD_REVIEW_BOUNDARY: 'HOLD_REVIEW_BOUNDARY',
});

const OFFICIAL_DOMAINS = Object.freeze(['ivsc.org', 'rics.org', 'taqeem.gov.sa', 'rega.gov.sa']);
const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalIsoDate(value, field) {
  if (value == null) return null;
  const normalized = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new TypeError(`${field} must be an ISO date YYYY-MM-DD or null`);
  }
  return normalized;
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized.toLowerCase();
}

function requiredOfficialUrl(value, declaredDomain, field) {
  const normalized = requiredString(value, field);
  let url;
  try { url = new URL(normalized); } catch { throw new TypeError(`${field} must be an absolute URL`); }
  if (url.protocol !== 'https:') throw new TypeError(`${field} must use https`);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const expected = requiredString(declaredDomain, `${field}.officialDomain`).toLowerCase().replace(/^www\./, '');
  if (!OFFICIAL_DOMAINS.includes(expected)) throw new TypeError(`${field} officialDomain is not allow-listed`);
  if (!(hostname === expected || hostname.endsWith(`.${expected}`))) throw new TypeError(`${field} hostname does not match officialDomain`);
  return normalized;
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${field} must be a non-empty array`);
  return value.map((item, index) => requiredString(item, `${field}[${index}]`));
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

function validateSourceRecord(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`records[${index}] must be an object`);
  const officialDomain = requiredString(record.officialDomain, `records[${index}].officialDomain`).toLowerCase().replace(/^www\./, '');
  const normalized = {
    sourceId: requiredString(record.sourceId, `records[${index}].sourceId`),
    issuer: requiredString(record.issuer, `records[${index}].issuer`),
    jurisdiction: requiredString(record.jurisdiction, `records[${index}].jurisdiction`),
    sourceType: requiredString(record.sourceType, `records[${index}].sourceType`),
    title: requiredString(record.title, `records[${index}].title`),
    sourceStatus: requiredString(record.sourceStatus, `records[${index}].sourceStatus`),
    publicationDate: optionalIsoDate(record.publicationDate, `records[${index}].publicationDate`),
    effectiveDate: optionalIsoDate(record.effectiveDate, `records[${index}].effectiveDate`),
    sourceUrl: requiredOfficialUrl(record.sourceUrl, officialDomain, `records[${index}].sourceUrl`),
    officialDomain,
    verifiedFacts: stringArray(record.verifiedFacts, `records[${index}].verifiedFacts`),
    applicabilityConclusion: requiredString(record.applicabilityConclusion, `records[${index}].applicabilityConclusion`),
    productionEnforcementEligible: record.productionEnforcementEligible,
  };
  if (!Object.values(SOURCE_STATUS).includes(normalized.sourceStatus)) throw new TypeError(`records[${index}].sourceStatus unsupported`);
  if (typeof normalized.productionEnforcementEligible !== 'boolean') throw new TypeError(`records[${index}].productionEnforcementEligible must be boolean`);
  if (record.supportingSourceUrl != null) requiredOfficialUrl(record.supportingSourceUrl, officialDomain, `records[${index}].supportingSourceUrl`);
  if (record.reissuedDate != null) optionalIsoDate(record.reissuedDate, `records[${index}].reissuedDate`);
  if (record.consultationClosesDate != null) optionalIsoDate(record.consultationClosesDate, `records[${index}].consultationClosesDate`);
  return Object.freeze({ ...normalized, sourceFactHashSha256: sha256Object(normalized) });
}

function assessExternalStandardsSourceBatch(batch) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new TypeError('batch must be an object');
  const candidateHeadSha = requiredCommitSha(batch.candidateHeadSha, 'candidateHeadSha');
  const verifiedAt = optionalIsoDate(batch.verifiedAt, 'verifiedAt');
  const records = Array.isArray(batch.records) ? batch.records : [];
  if (records.length === 0) throw new TypeError('records must be a non-empty array');
  const normalizedRecords = [];
  const issues = [];
  let status = BATCH_STATUS.CORE_SOURCES_VERIFIED_PENDING_APPLICABILITY_REVIEW;
  const ids = new Set();

  for (let index = 0; index < records.length; index += 1) {
    try {
      const normalized = validateSourceRecord(records[index], index);
      if (ids.has(normalized.sourceId)) {
        status = BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY;
        issues.push(`DUPLICATE_SOURCE_ID:${normalized.sourceId}`);
      }
      ids.add(normalized.sourceId);
      normalizedRecords.push(normalized);
      if (normalized.sourceStatus === SOURCE_STATUS.DRAFT_CONSULTATION && normalized.productionEnforcementEligible === true) {
        status = BATCH_STATUS.HOLD_DRAFT_ENFORCEMENT_VIOLATION;
        issues.push(`DRAFT_PRODUCTION_ENFORCEMENT_FORBIDDEN:${normalized.sourceId}`);
      } else if (normalized.productionEnforcementEligible === true) {
        status = BATCH_STATUS.HOLD_PRODUCTION_ENFORCEMENT_ASSERTION;
        issues.push(`SOURCE_VERIFICATION_ALONE_CANNOT_AUTHORIZE_ENFORCEMENT:${normalized.sourceId}`);
      }
    } catch (error) {
      status = BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY;
      issues.push(`INVALID_SOURCE_RECORD:${index}:${error.message}`);
    }
  }

  if (batch.officialStandardsSourceVerificationComplete !== false || batch.productionStandardsActivationAuthorized !== false || batch.formalStandardsConformanceEstablished !== false) {
    status = BATCH_STATUS.HOLD_REVIEW_BOUNDARY;
    issues.push('SOURCE_VERIFICATION_BATCH_MUST_NOT_CLAIM_COMPLETION_ACTIVATION_OR_CONFORMANCE');
  }
  if (batch.professionalReviewRequired !== true || batch.legalApplicabilityReviewRequired !== true) {
    status = BATCH_STATUS.HOLD_REVIEW_BOUNDARY;
    issues.push('PROFESSIONAL_AND_LEGAL_APPLICABILITY_REVIEW_MUST_REMAIN_REQUIRED');
  }

  const core = {
    verificationBatchId: requiredString(batch.verificationBatchId, 'verificationBatchId'),
    verifiedAt,
    candidateHeadSha,
    blockerId: requiredString(batch.blockerId, 'blockerId'),
    blockerDisposition: requiredString(batch.blockerDisposition, 'blockerDisposition'),
    sourceFactHashesSha256: normalizedRecords.map((record) => record.sourceFactHashSha256),
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    batchHashSha256: sha256Object(core),
    sourceRecordsValidated: normalizedRecords.length,
    officialStandardsSourceVerificationComplete: false,
    productionStandardsActivationAuthorized: false,
    formalStandardsConformanceEstablished: false,
    professionalReviewRequired: true,
    legalApplicabilityReviewRequired: true,
    sourceVerificationCanChangeRegistryStatusToActive: false,
    draftSourcesCanAffectProduction: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'CORE_SOURCES_VERIFIED_PENDING_APPLICABILITY_REVIEW records deterministic validation of caller-maintained official-source metadata for core valuation and Saudi regulatory references. It does not independently fetch the sources, verify legal applicability, activate standards, establish formal conformance, or authorize merge/deployment/transactions.',
  });
}

function verifyExternalStandardsSourceBatchAssessment(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'ASSESSMENT_OBJECT_REQUIRED' });
  try {
    if (!SHA256_RE.test(String(record.batchHashSha256 || ''))) return Object.freeze({ valid: false, reasonCode: 'ASSESSMENT_HASH_MISSING' });
    const core = {
      verificationBatchId: requiredString(record.verificationBatchId, 'verificationBatchId'),
      verifiedAt: optionalIsoDate(record.verifiedAt, 'verifiedAt'),
      candidateHeadSha: requiredCommitSha(record.candidateHeadSha, 'candidateHeadSha'),
      blockerId: requiredString(record.blockerId, 'blockerId'),
      blockerDisposition: requiredString(record.blockerDisposition, 'blockerDisposition'),
      sourceFactHashesSha256: Array.isArray(record.sourceFactHashesSha256) ? [...record.sourceFactHashesSha256] : [],
      status: requiredString(record.status, 'status'),
      issues: Array.isArray(record.issues) ? [...record.issues] : [],
    };
    const expectedHash = sha256Object(core);
    return Object.freeze({ valid: record.batchHashSha256 === expectedHash, reasonCode: record.batchHashSha256 === expectedHash ? null : 'ASSESSMENT_HASH_MISMATCH', expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'ASSESSMENT_SCHEMA_INVALID', error: error.message });
  }
}

module.exports = {
  SOURCE_STATUS,
  BATCH_STATUS,
  OFFICIAL_DOMAINS,
  validateSourceRecord,
  assessExternalStandardsSourceBatch,
  verifyExternalStandardsSourceBatchAssessment,
};
