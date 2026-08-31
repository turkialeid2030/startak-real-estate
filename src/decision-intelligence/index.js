'use strict';

const {
  EXTERNAL_DECISION_LABEL,
  externalizeInternalVerdict,
  createDecisionSupportEnvelope,
} = require('../compliance/decision-support');

const DOSSIER_STATUS = Object.freeze({
  READY_ANALYTICAL_CASE: 'READY_ANALYTICAL_CASE',
  HOLD_EVIDENCE_OR_POLICY: 'HOLD_EVIDENCE_OR_POLICY',
  PROFESSIONAL_REVIEW_REQUIRED: 'PROFESSIONAL_REVIEW_REQUIRED',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function summarizeScenarioRisk({ scenarioResults = [], riskFlags = [], simulation = null, sensitivity = [] }) {
  if (!Array.isArray(scenarioResults)) throw new TypeError('scenarioResults must be an array');
  if (!Array.isArray(riskFlags)) throw new TypeError('riskFlags must be an array');
  if (!Array.isArray(sensitivity)) throw new TypeError('sensitivity must be an array');
  const severe = riskFlags.filter((item) => item && ['HIGH', 'CRITICAL'].includes(item.severity));
  const critical = riskFlags.filter((item) => item && item.severity === 'CRITICAL');
  const topSensitivityDrivers = sensitivity.slice(0, 3).map((item) => ({
    variable: item.variable,
    absoluteRange: item.absoluteRange,
    downsideImpact: item.downsideImpact,
    upsideImpact: item.upsideImpact,
  }));
  const downsideScenarios = scenarioResults.filter((item) => item && ['DOWNSIDE', 'SEVERE_DOWNSIDE'].includes(item.kind));
  return freeze({
    scenarioCount: scenarioResults.length,
    downsideScenarioCount: downsideScenarios.length,
    riskFlagCount: riskFlags.length,
    highOrCriticalRiskCount: severe.length,
    criticalRiskCount: critical.length,
    topSensitivityDrivers,
    simulation: simulation ? { ...simulation } : null,
    semantics: 'Scenario/risk summary is conditional analytical stress testing. It is not a probability guarantee, market forecast, or investment instruction.',
  });
}

function buildAiNarrativeContext({ evidenceFacts = [], analyticalMetrics = {}, scenarioResults = [], riskFlags = [], scenarioRiskSummary = null }) {
  if (!Array.isArray(evidenceFacts)) throw new TypeError('evidenceFacts must be an array');
  if (!analyticalMetrics || typeof analyticalMetrics !== 'object' || Array.isArray(analyticalMetrics)) throw new TypeError('analyticalMetrics must be an object');
  if (!Array.isArray(scenarioResults)) throw new TypeError('scenarioResults must be an array');
  if (!Array.isArray(riskFlags)) throw new TypeError('riskFlags must be an array');

  const factRefs = evidenceFacts.map((fact, index) => ({
    ref: fact.evidenceId || fact.factId || `EVIDENCE-${index + 1}`,
    key: fact.key || null,
    value: Object.prototype.hasOwnProperty.call(fact, 'normalizedValue') ? fact.normalizedValue : fact.value,
    truthStatus: fact.truthStatus || fact.status || null,
    sourceRef: fact.sourceRef || null,
  }));

  return freeze({
    schemaVersion: 1,
    factRefs,
    analyticalMetrics: { ...analyticalMetrics },
    scenarioResults: scenarioResults.map((item) => ({ ...item })),
    riskFlags: riskFlags.map((item) => ({ ...item })),
    scenarioRiskSummary: scenarioRiskSummary ? { ...scenarioRiskSummary } : null,
    narrativeRules: [
      'Do not invent facts, prices, regulations, legal conclusions, market data, or scenario probabilities.',
      'Every material factual statement must cite a supplied evidence ref or be explicitly labelled as an assumption/scenario.',
      'Do not convert analytical valuation indications into certified valuations.',
      'Do not produce BUY/SELL/APPROVE/REJECT instructions.',
      'Professional-review gates cannot be overridden by AI.',
      'State material uncertainty, evidence conflicts and missing inputs explicitly.',
      'Describe Monte Carlo output as conditional on supplied distributions; never as a guaranteed forecast.',
      'Identify the strongest downside drivers before describing upside.',
    ],
  });
}

function createDecisionDossier({
  controlGate,
  financialResult = null,
  evidenceFacts = [],
  analyticalMetrics = {},
  scenarioResults = [],
  riskFlags = [],
  simulation = null,
  sensitivity = [],
  locale = 'ar',
}) {
  requireObject(controlGate, 'controlGate');

  const professionalRequired = controlGate.status === 'PROFESSIONAL_REVIEW_REQUIRED';
  const analyticallyReady = controlGate.status === 'READY_FOR_ANALYTICAL_UNDERWRITING';
  let analyticalLabel;
  let dossierStatus;

  if (professionalRequired) {
    analyticalLabel = EXTERNAL_DECISION_LABEL.REQUIRES_LICENSED_REVIEW;
    dossierStatus = DOSSIER_STATUS.PROFESSIONAL_REVIEW_REQUIRED;
  } else if (!analyticallyReady) {
    analyticalLabel = EXTERNAL_DECISION_LABEL.HOLD_EVIDENCE;
    dossierStatus = DOSSIER_STATUS.HOLD_EVIDENCE_OR_POLICY;
  } else {
    if (!financialResult || typeof financialResult.verdict !== 'string') throw new TypeError('qualified financialResult.verdict is required when control gate is ready');
    analyticalLabel = externalizeInternalVerdict(financialResult.verdict, { locale, evidenceReady: true, requiresLicensedReview: false });
    dossierStatus = DOSSIER_STATUS.READY_ANALYTICAL_CASE;
  }

  const evidenceGaps = (controlGate.blockers || []).map((item) => `${item.domain}:${item.code}`);
  const assumptions = [];
  for (const item of scenarioResults) {
    if (item && item.assumption) assumptions.push(item.assumption);
  }

  const envelope = createDecisionSupportEnvelope({
    analyticalLabel,
    locale,
    assumptions,
    evidenceGaps,
    licensedReviewRequired: professionalRequired,
  });

  const scenarioRiskSummary = summarizeScenarioRisk({ scenarioResults, riskFlags, simulation, sensitivity });
  const aiNarrativeContext = buildAiNarrativeContext({ evidenceFacts, analyticalMetrics, scenarioResults, riskFlags, scenarioRiskSummary });

  return freeze({
    schemaVersion: 1,
    projectId: controlGate.projectId,
    caseId: controlGate.caseId,
    dossierStatus,
    controlGateStatus: controlGate.status,
    decisionSupport: envelope,
    analyticalMetrics: { ...analyticalMetrics },
    scenarioResults: scenarioResults.map((item) => ({ ...item })),
    riskFlags: riskFlags.map((item) => ({ ...item })),
    scenarioRiskSummary,
    aiNarrativeContext,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    certifiedValuationProduced: false,
    legalOpinionProduced: false,
    semantics: 'Decision Intelligence packages verified analytical outputs and bounded AI context. AI may explain supplied evidence and scenarios but cannot override gates or become the legal/investment decision maker.',
  });
}

module.exports = {
  DOSSIER_STATUS,
  summarizeScenarioRisk,
  buildAiNarrativeContext,
  createDecisionDossier,
};
