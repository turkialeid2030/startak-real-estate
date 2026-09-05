'use strict';

const assert = require('assert');
const {
  INTEGRATION_OPERATION,
  INTEGRATION_WRITE_TARGET,
  FORBIDDEN_DIRECT_WRITE_TARGET,
  createIntegrationEnvelope,
} = require('../../src/integration-governance/integration-envelope');

const HASH = 'A'.repeat(64);

function base(overrides = {}) {
  return {
    adapterId: 'GOOGLE_DRIVE_DOCUMENT_ADAPTER_V1',
    operation: INTEGRATION_OPERATION.INGEST,
    caseId: 'CASE-IA-001',
    projectId: 'PROJECT-IA-001',
    sourceSystem: 'GOOGLE_DRIVE',
    sourceObjectId: 'drive-file-001',
    sourceVersion: 'v1',
    observedAt: '2026-09-05T12:00:00+03:00',
    payload: {
      caseId: 'CASE-IA-001',
      projectId: 'PROJECT-IA-001',
      metadata: { fileName: 'title-deed.pdf' },
    },
    contentHashSha256: HASH,
    requestedBy: 'USER-IA-001',
    ...overrides,
  };
}

(function testValidEnvelopeIsScopedImmutableAndNonAuthorizing() {
  const originalPayload = base().payload;
  const envelope = createIntegrationEnvelope(base({ payload: originalPayload }));

  assert.strictEqual(envelope.schemaVersion, 1);
  assert.strictEqual(envelope.operation, INTEGRATION_OPERATION.INGEST);
  assert.strictEqual(envelope.caseId, 'CASE-IA-001');
  assert.strictEqual(envelope.projectId, 'PROJECT-IA-001');
  assert.strictEqual(envelope.contentHashSha256, HASH.toLowerCase());
  assert.strictEqual(envelope.writeTarget, null);
  assert.strictEqual(envelope.humanApprovalRequired, false);
  assert.strictEqual(envelope.directWriteAuthorized, false);
  assert.strictEqual(envelope.transactionAuthorized, false);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.payload));
  assert.ok(Object.isFrozen(envelope.payload.metadata));
  assert.notStrictEqual(envelope.payload, originalPayload);
  assert.strictEqual(Object.isFrozen(originalPayload), false);
})();

(function testProposedCanonicalWriteRequiresApprovalAndNeverDirectlyAuthorizes() {
  const envelope = createIntegrationEnvelope(base({
    operation: INTEGRATION_OPERATION.PROPOSE_WRITE,
    writeTarget: INTEGRATION_WRITE_TARGET.CANONICAL_INPUT,
    sourceSystem: 'SPREADSHEET_IMPORT',
    sourceObjectId: 'workbook-001',
  }));

  assert.strictEqual(envelope.writeTarget, INTEGRATION_WRITE_TARGET.CANONICAL_INPUT);
  assert.strictEqual(envelope.humanApprovalRequired, true);
  assert.strictEqual(envelope.directWriteAuthorized, false);
  assert.strictEqual(envelope.transactionAuthorized, false);
})();

(function testNestedCrossCasePayloadFailsClosed() {
  assert.throws(
    () => createIntegrationEnvelope(base({
      payload: {
        caseId: 'CASE-IA-001',
        projectId: 'PROJECT-IA-001',
        records: [{ caseId: 'CASE-OTHER', projectId: 'PROJECT-IA-001' }],
      },
    })),
    (error) => error && error.code === 'INTEGRATION_SCOPE_MISMATCH',
  );
})();

(function testNestedCrossProjectPayloadFailsClosed() {
  assert.throws(
    () => createIntegrationEnvelope(base({
      payload: {
        caseId: 'CASE-IA-001',
        projectId: 'PROJECT-IA-001',
        nested: { caseId: 'CASE-IA-001', projectId: 'PROJECT-OTHER' },
      },
    })),
    (error) => error && error.code === 'INTEGRATION_SCOPE_MISMATCH',
  );
})();

(function testForbiddenDirectWriteTargetsAreRejected() {
  for (const target of Object.values(FORBIDDEN_DIRECT_WRITE_TARGET)) {
    assert.throws(
      () => createIntegrationEnvelope(base({
        operation: INTEGRATION_OPERATION.PROPOSE_WRITE,
        writeTarget: target,
      })),
      (error) => error && error.code === 'FORBIDDEN_INTEGRATION_WRITE_TARGET',
      target,
    );
  }
})();

(function testWriteTargetCannotLeakIntoReadIngestOrExport() {
  for (const operation of [
    INTEGRATION_OPERATION.READ,
    INTEGRATION_OPERATION.INGEST,
    INTEGRATION_OPERATION.EXPORT,
  ]) {
    assert.throws(
      () => createIntegrationEnvelope(base({
        operation,
        writeTarget: INTEGRATION_WRITE_TARGET.OPERATIONAL_STATE,
      })),
      /writeTarget is only allowed for PROPOSE_WRITE operations/,
    );
  }
})();

(function testHashAndRequiredFieldsFailClosed() {
  assert.throws(() => createIntegrationEnvelope(base({ contentHashSha256: 'bad-hash' })), /64-character SHA-256/);
  assert.throws(() => createIntegrationEnvelope(base({ caseId: '' })), /caseId must be a non-empty string/);
  assert.throws(() => createIntegrationEnvelope(base({ projectId: '' })), /projectId must be a non-empty string/);
  assert.throws(() => createIntegrationEnvelope(base({ sourceVersion: '' })), /sourceVersion must be a non-empty string/);
})();

(function testPayloadMustRemainPlainJsonLikeData() {
  assert.throws(
    () => createIntegrationEnvelope(base({
      payload: {
        caseId: 'CASE-IA-001',
        projectId: 'PROJECT-IA-001',
        observed: new Date('2026-09-05T00:00:00Z'),
      },
    })),
    /must contain plain objects only/,
  );
})();

console.log('INTEGRATION_GOVERNANCE_ENVELOPE_V1=PASS');
console.log('INTEGRATION_SCOPE_ISOLATION=PASS');
console.log('INTEGRATION_FORBIDDEN_WRITE_TARGETS=PASS');
console.log('INTEGRATION_NO_DIRECT_WRITE_AUTHORITY=PASS');
console.log('INTEGRATION_CALLER_PAYLOAD_NOT_MUTATED=PASS');
