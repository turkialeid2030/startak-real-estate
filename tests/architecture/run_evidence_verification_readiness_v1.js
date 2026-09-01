'use strict';

const assert = require('assert');
const {
  AUTHORITY_CLASS,
  MATERIALITY,
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  READINESS_STATUS,
} = require('../../src/document-intelligence/contracts');
const { buildParsedEvidenceCandidate } = require('../../src/document-intelligence/parsed-evidence-qualification');
const {
  EVIDENCE_VERIFICATION_GATE_STATUS,
  EVIDENCE_VERIFICATION_OUTCOME,
  EVIDENCE_VERIFICATION_DECISION_STATUS,
  buildEvidenceVerificationGate,
  recordEvidenceVerificationDecision,
  assessVerificationRecordsForUnderwriting,
} = require('../../src/document-intelligence/evidence-verification-readiness');

const digest = 'b'.repeat(64);
const documentId = `local-sha256:${digest}`;
const caseId = 'LOCAL_INTAKE:bbbbbbbbbbbbbbbb';
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
  fileName: 'verified-market-rent.xlsx',
  size: 13000,
  digest,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  documentId,
  caseId,
  receivedAt: '2026-09-01T17:00:00Z',
  result: Object.freeze({ documentId, caseId, adapterId: 'XLSX_DETERMINISTIC_V1', format: 'XLSX', status: 'PARSED', atoms: Object.freeze([atom]), warnings: Object.freeze([]), reason: null }),
});

function candidate() {
  return buildParsedEvidenceCandidate({
    intakeRecord,
    atomId: atom.atomId,
    semanticKey: 'market_rent_per_sqm',
    valueType: 'NUMBER',
    unit: 'SAR/sqm/year',
    materiality: MATERIALITY.MATERIAL,
    sourceReference: 'source-contract-001',
    sourceDate: '2026-08-31',
    reviewerRef: 'semantic-reviewer-001',
    reviewerNote: 'Mapped the selected rent cell to the declared semantic key.',
    capturedAt: '2026-09-01T17:10:00Z',
  });
}

const attestation = Object.freeze({
  attestationId: 'att-001',
  verifierRef: 'verifier-001',
  verifierRole: 'LICENSED_PROFESSIONAL_REVIEWER',
  verifierIdentityEvidenceRef: 'verifier-identity-ev-001',
  verificationMethod: 'SOURCE_DOCUMENT_AND_REFERENCE_REVIEW',
  verificationReference: 'verification-workpaper-001',
  authorityClass: AUTHORITY_CLASS.LICENSED_PROFESSIONAL,
  authorityEvidenceRef: 'authority-evidence-001',
  verifiedAt: '2026-09-01T17:20:00Z',
  sourceCheckedAgainstOriginal: true,
  semanticMappingReviewed: true,
  conflictDeclarationCompleted: true,
});

const gateRefs = [
  'source-contract-001', 'semantic-reviewer-001', 'verifier-001', 'verifier-identity-ev-001', 'verification-workpaper-001', 'authority-evidence-001',
];

function goodGate(overrides = {}) {
  return buildEvidenceVerificationGate({ candidate: candidate(), verificationAttestation: { ...attestation, ...(overrides.attestation || {}) }, evidenceRefs: overrides.evidenceRefs || gateRefs });
}

function goodDecision(gate, overrides = {}) {
  return recordEvidenceVerificationDecision({
    gate,
    decision: {
      decisionId: 'verify-decision-001',
      outcome: EVIDENCE_VERIFICATION_OUTCOME.VERIFY_FACT,
      decidedByRef: 'verification-decision-owner-001',
      decisionEvidenceRef: 'verification-decision-evidence-001',
      decidedAt: '2026-09-01T17:30:00Z',
      conflictDeclarationCompleted: true,
      acknowledgements: {
        sourceReferenceReviewed: true,
        semanticMappingReviewed: true,
        authorityEvidenceReviewed: true,
        verificationMethodReviewed: true,
        humanAccountabilityAccepted: true,
      },
      ...(overrides.decision || {}),
    },
    evidenceRefs: overrides.evidenceRefs || [...gateRefs, 'verification-decision-owner-001', 'verification-decision-evidence-001'],
  });
}

(function completePacketStopsBeforeHumanDecision() {
  const gate = goodGate();
  assert.strictEqual(gate.status, EVIDENCE_VERIFICATION_GATE_STATUS.READY_FOR_HUMAN_VERIFICATION_DECISION);
  assert.strictEqual(gate.readyForHumanVerificationDecision, true);
  assert.strictEqual(gate.verifiedFactEstablished, false);
  assert.strictEqual(gate.financialEngineEligible, false);
  assert.strictEqual(gate.externalCertificationEstablished, false);
  assert.strictEqual(gate.transactionAuthorized, false);
})();

(function unknownAuthorityCannotBePromoted() {
  const gate = goodGate({ attestation: { authorityClass: AUTHORITY_CLASS.UNKNOWN } });
  assert.strictEqual(gate.status, EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_ATTESTATION);
})();

(function authorityEvidenceMustExistInEvidenceChain() {
  const refs = gateRefs.filter((ref) => ref !== 'authority-evidence-001');
  const gate = goodGate({ evidenceRefs: refs });
  assert.strictEqual(gate.status, EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_EVIDENCE_CHAIN);
})();

(function verificationCannotPredateExtraction() {
  const gate = goodGate({ attestation: { verifiedAt: '2026-09-01T17:05:00Z' } });
  assert.strictEqual(gate.status, EVIDENCE_VERIFICATION_GATE_STATUS.HOLD_TIMELINE);
})();

(function humanVerifyDecisionPromotesFactButNotUnderwritingAutomatically() {
  const gate = goodGate();
  const record = goodDecision(gate);
  assert.strictEqual(record.status, EVIDENCE_VERIFICATION_DECISION_STATUS.DECISION_RECORDED);
  assert.strictEqual(record.verifiedFactEstablished, true);
  assert.strictEqual(record.verifiedFact.truthStatus, TRUTH_STATUS.VERIFIED_FACT);
  assert.strictEqual(record.verifiedFact.verification.status, VERIFICATION_STATUS.VERIFIED);
  assert.strictEqual(record.verifiedFact.authorityClass, AUTHORITY_CLASS.LICENSED_PROFESSIONAL);
  assert.strictEqual(record.verifiedFact.authorityVerified, true);
  assert.strictEqual(record.readyForUnderwritingInput, false);
  assert.strictEqual(record.financialEngineEligible, false);
  assert.strictEqual(record.externalCertificationEstablished, false);
  assert.strictEqual(record.transactionAuthorized, false);
})();

(function humanDecisionCannotPredateAttestation() {
  const gate = goodGate();
  const record = goodDecision(gate, { decision: { decidedAt: '2026-09-01T17:15:00Z' } });
  assert.strictEqual(record.status, EVIDENCE_VERIFICATION_DECISION_STATUS.HOLD_TIMELINE);
})();

(function rejectOutcomeDoesNotCreateVerifiedFact() {
  const gate = goodGate();
  const record = goodDecision(gate, { decision: { outcome: EVIDENCE_VERIFICATION_OUTCOME.REJECT_CANDIDATE } });
  assert.strictEqual(record.status, EVIDENCE_VERIFICATION_DECISION_STATUS.DECISION_RECORDED);
  assert.strictEqual(record.rejectedCandidate, true);
  assert.strictEqual(record.verifiedFactEstablished, false);
})();

(function readinessCanRequireVerifiedFactAndAuthorityClass() {
  const verificationRecord = goodDecision(goodGate());
  const readiness = assessVerificationRecordsForUnderwriting({
    caseId,
    verificationRecords: [verificationRecord],
    requirements: [{
      key: 'market_rent_per_sqm',
      minimumIndependentSources: 1,
      requireVerifiedFact: true,
      allowedAuthorityClasses: [AUTHORITY_CLASS.LICENSED_PROFESSIONAL],
    }],
  });
  assert.strictEqual(readiness.status, READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT);
  assert.strictEqual(readiness.readyForUnderwritingInput, true);
  assert.strictEqual(readiness.financialEngineEligible, true);
  assert.strictEqual(readiness.financialEngineInputsWritten, false);
  assert.strictEqual(readiness.automaticFinancialEngineAdoption, false);
  assert.strictEqual(readiness.transactionAuthorized, false);
})();

(function readinessFailsClosedOnAuthorityPolicyMismatch() {
  const verificationRecord = goodDecision(goodGate());
  const readiness = assessVerificationRecordsForUnderwriting({
    caseId,
    verificationRecords: [verificationRecord],
    requirements: [{
      key: 'market_rent_per_sqm',
      minimumIndependentSources: 1,
      requireVerifiedFact: true,
      allowedAuthorityClasses: [AUTHORITY_CLASS.OFFICIAL_PRIMARY],
    }],
  });
  assert.strictEqual(readiness.status, READINESS_STATUS.HOLD_EVIDENCE);
  assert(readiness.blockers.some((b) => b.code === 'REQUIRED_AUTHORITY_CLASS_NOT_VERIFIED'));
})();

(function readinessFailsClosedWithoutVerifiedRecord() {
  const readiness = assessVerificationRecordsForUnderwriting({
    caseId,
    verificationRecords: [],
    requirements: [{ key: 'market_rent_per_sqm', minimumIndependentSources: 1, requireVerifiedFact: true }],
  });
  assert.strictEqual(readiness.status, READINESS_STATUS.HOLD_EVIDENCE);
  assert(readiness.blockers.some((b) => b.code === 'REQUIRED_EVIDENCE_MISSING'));
})();

console.log('EVIDENCE_VERIFICATION_READINESS_V1=PASS');
