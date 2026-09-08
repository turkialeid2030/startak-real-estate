'use strict';

const assert = require('assert');
const {
  TRUTH_STATUS,
  VERIFICATION_STATUS,
} = require('../../src/document-intelligence/contracts');
const {
  EVIDENCE_SOURCE_ROLE,
  EVIDENCE_SENSITIVITY_CLASS,
  EXTRACTOR_TYPE,
  PROFESSIONAL_REVIEW_OUTCOME,
  ADMISSIBILITY_TARGET,
  ADMISSIBILITY_STATUS,
  createProfessionalEvidenceChainRecord,
  validateProfessionalEvidenceChainIntegrity,
  recordProfessionalEvidenceReview,
  assessProfessionalEvidenceAdmissibility,
} = require('../../src/document-intelligence/professional-evidence-chain');
const {
  PROPERTY_DATA_GATE_STATUS,
  evaluateMaterialPropertyDataConflicts,
} = require('../../src/document-intelligence/property-data-conflict-gate');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

const CAPTURED_AT = '2026-09-07T09:00:00.000Z';
const REVIEWED_AT = '2026-09-07T09:05:00.000Z';

function makeFact({
  id,
  key = 'property.land_area',
  value = 1000,
  unit = 'sqm',
  hashChar = 'a',
  verified = false,
  authorityVerified = false,
  caseId = 'CASE-8A-001',
} = {}) {
  return {
    schemaVersion: 1,
    factId: id,
    caseId,
    documentId: `DOC-${id}`,
    documentHashSha256: hashChar.repeat(64),
    documentType: 'TITLE_DEED',
    authorityClass: 'OFFICIAL_PRIMARY',
    authorityVerified,
    key,
    rawValue: String(value),
    normalizedValue: value,
    valueType: 'NUMBER',
    unit,
    sourceLocator: { kind: 'PAGE', page: 1 },
    extraction: { method: 'STRUCTURED_PARSE', confidence: 0.98 },
    materiality: 'MATERIAL',
    truthStatus: verified ? TRUTH_STATUS.VERIFIED_FACT : TRUTH_STATUS.EXTRACTED_EVIDENCE,
    verification: verified
      ? { status: VERIFICATION_STATUS.VERIFIED, method: 'HUMAN_SOURCE_CHECK', verifierType: 'VALUATION_ANALYST', reference: `VERIFY-${id}`, verifiedAt: '2026-09-07T09:03:00.000Z' }
      : { status: VERIFICATION_STATUS.NOT_VERIFIED, method: null, verifierType: null, reference: null, verifiedAt: null },
    capturedAt: CAPTURED_AT,
  };
}

function chainFor(fact, sourceRole = EVIDENCE_SOURCE_ROLE.TITLE_DEED, sensitivityClass = EVIDENCE_SENSITIVITY_CLASS.MATERIAL) {
  return createProfessionalEvidenceChainRecord({
    recordId: `CHAIN-${fact.factId}`,
    fact,
    sourceRole,
    sourceReference: `SOURCE-${fact.factId}`,
    evidenceLink: `evidence://${fact.documentId}/page/1`,
    extractor: { type: EXTRACTOR_TYPE.SYSTEM, name: 'STARTAK_DOCUMENT_PIPELINE', version: '8A.1' },
    capturedByRef: 'SYSTEM:document-intelligence',
    sensitivityClass,
    createdAt: CAPTURED_AT,
  });
}

function approve(record) {
  return recordProfessionalEvidenceReview({
    record,
    review: {
      reviewId: `REVIEW-${record.recordId}`,
      outcome: PROFESSIONAL_REVIEW_OUTCOME.APPROVED,
      reviewedByRef: 'USER:licensed-reviewer-placeholder',
      reviewEvidenceRef: `review-evidence://${record.recordId}`,
      reviewedAt: REVIEWED_AT,
      acknowledgements: {
        sourceViewed: true,
        locatorChecked: true,
        semanticMappingChecked: true,
        documentHashChecked: true,
        accountabilityAccepted: true,
      },
    },
  });
}

const extracted = makeFact({ id: 'F1' });
const extractedChain = chainFor(extracted);
check(extractedChain.caseId === 'CASE-8A-001', 'chain preserves case isolation key');
check(/^[a-f0-9]{64}$/.test(extractedChain.chainHashSha256), 'chain hash is SHA-256');
check(validateProfessionalEvidenceChainIntegrity(extractedChain) === true, 'fresh chain integrity passes');

const analysis = assessProfessionalEvidenceAdmissibility({ record: extractedChain, target: ADMISSIBILITY_TARGET.ANALYSIS_ONLY });
check(analysis.status === ADMISSIBILITY_STATUS.READY_WITH_LIMITATIONS, 'unverified extraction is analysis-only');
check(analysis.eligibleForEngine === false, 'analysis-only extraction never becomes engine eligible');

const extractedEngine = assessProfessionalEvidenceAdmissibility({ record: extractedChain, target: ADMISSIBILITY_TARGET.ENGINE_INPUT });
check(extractedEngine.status === ADMISSIBILITY_STATUS.HOLD_EVIDENCE, 'unverified extraction is blocked from engine');
check(extractedEngine.reasons.includes('VERIFIED_FACT_REQUIRED'), 'engine block names missing verification');
check(extractedEngine.reasons.includes('PROFESSIONAL_HUMAN_REVIEW_REQUIRED'), 'material evidence requires human review');

const verifiedNoReview = chainFor(makeFact({ id: 'F2', verified: true }));
const verifiedNoReviewResult = assessProfessionalEvidenceAdmissibility({ record: verifiedNoReview, target: ADMISSIBILITY_TARGET.ENGINE_INPUT });
check(verifiedNoReviewResult.status === ADMISSIBILITY_STATUS.HOLD_EVIDENCE, 'verified material fact still needs professional review');

const approved = approve(verifiedNoReview);
const approvedResult = assessProfessionalEvidenceAdmissibility({ record: approved, target: ADMISSIBILITY_TARGET.ENGINE_INPUT });
check(approvedResult.status === ADMISSIBILITY_STATUS.READY, 'verified + human-approved material evidence is ready');
check(approvedResult.eligibleForEngine === true, 'ready engine-target evidence is engine eligible');
check(approvedResult.transactionAuthorized === false, 'evidence readiness never authorizes a transaction');

const tampered = { ...approved, sourceReference: 'TAMPERED-SOURCE' };
check(validateProfessionalEvidenceChainIntegrity(tampered) === false, 'tampered provenance breaks chain integrity');
check(assessProfessionalEvidenceAdmissibility({ record: tampered, target: ADMISSIBILITY_TARGET.ENGINE_INPUT }).status === ADMISSIBILITY_STATUS.HOLD_INTEGRITY, 'tampered record fails closed');

const criticalNoAuthority = approve(chainFor(
  makeFact({ id: 'F3', verified: true, authorityVerified: false }),
  EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY,
  EVIDENCE_SENSITIVITY_CLASS.CRITICAL,
));
const criticalNoAuthorityResult = assessProfessionalEvidenceAdmissibility({ record: criticalNoAuthority, target: ADMISSIBILITY_TARGET.PROFESSIONAL_REPORT });
check(criticalNoAuthorityResult.reasons.includes('CRITICAL_EVIDENCE_AUTHORITY_VERIFICATION_REQUIRED'), 'critical evidence requires authority verification');

const criticalReady = approve(chainFor(
  makeFact({ id: 'F4', verified: true, authorityVerified: true }),
  EVIDENCE_SOURCE_ROLE.REAL_ESTATE_REGISTRY,
  EVIDENCE_SENSITIVITY_CLASS.CRITICAL,
));
check(assessProfessionalEvidenceAdmissibility({ record: criticalReady, target: ADMISSIBILITY_TARGET.PROFESSIONAL_REPORT }).status === ADMISSIBILITY_STATUS.READY, 'critical verified authority + review is report-ready');

const deedArea = approve(chainFor(makeFact({ id: 'F5', verified: true, authorityVerified: true, value: 1000, hashChar: 'b' }), EVIDENCE_SOURCE_ROLE.TITLE_DEED));
const inspectionArea = approve(chainFor(makeFact({ id: 'F6', verified: true, authorityVerified: true, value: 1000, hashChar: 'c' }), EVIDENCE_SOURCE_ROLE.INSPECTION));
const clearGate = evaluateMaterialPropertyDataConflicts({
  caseId: 'CASE-8A-001',
  evidenceRecords: [deedArea, inspectionArea],
  materialKeys: ['property.land_area'],
  minimumIndependentSourceRoles: 2,
});
check(clearGate.status === PROPERTY_DATA_GATE_STATUS.CLEAR, 'agreeing independent property evidence clears conflict gate');
check(clearGate.professionalValuationProgressionAllowed === true, 'clear gate allows professional workflow progression');
check(clearGate.transactionAuthorized === false, 'clear property-data gate never authorizes transaction');

const conflictInspection = approve(chainFor(makeFact({ id: 'F7', verified: true, authorityVerified: true, value: 1100, hashChar: 'd' }), EVIDENCE_SOURCE_ROLE.INSPECTION));
const conflictGate = evaluateMaterialPropertyDataConflicts({
  caseId: 'CASE-8A-001',
  evidenceRecords: [deedArea, conflictInspection],
  materialKeys: ['property.land_area'],
  minimumIndependentSourceRoles: 2,
});
check(conflictGate.status === PROPERTY_DATA_GATE_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'material disagreement emits mandatory conflict state');
check(conflictGate.professionalValuationProgressionAllowed === false, 'material conflict blocks professional valuation progression');
check(conflictGate.conflicts[0].code === 'MATERIAL_PROPERTY_DATA_CONFLICT', 'material conflict exposes canonical code');

const unitMismatch = approve(chainFor(makeFact({ id: 'F8', verified: true, authorityVerified: true, value: 1000, unit: 'sqft', hashChar: 'e' }), EVIDENCE_SOURCE_ROLE.SURVEY));
const unitGate = evaluateMaterialPropertyDataConflicts({
  caseId: 'CASE-8A-001',
  evidenceRecords: [deedArea, unitMismatch],
  materialKeys: ['property.land_area'],
});
check(unitGate.status === PROPERTY_DATA_GATE_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, 'material unit mismatch is a conflict, not silently converted');

const missingGate = evaluateMaterialPropertyDataConflicts({
  caseId: 'CASE-8A-001',
  evidenceRecords: [],
  materialKeys: ['property.land_area'],
});
check(missingGate.status === PROPERTY_DATA_GATE_STATUS.HOLD_INSUFFICIENT_EVIDENCE, 'missing material property evidence holds workflow');

let isolationThrown = false;
try {
  const foreign = chainFor(makeFact({ id: 'F9', verified: true, caseId: 'CASE-OTHER', hashChar: 'f' }));
  evaluateMaterialPropertyDataConflicts({ caseId: 'CASE-8A-001', evidenceRecords: [foreign], materialKeys: ['property.land_area'] });
} catch (error) {
  isolationThrown = String(error.message).includes('CASE_ISOLATION_VIOLATION');
}
check(isolationThrown, 'cross-case property evidence is rejected');

const routineExtracted = chainFor(makeFact({ id: 'F10', hashChar: '1' }), EVIDENCE_SOURCE_ROLE.CLIENT_PROVIDED, EVIDENCE_SENSITIVITY_CLASS.ROUTINE);
check(assessProfessionalEvidenceAdmissibility({ record: routineExtracted, target: ADMISSIBILITY_TARGET.ANALYSIS_ONLY }).status === ADMISSIBILITY_STATUS.READY_WITH_LIMITATIONS, 'routine extracted evidence can remain analysis-only with explicit limitations');

console.log(`WAVE_8A_PROFESSIONAL_EVIDENCE_CHAIN=PASS checks=${checks}`);
