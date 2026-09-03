'use strict';

const DECISION_LAYER_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_GAPS: 'CALCULATED_WITH_GAPS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const SCORE_WEIGHTS = Object.freeze({
  operatingStability: 0.20,
  leaseDurability: 0.15,
  lifecycleCondition: 0.15,
  currentLocation: 0.15,
  forwardAttraction: 0.10,
  priceDiscipline: 0.15,
  upsideReadiness: 0.10,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function scoreOperatingStability(operatingMetrics) {
  const occupancy = operatingMetrics && operatingMetrics.occupancy && operatingMetrics.occupancy.physicalOccupancyByArea;
  if (!finite(occupancy)) return null;
  return clamp(occupancy * 100, 0, 100);
}

function benchmarkHold(exitComparison) {
  if (!exitComparison || !Array.isArray(exitComparison.scenarioResults) || !exitComparison.benchmarkScenarioId) return null;
  const benchmark = exitComparison.scenarioResults.find((item) => item.scenarioId === exitComparison.benchmarkScenarioId);
  return benchmark && finite(benchmark.holdPeriodYears) && benchmark.holdPeriodYears > 0 ? benchmark.holdPeriodYears : null;
}

function scoreLeaseDurability(operatingMetrics, exitComparison) {
  const wale = operatingMetrics && operatingMetrics.leaseTiming && operatingMetrics.leaseTiming.waleYears;
  const hold = benchmarkHold(exitComparison);
  if (!finite(wale) || !finite(hold) || hold <= 0) return null;
  const base = clamp((wale / hold) * 100, 0, 100);
  const cliffs = Array.isArray(operatingMetrics.leaseTiming.leaseCliffs) ? operatingMetrics.leaseTiming.leaseCliffs.length : 0;
  const cliffPenalty = Math.min(cliffs * 5, 25);
  return clamp(base - cliffPenalty, 0, 100);
}

function scoreLifecycle(bundle) {
  const score = bundle && bundle.lifecycle && bundle.lifecycle.metrics && bundle.lifecycle.metrics.weightedConditionScore;
  return finite(score) ? clamp(score, 0, 100) : null;
}

function scoreLocation(bundle) {
  const score = bundle && bundle.location && bundle.location.currentLocationScore;
  return finite(score) ? clamp(score, 0, 100) : null;
}

function scoreForward(bundle) {
  const score = bundle && bundle.forwardAttraction && bundle.forwardAttraction.forwardAttractionScore;
  if (!finite(score)) return null;
  return clamp((score + 100) / 2, 0, 100);
}

function scorePriceDiscipline(reverseUnderwriting) {
  if (!reverseUnderwriting || reverseUnderwriting.reverseUnderwritingCalculated !== true) return null;
  const maxPrice = reverseUnderwriting.maximumJustifiedPurchasePrice;
  const purchasePrice = reverseUnderwriting.currentPriceAnalysis && reverseUnderwriting.currentPriceAnalysis.purchasePrice;
  if (!finite(maxPrice) || maxPrice <= 0 || !finite(purchasePrice) || purchasePrice <= 0) return null;
  if (purchasePrice <= maxPrice) return 100;
  return clamp((maxPrice / purchasePrice) * 100, 0, 100);
}

function scoreUpside(bundle) {
  const upside = bundle && bundle.upside;
  if (!upside || !Array.isArray(upside.catalysts) || !upside.catalysts.length) return 50;
  const catalysts = upside.catalysts;
  if (catalysts.some((item) => item.prohibited)) return 0;
  const verified = catalysts.filter((item) => item.regulatoryStatus === 'VERIFIED_FEASIBLE');
  const eligible = catalysts.filter((item) => item.effectiveProbability > 0 && !item.prohibited);
  if (!eligible.length) return 25;
  const positive = eligible.filter((item) => finite(item.incrementalAnnualNoi) && item.incrementalAnnualNoi > 0);
  const regulatoryRatio = verified.length / catalysts.length;
  const positiveRatio = positive.length / eligible.length;
  return clamp((regulatoryRatio * 60) + (positiveRatio * 40), 0, 100);
}

function confidenceFromBundle(bundle) {
  if (!bundle) return 0;
  const parts = [];
  if (bundle.location && finite(bundle.location.evidenceCoverage)) parts.push(bundle.location.evidenceCoverage);
  if (bundle.lifecycle && Array.isArray(bundle.lifecycle.components)) {
    const issueCount = Array.isArray(bundle.lifecycle.issues) ? bundle.lifecycle.issues.length : 0;
    parts.push(bundle.lifecycle.components.length ? 1 / (1 + issueCount / bundle.lifecycle.components.length) : 0);
  }
  if (bundle.forwardAttraction && Array.isArray(bundle.forwardAttraction.catalysts)) {
    const list = bundle.forwardAttraction.catalysts;
    const avg = list.length ? list.reduce((s, item) => {
      const lineage = Object.values(item.lineage || {}).filter(Boolean);
      const confidences = lineage.map((x) => x.confidence).filter(finite);
      return s + (confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : 0.5);
    }, 0) / list.length : 0;
    parts.push(avg);
  }
  if (bundle.upside && Array.isArray(bundle.upside.catalysts)) {
    const list = bundle.upside.catalysts;
    const verifiedRatio = list.length ? list.filter((item) => item.regulatoryStatus === 'VERIFIED_FEASIBLE').length / list.length : 0;
    parts.push(verifiedRatio);
  }
  return parts.length ? clamp(parts.reduce((a,b)=>a+b,0)/parts.length, 0, 1) : 0;
}

function redFlags({ operatingMetrics, propertyCosts, reverseUnderwriting, intelligenceBundle }) {
  const flags = [];
  if (propertyCosts && propertyCosts.capex && (propertyCosts.capex.criticalUnknownCostCount > 0 || propertyCosts.capex.lifeSafetyUnknownCostCount > 0)) {
    flags.push({ code: 'CRITICAL_OR_LIFE_SAFETY_CAPEX_UNKNOWN', severity: 'HIGH' });
  }
  if (intelligenceBundle && intelligenceBundle.lifecycle && intelligenceBundle.lifecycle.metrics && intelligenceBundle.lifecycle.metrics.criticalComponentsDueWithin3y > 0) {
    flags.push({ code: 'CRITICAL_LIFECYCLE_COMPONENTS_DUE_WITHIN_3Y', severity: 'HIGH', count: intelligenceBundle.lifecycle.metrics.criticalComponentsDueWithin3y });
  }
  if (intelligenceBundle && intelligenceBundle.forwardAttraction && intelligenceBundle.forwardAttraction.attractionDirection === 'NEGATIVE') {
    flags.push({ code: 'NEGATIVE_FORWARD_ATTRACTION', severity: 'MEDIUM' });
  }
  if (intelligenceBundle && intelligenceBundle.upside && intelligenceBundle.upside.metrics && intelligenceBundle.upside.metrics.prohibitedCount > 0) {
    flags.push({ code: 'PROHIBITED_UPSIDE_CATALYST_PRESENT', severity: 'HIGH', count: intelligenceBundle.upside.metrics.prohibitedCount });
  }
  if (reverseUnderwriting && reverseUnderwriting.reverseUnderwritingCalculated === true && reverseUnderwriting.currentPriceAnalysis) {
    const current = reverseUnderwriting.currentPriceAnalysis.purchasePrice;
    const max = reverseUnderwriting.maximumJustifiedPurchasePrice;
    if (finite(current) && finite(max) && current > max) flags.push({ code: 'PURCHASE_PRICE_ABOVE_ANALYTICAL_LIMIT', severity: 'HIGH', amount: current - max });
  }
  const occupancy = operatingMetrics && operatingMetrics.occupancy && operatingMetrics.occupancy.physicalOccupancyByArea;
  if (finite(occupancy) && occupancy < 0.80) flags.push({ code: 'PHYSICAL_OCCUPANCY_BELOW_80_PERCENT', severity: 'MEDIUM', value: occupancy });
  return flags;
}

function calculateAcquisitionAnalyticalScore({
  operatingMetrics = null,
  propertyCosts = null,
  reverseUnderwriting = null,
  exitStrategyComparison = null,
  intelligenceBundle = null,
} = {}) {
  const raw = {
    operatingStability: scoreOperatingStability(operatingMetrics),
    leaseDurability: scoreLeaseDurability(operatingMetrics, exitStrategyComparison),
    lifecycleCondition: scoreLifecycle(intelligenceBundle),
    currentLocation: scoreLocation(intelligenceBundle),
    forwardAttraction: scoreForward(intelligenceBundle),
    priceDiscipline: scorePriceDiscipline(reverseUnderwriting),
    upsideReadiness: scoreUpside(intelligenceBundle),
  };
  const components = [];
  let numerator = 0;
  let denominator = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const score = raw[key];
    if (!finite(score)) {
      components.push({ key, weight, score: null, weightedContribution: null, status: 'MISSING' });
      continue;
    }
    numerator += score * weight;
    denominator += weight;
    components.push({ key, weight, score, weightedContribution: score * weight, status: 'SCORED' });
  }
  const score = denominator > 0 ? numerator / denominator : null;
  const coverage = denominator;
  const flags = redFlags({ operatingMetrics, propertyCosts, reverseUnderwriting, intelligenceBundle });
  const status = !finite(score)
    ? DECISION_LAYER_STATUS.NOT_CALCULABLE
    : coverage >= 0.99
      ? DECISION_LAYER_STATUS.CALCULATED
      : DECISION_LAYER_STATUS.CALCULATED_WITH_GAPS;
  return deepFreeze({
    schemaVersion: 1,
    status,
    score: finite(score) ? score : null,
    scoreCoverage: coverage,
    evidenceConfidence: confidenceFromBundle(intelligenceBundle),
    components,
    redFlags: flags,
    scorePolicy: {
      weights: SCORE_WEIGHTS,
      leaseDurabilityBenchmark: 'WALE divided by explicit benchmark hold period, capped at 100, less 5 points per identified lease cliff up to 25',
      priceDiscipline: '100 when modeled purchase price is at or below the non-binding reverse-underwriting limit; otherwise limit/price × 100',
      forwardAttraction: 'maps the separate -100..100 contextual signal to 0..100; it does not alter financial cash flows',
      upsideReadiness: 'governance/readiness score based on verified feasibility and positive modeled NOI; no catalyst is treated as a neutral 50 rather than a penalty',
    },
    aiModelUsed: false,
    investmentRecommendation: null,
    investmentDecision: null,
    legalConclusion: null,
    semantics: 'This is a deterministic, explainable acquisition analytical score, not an AI-generated investment recommendation. It is designed as the governed substrate for a future AI narrative layer; the score itself remains auditable and non-binding.',
  });
}

function buildScenarioIntegration({ exitStrategyComparison = null, intelligenceBundle = null } = {}) {
  if (!exitStrategyComparison || exitStrategyComparison.exitStrategyComparisonCalculated !== true || !Array.isArray(exitStrategyComparison.scenarioResults)) {
    return deepFreeze({
      schemaVersion: 1,
      status: DECISION_LAYER_STATUS.NOT_CALCULABLE,
      issues: [{ code: 'EXIT_STRATEGY_COMPARISON_REQUIRED' }],
      scenarios: [],
      reviewRequired: false,
      semantics: 'Scenario integration requires a calculated exit-strategy comparison.',
    });
  }
  const lifecycleComponents = intelligenceBundle && intelligenceBundle.lifecycle && Array.isArray(intelligenceBundle.lifecycle.components)
    ? intelligenceBundle.lifecycle.components : [];
  const upside = intelligenceBundle && intelligenceBundle.upside && Array.isArray(intelligenceBundle.upside.catalysts)
    ? intelligenceBundle.upside.catalysts.filter((item) => !item.prohibited && item.effectiveProbability > 0) : [];
  const forwardScore = intelligenceBundle && intelligenceBundle.forwardAttraction && intelligenceBundle.forwardAttraction.forwardAttractionScore;
  const scenarios = exitStrategyComparison.scenarioResults.map((scenario) => {
    const lifecycleCapexWithinHold = lifecycleComponents
      .filter((item) => item.replacementYearOffset <= scenario.holdPeriodYears)
      .reduce((sum, item) => sum + item.replacementCost, 0);
    const modeledNoiDelta = scenario.targetStabilizedNoi - scenario.baseStabilizedNoi;
    const modeledCapex = scenario.strategyCapex;
    const issues = [];
    if (lifecycleCapexWithinHold > modeledCapex) {
      issues.push({ code: 'LIFECYCLE_CAPEX_MAY_BE_UNDERSPECIFIED', amount: lifecycleCapexWithinHold - modeledCapex });
    }
    if (upside.length && (modeledCapex > 0 || modeledNoiDelta !== 0)) {
      issues.push({ code: 'POTENTIAL_UPSIDE_DOUBLE_COUNT_REVIEW', catalystCount: upside.length });
    }
    if (finite(forwardScore) && Math.abs(forwardScore) >= 15) {
      issues.push({ code: 'FORWARD_ATTRACTION_CONTEXT_ONLY_DO_NOT_AUTO_FINANCIALIZE', score: forwardScore });
    }
    return {
      scenarioId: scenario.scenarioId,
      analyticalRank: scenario.analyticalRank,
      npv: scenario.metrics && scenario.metrics.npv,
      valueCreationVsBenchmarkNpv: scenario.valueCreationVsBenchmarkNpv,
      modeledStrategyCapex: modeledCapex,
      lifecycleReplacementCapexWithinHold: lifecycleCapexWithinHold,
      modeledStabilizedNoiDelta: modeledNoiDelta,
      eligibleUpsideCatalystCount: upside.length,
      forwardAttractionContextScore: finite(forwardScore) ? forwardScore : null,
      terminalValueBasis: scenario.terminalValue && scenario.terminalValue.basis,
      issues,
      automaticAdjustmentApplied: false,
    };
  });
  const reviewRequired = scenarios.some((scenario) => scenario.issues.length > 0);
  return deepFreeze({
    schemaVersion: 1,
    status: reviewRequired ? DECISION_LAYER_STATUS.CALCULATED_WITH_GAPS : DECISION_LAYER_STATUS.CALCULATED,
    issues: scenarios.flatMap((item) => item.issues.map((issue) => ({ ...issue, scenarioId: item.scenarioId }))),
    scenarios,
    reviewRequired,
    automaticFinancializationApplied: false,
    automaticRecommendation: null,
    semantics: 'This layer audits scenario attribution and double-counting risk. Lifecycle, location, and upside signals are not automatically injected into NPV, IRR, growth, exit cap rate, or terminal value; explicit scenario adoption remains required.',
  });
}

function buildInvestmentCommitteePack({
  operatingCase = null,
  readiness = null,
  operatingMetrics = null,
  propertyCosts = null,
  incomeAnalysis = null,
  acquisitionBasis = null,
  reverseUnderwriting = null,
  exitStrategyComparison = null,
  intelligenceBundle = null,
  scenarioIntegration = null,
  acquisitionScore = null,
} = {}) {
  const facts = [];
  const assumptions = [];
  const modelOutputs = [];
  const judgmentRequired = [];
  if (operatingCase) {
    facts.push({ key: 'caseId', value: operatingCase.caseId || null });
    facts.push({ key: 'asOfDate', value: operatingCase.asOfDate || null });
    facts.push({ key: 'propertyInterestType', value: operatingCase.propertyInterest && operatingCase.propertyInterest.interestType || null });
    facts.push({ key: 'unitCount', value: Array.isArray(operatingCase.units) ? operatingCase.units.length : null });
    facts.push({ key: 'leaseCount', value: Array.isArray(operatingCase.leases) ? operatingCase.leases.length : null });
  }
  if (operatingMetrics && operatingMetrics.status === 'CALCULATED') {
    facts.push({ key: 'physicalOccupancyByArea', value: operatingMetrics.occupancy && operatingMetrics.occupancy.physicalOccupancyByArea });
    facts.push({ key: 'waleYears', value: operatingMetrics.leaseTiming && operatingMetrics.leaseTiming.waleYears });
  }
  if (intelligenceBundle && intelligenceBundle.location) facts.push({ key: 'currentLocationScore', value: intelligenceBundle.location.currentLocationScore });
  if (intelligenceBundle && intelligenceBundle.lifecycle && intelligenceBundle.lifecycle.metrics) facts.push({ key: 'lifecycleConditionScore', value: intelligenceBundle.lifecycle.metrics.weightedConditionScore });

  if (readiness && Array.isArray(readiness.assumptions)) assumptions.push(...readiness.assumptions.map((item) => ({ ...item })));
  if (intelligenceBundle && intelligenceBundle.forwardAttraction && finite(intelligenceBundle.forwardAttraction.forwardAttractionScore)) {
    assumptions.push({ code: 'FORWARD_ATTRACTION_IS_CONTEXT_ONLY', value: intelligenceBundle.forwardAttraction.forwardAttractionScore });
  }

  if (incomeAnalysis && incomeAnalysis.stabilizedNoiCalculated) modelOutputs.push({ key: 'stabilizedNoi', value: incomeAnalysis.stabilizedIncome.stabilizedNoi });
  if (acquisitionBasis && acquisitionBasis.acquisitionBasisCalculated) {
    modelOutputs.push({ key: 'allInBasis', value: acquisitionBasis.bases.allInBasis });
    modelOutputs.push({ key: 'equityBasis', value: acquisitionBasis.bases.equityBasis });
  }
  if (reverseUnderwriting && reverseUnderwriting.reverseUnderwritingCalculated) {
    modelOutputs.push({ key: 'maximumJustifiedPurchasePrice', value: reverseUnderwriting.maximumJustifiedPurchasePrice, boundary: 'NON_BINDING_ANALYTICAL_LIMIT' });
  }
  if (exitStrategyComparison && exitStrategyComparison.exitStrategyComparisonCalculated) {
    modelOutputs.push({ key: 'highestModeledNpvScenario', value: exitStrategyComparison.highestModeledNpvScenario, boundary: 'ANALYTICAL_NPV_RANKING_NOT_RECOMMENDATION' });
  }
  if (acquisitionScore && finite(acquisitionScore.score)) {
    modelOutputs.push({ key: 'acquisitionAnalyticalScore', value: acquisitionScore.score, coverage: acquisitionScore.scoreCoverage, boundary: 'DETERMINISTIC_NON_BINDING_SCORE' });
  }

  if (readiness && Array.isArray(readiness.blockers)) judgmentRequired.push(...readiness.blockers.map((item) => ({ source: 'READINESS_BLOCKER', ...item })));
  if (readiness && Array.isArray(readiness.evidenceGaps)) judgmentRequired.push(...readiness.evidenceGaps.map((item) => ({ source: 'EVIDENCE_GAP', ...item })));
  if (intelligenceBundle && intelligenceBundle.upside && intelligenceBundle.upside.metrics && intelligenceBundle.upside.metrics.regulatoryVerificationRequiredCount > 0) {
    judgmentRequired.push({ source: 'UPSIDE_REGULATORY', code: 'REGULATORY_VERIFICATION_REQUIRED', count: intelligenceBundle.upside.metrics.regulatoryVerificationRequiredCount });
  }
  if (scenarioIntegration && scenarioIntegration.reviewRequired) {
    judgmentRequired.push({ source: 'SCENARIO_ATTRIBUTION', code: 'SCENARIO_ATTRIBUTION_REVIEW_REQUIRED', issues: scenarioIntegration.issues });
  }
  if (acquisitionScore && Array.isArray(acquisitionScore.redFlags)) judgmentRequired.push(...acquisitionScore.redFlags.map((item) => ({ source: 'ANALYTICAL_RED_FLAG', ...item })));

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    asOfDate: operatingCase && operatingCase.asOfDate || null,
    sections: { facts, assumptions, modelOutputs, judgmentRequired },
    decisionRequested: null,
    recommendation: null,
    approved: false,
    legalOpinion: null,
    regulatedAdvice: false,
    transactionAuthorized: false,
    semantics: 'Committee-pack data separates sourced facts, assumptions, model outputs, and matters requiring human judgment. The platform does not approve, recommend, execute, or provide regulated investment or legal advice.',
  });
}

module.exports = {
  DECISION_LAYER_STATUS,
  SCORE_WEIGHTS,
  calculateAcquisitionAnalyticalScore,
  buildScenarioIntegration,
  buildInvestmentCommitteePack,
};
