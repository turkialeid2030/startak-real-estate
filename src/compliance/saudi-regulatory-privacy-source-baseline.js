'use strict';

const crypto = require('crypto');

const BATCH_STATUS = Object.freeze({
  OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW: 'OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW',
  HOLD_SCHEMA_OR_SOURCE_INTEGRITY: 'HOLD_SCHEMA_OR_SOURCE_INTEGRITY',
  HOLD_BLOCKER_BOUNDARY: 'HOLD_BLOCKER_BOUNDARY',
  HOLD_PRODUCTION_CLAIM: 'HOLD_PRODUCTION_CLAIM',
});

const ALLOWED_DOMAINS = Object.freeze(['dgp.sdaia.gov.sa', 'sdaia.gov.sa', 'taqeem.gov.sa', 'rega.gov.sa']);
const REQUIRED_OPEN_BLOCKERS = Object.freeze([
  'SAUDI_PROFESSIONAL_LICENSING_AND_LEGAL_REVIEW',
  'PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW',
]);
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value, field) {
  const value2 = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(value2)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return value2.toLowerCase();
}

function optionalIsoDate(value, field) {
  if (value == null) return null;
  const normalized = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new TypeError(`${field} must be YYYY-MM-DD or null`);
  const parsed = Date.parse(`${normalized}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be a valid date`);
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

function validateOfficialUrl(urlValue, declaredDomain, field) {
  const raw = requiredString(urlValue, field);
  let url;
  try { url = new URL(raw); } catch { throw new TypeError(`${field} must be an absolute URL`); }
  if (url.protocol !== 'https:') throw new TypeError(`${field} must use https`);
  const domain = requiredString(declaredDomain, `${field}.domain`).toLowerCase().replace(/^www\./, '');
  if (!ALLOWED_DOMAINS.includes(domain)) throw new TypeError(`${field}.domain is not allow-listed`);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!(hostname === domain || hostname.endsWith(`.${domain}`))) throw new TypeError(`${field} hostname does not match domain`);
  return raw;
}

function normalizeRecord(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`records[${index}] must be an object`);
  const domain = requiredString(record.domain, `records[${index}].domain`).toLowerCase().replace(/^www\./, '');
  const normalized = {
    sourceId: requiredString(record.sourceId, `records[${index}].sourceId`),
    issuer: requiredString(record.issuer, `records[${index}].issuer`),
    domain,
    sourceType: requiredString(record.sourceType, `records[${index}].sourceType`),
    title: requiredString(record.title, `records[${index}].title`),
    sourceUrl: validateOfficialUrl(record.sourceUrl, domain, `records[${index}].sourceUrl`),
    sourceStatus: requiredString(record.sourceStatus, `records[${index}].sourceStatus`),
    effectiveDate: optionalIsoDate(record.effectiveDate, `records[${index}].effectiveDate`),
    verifiedFacts: stringArray(record.verifiedFacts, `records[${index}].verifiedFacts`),
    platformControlImplications: stringArray(record.platformControlImplications, `records[${index}].platformControlImplications`),
  };
  return Object.freeze({ ...normalized, sourceFactHashSha256: sha256Object(normalized) });
}

function assessSaudiRegulatoryPrivacyBaseline(batch) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new TypeError('batch must be an object');
  const records = Array.isArray(batch.records) ? batch.records : [];
  if (records.length === 0) throw new TypeError('batch.records must be a non-empty array');
  const blockers = Array.isArray(batch.blockers) ? batch.blockers : [];
  const issues = [];
  let status = BATCH_STATUS.OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW;

  const normalizedRecords = [];
  const sourceIds = new Set();
  for (let i = 0; i < records.length; i += 1) {
    try {
      const item = normalizeRecord(records[i], i);
      if (sourceIds.has(item.sourceId)) {
        status = BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY;
        issues.push(`DUPLICATE_SOURCE_ID:${item.sourceId}`);
      }
      sourceIds.add(item.sourceId);
      normalizedRecords.push(item);
    } catch (error) {
      status = BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY;
      issues.push(`INVALID_SOURCE_RECORD:${i}:${error.message}`);
    }
  }

  const blockerById = new Map();
  blockers.forEach((blocker, index) => {
    try {
      const blockerId = requiredString(blocker.blockerId, `blockers[${index}].blockerId`);
      const disposition = requiredString(blocker.disposition, `blockers[${index}].disposition`);
      if (typeof blocker.closed !== 'boolean') throw new TypeError(`blockers[${index}].closed must be boolean`);
      blockerById.set(blockerId, { blockerId, disposition, closed: blocker.closed });
    } catch (error) {
      status = BATCH_STATUS.HOLD_SCHEMA_OR_SOURCE_INTEGRITY;
      issues.push(`INVALID_BLOCKER:${index}:${error.message}`);
    }
  });

  for (const requiredBlocker of REQUIRED_OPEN_BLOCKERS) {
    const blocker = blockerById.get(requiredBlocker);
    if (!blocker || blocker.closed !== false) {
      if (status === BATCH_STATUS.OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW) status = BATCH_STATUS.HOLD_BLOCKER_BOUNDARY;
      issues.push(`REQUIRED_BLOCKER_MUST_REMAIN_OPEN:${requiredBlocker}`);
    }
  }

  const forbiddenClaims = [
    ['legalApplicabilityReviewComplete', batch.legalApplicabilityReviewComplete],
    ['pdplComplianceEstablished', batch.pdplComplianceEstablished],
    ['saudiProfessionalLicensingEstablished', batch.saudiProfessionalLicensingEstablished],
    ['productionControlImplementationVerified', batch.productionControlImplementationVerified],
    ['externalLegalOpinionEstablished', batch.externalLegalOpinionEstablished],
    ['mergeAuthorized', batch.mergeAuthorized],
    ['deploymentAuthorized', batch.deploymentAuthorized],
  ];
  for (const [field, value] of forbiddenClaims) {
    if (value !== false) {
      if (status === BATCH_STATUS.OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW) status = BATCH_STATUS.HOLD_PRODUCTION_CLAIM;
      issues.push(`FORBIDDEN_COMPLETION_OR_AUTHORITY_CLAIM:${field}`);
    }
  }

  const core = {
    verificationBatchId: requiredString(batch.verificationBatchId, 'verificationBatchId'),
    verifiedAt: optionalIsoDate(batch.verifiedAt, 'verifiedAt'),
    candidateHeadSha: requiredCommitSha(batch.candidateHeadSha, 'candidateHeadSha'),
    blockerDispositions: REQUIRED_OPEN_BLOCKERS.map((id) => ({
      blockerId: id,
      disposition: blockerById.get(id)?.disposition || null,
      closed: blockerById.get(id)?.closed ?? null,
    })),
    sourceFactHashesSha256: normalizedRecords.map((item) => item.sourceFactHashSha256),
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    baselineHashSha256: sha256Object(core),
    sourceRecordsValidated: normalizedRecords.length,
    legalApplicabilityReviewComplete: false,
    pdplComplianceEstablished: false,
    saudiProfessionalLicensingEstablished: false,
    productionControlImplementationVerified: false,
    externalLegalOpinionEstablished: false,
    privacyOfficerOrCounselReviewRequired: true,
    saudiProfessionalLegalReviewRequired: true,
    productionEvidenceRequired: true,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'OFFICIAL_SOURCE_BASELINE_READY_FOR_EXTERNAL_LEGAL_PRIVACY_REVIEW means official Saudi regulatory and PDPL source metadata passed deterministic source/scope integrity checks while the legal, privacy, professional, production-control and authority blockers remain explicitly open. This module does not fetch sources, render legal advice, establish PDPL compliance, verify licensing, or authorize merge/deployment/transactions.',
  });
}

function verifySaudiRegulatoryPrivacyBaselineAssessment(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'ASSESSMENT_OBJECT_REQUIRED' });
  const core = {
    verificationBatchId: record.verificationBatchId,
    verifiedAt: record.verifiedAt,
    candidateHeadSha: record.candidateHeadSha,
    blockerDispositions: Array.isArray(record.blockerDispositions) ? record.blockerDispositions.map((x) => ({ ...x })) : [],
    sourceFactHashesSha256: Array.isArray(record.sourceFactHashesSha256) ? [...record.sourceFactHashesSha256] : [],
    status: record.status,
    issues: Array.isArray(record.issues) ? [...record.issues] : [],
  };
  const expectedHash = sha256Object(core);
  return Object.freeze({ valid: record.baselineHashSha256 === expectedHash, reasonCode: record.baselineHashSha256 === expectedHash ? null : 'ASSESSMENT_HASH_MISMATCH', expectedHash });
}

module.exports = {
  BATCH_STATUS,
  ALLOWED_DOMAINS,
  REQUIRED_OPEN_BLOCKERS,
  normalizeRecord,
  assessSaudiRegulatoryPrivacyBaseline,
  verifySaudiRegulatoryPrivacyBaselineAssessment,
};
