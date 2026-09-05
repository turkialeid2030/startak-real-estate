'use strict';

const { AUTHORITY_CLASS } = require('../../document-intelligence/contracts');
const { ingestDocument } = require('../../document-intelligence/pipeline');
const {
  INTEGRATION_OPERATION,
  createIntegrationEnvelope,
} = require('../integration-envelope');

const GOOGLE_DRIVE_ADAPTER_ID = 'adapter.google-drive.document-ingestion.v1';
const GOOGLE_DRIVE_SOURCE_SYSTEM = 'GOOGLE_DRIVE';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function normalizeDriveFile(driveFile) {
  requireObject(driveFile, 'driveFile');
  const fileId = requireString(driveFile.id, 'driveFile.id');
  const fileName = requireString(driveFile.name, 'driveFile.name');
  const mimeType = driveFile.mimeType == null
    ? 'application/octet-stream'
    : requireString(driveFile.mimeType, 'driveFile.mimeType');
  const modifiedTime = requireString(driveFile.modifiedTime, 'driveFile.modifiedTime');
  const parsedModifiedTime = new Date(modifiedTime);
  if (Number.isNaN(parsedModifiedTime.getTime())) throw new TypeError('driveFile.modifiedTime must be a valid date/time');

  const sourceVersion = driveFile.version != null && String(driveFile.version).trim() !== ''
    ? String(driveFile.version).trim()
    : parsedModifiedTime.toISOString();

  return Object.freeze({
    id: fileId,
    name: fileName,
    mimeType,
    modifiedTime: parsedModifiedTime.toISOString(),
    version: sourceVersion,
  });
}

async function buildGoogleDriveDocumentIngestion({
  caseId,
  projectId,
  documentId,
  driveFile,
  content,
  existingDocuments = [],
  observedAt,
  requestedBy,
} = {}) {
  const normalizedCaseId = requireString(caseId, 'caseId');
  const normalizedProjectId = requireString(projectId, 'projectId');
  const normalizedDocumentId = requireString(documentId, 'documentId');
  const normalizedDriveFile = normalizeDriveFile(driveFile);
  const normalizedRequestedBy = requireString(requestedBy, 'requestedBy');
  const normalizedObservedAt = requireString(observedAt, 'observedAt');
  const observedDate = new Date(normalizedObservedAt);
  if (Number.isNaN(observedDate.getTime())) throw new TypeError('observedAt must be a valid date/time');

  if (!Array.isArray(existingDocuments)) throw new TypeError('existingDocuments must be an array');

  // Google Drive is a source carrier, not an authority class. The document is
  // therefore ingested as UNKNOWN authority until a separate governed
  // verification process establishes provenance and authority.
  const documentRecord = await ingestDocument({
    documentId: normalizedDocumentId,
    caseId: normalizedCaseId,
    fileName: normalizedDriveFile.name,
    mimeType: normalizedDriveFile.mimeType,
    content,
    authorityClass: AUTHORITY_CLASS.UNKNOWN,
    existingDocuments,
    receivedAt: observedDate.toISOString(),
  });

  const envelope = createIntegrationEnvelope({
    adapterId: GOOGLE_DRIVE_ADAPTER_ID,
    operation: INTEGRATION_OPERATION.INGEST,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    sourceSystem: GOOGLE_DRIVE_SOURCE_SYSTEM,
    sourceObjectId: normalizedDriveFile.id,
    sourceVersion: normalizedDriveFile.version,
    observedAt: observedDate.toISOString(),
    payload: {
      caseId: normalizedCaseId,
      projectId: normalizedProjectId,
      documentId: normalizedDocumentId,
      fileName: normalizedDriveFile.name,
      mimeType: normalizedDriveFile.mimeType,
      driveModifiedTime: normalizedDriveFile.modifiedTime,
      documentType: documentRecord.documentType,
      ingestStatus: documentRecord.ingestStatus,
      authorityClass: documentRecord.authorityClass,
    },
    contentHashSha256: documentRecord.contentHashSha256,
    requestedBy: normalizedRequestedBy,
  });

  return deepFreeze({
    schemaVersion: 1,
    adapterId: GOOGLE_DRIVE_ADAPTER_ID,
    caseId: normalizedCaseId,
    projectId: normalizedProjectId,
    envelope,
    documentRecord,
    persisted: false,
    evidenceCreated: false,
    authorityVerified: false,
    canonicalWriteProposed: false,
    directWriteAuthorized: false,
    transactionAuthorized: false,
    nextRequiredStep: 'DOCUMENT_EVIDENCE_EXTRACTION_OR_HUMAN_SOURCE_REVIEW',
    semantics: 'Controlled Google Drive ingestion maps externally retrieved file metadata and content into STARTAK document intake and an immutable integration envelope. Drive location never proves document authority. This adapter does not persist the record, create verified evidence, write canonical inputs, alter deterministic outputs, or authorize a transaction.',
  });
}

module.exports = {
  GOOGLE_DRIVE_ADAPTER_ID,
  GOOGLE_DRIVE_SOURCE_SYSTEM,
  normalizeDriveFile,
  buildGoogleDriveDocumentIngestion,
};