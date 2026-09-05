'use strict';

const { VALUE_TYPE, sha256Hex } = require('../../../document-intelligence/pipeline');
const { WORKBOOK_FORMAT, createGovernedParserProfile } = require('../parser-contracts');

const CSV_LITERAL_PARSER_ID = 'parser.csv-literal.v1';
const CSV_LITERAL_PARSER_VERSION = '1.0.0';

const CSV_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxRows: 10000,
  maxColumns: 500,
  maxCellCharacters: 100000,
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

function toBytes(content) {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  throw new TypeError('content must be a string, ArrayBuffer, or typed-array view');
}

function decodeUtf8(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  } catch (error) {
    const wrapped = new Error('CSV input is not valid UTF-8');
    wrapped.code = 'CSV_INVALID_UTF8';
    throw wrapped;
  }
}

function columnName(indexOneBased) {
  let value = indexOneBased;
  let out = '';
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function parseCsvRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;
  let rowStarted = false;

  function assertCellLimit() {
    if (field.length > CSV_LIMITS.maxCellCharacters) {
      const error = new Error('CSV cell exceeds parser character limit');
      error.code = 'CSV_CELL_LIMIT_EXCEEDED';
      throw error;
    }
  }

  function pushField() {
    assertCellLimit();
    row.push(field);
    if (row.length > CSV_LIMITS.maxColumns) {
      const error = new Error('CSV row exceeds parser column limit');
      error.code = 'CSV_COLUMN_LIMIT_EXCEEDED';
      throw error;
    }
    field = '';
    afterClosingQuote = false;
    rowStarted = true;
  }

  function pushRow() {
    pushField();
    rows.push(row);
    if (rows.length > CSV_LIMITS.maxRows) {
      const error = new Error('CSV exceeds parser row limit');
      error.code = 'CSV_ROW_LIMIT_EXCEEDED';
      throw error;
    }
    row = [];
    rowStarted = false;
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        field += char;
        assertCellLimit();
      }
      continue;
    }

    if (afterClosingQuote) {
      if (char === delimiter) {
        pushField();
        continue;
      }
      if (char === '\n') {
        pushRow();
        continue;
      }
      if (char === '\r') {
        if (text[i + 1] === '\n') i += 1;
        pushRow();
        continue;
      }
      const error = new Error('Unexpected character after closing CSV quote');
      error.code = 'CSV_MALFORMED_QUOTE';
      throw error;
    }

    if (char === '"') {
      if (field !== '') {
        const error = new Error('CSV quote must begin at the start of a field');
        error.code = 'CSV_MALFORMED_QUOTE';
        throw error;
      }
      inQuotes = true;
      rowStarted = true;
      continue;
    }

    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === '\n') {
      pushRow();
      continue;
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      continue;
    }

    if (char === '\0') {
      const error = new Error('CSV input contains a NUL character');
      error.code = 'CSV_NUL_NOT_ALLOWED';
      throw error;
    }
    field += char;
    rowStarted = true;
    assertCellLimit();
  }

  if (inQuotes) {
    const error = new Error('CSV input ends inside a quoted field');
    error.code = 'CSV_UNTERMINATED_QUOTE';
    throw error;
  }

  if (afterClosingQuote || rowStarted || field !== '' || row.length > 0) pushRow();
  return rows;
}

function formulaSignal(rawValue) {
  const trimmed = String(rawValue).trimStart();
  return trimmed.startsWith('=') ? trimmed : null;
}

function normalizeRuntimeProfile(parserProfile) {
  if (!parserProfile || typeof parserProfile !== 'object' || Array.isArray(parserProfile)) throw new TypeError('parserProfile must be an object');
  if (parserProfile.format !== WORKBOOK_FORMAT.CSV_UTF8) {
    const error = new Error(`Unsupported workbook format for CSV literal parser: ${parserProfile.format}`);
    error.code = 'UNSUPPORTED_WORKBOOK_FORMAT';
    throw error;
  }
  return createGovernedParserProfile({
    profileId: parserProfile.profileId,
    profileVersion: parserProfile.profileVersion,
    format: parserProfile.format,
    sheetName: parserProfile.sheetName,
    delimiter: parserProfile.delimiter,
    cellProfiles: parserProfile.cellProfiles,
  });
}

async function parseCsvLiteralWorkbook({
  caseId,
  projectId,
  workbookId,
  workbookVersion,
  content,
  parserProfile,
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  const normalizedWorkbookId = requireString(workbookId, 'workbookId');
  const normalizedWorkbookVersion = requireString(workbookVersion, 'workbookVersion');
  const normalizedProfile = normalizeRuntimeProfile(parserProfile);

  const bytes = toBytes(content);
  if (bytes.byteLength > CSV_LIMITS.maxBytes) {
    const error = new Error('CSV input exceeds parser byte limit');
    error.code = 'CSV_BYTE_LIMIT_EXCEEDED';
    throw error;
  }
  const contentHashSha256 = await sha256Hex(bytes);
  const text = decodeUtf8(bytes);
  const rows = parseCsvRows(text, normalizedProfile.delimiter);
  const profileByCell = new Map(normalizedProfile.cellProfiles.map((profile) => [profile.cell, profile]));
  const cells = {};

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const csvRow = rows[rowIndex];
    for (let colIndex = 0; colIndex < csvRow.length; colIndex += 1) {
      const cellAddress = `${columnName(colIndex + 1)}${rowIndex + 1}`;
      const rawValue = csvRow[colIndex];
      const profile = profileByCell.get(cellAddress);
      cells[cellAddress] = {
        value: rawValue,
        valueType: profile ? profile.valueType : VALUE_TYPE.STRING,
        unit: profile ? profile.unit : null,
        evidenceRefs: profile ? [...profile.evidenceRefs] : [],
        formula: formulaSignal(rawValue),
      };
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    workbookId: normalizedWorkbookId,
    workbookVersion: normalizedWorkbookVersion,
    contentHashSha256,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    format: WORKBOOK_FORMAT.CSV_UTF8,
    sheets: {
      [normalizedProfile.sheetName]: {
        cells,
      },
    },
    parserAttestation: {
      parserId: CSV_LITERAL_PARSER_ID,
      parserVersion: CSV_LITERAL_PARSER_VERSION,
      parserProfileId: normalizedProfile.profileId,
      parserProfileVersion: normalizedProfile.profileVersion,
      inputContentHashSha256: contentHashSha256,
      outputContentHashSha256: contentHashSha256,
      formulaEvaluationPerformed: false,
      macroExecutionPerformed: false,
      externalLinkResolutionPerformed: false,
      unitInferencePerformed: false,
      evidenceInferencePerformed: false,
      typeInferencePerformed: false,
    },
    sourceAuthorityPromoted: false,
    canonicalMutationPerformed: false,
    transactionAuthorized: false,
    semantics: 'Deterministic UTF-8 CSV literal parser. It hashes the exact source bytes, revalidates the parser profile, parses RFC-style quoted fields, applies only explicit cell profile metadata, flags equals-prefixed formula-like literals without evaluating them, and performs no unit/evidence/type inference, authority promotion, canonical mutation, or transaction authorization.',
  });
}

module.exports = {
  CSV_LITERAL_PARSER_ID,
  CSV_LITERAL_PARSER_VERSION,
  CSV_LIMITS,
  parseCsvRows,
  parseCsvLiteralWorkbook,
};