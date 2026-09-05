'use strict';

const { TRUTH_STATUS } = require('../../document-intelligence/contracts');
const { buildControlledSpreadsheetImport } = require('./controlled-import');
const {
  CSV_LITERAL_PARSER_ID,
  CSV_LITERAL_PARSER_VERSION,
  parseCsvLiteralWorkbook,
} = require('./parsers/csv-literal-parser');

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

async function buildGovernedCsvSpreadsheetImport({
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
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  if (!sourceDocument || typeof sourceDocument !== 'object' || Array.isArray(sourceDocument)) throw new TypeError('sourceDocument must be an object');
  if (sourceDocument.caseId !== normalizedCaseId) {
    const error = new Error('Source document case scope does not match requested parser scope');
    error.code = 'PARSER_SOURCE_SCOPE_MISMATCH';
    throw error;
  }
  const sourceDocumentId = requireString(sourceDocument.documentId, 'sourceDocument.documentId');
  const expectedHash = normalizeSha256(sourceDocument.contentHashSha256, 'sourceDocument.contentHashSha256');

  const workbookSnapshot = await parseCsvLiteralWorkbook({
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    workbookId,
    workbookVersion,
    content,
    parserProfile,
  });

  if (workbookSnapshot.contentHashSha256 !== expectedHash
    || workbookSnapshot.parserAttestation.inputContentHashSha256 !== expectedHash
    || workbookSnapshot.parserAttestation.outputContentHashSha256 !== expectedHash) {
    const error = new Error('Parsed workbook bytes do not match the governed source-document SHA-256 identity');
    error.code = 'PARSER_SOURCE_HASH_MISMATCH';
    throw error;
  }

  const controlledImport = await buildControlledSpreadsheetImport({
    schema: importSchema,
    workbookSnapshot,
    canonicalSnapshot,
    allowedEvidenceRefs,
    parserId: CSV_LITERAL_PARSER_ID,
    parserVersion: CSV_LITERAL_PARSER_VERSION,
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
    semantics: 'This bridge cryptographically binds exact CSV source bytes to an existing STARTAK source-document hash before invoking the controlled spreadsheet import gate. Parsing never upgrades source authority or evidence truth. READY means proposals may proceed to explicit human review, not that canonical state was changed.',
  });
}

module.exports = {
  buildGovernedCsvSpreadsheetImport,
};