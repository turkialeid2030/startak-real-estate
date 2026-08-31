'use strict';

const assert = require('assert');
const {
  AUTHORITY_CLASS,
  INGEST_STATUS,
  LOCATOR_KIND,
  VALUE_TYPE,
  ingestDocument,
  createEvidenceFact,
  reconcileKey,
  assessDecisionReadiness,
} = require('../../src/document-intelligence');

async function main() {
  let checks = 0;
  const expectThrow = (fn, pattern, label) => {
    assert.throws(fn, pattern, label);
    checks++;
  };

  const caseADoc = await ingestDocument({
    documentId: 'CASE-A-DOC-1',
    caseId: 'CASE-A',
    fileName: 'صك.pdf',
    mimeType: 'application/pdf',
    content: 'shared-byte-content',
    authorityClass: AUTHORITY_CLASS.OFFICIAL_PRIMARY,
    receivedAt: '2026-08-31T06:30:00Z',
  });

  const caseBDoc = await ingestDocument({
    documentId: 'CASE-B-DOC-1',
    caseId: 'CASE-B',
    fileName: 'copy.pdf',
    mimeType: 'application/pdf',
    content: 'shared-byte-content',
    existingDocuments: [caseADoc],
    receivedAt: '2026-08-31T06:31:00Z',
  });

  assert.strictEqual(caseBDoc.ingestStatus, INGEST_STATUS.ACCEPTED, 'Cross-case identical content must not create a duplicate relationship');
  checks++;
  assert.strictEqual(caseBDoc.duplicateOfDocumentId, null, 'Cross-case duplicateOfDocumentId must remain null');
  checks++;

  expectThrow(() => createEvidenceFact({
    factId: 'BAD-CROSS-CASE-FACT',
    caseId: 'CASE-B',
    document: caseADoc,
    key: 'property.land_area',
    rawValue: '5000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 },
    extractionMethod: 'TEST',
    extractionConfidence: 1,
  }), /CASE_ISOLATION_VIOLATION/, 'A fact must not attach a document owned by another case');

  const caseAFact = createEvidenceFact({
    factId: 'CASE-A-FACT',
    caseId: 'CASE-A',
    document: caseADoc,
    key: 'property.land_area',
    rawValue: '5000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 },
    extractionMethod: 'TEST',
    extractionConfidence: 1,
  });

  const caseBFact = createEvidenceFact({
    factId: 'CASE-B-FACT',
    caseId: 'CASE-B',
    document: caseBDoc,
    key: 'property.land_area',
    rawValue: '5000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 },
    extractionMethod: 'TEST',
    extractionConfidence: 1,
  });

  expectThrow(() => reconcileKey('property.land_area', [caseAFact, caseBFact]), /CASE_ISOLATION_VIOLATION/, 'Reconciliation must reject mixed-case evidence');

  const caseAReconciliation = reconcileKey('property.land_area', [caseAFact]);
  const caseBReconciliation = reconcileKey('property.land_area', [caseBFact]);
  expectThrow(() => assessDecisionReadiness({
    reconciliations: [caseAReconciliation, caseBReconciliation],
    requirements: [{ key: 'property.land_area' }],
  }), /CASE_ISOLATION_VIOLATION/, 'Readiness must reject mixed-case reconciliation records');

  assert.strictEqual(caseAReconciliation.caseId, 'CASE-A', 'Reconciliation must retain case identity');
  checks++;

  console.log(`DOCUMENT_INTELLIGENCE_CASE_ISOLATION_CHECKS=${checks}`);
  console.log('DOCUMENT_INTELLIGENCE_CASE_ISOLATION_RESULT=PASS');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
