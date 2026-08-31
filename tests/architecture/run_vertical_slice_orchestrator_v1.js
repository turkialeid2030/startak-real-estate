'use strict';

const assert = require('assert');
const {
  VERTICAL_SLICE_STATUS,
  buildAnalyticalVerticalSlice,
} = require('../../src/vertical-slice');
const {
  RELIABILITY_LEVEL,
  RELIABILITY_DIMENSION,
} = require('../../src/decision-quality/reliability-scorecard');
const {
  PROFESSIONAL_TYPE,
} = require('../../src/decision-quality/professional-review-matrix');

let checks = 0;
function check(fn) { fn(); checks++; }

const profile = {
  projectId: 'P-VS-1',
  traits: { incomeProducing: true },
  incomeModel: 'LEASE_INCOME',
};

const evidenceOrchestration = {
  projectId: 'P-VS-1',
  caseId: 'C-VS-1',
  readiness: { status: 'READY_FOR_UNDERWRITING_INPUT' },
  engineRoute: { financialEngineQualified: true },
};

const titleAssessment = {
  projectId: 'P-VS-1',
  caseId: 'C-VS-1',
  status: 'FACTS_SUFFICIENT_FOR_ANALYSIS',
};

const tenantAssessment = {
  projectId: 'P-VS-1',
  caseId: 'C-VS-1',
  status: 'TENANT_ANALYTICAL_FAVOURABLE',
};

const regulatoryAssessment = {
  projectId: 'P-VS-1',
  caseId: 'C-VS-1',
  overallStatus: 'PASS_INFORMATIONAL',
};

const financialResult = {
  projectId: 'P-VS-1',
  caseId: 'C-VS-1',
  verdict: 'يوصى بالشراء',
};

const reliabilityDimensions = [
  { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level: RELIABILITY_LEVEL.HIGH, rationale: 'synthetic complete evidence set', evidenceRefs: ['E-1'] },
  { dimension: RELIABILITY_DIMENSION.EVIDENCE_AUTHORITY, level: RELIABILITY_LEVEL.MODERATE, rationale: 'reference evidence only', evidenceRefs: ['E-1'] },
  { dimension: RELIABILITY_DIMENSION.CONTRADICTION_STATUS, level: RELIABILITY_LEVEL.HIGH, rationale: 'no synthetic contradiction', evidenceRefs: ['E-1'] },
  { dimension: RELIABILITY_DIMENSION.MODEL_APPLICABILITY, level: RELIABILITY_LEVEL.HIGH, rationale: 'qualified synthetic engine route' },
  { dimension: RELIABILITY_DIMENSION.ASSUMPTION_BURDEN, level: RELIABILITY_LEVEL.MODERATE, rationale: 'explicit assumptions remain' },
  { dimension: RELIABILITY_DIMENSION.REGULATORY_READINESS, level: RELIABILITY_LEVEL.MODERATE, rationale: 'informational regulatory pass only' },
  { dimension: RELIABILITY_DIMENSION.TITLE_READINESS, level: RELIABILITY_LEVEL.HIGH, rationale: 'facts sufficient for analysis' },
  { dimension: RELIABILITY_DIMENSION.TENANT_READINESS, level: RELIABILITY_LEVEL.HIGH, rationale: 'analytical tenant state' },
  { dimension: RELIABILITY_DIMENSION.PROFESSIONAL_REVIEW, level: RELIABILITY_LEVEL.HIGH, rationale: 'no synthetic review trigger' },
];

const reviewRules = [
  {
    ruleId: 'R-LEGAL-1',
    signalKey: 'titleRestriction',
    triggerValues: ['YES'],
    professionalType: PROFESSIONAL_TYPE.LEGAL,
    rationale: 'Synthetic restriction requires legal review.',
    requiredSignal: true,
  },
];

const ready = buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment,
  regulatoryAssessment,
  financialResult,
  evidenceFacts: [{ evidenceId: 'E-1', key: 'annualRent', value: 100, status: 'VERIFIED_REFERENCE' }],
  analyticalMetrics: { syntheticMetric: 1 },
  reliabilityDimensions,
  professionalReviewSignals: { titleRestriction: 'NO' },
  professionalReviewRules: reviewRules,
});

check(() => assert.strictEqual(ready.status, VERTICAL_SLICE_STATUS.ANALYTICAL_PACKAGE_READY));
check(() => assert.strictEqual(ready.controlGate.status, 'READY_FOR_ANALYTICAL_UNDERWRITING'));
check(() => assert.strictEqual(ready.professionalReview.status, 'CLEAR_ANALYTICAL'));
check(() => assert.strictEqual(ready.reliability.overallReliability, RELIABILITY_LEVEL.MODERATE));
check(() => assert.strictEqual(ready.dossier.dossierStatus, 'READY_ANALYTICAL_CASE'));
check(() => assert.strictEqual(ready.humanDecisionRequired, true));
check(() => assert.strictEqual(ready.transactionAuthorized, false));
check(() => assert.strictEqual(ready.boundaries.externalDataFetchedByThisOrchestrator, false));
check(() => assert.strictEqual(ready.boundaries.officialIntegrationUsed, false));
check(() => assert.strictEqual(ready.boundaries.certifiedValuationProduced, false));

const reviewRequired = buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment,
  regulatoryAssessment,
  financialResult,
  reliabilityDimensions,
  professionalReviewSignals: { titleRestriction: 'YES' },
  professionalReviewRules: reviewRules,
});
check(() => assert.strictEqual(reviewRequired.status, VERTICAL_SLICE_STATUS.PROFESSIONAL_REVIEW_REQUIRED));
check(() => assert.deepStrictEqual(reviewRequired.professionalReview.requiredProfessionalTypes, [PROFESSIONAL_TYPE.LEGAL]));
check(() => assert.strictEqual(reviewRequired.transactionAuthorized, false));

const noRules = buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment,
  regulatoryAssessment,
  financialResult,
  reliabilityDimensions,
});
check(() => assert.strictEqual(noRules.status, VERTICAL_SLICE_STATUS.HOLD_REVIEW_POLICY));
check(() => assert.strictEqual(noRules.dossier, null));

const noReliability = buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment,
  tenantAssessment,
  regulatoryAssessment,
  financialResult,
  professionalReviewSignals: { titleRestriction: 'NO' },
  professionalReviewRules: reviewRules,
});
check(() => assert.strictEqual(noReliability.status, VERTICAL_SLICE_STATUS.HOLD_RELIABILITY_INPUT));
check(() => assert.strictEqual(noReliability.dossier, null));

const titleHold = buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment: { ...titleAssessment, status: 'HOLD_EVIDENCE' },
  tenantAssessment,
  regulatoryAssessment,
  financialResult: null,
  reliabilityDimensions,
  professionalReviewSignals: { titleRestriction: 'NO' },
  professionalReviewRules: reviewRules,
});
check(() => assert.strictEqual(titleHold.status, VERTICAL_SLICE_STATUS.HOLD_CONTROL_GATE));
check(() => assert.strictEqual(titleHold.dossier.dossierStatus, 'HOLD_EVIDENCE_OR_POLICY'));

check(() => assert.throws(() => buildAnalyticalVerticalSlice({
  profile,
  evidenceOrchestration,
  titleAssessment: { ...titleAssessment, caseId: 'OTHER-CASE' },
  tenantAssessment,
  regulatoryAssessment,
  financialResult,
  reliabilityDimensions,
  professionalReviewSignals: { titleRestriction: 'NO' },
  professionalReviewRules: reviewRules,
}), /CASE_ISOLATION_VIOLATION:TITLE/));

console.log(`VERTICAL_SLICE_ORCHESTRATOR_V1: PASS (${checks} checks)`);
