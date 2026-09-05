'use strict';

const assert = require('assert');
const { AUTHORITY_CLASS } = require('../../src/document-intelligence/contracts');
const { VALUE_TYPE, ingestDocument } = require('../../src/document-intelligence/pipeline');
const {
  SPREADSHEET_FIELD_DIRECTION,
  createSpreadsheetFieldMapping,
  createSpreadsheetSchema,
} = require('../../src/integration-governance/spreadsheet/contracts');
const { SPREADSHEET_IMPORT_STATUS } = require('../../src/integration-governance/spreadsheet/controlled-import');
const { createXlsxCellProfile, createXlsxParserProfile } = require('../../src/integration-governance/spreadsheet/xlsx/parser-profile');
const {
  SHEETJS_PASSIVE_PARSER_ID,
  SHEETJS_PASSIVE_PARSER_VERSION,
  parseSheetJsPassiveWorkbook,
} = require('../../src/integration-governance/spreadsheet/xlsx/sheetjs-passive-parser');
const { buildGovernedXlsxSpreadsheetImport } = require('../../src/integration-governance/spreadsheet/xlsx/governed-xlsx-import');

function writeU16(buffer, offset, value) { buffer.writeUInt16LE(value >>> 0, offset); }
function writeU32(buffer, offset, value) { buffer.writeUInt32LE(value >>> 0, offset); }

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data || 'x', 'utf8');
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
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, centralDirectory.length);
  writeU32(eocd, 16, localOffset);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function validContainer(marker = 'A') {
  return buildZip([
    { name: '[Content_Types].xml', data: `<Types marker="${marker}"/>` },
    { name: '_rels/.rels', data: '<Relationships/>' },
    { name: 'xl/workbook.xml', data: '<workbook/>' },
    { name: 'xl/worksheets/sheet1.xml', data: '<worksheet/>' },
  ]);
}

function decodeCell(ref) {
  const match = /^([A-Z]+)([1-9][0-9]*)$/i.exec(ref);
  if (!match) throw new Error(`invalid cell ref ${ref}`);
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  return { r: Number(match[2]) - 1, c: col - 1 };
}

function encodeCell({ r, c }) {
  let col = c + 1;
  let letters = '';
  while (col > 0) {
    col -= 1;
    letters = String.fromCharCode(65 + (col % 26)) + letters;
    col = Math.floor(col / 26);
  }
  return `${letters}${r + 1}`;
}

function fakeSheetJs({ formula = null } = {}) {
  return {
    version: '0.20.3',
    read() {
      return {
        SheetNames: ['Import', 'Hidden'],
        Sheets: {
          Import: {
            '!ref': 'A1:B4',
            '!merges': [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }],
            A1: { t: 's', v: 'Metric' },
            B1: { t: 's', v: 'Value' },
            A2: { t: 's', v: 'EGI' },
            B2: formula ? { t: 'n', v: 1250000, f: formula } : { t: 'n', v: 1250000 },
            A3: { t: 's', v: 'OPEX' },
            B3: { t: 'n', v: 250000 },
            A4: { t: 's', v: 'CAP' },
            B4: { t: 'n', v: 0.075 },
          },
          Hidden: {
            '!ref': 'A1',
            A1: { t: 's', v: 'hidden' },
          },
        },
        Workbook: { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] },
      };
    },
    utils: {
      decode_range(ref) {
        const [start, end = start] = String(ref).split(':');
        return { s: decodeCell(start), e: decodeCell(end) };
      },
      encode_range(range) {
        return `${encodeCell(range.s)}:${encodeCell(range.e)}`;
      },
    },
  };
}

function parserProfile() {
  return createXlsxParserProfile({
    profileId: 'XLSX-PILOT-PROFILE',
    profileVersion: '1.0.0',
    cellProfiles: [
      createXlsxCellProfile({ sheetName: 'Import', cell: 'B2', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-LEASE-1'] }),
      createXlsxCellProfile({ sheetName: 'Import', cell: 'B3', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-OPEX-1'] }),
      createXlsxCellProfile({ sheetName: 'Import', cell: 'B4', valueType: VALUE_TYPE.NUMBER, unit: 'RATIO', evidenceRefs: ['EV-CAP-1'] }),
    ],
  });
}

function importSchema() {
  return createSpreadsheetSchema({
    schemaId: 'XLSX-PILOT-IMPORT',
    schemaVersion: '1.0.0',
    direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
    mappings: [
      createSpreadsheetFieldMapping({ mappingId: 'EGI', direction: SPREADSHEET_FIELD_DIRECTION.IMPORT, sheetName: 'Import', cell: 'B2', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRequired: true, targetPath: 'financial.inputs.effectiveGrossIncome' }),
      createSpreadsheetFieldMapping({ mappingId: 'OPEX', direction: SPREADSHEET_FIELD_DIRECTION.IMPORT, sheetName: 'Import', cell: 'B3', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRequired: true, targetPath: 'financial.inputs.operatingExpenses' }),
      createSpreadsheetFieldMapping({ mappingId: 'CAP', direction: SPREADSHEET_FIELD_DIRECTION.IMPORT, sheetName: 'Import', cell: 'B4', valueType: VALUE_TYPE.NUMBER, unit: 'RATIO', evidenceRequired: true, targetPath: 'valuation.inputs.capitalizationRate' }),
    ],
  });
}

function canonicalSnapshot() {
  return {
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    financial: { inputs: { effectiveGrossIncome: 1200000, operatingExpenses: 250000 } },
    valuation: { inputs: { capitalizationRate: 0.08 } },
  };
}

async function sourceDocumentFor(content, caseId = 'CASE-XLSX-001', documentId = 'DOC-XLSX-001') {
  return ingestDocument({
    documentId,
    caseId,
    fileName: 'controlled-underwriting.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content,
    authorityClass: AUTHORITY_CLASS.UNKNOWN,
    existingDocuments: [],
    receivedAt: '2026-09-05T16:30:00Z',
  });
}

async function run() {
  const profile = parserProfile();
  const content = validContainer('A');
  const parserArgs = {
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    workbookId: 'WB-XLSX-001',
    workbookVersion: '1',
    content,
    parserProfile: profile,
    sheetjs: fakeSheetJs(),
  };

  const first = await parseSheetJsPassiveWorkbook(parserArgs);
  const second = await parseSheetJsPassiveWorkbook(parserArgs);
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.format, 'XLSX');
  assert.strictEqual(first.parserAttestation.parserId, SHEETJS_PASSIVE_PARSER_ID);
  assert.strictEqual(first.parserAttestation.parserVersion, SHEETJS_PASSIVE_PARSER_VERSION);
  assert.strictEqual(first.parserAttestation.dependencyVersion, '0.20.3');
  assert.strictEqual(first.parserAttestation.dependencyArtifactSha256, '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8');
  assert.strictEqual(first.sheets.Import.cells.B2.value, 1250000);
  assert.strictEqual(first.sheets.Import.cells.B2.valueType, VALUE_TYPE.NUMBER);
  assert.strictEqual(first.sheets.Import.cells.B2.unit, 'SAR');
  assert.deepStrictEqual(first.sheets.Import.cells.B2.evidenceRefs, ['EV-LEASE-1']);
  assert.strictEqual(first.sheets.Import.cells.A2.valueType, VALUE_TYPE.STRING);
  assert.strictEqual(first.sheets.Import.cells.A2.unit, null);
  assert.deepStrictEqual(first.sheets.Import.cells.A2.evidenceRefs, []);
  assert.strictEqual(first.sheets.Hidden.hiddenState, 'HIDDEN');
  assert.deepStrictEqual(first.sheets.Import.merges, ['A1:B1']);
  assert.strictEqual(first.sourceAuthorityPromoted, false);
  assert.strictEqual(first.evidenceVerifiedByParser, false);
  assert.strictEqual(first.canonicalMutationPerformed, false);
  assert.strictEqual(first.directWriteAuthorized, false);
  assert.strictEqual(first.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(first), true);

  const sourceDocument = await sourceDocumentFor(content);
  const governed = await buildGovernedXlsxSpreadsheetImport({
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    workbookId: 'WB-XLSX-001',
    workbookVersion: '1',
    sourceDocument,
    content,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T16:35:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-XLSX-001',
    sheetjs: fakeSheetJs(),
  });
  assert.strictEqual(governed.sourceDocumentBound, true);
  assert.strictEqual(governed.sourceDocumentHashSha256, sourceDocument.contentHashSha256);
  assert.strictEqual(governed.parserAttestation.inputContentHashSha256, sourceDocument.contentHashSha256);
  assert.strictEqual(governed.controlledImport.status, SPREADSHEET_IMPORT_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(governed.controlledImport.changes.length, 2);
  assert.strictEqual(governed.controlledImport.unchanged.length, 1);
  assert.strictEqual(governed.controlledImport.proposals.length, 2);
  assert.strictEqual(governed.canonicalMutationPerformed, false);
  assert.strictEqual(governed.humanApprovalRequired, true);
  assert.strictEqual(governed.directWriteAuthorized, false);
  assert.strictEqual(governed.transactionAuthorized, false);

  const formulaResult = await buildGovernedXlsxSpreadsheetImport({
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    workbookId: 'WB-XLSX-FORMULA',
    workbookVersion: '1',
    sourceDocument,
    content,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T16:36:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-XLSX-FORMULA',
    sheetjs: fakeSheetJs({ formula: 'SUM(B10:B11)' }),
  });
  assert.strictEqual(formulaResult.workbookSnapshot.sheets.Import.cells.B2.formula, 'SUM(B10:B11)');
  assert.strictEqual(formulaResult.controlledImport.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.strictEqual(formulaResult.controlledImport.proposals.length, 0);

  await assert.rejects(() => parseSheetJsPassiveWorkbook({
    ...parserArgs,
    workbookId: 'WB-XLSX-EXTERNAL-FORMULA',
    sheetjs: fakeSheetJs({ formula: '[External.xlsx]Sheet1!A1' }),
  }), (error) => error.code === 'XLSX_EXTERNAL_FORMULA_REFERENCE_NOT_ALLOWED');

  const otherCaseDocument = await sourceDocumentFor(content, 'CASE-OTHER', 'DOC-XLSX-OTHER');
  await assert.rejects(() => buildGovernedXlsxSpreadsheetImport({
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    workbookId: 'WB-XLSX-SCOPE',
    workbookVersion: '1',
    sourceDocument: otherCaseDocument,
    content,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T16:37:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-XLSX-SCOPE',
    sheetjs: fakeSheetJs(),
  }), (error) => error.code === 'PARSER_SOURCE_SCOPE_MISMATCH');

  await assert.rejects(() => buildGovernedXlsxSpreadsheetImport({
    caseId: 'CASE-XLSX-001',
    projectId: 'PROJECT-XLSX-001',
    workbookId: 'WB-XLSX-HASH',
    workbookVersion: '1',
    sourceDocument,
    content: validContainer('B'),
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T16:38:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-XLSX-HASH',
    sheetjs: fakeSheetJs(),
  }), (error) => error.code === 'PARSER_SOURCE_HASH_MISMATCH');

  await assert.rejects(() => parseSheetJsPassiveWorkbook({
    ...parserArgs,
    workbookId: 'WB-XLSX-RUNTIME-VERSION',
    sheetjs: { ...fakeSheetJs(), version: '0.20.4' },
  }), (error) => error.code === 'XLSX_RUNTIME_VERSION_MISMATCH');

  console.log('run_governed_xlsx_adapter_contract_v1: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
