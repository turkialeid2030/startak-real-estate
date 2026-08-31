'use strict';

const assert = require('assert');
const {
  DOSSIER_STATUS,
  summarizeScenarioRisk,
  buildAiNarrativeContext,
  createDecisionDossier,
} = require('../../src/decision-intelligence');

const readyGate = {
  projectId: 'PROJECT-1',
  caseId: 'CASE-1',
  status: 'READY_FOR_ANALYTICAL_UNDERWRITING',
  blockers: [],
};

const dossier = createDecisionDossier({
  controlGate: readyGate,
  financialResult: { verdict: 'يوصى بالشراء بشروط' },
  evidenceFacts: [
    { evidenceId: 'E-1', key: 'annualIncome', normalizedValue: 1000000, truthStatus: 'VERIFIED_FACT', sourceRef: 'DOC-1' },
  ],
  analyticalMetrics: { irr: 0.12, npv: 500000 },
  scenarioResults: [
    { kind: 'BASE', assumption: 'Occupancy remains at the supplied base-case level.' },
    { kind: 'DOWNSIDE', assumption: 'Synthetic downside fixture.' },
  ],
  riskFlags: [
    { code: 'LEASE_EXPIRY_CONCENTRATION', severity: 'HIGH' },
    { code: 'TITLE_REVIEW', severity: 'MODERATE' },
  ],
  simulation: { status: 'QUALIFIED', p05: -100000, p50: 500000, p95: 1500000, probabilityBelowZero: 0.08 },
  sensitivity: [
    { variable: 'rent', absoluteRange: 0.08, downsideImpact: -0.05, upsideImpact: 0.03 },
    { variable: 'occupancy', absoluteRange: 0.06, downsideImpact: -0.04, upsideImpact: 0.02 },
  ],
  locale: 'ar',
});

assert.strictEqual(dossier.dossierStatus, DOSSIER_STATUS.READY_ANALYTICAL_CASE);
assert.strictEqual(dossier.decisionSupport.analyticalLabel, 'CONDITIONAL');
assert.strictEqual(dossier.humanDecisionRequired, true);
assert.strictEqual(dossier.transactionAuthorized, false);
assert.strictEqual(dossier.certifiedValuationProduced, false);
assert.strictEqual(dossier.legalOpinionProduced, false);
assert.strictEqual(dossier.aiNarrativeContext.factRefs[0].ref, 'E-1');
assert.ok(dossier.aiNarrativeContext.narrativeRules.some((rule) => rule.includes('Do not invent facts')));
assert.strictEqual(dossier.scenarioRiskSummary.downsideScenarioCount, 1);
assert.strictEqual(dossier.scenarioRiskSummary.highOrCriticalRiskCount, 1);
assert.strictEqual(dossier.scenarioRiskSummary.topSensitivityDrivers[0].variable, 'rent');
assert.strictEqual(dossier.scenarioRiskSummary.simulation.probabilityBelowZero, 0.08);
assert.ok(dossier.aiNarrativeContext.narrativeRules.some((rule) => rule.includes('Monte Carlo')));

const hold = createDecisionDossier({
  controlGate: { ...readyGate, status: 'HOLD_EVIDENCE', blockers: [{ domain: 'TITLE', code: 'REQUIRED_TITLE_FACT_MISSING' }] },
  evidenceFacts: [],
});
assert.strictEqual(hold.dossierStatus, DOSSIER_STATUS.HOLD_EVIDENCE_OR_POLICY);
assert.strictEqual(hold.decisionSupport.analyticalLabel, 'HOLD_EVIDENCE');
assert.ok(hold.decisionSupport.evidenceGaps.includes('TITLE:REQUIRED_TITLE_FACT_MISSING'));

const professional = createDecisionDossier({
  controlGate: { ...readyGate, status: 'PROFESSIONAL_REVIEW_REQUIRED', blockers: [], professionalReview: [{ domain: 'TITLE', code: 'LEGAL_REVIEW_REQUIRED' }] },
});
assert.strictEqual(professional.dossierStatus, DOSSIER_STATUS.PROFESSIONAL_REVIEW_REQUIRED);
assert.strictEqual(professional.decisionSupport.analyticalLabel, 'REQUIRES_LICENSED_REVIEW');
assert.strictEqual(professional.decisionSupport.licensedReviewRequired, true);

assert.throws(() => createDecisionDossier({ controlGate: readyGate, financialResult: null }), /financialResult\.verdict/);

const context = buildAiNarrativeContext({
  evidenceFacts: [{ factId: 'F-1', key: 'marketRent', value: 1000, status: 'OBSERVED', sourceRef: 'MARKET-1' }],
});
assert.strictEqual(context.factRefs[0].ref, 'F-1');
assert.strictEqual(context.factRefs[0].sourceRef, 'MARKET-1');

const summary = summarizeScenarioRisk({
  scenarioResults: [{ kind: 'SEVERE_DOWNSIDE' }],
  riskFlags: [{ severity: 'CRITICAL' }],
  sensitivity: [{ variable: 'exitCapRate', absoluteRange: 0.10, downsideImpact: -0.07, upsideImpact: 0.03 }],
});
assert.strictEqual(summary.criticalRiskCount, 1);
assert.strictEqual(summary.downsideScenarioCount, 1);

console.log('DECISION_INTELLIGENCE_V1=PASS');
console.log('AI_CONTEXT_EVIDENCE_BOUND=PASS');
console.log('AI_CANNOT_OVERRIDE_CONTROL_GATE=PASS');
console.log('NO_AUTOMATIC_TRANSACTION_AUTHORIZATION=PASS');
console.log('NO_CERTIFIED_VALUATION_OR_LEGAL_OPINION=PASS');
console.log('SCENARIO_RISK_SUMMARY_BOUND_TO_AI_CONTEXT=PASS');
