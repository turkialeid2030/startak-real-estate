'use strict';

const crypto = require('crypto');
const {
  OBSERVABILITY_STATUS,
} = require('./controlled-observability-incident-qualification');

const SECURITY_UAT_STATUS = Object.freeze({
  HOLD_OBSERVABILITY_QUALIFICATION: 'HOLD_OBSERVABILITY_QUALIFICATION',
  HOLD_PENTEST_EVIDENCE: 'HOLD_PENTEST_EVIDENCE',
  HOLD_PENTEST_FINDINGS: 'HOLD_PENTEST_FINDINGS',
  HOLD_UAT_EVIDENCE: 'HOLD_UAT_EVIDENCE',
  HOLD_SCOPE_MISMATCH: 'HOLD_SCOPE_MISMATCH',
  HOLD_STALE_EVIDENCE: 'HOLD_STALE_EVIDENCE',
  INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED: 'INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED',
});

const AUTHORITY = Object.freeze({
  releaseAuthorized: false,
  mergeAuthorized: false,
  deploymentAuthorized: false,
  goLiveAuthorized: false,
  transactionAuthorized: false,
  productionSecurityValidated: false,
  productionUatValidated: false,
  externalEvidenceAuthenticityValidatedHere: false,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const COMMIT_SHA_RE = /^[a-f0-9]{40}$/i;
const SEVERITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredCommitSha(value, field = 'exactCommitSha') {
  const normalized = requiredString(value, field).toLowerCase();
  if (!COMMIT_SHA_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character git commit SHA`);
  return normalized;
}

function requiredSha256(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new TypeError(`${field} must be a SHA-256 hex digest`);
  return normalized;
}

function requiredTimestamp(value, field) {
  const normalized = requiredString(value, field);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  return Object.freeze({ value: normalized, millis });
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return value;
}

function nonNegativeNumber(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
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
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashRef(value, field) {
  return `sha256:${sha256Text(requiredString(value, field))}`;
}

function normalizeEnvironment(value) {
  const normalized = requiredString(value, 'environment').toLowerCase();
  if (normalized !== 'staging') throw new TypeError('environment must be staging');
  return normalized;
}

function normalizeFindingCounts(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  const result = {};
  for (const severity of SEVERITIES) result[severity] = nonNegativeInteger(value[severity] ?? 0, `${field}.${severity}`);
  return freeze(result);
}

function normalizePentestEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const started = requiredTimestamp(value.startedAt, 'pentest.startedAt');
    const completed = requiredTimestamp(value.completedAt, 'pentest.completedAt');
    const reviewed = requiredTimestamp(value.reviewedAt, 'pentest.reviewedAt');
    if (completed.millis < started.millis || reviewed.millis < completed.millis) throw new TypeError('pentest timestamp order invalid');
    const findingCounts = normalizeFindingCounts(value.findingCounts, 'pentest.findingCounts');
    const openFindingCounts = normalizeFindingCounts(value.openFindingCounts, 'pentest.openFindingCounts');
    for (const severity of SEVERITIES) {
      if (openFindingCounts[severity] > findingCounts[severity]) throw new TypeError(`pentest.openFindingCounts.${severity} exceeds total findings`);
    }
    const testerOrganization = requiredString(value.testerOrganization, 'pentest.testerOrganization');
    const preparedBy = requiredString(value.preparedBy, 'pentest.preparedBy');
    const reviewedBy = requiredString(value.reviewedBy, 'pentest.reviewedBy');
    return freeze({
      status: requiredString(value.status, 'pentest.status'),
      environment: requiredString(value.environment, 'pentest.environment').toLowerCase(),
      serviceRef: requiredString(value.serviceRef, 'pentest.serviceRef'),
      exactCommitSha: requiredCommitSha(value.exactCommitSha, 'pentest.exactCommitSha'),
      reportRef: hashRef(value.reportRef, 'pentest.reportRef'),
      reportHashSha256: requiredSha256(value.reportHashSha256, 'pentest.reportHashSha256'),
      testerOrganizationRef: hashRef(testerOrganization, 'pentest.testerOrganization'),
      preparedByRef: hashRef(preparedBy, 'pentest.preparedBy'),
      reviewedByRef: hashRef(reviewedBy, 'pentest.reviewedBy'),
      independentAssessorAttested: value.independentAssessorAttested === true,
      scopeIncludesAuthentication: value.scopeIncludesAuthentication === true,
      scopeIncludesTenantIsolation: value.scopeIncludesTenantIsolation === true,
      scopeIncludesApiAuthorization: value.scopeIncludesApiAuthorization === true,
      scopeIncludesServerRuntime: value.scopeIncludesServerRuntime === true,
      retestCompletedForRemediatedCriticalHigh: value.retestCompletedForRemediatedCriticalHigh === true,
      findingCounts,
      openFindingCounts,
      startedAt: started.value,
      completedAt: completed.value,
      reviewedAt: reviewed.value,
      reviewerSeparateFromPreparer: preparedBy !== reviewedBy,
    });
  } catch (_) {
    return null;
  }
}

function normalizeUatEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const started = requiredTimestamp(value.startedAt, 'uat.startedAt');
    const completed = requiredTimestamp(value.completedAt, 'uat.completedAt');
    const reviewed = requiredTimestamp(value.reviewedAt, 'uat.reviewedAt');
    if (completed.millis < started.millis || reviewed.millis < completed.millis) throw new TypeError('uat timestamp order invalid');
    const requiredScenarios = nonNegativeInteger(value.requiredScenarios, 'uat.requiredScenarios');
    const passedScenarios = nonNegativeInteger(value.passedScenarios, 'uat.passedScenarios');
    const failedScenarios = nonNegativeInteger(value.failedScenarios, 'uat.failedScenarios');
    if (requiredScenarios === 0 || passedScenarios + failedScenarios !== requiredScenarios) throw new TypeError('uat scenario counts inconsistent');
    const businessOwner = requiredString(value.businessOwner, 'uat.businessOwner');
    const reviewedBy = requiredString(value.reviewedBy, 'uat.reviewedBy');
    return freeze({
      status: requiredString(value.status, 'uat.status'),
      environment: requiredString(value.environment, 'uat.environment').toLowerCase(),
      serviceRef: requiredString(value.serviceRef, 'uat.serviceRef'),
      exactCommitSha: requiredCommitSha(value.exactCommitSha, 'uat.exactCommitSha'),
      acceptanceRef: hashRef(value.acceptanceRef, 'uat.acceptanceRef'),
      acceptanceArtifactHashSha256: requiredSha256(value.acceptanceArtifactHashSha256, 'uat.acceptanceArtifactHashSha256'),
      businessOwnerRef: hashRef(businessOwner, 'uat.businessOwner'),
      reviewedByRef: hashRef(reviewedBy, 'uat.reviewedBy'),
      reviewerSeparateFromBusinessOwner: businessOwner !== reviewedBy,
      criticalWorkflowCoverageComplete: value.criticalWorkflowCoverageComplete === true,
      tenantBoundaryAcceptanceComplete: value.tenantBoundaryAcceptanceComplete === true,
      authorizationWorkflowAcceptanceComplete: value.authorizationWorkflowAcceptanceComplete === true,
      requiredScenarios,
      passedScenarios,
      failedScenarios,
      startedAt: started.value,
      completedAt: completed.value,
      reviewedAt: reviewed.value,
    });
  } catch (_) {
    return null;
  }
}

function makeResult({ status, plan, pentest, uat, issues = [] }) {
  const evidenceCore = {
    schemaVersion: 1,
    status,
    planHashSha256: plan.planHashSha256,
    observabilityQualificationRef: plan.observabilityQualificationRef,
    pentestEvidenceRef: pentest ? `sha256:${sha256Object(pentest)}` : null,
    uatEvidenceRef: uat ? `sha256:${sha256Object(uat)}` : null,
    issues: [...issues],
  };
  const evidenceBundleHashSha256 = sha256Object(evidenceCore);
  return freeze({
    ...evidenceCore,
    plan,
    pentest,
    uat,
    evidenceBundleHashSha256,
    evidenceBundleRef: `sha256:${evidenceBundleHashSha256}`,
    productionQualified: false,
    releaseCandidateAuthorityEstablished: false,
    authority: AUTHORITY,
    semantics: 'This gate deterministically validates supplied independent penetration-test and UAT evidence against the exact staging commit and completed observability qualification. External report authenticity and assessor credentials are not independently verified by this code. Completion does not certify production security or authorize release, merge, deployment, go-live, or transactions.',
  });
}

function createIndependentSecurityUatEvidenceGate() {
  return function qualify({
    observabilityQualification,
    environment,
    serviceRef,
    exactCommitSha,
    assessedAt = new Date().toISOString(),
    maximumEvidenceAgeDays = 30,
    pentestEvidence,
    uatEvidence,
  } = {}) {
    const env = normalizeEnvironment(environment);
    const service = requiredString(serviceRef, 'serviceRef');
    const commitSha = requiredCommitSha(exactCommitSha);
    const assessed = requiredTimestamp(assessedAt, 'assessedAt');
    const maxAgeDays = nonNegativeNumber(maximumEvidenceAgeDays, 'maximumEvidenceAgeDays');

    const observabilityComplete = Boolean(
      observabilityQualification
      && observabilityQualification.status === OBSERVABILITY_STATUS.OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED
      && observabilityQualification.plan?.environment === env
      && observabilityQualification.plan?.serviceRef === service
      && observabilityQualification.plan?.exactCommitSha === commitSha,
    );
    const observabilityQualificationRef = observabilityQualification?.evidenceHashSha256
      ? `sha256:${observabilityQualification.evidenceHashSha256}`
      : null;

    const planCore = {
      schemaVersion: 1,
      environment: env,
      serviceRef: service,
      exactCommitSha: commitSha,
      assessedAt: assessed.value,
      maximumEvidenceAgeDays: maxAgeDays,
      observabilityQualificationRef,
      requiredIndependentEvidence: ['penetrationTest', 'userAcceptanceTesting'],
      releaseAuthorityFromThisGate: false,
    };
    const plan = freeze({ ...planCore, planHashSha256: sha256Object(planCore) });

    if (!observabilityComplete) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION, plan });
    }

    const pentest = normalizePentestEvidence(pentestEvidence);
    if (!pentest) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE, plan, issues: ['PENTEST_EVIDENCE_INVALID_OR_INCOMPLETE'] });
    }
    const uat = normalizeUatEvidence(uatEvidence);
    if (!uat) {
      return makeResult({ status: SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE, plan, pentest, issues: ['UAT_EVIDENCE_INVALID_OR_INCOMPLETE'] });
    }

    const scopeIssues = [];
    if (pentest.environment !== env || pentest.serviceRef !== service || pentest.exactCommitSha !== commitSha) scopeIssues.push('PENTEST_SCOPE_MISMATCH');
    if (uat.environment !== env || uat.serviceRef !== service || uat.exactCommitSha !== commitSha) scopeIssues.push('UAT_SCOPE_MISMATCH');
    if (scopeIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_SCOPE_MISMATCH, plan, pentest, uat, issues: scopeIssues });

    const staleIssues = [];
    const maxAgeMs = maxAgeDays * 86400000;
    for (const [name, reviewedAt] of [['PENTEST', pentest.reviewedAt], ['UAT', uat.reviewedAt]]) {
      const age = assessed.millis - Date.parse(reviewedAt);
      if (age < 0 || age > maxAgeMs) staleIssues.push(`${name}_EVIDENCE_OUTSIDE_FRESHNESS`);
    }
    if (staleIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE, plan, pentest, uat, issues: staleIssues });

    const pentestEvidenceIssues = [];
    if (pentest.status !== 'PASS') pentestEvidenceIssues.push('PENTEST_STATUS_NOT_PASS');
    if (!pentest.independentAssessorAttested) pentestEvidenceIssues.push('PENTEST_INDEPENDENT_ASSESSOR_NOT_ATTESTED');
    if (!pentest.reviewerSeparateFromPreparer) pentestEvidenceIssues.push('PENTEST_REVIEWER_NOT_SEPARATE');
    if (!pentest.scopeIncludesAuthentication) pentestEvidenceIssues.push('PENTEST_AUTHENTICATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesTenantIsolation) pentestEvidenceIssues.push('PENTEST_TENANT_ISOLATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesApiAuthorization) pentestEvidenceIssues.push('PENTEST_API_AUTHORIZATION_SCOPE_MISSING');
    if (!pentest.scopeIncludesServerRuntime) pentestEvidenceIssues.push('PENTEST_SERVER_RUNTIME_SCOPE_MISSING');
    if (pentestEvidenceIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE, plan, pentest, uat, issues: pentestEvidenceIssues });

    const openCriticalHigh = pentest.openFindingCounts.CRITICAL + pentest.openFindingCounts.HIGH;
    if (openCriticalHigh > 0) {
      return makeResult({
        status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS,
        plan,
        pentest,
        uat,
        issues: ['OPEN_CRITICAL_OR_HIGH_PENTEST_FINDINGS'],
      });
    }
    const remediatedCriticalHigh = (pentest.findingCounts.CRITICAL + pentest.findingCounts.HIGH) > 0;
    if (remediatedCriticalHigh && !pentest.retestCompletedForRemediatedCriticalHigh) {
      return makeResult({
        status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS,
        plan,
        pentest,
        uat,
        issues: ['CRITICAL_HIGH_REMEDIATION_RETEST_NOT_COMPLETE'],
      });
    }

    const uatIssues = [];
    if (uat.status !== 'PASS') uatIssues.push('UAT_STATUS_NOT_PASS');
    if (!uat.reviewerSeparateFromBusinessOwner) uatIssues.push('UAT_REVIEWER_NOT_SEPARATE');
    if (!uat.criticalWorkflowCoverageComplete) uatIssues.push('UAT_CRITICAL_WORKFLOW_COVERAGE_INCOMPLETE');
    if (!uat.tenantBoundaryAcceptanceComplete) uatIssues.push('UAT_TENANT_BOUNDARY_ACCEPTANCE_INCOMPLETE');
    if (!uat.authorizationWorkflowAcceptanceComplete) uatIssues.push('UAT_AUTHORIZATION_WORKFLOW_ACCEPTANCE_INCOMPLETE');
    if (uat.failedScenarios !== 0 || uat.passedScenarios !== uat.requiredScenarios) uatIssues.push('UAT_SCENARIOS_NOT_ALL_PASSING');
    if (uatIssues.length > 0) return makeResult({ status: SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE, plan, pentest, uat, issues: uatIssues });

    return makeResult({
      status: SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED,
      plan,
      pentest,
      uat,
    });
  };
}

const evaluateIndependentSecurityUatEvidence = createIndependentSecurityUatEvidenceGate();

module.exports = {
  SECURITY_UAT_STATUS,
  AUTHORITY,
  SEVERITIES,
  createIndependentSecurityUatEvidenceGate,
  evaluateIndependentSecurityUatEvidence,
};
