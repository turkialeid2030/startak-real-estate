'use strict';

const { evaluateGuidedDecisionFlow } = require('./guided-decision-flow');

function hasEvidence(valuationCase) {
  const evidence = valuationCase && valuationCase.evidence;
  return Boolean(evidence && typeof evidence === 'object' && !Array.isArray(evidence) && Object.keys(evidence).length > 0);
}

function buildGuidedUiStatus({ runtime = null, valuationCase = null, financialResultPresent = true } = {}) {
  const stage = runtime && runtime.stage && typeof runtime.stage === 'object' ? runtime.stage : null;
  const evidenceComplete = Boolean(
    stage
    && hasEvidence(valuationCase)
    && Array.isArray(stage.evidenceGaps)
    && stage.evidenceGaps.length === 0,
  );

  const flow = evaluateGuidedDecisionFlow({
    // This helper is used only inside ValuationIntelligencePanel, which App.jsx
    // renders after a financial result exists. These first six milestones mean
    // "financial input boundary was successfully reached", not independent DD.
    asset: { financialInputBoundaryReached: true },
    price: { financialInputBoundaryReached: true },
    income: { financialInputBoundaryReached: true },
    expenses: { financialInputBoundaryReached: true },
    assumptions: { financialInputBoundaryReached: true },
    financing: { financialInputBoundaryReached: true },
    valuation: stage && stage.readyForDecisionControl === true ? { status: stage.status } : null,
    evidence: evidenceComplete ? { evidenceCount: Object.keys(valuationCase.evidence).length } : null,
    risksReviewed: false,
    financialResult: financialResultPresent ? { present: true } : null,
    dueDiligence: null,
    overallDecision: null,
  });

  return Object.freeze({
    ...flow,
    valuationStageStatus: stage ? stage.status || null : null,
    valuationReadyForDecisionControl: Boolean(stage && stage.readyForDecisionControl === true),
    evidenceComplete,
    financialResultPresent: Boolean(financialResultPresent),
    semantics: 'Guided status is sequencing metadata only. It never grants investment approval or transaction authority.',
  });
}

module.exports = { buildGuidedUiStatus };
