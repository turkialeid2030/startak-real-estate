'use strict';

const assert = require('assert');
const {
  PROPERTY_INTEREST_TYPE,
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  ASSET_LIFECYCLE_CLASSIFICATION,
  LOCATION_FACTOR_HORIZON,
  LOCATION_FACTOR_DIMENSION,
  UPSIDE_CATALYST_TYPE,
  UPSIDE_CATALYST_STATUS,
  SUBDIVISION_CHECK_TYPE,
  SUBDIVISION_CHECK_OUTCOME,
  STRATEGIC_ASSET_INTELLIGENCE_STATUS,
  SUBDIVISION_ASSESSMENT_STATUS,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createAssetLifecycleAssessment,
  createLocationFactor,
  createUpsideCatalyst,
  createSubdivisionCheck,
  createStrategicAssetProfile,
  createResidentialIncomeOperatingCase,
  calculateStrategicAssetIntelligence,
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
} = require('../../src/residential-income-acquisition');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');

const CASE_ID = 'CASE-RIAI-STRATEGIC-1';
const PROPERTY_ID = 'PROPERTY-1';
const AS_OF = '2026-09-03';
const ADOPTION_REF = 'adoption://strategic/1';
const ASSESSMENT_REF = 'assessment://strategic/1';
const POLICY_REF = 'policy://strategic/1';
const SUBDIVISION_REF = 'review://subdivision/1';

function adopted(field, value, sourceRef, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'EXPLICIT_STRATEGIC_ASSESSMENT',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function unavailable(field) {
  return createEvidenceAwareValue({
    field,
    value: null,
    unit: null,
    evidenceType: 'DUE_DILIGENCE_NOT_AVAILABLE',
    verificationStatus: OPERATING_INPUT_STATUS.NOT_AVAILABLE,
  });
}

function factor(factorId, horizon, dimension, score, weight) {
  return createLocationFactor({
    caseId: CASE_ID,
    propertyId: PROPERTY_ID,
    factorId,
    horizon,
    dimension,
    score: adopted(`strategic.location.${factorId}.score`, score, ASSESSMENT_REF, 'score_0_100'),
    weight: adopted(`strategic.location.${factorId}.weight`, weight, POLICY_REF, 'ratio'),
  });
}

function subdivisionCheck(type, outcome = SUBDIVISION_CHECK_OUTCOME.PASS) {
  const checkId = type.toLowerCase();
  return createSubdivisionCheck({
    caseId: CASE_ID,
    propertyId: PROPERTY_ID,
    checkId,
    checkType: type,
    outcome: outcome === null
      ? unavailable(`strategic.subdivision.${checkId}.outcome`)
      : adopted(`strategic.subdivision.${checkId}.outcome`, outcome, SUBDIVISION_REF),
  });
}

function profile({ weightMismatch = false, missingCheck = null, failedCheck = null, unavailableCheck = null } = {}) {
  const checks = Object.values(SUBDIVISION_CHECK_TYPE)
    .filter((type) => type !== missingCheck)
    .map((type) => subdivisionCheck(type, type === unavailableCheck ? null : type === failedCheck ? SUBDIVISION_CHECK_OUTCOME.FAIL : SUBDIVISION_CHECK_OUTCOME.PASS));
  return createStrategicAssetProfile({
    caseId: CASE_ID,
    propertyId: PROPERTY_ID,
    lifecycleAssessment: createAssetLifecycleAssessment({
      caseId: CASE_ID,
      propertyId: PROPERTY_ID,
      classification: adopted('strategic.lifecycle.classification', ASSET_LIFECYCLE_CLASSIFICATION.STABILIZED, ASSESSMENT_REF),
    }),
    locationFactors: [
      factor('current-access', LOCATION_FACTOR_HORIZON.CURRENT, LOCATION_FACTOR_DIMENSION.ACCESSIBILITY, 80, 0.6),
      factor('current-demand', LOCATION_FACTOR_HORIZON.CURRENT, LOCATION_FACTOR_DIMENSION.CURRENT_DEMAND, 70, weightMismatch ? 0.3 : 0.4),
      factor('forward-projects', LOCATION_FACTOR_HORIZON.FORWARD, LOCATION_FACTOR_DIMENSION.FUTURE_PROJECTS, 90, 0.5),
      factor('forward-growth', LOCATION_FACTOR_HORIZON.FORWARD, LOCATION_FACTOR_DIMENSION.DEMOGRAPHIC_GROWTH, 80, 0.5),
    ],
    upsideCatalysts: [createUpsideCatalyst({
      caseId: CASE_ID,
      propertyId: PROPERTY_ID,
      catalystId: 'access-improvement',
      catalystType: UPSIDE_CATALYST_TYPE.ACCESS_IMPROVEMENT,
      assessmentStatus: adopted('strategic.catalyst.access-improvement.status', UPSIDE_CATALYST_STATUS.EVIDENCE_CONFIRMED, ASSESSMENT_REF),
      impactScore: adopted('strategic.catalyst.access-improvement.impactScore', 85, ASSESSMENT_REF, 'score_0_100'),
      executionReadinessScore: adopted('strategic.catalyst.access-improvement.executionReadinessScore', 70, ASSESSMENT_REF, 'score_0_100'),
    })],
    subdivisionChecks: checks,
  });
}

function buildCase({ strategicProfile = profile(), omitStrategicLineage = false, policyKind = LINEAGE_KIND.POLICY } = {}) {
  const propertyInterest = createPropertyInterest({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: PROPERTY_ID,
    interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
    interestEvidenceRef: 'evidence://interest/1',
    interestAdoptionDecisionRef: 'adoption://interest/1',
    titleAssessment: {
      caseId: CASE_ID,
      propertyId: PROPERTY_ID,
      status: TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS,
      blockers: [],
      legalReviewFlags: [],
    },
    titleAssessmentRef: 'assessment://title/1',
  });
  const lineages = [
    ['evidence://interest/1', LINEAGE_KIND.SOURCE_DOCUMENT],
    ['adoption://interest/1', LINEAGE_KIND.UNDERWRITING_ADOPTION],
    ['assessment://title/1', LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    [ADOPTION_REF, LINEAGE_KIND.UNDERWRITING_ADOPTION],
    [ASSESSMENT_REF, LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    [POLICY_REF, policyKind],
    [SUBDIVISION_REF, LINEAGE_KIND.LEGAL_REVIEW],
  ].filter(([ref]) => !(omitStrategicLineage && ref === ASSESSMENT_REF));
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest,
    property: createProperty({ caseId: CASE_ID, propertyId: PROPERTY_ID }),
    strategicAssetProfile: strategicProfile,
    evidenceLineage: lineages.map(([refId, kind]) => createEvidenceLineageRecord({
      caseId: CASE_ID,
      refId,
      kind,
      recordedAt: '2026-09-03T12:00:00Z',
    })),
  });
}

const complete = buildCase();
const result = calculateStrategicAssetIntelligence(complete);
assert.strictEqual(result.status, STRATEGIC_ASSET_INTELLIGENCE_STATUS.CALCULATED);
assert.strictEqual(result.strategicAssetIntelligenceCalculated, true);
assert.strictEqual(result.lifecycleClassification, ASSET_LIFECYCLE_CLASSIFICATION.STABILIZED);
assert.strictEqual(result.currentLocation.score, 76);
assert.strictEqual(result.forwardAttraction.score, 85);
assert.strictEqual(result.forwardScoreDelta, 9);
assert.strictEqual(result.upsideCatalysts.countsByStatus.EVIDENCE_CONFIRMED, 1);
assert.strictEqual(result.upsideCatalysts.financialValueCalculated, false);
assert.strictEqual(result.subdivision.status, SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING);
assert.strictEqual(result.subdivision.scenarioTestingEligible, true);
assert.strictEqual(result.financialCalculationExecuted, false);
assert.strictEqual(result.financialModelWriteAuthorized, false);
assert.strictEqual(result.investmentDecision, null);
assert.strictEqual(result.legalConclusion, null);
assert.strictEqual(result.transactionAuthorized, false);

const mismatch = calculateStrategicAssetIntelligence(buildCase({ strategicProfile: profile({ weightMismatch: true }) }));
assert.strictEqual(mismatch.status, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_CALCULABLE);
assert.ok(mismatch.issues.some((item) => item.code === 'LOCATION_FACTOR_WEIGHTS_MUST_SUM_TO_ONE'));

const invalidWeightPolicy = calculateStrategicAssetIntelligence(buildCase({ policyKind: LINEAGE_KIND.EVIDENCE_FACT }));
assert.strictEqual(invalidWeightPolicy.status, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_CALCULABLE);
assert.ok(invalidWeightPolicy.issues.some((item) => item.code === 'LOCATION_FACTOR_WEIGHT_POLICY_REQUIRED'));

const missingCheck = calculateStrategicAssetIntelligence(buildCase({ strategicProfile: profile({ missingCheck: SUBDIVISION_CHECK_TYPE.PARKING_COMPLIANCE }) }));
assert.strictEqual(missingCheck.strategicAssetIntelligenceCalculated, true);
assert.strictEqual(missingCheck.subdivision.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert.strictEqual(missingCheck.subdivision.scenarioTestingEligible, false);
assert.ok(missingCheck.issues.some((item) => item.code === 'SUBDIVISION_CHECK_REQUIRED'));

const failedCheck = calculateStrategicAssetIntelligence(buildCase({ strategicProfile: profile({ failedCheck: SUBDIVISION_CHECK_TYPE.FIRE_LIFE_SAFETY }) }));
assert.strictEqual(failedCheck.strategicAssetIntelligenceCalculated, true);
assert.strictEqual(failedCheck.subdivision.status, SUBDIVISION_ASSESSMENT_STATUS.NOT_FEASIBLE);
assert.strictEqual(failedCheck.subdivision.failCount, 1);

const unavailableCheck = calculateStrategicAssetIntelligence(buildCase({ strategicProfile: profile({ unavailableCheck: SUBDIVISION_CHECK_TYPE.STRUCTURAL_FEASIBILITY }) }));
assert.strictEqual(unavailableCheck.strategicAssetIntelligenceCalculated, true);
assert.strictEqual(unavailableCheck.subdivision.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert.strictEqual(unavailableCheck.subdivision.unavailableCount, 1);

const missingLineage = calculateStrategicAssetIntelligence(buildCase({ omitStrategicLineage: true }));
assert.strictEqual(missingLineage.status, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_CALCULABLE);
assert.ok(missingLineage.issues.some((item) => item.code === 'STRATEGIC_EVIDENCE_LINEAGE_REFERENCE_MISSING'));

const withoutProfile = calculateStrategicAssetIntelligence(buildCase({ strategicProfile: null }));
assert.strictEqual(withoutProfile.status, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_AVAILABLE);
assert.strictEqual(withoutProfile.strategicAssetIntelligenceCalculated, false);

const view = createResidentialIncomeAcquisitionViewModel(complete);
assert.strictEqual(view.capabilityStatus, 'STRATEGIC_ASSET_INTELLIGENCE_V1');
assert.strictEqual(view.strategicAssetIntelligenceCalculated, true);
assert.strictEqual(view.strategicAssetIntelligence.currentLocation.score, 76);
assert.strictEqual(view.investmentDecision, null);

const hydrated = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(complete)));
assert.strictEqual(hydrated.strategicAssetProfile.locationFactors.length, 4);
assert.strictEqual(calculateStrategicAssetIntelligence(hydrated).forwardAttraction.score, 85);

console.log('RESIDENTIAL_INCOME_STRATEGIC_ASSET_INTELLIGENCE_V1=PASS');
console.log('LIFECYCLE_LOCATION_FORWARD_ATTRACTION=PASS');
console.log('SUBDIVISION_FAIL_CLOSED_GATE=PASS');
console.log('UPSIDE_CATALYST_NO_FINANCIAL_WRITE=PASS');
console.log('NO_AUTO_DECISION_OR_TRANSACTION_AUTHORIZATION=PASS');
