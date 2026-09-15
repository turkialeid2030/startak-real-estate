'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  STANDARD_STATUS,
  AUTHORITY_LEVEL,
  ENFORCEMENT_CLASS,
  APPLICABILITY_DATE_BASIS,
  REVIEW_STATUS,
  createStandardsSnapshot,
  routeStandards,
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
  METHOD_DISPOSITION,
  UNCERTAINTY_STATUS,
  ARTIFACT_TYPE,
  createReportArtifactReference,
  createProfessionalReportContract,
  REVIEW_LEVEL,
  REVIEW_DECISION,
  createProfessionalReviewSession,
  concludeProfessionalReview,
  REPORT_CONFORMANCE_QA_STATUS,
  OFFICIAL_CONFORMANCE_CLAIM_STATUS,
  createReportSectionTrace,
  verifyReportSectionTrace,
  deriveReportingRuleIds,
  assessReportStandardsConformance,
  verifyReportStandardsConformanceAssessment,
} = require('../../src/reporting');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function authorizeAssignment() {
  let a = createProfessionalAssignment({
    engagementId: 'ENG-W15C', caseId: 'CASE-W15C', clientPartyId: 'CLIENT', intendedUserPartyIds: ['CLIENT'],
    purposeCode: 'MARKET_VALUE', intendedUseCode: 'INTERNAL_DECISION_SUPPORT', jurisdiction: 'SAUDI_ARABIA',
    valuationDate: '2026-09-01', basisOfValueCode: 'MARKET_VALUE', propertyInterestIds: ['PI-OWN'], valuedPropertyInterestId: 'PI-OWN',
    scopeVersion: '1', assumptions: [], specialAssumptions: [], relianceRestrictions: ['CLIENT_ONLY'], limitations: [],
    plannedInspectionScope: ['PHYSICAL_INSPECTION_REQUIRED'], plannedDataScope: ['TITLE', 'MARKET'], reviewerPartyId: 'REVIEWER', createdBy: 'USER',
  });
  let minute = 1;
  function move(toState, gateData = {}) {
    a = transitionAssignment(a, {
      toState, actorId: 'USER', occurredAt: `2026-09-07T09:${String(minute++).padStart(2, '0')}:00Z`,
      reason: `W15C ${toState}`, evidenceRefs: ['EVIDENCE'], gateData,
    });
  }
  move(ASSIGNMENT_STATE.SCOPE_REVIEW);
  move(ASSIGNMENT_STATE.CONFLICT_REVIEW);
  move(ASSIGNMENT_STATE.COMPETENCE_REVIEW, { conflictStatus: CONFLICT_STATUS.CLEAR });
  move(ASSIGNMENT_STATE.DATA_AVAILABILITY_REVIEW, { competenceStatus: COMPETENCE_STATUS.COMPETENT });
  move(ASSIGNMENT_STATE.TERMS_REVIEW, { dataAvailabilityStatus: DATA_AVAILABILITY_STATUS.SUFFICIENT_FOR_ANALYSIS });
  move(ASSIGNMENT_STATE.AUTHORIZED_FOR_ANALYSIS, { termsAcceptanceEvidenceRef: 'TERMS', analysisAuthorizationId: 'AUTH' });
  return a;
}

const standard = {
  standardId: 'STD-W15C', titleAr: 'معيار اختباري', titleEn: 'Synthetic reporting standard', issuer: 'TEST',
  jurisdiction: 'SAUDI_ARABIA', category: 'VALUATION', version: '1', publicationDate: '2026-01-01', effectiveDate: '2026-01-01', expiryDate: null,
  status: STANDARD_STATUS.ACTIVE, sourceUrl: 'https://example.invalid/official', officialSource: true, lastVerifiedAt: '2026-09-08', nextReviewAt: '2026-12-01',
  supersedesStandardIds: [], supersededByStandardIds: [], applicableAssetTypes: ['OFFICE'], applicablePurposes: ['MARKET_VALUE'],
  authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL, guidanceOrMandatory: 'MANDATORY', ruleVersionHash: 'rulehash',
  professionalReviewStatus: REVIEW_STATUS.APPROVED, legalReviewStatus: REVIEW_STATUS.NOT_REQUIRED,
};

const reportingRule = {
  ruleId: 'RULE-W15C-REPORT', standardId: 'STD-W15C', provisionReference: 'R1', ruleTitle: 'Report disclosure', ruleType: 'REPORTING',
  authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL, enforcementClass: ENFORCEMENT_CLASS.REPORTING_RULE,
  jurisdiction: 'SAUDI_ARABIA', appliesWhen: {}, excludesWhen: {}, purposeScope: ['MARKET_VALUE'], assetScope: ['OFFICE'],
  regulatedEntityScope: [], transactionScope: [], financingScope: [], applicabilityDateBasis: APPLICABILITY_DATE_BASIS.REPORT_DATE,
  effectiveFrom: '2026-01-01', effectiveTo: null, severity: 'CRITICAL', requiredInputs: [], validationExpression: null, calculationEffect: null,
  reportingEffect: 'DISCLOSE_BASIS_AND_SCOPE', blockingEffect: null, implementationVersion: 'W15C-1', testIds: ['T-W15C'], evidenceIds: ['E-W15C'],
  reviewStatus: REVIEW_STATUS.APPROVED, activationApprovalId: 'ACT-W15C',
};

const calcRule = {
  ...reportingRule,
  ruleId: 'RULE-W15C-CALC',
  provisionReference: 'R2',
  ruleTitle: 'Calculation-only rule',
  ruleType: 'CALCULATION',
  enforcementClass: ENFORCEMENT_CLASS.CALCULATION_RULE,
  reportingEffect: null,
};

const routerInputHash = sha256('router-w15c');
const route = routeStandards({
  context: {
    jurisdiction: 'SAUDI_ARABIA', valuationPurpose: 'MARKET_VALUE', assetType: 'OFFICE', regulatedEntityStatus: 'UNREGULATED',
    transactionContext: 'NONE', financingContext: 'NONE', engagementDate: '2026-09-07', valuationDate: '2026-09-01', reportDate: '2026-09-08',
  },
  standards: [standard], rules: [reportingRule, calcRule], routerInputHash,
});

const snapshot = createStandardsSnapshot({
  standardsSnapshotId: 'SNAP-W15C', snapshotVersion: '1', createdAt: '2026-09-08T01:00:00Z', hashFn: sha256,
  routerVersion: route.routerVersion, routerInputHash,
  standardRefs: [{ standardId: standard.standardId, version: standard.version, status: standard.status, ruleVersionHash: standard.ruleVersionHash }],
  ruleRefs: [{ ruleId: reportingRule.ruleId, implementationVersion: reportingRule.implementationVersion }, { ruleId: calcRule.ruleId, implementationVersion: calcRule.implementationVersion }],
  activationApprovalRefs: ['ACT-W15C'], valuationDate: '2026-09-01', reportDate: '2026-09-08', engagementDate: '2026-09-07',
});

const assignment = authorizeAssignment();
function ref(id, type) {
  return createReportArtifactReference({
    referenceId: id, artifactType: type, artifactId: `ART-${id}`, artifactHashSha256: sha256(id),
    caseId: 'CASE-W15C', propertyRef: 'PROPERTY-W15C', asOfDate: '2026-09-01', evidenceRefs: [`E-${id}`],
  });
}
const propertyRef = ref('REF-PROPERTY', ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET);
const inspectionRef = ref('REF-INSPECTION', ARTIFACT_TYPE.INSPECTION_PACKET);
const resultRef = ref('REF-DCF', ARTIFACT_TYPE.DCF_RESULT);
const report = createProfessionalReportContract({
  reportId: 'REPORT-W15C', reportVersion: '1', reportType: REPORT_TYPE.PROFESSIONAL_VALUATION_DRAFT,
  caseId: 'CASE-W15C', propertyRef: 'PROPERTY-W15C', reportDate: '2026-09-08', assignment,
  standardsSnapshot: snapshot, standardsHashFn: sha256,
  artifactReferences: [propertyRef, inspectionRef, resultRef], requiredArtifactTypes: [ARTIFACT_TYPE.PROPERTY_EVIDENCE_PACKET, ARTIFACT_TYPE.INSPECTION_PACKET],
  methodAssessments: [{ methodCode: 'DCF', disposition: METHOD_DISPOSITION.USED, rationale: 'Synthetic reviewed DCF.', resultReferenceId: 'REF-DCF' }],
  assumptions: [], specialAssumptions: [], limitations: ['Internal draft only.'],
  uncertaintyDisclosure: { status: UNCERTAINTY_STATUS.NONE_IDENTIFIED, rationale: 'Synthetic fixture.', evidenceRefs: ['E-UNCERTAINTY'] },
  preparer: { partyId: 'PREPARER', role: 'PREPARER', credentialRef: 'UNVERIFIED-CRED-1' },
  reviewer: { partyId: 'REVIEWER', role: 'REVIEWER', credentialRef: 'UNVERIFIED-CRED-2' },
  createdAt: '2026-09-08T01:10:00Z',
});
let review = createProfessionalReviewSession({
  reviewId: 'REVIEW-W15C', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER', role: 'PROFESSIONAL_REVIEWER', credentialRef: 'UNVERIFIED-CRED-2' }, findings: [], startedAt: '2026-09-08T01:20:00Z',
});
review = concludeProfessionalReview({
  session: review, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE, decidedBy: 'REVIEWER',
  rationale: 'Synthetic report review completed for controlled QA.', evidenceRefs: ['E-REVIEW'], decidedAt: '2026-09-08T01:30:00Z',
});

const sectionTrace = createReportSectionTrace({
  traceId: 'TRACE-W15C-1', reportId: report.reportId, reportHashSha256: report.reportHashSha256,
  caseId: report.caseId, propertyRef: report.propertyRef, sectionCode: 'BASIS_SCOPE', sectionTitle: 'Basis and scope',
  sectionContentHashSha256: sha256('section-content'), artifactReferenceIds: ['REF-PROPERTY'], ruleIds: ['RULE-W15C-REPORT'],
  evidenceRefs: ['E-SECTION'], preparedBy: 'PREPARER', preparedAt: '2026-09-08T01:15:00Z',
});

check(() => assert.deepStrictEqual(route.blockingCodes, []));
check(() => assert.deepStrictEqual(route.requiredReviews, []));
check(() => assert.ok(route.applicableRuleIds.includes('RULE-W15C-REPORT')));
check(() => assert.ok(route.applicableRuleIds.includes('RULE-W15C-CALC')));
check(() => assert.strictEqual(verifyReportSectionTrace(sectionTrace).valid, true));
check(() => assert.ok(Object.isFrozen(sectionTrace)));
const derived = deriveReportingRuleIds([reportingRule, calcRule], route);
check(() => assert.deepStrictEqual(derived.requiredReportingRuleIds, ['RULE-W15C-REPORT']));
check(() => assert.deepStrictEqual(derived.missingRuleDefinitions, []));

function assess(overrides = {}) {
  return assessReportStandardsConformance({
    assessmentId: 'ASSESS-W15C', report, reviewSession: review, standardsSnapshot: snapshot, standardsHashFn: sha256,
    routeResult: route, rules: [reportingRule, calcRule], sectionTraces: [sectionTrace], assessedAt: '2026-09-08T01:40:00Z', ...overrides,
  });
}

const ready = assess();
check(() => assert.strictEqual(ready.qaStatus, REPORT_CONFORMANCE_QA_STATUS.READY_FOR_OFFICIAL_STANDARDS_REVIEW));
check(() => assert.deepStrictEqual(ready.blockingCodes, []));
check(() => assert.strictEqual(ready.formalConformanceEstablished, false));
check(() => assert.strictEqual(ready.officialConformanceClaimStatus, OFFICIAL_CONFORMANCE_CLAIM_STATUS));
check(() => assert.strictEqual(ready.taqeemConformanceClaimEstablished, false));
check(() => assert.strictEqual(ready.ivsConformanceClaimEstablished, false));
check(() => assert.strictEqual(ready.ricsConformanceClaimEstablished, false));
check(() => assert.strictEqual(ready.professionalCredentialValidated, false));
check(() => assert.strictEqual(ready.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(ready.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(ready.legalOpinionEstablished, false));
check(() => assert.strictEqual(ready.transactionAuthorized, false));
check(() => assert.strictEqual(ready.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.deepStrictEqual(ready.ruleCoverage, [{ ruleId: 'RULE-W15C-REPORT', traceIds: ['TRACE-W15C-1'] }]));
check(() => assert.strictEqual(verifyReportStandardsConformanceAssessment(ready).valid, true));
check(() => assert.ok(Object.isFrozen(ready)));

const noTrace = assess({ sectionTraces: [] });
check(() => assert.strictEqual(noTrace.qaStatus, REPORT_CONFORMANCE_QA_STATUS.BLOCKED));
check(() => assert.ok(noTrace.blockingCodes.includes('REPORTING_RULE_SECTION_COVERAGE_MISSING:RULE-W15C-REPORT')));
const unknownArtifactTrace = createReportSectionTrace({ ...sectionTrace, traceId: 'TRACE-UNKNOWN-ART', artifactReferenceIds: ['NO-SUCH-REF'] });
check(() => assert.ok(assess({ sectionTraces: [unknownArtifactTrace] }).blockingCodes.some((c) => c.includes('SECTION_TRACE_UNKNOWN_ARTIFACT'))));
const wrongScopeTrace = createReportSectionTrace({ ...sectionTrace, traceId: 'TRACE-WRONG-SCOPE', caseId: 'OTHER-CASE' });
check(() => assert.ok(assess({ sectionTraces: [wrongScopeTrace] }).blockingCodes.some((c) => c.includes('SECTION_TRACE_SCOPE_MISMATCH'))));
const tamperedTrace = { ...sectionTrace, sectionTitle: 'Tampered' };
check(() => assert.strictEqual(verifyReportSectionTrace(tamperedTrace).valid, false));
check(() => assert.ok(assess({ sectionTraces: [tamperedTrace] }).blockingCodes.some((c) => c.includes('SECTION_TRACE_INTEGRITY_FAILURE'))));
const duplicateTrace = createReportSectionTrace({ ...sectionTrace, traceId: sectionTrace.traceId, sectionCode: 'DUP', sectionContentHashSha256: sha256('dup') });
check(() => assert.ok(assess({ sectionTraces: [sectionTrace, duplicateTrace] }).blockingCodes.includes('DUPLICATE_SECTION_TRACE:TRACE-W15C-1')));
const calcTrace = createReportSectionTrace({ ...sectionTrace, traceId: 'TRACE-CALC', ruleIds: ['RULE-W15C-CALC'], sectionContentHashSha256: sha256('calc') });
check(() => assert.ok(assess({ sectionTraces: [sectionTrace, calcTrace] }).blockingCodes.some((c) => c.includes('SECTION_TRACE_RULE_NOT_REPORTING_RELEVANT'))));

const missingRule = assess({ rules: [calcRule] });
check(() => assert.ok(missingRule.blockingCodes.includes('APPLICABLE_RULE_DEFINITION_MISSING:RULE-W15C-REPORT')));
const noReportingRoute = { ...route, applicableRuleIds: ['RULE-W15C-CALC'] };
const noReporting = assess({ routeResult: noReportingRoute, sectionTraces: [], rules: [calcRule] });
check(() => assert.ok(noReporting.blockingCodes.includes('NO_ACTIVE_REPORTING_RULES_TO_ASSESS')));
const routeBlocked = assess({ routeResult: { ...route, blockingCodes: ['STANDARD_RULESET_CONFLICT'] } });
check(() => assert.ok(routeBlocked.blockingCodes.includes('ROUTER_BLOCKER:STANDARD_RULESET_CONFLICT')));
const routeReview = assess({ routeResult: { ...route, requiredReviews: ['LEGAL_OR_PROFESSIONAL_STANDARDS_REVIEW'] } });
check(() => assert.ok(routeReview.blockingCodes.includes('ROUTER_REVIEW_REQUIRED:LEGAL_OR_PROFESSIONAL_STANDARDS_REVIEW')));
const wrongRouter = assess({ routeResult: { ...route, routerVersion: 'WRONG' } });
check(() => assert.ok(wrongRouter.blockingCodes.includes('ROUTER_VERSION_MISMATCH')));
const wrongRouterHash = assess({ routeResult: { ...route, routerInputHash: sha256('wrong') } });
check(() => assert.ok(wrongRouterHash.blockingCodes.includes('ROUTER_INPUT_HASH_MISMATCH')));

const internalReview = createProfessionalReviewSession({
  reviewId: 'REVIEW-INTERNAL', reviewLevel: REVIEW_LEVEL.INTERNAL_QA, report,
  reviewer: { partyId: 'REVIEWER', role: 'INTERNAL_QA' }, findings: [], startedAt: '2026-09-08T01:20:00Z',
});
const internalApproved = concludeProfessionalReview({
  session: internalReview, decision: REVIEW_DECISION.APPROVE_NEXT_CONTROLLED_GATE, decidedBy: 'REVIEWER',
  rationale: 'Internal only.', evidenceRefs: [], decidedAt: '2026-09-08T01:30:00Z',
});
check(() => assert.ok(assess({ reviewSession: internalApproved }).blockingCodes.includes('PROFESSIONAL_OR_INDEPENDENT_REVIEW_REQUIRED')));
const heldReview = createProfessionalReviewSession({
  reviewId: 'REVIEW-HELD', reviewLevel: REVIEW_LEVEL.PROFESSIONAL_REVIEW, report,
  reviewer: { partyId: 'REVIEWER', role: 'PROFESSIONAL_REVIEWER' }, findings: [], startedAt: '2026-09-08T01:20:00Z',
});
check(() => assert.ok(assess({ reviewSession: heldReview }).blockingCodes.includes('PROFESSIONAL_REVIEW_NOT_APPROVED')));
const tamperedReview = { ...review, reviewer: { ...review.reviewer, partyId: 'TAMPERED' } };
check(() => assert.ok(assess({ reviewSession: tamperedReview }).blockingCodes.includes('REVIEW_SESSION_INTEGRITY_FAILURE')));
const tamperedReport = { ...report, reportVersion: '2' };
check(() => assert.ok(assess({ report: tamperedReport }).blockingCodes.includes('REPORT_INTEGRITY_FAILURE')));
const badSnapshot = { ...snapshot, reportDate: '2026-09-09' };
check(() => assert.ok(assess({ standardsSnapshot: badSnapshot }).blockingCodes.includes('STANDARDS_SNAPSHOT_INTEGRITY_FAILURE')));

check(() => assert.throws(
  () => createReportSectionTrace({ ...sectionTrace, traceId: 'TRACE-NA', status: 'NOT_APPLICABLE', ruleIds: ['RULE-W15C-REPORT'] }),
  /NOT_APPLICABLE_SECTION_CANNOT_COVER_RULES/,
));
check(() => assert.throws(
  () => createReportSectionTrace({ ...sectionTrace, traceId: 'TRACE-BAD-HASH', sectionContentHashSha256: 'abc' }),
  /64-character SHA-256/,
));

console.log(`WAVE_15C_REPORT_CONFORMANCE_QA=PASS checks=${checks}`);
