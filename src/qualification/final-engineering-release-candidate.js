'use strict';

const crypto = require('crypto');

const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';
const WAVE17_QUALIFIED_HEADS = Object.freeze({
  WAVE_17A: '49c5b406c2b342f458b74053f28421c653821dce',
  WAVE_17B: 'a2fdc0d04548e864c18688da9835453c14b6631f',
  WAVE_17C: 'f64a484988d529bdcbd3c23e9a4d5a3bdb20d754',
  WAVE_17D: 'f30d89bd737c43046023a3aeb5da17e8c3511774',
});

const PROGRAM_SCOPE = Object.freeze({
  FOUNDATION_AND_PROFESSIONAL_VALUATION: 'FOUNDATION_AND_PROFESSIONAL_VALUATION',
  REPORTING_REVIEW_STANDARDS_QA: 'REPORTING_REVIEW_STANDARDS_QA',
  UNCERTAINTY_PORTFOLIO_IC: 'UNCERTAINTY_PORTFOLIO_IC',
  SECURITY_PERFORMANCE_RELEASE_QUALIFICATION: 'SECURITY_PERFORMANCE_RELEASE_QUALIFICATION',
});

const ENGINEERING_SCOPE_STATUS = Object.freeze({
  ENGINEERING_QUALIFIED: 'ENGINEERING_QUALIFIED',
});

const FINAL_ENGINEERING_STATUS = Object.freeze({
  ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS: 'ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS',
  HOLD_PARENT_SCOPE: 'HOLD_PARENT_SCOPE',
  HOLD_PROGRAM_SCOPE: 'HOLD_PROGRAM_SCOPE',
  HOLD_SCOPE_EVIDENCE_INTEGRITY: 'HOLD_SCOPE_EVIDENCE_INTEGRITY',
  HOLD_EXTERNAL_BLOCKER_REGISTER: 'HOLD_EXTERNAL_BLOCKER_REGISTER',
  HOLD_REVIEW_GOVERNANCE: 'HOLD_REVIEW_GOVERNANCE',
});

const REQUIRED_EXTERNAL_BLOCKERS = Object.freeze([
  'OFFICIAL_STANDARDS_SOURCE_VERIFICATION',
  'SAUDI_PROFESSIONAL_LICENSING_AND_LEGAL_REVIEW',
  'PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW',
  'INDEPENDENT_PRODUCTION_SECURITY_VALIDATION',
  'INDEPENDENT_PRODUCTION_PERFORMANCE_RESILIENCE_VALIDATION',
  'REVIEWER_CREDENTIAL_AND_INDEPENDENCE_VERIFICATION',
  'CANONICAL_EXTERNAL_SOURCE_HASH_COMPARISON',
  'HUMAN_RELEASE_AUTHORITY_APPROVAL',
  'MERGE_AND_DEPLOY_AUTHORIZATION',
]);

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
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

function normalizeScopeEvidence(item, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`programScopeEvidence[${index}] must be an object`);
  const scope = requiredString(item.scope, `programScopeEvidence[${index}].scope`);
  if (!Object.values(PROGRAM_SCOPE).includes(scope)) throw new TypeError(`programScopeEvidence[${index}].scope unsupported`);
  const status = requiredString(item.status, `programScopeEvidence[${index}].status`);
  if (status !== ENGINEERING_SCOPE_STATUS.ENGINEERING_QUALIFIED) throw new TypeError(`programScopeEvidence[${index}].status must be ENGINEERING_QUALIFIED`);
  return Object.freeze({
    scope,
    status,
    closeoutRef: requiredString(item.closeoutRef, `programScopeEvidence[${index}].closeoutRef`),
    closeoutHashSha256: requiredSha256(item.closeoutHashSha256, `programScopeEvidence[${index}].closeoutHashSha256`),
    exactHeadSha: requiredCommitSha(item.exactHeadSha, `programScopeEvidence[${index}].exactHeadSha`),
    qualificationRef: requiredString(item.qualificationRef, `programScopeEvidence[${index}].qualificationRef`),
  });
}

function createFinalEngineeringReleaseCandidate(input = {}) {
  const assembled = requiredTimestamp(input.assembledAt, 'assembledAt');
  const reviewed = requiredTimestamp(input.reviewedAt, 'reviewedAt');
  if (reviewed.millis < assembled.millis) throw new TypeError('reviewedAt must be on or after assembledAt');

  const candidateParentSha = requiredCommitSha(input.candidateParentSha, 'candidateParentSha');
  const programScopeEvidenceRaw = Array.isArray(input.programScopeEvidence) ? input.programScopeEvidence : [];
  const programScopeEvidence = Object.freeze(programScopeEvidenceRaw.map(normalizeScopeEvidence));
  const blockers = Array.isArray(input.openExternalBlockers)
    ? Object.freeze([...new Set(input.openExternalBlockers.map((value, index) => requiredString(value, `openExternalBlockers[${index}]`)))])
    : Object.freeze([]);

  const issues = [];
  let status = FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS;

  if (candidateParentSha !== WAVE17_QUALIFIED_HEADS.WAVE_17D) {
    status = FINAL_ENGINEERING_STATUS.HOLD_PARENT_SCOPE;
    issues.push('CANDIDATE_PARENT_MUST_EQUAL_QUALIFIED_WAVE17D_HEAD');
  }

  const byScope = new Map();
  for (const item of programScopeEvidence) {
    if (byScope.has(item.scope)) {
      if (status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS) status = FINAL_ENGINEERING_STATUS.HOLD_SCOPE_EVIDENCE_INTEGRITY;
      issues.push(`DUPLICATE_PROGRAM_SCOPE:${item.scope}`);
    } else {
      byScope.set(item.scope, item);
    }
  }

  const missingScopes = Object.values(PROGRAM_SCOPE).filter((scope) => !byScope.has(scope));
  if (missingScopes.length > 0 && status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS) {
    status = FINAL_ENGINEERING_STATUS.HOLD_PROGRAM_SCOPE;
    issues.push(...missingScopes.map((scope) => `MISSING_PROGRAM_SCOPE:${scope}`));
  }

  const missingBlockers = REQUIRED_EXTERNAL_BLOCKERS.filter((blocker) => !blockers.includes(blocker));
  if (missingBlockers.length > 0 && status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS) {
    status = FINAL_ENGINEERING_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER;
    issues.push(...missingBlockers.map((blocker) => `MISSING_REQUIRED_EXTERNAL_BLOCKER:${blocker}`));
  }

  const assembledBy = requiredString(input.assembledBy, 'assembledBy');
  const reviewedBy = requiredString(input.reviewedBy, 'reviewedBy');
  if (assembledBy === reviewedBy && status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS) {
    status = FINAL_ENGINEERING_STATUS.HOLD_REVIEW_GOVERNANCE;
    issues.push('FINAL_CANDIDATE_REQUIRES_SEPARATE_REVIEWER');
  }

  const core = {
    candidateId: requiredString(input.candidateId, 'candidateId'),
    operatingMode: OPERATING_MODE,
    candidateParentSha,
    wave17QualifiedHeads: { ...WAVE17_QUALIFIED_HEADS },
    programScopeEvidence: programScopeEvidence.map((item) => ({ ...item })),
    canonicalReleaseEvidenceRef: requiredString(input.canonicalReleaseEvidenceRef, 'canonicalReleaseEvidenceRef'),
    canonicalReleaseEvidenceHashSha256: requiredSha256(input.canonicalReleaseEvidenceHashSha256, 'canonicalReleaseEvidenceHashSha256'),
    openExternalBlockers: [...blockers],
    assembledBy,
    reviewedBy,
    assembledAt: assembled.value,
    reviewedAt: reviewed.value,
    status,
    issues,
  };

  return Object.freeze({
    ...core,
    manifestHashSha256: sha256Object(core),
    engineeringScopeComplete: status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS,
    numberedEngineeringWavesThrough17Closed: status === FINAL_ENGINEERING_STATUS.ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS,
    externalBlockersRemainOpen: true,
    formalStandardsConformanceEstablished: false,
    officialStandardsSourceVerificationComplete: false,
    saudiProfessionalLicensingEstablished: false,
    saudiLegalReviewComplete: false,
    pdplComplianceEstablished: false,
    productionSecurityValidated: false,
    productionPerformanceValidated: false,
    productionResilienceValidated: false,
    externalPenetrationTestEstablished: false,
    reviewerCredentialsVerified: false,
    reviewerIndependenceVerified: false,
    certifiedValuationAuthorityEstablished: false,
    professionalReportExternalIssuanceAuthorized: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    transactionAuthorized: false,
    humanReleaseAuthorityApprovalRequired: true,
    semantics: 'ENGINEERING_RELEASE_CANDIDATE_ASSEMBLED_WITH_EXTERNAL_BLOCKERS means the numbered engineering implementation through Wave 17 has been assembled on the qualified Wave 17D parent with all required program-scope closeout evidence and an explicit external-blocker register. It is an engineering release candidate only. It does not establish official standards conformance, Saudi professional/legal authorization, PDPL compliance, production security/performance validation, reviewer credentials/independence, certified valuation authority, release, merge, deployment, external issuance, or transaction authority.',
  });
}

function verifyFinalEngineeringReleaseCandidate(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return Object.freeze({ valid: false, reasonCode: 'FINAL_CANDIDATE_OBJECT_REQUIRED' });
  try {
    const core = {
      candidateId: requiredString(record.candidateId, 'candidateId'),
      operatingMode: requiredString(record.operatingMode, 'operatingMode'),
      candidateParentSha: requiredCommitSha(record.candidateParentSha, 'candidateParentSha'),
      wave17QualifiedHeads: { ...(record.wave17QualifiedHeads || {}) },
      programScopeEvidence: Array.isArray(record.programScopeEvidence) ? record.programScopeEvidence.map((item) => ({ ...item })) : [],
      canonicalReleaseEvidenceRef: requiredString(record.canonicalReleaseEvidenceRef, 'canonicalReleaseEvidenceRef'),
      canonicalReleaseEvidenceHashSha256: requiredSha256(record.canonicalReleaseEvidenceHashSha256, 'canonicalReleaseEvidenceHashSha256'),
      openExternalBlockers: Array.isArray(record.openExternalBlockers) ? [...record.openExternalBlockers] : [],
      assembledBy: requiredString(record.assembledBy, 'assembledBy'),
      reviewedBy: requiredString(record.reviewedBy, 'reviewedBy'),
      assembledAt: requiredTimestamp(record.assembledAt, 'assembledAt').value,
      reviewedAt: requiredTimestamp(record.reviewedAt, 'reviewedAt').value,
      status: requiredString(record.status, 'status'),
      issues: Array.isArray(record.issues) ? [...record.issues] : [],
    };
    const expectedHash = sha256Object(core);
    if (record.manifestHashSha256 !== expectedHash) return Object.freeze({ valid: false, reasonCode: 'FINAL_CANDIDATE_HASH_MISMATCH', expectedHash });
    return Object.freeze({ valid: true, reasonCode: null, expectedHash });
  } catch (error) {
    return Object.freeze({ valid: false, reasonCode: 'FINAL_CANDIDATE_SCHEMA_INVALID', error: error.message });
  }
}

module.exports = {
  OPERATING_MODE,
  WAVE17_QUALIFIED_HEADS,
  PROGRAM_SCOPE,
  ENGINEERING_SCOPE_STATUS,
  FINAL_ENGINEERING_STATUS,
  REQUIRED_EXTERNAL_BLOCKERS,
  createFinalEngineeringReleaseCandidate,
  verifyFinalEngineeringReleaseCandidate,
};
