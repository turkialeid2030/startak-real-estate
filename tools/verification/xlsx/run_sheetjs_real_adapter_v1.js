'use strict';

const assert = require('assert');
const XLSX = require('xlsx');
const { AUTHORITY_CLASS } = require('../../../src/document-intelligence/contracts');
const { VALUE_TYPE, ingestDocument } = require('../../../src/document-intelligence/pipeline');
const {
  SPREADSHEET_FIELD_DIRECTION,
  createSpreadsheetFieldMapping,
  createSpreadsheetSchema,
} = require('../../../src/integration-governance/spreadsheet/contracts');
const { SPREADSHEET_IMPORT_STATUS } = require('../../../src/integration-governance/spreadsheet/controlled-import');
const { createXlsxCellProfile, createXlsxParserProfile } = require('../../../src/integration-governance/spreadsheet/xlsx/parser-profile');
const { parseSheetJsPassiveWorkbook } = require('../../../src/integration-governance/spreadsheet/xlsx/sheetjs-passive-parser');
const { buildGovernedXlsxSpreadsheetImport } = require('../../../src/integration-governance/spreadsheet/xlsx/governed-xlsx-import');

function parserProfile() {
  return createXlsxParserProfile({
    profileId: 'XLSX-REAL-VERIFY',
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
    schemaId: 'XLSX-REAL-IMPORT',
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
    caseId: 'CASE-XLSX-REAL',
    projectId: 'PROJECT-XLSX-REAL',
    financial: { inputs: { effectiveGrossIncome: 1200000, operatingExpenses: 250000 } },
    valuation: { inputs: { capitalizationRate: 0.08 } },
  };
}

function workbookBytes({ formula = null, externalFormula = false } = {}) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['EGI', 1250000],
    ['OPEX', 250000],
    ['CAP', 0.075],
  ]);
  ws['!merges'] = [XLSX.utils.decode_range('A1:B1')];
  if (formula) ws.B2 = { t: 'n', v: 1250000, f: formula };
  if (externalFormula) ws.B2 = { t: 'n', v: 1250000, f: '[External.xlsx]Sheet1!A1' };
  XLSX.utils.book_append_sheet(wb, ws, 'Import');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['hidden']]), 'Hidden');
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.Workbook.Sheets || [{}, {}];
  wb.Workbook.Sheets[0] = { ...(wb.Workbook.Sheets[0] || {}), Hidden: 0 };
  wb.Workbook.Sheets[1] = { ...(wb.Workbook.Sheets[1] || {}), Hidden: 1 };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
}

async function sourceDocumentFor(content, documentId) {
  return ingestDocument({
    documentId,
    caseId: 'CASE-XLSX-REAL',
    fileName: 'real-sheetjs-verification.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content,
    authorityClass: AUTHORITY_CLASS.UNKNOWN,
    existingDocuments: [],
    receivedAt: '2026-09-05T17:00:00Z',
  });
}

async function run() {
  assert.strictEqual(XLSX.version, '0.20.3');
  const content = workbookBytes();
  const profile = parserProfile();
  const args = {
    caseId: 'CASE-XLSX-REAL',
    projectId: 'PROJECT-XLSX-REAL',
    workbookId: 'WB-XLSX-REAL',
    workbookVersion: '1',
    content,
    parserProfile: profile,
  };

  const first = await parseSheetJsPassiveWorkbook(args);
  const second = await parseSheetJsPassiveWorkbook(args);
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.sheets.Import.cells.B2.value, 1250000);
  assert.strictEqual(first.sheets.Import.cells.B2.valueType, VALUE_TYPE.NUMBER);
  assert.strictEqual(first.sheets.Import.cells.B2.unit, 'SAR');
  assert.strictEqual(first.sheets.Hidden.hiddenState, 'HIDDEN');
  assert.deepStrictEqual(first.sheets.Import.merges, ['A1:B1']);
  assert.strictEqual(first.parserAttestation.dependencyVersion, '0.20.3');
  assert.strictEqual(first.parserAttestation.formulaEvaluationPerformed, false);
  assert.strictEqual(first.sourceAuthorityPromoted, false);
  assert.strictEqual(first.canonicalMutationPerformed, false);
  assert.strictEqual(first.transactionAuthorized, false);

  const sourceDocument = await sourceDocumentFor(content, 'DOC-XLSX-REAL');
  const governed = await buildGovernedXlsxSpreadsheetImport({
    ...args,
    sourceDocument,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T17:05:00Z',
    requestedBy: 'ci:sheetjs-real-adapter',
    correlationId: 'CORR-XLSX-REAL',
  });
  assert.strictEqual(governed.controlledImport.status, SPREADSHEET_IMPORT_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(governed.controlledImport.changes.length, 2);
  assert.strictEqual(governed.controlledImport.unchanged.length, 1);
  assert.strictEqual(governed.controlledImport.proposals.length, 2);
  assert.strictEqual(governed.humanApprovalRequired, true);
  assert.strictEqual(governed.canonicalMutationPerformed, false);

  const formulaBytes = workbookBytes({ formula: 'SUM(B10:B11)' });
  const formulaSource = await sourceDocumentFor(formulaBytes, 'DOC-XLSX-REAL-FORMULA');
  const formulaResult = await buildGovernedXlsxSpreadsheetImport({
    ...args,
    workbookId: 'WB-XLSX-REAL-FORMULA',
    content: formulaBytes,
    sourceDocument: formulaSource,
    importSchema: importSchema(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    observedAt: '2026-09-05T17:06:00Z',
    requestedBy: 'ci:sheetjs-real-adapter',
    correlationId: 'CORR-XLSX-REAL-FORMULA',
  });
  assert.strictEqual(formulaResult.workbookSnapshot.sheets.Import.cells.B2.formula, 'SUM(B10:B11)');
  assert.strictEqual(formulaResult.controlledImport.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.strictEqual(formulaResult.controlledImport.proposals.length, 0);

  const externalBytes = workbookBytes({ externalFormula: true });
  await assert.rejects(() => parseSheetJsPassiveWorkbook({
    ...args,
    workbookId: 'WB-XLSX-REAL-EXTERNAL',
    content: externalBytes,
  }), (error) => error.code === 'XLSX_EXTERNAL_FORMULA_REFERENCE_NOT_ALLOWED');

  console.log('run_sheetjs_real_adapter_v1: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
