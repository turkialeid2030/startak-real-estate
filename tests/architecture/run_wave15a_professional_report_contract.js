'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  createStandardsSnapshot,
} = require('../../src/standards');
const {
  ASSIGNMENT_STATE,
  CONFLICT_STATUS,
  COMPETENCE_STATUS,
  DATA_AVAILABILITY_STATUS,
  createProfessionalAssignment,
  transitionAssignment,
} = require('../../src/valuation-assignment');
const {
  REPORT_TYPE,
  REPORT_QA_STATUS,
  METHOD_DISPOSITION,
  UNCERTAINTY_STATUS,
  ARTIFACT_TYPE,
  TAQEEM_REPORT_QA_STATUS,
  createReportArtifactReference,
  verifyReportArtifactReference,
  createProfessionalReportContract,
  verifyProfessionalReportContract,
  assessProfessionalReportQa,
} = require('../../src/reporting');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function authorizeAssignment() {
  let a = createProfessionalAssignment({
    engagementId: 'ENG-W15A-1',
    caseId: 'CASE-W15A-1',
    clientPartyId: 'PARTY-CLIENT',
    intendedUserPartyIds: ['PARTY-CLIENT'],
    purposeCode: 'MARKET_VALUE',
    intendedUseCode: 'INTERNAL_DECISION_SUPPORT',
    jurisdiction: 'SAUDI_ARABIA',
    valuationDate: '2026-09-01',
    basisOfValueCode: 'MARKET_VALUE',
    propertyInterestIds: ['PI-OWNERSHIP'],
    valuedPropertyInterestId: 'PI-OWNERSHIP',
    scopeVersion: '1',
    assumptions: [],
    specialAssumptions: [],
    relianceRestrictions: ['CLIENT_ONLY'],
    limitations: [],
    plannedInspectionScope: ['PHYSICAL_INSPECTION_REQUIRED'],
    plannedDataScope: ['TITLE', 'PLANNING', 'MARKET'],
    reviewerPartyId: 'PARTY-REVIEWER',
    createdAt: '2026-09-07T08:00:00Z',
    createdBy: 'USER-1',
  });
  let minute = 1;
  function move(toState, gateData = {}) {
    a = transitionAssignment(a, {
      toState,
      actorId: 'USER-1',
      occurredAt: `2026-09-07T08:${String(minute++).padStart(2, '0')}:00Z`,
      reason: `W15A test ${toState}`,
      evidenceRefs: ['EVIDENCE-W15A'],
      gateData,
    });
  }
  move(ASSIGNMENT_STATE.SCOPE_REVIEW);
  move(ASSIGNMENT_STATE.CONFLICT_REVIEW);
  move(ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
  move(ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.COMPETENT });
  move(ASSIGNMENT_STATE.TERMS_REVIEW, { dataAvailabilityStatus: DATA_AVAILABILITY_STATUS.SUFFICIENT_FOR_ANALYSIS });
  move(ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS, {
    termsAcceptanceEvidenceRef: 'TERMS-W15A',
    analysisAuthorizationId: 'ANALYSIS-AUTH-W15A',
  });
  return a;
}

const assignment = authorizeAssignment();
const standardsSnapshot = createStandardsSnapshot({
  standardsSnapshotId: 'SNAP-W15A-1',
  snapshotVersion: '1',
  createdAt: '2026-09-08T00:00:00Z',
  hashFn: sha256,
  routerVersion: 'W7A_PURPOSE_ROUTER_V1',
  routerInputHash: sha256('router-input'),
  standardRefs: [],
  ruleRefs: [],
  activationApprovalRefs: [],
  valuationDate: '2026-09-01',
  reportDate: '2026-09-08',
  engagementDate: '2026-09-07',
});

function ref(referenceId, artifactType, seed = referenceId, overrides = {}) {
  return createReportArtifactReference({
    referenceId,
    artifactType,
    artifactId: `ART-${referenceId}`,
    artifactHashSha256: sha256(seed),
    caseId: 'CASE-W15A-1',
    propertyRef: 'PROPERTY-W15A-1',
    asOfDate: '2026-09-01',
    evidenceRefs: [`EVIDENCE-${referenceId}`],
    ...overrides,
  });
}

const propertyEvidence = ref('REF-PROPERTY', ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET);
const inspection = ref('REF-INSPECTION', ARTIFACT_TYPE.INSPECTION_PACKET);
const measurement = ref('REF-MEASUREMENT', ARTIFACT_TYPE.MEASUREMENT_PACKET);
const dcfResult = ref('REF-DCF', ARTIFACT_TYPE.DCF_RESULT);

function baseInput(overrides = {}) {
  return {
    reportId: 'REPORT-W15A-1',
    reportVersion: '1',
    reportType: REPORT_TYPE.PROFESSIONAL_VALUATION_DRAFT,
    caseId: 'CASE-W15A-1',
    propertyRef: 'PROPERTY-W15A-1',
    reportDate: '2026-09-08',
    assignment,
    standardsSnapshot,
    standardsHashFn: sha256,
    artifactReferences: [propertyEvidence, inspection, measurement, dcfResult],
    requiredArtifactTypes: [
      ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET,
      ARTIFACT_TYPE.INSPECTION_PACKET,
      ARTIFACT_TYPE.MEASUREMENT_PACKET,
    ],
    methodAssessments: [{
      methodCode: 'DISCOUNTED_CASH_FLOW',
      disposition: METHOD_DISPOSITION.USED,
      rationale: 'Qualified DCF indication selected for report drafting.',
      resultReferenceId: dcfResult.referenceId,
    }],
    assumptions: [],
    specialAssumptions: [],
    limitations: ['Internal draft; external issuance is not authorized.'],
    uncertaintyDisclosure: {
      status: UNCERTAINTY_STATUS.NONE_IDENTIFIED,
      rationale: 'No separate material uncertainty conclusion recorded in this synthetic fixture.',
      evidenceRefs: ['UNCERTAINTY-REVIEW-W15A'],
    },
    preparer: { partyId: 'PARTY-PREPARER', role: 'PREPARER', credentialRef: 'CREDENTIAL-UNVERIFIED-1' },
    reviewer: { partyId: 'PARTY-REVIEWER', role: 'REVIEWER', credentialRef: 'CREDENTIAL-UNVERIFIED-2' },
    createdAt: '2026-09-08T00:10:00Z',
    ...overrides,
  };
}

check(() => assert.strictEqual(assignment.assignmentState, ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS));
check(() => assert.strictEqual(standardsSnapshot.standardRefs.length, 0));
check(() => assert.strictEqual(verifyReportArtifactReference(propertyEvidence).valid, true));
check(() => assert.ok(Object.isFrozen(propertyEvidence)));

const report = createProfessionalReportContract(baseInput());
check(() => assert.strictEqual(report.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));
check(() => assert.deepStrictEqual(report.criticalGaps, []));
check(() => assert.strictEqual(report.reportType, REPORT_TYPE.PROFESSIONAL_VALUATION_DRAFT));
check(() => assert.strictEqual(report.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(report.taqeemReportQaStatus, TAQEEM_REPORT_QA_STATUS));
check(() => assert.strictEqual(report.taqeemConformanceClaimEstablished, false));
check(() => assert.strictEqual(report.ivsConformanceClaimEstablished, false));
check(() => assert.strictEqual(report.ricsConformanceClaimEstablished, false));
check(() => assert.strictEqual(report.credentialValidationPerformed, false));
check(() => assert.strictEqual(report.professionalReviewerApprovalEstablished, false));
check(() => assert.strictEqual(report.professionalValuationAuthorized, false));
check(() => assert.strictEqual(report.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(report.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(report.legalOpinionEstablished, false));
check(() => assert.strictEqual(report.transactionAuthorized, false));
check(() => assert.strictEqual(report.canonicalValuationArithmeticPerformed, false));
check(() => assert.strictEqual(report.aiGeneratedProfessionalConclusion, false));
check(() => assert.strictEqual(report.standardsSnapshotHash, standardsSnapshot.snapshotHash));
check(() => assert.strictEqual(report.methodAssessments[0].resultReferenceId, 'REF-DCF'));
check(() => assert.strictEqual(verifyProfessionalReportContract(report).valid, true));
check(() => assert.ok(Object.isFrozen(report)));

const qa = assessProfessionalReportQa(report);
check(() => assert.strictEqual(qa.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));
check(() => assert.deepStrictEqual(qa.blockingCodes, []));
check(() => assert.strictEqual(qa.professionalReviewRequired, true));
check(() => assert.strictEqual(qa.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(qa.transactionAuthorized, false));

const missingInspection = createProfessionalReportContract(baseInput({
  artifactReferences: [propertyEvidence, measurement, dcfResult],
}));
check(() => assert.strictEqual(missingInspection.qaStatus, REPORT_QA_STATUS.REPORT_BLOCKED));
check(() => assert.ok(missingInspection.criticalGaps.includes('MISSING_REQUIRED_ARTIFACT:INSPECTION_PACKET')));

const noMethods = createProfessionalReportContract(baseInput({ methodAssessments: [] }));
check(() => assert.ok(noMethods.criticalGaps.includes('METHODS_CONSIDERED_REQUIRED')));
check(() => assert.ok(noMethods.criticalGaps.includes('AT_LEAST_ONE_USED_METHOD_REQUIRED')));
check(() => assert.strictEqual(noMethods.qaStatus, REPORT_QA_STATUS.REPORT_BLOCKED));

const noUncertainty = createProfessionalReportContract(baseInput({ uncertaintyDisclosure: null }));
check(() => assert.ok(noUncertainty.criticalGaps.includes('UNCERTAINTY_DISCLOSURE_REQUIRED')));
const noPreparer = createProfessionalReportContract(baseInput({ preparer: null }));
check(() => assert.ok(noPreparer.criticalGaps.includes('PREPARER_REQUIRED')));
const noReviewer = createProfessionalReportContract(baseInput({ reviewer: null }));
check(() => assert.ok(noReviewer.criticalGaps.includes('REVIEWER_REQUIRED')));

const financialReportingDraft = createProfessionalReportContract(baseInput({
  reportType: REPORT_TYPE.FINANCIAL_REPORTING_HANDOFF,
}));
check(() => assert.ok(financialReportingDraft.criticalGaps.includes('FINANCIAL_REPORTING_DISCLOSURE_PACKET_REQUIRED')));
const disclosure = ref('REF-FR-DISCLOSURE', ARTIFACT_TYPE.FINANCIAL_REPORTING_DISCLOSURE_PACKET);
const financialReportingReady = createProfessionalReportContract(baseInput({
  reportType: REPORT_TYPE.FINANCIAL_REPORTING_HANDOFF,
  artifactReferences: [propertyEvidence, inspection, measurement, dcfResult, disclosure],
}));
check(() => assert.strictEqual(financialReportingReady.qaStatus, REPORT_QA_STATUS.READY_FOR_INTERNAL_QA));

check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    artifactReferences: [propertyEvidence, inspection, measurement, dcfResult, propertyEvidence],
  })),
  /DUPLICATE_REPORT_ARTIFACT_REFERENCE/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    artifactReferences: [propertyEvidence, inspection, measurement, ref('REF-CROSS', ARTIFACT_TYPE.DCF_RESULT, 'x', { caseId: 'OTHER-CASE' })],
    methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'x', resultReferenceId: 'REF-CROSS' }],
  })),
  /REPORT_ARTIFACT_SCOPE_MISMATCH/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'Use DCF', resultReferenceId: 'UNKNOWN' }],
  })),
  /UNKNOWN_METHOD_RESULT_REFERENCE/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'Use DCF' }],
  })),
  /USED method requires resultReferenceId/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.NOT_USED, rationale: 'Not used', resultReferenceId: 'REF-DCF' }],
  })),
  /NOT_USED method cannot carry resultReferenceId/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({
    methodAssessments: [
      { methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'Use', resultReferenceId: 'REF-DCF' },
      { methodCode: 'DCF', disposition: METHOD_DISPOSITION.NOT_USED, rationale: 'Duplicate method' },
    ],
  })),
  /DUPLICATE_METHOD_ASSESSMENT/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ uncertaintyDisclosure: { status: 'AUTO_GUESS', rationale: 'invalid' } })),
  /uncertainty.status is invalid/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ reportDate: '2026-08-31' })),
  /REPORT_DATE_BEFORE_VALUATION_DATE/,
));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ assignment: createProfessionalAssignment({
    engagementId: 'ENG-DRAFT', caseId: 'CASE-W15A-1', clientPartyId: 'CLIENT', intendedUserPartyIds: ['CLIENT'],
    purposeCode: 'MARKET_VALUE', intendedUseCode: 'INTERNAL_DECISION_SUPPORT', jurisdiction: 'SAUDI_ARABIA',
    valuationDate: '2026-09-01', basisOfValueCode: 'MARKET_VALUE', propertyInterestIds: ['PI'], valuedPropertyInterestId: 'PI',
    scopeVersion: '1', assumptions: [], specialAssumptions: [], relianceRestrictions: [], limitations: [],
    plannedInspectionScope: ['PHYSICAL_INSPECTION_REQUIRED'], plannedDataScope: ['TITLE'], reviewerPartyId: 'REVIEWER', createdBy: 'USER',
  }) })),
  /REPORT_ASSIGNMENT_NOT_AUTHORIZED_FOR_ANALYSIS/,
));

const badSnapshot = { ...standardsSnapshot, routerVersion: 'TAMPERED' };
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ standardsSnapshot: badSnapshot })),
  /REPORT_STANDARDS_SNAPSHOT_INTEGRITY_FAILURE/,
));
const wrongDateSnapshot = createStandardsSnapshot({
  standardsSnapshotId: 'SNAP-WRONG-DATE', snapshotVersion: '1', createdAt: '2026-09-08T00:00:00Z', hashFn: sha256,
  routerVersion: 'W7A_PURPOSE_ROUTER_V1', routerInputHash: sha256('x'), standardRefs: [], ruleRefs: [], activationApprovalRefs: [],
  valuationDate: '2026-08-31', reportDate: '2026-09-08', engagementDate: '2026-09-07',
});
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ standardsSnapshot: wrongDateSnapshot })),
  /REPORT_STANDARDS_SNAPSHOT_VALUATION_DATE_MISMATCH/,
));

const tamperedRef = { ...dcfResult, artifactId: 'TAMPERED' };
check(() => assert.strictEqual(verifyReportArtifactReference(tamperedRef).valid, false));
check(() => assert.throws(
  () => createProfessionalReportContract(baseInput({ artifactReferences: [propertyEvidence, inspection, measurement, tamperedRef] })),
  /REPORT_ARTIFACT_REFERENCE_INTEGRITY_FAILURE/,
));
check(() => assert.throws(
  () => createReportArtifactReference({
    referenceId: 'BAD-SHA', artifactType: ARTIFACT_TYPE.OTHER, artifactId: 'A', artifactHashSha256: 'abc',
    caseId: 'CASE-W15A-1', propertyRef: 'PROPERTY-W15A-1', asOfDate: '2026-09-01',
  }),
  /64-character SHA-256/,
));

const tamperedReport = { ...report, reportDate: '2026-09-09' };
check(() => assert.strictEqual(verifyProfessionalReportContract(tamperedReport).valid, false));
const tamperedQa = assessProfessionalReportQa(tamperedReport);
check(() => assert.strictEqual(tamperedQa.qaStatus, REPORT_QA_STATUS.REPORT_BLOCKED));
check(() => assert.deepStrictEqual(tamperedQa.blockingCodes, ['REPORT_INTEGRITY_FAILURE']));
check(() => assert.strictEqual(tamperedQa.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(tamperedQa.transactionAuthorized, false));

console.log(`WAVE_15A_PROFESSIONAL_REPORT_CONTRACT=PASS checks=${checks}`);
