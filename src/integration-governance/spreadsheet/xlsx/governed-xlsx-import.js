'use strict';

const { TRUTH_STATUS } = require('../../../document-intelligence/contracts');
const { buildControlledSpreadsheetImport } = require('../controlled-import');
const {
  SHEETJS_PASSIVE_PARSER_ID,
  SHEETJS_PASSIVE_PARSER_VERSION,
  parseSheetJsPassiveWorkbook,
} = require('./sheetjs-passive-parser');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeSha256(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  return value.toLowerCase();
}

async function buildGovernedXlsxSpreadsheetImport({
  caseId,
  projectId,
  workbookId,
  workbookVersion,
  sourceDocument,
  content,
  parserProfile,
  importSchema,
  canonicalSnapshot,
  allowedEvidenceRefs = [],
  observedAt,
  requestedBy,
  correlationId,
  sheetjs = null,
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  if (!sourceDocument || typeof sourceDocument !== 'object' || Array.isArray(sourceDocument)) throw new TypeError('sourceDocument must be an object');
  if (sourceDocument.caseId !== normalizedCaseId) {
    const error = new Error('Source document case scope does not match requested XLSX parser scope');
    error.code = 'PARSER_SOURCE_SCOPE_MISMATCH';
    throw error;
  }
  const sourceDocumentId = requireString(sourceDocument.documentId, 'sourceDocument.documentId');
  const expectedHash = normalizeSha256(sourceDocument.contentHashSha256, 'sourceDocument.contentHashSha256');

  const workbookSnapshot = await parseSheetJsPassiveWorkbook({
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    workbookId,
    workbookVersion,
    content,
    parserProfile,
    sheetjs,
  });

  if (workbookSnapshot.contentHashSha256 !== expectedHash
    || workbookSnapshot.parserAttestation.inputContentHashSha256 !== expectedHash
    || workbookSnapshot.parserAttestation.outputContentHashSha256 !== expectedHash) {
    const error = new Error('Parsed XLSX bytes do not match the governed source-document SHA-256 identity');
    error.code = 'PARSER_SOURCE_HASH_MISMATCH';
    throw error;
  }

  const controlledImport = await buildControlledSpreadsheetImport({
    schema: importSchema,
    workbookSnapshot,
    canonicalSnapshot,
    allowedEvidenceRefs,
    parserId: SHEETJS_PASSIVE_PARSER_ID,
    parserVersion: SHEETJS_PASSIVE_PARSER_VERSION,
    observedAt,
    requestedBy,
    correlationId,
  });

  return deepFreeze({
    schemaVersion: 1,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    sourceDocumentId,
    sourceDocumentTruthStatus: sourceDocument.truthStatus || TRUTH_STATUS.DOCUMENT_ONLY,
    sourceDocumentHashSha256: expectedHash,
    sourceDocumentBound: true,
    parserAttestation: workbookSnapshot.parserAttestation,
    workbookSnapshot,
    controlledImport,
    sourceAuthorityPromoted: false,
    evidenceVerifiedByParser: false,
    canonicalMutationPerformed: false,
    humanApprovalRequired: controlledImport.humanApprovalRequired === true,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    semantics: 'This bridge cryptographically binds exact XLSX bytes to an existing STARTAK source-document hash before invoking IA-4 controlled spreadsheet import. The workbook must first pass IA-6 OPC and dependency authorization. Parsing never upgrades source authority or evidence truth. READY means governed write proposals are eligible for explicit human review only; canonical state is not changed.',
  });
}

module.exports = {
  buildGovernedXlsxSpreadsheetImport,
};
