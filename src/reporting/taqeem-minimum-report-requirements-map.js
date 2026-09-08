'use strict';

const crypto = require('crypto');

const MAPPING_STATUS = Object.freeze({
  COVERED: 'COVERED',
  PARTIAL: 'PARTIAL',
  SOURCE_AVAILABLE_UPSTREAM_NOT_REPORT_BOUND: 'SOURCE_AVAILABLE_UPSTREAM_NOT_REPORT_BOUND',
  GAP: 'GAP',
  GAP_BY_AUTHORITY_BOUNDARY: 'GAP_BY_AUTHORITY_BOUNDARY',
  GAP_EXTERNAL_CREDENTIAL: 'GAP_EXTERNAL_CREDENTIAL',
  GAP_EXTERNAL_AUTHORITY: 'GAP_EXTERNAL_AUTHORITY',
  GAP_EXTERNAL_INTEGRATION: 'GAP_EXTERNAL_INTEGRATION',
});

const ASSESSMENT_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_GAP_REMEDIATION: 'READY_FOR_PROFESSIONAL_GAP_REMEDIATION',
  HOLD_SOURCE_OR_MAPPING_INTEGRITY: 'HOLD_SOURCE_OR_MAPPING_INTEGRITY',
  HOLD_FALSE_CONFORMANCE_CLAIM: 'HOLD_FALSE_CONFORMANCE_CLAIM',
});

const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value, field) {
  const normalized = requiredString(value, field);
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized.toLowerCase();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256Object(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function validateRequirement(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError(`requirements[${index}] must be an object`);
  const mappingStatus = requiredString(row.mappingStatus, `requirements[${index}].mappingStatus`);
  if (!Object.values(MAPPING_STATUS).includes(mappingStatus)) throw new TypeError(`requirements[${index}].mappingStatus unsupported`);
  const mappedFields = Array.isArray(row.mappedFields) ? row.mappedFields.map((v) => requiredString(v, `requirements[${index}].mappedFields`)) : [];
  if (mappingStatus === MAPPING_STATUS.COVERED && row.gap != null) throw new TypeError(`requirements[${index}] COVERED cannot carry gap`);
  if (mappingStatus !== MAPPING_STATUS.COVERED && (typeof row.gap !== 'string' || row.gap.trim() === '')) {
    throw new TypeError(`requirements[${index}] non-COVERED mapping must describe gap`);
  }
  const core = {
    requirementId: requiredString(row.requirementId, `requirements[${index}].requirementId`),
    sourceLabel: requiredString(row.sourceLabel, `requirements[${index}].sourceLabel`),
    sourcePage: row.sourcePage,
    category: requiredString(row.category, `requirements[${index}].category`),
    titleAr: requiredString(row.titleAr, `requirements[${index}].titleAr`),
    concept: requiredString(row.concept, `requirements[${index}].concept`),
    mappingStatus,
    mappedFields,
    gap: row.gap == null ? null : requiredString(row.gap, `requirements[${index}].gap`),
  };
  if (!Number.isInteger(core.sourcePage) || core.sourcePage < 1) throw new TypeError(`requirements[${index}].sourcePage must be a positive integer`);
  return Object.freeze({ ...core, requirementMapHashSha256: sha256Object(core) });
}

function assessTaqeemMinimumReportRequirementsMap(mapping) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new TypeError('mapping must be an object');
  const requirements = Array.isArray(mapping.requirements) ? mapping.requirements : [];
  if (requirements.length === 0) throw new TypeError('mapping.requirements must be a non-empty array');
  const issues = [];
  let status = ASSESSMENT_STATUS.READY_FOR_PROFESSIONAL_GAP_REMEDIATION;
  const normalized = [];
  const ids = new Set();

  for (let i = 0; i < requirements.length; i += 1) {
    try {
      const item = validateRequirement(requirements[i], i);
      if (ids.has(item.requirementId)) {
        status = ASSESSMENT_STATUS.HOLD_SOURCE_OR_MAPPING_INTEGRITY;
        issues.push(`DUPLICATE_REQUIREMENT_ID:${item.requirementId}`);
      }
      ids.add(item.requirementId);
      normalized.push(item);
    } catch (error) {
      status = ASSESSMENT_STATUS.HOLD_SOURCE_OR_MAPPING_INTEGRITY;
      issues.push(`INVALID_REQUIREMENT:${i}:${error.message}`);
    }
  }

  const source = mapping.source || {};
  try {
    const domain = requiredString(source.officialDomain, 'source.officialDomain').replace(/^www\./, '').toLowerCase();
    if (domain !== 'taqeem.gov.sa') throw new TypeError('source.officialDomain must be taqeem.gov.sa');
    const url = new URL(requiredString(source.sourceUrl, 'source.sourceUrl'));
    if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '').toLowerCase() !== domain) throw new TypeError('source URL must be official TAQEEM HTTPS URL');
    if (!Array.isArray(source.verifiedFacts) || source.verifiedFacts.length === 0) throw new TypeError('source.verifiedFacts must be non-empty');
  } catch (error) {
    status = ASSESSMENT_STATUS.HOLD_SOURCE_OR_MAPPING_INTEGRITY;
    issues.push(`INVALID_SOURCE:${error.message}`);
  }

  if (mapping.formalTaqeemReportConformanceEstablished !== false
    || mapping.externalIssuanceAuthorized !== false
    || mapping.credentialValidationPerformed !== false
    || mapping.professionalSignatureCaptured !== false
    || mapping.depositCodeValidated !== false) {
    status = ASSESSMENT_STATUS.HOLD_FALSE_CONFORMANCE_CLAIM;
    issues.push('TAQEEM_CONFORMANCE_OR_EXTERNAL_AUTHORITY_CLAIM_FORBIDDEN');
  }

  const covered = normalized.filter((r) => r.mappingStatus === MAPPING_STATUS.COVERED);
  const partialOrUpstreamOnly = normalized.filter((r) => [
    MAPPING_STATUS.PARTIAL,
    MAPPING_STATUS.SOURCE_AVAILABLE_UPSTREAM_NOT_REPORT_BOUND,
  ].includes(r.mappingStatus));
  const externalOrAuthorityGaps = normalized.filter((r) => ![
    MAPPING_STATUS.COVERED,
    MAPPING_STATUS.PARTIAL,
    MAPPING_STATUS.SOURCE_AVAILABLE_UPSTREAM_NOT_REPORT_BOUND,
  ].includes(r.mappingStatus));

  const summary = mapping.mappingSummary || {};
  if (summary.totalRequirements !== normalized.length
    || summary.covered !== covered.length
    || summary.partialOrUpstreamOnly !== partialOrUpstreamOnly.length
    || summary.externalOrAuthorityGaps !== externalOrAuthorityGaps.length
    || summary.formalConformanceBlocked !== true) {
    status = ASSESSMENT_STATUS.HOLD_SOURCE_OR_MAPPING_INTEGRITY;
    issues.push('MAPPING_SUMMARY_MISMATCH');
  }

  const core = {
    mappingId: requiredString(mapping.mappingId, 'mappingId'),
    verifiedAt: requiredString(mapping.verifiedAt, 'verifiedAt'),
    candidateHeadSha: requiredCommitSha(mapping.candidateHeadSha, 'candidateHeadSha'),
    sourceUrl: source.sourceUrl || null,
    requirementMapHashesSha256: normalized.map((r) => r.requirementMapHashSha256),
    totalRequirements: normalized.length,
    coveredRequirementIds: covered.map((r) => r.requirementId),
    partialOrUpstreamRequirementIds: partialOrUpstreamOnly.map((r) => r.requirementId),
    externalOrAuthorityGapRequirementIds: externalOrAuthorityGaps.map((r) => r.requirementId),
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    assessmentHashSha256: sha256Object(core),
    formalTaqeemReportConformanceEstablished: false,
    externalIssuanceAuthorized: false,
    credentialValidationPerformed: false,
    professionalSignatureCaptured: false,
    depositCodeValidated: false,
    licensedProfessionalRemediationRequired: true,
    officialProfessionalApprovalRequired: true,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    semantics: 'READY_FOR_PROFESSIONAL_GAP_REMEDIATION means the official TAQEEM minimum-report-template requirements have been mapped to the current report architecture with explicit coverage/gaps. It is not a Taqeem conformance result and cannot authorize professional external issuance, signatures, deposit codes, merge, deployment, or transactions.',
  });
}

function verifyTaqeemMinimumReportRequirementsAssessment(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'ASSESSMENT_OBJECT_REQUIRED' });
  const core = {
    mappingId: record.mappingId,
    verifiedAt: record.verifiedAt,
    candidateHeadSha: record.candidateHeadSha,
    sourceUrl: record.sourceUrl,
    requirementMapHashesSha256: [...(record.requirementMapHashesSha256 || [])],
    totalRequirements: record.totalRequirements,
    coveredRequirementIds: [...(record.coveredRequirementIds || [])],
    partialOrUpstreamRequirementIds: [...(record.partialOrUpstreamRequirementIds || [])],
    externalOrAuthorityGapRequirementIds: [...(record.externalOrAuthorityGapRequirementIds || [])],
    status: record.status,
    issues: [...(record.issues || [])],
  };
  const expectedHash = sha256Object(core);
  return Object.freeze({ valid: record.assessmentHashSha256 === expectedHash, reasonCode: record.assessmentHashSha256 === expectedHash ? null : 'ASSESSMENT_HASH_MISMATCH', expectedHash });
}

module.exports = {
  MAPPING_STATUS,
  ASSESSMENT_STATUS,
  validateRequirement,
  assessTaqeemMinimumReportRequirementsMap,
  verifyTaqeemMinimumReportRequirementsAssessment,
};
