'use strict';

const AI_ASSIST_STATUS = Object.freeze({
  READY: 'READY',
  NOT_READY: 'NOT_READY',
  VALID: 'VALID',
  INVALID: 'INVALID',
});

const ALLOWED_SEVERITY = new Set(['LOW', 'MEDIUM', 'HIGH']);
const MAX_ITEMS = 8;
const MAX_TEXT = 500;
const FORBIDDEN_DECISION_PATTERNS = [
  /\b(buy|sell|approve|reject|invest|proceed|do not proceed)\b/i,
  /\b(اشتر|اشتري|بع|بيع|وافق|ارفض|استثمر|نفذ الصفقة|لا تنفذ الصفقة)\b/u,
];

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function trimText(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function compactIssue(issue) {
  if (!issue || typeof issue !== 'object') return null;
  return {
    code: trimText(issue.code, 120) || 'UNSPECIFIED',
    field: trimText(issue.field, 160) || null,
  };
}

function compactFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags.slice(0, MAX_ITEMS).map((flag) => ({
    code: trimText(flag && flag.code, 120) || 'UNSPECIFIED',
    severity: ALLOWED_SEVERITY.has(flag && flag.severity) ? flag.severity : 'MEDIUM',
  }));
}

function buildResidentialIncomeAiDecisionSnapshot(viewModel) {
  if (!viewModel || viewModel.apiStatus !== 'CASE_LOADED') {
    return Object.freeze({
      schemaVersion: 1,
      status: AI_ASSIST_STATUS.NOT_READY,
      reasonCode: 'OPERATING_CASE_REQUIRED',
      decisionSnapshot: null,
    });
  }

  const score = viewModel.acquisitionAnalyticalScore;
  const bundle = viewModel.lifecycleLocationUpside;
  const reverse = viewModel.reverseUnderwriting;
  const exit = viewModel.exitStrategyComparison;
  const scenarioIntegration = viewModel.scenarioIntegration;

  const decisionSnapshot = {
    schemaVersion: 1,
    capability: 'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',
    asOfDate: viewModel.asOfDate || null,
    readinessStatus: viewModel.readinessStatus || null,
    summary: {
      unitCount: viewModel.summary && viewModel.summary.unitCount || 0,
      leaseCount: viewModel.summary && viewModel.summary.leaseCount || 0,
      tenantCount: viewModel.summary && viewModel.summary.tenantCount || 0,
      evidenceLineageCount: viewModel.summary && viewModel.summary.evidenceLineageCount || 0,
    },
    readiness: {
      blockerCount: Array.isArray(viewModel.blockers) ? viewModel.blockers.length : 0,
      evidenceGapCount: Array.isArray(viewModel.evidenceGaps) ? viewModel.evidenceGaps.length : 0,
      dueDiligenceCount: Array.isArray(viewModel.dueDiligence) ? viewModel.dueDiligence.length : 0,
      blockers: (viewModel.blockers || []).slice(0, MAX_ITEMS).map(compactIssue).filter(Boolean),
      evidenceGaps: (viewModel.evidenceGaps || []).slice(0, MAX_ITEMS).map(compactIssue).filter(Boolean),
    },
    acquisitionScore: score ? {
      status: score.status || null,
      score: finite(score.score) ? score.score : null,
      scoreCoverage: finite(score.scoreCoverage) ? score.scoreCoverage : null,
      evidenceConfidence: finite(score.evidenceConfidence) ? score.evidenceConfidence : null,
      redFlags: compactFlags(score.redFlags),
      components: Array.isArray(score.components) ? score.components.map((item) => ({
        key: trimText(item && item.key, 80),
        score: finite(item && item.score) ? item.score : null,
        weight: finite(item && item.weight) ? item.weight : null,
        status: trimText(item && item.status, 40) || null,
      })) : [],
    } : null,
    lifecycle: bundle && bundle.lifecycle ? {
      status: bundle.lifecycle.status || null,
      weightedConditionScore: bundle.lifecycle.metrics && finite(bundle.lifecycle.metrics.weightedConditionScore) ? bundle.lifecycle.metrics.weightedConditionScore : null,
      criticalComponentsDueWithin3y: bundle.lifecycle.metrics && finite(bundle.lifecycle.metrics.criticalComponentsDueWithin3y) ? bundle.lifecycle.metrics.criticalComponentsDueWithin3y : null,
      replacementCapexWithin3y: bundle.lifecycle.metrics && finite(bundle.lifecycle.metrics.replacementCapexWithin3y) ? bundle.lifecycle.metrics.replacementCapexWithin3y : null,
      replacementCapexWithin5y: bundle.lifecycle.metrics && finite(bundle.lifecycle.metrics.replacementCapexWithin5y) ? bundle.lifecycle.metrics.replacementCapexWithin5y : null,
    } : null,
    location: bundle && bundle.location ? {
      status: bundle.location.status || null,
      currentLocationScore: finite(bundle.location.currentLocationScore) ? bundle.location.currentLocationScore : null,
      evidenceCoverage: finite(bundle.location.evidenceCoverage) ? bundle.location.evidenceCoverage : null,
    } : null,
    forwardAttraction: bundle && bundle.forwardAttraction ? {
      status: bundle.forwardAttraction.status || null,
      direction: bundle.forwardAttraction.attractionDirection || null,
      score: finite(bundle.forwardAttraction.forwardAttractionScore) ? bundle.forwardAttraction.forwardAttractionScore : null,
      catalystCount: Array.isArray(bundle.forwardAttraction.catalysts) ? bundle.forwardAttraction.catalysts.length : 0,
    } : null,
    upside: bundle && bundle.upside ? {
      status: bundle.upside.status || null,
      eligibleCatalystCount: bundle.upside.metrics && finite(bundle.upside.metrics.eligibleCatalystCount) ? bundle.upside.metrics.eligibleCatalystCount : null,
      verifiedFeasibleCount: bundle.upside.metrics && finite(bundle.upside.metrics.verifiedFeasibleCount) ? bundle.upside.metrics.verifiedFeasibleCount : null,
      regulatoryVerificationRequiredCount: bundle.upside.metrics && finite(bundle.upside.metrics.regulatoryVerificationRequiredCount) ? bundle.upside.metrics.regulatoryVerificationRequiredCount : null,
      prohibitedCount: bundle.upside.metrics && finite(bundle.upside.metrics.prohibitedCount) ? bundle.upside.metrics.prohibitedCount : null,
    } : null,
    pricing: reverse && reverse.reverseUnderwritingCalculated === true ? {
      outcome: reverse.outcome || null,
      purchasePrice: reverse.currentPriceAnalysis && finite(reverse.currentPriceAnalysis.purchasePrice) ? reverse.currentPriceAnalysis.purchasePrice : null,
      maximumJustifiedPurchasePrice: finite(reverse.maximumJustifiedPurchasePrice) ? reverse.maximumJustifiedPurchasePrice : null,
      priceHeadroom: reverse.currentPriceAnalysis && finite(reverse.currentPriceAnalysis.priceHeadroom) ? reverse.currentPriceAnalysis.priceHeadroom : null,
      bindingConstraint: reverse.bindingConstraint && reverse.bindingConstraint.code || null,
    } : null,
    exitComparison: exit && exit.exitStrategyComparisonCalculated === true ? {
      benchmarkScenarioId: trimText(exit.benchmarkScenarioId, 120) || null,
      highestModeledNpvScenarioId: exit.highestModeledNpvScenario && trimText(exit.highestModeledNpvScenario.scenarioId, 120) || null,
      highestModeledNpv: exit.highestModeledNpvScenario && finite(exit.highestModeledNpvScenario.npv) ? exit.highestModeledNpvScenario.npv : null,
      scenarioCount: Array.isArray(exit.scenarioResults) ? exit.scenarioResults.length : 0,
    } : null,
    scenarioReview: scenarioIntegration ? {
      status: scenarioIntegration.status || null,
      reviewRequired: scenarioIntegration.reviewRequired === true,
      issueCodes: Array.isArray(scenarioIntegration.issues)
        ? scenarioIntegration.issues.slice(0, MAX_ITEMS).map((item) => trimText(item && item.code, 120)).filter(Boolean)
        : [],
      automaticFinancializationApplied: scenarioIntegration.automaticFinancializationApplied === true,
    } : null,
    governance: {
      deterministicScoreRemainsAuthoritative: true,
      automaticInvestmentRecommendationAllowed: false,
      legalConclusionAllowed: false,
      transactionAuthorizationAllowed: false,
      rawOperatingCaseIncluded: false,
      tenantNamesIncluded: false,
      evidenceDocumentTextIncluded: false,
    },
  };

  return Object.freeze({
    schemaVersion: 1,
    status: AI_ASSIST_STATUS.READY,
    reasonCode: null,
    decisionSnapshot,
  });
}

function validateTextList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return { ok: false, reasonCode: `${field}_INVALID` };
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > MAX_TEXT) return { ok: false, reasonCode: `${field}_INVALID` };
    if (FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(item))) return { ok: false, reasonCode: 'AUTOMATIC_DECISION_LANGUAGE_PROHIBITED' };
  }
  return { ok: true };
}

function validateResidentialIncomeAiAssistResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'AI_RESPONSE_OBJECT_REQUIRED', value: null });
  }

  for (const field of ['executiveObservations', 'evidenceGaps', 'dueDiligenceQuestions', 'scenarioChecks']) {
    const result = validateTextList(payload[field], field);
    if (!result.ok) return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: result.reasonCode, value: null });
  }

  if (!Array.isArray(payload.riskFlags) || payload.riskFlags.length > MAX_ITEMS) {
    return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'riskFlags_INVALID', value: null });
  }
  const riskFlags = [];
  for (const item of payload.riskFlags) {
    if (!item || typeof item !== 'object' || !ALLOWED_SEVERITY.has(item.severity)) {
      return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'riskFlags_INVALID', value: null });
    }
    const code = trimText(item.code, 120);
    const rationale = trimText(item.rationale, MAX_TEXT);
    if (!code || !rationale || FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(rationale))) {
      return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'riskFlags_INVALID', value: null });
    }
    riskFlags.push({ code, severity: item.severity, rationale });
  }

  if (!Array.isArray(payload.earlyWarningIndicators) || payload.earlyWarningIndicators.length > MAX_ITEMS) {
    return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'earlyWarningIndicators_INVALID', value: null });
  }
  const earlyWarningIndicators = [];
  for (const item of payload.earlyWarningIndicators) {
    if (!item || typeof item !== 'object') return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'earlyWarningIndicators_INVALID', value: null });
    const indicator = trimText(item.indicator, 220);
    const whyItMatters = trimText(item.whyItMatters, MAX_TEXT);
    if (!indicator || !whyItMatters || FORBIDDEN_DECISION_PATTERNS.some((pattern) => pattern.test(`${indicator} ${whyItMatters}`))) {
      return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'earlyWarningIndicators_INVALID', value: null });
    }
    earlyWarningIndicators.push({ indicator, whyItMatters });
  }

  const decisionBoundary = trimText(payload.decisionBoundary, MAX_TEXT);
  if (!decisionBoundary) return Object.freeze({ status: AI_ASSIST_STATUS.INVALID, reasonCode: 'decisionBoundary_INVALID', value: null });

  const value = Object.freeze({
    schemaVersion: 1,
    executiveObservations: payload.executiveObservations.map((item) => trimText(item)),
    riskFlags,
    evidenceGaps: payload.evidenceGaps.map((item) => trimText(item)),
    dueDiligenceQuestions: payload.dueDiligenceQuestions.map((item) => trimText(item)),
    scenarioChecks: payload.scenarioChecks.map((item) => trimText(item)),
    earlyWarningIndicators,
    decisionBoundary,
    investmentRecommendation: null,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
  });

  return Object.freeze({ status: AI_ASSIST_STATUS.VALID, reasonCode: null, value });
}

module.exports = {
  AI_ASSIST_STATUS,
  buildResidentialIncomeAiDecisionSnapshot,
  validateResidentialIncomeAiAssistResponse,
};
