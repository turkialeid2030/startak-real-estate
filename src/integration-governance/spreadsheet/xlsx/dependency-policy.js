'use strict';

const XLSX_DEPENDENCY_DECISION = Object.freeze({
  APPROVED_DEPENDENCY: 'APPROVED_DEPENDENCY',
  APPROVED_WITH_GOVERNED_WRAPPER: 'APPROVED_WITH_GOVERNED_WRAPPER',
  REJECTED_DEPENDENCY: 'REJECTED_DEPENDENCY',
  HOLD_REVIEW_INCOMPLETE: 'HOLD_REVIEW_INCOMPLETE',
});

const SHEETJS_CE_POLICY = Object.freeze({
  packageName: 'xlsx',
  preferredVersion: '0.20.3',
  minimumSecurityVersion: '0.20.2',
  officialArtifactUrl: 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
  requiredLicense: 'Apache-2.0',
  reviewApprovedSha256: '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8',
  reviewApprovedSizeBytes: 2409319,
  provenance: 'SheetJS official CDN',
  integrityReviewWorkflowRunId: 33976591390,
  integrityReviewWorkflowJobId: 101334258811,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseVersion(version) {
  const normalized = requireString(version, 'version');
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (!match) {
    const error = new Error('XLSX dependency version must be exact x.y.z');
    error.code = 'XLSX_DEPENDENCY_VERSION_INVALID';
    throw error;
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function result(decision, reasonCodes, candidate) {
  return deepFreeze({
    schemaVersion: 1,
    decision,
    reasonCodes: [...reasonCodes],
    candidate: {
      packageName: candidate.packageName,
      version: candidate.version,
      sourceUrl: candidate.sourceUrl,
      license: candidate.license,
      archiveSha256: candidate.archiveSha256 || null,
    },
    parserInvocationAuthorized: decision === XLSX_DEPENDENCY_DECISION.APPROVED_DEPENDENCY
      || decision === XLSX_DEPENDENCY_DECISION.APPROVED_WITH_GOVERNED_WRAPPER,
    sourceAuthorityPromoted: false,
    evidenceVerified: false,
    canonicalMutationPerformed: false,
    transactionAuthorized: false,
  });
}

function evaluateXlsxDependencyCandidate({
  packageName,
  version,
  sourceUrl,
  license,
  archiveSha256 = null,
} = {}) {
  const candidate = {
    packageName: requireString(packageName, 'packageName'),
    version: requireString(version, 'version'),
    sourceUrl: requireString(sourceUrl, 'sourceUrl'),
    license: requireString(license, 'license'),
    archiveSha256,
  };

  parseVersion(candidate.version);

  if (candidate.packageName !== SHEETJS_CE_POLICY.packageName) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['PACKAGE_NOT_APPROVED'], candidate);
  }

  if (compareVersions(candidate.version, SHEETJS_CE_POLICY.minimumSecurityVersion) < 0) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['VERSION_BELOW_SECURITY_FLOOR'], candidate);
  }

  if (candidate.version !== SHEETJS_CE_POLICY.preferredVersion) {
    return result(XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE, ['VERSION_NOT_REVIEWED'], candidate);
  }

  if (candidate.sourceUrl !== SHEETJS_CE_POLICY.officialArtifactUrl) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['UNAPPROVED_ARTIFACT_SOURCE'], candidate);
  }

  if (candidate.license !== SHEETJS_CE_POLICY.requiredLicense) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['LICENSE_MISMATCH'], candidate);
  }

  if (archiveSha256 !== null && !isSha256(archiveSha256)) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['ARCHIVE_SHA256_INVALID'], candidate);
  }

  if (!archiveSha256) {
    return result(XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE, ['ARCHIVE_SHA256_REQUIRED'], candidate);
  }

  if (!SHEETJS_CE_POLICY.reviewApprovedSha256) {
    return result(XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE, ['REVIEW_APPROVED_SHA256_NOT_PINNED'], candidate);
  }

  if (archiveSha256.toLowerCase() !== SHEETJS_CE_POLICY.reviewApprovedSha256.toLowerCase()) {
    return result(XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY, ['ARCHIVE_SHA256_MISMATCH'], candidate);
  }

  return result(
    XLSX_DEPENDENCY_DECISION.APPROVED_WITH_GOVERNED_WRAPPER,
    ['EXACT_ARTIFACT_PIN_MATCH', 'GOVERNED_WRAPPER_REQUIRED'],
    candidate,
  );
}

module.exports = {
  XLSX_DEPENDENCY_DECISION,
  SHEETJS_CE_POLICY,
  compareVersions,
  evaluateXlsxDependencyCandidate,
};
