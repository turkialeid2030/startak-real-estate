'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  OPERATING_INPUT_STATUS,
  createEvidenceAwareValue,
  INTELLIGENCE_STATUS,
  FORWARD_STAGE,
  DIRECTION,
  UPSIDE_TYPE,
  REGULATORY_STATUS,
  calculateLifecycleLocationUpsideIntelligence,
  calculateAcquisitionAnalyticalScore,
  buildScenarioIntegration,
  buildInvestmentCommitteePack,
} = require('../../src/residential-income-acquisition');

const CASE_ID = 'CASE-RIAI-LLU-1';
const AS_OF = '2026-09-03';
const ADOPTION_REF = 'adoption://riai/llu/1';

function adopted(field, value, unit = null, confidence = 0.9) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef: `evidence://${field.replace(/[^a-z0-9]+/gi, '-')}`,
    evidenceType: 'RIAI_LIFECYCLE_LOCATION_UPSIDE_REGRESSION',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function unverified(field, value, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef: `evidence://${field.replace(/[^a-z0-9]+/gi, '-')}`,
    evidenceType: 'RIAI_LIFECYCLE_LOCATION_UPSIDE_REGRESSION',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.UNVERIFIED,
    confidence: 0.5,
    adoptedForUnderwriting: false,
  });
}

const inputs = [
  adopted('lifecycle.component.roof.category', 'ROOF_WATERPROOFING'),
  adopted('lifecycle.component.roof.conditionScore', 55, 'score'),
  adopted('lifecycle.component.roof.remainingUsefulLifeYears', 2, 'years'),
  adopted('lifecycle.component.roof.replacementCost', 400000, 'SAR'),
  adopted('lifecycle.component.roof.replacementYearOffset', 2, 'years'),
  adopted('lifecycle.component.roof.downtimeDays', 20, 'days'),
  adopted('lifecycle.component.roof.criticality', 'HIGH'),

  adopted('lifecycle.component.hvac.category', 'HVAC'),
  adopted('lifecycle.component.hvac.conditionScore', 80, 'score'),
  adopted('lifecycle.component.hvac.remainingUsefulLifeYears', 8, 'years'),
  adopted('lifecycle.component.hvac.replacementCost', 600000, 'SAR'),
  adopted('lifecycle.component.hvac.replacementYearOffset', 8, 'years'),
  adopted('lifecycle.component.hvac.downtimeDays', 10, 'days'),
  adopted('lifecycle.component.hvac.criticality', 'MEDIUM'),

  adopted('location.current.accessibilityScore', 90, 'score'),
  adopted('location.current.servicesScore', 80, 'score'),
  adopted('location.current.employmentAccessScore', 85, 'score'),
  adopted('location.current.marketDemandScore', 75, 'score'),
  adopted('location.current.exitLiquidityScore', 70, 'score'),
  adopted('location.current.environmentalResilienceScore', 90, 'score'),
  adopted('location.current.competitiveSupplyRiskScore', 20, 'score'),

  adopted('forward.catalyst.metro.stage', FORWARD_STAGE.OPERATIONAL),
  adopted('forward.catalyst.metro.direction', DIRECTION.POSITIVE),
  adopted('forward.catalyst.metro.impactScore', 80, 'score'),
  adopted('forward.catalyst.metro.probability', 0.8, 'ratio'),
  adopted('forward.catalyst.metro.distanceKm', 0, 'km'),
  adopted('forward.catalyst.metro.expectedCompletionYear', 2026, 'year'),
  adopted('forward.catalyst.metro.rentPressureScore', 30, 'score'),
  adopted('forward.catalyst.metro.vacancyPressureScore', -20, 'score'),
  adopted('forward.catalyst.metro.exitLiquidityImpactScore', 25, 'score'),

  adopted('upside.catalyst.split.type', UPSIDE_TYPE.SUBDIVISION),
  adopted('upside.catalyst.split.regulatoryStatus', REGULATORY_STATUS.POTENTIALLY_FEASIBLE),
  adopted('upside.catalyst.split.capex', 300000, 'SAR'),
  adopted('upside.catalyst.split.executionPeriodYears', 1, 'years'),
  adopted('upside.catalyst.split.annualNoiLossDuringExecution', 100000, 'SAR/year'),
  adopted('upside.catalyst.split.incrementalAnnualNoi', 250000, 'SAR/year'),
  adopted('upside.catalyst.split.probability', 0.9, 'ratio'),

  adopted('upside.catalyst.prohibited.type', UPSIDE_TYPE.CHANGE_OF_USE),
  adopted('upside.catalyst.prohibited.regulatoryStatus', REGULATORY_STATUS.PROHIBITED),
  adopted('upside.catalyst.prohibited.capex', 100000, 'SAR'),
  adopted('upside.catalyst.prohibited.executionPeriodYears', 1, 'years'),
  adopted('upside.catalyst.prohibited.annualNoiLossDuringExecution', 0, 'SAR/year'),
  adopted('upside.catalyst.prohibited.incrementalAnnualNoi', 500000, 'SAR/year'),
  adopted('upside.catalyst.prohibited.probability', 1, 'ratio'),
];

const operatingCase = {
  caseId: CASE_ID,
  asOfDate: AS_OF,
  propertyInterest: { interestType: 'FREEHOLD' },
  units: [{ unitId: 'U1' }],
  leases: [{ leaseId: 'L1' }],
  additionalOperatingInputs: inputs,
};

const bundle = calculateLifecycleLocationUpsideIntelligence(operatingCase);
assert.strictEqual(bundle.status, INTELLIGENCE_STATUS.CALCULATED);
assert.strictEqual(bundle.investmentDecision, null);
assert.strictEqual(bundle.legalConclusion, null);
assert.strictEqual(bundle.transactionAuthorized, false);

assert.strictEqual(bundle.lifecycle.metrics.componentCount, 2);
assert.strictEqual(bundle.lifecycle.metrics.knownReplacementCapex3y, 400000);
assert.strictEqual(bundle.lifecycle.metrics.knownReplacementCapex5y, 400000);
assert.strictEqual(bundle.lifecycle.metrics.criticalComponentsDueWithin3y, 1);
assert.ok(Math.abs(bundle.lifecycle.metrics.weightedConditionScore - 70) < 1e-9);

assert.ok(Math.abs(bundle.location.currentLocationScore - 81.75) < 1e-9);
assert.strictEqual(bundle.location.evidenceCoverage, 1);
assert.strictEqual(bundle.forwardAttraction.attractionDirection, 'POSITIVE');
assert.ok(Math.abs(bundle.forwardAttraction.forwardAttractionScore - 80) < 1e-9);
assert.strictEqual(bundle.forwardAttraction.investmentRecommendation, null);

const split = bundle.upside.catalysts.find((item) => item.catalystId === 'split');
const prohibited = bundle.upside.catalysts.find((item) => item.catalystId === 'prohibited');
assert.strictEqual(split.regulatoryStatus, REGULATORY_STATUS.POTENTIALLY_FEASIBLE);
assert.strictEqual(split.effectiveProbability, 0.5);
assert.strictEqual(split.requiresRegulatoryVerification, true);
assert.strictEqual(prohibited.prohibited, true);
assert.strictEqual(prohibited.effectiveProbability, 0);
assert.strictEqual(bundle.upside.metrics.regulatoryVerificationRequiredCount, 2);
assert.strictEqual(bundle.upside.legalConclusion, null);

const partialLocationCase = {
  caseId: 'CASE-PARTIAL-LOCATION',
  additionalOperatingInputs: [
    unverified('location.current.accessibilityScore', 100, 'score'),
    adopted('location.current.servicesScore', 80, 'score'),
  ],
};
const partial = calculateLifecycleLocationUpsideIntelligence(partialLocationCase);
assert.strictEqual(partial.location.status, INTELLIGENCE_STATUS.CALCULATED_WITH_GAPS);
assert.strictEqual(partial.location.dimensions.length, 1);
assert.ok(partial.location.issues.some((item) => item.field === 'location.current.accessibilityScore'));

const exitStrategyComparison = {
  exitStrategyComparisonCalculated: true,
  benchmarkScenarioId: 'HOLD-BASE',
  highestModeledNpvScenario: { scenarioId: 'REPOSITION', npv: 2500000 },
  scenarioResults: [
    {
      scenarioId: 'HOLD-BASE', analyticalRank: 2, holdPeriodYears: 5,
      baseStabilizedNoi: 1000000, targetStabilizedNoi: 1000000, strategyCapex: 0,
      metrics: { npv: 2000000 }, valueCreationVsBenchmarkNpv: 0,
      terminalValue: { basis: 'FORWARD_NOI_CAPITALIZATION' },
    },
    {
      scenarioId: 'REPOSITION', analyticalRank: 1, holdPeriodYears: 5,
      baseStabilizedNoi: 1000000, targetStabilizedNoi: 1200000, strategyCapex: 100000,
      metrics: { npv: 2500000 }, valueCreationVsBenchmarkNpv: 500000,
      terminalValue: { basis: 'FORWARD_NOI_CAPITALIZATION' },
    },
  ],
};

const scenarioIntegration = buildScenarioIntegration({ exitStrategyComparison, intelligenceBundle: bundle });
assert.strictEqual(scenarioIntegration.automaticFinancializationApplied, false);
assert.strictEqual(scenarioIntegration.automaticRecommendation, null);
assert.strictEqual(scenarioIntegration.reviewRequired, true);
assert.ok(scenarioIntegration.issues.some((item) => item.code === 'LIFECYCLE_CAPEX_MAY_BE_UNDERSPECIFIED'));
assert.ok(scenarioIntegration.issues.some((item) => item.code === 'POTENTIAL_UPSIDE_DOUBLE_COUNT_REVIEW'));
assert.ok(scenarioIntegration.issues.some((item) => item.code === 'FORWARD_ATTRACTION_CONTEXT_ONLY_DO_NOT_AUTO_FINANCIALIZE'));

const operatingMetrics = {
  status: 'CALCULATED',
  occupancy: { physicalOccupancyByArea: 0.95 },
  leaseTiming: { waleYears: 4.5, leaseCliffs: [{ year: 2029 }] },
};
const propertyCosts = { capex: { criticalUnknownCostCount: 0, lifeSafetyUnknownCostCount: 0 } };
const reverseUnderwriting = {
  reverseUnderwritingCalculated: true,
  maximumJustifiedPurchasePrice: 10000000,
  currentPriceAnalysis: { purchasePrice: 9000000 },
};
const score = calculateAcquisitionAnalyticalScore({
  operatingMetrics,
  propertyCosts,
  reverseUnderwriting,
  exitStrategyComparison,
  intelligenceBundle: bundle,
});
assert.strictEqual(score.status, 'CALCULATED');
assert.strictEqual(score.scoreCoverage, 1);
assert.strictEqual(score.aiModelUsed, false);
assert.strictEqual(score.investmentRecommendation, null);
assert.strictEqual(score.investmentDecision, null);
assert.strictEqual(score.legalConclusion, null);
assert.ok(score.score >= 0 && score.score <= 100);
assert.ok(score.redFlags.some((item) => item.code === 'CRITICAL_LIFECYCLE_COMPONENTS_DUE_WITHIN_3Y'));
assert.ok(score.redFlags.some((item) => item.code === 'PROHIBITED_UPSIDE_CATALYST_PRESENT'));

const committeePack = buildInvestmentCommitteePack({
  operatingCase,
  readiness: { assumptions: [], blockers: [], evidenceGaps: [] },
  operatingMetrics,
  propertyCosts,
  incomeAnalysis: { stabilizedNoiCalculated: true, stabilizedIncome: { stabilizedNoi: 1000000 } },
  acquisitionBasis: { acquisitionBasisCalculated: true, bases: { allInBasis: 9000000, equityBasis: 5000000 } },
  reverseUnderwriting,
  exitStrategyComparison,
  intelligenceBundle: bundle,
  scenarioIntegration,
  acquisitionScore: score,
});
assert.ok(committeePack.sections.facts.length > 0);
assert.ok(committeePack.sections.assumptions.some((item) => item.code === 'FORWARD_ATTRACTION_IS_CONTEXT_ONLY'));
assert.ok(committeePack.sections.modelOutputs.some((item) => item.key === 'acquisitionAnalyticalScore'));
assert.ok(committeePack.sections.judgmentRequired.some((item) => item.code === 'REGULATORY_VERIFICATION_REQUIRED'));
assert.strictEqual(committeePack.decisionRequested, null);
assert.strictEqual(committeePack.recommendation, null);
assert.strictEqual(committeePack.approved, false);
assert.strictEqual(committeePack.legalOpinion, null);
assert.strictEqual(committeePack.regulatedAdvice, false);
assert.strictEqual(committeePack.transactionAuthorized, false);

const srcRoot = path.join(__dirname, '..', '..', 'src', 'residential-income-acquisition');
const apiSource = fs.readFileSync(path.join(srcRoot, 'api.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(srcRoot, 'index.js'), 'utf8');
assert.ok(apiSource.includes('calculateLifecycleLocationUpsideIntelligence'));
assert.ok(apiSource.includes('calculateAcquisitionAnalyticalScore'));
assert.ok(apiSource.includes('buildInvestmentCommitteePack'));
assert.ok(apiSource.includes("capabilityStatus: 'EXIT_STRATEGY_COMPARISON_V1'"));
assert.ok(apiSource.includes("intelligenceExtensionStatus: 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1'"));
assert.ok(indexSource.includes("require('./lifecycle-location-upside')"));
assert.ok(indexSource.includes("require('./decision-layer')"));

console.log('RIAI lifecycle, location, forward attraction, upside, deterministic acquisition score, scenario-attribution review, and committee-pack boundary: PASS');
