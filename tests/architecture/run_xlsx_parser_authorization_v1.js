'use strict';

const assert = require('assert');
const { inspectXlsxOpcContainer } = require('../../src/integration-governance/spreadsheet/xlsx/opc-preflight');
const { authorizeXlsxPassiveParserInvocation } = require('../../src/integration-governance/spreadsheet/xlsx/parser-authorization');

const REVIEWED_SHA256 = '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8';

function writeU16(buffer, offset, value) {
  buffer.writeUInt16LE(value >>> 0, offset);
}

function writeU32(buffer, offset, value) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function buildMinimalZip() {
  const entries = [
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: '_rels/.rels', data: '<Relationships/>' },
    { name: 'xl/workbook.xml', data: '<workbook/>' },
    { name: 'xl/worksheets/sheet1.xml', data: '<worksheet/>' },
  ];
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data, 'utf8');
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0);
    writeU16(local, 8, 0);
    writeU32(local, 18, data.length);
    writeU32(local, 22, data.length);
    writeU16(local, 26, nameBytes.length);
    writeU16(local, 28, 0);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + nameBytes.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0);
    writeU16(central, 10, 0);
    writeU32(central, 20, data.length);
    writeU32(central, 24, data.length);
    writeU16(central, 28, nameBytes.length);
    writeU32(central, 42, localOffset);
    nameBytes.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, centralDirectory.length);
  writeU32(eocd, 16, localOffset);
  writeU16(eocd, 20, 0);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function officialCandidate(overrides = {}) {
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
  const preflight = inspectXlsxOpcContainer(buildMinimalZip());
  assert.strictEqual(preflight.status, 'READY_FOR_PASSIVE_PARSER');
  assert.strictEqual(preflight.parserInvocationAuthorized, true);

  assert.throws(() => authorizeXlsxPassiveParserInvocation({
    dependencyCandidate: officialCandidate(),
    preflightResult: preflight,
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    sourceHashSha256: 'b'.repeat(64),
    parserProfileId: 'XLSX-PASSIVE-V1',
    parserProfileVersion: '1.0.0',
  }), (error) => {
    assert.strictEqual(error.code, 'XLSX_DEPENDENCY_NOT_APPROVED');
    assert.strictEqual(error.dependencyDecision, 'HOLD_REVIEW_INCOMPLETE');
    assert.deepStrictEqual(error.reasonCodes, ['ARCHIVE_SHA256_REQUIRED']);
    return true;
  });

  assert.throws(() => authorizeXlsxPassiveParserInvocation({
    dependencyCandidate: officialCandidate({ archiveSha256: 'c'.repeat(64) }),
    preflightResult: preflight,
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    sourceHashSha256: 'b'.repeat(64),
    parserProfileId: 'XLSX-PASSIVE-V1',
    parserProfileVersion: '1.0.0',
  }), (error) => {
    assert.strictEqual(error.code, 'XLSX_DEPENDENCY_NOT_APPROVED');
    assert.strictEqual(error.dependencyDecision, 'REJECTED_DEPENDENCY');
    assert.deepStrictEqual(error.reasonCodes, ['ARCHIVE_SHA256_MISMATCH']);
    return true;
  });

  const authorized = authorizeXlsxPassiveParserInvocation({
    dependencyCandidate: officialCandidate({ archiveSha256: REVIEWED_SHA256 }),
    preflightResult: preflight,
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    sourceHashSha256: 'b'.repeat(64),
    parserProfileId: 'XLSX-PASSIVE-V1',
    parserProfileVersion: '1.0.0',
  });

  assert.strictEqual(authorized.status, 'PASSIVE_PARSER_INVOCATION_AUTHORIZED');
  assert.strictEqual(authorized.caseId, 'CASE-XLSX-001');
  assert.strictEqual(authorized.projectId, 'PROJECT-XLSX-001');
  assert.strictEqual(authorized.sourceHashSha256, 'b'.repeat(64));
  assert.strictEqual(authorized.parserProfileId, 'XLSX-PASSIVE-V1');
  assert.strictEqual(authorized.parserProfileVersion, '1.0.0');
  assert.strictEqual(authorized.dependencyReview.decision, 'APPROVED_WITH_GOVERNED_WRAPPER');
  assert.strictEqual(authorized.parserInvocationAuthorized, true);
  assert.strictEqual(authorized.formulaEvaluationAuthorized, false);
  assert.strictEqual(authorized.macroExecutionAuthorized, false);
  assert.strictEqual(authorized.externalLinkResolutionAuthorized, false);
  assert.strictEqual(authorized.sourceAuthorityPromoted, false);
  assert.strictEqual(authorized.evidenceVerified, false);
  assert.strictEqual(authorized.canonicalMutationPerformed, false);
  assert.strictEqual(authorized.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(authorized), true);

  assert.throws(() => authorizeXlsxPassiveParserInvocation({
    dependencyCandidate: officialCandidate({
      version: '0.18.5',
      sourceUrl: 'https://registry.npmjs.org/xlsx/-/xlsx-0.18.5.tgz',
      archiveSha256: REVIEWED_SHA256,
    }),
    preflightResult: preflight,
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    sourceHashSha256: 'b'.repeat(64),
    parserProfileId: 'XLSX-PASSIVE-V1',
    parserProfileVersion: '1.0.0',
  }), (error) => {
    assert.strictEqual(error.code, 'XLSX_DEPENDENCY_NOT_APPROVED');
    assert.strictEqual(error.dependencyDecision, 'REJECTED_DEPENDENCY');
    assert.deepStrictEqual(error.reasonCodes, ['VERSION_BELOW_SECURITY_FLOOR']);
    return true;
  });

  console.log('run_xlsx_parser_authorization_v1: PASS');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
