'use strict';

const { VALUE_TYPE, normalizeExtractedValue, sha256Hex } = require('../../document-intelligence/pipeline');
const {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
  createIntegrationEnvelope,
} = require('../integration-envelope');
const { createWriteProposal } = require('../write-lifecycle');
const { SPREADSHEET_FIELD_DIRECTION } = require('./contracts');

const SPREADSHEET_IMPORT_STATUS = Object.freeze({
  READY_FOR_HUMAN_REVIEW: 'READY_FOR_HUMAN_REVIEW',
  HOLD_VALIDATION: 'HOLD_VALIDATION',
  NO_CHANGES: 'NO_CHANGES',
});

const SPREADSHEET_IMPORT_REASON = Object.freeze({
  MISSING_REQUIRED_CELL: 'MISSING_REQUIRED_CELL',
  FORMULA_CELL_NOT_ALLOWED: 'FORMULA_CELL_NOT_ALLOWED',
  VALUE_TYPE_MISMATCH: 'VALUE_TYPE_MISMATCH',
  UNIT_MISMATCH: 'UNIT_MISMATCH',
  EVIDENCE_REQUIRED: 'EVIDENCE_REQUIRED',
  UNKNOWN_EVIDENCE_REFERENCE: 'UNKNOWN_EVIDENCE_REFERENCE',
  VALUE_NORMALIZATION_FAILED: 'VALUE_NORMALIZATION_FAILED',
  CURRENT_CANONICAL_VALUE_INVALID: 'CURRENT_CANONICAL_VALUE_INVALID',
});

const CONTROLLED_SPREADSHEET_ADAPTER_ID = 'adapter.controlled-spreadsheet.import.v1';
const CONTROLLED_SPREADSHEET_SOURCE_SYSTEM = 'CONTROLLED_SPREADSHEET';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requirePlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${field} must be a plain object`);
  return value;
}

function normalizeIsoTimestamp(value, field) {
  const normalized = requireString(value, field);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function normalizeSha256(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function getPath(root, path) {
  return path.split('.').reduce((value, key) => {
    if (value == null || typeof value !== 'object') return undefined;
    return value[key];
  }, root);
}

function normalizeEvidenceAllowlist(value) {
  if (!Array.isArray(value)) throw new TypeError('allowedEvidenceRefs must be an array');
  return new Set(value.map((item) => requireString(String(item), 'allowedEvidenceRefs')));
}

function workbookCellAt(workbookSnapshot, sheetName, cell) {
  const sheet = workbookSnapshot.sheets && workbookSnapshot.sheets[sheetName];
  if (!sheet || typeof sheet !== 'object') return null;
  const cells = sheet.cells;
  if (!cells || typeof cells !== 'object') return null;
  return cells[cell] || null;
}

function comparableValue(value) {
  if (value === undefined) return '__STARTAK_UNDEFINED__';
  return JSON.stringify(value);
}

async function buildControlledSpreadsheetImport({
  schema,
  workbookSnapshot,
  canonicalSnapshot,
  allowedEvidenceRefs = [],
  parserId,
  parserVersion,
  observedAt,
  requestedBy,
  correlationId,
} = {}) {
  requirePlainObject(schema, 'schema');
  if (schema.direction !== SPREADSHEET_FIELD_DIRECTION.IMPORT) throw new TypeError('schema must be an IMPORT spreadsheet schema');
  if (!Array.isArray(schema.mappings) || schema.mappings.length === 0) throw new TypeError('schema.mappings must be a non-empty array');
  requirePlainObject(workbookSnapshot, 'workbookSnapshot');
  requirePlainObject(canonicalSnapshot, 'canonicalSnapshot');

  const caseId = requireString(workbookSnapshot.caseId, 'workbookSnapshot.caseId');
  const projectId = requireString(workbookSnapshot.projectId, 'workbookSnapshot.projectId');
  if (canonicalSnapshot.caseId !== caseId || canonicalSnapshot.projectId !== projectId) {
    const error = new Error('Workbook and canonical snapshot scope must match');
    error.code = 'SPREADSHEET_SCOPE_MISMATCH';
    throw error;
  }

  const workbookId = requireString(workbookSnapshot.workbookId, 'workbookSnapshot.workbookId');
  const workbookVersion = requireString(workbookSnapshot.workbookVersion, 'workbookSnapshot.workbookVersion');
  const workbookHash = normalizeSha256(workbookSnapshot.contentHashSha256, 'workbookSnapshot.contentHashSha256');
  requirePlainObject(workbookSnapshot.sheets, 'workbookSnapshot.sheets');
  const normalizedObservedAt = normalizeIsoTimestamp(observedAt, 'observedAt');
  const normalizedRequestedBy = requireString(requestedBy, 'requestedBy');
  const normalizedCorrelationId = requireString(correlationId, 'correlationId');
  const normalizedParserId = requireString(parserId, 'parserId');
  const normalizedParserVersion = requireString(parserVersion, 'parserVersion');
  const evidenceAllowlist = normalizeEvidenceAllowlist(allowedEvidenceRefs);

  const holds = [];
  const changes = [];
  const unchanged = [];

  function hold(mapping, reasonCode, details = null) {
    holds.push({
      mappingId: mapping.mappingId,
      locator: `${mapping.sheetName}!${mapping.cell}`,
      targetPath: mapping.targetPath,
      reasonCode,
      details,
    });
  }

  for (const mapping of schema.mappings) {
    const cell = workbookCellAt(workbookSnapshot, mapping.sheetName, mapping.cell);
    if (!cell) {
      if (mapping.required) hold(mapping, SPREADSHEET_IMPORT_REASON.MISSING_REQUIRED_CELL);
      continue;
    }
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.VALUE_TYPE_MISMATCH, 'cell must be an object');
      continue;
    }
    if (cell.formula != null && String(cell.formula).trim() !== '') {
      hold(mapping, SPREADSHEET_IMPORT_REASON.FORMULA_CELL_NOT_ALLOWED);
      continue;
    }
    if (!Object.values(VALUE_TYPE).includes(cell.valueType) || cell.valueType !== mapping.valueType) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.VALUE_TYPE_MISMATCH, `expected ${mapping.valueType}; got ${cell.valueType || 'UNKNOWN'}`);
      continue;
    }
    const cellUnit = cell.unit == null || cell.unit === '' ? null : String(cell.unit).trim();
    if (cellUnit !== mapping.unit) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.UNIT_MISMATCH, `expected ${mapping.unit}; got ${cellUnit}`);
      continue;
    }
    const evidenceRefs = Array.isArray(cell.evidenceRefs)
      ? [...new Set(cell.evidenceRefs.map((ref) => String(ref).trim()).filter(Boolean))]
      : [];
    if (mapping.evidenceRequired && evidenceRefs.length === 0) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.EVIDENCE_REQUIRED);
      continue;
    }
    const unknownEvidence = evidenceRefs.filter((ref) => !evidenceAllowlist.has(ref));
    if (unknownEvidence.length > 0) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.UNKNOWN_EVIDENCE_REFERENCE, unknownEvidence);
      continue;
    }

    let normalizedValue;
    try {
      normalizedValue = normalizeExtractedValue(cell.value, mapping.valueType);
    } catch (error) {
      hold(mapping, SPREADSHEET_IMPORT_REASON.VALUE_NORMALIZATION_FAILED, error.message);
      continue;
    }

    const currentRawValue = getPath(canonicalSnapshot, mapping.targetPath);
    let currentValue = currentRawValue;
    if (currentRawValue !== undefined && currentRawValue !== null) {
      try {
        currentValue = normalizeExtractedValue(currentRawValue, mapping.valueType);
      } catch (error) {
        hold(mapping, SPREADSHEET_IMPORT_REASON.CURRENT_CANONICAL_VALUE_INVALID, error.message);
        continue;
      }
    }

    const record = {
      mappingId: mapping.mappingId,
      sourceLocator: `${mapping.sheetName}!${mapping.cell}`,
      targetPath: mapping.targetPath,
      valueType: mapping.valueType,
      unit: mapping.unit,
      currentValue: currentValue === undefined ? null : currentValue,
      proposedValue: normalizedValue,
      evidenceRefs,
    };

    if (comparableValue(currentValue) === comparableValue(normalizedValue)) unchanged.push(record);
    else changes.push(record);
  }

  if (holds.length > 0) {
    return deepFreeze({
      schemaVersion: 1,
      status: SPREADSHEET_IMPORT_STATUS.HOLD_VALIDATION,
      caseId,
      projectId,
      workbookId,
      workbookVersion,
      workbookHash,
      parser: { parserId: normalizedParserId, parserVersion: normalizedParserVersion },
      holds,
      changes: [],
      unchanged,
      envelope: null,
      proposals: [],
      canonicalMutationPerformed: false,
      humanApprovalRequired: true,
      transactionAuthorized: false,
      semantics: 'Any missing required cell, formula, type/unit mismatch, evidence failure, or invalid current canonical value holds the entire import. No partial canonical write proposal is created.',
    });
  }

  if (changes.length === 0) {
    return deepFreeze({
      schemaVersion: 1,
      status: SPREADSHEET_IMPORT_STATUS.NO_CHANGES,
      caseId,
      projectId,
      workbookId,
      workbookVersion,
      workbookHash,
      parser: { parserId: normalizedParserId, parserVersion: normalizedParserVersion },
      holds: [],
      changes: [],
      unchanged,
      envelope: null,
      proposals: [],
      canonicalMutationPerformed: false,
      humanApprovalRequired: false,
      transactionAuthorized: false,
    });
  }

  const envelope = createIntegrationEnvelope({
    adapterId: CONTROLLED_SPREADSHEET_ADAPTER_ID,
    operation: INTEGRATION_OPERATION.PROPOSE_WRITE,
    caseId,
    projectId,
    sourceSystem: CONTROLLED_SPREADSHEET_SOURCE_SYSTEM,
    sourceObjectId: workbookId,
    sourceVersion: workbookVersion,
    observedAt: normalizedObservedAt,
    contentHashSha256: workbookHash,
    requestedBy: normalizedRequestedBy,
    writeTarget: INTEGRATION_WRITE_TARGET.CANONICAL_INPUT,
    payload: {
      caseId,
      projectId,
      schemaId: schema.schemaId,
      mappingSchemaVersion: schema.mappingSchemaVersion,
      parserId: normalizedParserId,
      parserVersion: normalizedParserVersion,
      changes,
    },
  });

  const proposals = [];
  for (const change of changes) {
    const proposedValueHashSha256 = await sha256Hex(JSON.stringify({
      targetPath: change.targetPath,
      proposedValue: change.proposedValue,
      valueType: change.valueType,
      unit: change.unit,
      evidenceRefs: change.evidenceRefs,
    }));
    proposals.push(createWriteProposal({
      proposalId: `SPREADSHEET:${workbookId}:${workbookVersion}:${change.mappingId}:${proposedValueHashSha256.slice(0, 12)}`,
      envelope,
      targetPath: change.targetPath,
      proposedValueHashSha256,
      reason: `Controlled spreadsheet import from ${workbookId} ${change.sourceLocator}; requires explicit human review before governed canonical commit.`,
      evidenceRefs: change.evidenceRefs,
      proposedAt: normalizedObservedAt,
      proposedBy: normalizedRequestedBy,
      correlationId: normalizedCorrelationId,
    }));
  }

  return deepFreeze({
    schemaVersion: 1,
    status: SPREADSHEET_IMPORT_STATUS.READY_FOR_HUMAN_REVIEW,
    caseId,
    projectId,
    workbookId,
    workbookVersion,
    workbookHash,
    parser: { parserId: normalizedParserId, parserVersion: normalizedParserVersion },
    holds: [],
    changes,
    unchanged,
    envelope,
    proposals,
    canonicalMutationPerformed: false,
    humanApprovalRequired: true,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'A READY result is an import diff plus governed write proposals only. It does not mutate canonical state. Every proposal remains subject to explicit human approval and the separate governed write lifecycle.',
  });
}

module.exports = {
  SPREADSHEET_IMPORT_STATUS,
  SPREADSHEET_IMPORT_REASON,
  CONTROLLED_SPREADSHEET_ADAPTER_ID,
  CONTROLLED_SPREADSHEET_SOURCE_SYSTEM,
  buildControlledSpreadsheetImport,
};