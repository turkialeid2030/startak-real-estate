'use strict';

const assert = require('assert');
const {
  PARSED_EVIDENCE_QUALIFICATION_STATUS,
  buildParsedEvidenceCandidate,
} = require('../../src/document-intelligence/parsed-evidence-qualification');
const { MATERIALITY, TRUTH_STATUS, VERIFICATION_STATUS } = require('../../src/document-intelligence/contracts');

const digest = 'a'.repeat(64);
const documentId = `local-sha256:${digest}`;
const caseId = 'LOCAL_INTAKE:aaaaaaaaaaaaaaaa';
const atom = Object.freeze({
  schemaVersion: 1,
  atomId: `${documentId}:cell:xl/worksheets/sheet1.xml:B7`,
  documentId,
  caseId,
  adapterId: 'XLSX_DETERMINISTIC_V1',
  kind: 'CELL',
  rawValue: 1800,
  valueType: 'NUMBER',
  location: { kind: 'CELL', sheet: 'Inputs', cell: 'B7', packagePath: 'xl/worksheets/sheet1.xml' },
  metadata: {},
  truthSemantics: 'PARSED_CONTENT_ONLY_NOT_EVIDENCE',
});

const intakeRecord = Object.freeze({
  fileName: 'market-assumptions.xlsx',
  size: 12000,
  digest,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  documentId,
  caseId,
  receivedAt: '2026-09-01T17:00:00Z',
  result: Object.freeze({
    documentId,
    caseId,
    adapterId: 'XLSX_DETERMINISTIC_V1',
    format: 'XLSX',
    status: 'PARSED',
    atoms: Object.freeze([atom]),
    warnings: Object.freeze([]),
    reason: null,
  }),
});

function build(overrides = {}) {
  return buildParsedEvidenceCandidate({
    intakeRecord,
    atomId: atom.atomId,
    semanticKey: 'market_rent_per_sqm',
    valueType: 'NUMBER',
    unit: 'SAR/sqm/year',
    materiality: MATERIALITY.MATERIAL,
    sourceReference: 'SOURCE-REF-001',
    sourceDate: '2026-08-31',
    reviewerRef: 'reviewer-internal-001',
    reviewerNote: 'Human reviewer mapped cell B7 to the market rent semantic key.',
    capturedAt: '2026-09-01T17:10:00Z',
    ...overrides,
  });
}

(function positiveCandidateRemainsUnverifiedAndIneligible() {
  const result = build();
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.CANDIDATE_REQUIRES_VERIFICATION);
  assert.strictEqual(result.fact.truthStatus, TRUTH_STATUS.EXTRACTED_EVIDENCE);
  assert.strictEqual(result.verificationStatus, VERIFICATION_STATUS.NOT_VERIFIED);
  assert.strictEqual(result.authorityVerified, false);
  assert.strictEqual(result.verifiedFactEstablished, false);
  assert.strictEqual(result.readyForUnderwritingInput, false);
  assert.strictEqual(result.financialEngineEligible, false);
  assert.strictEqual(result.transactionAuthorized, false);
  assert.strictEqual(result.fact.key, 'market_rent_per_sqm');
  assert.strictEqual(result.fact.normalizedValue, 1800);
  assert.strictEqual(result.fact.documentHashSha256, digest);
  assert.strictEqual(result.sourceProvenance.provenanceClaimVerified, false);
})();

(function parserMustSucceedBeforeQualification() {
  const result = build({ intakeRecord: { ...intakeRecord, result: { ...intakeRecord.result, status: 'UNSUPPORTED', atoms: [] } } });
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_PARSER_RESULT);
  assert.strictEqual(result.financialEngineEligible, false);
})();

(function atomMustBelongToSameCaseAndDocument() {
  const result = build({ atomId: 'other-atom' });
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_ATOM);
})();

(function semanticMappingIsExplicitAndFailClosed() {
  const result = build({ semanticKey: '' });
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_SEMANTIC_MAPPING);
})();

(function provenanceIsMandatoryAndNotSelfVerified() {
  const result = build({ sourceReference: '' });
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_PROVENANCE);
  assert.strictEqual(result.authorityVerified, false);
})();

(function invalidSourceDateFailsClosed() {
  const result = build({ sourceDate: 'not-a-date' });
  assert.strictEqual(result.status, PARSED_EVIDENCE_QUALIFICATION_STATUS.HOLD_PROVENANCE);
})();

console.log('PARSED_EVIDENCE_QUALIFICATION_V1=PASS');
