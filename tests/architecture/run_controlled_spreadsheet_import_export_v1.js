'use strict';

const assert = require('assert');
const { VALUE_TYPE } = require('../../src/document-intelligence/pipeline');
const { INTEGRATION_OPERATION, INTEGRATION_WRITE_TARGET } = require('../../src/integration-governance/integration-envelope');
const {
  SPREADSHEET_FIELD_DIRECTION,
  SPREADSHEET_SOURCE_KIND,
  createSpreadsheetFieldMapping,
  createSpreadsheetSchema,
  createWorkbookCell,
} = require('../../src/integration-governance/spreadsheet/contracts');
const {
  SPREADSHEET_IMPORT_STATUS,
  SPREADSHEET_IMPORT_REASON,
  buildControlledSpreadsheetImport,
} = require('../../src/integration-governance/spreadsheet/controlled-import');
const {
  SPREADSHEET_EXPORT_STATUS,
  SPREADSHEET_EXPORT_REASON,
  buildControlledSpreadsheetExport,
} = require('../../src/integration-governance/spreadsheet/controlled-export');

const HASH_A = 'a'.repeat(64);
const AI_CONTEXT_HASH = 'c'.repeat(64);

function importSchema() {
  return createSpreadsheetSchema({
    schemaId: 'SPREADSHEET-IMPORT-V1',
    schemaVersion: '1.0.0',
    direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
    mappings: [
      createSpreadsheetFieldMapping({
        mappingId: 'EGI',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Underwriting',
        cell: 'B2',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'SAR',
        required: true,
        evidenceRequired: true,
        targetPath: 'financial.inputs.effectiveGrossIncome',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'OPEX',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Underwriting',
        cell: 'B3',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'SAR',
        required: true,
        evidenceRequired: true,
        targetPath: 'financial.inputs.operatingExpenses',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'CAP_RATE',
        direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
        sheetName: 'Valuation',
        cell: 'C4',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'RATIO',
        required: true,
        evidenceRequired: true,
        targetPath: 'valuation.inputs.capitalizationRate',
      }),
    ],
  });
}

function workbook(overrides = {}) {
  return {
    workbookId: 'WB-001',
    workbookVersion: '7',
    contentHashSha256: HASH_A,
    caseId: 'CASE-SPREADSHEET-001',
    projectId: 'PROJECT-SPREADSHEET-001',
    sheets: {
      Underwriting: {
        cells: {
          B2: createWorkbookCell({ value: '1,250,000', valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-LEASE-1'] }),
          B3: createWorkbookCell({ value: 250000, valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-OPEX-1'] }),
        },
      },
      Valuation: {
        cells: {
          C4: createWorkbookCell({ value: 0.075, valueType: VALUE_TYPE.NUMBER, unit: 'RATIO', evidenceRefs: ['EV-CAP-1'] }),
        },
      },
    },
    ...overrides,
  };
}

function canonicalSnapshot(overrides = {}) {
  return {
    caseId: 'CASE-SPREADSHEET-001',
    projectId: 'PROJECT-SPREADSHEET-001',
    financial: {
      inputs: {
        effectiveGrossIncome: 1200000,
        operatingExpenses: 250000,
      },
    },
    valuation: {
      inputs: {
        capitalizationRate: 0.08,
      },
    },
    ...overrides,
  };
}

async function validImport(overrides = {}) {
  return buildControlledSpreadsheetImport({
    schema: importSchema(),
    workbookSnapshot: workbook(),
    canonicalSnapshot: canonicalSnapshot(),
    allowedEvidenceRefs: ['EV-LEASE-1', 'EV-OPEX-1', 'EV-CAP-1'],
    parserId: 'parser.test.normalized-workbook',
    parserVersion: '1.0.0',
    observedAt: '2026-09-05T12:00:00Z',
    requestedBy: 'human:analyst',
    correlationId: 'CORR-SPREADSHEET-001',
    ...overrides,
  });
}

async function run() {
  assert.throws(() => createSpreadsheetFieldMapping({
    mappingId: 'FORBIDDEN-OUTPUT',
    direction: SPREADSHEET_FIELD_DIRECTION.IMPORT,
    sheetName: 'Results',
    cell: 'A1',
    valueType: VALUE_TYPE.NUMBER,
    unit: 'RATIO',
    targetPath: 'financial.outputs.irr',
  }), (error) => error.code === 'SPREADSHEET_IMPORT_TARGET_NOT_ALLOWED');

  const imported = await validImport();
  assert.strictEqual(imported.status, SPREADSHEET_IMPORT_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(imported.changes.length, 2);
  assert.strictEqual(imported.unchanged.length, 1);
  assert.strictEqual(imported.holds.length, 0);
  assert.strictEqual(imported.envelope.operation, INTEGRATION_OPERATION.PROPOSE_WRITE);
  assert.strictEqual(imported.envelope.writeTarget, INTEGRATION_WRITE_TARGET.CANONICAL_INPUT);
  assert.strictEqual(imported.envelope.humanApprovalRequired, true);
  assert.strictEqual(imported.proposals.length, 2);
  assert.ok(imported.proposals.every((proposal) => proposal.status === 'PROPOSED'));
  assert.ok(imported.proposals.every((proposal) => proposal.eligibleForGovernedCommit === false));
  assert.strictEqual(imported.canonicalMutationPerformed, false);
  assert.strictEqual(imported.directWriteAuthorized, false);
  assert.strictEqual(imported.transactionAuthorized, false);
  assert.strictEqual(canonicalSnapshot().financial.inputs.effectiveGrossIncome, 1200000);
  assert.strictEqual(Object.isFrozen(imported), true);

  const formulaWorkbook = workbook();
  formulaWorkbook.sheets = {
    ...formulaWorkbook.sheets,
    Underwriting: {
      cells: {
        ...formulaWorkbook.sheets.Underwriting.cells,
        B2: createWorkbookCell({
          value: 1250000,
          valueType: VALUE_TYPE.NUMBER,
          unit: 'SAR',
          evidenceRefs: ['EV-LEASE-1'],
          formula: '=SUM(B10:B20)',
        }),
      },
    },
  };
  const formulaHold = await validImport({ workbookSnapshot: formulaWorkbook });
  assert.strictEqual(formulaHold.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.ok(formulaHold.holds.some((item) => item.reasonCode === SPREADSHEET_IMPORT_REASON.FORMULA_CELL_NOT_ALLOWED));
  assert.strictEqual(formulaHold.envelope, null);
  assert.deepStrictEqual(formulaHold.proposals, []);

  const badUnitWorkbook = workbook();
  badUnitWorkbook.sheets = {
    ...badUnitWorkbook.sheets,
    Valuation: {
      cells: {
        C4: createWorkbookCell({ value: 7.5, valueType: VALUE_TYPE.NUMBER, unit: 'PERCENT', evidenceRefs: ['EV-CAP-1'] }),
      },
    },
  };
  const unitHold = await validImport({ workbookSnapshot: badUnitWorkbook });
  assert.strictEqual(unitHold.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.ok(unitHold.holds.some((item) => item.reasonCode === SPREADSHEET_IMPORT_REASON.UNIT_MISMATCH));

  const unknownEvidenceWorkbook = workbook();
  unknownEvidenceWorkbook.sheets = {
    ...unknownEvidenceWorkbook.sheets,
    Underwriting: {
      cells: {
        ...unknownEvidenceWorkbook.sheets.Underwriting.cells,
        B2: createWorkbookCell({ value: 1250000, valueType: VALUE_TYPE.NUMBER, unit: 'SAR', evidenceRefs: ['EV-NOT-IN-CASE'] }),
      },
    },
  };
  const evidenceHold = await validImport({ workbookSnapshot: unknownEvidenceWorkbook });
  assert.strictEqual(evidenceHold.status, SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION);
  assert.ok(evidenceHold.holds.some((item) => item.reasonCode === SPREADSHEET_IMPORT_REASON.UNKNOWN_EVIDENCE_REFERENCE));

  await assert.rejects(() => validImport({
    canonicalSnapshot: {
      ...canonicalSnapshot(),
      caseId: 'CASE-OTHER',
    },
  }), (error) => error.code === 'SPREADSHEET_SCOPE_MISMATCH');

  const noChangeWorkbook = workbook();
  const noChange = await validImport({
    canonicalSnapshot: {
      ...canonicalSnapshot(),
      financial: { inputs: { effectiveGrossIncome: 1250000, operatingExpenses: 250000 } },
      valuation: { inputs: { capitalizationRate: 0.075 } },
    },
    workbookSnapshot: noChangeWorkbook,
  });
  assert.strictEqual(noChange.status, SPREADSHEET_IMPORT_STATUS.NO_CHANGES);
  assert.strictEqual(noChange.envelope, null);
  assert.strictEqual(noChange.humanApprovalRequired, false);

  const exportSchema = createSpreadsheetSchema({
    schemaId: 'SPREADSHEET-EXPORT-V1',
    schemaVersion: '1.0.0',
    direction: SPREADSHEET_FIELD_DIRECTION.EXPORT,
    mappings: [
      createSpreadsheetFieldMapping({
        mappingId: 'EXP-EGI',
        direction: SPREADSHEET_FIELD_DIRECTION.EXPORT,
        sheetName: 'Summary',
        cell: 'B2',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'SAR',
        evidenceRequired: true,
        sourceKind: SPREADSHEET_SOURCE_KIND.CANONICAL_INPUT,
        sourcePath: 'financial.inputs.effectiveGrossIncome',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'EXP-IRR',
        direction: SPREADSHEET_FIELD_DIRECTION.EXPORT,
        sheetName: 'Summary',
        cell: 'B3',
        valueType: VALUE_TYPE.NUMBER,
        unit: 'RATIO',
        evidenceRequired: false,
        sourceKind: SPREADSHEET_SOURCE_KIND.DETERMINISTIC_OUTPUT,
        sourcePath: 'financial.outputs.irr',
      }),
      createSpreadsheetFieldMapping({
        mappingId: 'EXP-AI',
        direction: SPREADSHEET_FIELD_DIRECTION.EXPORT,
        sheetName: 'Review',
        cell: 'A2',
        valueType: VALUE_TYPE.STRING,
        evidenceRequired: true,
        sourceKind: SPREADSHEET_SOURCE_KIND.AI_INTERPRETATION,
        sourcePath: 'ai.synthesis.narrative',
      }),
    ],
  });

  const sourceSnapshot = {
    caseId: 'CASE-SPREADSHEET-001',
    projectId: 'PROJECT-SPREADSHEET-001',
    financial: {
      inputs: { effectiveGrossIncome: 1250000 },
      outputs: { irr: 0.1234 },
    },
    ai: { synthesis: { narrative: 'Evidence-bound synthesis for human review.' } },
  };

  const metadata = {
    'financial.inputs.effectiveGrossIncome': {
      caseId: 'CASE-SPREADSHEET-001',
      projectId: 'PROJECT-SPREADSHEET-001',
      sourceKind: SPREADSHEET_SOURCE_KIND.CANONICAL_INPUT,
      unit: 'SAR',
      sourceRef: 'CANONICAL:EGI:V4',
      evidenceRefs: ['EV-LEASE-1'],
    },
    'financial.outputs.irr': {
      caseId: 'CASE-SPREADSHEET-001',
      projectId: 'PROJECT-SPREADSHEET-001',
      sourceKind: SPREADSHEET_SOURCE_KIND.DETERMINISTIC_OUTPUT,
      unit: 'RATIO',
      sourceRef: 'FINANCIAL-RESULT:V12',
      evidenceRefs: [],
      derivationRef: 'CALCULATION-CONTEXT:V12',
      engineVersionRef: 'financial-engine:v1',
    },
    'ai.synthesis.narrative': {
      caseId: 'CASE-SPREADSHEET-001',
      projectId: 'PROJECT-SPREADSHEET-001',
      sourceKind: SPREADSHEET_SOURCE_KIND.AI_INTERPRETATION,
      unit: null,
      sourceRef: 'AI-SYNTHESIS:V3',
      evidenceRefs: ['EV-LEASE-1', 'EV-CAP-1'],
      contextHashSha256: AI_CONTEXT_HASH,
    },
  };

  const exported = await buildControlledSpreadsheetExport({
    schema: exportSchema,
    sourceSnapshot,
    sourceMetadataByPath: metadata,
    exportId: 'EXPORT-001',
    exportVersion: '1',
    observedAt: '2026-09-05T12:30:00Z',
    requestedBy: 'human:analyst',
  });
  assert.strictEqual(exported.status, SPREADSHEET_EXPORT_STATUS.READY_FOR_EXPORT_PACKET);
  assert.strictEqual(exported.envelope.operation, INTEGRATION_OPERATION.EXPORT);
  assert.strictEqual(exported.workbookProjection.authoritativeWorkbook, false);
  assert.strictEqual(exported.externalWritePerformed, false);
  assert.strictEqual(exported.transactionAuthorized, false);
  assert.strictEqual(exported.workbookProjection.sheets.Summary.cells.B3.provenance.derivationRef, 'CALCULATION-CONTEXT:V12');
  assert.strictEqual(exported.workbookProjection.sheets.Summary.cells.B3.provenance.engineVersionRef, 'financial-engine:v1');
  assert.strictEqual(exported.workbookProjection.sheets.Review.cells.A2.provenance.authoritative, false);
  assert.strictEqual(exported.workbookProjection.sheets.Review.cells.A2.provenance.contextHashSha256, AI_CONTEXT_HASH);
  assert.strictEqual(exported.envelope.contentHashSha256, exported.projectionHashSha256);

  const missingDerivationMetadata = {
    ...metadata,
    'financial.outputs.irr': {
      ...metadata['financial.outputs.irr'],
      derivationRef: null,
    },
  };
  const exportHold = await buildControlledSpreadsheetExport({
    schema: exportSchema,
    sourceSnapshot,
    sourceMetadataByPath: missingDerivationMetadata,
    exportId: 'EXPORT-002',
    exportVersion: '1',
    observedAt: '2026-09-05T12:31:00Z',
    requestedBy: 'human:analyst',
  });
  assert.strictEqual(exportHold.status, SPREADSHEET_EXPORT_STATUS.HOLD_VALIDATION);
  assert.ok(exportHold.holds.some((item) => item.reasonCode === SPREADSHEET_EXPORT_REASON.DERIVATION_REQUIRED));
  assert.strictEqual(exportHold.workbookProjection, null);
  assert.strictEqual(exportHold.envelope, null);

  console.log('run_controlled_spreadsheet_import_export_v1: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});