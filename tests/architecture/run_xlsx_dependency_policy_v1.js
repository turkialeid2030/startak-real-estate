'use strict';

const assert = require('assert');
const {
  XLSX_DEPENDENCY_DECISION,
  SHEETJS_CE_POLICY,
  compareVersions,
  evaluateXlsxDependencyCandidate,
} = require('../../src/integration-governance/spreadsheet/xlsx/dependency-policy');

function official(overrides = {}) {
  return {
    packageName: 'xlsx',
    version: '0.20.3',
    sourceUrl: 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',
    license: 'Apache-2.0',
    archiveSha256: null,
    ...overrides,
  };
}

function run() {
  assert.strictEqual(compareVersions('0.20.1', '0.20.2'), -1);
  assert.strictEqual(compareVersions('0.20.2', '0.20.2'), 0);
  assert.strictEqual(compareVersions('0.20.3', '0.20.2'), 1);

  const missingHash = evaluateXlsxDependencyCandidate(official());
  assert.strictEqual(missingHash.decision, XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE);
  assert.deepStrictEqual(missingHash.reasonCodes, ['ARCHIVE_SHA256_REQUIRED']);
  assert.strictEqual(missingHash.parserInvocationAuthorized, false);
  assert.strictEqual(missingHash.sourceAuthorityPromoted, false);
  assert.strictEqual(missingHash.evidenceVerified, false);
  assert.strictEqual(missingHash.canonicalMutationPerformed, false);
  assert.strictEqual(missingHash.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(missingHash), true);

  const unpinnedHash = evaluateXlsxDependencyCandidate(official({ archiveSha256: 'a'.repeat(64) }));
  assert.strictEqual(unpinnedHash.decision, XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE);
  assert.deepStrictEqual(unpinnedHash.reasonCodes, ['REVIEW_APPROVED_SHA256_NOT_PINNED']);

  const oldVersion = evaluateXlsxDependencyCandidate(official({
    version: '0.20.1',
    sourceUrl: 'https://cdn.sheetjs.com/xlsx-0.20.1/xlsx-0.20.1.tgz',
  }));
  assert.strictEqual(oldVersion.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(oldVersion.reasonCodes, ['VERSION_BELOW_SECURITY_FLOOR']);

  const staleNpm = evaluateXlsxDependencyCandidate(official({
    version: '0.18.5',
    sourceUrl: 'https://registry.npmjs.org/xlsx/-/xlsx-0.18.5.tgz',
  }));
  assert.strictEqual(staleNpm.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(staleNpm.reasonCodes, ['VERSION_BELOW_SECURITY_FLOOR']);

  const wrongSource = evaluateXlsxDependencyCandidate(official({
    sourceUrl: 'https://example.invalid/xlsx-0.20.3.tgz',
  }));
  assert.strictEqual(wrongSource.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(wrongSource.reasonCodes, ['UNAPPROVED_ARTIFACT_SOURCE']);

  const exceljs = evaluateXlsxDependencyCandidate({
    packageName: 'exceljs',
    version: '4.4.0',
    sourceUrl: 'https://registry.npmjs.org/exceljs/-/exceljs-4.4.0.tgz',
    license: 'MIT',
  });
  assert.strictEqual(exceljs.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(exceljs.reasonCodes, ['PACKAGE_NOT_APPROVED']);

  const wrongLicense = evaluateXlsxDependencyCandidate(official({ license: 'MIT' }));
  assert.strictEqual(wrongLicense.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(wrongLicense.reasonCodes, ['LICENSE_MISMATCH']);

  const malformedHash = evaluateXlsxDependencyCandidate(official({ archiveSha256: 'not-a-sha256' }));
  assert.strictEqual(malformedHash.decision, XLSX_DEPENDENCY_DECISION.REJECTED_DEPENDENCY);
  assert.deepStrictEqual(malformedHash.reasonCodes, ['ARCHIVE_SHA256_INVALID']);

  const otherVersion = evaluateXlsxDependencyCandidate(official({
    version: '0.20.4',
    sourceUrl: 'https://cdn.sheetjs.com/xlsx-0.20.4/xlsx-0.20.4.tgz',
  }));
  assert.strictEqual(otherVersion.decision, XLSX_DEPENDENCY_DECISION.HOLD_REVIEW_INCOMPLETE);
  assert.deepStrictEqual(otherVersion.reasonCodes, ['VERSION_NOT_REVIEWED']);

  assert.strictEqual(SHEETJS_CE_POLICY.reviewApprovedSha256, null);
  assert.strictEqual(SHEETJS_CE_POLICY.minimumSecurityVersion, '0.20.2');

  console.log('run_xlsx_dependency_policy_v1: PASS');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
