'use strict';

const { VALUE_TYPE } = require('../../document-intelligence/pipeline');

const SPREADSHEET_FIELD_DIRECTION = Object.freeze({
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
});

const SPREADSHEET_SOURCE_KIND = Object.freeze({
  CANONICAL_INPUT: 'CANONICAL_INPUT',
  DETERMINISTIC_OUTPUT: 'DETERMINISTIC_OUTPUT',
  AI_INTERPRETATION: 'AI_INTERPRETATION',
});

const IMPORTABLE_TARGET_PREFIXES = Object.freeze([
  'property.inputs.',
  'tenant.inputs.',
  'regulatory.inputs.',
  'valuation.inputs.',
  'financial.inputs.',
  'scenarioRisk.inputs.',
  'decisionThresholds.inputs.',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requireEnum(value, enumObject, field) {
  if (!Object.values(enumObject).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(enumObject).join(', ')}`);
  }
  return value;
}

function normalizeOptionalUnit(unit, valueType, field = 'unit') {
  const isNumeric = valueType === VALUE_TYPE.NUMBER;
  if (isNumeric) return requireString(unit, field);
  if (unit !== undefined && unit !== null && unit !== '') {
    throw new TypeError(`${field} is only allowed for NUMBER fields`);
  }
  return null;
}

function normalizeEvidenceRefs(refs, field = 'evidenceRefs') {
  if (refs == null) return Object.freeze([]);
  if (!Array.isArray(refs)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(refs.map((item) => requireString(String(item), field)))]);
}

function assertA1Cell(value, field = 'cell') {
  const normalized = requireString(value, field).toUpperCase();
  if (!/^[A-Z]{1,3}[1-9][0-9]*$/.test(normalized)) throw new TypeError(`${field} must be a single A1 cell reference`);
  return normalized;
}

function assertImportableTargetPath(targetPath) {
  const normalized = requireString(targetPath, 'targetPath');
  if (!IMPORTABLE_TARGET_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    const error = new Error(`Spreadsheet imports may target canonical input paths only: ${normalized}`);
    error.code = 'SPREADSHEET_IMPORT_TARGET_NOT_ALLOWED';
    throw error;
  }
  return normalized;
}

function createSpreadsheetFieldMapping({
  mappingId,
  direction,
  sheetName,
  cell,
  valueType,
  unit = null,
  required = true,
  evidenceRequired = false,
  targetPath = null,
  sourceKind = null,
  sourcePath = null,
} = {}) {
  const normalizedDirection = requireEnum(direction, SPREADSHEET_FIELD_DIRECTION, 'direction');
  const normalizedValueType = requireEnum(valueType, VALUE_TYPE, 'valueType');
  const normalizedUnit = normalizeOptionalUnit(unit, normalizedValueType);

  if (typeof required !== 'boolean') throw new TypeError('required must be a boolean');
  if (typeof evidenceRequired !== 'boolean') throw new TypeError('evidenceRequired must be a boolean');

  let normalizedTargetPath = null;
  let normalizedSourceKind = null;
  let normalizedSourcePath = null;

  if (normalizedDirection === SPREADSHEET_FIELD_DIRECTION.IMPORT) {
    normalizedTargetPath = assertImportableTargetPath(targetPath);
    if (sourceKind != null || sourcePath != null) throw new TypeError('sourceKind/sourcePath are export-only fields');
  } else {
    if (targetPath != null) throw new TypeError('targetPath is import-only');
    normalizedSourceKind = requireEnum(sourceKind, SPREADSHEET_SOURCE_KIND, 'sourceKind');
    normalizedSourcePath = requireString(sourcePath, 'sourcePath');
    if (normalizedSourceKind === SPREADSHEET_SOURCE_KIND.AI_INTERPRETATION && evidenceRequired !== true) {
      const error = new Error('AI interpretation exports must preserve evidence references');
      error.code = 'AI_EXPORT_EVIDENCE_REQUIRED';
      throw error;
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    mappingId: requireString(mappingId, 'mappingId'),
    direction: normalizedDirection,
    sheetName: requireString(sheetName, 'sheetName'),
    cell: assertA1Cell(cell),
    valueType: normalizedValueType,
    unit: normalizedUnit,
    required,
    evidenceRequired,
    targetPath: normalizedTargetPath,
    sourceKind: normalizedSourceKind,
    sourcePath: normalizedSourcePath,
  });
}

function createSpreadsheetSchema({ schemaId, schemaVersion, direction, mappings } = {}) {
  const normalizedDirection = requireEnum(direction, SPREADSHEET_FIELD_DIRECTION, 'direction');
  if (!Array.isArray(mappings) || mappings.length === 0) throw new TypeError('mappings must be a non-empty array');

  const normalizedMappings = mappings.map((mapping, index) => {
    if (!mapping || typeof mapping !== 'object') throw new TypeError(`mappings[${index}] must be an object`);
    if (mapping.direction !== normalizedDirection) throw new TypeError(`mappings[${index}].direction must match schema direction`);
    return { ...mapping };
  });

  const ids = new Set();
  const locators = new Set();
  const paths = new Set();
  for (const mapping of normalizedMappings) {
    if (ids.has(mapping.mappingId)) throw new TypeError(`Duplicate mappingId: ${mapping.mappingId}`);
    ids.add(mapping.mappingId);
    const locator = `${mapping.sheetName}!${mapping.cell}`;
    if (locators.has(locator)) throw new TypeError(`Duplicate spreadsheet locator: ${locator}`);
    locators.add(locator);

    const semanticPath = normalizedDirection === SPREADSHEET_FIELD_DIRECTION.IMPORT ? mapping.targetPath : mapping.sourcePath;
    if (paths.has(semanticPath)) throw new TypeError(`Duplicate semantic path: ${semanticPath}`);
    paths.add(semanticPath);
  }

  return deepFreeze({
    schemaVersion: 1,
    schemaId: requireString(schemaId, 'schemaId'),
    mappingSchemaVersion: requireString(schemaVersion, 'schemaVersion'),
    direction: normalizedDirection,
    mappings: normalizedMappings,
    directCanonicalWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'Spreadsheet schemas are explicit field/cell contracts. Import schemas may target canonical input namespaces only. They cannot map directly to deterministic outputs, decision-control state, or final investment decisions.',
  });
}

function createWorkbookCell({ value, valueType, unit = null, evidenceRefs = [], formula = null } = {}) {
  const normalizedValueType = requireEnum(valueType, VALUE_TYPE, 'valueType');
  const normalizedUnit = normalizeOptionalUnit(unit, normalizedValueType);
  if (formula !== undefined && formula !== null && String(formula).trim() !== '') {
    return deepFreeze({
      value,
      valueType: normalizedValueType,
      unit: normalizedUnit,
      evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
      formula: String(formula).trim(),
    });
  }
  return deepFreeze({
    value,
    valueType: normalizedValueType,
    unit: normalizedUnit,
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    formula: null,
  });
}

module.exports = {
  SPREADSHEET_FIELD_DIRECTION,
  SPREADSHEET_SOURCE_KIND,
  IMPORTABLE_TARGET_PREFIXES,
  createSpreadsheetFieldMapping,
  createSpreadsheetSchema,
  createWorkbookCell,
  assertImportableTargetPath,
};