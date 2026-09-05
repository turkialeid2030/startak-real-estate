'use strict';

const { VALUE_TYPE, sha256Hex } = require('../../../document-intelligence/pipeline');
const { WORKBOOK_FORMAT } = require('../parser-contracts');
const { createXlsxParserProfile } = require('./parser-profile');
const { inspectXlsxOpcContainer } = require('./opc-preflight');
const { SHEETJS_CE_POLICY } = require('./dependency-policy');
const { authorizeXlsxPassiveParserInvocation } = require('./parser-authorization');

const SHEETJS_PASSIVE_PARSER_ID = 'parser.sheetjs-passive-xlsx.v1';
const SHEETJS_PASSIVE_PARSER_VERSION = '1.0.0';

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
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  throw new TypeError('XLSX content must be an ArrayBuffer or typed-array view');
}

function loadSheetJs(injectedSheetJs) {
  if (injectedSheetJs) return injectedSheetJs;
  try {
    // Deliberately dynamic: the base repository remains installable before the exact
    // reviewed artifact is promoted into the production dependency lock.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require('xlsx');
  } catch (cause) {
    const error = new Error('Reviewed SheetJS runtime dependency is unavailable');
    error.code = 'XLSX_RUNTIME_DEPENDENCY_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
}

function assertSheetJsRuntime(XLSX) {
  if (!XLSX || typeof XLSX.read !== 'function' || !XLSX.utils || typeof XLSX.utils.decode_range !== 'function') {
    const error = new Error('SheetJS runtime does not expose the required passive parser API');
    error.code = 'XLSX_RUNTIME_API_INVALID';
    throw error;
  }
  if (String(XLSX.version || '') !== SHEETJS_CE_POLICY.preferredVersion) {
    const error = new Error(`SheetJS runtime version mismatch: expected ${SHEETJS_CE_POLICY.preferredVersion}; got ${XLSX.version || 'UNKNOWN'}`);
    error.code = 'XLSX_RUNTIME_VERSION_MISMATCH';
    throw error;
  }
}

function profileKey(sheetName, cell) {
  return `${sheetName}!${cell}`;
}

function hiddenState(sheetMetadata) {
  const value = sheetMetadata && Number(sheetMetadata.Hidden);
  if (value === 1) return 'HIDDEN';
  if (value === 2) return 'VERY_HIDDEN';
  return 'VISIBLE';
}

function assertSafeFormula(formula, locator, maxCharacters) {
  if (formula == null || formula === '') return null;
  const normalized = String(formula);
  if (normalized.length > maxCharacters) {
    const error = new Error(`Formula exceeds parser character limit at ${locator}`);
    error.code = 'XLSX_FORMULA_CHARACTER_LIMIT_EXCEEDED';
    throw error;
  }
  // External workbook formulas conventionally contain [Book.xlsx]Sheet!A1.
  // DDE-style references conventionally contain a pipe and bang reference.
  if (/\[[^\]]+\][^!]*!/i.test(normalized) || /\|[^!]+!/i.test(normalized)) {
    const error = new Error(`External/DDE-style formula reference is not allowed at ${locator}`);
    error.code = 'XLSX_EXTERNAL_FORMULA_REFERENCE_NOT_ALLOWED';
    throw error;
  }
  return normalized;
}

function nativeValue(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (cell.v instanceof Date) return cell.v.toISOString();
  if (cell.v === undefined || cell.v === null) return '';
  return cell.v;
}

function normalizeProfiledValue(cell, profile) {
  const raw = nativeValue(cell);
  if (!profile) return { value: raw, valueType: VALUE_TYPE.STRING, unit: null, evidenceRefs: [] };
  return {
    value: raw,
    valueType: profile.valueType,
    unit: profile.unit,
    evidenceRefs: [...profile.evidenceRefs],
  };
}

function encodeMerge(XLSX, merge) {
  if (!merge || !merge.s || !merge.e) return null;
  return XLSX.utils.encode_range(merge);
}

async function parseSheetJsPassiveWorkbook({
  caseId,
  projectId,
  workbookId,
  workbookVersion,
  content,
  parserProfile,
  sheetjs = null,
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  const normalizedWorkbookId = requireString(workbookId, 'workbookId');
  const normalizedWorkbookVersion = requireString(workbookVersion, 'workbookVersion');
  const normalizedProfile = createXlsxParserProfile(parserProfile);
  if (normalizedProfile.format !== WORKBOOK_FORMAT.XLSX) {
    const error = new Error('XLSX parser profile format mismatch');
    error.code = 'UNSUPPORTED_WORKBOOK_FORMAT';
    throw error;
  }

  const bytes = toBytes(content);
  const sourceHashSha256 = await sha256Hex(bytes);
  const preflight = inspectXlsxOpcContainer(bytes);

  const authorization = authorizeXlsxPassiveParserInvocation({
    dependencyCandidate: {
      packageName: SHEETJS_CE_POLICY.packageName,
      version: SHEETJS_CE_POLICY.preferredVersion,
      sourceUrl: SHEETJS_CE_POLICY.officialArtifactUrl,
      license: SHEETJS_CE_POLICY.requiredLicense,
      archiveSha256: SHEETJS_CE_POLICY.reviewApprovedSha256,
    },
    preflightResult: preflight,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    sourceHashSha256,
    parserProfileId: normalizedProfile.profileId,
    parserProfileVersion: normalizedProfile.profileVersion,
  });

  const XLSX = loadSheetJs(sheetjs);
  assertSheetJsRuntime(XLSX);

  let workbook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'array',
      cellFormula: true,
      cellHTML: false,
      cellNF: true,
      cellStyles: true,
      cellText: false,
      cellDates: false,
      bookVBA: false,
      WTF: false,
    });
  } catch (cause) {
    const error = new Error(`SheetJS passive parse failed: ${cause.message}`);
    error.code = 'XLSX_PASSIVE_PARSE_FAILED';
    error.cause = cause;
    throw error;
  }

  if (!workbook || !Array.isArray(workbook.SheetNames) || !workbook.Sheets || typeof workbook.Sheets !== 'object') {
    const error = new Error('SheetJS returned an invalid workbook object');
    error.code = 'XLSX_PARSED_WORKBOOK_INVALID';
    throw error;
  }
  if (workbook.SheetNames.length > normalizedProfile.limits.maxSheets) {
    const error = new Error('XLSX workbook exceeds parser sheet limit');
    error.code = 'XLSX_SHEET_LIMIT_EXCEEDED';
    throw error;
  }

  const profileByLocator = new Map(normalizedProfile.cellProfiles.map((profile) => [profileKey(profile.sheetName, profile.cell), profile]));
  const sheetMetadata = workbook.Workbook && Array.isArray(workbook.Workbook.Sheets) ? workbook.Workbook.Sheets : [];
  const sheets = {};
  let totalCells = 0;

  for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex += 1) {
    const sheetName = workbook.SheetNames[sheetIndex];
    const sourceSheet = workbook.Sheets[sheetName];
    if (!sourceSheet || typeof sourceSheet !== 'object') {
      const error = new Error(`Missing parsed worksheet object for ${sheetName}`);
      error.code = 'XLSX_SHEET_OBJECT_MISSING';
      throw error;
    }

    if (sourceSheet['!ref']) {
      let range;
      try {
        range = XLSX.utils.decode_range(sourceSheet['!ref']);
      } catch (cause) {
        const error = new Error(`Invalid worksheet range for ${sheetName}`);
        error.code = 'XLSX_SHEET_RANGE_INVALID';
        error.cause = cause;
        throw error;
      }
      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;
      if (rowCount > normalizedProfile.limits.maxRowsPerSheet) {
        const error = new Error(`Worksheet ${sheetName} exceeds row limit`);
        error.code = 'XLSX_ROW_LIMIT_EXCEEDED';
        throw error;
      }
      if (columnCount > normalizedProfile.limits.maxColumnsPerSheet) {
        const error = new Error(`Worksheet ${sheetName} exceeds column limit`);
        error.code = 'XLSX_COLUMN_LIMIT_EXCEEDED';
        throw error;
      }
    }

    const cells = {};
    const cellAddresses = Object.keys(sourceSheet)
      .filter((key) => !key.startsWith('!'))
      .sort();

    for (const cellAddress of cellAddresses) {
      totalCells += 1;
      if (totalCells > normalizedProfile.limits.maxTotalCells) {
        const error = new Error('XLSX workbook exceeds total parsed cell limit');
        error.code = 'XLSX_TOTAL_CELL_LIMIT_EXCEEDED';
        throw error;
      }
      const cell = sourceSheet[cellAddress];
      const locator = profileKey(sheetName, cellAddress);
      const formula = assertSafeFormula(cell && cell.f, locator, normalizedProfile.limits.maxCellCharacters);
      const profiled = profileByLocator.get(locator);
      const normalized = normalizeProfiledValue(cell, profiled);
      const valueLength = typeof normalized.value === 'string' ? normalized.value.length : String(normalized.value ?? '').length;
      if (valueLength > normalizedProfile.limits.maxCellCharacters) {
        const error = new Error(`XLSX cell exceeds parser character limit at ${locator}`);
        error.code = 'XLSX_CELL_CHARACTER_LIMIT_EXCEEDED';
        throw error;
      }
      cells[cellAddress] = {
        value: normalized.value,
        valueType: normalized.valueType,
        unit: normalized.unit,
        evidenceRefs: normalized.evidenceRefs,
        formula,
        nativeCellType: cell && cell.t ? String(cell.t) : null,
        numberFormat: cell && cell.z ? String(cell.z) : null,
        profiled: Boolean(profiled),
      };
    }

    const merges = Array.isArray(sourceSheet['!merges'])
      ? sourceSheet['!merges'].map((merge) => encodeMerge(XLSX, merge)).filter(Boolean)
      : [];
    if (merges.length > normalizedProfile.limits.maxMergesPerSheet) {
      const error = new Error(`Worksheet ${sheetName} exceeds merge limit`);
      error.code = 'XLSX_MERGE_LIMIT_EXCEEDED';
      throw error;
    }

    sheets[sheetName] = {
      hiddenState: hiddenState(sheetMetadata[sheetIndex]),
      range: sourceSheet['!ref'] || null,
      merges,
      cells,
    };
  }

  for (const profile of normalizedProfile.cellProfiles) {
    if (!Object.prototype.hasOwnProperty.call(sheets, profile.sheetName)) {
      const error = new Error(`Profile references missing worksheet: ${profile.sheetName}`);
      error.code = 'XLSX_PROFILE_SHEET_MISSING';
      throw error;
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    workbookId: normalizedWorkbookId,
    workbookVersion: normalizedWorkbookVersion,
    contentHashSha256: sourceHashSha256,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    format: WORKBOOK_FORMAT.XLSX,
    sheetOrder: [...workbook.SheetNames],
    sheets,
    parserAttestation: {
      parserId: SHEETJS_PASSIVE_PARSER_ID,
      parserVersion: SHEETJS_PASSIVE_PARSER_VERSION,
      parserProfileId: normalizedProfile.profileId,
      parserProfileVersion: normalizedProfile.profileVersion,
      dependencyPackage: SHEETJS_CE_POLICY.packageName,
      dependencyVersion: SHEETJS_CE_POLICY.preferredVersion,
      dependencyArtifactSha256: SHEETJS_CE_POLICY.reviewApprovedSha256,
      inputContentHashSha256: sourceHashSha256,
      outputContentHashSha256: sourceHashSha256,
      opcPreflightVersion: preflight.preflightVersion,
      dependencyDecision: authorization.dependencyReview.decision,
      formulaEvaluationPerformed: false,
      macroExecutionPerformed: false,
      externalLinkResolutionPerformed: false,
      unitInferencePerformed: false,
      evidenceInferencePerformed: false,
      underwritingTypeInferencePerformed: false,
    },
    sourceAuthorityPromoted: false,
    evidenceVerifiedByParser: false,
    canonicalMutationPerformed: false,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'Governed passive XLSX parser. Exact bytes are hashed and must pass OPC hostile-container preflight and the IA-6 exact dependency authorization before SheetJS 0.20.3 is invoked. Formula text is preserved but never evaluated. Underwriting type/unit/evidence metadata is applied only from explicit parser profiles. Output is a normalized workbook snapshot only and carries no evidence, canonical-write, decision, or transaction authority.',
  });
}

module.exports = {
  SHEETJS_PASSIVE_PARSER_ID,
  SHEETJS_PASSIVE_PARSER_VERSION,
  parseSheetJsPassiveWorkbook,
};
