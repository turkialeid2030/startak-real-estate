'use strict';

const { VALUE_TYPE } = require('../../document-intelligence/pipeline');

const WORKBOOK_FORMAT = Object.freeze({
  CSV_UTF8: 'CSV_UTF8',
  XLSX: 'XLSX',
});

const PARSER_STATUS = Object.freeze({
  READY: 'READY',
  HOLD_UNSUPPORTED_FORMAT: 'HOLD_UNSUPPORTED_FORMAT',
  HOLD_INVALID_INPUT: 'HOLD_INVALID_INPUT',
});

const PARSER_CAPABILITY = Object.freeze({
  FORMULA_EVALUATION: 'FORMULA_EVALUATION',
  MACRO_EXECUTION: 'MACRO_EXECUTION',
  EXTERNAL_LINK_RESOLUTION: 'EXTERNAL_LINK_RESOLUTION',
  UNIT_INFERENCE: 'UNIT_INFERENCE',
  EVIDENCE_INFERENCE: 'EVIDENCE_INFERENCE',
  TYPE_INFERENCE: 'TYPE_INFERENCE',
});

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
  if (!Object.values(enumObject).includes(value)) throw new TypeError(`${field} must be one of: ${Object.values(enumObject).join(', ')}`);
  return value;
}

function assertA1Cell(value, field = 'cell') {
  const normalized = requireString(value, field).toUpperCase();
  if (!/^[A-Z]{1,3}[1-9][0-9]*$/.test(normalized)) throw new TypeError(`${field} must be a single A1 cell reference`);
  return normalized;
}

function normalizeUnit(value, valueType, field) {
  if (valueType === VALUE_TYPE.NUMBER) return requireString(value, field);
  if (value !== undefined && value !== null && value !== '') throw new TypeError(`${field} is only allowed for NUMBER profiles`);
  return null;
}

function normalizeRefs(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(value.map((item) => requireString(String(item), field)))]);
}

function createCsvCellProfile({ cell, valueType, unit = null, evidenceRefs = [] } = {}) {
  const normalizedValueType = requireEnum(valueType, VALUE_TYPE, 'valueType');
  return deepFreeze({
    cell: assertA1Cell(cell),
    valueType: normalizedValueType,
    unit: normalizeUnit(unit, normalizedValueType, 'unit'),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
  });
}

function createGovernedParserProfile({
  profileId,
  profileVersion,
  format,
  sheetName,
  delimiter = ',',
  cellProfiles = [],
} = {}) {
  const normalizedFormat = requireEnum(format, WORKBOOK_FORMAT, 'format');
  if (normalizedFormat !== WORKBOOK_FORMAT.CSV_UTF8) {
    const error = new Error(`Unsupported governed workbook format: ${normalizedFormat}`);
    error.code = 'UNSUPPORTED_WORKBOOK_FORMAT';
    throw error;
  }
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || ['"', '\r', '\n'].includes(delimiter)) {
    throw new TypeError('delimiter must be one non-quote, non-newline character');
  }
  if (!Array.isArray(cellProfiles)) throw new TypeError('cellProfiles must be an array');

  const normalizedCellProfiles = cellProfiles.map((profile, index) => {
    try {
      return createCsvCellProfile(profile);
    } catch (error) {
      error.message = `cellProfiles[${index}]: ${error.message}`;
      throw error;
    }
  });
  const cells = new Set();
  for (const profile of normalizedCellProfiles) {
    if (cells.has(profile.cell)) throw new TypeError(`Duplicate cell profile: ${profile.cell}`);
    cells.add(profile.cell);
  }

  return deepFreeze({
    schemaVersion: 1,
    profileId: requireString(profileId, 'profileId'),
    profileVersion: requireString(profileVersion, 'profileVersion'),
    format: normalizedFormat,
    sheetName: requireString(sheetName, 'sheetName'),
    delimiter,
    cellProfiles: normalizedCellProfiles,
    capabilities: {
      [PARSER_CAPABILITY.FORMULA_EVALUATION]: false,
      [PARSER_CAPABILITY.MACRO_EXECUTION]: false,
      [PARSER_CAPABILITY.EXTERNAL_LINK_RESOLUTION]: false,
      [PARSER_CAPABILITY.UNIT_INFERENCE]: false,
      [PARSER_CAPABILITY.EVIDENCE_INFERENCE]: false,
      [PARSER_CAPABILITY.TYPE_INFERENCE]: false,
    },
    authoritativeSource: false,
    transactionAuthorized: false,
    semantics: 'The parser profile is an explicit interpretation contract. It declares type/unit/evidence metadata for selected CSV cells without inferring authority, units, evidence, formulas, or transaction meaning from workbook content.',
  });
}

module.exports = {
  WORKBOOK_FORMAT,
  PARSER_STATUS,
  PARSER_CAPABILITY,
  createCsvCellProfile,
  createGovernedParserProfile,
  assertA1Cell,
};
