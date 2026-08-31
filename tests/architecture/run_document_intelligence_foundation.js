'use strict';

const assert = require('assert');
const {
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  LOCATOR_KIND,
  RECONCILIATION_STATUS,
  READINESS_STATUS,
  MATERIALITY,
  INGEST_STATUS,
  VALUE_TYPE,
  sha256Hex,
  classifyDocument,
  normalizeExtractedValue,
  ingestDocument,
  createEvidenceFact,
  verifyEvidenceFact,
  reconcileKey,
  reconcileEvidenceFacts,
  assessDecisionReadiness,
} = require('../../src/document-intelligence');

async function main() {
  let checks = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    checks++;
  };

  // 1) Content identity is deterministic and uses real SHA-256.
  const abcHash = await sha256Hex('abc');
  check(abcHash === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 known vector mismatch');

  // 2) Metadata-only document classification.
  check(classifyDocument({ fileName: 'صك الملكية.pdf', mimeType: 'application/pdf' }) === DOCUMENT_TYPE.TITLE_DEED, 'Arabic title deed classification failed');
  check(classifyDocument({ fileName: 'رفع مساحي نهائي.pdf', mimeType: 'application/pdf' }) === DOCUMENT_TYPE.SURVEY, 'Arabic survey classification failed');
  check(classifyDocument({ fileName: 'investment-presentation.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) === DOCUMENT_TYPE.PRESENTATION, 'Presentation classification failed');
  check(classifyDocument({ fileName: 'model.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) === DOCUMENT_TYPE.FINANCIAL_MODEL, 'Excel fallback classification failed');
  check(classifyDocument({ fileName: 'unrecognized.bin', mimeType: 'application/octet-stream' }) === DOCUMENT_TYPE.UNKNOWN, 'Unknown classification failed');

  // 3) Deterministic normalization without unit conversion.
  check(normalizeExtractedValue('١٤٠٬٠٠٠٬٠٠٠ ريال', VALUE_TYPE.NUMBER) === 140000000, 'Arabic-Indic number normalization failed');
  check(normalizeExtractedValue('۹۵٫۵٪', VALUE_TYPE.NUMBER) === 95.5, 'Eastern-Arabic decimal normalization failed');
  check(normalizeExtractedValue(' نعم ', VALUE_TYPE.BOOLEAN) === true, 'Arabic boolean normalization failed');
  check(normalizeExtractedValue('  حي   الوادي  ', VALUE_TYPE.STRING) === 'حي الوادي', 'String normalization failed');

  // 4) Immutable intake record + duplicate content detection.
  const doc1 = await ingestDocument({
    documentId: 'DOC-001',
    caseId: 'CASE-001',
    fileName: 'صك الملكية.pdf',
    mimeType: 'application/pdf',
    content: 'same-document-bytes',
    authorityClass: AUTHORITY_CLASS.OFFICIAL_PRIMARY,
    receivedAt: '2026-08-31T06:00:00Z',
  });
  check(doc1.ingestStatus === INGEST_STATUS.ACCEPTED, 'First intake should be accepted');
  check(doc1.authorityClass === AUTHORITY_CLASS.OFFICIAL_PRIMARY, 'Explicit authority class not preserved');
  check(doc1.authorityVerified === false, 'Authority must not be auto-verified');
  check(doc1.truthStatus === TRUTH_STATUS.DOCUMENT_ONLY, 'Document must not become evidence/fact automatically');
  check(Object.isFrozen(doc1), 'Document record must be immutable');

  const doc2 = await ingestDocument({
    documentId: 'DOC-002',
    caseId: 'CASE-001',
    fileName: 'copy-of-title.pdf',
    mimeType: 'application/pdf',
    content: 'same-document-bytes',
    existingDocuments: [doc1],
    receivedAt: '2026-08-31T06:01:00Z',
  });
  check(doc2.ingestStatus === INGEST_STATUS.DUPLICATE_CONTENT, 'Duplicate content was not detected');
  check(doc2.duplicateOfDocumentId === 'DOC-001', 'Duplicate source was not linked');
  check(doc2.contentHashSha256 === doc1.contentHashSha256, 'Duplicate hash mismatch');
  check(doc2.authorityClass === AUTHORITY_CLASS.UNKNOWN, 'Authority must not be inferred from filename/content similarity');

  const doc3 = await ingestDocument({
    documentId: 'DOC-003',
    caseId: 'CASE-001',
    fileName: 'رفع مساحي.pdf',
    mimeType: 'application/pdf',
    content: 'independent-survey-bytes',
    authorityClass: AUTHORITY_CLASS.LICENSED_PROFESSIONAL,
    receivedAt: '2026-08-31T06:02:00Z',
  });

  const doc4 = await ingestDocument({
    documentId: 'DOC-004',
    caseId: 'CASE-001',
    fileName: 'investment-presentation.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    content: 'independent-presentation-bytes',
    authorityClass: AUTHORITY_CLASS.PRESENTATION,
    receivedAt: '2026-08-31T06:03:00Z',
  });

  // 5) Evidence facts preserve raw + normalized values and require locators.
  const titleArea = createEvidenceFact({
    factId: 'FACT-AREA-TITLE',
    caseId: 'CASE-001',
    document: doc1,
    key: 'property.land_area',
    rawValue: '5,000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 },
    extractionMethod: 'MANUAL_TEST_FIXTURE',
    extractionConfidence: 1,
    materiality: MATERIALITY.MATERIAL,
    capturedAt: '2026-08-31T06:04:00Z',
  });
  check(titleArea.rawValue === '5,000' && titleArea.normalizedValue === 5000, 'Raw/normalized values were not preserved separately');
  check(titleArea.truthStatus === TRUTH_STATUS.EXTRACTED_EVIDENCE, 'Extracted evidence was incorrectly promoted');
  check(titleArea.verification.status === VERIFICATION_STATUS.NOT_VERIFIED, 'Extracted evidence must default to NOT_VERIFIED');
  check(Object.isFrozen(titleArea) && Object.isFrozen(titleArea.sourceLocator), 'Evidence fact must be deeply immutable');

  assert.throws(() => createEvidenceFact({
    factId: 'FACT-BAD', caseId: 'CASE-001', document: doc1, key: 'bad', rawValue: 1, normalizedValue: 1,
    valueType: VALUE_TYPE.NUMBER, sourceLocator: null, extractionMethod: 'TEST', extractionConfidence: 1,
  }), /sourceLocator is required/);
  checks++;

  const surveyArea = createEvidenceFact({
    factId: 'FACT-AREA-SURVEY',
    caseId: 'CASE-001',
    document: doc3,
    key: 'property.land_area',
    rawValue: '5000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 2 },
    extractionMethod: 'MANUAL_TEST_FIXTURE',
    extractionConfidence: 1,
    materiality: MATERIALITY.MATERIAL,
    capturedAt: '2026-08-31T06:05:00Z',
  });

  const presentationArea = createEvidenceFact({
    factId: 'FACT-AREA-PRESENTATION',
    caseId: 'CASE-001',
    document: doc4,
    key: 'property.land_area',
    rawValue: '5,200',
    normalizedValue: 5200,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.SLIDE, slide: 5 },
    extractionMethod: 'MANUAL_TEST_FIXTURE',
    extractionConfidence: 1,
    materiality: MATERIALITY.MATERIAL,
    capturedAt: '2026-08-31T06:06:00Z',
  });

  // 6) Agreement, duplicate independence, tolerance, conflict, missing, unit mismatch.
  const agreement = reconcileKey('property.land_area', [titleArea, surveyArea]);
  check(agreement.status === RECONCILIATION_STATUS.AGREEMENT, 'Independent agreement not detected');
  check(agreement.independentSourceCount === 2, 'Independent source count incorrect');
  check(agreement.consensusValue === 5000, 'Agreement consensus value incorrect');

  const duplicateFact = createEvidenceFact({
    factId: 'FACT-AREA-DUPLICATE',
    caseId: 'CASE-001',
    document: doc2,
    key: 'property.land_area',
    rawValue: '5000',
    normalizedValue: 5000,
    valueType: VALUE_TYPE.NUMBER,
    unit: 'sqm',
    sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 },
    extractionMethod: 'MANUAL_TEST_FIXTURE',
    extractionConfidence: 1,
    materiality: MATERIALITY.MATERIAL,
    capturedAt: '2026-08-31T06:07:00Z',
  });
  const duplicateAgreement = reconcileKey('property.land_area', [titleArea, duplicateFact]);
  check(duplicateAgreement.status === RECONCILIATION_STATUS.AGREEMENT, 'Duplicate values should still compare as agreement');
  check(duplicateAgreement.independentSourceCount === 1, 'Byte-identical documents must not count as independent corroboration');

  const nearArea = { ...surveyArea, factId: 'FACT-AREA-NEAR', normalizedValue: 5000.4 };
  const toleranceAgreement = reconcileKey('property.land_area', [titleArea, nearArea], { numericTolerance: { absolute: 0.5 } });
  check(toleranceAgreement.status === RECONCILIATION_STATUS.AGREEMENT, 'Configured numeric tolerance was not honored');

  const conflict = reconcileKey('property.land_area', [titleArea, surveyArea, presentationArea]);
  check(conflict.status === RECONCILIATION_STATUS.CONFLICT, 'Material conflict not detected');
  check(conflict.consensusValue === null, 'Conflict must not silently select a winner');
  check(conflict.evidence.length === 3, 'Conflict must preserve all source evidence');

  const missing = reconcileEvidenceFacts([titleArea], { keys: ['property.land_area', 'property.title_number'] });
  check(missing.find((item) => item.key === 'property.title_number').status === RECONCILIATION_STATUS.MISSING, 'Missing required key not surfaced');

  const frontageM = createEvidenceFact({
    factId: 'FACT-FRONTAGE-M', caseId: 'CASE-001', document: doc1, key: 'property.frontage', rawValue: '20', normalizedValue: 20,
    valueType: VALUE_TYPE.NUMBER, unit: 'm', sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 1 }, extractionMethod: 'TEST', extractionConfidence: 1,
  });
  const frontageFt = createEvidenceFact({
    factId: 'FACT-FRONTAGE-FT', caseId: 'CASE-001', document: doc3, key: 'property.frontage', rawValue: '65.6', normalizedValue: 65.6,
    valueType: VALUE_TYPE.NUMBER, unit: 'ft', sourceLocator: { kind: LOCATOR_KIND.PAGE, page: 2 }, extractionMethod: 'TEST', extractionConfidence: 1,
  });
  const unitMismatch = reconcileKey('property.frontage', [frontageM, frontageFt]);
  check(unitMismatch.status === RECONCILIATION_STATUS.UNIT_MISMATCH, 'Unit mismatch was silently normalized/ignored');
  check(unitMismatch.consensusValue === null, 'Unit mismatch must not create consensus');

  // 7) Verification is explicit and non-mutating.
  const verifiedTitleArea = verifyEvidenceFact(titleArea, {
    verificationMethod: 'OFFICIAL_SOURCE_MATCH',
    verifierType: 'HUMAN_REVIEW',
    verificationReference: 'TEST-VERIFICATION-001',
    verifiedAt: '2026-08-31T06:08:00Z',
  });
  check(verifiedTitleArea.truthStatus === TRUTH_STATUS.VERIFIED_FACT, 'Explicit verification did not promote fact');
  check(verifiedTitleArea.verification.status === VERIFICATION_STATUS.VERIFIED, 'Verification status not recorded');
  check(titleArea.truthStatus === TRUTH_STATUS.EXTRACTED_EVIDENCE, 'Verification mutated original extracted evidence');

  // 8) Evidence readiness holds on unresolved conflict and passes only the evidence gate when satisfied.
  const conflictReadiness = assessDecisionReadiness({
    reconciliations: [conflict],
    requirements: [{ key: 'property.land_area', minimumIndependentSources: 2 }],
  });
  check(conflictReadiness.status === READINESS_STATUS.HOLD_EVIDENCE, 'Conflict should hold evidence readiness');
  check(conflictReadiness.blockers.some((b) => b.code === 'UNRESOLVED_CONFLICT'), 'Conflict blocker missing');

  const corroborationHold = assessDecisionReadiness({
    reconciliations: [duplicateAgreement],
    requirements: [{ key: 'property.land_area', minimumIndependentSources: 2 }],
  });
  check(corroborationHold.status === READINESS_STATUS.HOLD_EVIDENCE, 'Duplicate content incorrectly satisfied corroboration');
  check(corroborationHold.blockers.some((b) => b.code === 'INSUFFICIENT_CORROBORATION'), 'Corroboration blocker missing');

  const verifiedAgreement = reconcileKey('property.land_area', [verifiedTitleArea, surveyArea]);
  const ready = assessDecisionReadiness({
    reconciliations: [verifiedAgreement],
    requirements: [{ key: 'property.land_area', minimumIndependentSources: 2, requireVerifiedFact: true }],
  });
  check(ready.status === READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT, 'Satisfied evidence gate did not pass');
  check(ready.blockers.length === 0, 'Satisfied evidence gate retained blockers');
  check(ready.semantics.includes('not an investment recommendation'), 'Readiness semantics must prevent decision overclaim');

  console.log(`DOCUMENT_INTELLIGENCE_FOUNDATION_CHECKS=${checks}`);
  console.log('DOCUMENT_INTELLIGENCE_FOUNDATION_RESULT=PASS');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
