'use strict';

const { normalizeExtractedValue, sha256Hex } = require('../../document-intelligence/pipeline');
const {
  INTEGRATION_OPERATION,
  createIntegrationEnvelope,
} = require('../integration-envelope');
const {
  SPREADSHEET_FIELD_DIRECTION,
  SPREADSHEET_SOURCE_KIND,
} = require('./contracts');

const SPREADSHEET_EXPORT_STATUS = Object.freeze({
  READY_FOR_EXPORT_PACKET: 'READY_FOR_EXPORT_PACKET',
  HOLD_VALIDATION: 'HOLD_VALIDATION',
});

const SPREADSHEET_EXPORT_REASON = Object.freeze({
  MISSING_REQUIRED_SOURCE: 'MISSING_REQUIRED_SOURCE',
  SOURCE_METADATA_REQUIRED: 'SOURCE_METADATA_REQUIRED',
  SOURCE_KIND_MISMATCH: 'SOURCE_KIND_MISMATCH',
  UNIT_MISMATCH: 'UNIT_MISMATCH',
  EVIDENCE_REQUIRED: 'EVIDENCE_REQUIRED',
  DERIVATION_REQUIRED: 'DERIVATION_REQUIRED',
  AI_CONTEXT_HASH_REQUIRED: 'AI_CONTEXT_HASH_REQUIRED',
  VALUE_NORMALIZATION_FAILED: 'VALUE_NORMALIZATION_FAILED',
});

const CONTROLLED_SPREADSHEET_EXPORT_ADAPTER_ID = 'adapter.controlled-spreadsheet.export.v1';
const CONTROLLED_SPREADSHEET_EXPORT_SOURCE_SYSTEM = 'STARTAK_GOVERNED_EXPORT';

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

function normalizeOptionalSha256(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  return value.toLowerCase();
}

function normalizeRefs(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return [...new Set(value.map((item) => requireString(String(item), field)))];
}

function getPath(root, path) {
  return path.split('.').reduce((value, key) => {
    if (value == null || typeof value !== 'object') return undefined;
    return value[key];
  }, root);
}

async function buildControlledSpreadsheetExport({
  schema,
  sourceSnapshot,
  sourceMetadataByPath,
  exportId,
  exportVersion,
  observedAt,
  requestedBy,
} = {}) {
  requirePlainObject(schema, 'schema');
  if (schema.direction !== SPREADSHEET_FIELD_DIRECTION.EXPORT) throw new TypeError('schema must be an EXPORT spreadsheet schema');
  if (!Array.isArray(schema.mappings) || schema.mappings.length === 0) throw new TypeError('schema.mappings must be a non-empty array');
  requirePlainObject(sourceSnapshot, 'sourceSnapshot');
  requirePlainObject(sourceMetadataByPath, 'sourceMetadataByPath');

  const caseId = requireString(sourceSnapshot.caseId, 'sourceSnapshot.caseId');
  const projectId = requireString(sourceSnapshot.projectId, 'sourceSnapshot.projectId');
  const normalizedExportId = requireString(exportId, 'exportId');
  const normalizedExportVersion = requireString(exportVersion, 'exportVersion');
  const normalizedObservedAt = normalizeIsoTimestamp(observedAt, 'observedAt');
  const normalizedRequestedBy = requireString(requestedBy, 'requestedBy');

  const holds = [];
  const rows = [];

  function hold(mapping, reasonCode, details = null) {
    holds.push({
      mappingId: mapping.mappingId,
      locator: `${mapping.sheetName}!${mapping.cell}`,
      sourcePath: mapping.sourcePath,
      reasonCode,
      details,
    });
  }

  for (const mapping of schema.mappings) {
    const rawValue = getPath(sourceSnapshot, mapping.sourcePath);
    if (rawValue === undefined || rawValue === null) {
      if (mapping.required) hold(mapping, SPREADSHEET_EXPORT_REASON.MISSING_REQUIRED_SOURCE);
      continue;
    }

    const metadata = sourceMetadataByPath[mapping.sourcePath];
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      hold(mapping, SPREADSHEET_EXPORT_REASON.SOURCE_METADATA_REQUIRED);
      continue;
    }
    if (metadata.caseId !== caseId || metadata.projectId !== projectId) {
      const error = new Error(`Source metadata scope mismatch for ${mapping.sourcePath}`);
      error.code = 'SPREADSHEET_EXPORT_SCOPE_MISMATCH';
      throw error;
    }
    if (metadata.sourceKind !== mapping.sourceKind) {
      hold(mapping, SPREADSHEET_EXPORT_REASON.SOURCE_KIND_MISMATCH, `expected ${mapping.sourceKind}; got ${metadata.sourceKind || 'UNKNOWN'}`);
      continue;
    }

    const metadataUnit = metadata.unit == null || metadata.unit === '' ? null : String(metadata.unit).trim();
    if (metadataUnit !== mapping.unit) {
      hold(mapping, SPREADSHEET_EXPORT_REASON.UNIT_MISMATCH, `expected ${mapping.unit}; got ${metadataUnit}`);
      continue;
    }

    const evidenceRefs = normalizeRefs(metadata.evidenceRefs, `${mapping.sourcePath}.evidenceRefs`);
    if (mapping.evidenceRequired && evidenceRefs.length === 0) {
      hold(mapping, SPREADSHEET_EXPORT_REASON.EVIDENCE_REQUIRED);
      continue;
    }

    let derivationRef = null;
    let engineVersionRef = null;
    let contextHashSha256 = null;
    if (mapping.sourceKind === SPREADSHEET_SOURCE_KIND.DETERMINISTIC_OUTPUT) {
      if (!metadata.derivationRef || !metadata.engineVersionRef) {
        hold(mapping, SPREADSHEET_EXPORT_REASON.DERIVATION_REQUIRED);
        continue;
      }
      derivationRef = requireString(metadata.derivationRef, `${mapping.sourcePath}.derivationRef`);
      engineVersionRef = requireString(metadata.engineVersionRef, `${mapping.sourcePath}.engineVersionRef`);
    }
    if (mapping.sourceKind === SPREADSHEET_SOURCE_KIND.AI_INTERPRETATION) {
      contextHashSha256 = normalizeOptionalSha256(metadata.contextHashSha256, `${mapping.sourcePath}.contextHashSha256`);
      if (!contextHashSha256) {
        hold(mapping, SPREADSHEET_EXPORT_REASON.AI_CONTEXT_HASH_REQUIRED);
        continue;
      }
      if (evidenceRefs.length === 0) {
        hold(mapping, SPREADSHEET_EXPORT_REASON.EVIDENCE_REQUIRED);
        continue;
      }
    }

    let normalizedValue;
    try {
      normalizedValue = normalizeExtractedValue(rawValue, mapping.valueType);
    } catch (error) {
      hold(mapping, SPREADSHEET_EXPORT_REASON.VALUE_NORMALIZATION_FAILED, error.message);
      continue;
    }

    rows.push({
      mappingId: mapping.mappingId,
      sheetName: mapping.sheetName,
      cell: mapping.cell,
      value: normalizedValue,
      valueType: mapping.valueType,
      unit: mapping.unit,
      provenance: {
        sourceKind: mapping.sourceKind,
        sourcePath: mapping.sourcePath,
        sourceRef: requireString(metadata.sourceRef, `${mapping.sourcePath}.sourceRef`),
        evidenceRefs,
        derivationRef,
        engineVersionRef,
        contextHashSha256,
        authoritative: mapping.sourceKind !== SPREADSHEET_SOURCE_KIND.AI_INTERPRETATION,
      },
    });
  }

  if (holds.length > 0) {
    return deepFreeze({
      schemaVersion: 1,
      status: SPREADSHEET_EXPORT_STATUS.HOLD_VALIDATION,
      caseId,
      projectId,
      exportId: normalizedExportId,
      exportVersion: normalizedExportVersion,
      holds,
      workbookProjection: null,
      envelope: null,
      externalWritePerformed: false,
      transactionAuthorized: false,
      semantics: 'Any missing source, provenance mismatch, unit mismatch, missing derivation, or missing AI context/evidence holds the whole export packet.',
    });
  }

  const sheets = {};
  for (const row of rows) {
    if (!sheets[row.sheetName]) sheets[row.sheetName] = { cells: {} };
    sheets[row.sheetName].cells[row.cell] = {
      value: row.value,
      valueType: row.valueType,
      unit: row.unit,
      provenance: row.provenance,
    };
  }

  const workbookProjection = {
    schemaVersion: 1,
    exportId: normalizedExportId,
    exportVersion: normalizedExportVersion,
    caseId,
    projectId,
    mappingSchemaId: schema.schemaId,
    mappingSchemaVersion: schema.mappingSchemaVersion,
    generatedAt: normalizedObservedAt,
    sheets,
    authoritativeWorkbook: false,
    transactionAuthorized: false,
  };
  const projectionHashSha256 = await sha256Hex(JSON.stringify(workbookProjection));

  const envelope = createIntegrationEnvelope({
    adapterId: CONTROLLED_SPREADSHEET_EXPORT_ADAPTER_ID,
    operation: INTEGRATION_OPERATION.EXPORT,
    caseId,
    projectId,
    sourceSystem: CONTROLLED_SPREADSHEET_EXPORT_SOURCE_SYSTEM,
    sourceObjectId: normalizedExportId,
    sourceVersion: normalizedExportVersion,
    observedAt: normalizedObservedAt,
    payload: {
      caseId,
      projectId,
      exportId: normalizedExportId,
      mappingSchemaId: schema.schemaId,
      mappingSchemaVersion: schema.mappingSchemaVersion,
      projectionHashSha256,
      exportedFields: rows.map((row) => ({
        mappingId: row.mappingId,
        sourcePath: row.provenance.sourcePath,
        sourceKind: row.provenance.sourceKind,
        sourceRef: row.provenance.sourceRef,
      })),
    },
    contentHashSha256: projectionHashSha256,
    requestedBy: normalizedRequestedBy,
  });

  return deepFreeze({
    schemaVersion: 1,
    status: SPREADSHEET_EXPORT_STATUS.READY_FOR_EXPORT_PACKET,
    caseId,
    projectId,
    exportId: normalizedExportId,
    exportVersion: normalizedExportVersion,
    holds: [],
    projectionHashSha256,
    workbookProjection,
    envelope,
    externalWritePerformed: false,
    authoritativeWorkbook: false,
    transactionAuthorized: false,
    semantics: 'This produces a provenance-preserving export projection and audit envelope only. It does not create XLSX bytes, write to an external spreadsheet service, convert AI narrative into authoritative fact, or authorize a transaction.',
  });
}

module.exports = {
  SPREADSHEET_EXPORT_STATUS,
  SPREADSHEET_EXPORT_REASON,
  CONTROLLED_SPREADSHEET_EXPORT_ADAPTER_ID,
  CONTROLLED_SPREADSHEET_EXPORT_SOURCE_SYSTEM,
  buildControlledSpreadsheetExport,
};