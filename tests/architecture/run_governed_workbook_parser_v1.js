'use strict';

const assert = require('assert');
const { AUTHORITY_CLASS } = require('../../src/document-intelligence/contracts');
const { VALUE_TYPE, ingestDocument } = require('../../src/document-intelligence/pipeline');
const {
  WORKBOOK_FORMAT,
  createCsvCellProfile,
  createGovernedParserProfile,
} = require('../../src/integration-governance/spreadsheet/parser-contracts');
const {
  CSV_LITERAL_PARSER_ID,
  CSV_LITERAL_PARSER_VERSION,
  parseCsvRows,
  parseCsvLiteralWorkbook,
} = require('../../src/integration-governance/spreadsheet/parsers/csv-literal-parser');
const {
  SPREADSHEET_FIELD_DIRECTION,
  createSpreadsheetFieldMapping,
  createSpreadsheetSchema,
} = require('../../src/integration-governance/spreadsheet/contracts');
const { SPREADSHEET_IMPORT_STATUS } = require('../../src/integration-governance/spreadsheet/controlled-import');
const { buildGovernedCsvSpreadsheetImport } = require('../../src/integration-governance/spreadsheet/governed-csv-import');

function parserProfile() {
  return createGovernedParserProfile({
    profileId: 'CSV-PILOT-PROFILE',
    profileVersion: '1.0.0',
    format: WORKBOOK_FORMAT.CSV_UTF8,
    sheetName: 'Import',
    delimiter: ',',
    cellProfiles: [
      createCsvCellProfile({ cell: 'B2', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-LEASE-1'] }),
      createCsvCellProfile({ cell: 'B3', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-OPEX-1'] }),
      createCsvCellProfile({ cell: 'B4', valueType: VALUE_TYPE.NUMBER, unit: 'RATIO', evidenceRefs: ['EV-CAP-1'] }),
    ],
  });
}

function importSchema() {
  return createSpreadsheetSchema({
    schemaId: 'CSV-PILOT-IMPORT',
    schemaVersion: '1.0.0',
    direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
    mappings: [
      createSpreadsheetFieldMapping({
        mappingId: 'EGI',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Import',
        cell: 'B2',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'SAR',
        evidenceRequired: true,
        targetPath: 'financial.inputs.effectiveGrossIncome',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'OPEX',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Import',
        cell: 'B3',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'SAR',
        evidenceRequired: true,
        targetPath: 'financial.inputs.operatingExpenses',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'CAP',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Import',
        cell: 'B4',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'RATIO',
        evidenceRequired: true,
        targetPath: 'valuation.inputs.capitalizationRate',
      }),
    ],
  });
}

function canonicalSnapshot() {
  return {
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    financial: { inputs: { effectiveGrossIncome: 1200000, operatingExpenses: 250000 } },
    valuation: { inputs: { capitalizationRate: 0.08 } },
  };
}

async function sourceDocumentFor(content, caseId = 'CASE-CSV-001', documentId = 'DOC-CSV-001') {
  return ingestDocument({
    documentId,
    caseId,
    fileName: 'controlled-underwriting.csv',
    mimeType: 'text/csv',
    content,
    authorityClass: AUTHORITY_CLASS.UNKNOWN,
    existingDocuments: [],
    receivedAt: '2026-09-05T13:00:00Z',
  });
}

async function run() {
  const quoted = parseCsvRows('A,"B,B","line 1\nline 2"\r\n1,2,3', ',');
  assert.deepStrictEqual(quoted, [['A', 'B,B', 'line 1\nline 2'], ['1', '2', '3']]);
  assert.throws(() => parseCsvRows('A,"unterminated', ','), (error) => error.code === 'CSV_UNTERMINATED_QUOTE');
  assert.throws(() => parseCsvRows('A,"ok"x', ','), (error) => error.code === 'CSV_MALFORMED_QUOTE');

  const profile = parserProfile();
  assert.strictEqual(profile.capabilities.FORMULA_EVALUATION, false);
  assert.strictEqual(profile.capabilities.UNIT_INFERENCE, false);
  assert.strictEqual(profile.capabilities.EVIDENCE_INFERENCE, false);
  assert.strictEqual(profile.capabilities.TYPE_INFERENCE, false);
  assert.strictEqual(profile.authoritativeSource, false);

  const content = 'Metric,Value\nEGI,"1,250,000"\nOPEX,250000\nCAP,0.075';
  const parsed = await parseCsvLiteralWorkbook({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-001',
    workbookVersion: '1',
    content,
    parserProfile: profile,
  });

  assert.strictEqual(parsed.parserAttestation.parserId, CSV_LITERAL_PARSER_ID);
  assert.strictEqual(parsed.parserAttestation.parserVersion, CSV_LITERAL_PARSER_VERSION);
  assert.strictEqual(parsed.parserAttestation.inputContentHashSha256, parsed.contentHashSha256);
  assert.strictEqual(parsed.parserAttestation.outputContentHashSha256, parsed.contentHashSha256);
  assert.strictEqual(parsed.parserAttestation.formulaEvaluationPerformed, false);
  assert.strictEqual(parsed.sheets.Import.cells.A2.valueType, VALUE_TYPE.STRING);
  assert.strictEqual(parsed.sheets.Import.cells.B2.valueType, VALUE_TYPE.NUMBER);
  assert.strictEqual(parsed.sheets.Import.cells.B2.unit, 'SAR');
  assert.deepStrictEqual(parsed.sheets.Import.cells.B2.evidenceRefs, ['EV-LEASE-1']);
  assert.strictEqual(parsed.sourceAuthorityPromoted, false);
  assert.strictEqual(parsed.canonicalMutationPerformed, false);
  assert.strictEqual(parsed.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(parsed), true);

  const sourceDocument = await sourceDocumentFor(content);
  const governed = await buildGovernedCsvSpreadsheetImport({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-001',
    workbookVersion: '1',
    sourceDocument,
    content,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T13:05:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-CSV-001',
  });

  assert.strictEqual(governed.sourceDocumentBound, true);
  assert.strictEqual(governed.sourceDocumentHashSha256, sourceDocument.contentHashSha256);
  assert.strictEqual(governed.parserAttestation.inputContentHashSha256, sourceDocument.contentHashSha256);
  assert.strictEqual(governed.controlledImport.status, SPREADSHEET_IMPORT_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(governed.controlledImport.changes.length, 2);
  assert.strictEqual(governed.controlledImport.unchanged.length, 1);
  assert.strictEqual(governed.controlledImport.proposals.length, 2);
  assert.strictEqual(governed.sourceAuthorityPromoted, false);
  assert.strictEqual(governed.evidenceVerifiedByParser, false);
  assert.strictEqual(governed.canonicalMutationPerformed, false);
  assert.strictEqual(governed.humanApprovalRequired, true);
  assert.strictEqual(governed.directWriteAuthorized, false);
  assert.strictEqual(governed.transactionAuthorized, false);

  await assert.rejects(() => buildGovernedCsvSpreadsheetImport({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-TAMPER',
    workbookVersion: '1',
    sourceDocument,
    content: `${content}\nTAMPER,1`,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T13:06:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-CSV-TAMPER',
  }), (error) => error.code === 'PARSER_SOURCE_HASH_MISMATCH');

  const otherCaseDocument = await sourceDocumentFor(content, 'CASE-OTHER', 'DOC-CSV-OTHER');
  await assert.rejects(() => buildGovernedCsvSpreadsheetImport({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-SCOPE',
    workbookVersion: '1',
    sourceDocument: otherCaseDocument,
    content,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T13:07:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-CSV-SCOPE',
  }), (error) => error.code === 'PARSER_SOURCE_SCOPE_MISMATCH');

  const formulaContent = 'Metric,Value\nEGI,=SUM(B10:B20)\nOPEX,250000\nCAP,0.075';
  const formulaDocument = await sourceDocumentFor(formulaContent, 'CASE-CSV-001', 'DOC-CSV-FORMULA');
  const formulaResult = await buildGovernedCsvSpreadsheetImport({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-FORMULA',
    workbookVersion: '1',
    sourceDocument: formulaDocument,
    content: formulaContent,
    parserProfile: profile,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T13:08:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-CSV-FORMULA',
  });
  assert.strictEqual(formulaResult.workbookSnapshot.sheets.Import.cells.B2.formula, '=SUM(B10:B20)');
  assert.strictEqual(formulaResult.controlledImport.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.strictEqual(formulaResult.controlledImport.proposals.length, 0);

  await assert.rejects(() => parseCsvLiteralWorkbook({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-CSV-BADUTF8',
    workbookVersion: '1',
    content: new Uint8Array([0xC3, 0x28]),
    parserProfile: profile,
  }), (error) => error.code === 'CSV_INVALID_UTF8');

  await assert.rejects(() => parseCsvLiteralWorkbook({
    caseId: 'CASE-CSV-001',
    projectId: 'PROJECT-CSV-001',
    workbookId: 'WB-XLSX-UNSUPPORTED',
    workbookVersion: '1',
    content: 'not-an-xlsx-parser',
    parserProfile: { ...profile, format: 'XLSX' },
  }), (error) => error.code === 'UNSUPPORTED_WORKBOOK_FORMAT');

  console.log('run_governed_workbook_parser_v1: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});