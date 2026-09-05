'use strict';

const { VALUE_TYPE } = require('../../../document-intelligence/pipeline');
const { WORKBOOK_FORMAT, PARSER_CAPABILITY, assertA1Cell } = require('../parser-contracts');

const XLSX_PARSER_PROFILE_LIMITS = Object.freeze({
  maxSheets: 100,
  maxRowsPerSheet: 10000,
  maxColumnsPerSheet: 500,
  maxTotalCells: 100000,
  maxCellCharacters: 100000,
  maxMergesPerSheet: 10000,
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

function requirePositiveInteger(value, field, ceiling) {
  if (!Number.isInteger(value) || value <= 0 || value > ceiling) {
    throw new TypeError(`${field} must be a positive integer <= ${ceiling}`);
  }
  return value;
}

function normalizeRefs(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze([...new Set(value.map((item) => requireString(String(item), field)))]);
}

function normalizeUnit(value, valueType, field) {
  if (valueType === VALUE_TYPE.NUMBER) return requireString(value, field);
  if (value !== undefined && value !== null && value !== '') throw new TypeError(`${field} is only allowed for NUMBER profiles`);
  return null;
}

function createXlsxCellProfile({ sheetName, cell, valueType, unit = null, evidenceRefs = [] } = {}) {
  if (!Object.values(VALUE_TYPE).includes(valueType)) throw new TypeError(`valueType must be one of: ${Object.values(VALUE_TYPE).join(', ')}`);
  return deepFreeze({
    sheetName: requireString(sheetName, 'sheetName'),
    cell: assertA1Cell(cell),
    valueType,
    unit: normalizeUnit(unit, valueType, 'unit'),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
  });
}

function createXlsxParserProfile({
  profileId,
  profileVersion,
  cellProfiles = [],
  limits = {},
} = {}) {
  if (!Array.isArray(cellProfiles)) throw new TypeError('cellProfiles must be an array');
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) throw new TypeError('limits must be an object');

  const normalizedCellProfiles = cellProfiles.map((profile, index) => {
    try {
      return createXlsxCellProfile(profile);
    } catch (error) {
      error.message = `cellProfiles[${index}]: ${error.message}`;
      throw error;
    }
  });

  const locators = new Set();
  for (const profile of normalizedCellProfiles) {
    const locator = `${profile.sheetName}!${profile.cell}`;
    if (locators.has(locator)) throw new TypeError(`Duplicate XLSX cell profile: ${locator}`);
    locators.add(locator);
  }

  const normalizedLimits = {
    maxSheets: requirePositiveInteger(limits.maxSheets ?? XLSX_PARSER_PROFILE_LIMITS.maxSheets, 'limits.maxSheets', XLSX_PARSER_PROFILE_LIMITS.maxSheets),
    maxRowsPerSheet: requirePositiveInteger(limits.maxRowsPerSheet ?? XLSX_PARSER_PROFILE_LIMITS.maxRowsPerSheet, 'limits.maxRowsPerSheet', XLSX_PARSER_PROFILE_LIMITS.maxRowsPerSheet),
    maxColumnsPerSheet: requirePositiveInteger(limits.maxColumnsPerSheet ?? XLSX_PARSER_PROFILE_LIMITS.maxColumnsPerSheet, 'limits.maxColumnsPerSheet', XLSX_PARSER_PROFILE_LIMITS.maxColumnsPerSheet),
    maxTotalCells: requirePositiveInteger(limits.maxTotalCells ?? XLSX_PARSER_PROFILE_LIMITS.maxTotalCells, 'limits.maxTotalCells', XLSX_PARSER_PROFILE_LIMITS.maxTotalCells),
    maxCellCharacters: requirePositiveInteger(limits.maxCellCharacters ?? XLSX_PARSER_PROFILE_LIMITS.maxCellCharacters, 'limits.maxCellCharacters', XLSX_PARSER_PROFILE_LIMITS.maxCellCharacters),
    maxMergesPerSheet: requirePositiveInteger(limits.maxMergesPerSheet ?? XLSX_PARSER_PROFILE_LIMITS.maxMergesPerSheet, 'limits.maxMergesPerSheet', XLSX_PARSER_PROFILE_LIMITS.maxMergesPerSheet),
  };

  return deepFreeze({
    schemaVersion: 1,
    profileId: requireString(profileId, 'profileId'),
    profileVersion: requireString(profileVersion, 'profileVersion'),
    format: WORKBOOK_FORMAT.XLSX,
    cellProfiles: normalizedCellProfiles,
    limits: normalizedLimits,
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
    semantics: 'Explicit XLSX parser profile for passive SheetJS parsing. Native workbook values are preserved, while unit/evidence and underwriting value-type metadata are applied only to explicitly profiled A1 cells. No formula execution, unit/evidence/type inference, source-authority promotion, canonical mutation, or transaction authorization is permitted.',
  });
}

module.exports = {
  XLSX_PARSER_PROFILE_LIMITS,
  createXlsxCellProfile,
  createXlsxParserProfile,
};
