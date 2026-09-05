'use strict';

const assert = require('assert');
const { AUTHORITY_CLASS, INGEST_STATUS } = require('../../src/document-intelligence/contracts');
const {
  GOOGLE_DRIVE_ADAPTER_ID,
  GOOGLE_DRIVE_SOURCE_SYSTEM,
  buildGoogleDriveDocumentIngestion,
} = require('../../src/integration-governance/adapters/google-drive-document-ingestion');
const { INTEGRATION_OPERATION } = require('../../src/integration-governance/integration-envelope');

async function run() {
  const first = await buildGoogleDriveDocumentIngestion({
    caseId: 'CASE-GD-001',
    projectId: 'PROJECT-GD-001',
    documentId: 'DOC-GD-001',
    driveFile: {
      id: 'DRIVE-FILE-001',
      name: 'صك العقار.pdf',
      mimeType: 'application/pdf',
      modifiedTime: '2026-09-05T09:00:00Z',
      version: '17',
    },
    content: 'same controlled source bytes',
    existingDocuments: [],
    observedAt: '2026-09-05T10:00:00Z',
    requestedBy: 'human:pilot-user',
  });

  assert.strictEqual(first.adapterId, GOOGLE_DRIVE_ADAPTER_ID);
  assert.strictEqual(first.envelope.operation, INTEGRATION_OPERATION.INGEST);
  assert.strictEqual(first.envelope.sourceSystem, GOOGLE_DRIVE_SOURCE_SYSTEM);
  assert.strictEqual(first.envelope.sourceObjectId, 'DRIVE-FILE-001');
  assert.strictEqual(first.envelope.sourceVersion, '17');
  assert.strictEqual(first.envelope.contentHashSha256, first.documentRecord.contentHashSha256);
  assert.strictEqual(first.documentRecord.authorityClass, AUTHORITY_CLASS.UNKNOWN);
  assert.strictEqual(first.documentRecord.authorityVerified, false);
  assert.strictEqual(first.documentRecord.ingestStatus, INGEST_STATUS.ACCEPTED);
  assert.strictEqual(first.persisted, false);
  assert.strictEqual(first.evidenceCreated, false);
  assert.strictEqual(first.canonicalWriteProposed, false);
  assert.strictEqual(first.directWriteAuthorized, false);
  assert.strictEqual(first.transactionAuthorized, false);
  assert.strictEqual(Object.isFrozen(first), true);
  assert.strictEqual(Object.isFrozen(first.envelope), true);
  assert.strictEqual(Object.isFrozen(first.documentRecord), true);

  const sameCaseDuplicate = await buildGoogleDriveDocumentIngestion({
    caseId: 'CASE-GD-001',
    projectId: 'PROJECT-GD-001',
    documentId: 'DOC-GD-002',
    driveFile: {
      id: 'DRIVE-FILE-002',
      name: 'copy.pdf',
      mimeType: 'application/pdf',
      modifiedTime: '2026-09-05T09:30:00Z',
    },
    content: 'same controlled source bytes',
    existingDocuments: [first.documentRecord],
    observedAt: '2026-09-05T10:05:00Z',
    requestedBy: 'human:pilot-user',
  });

  assert.strictEqual(sameCaseDuplicate.documentRecord.ingestStatus, INGEST_STATUS.DUPLICATE_CONTENT);
  assert.strictEqual(sameCaseDuplicate.documentRecord.duplicateOfDocumentId, 'DOC-GD-001');

  const otherCase = await buildGoogleDriveDocumentIngestion({
    caseId: 'CASE-GD-002',
    projectId: 'PROJECT-GD-002',
    documentId: 'DOC-GD-003',
    driveFile: {
      id: 'DRIVE-FILE-003',
      name: 'copy.pdf',
      mimeType: 'application/pdf',
      modifiedTime: '2026-09-05T09:40:00Z',
    },
    content: 'same controlled source bytes',
    existingDocuments: [first.documentRecord],
    observedAt: '2026-09-05T10:10:00Z',
    requestedBy: 'human:pilot-user',
  });

  assert.strictEqual(otherCase.documentRecord.ingestStatus, INGEST_STATUS.ACCEPTED);
  assert.strictEqual(otherCase.documentRecord.duplicateOfDocumentId, null);
  assert.strictEqual(otherCase.envelope.caseId, 'CASE-GD-002');
  assert.strictEqual(otherCase.envelope.projectId, 'PROJECT-GD-002');

  await assert.rejects(() => buildGoogleDriveDocumentIngestion({
    caseId: 'CASE-GD-001',
    projectId: 'PROJECT-GD-001',
    documentId: 'DOC-GD-004',
    driveFile: {
      id: 'DRIVE-FILE-004',
      name: 'bad.pdf',
      mimeType: 'application/pdf',
      modifiedTime: 'not-a-date',
    },
    content: 'bytes',
    observedAt: '2026-09-05T10:15:00Z',
    requestedBy: 'human:pilot-user',
  }), /driveFile\.modifiedTime must be a valid date\/time/);

  console.log('run_google_drive_document_ingestion_adapter_v1: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});