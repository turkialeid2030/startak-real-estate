'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  DEVELOPMENT_GDV_TYPE,
  DEVELOPMENT_COST_TYPE,
  DEVELOPER_RETURN_METHOD,
  createGdvComponent,
  createDevelopmentCostComponent,
  createRequiredDeveloperReturn,
  buildDevelopmentResidualInputPacket,
} = require('../../src/development/development-property');
const {
  DEVELOPMENT_SCENARIO_TYPE,
  DEVELOPMENT_UNCERTAINTY_LEVEL,
  DEVELOPMENT_SENSITIVITY_INPUT_STATUS,
  createDevelopmentSensitivityScenario,
  buildDevelopmentSensitivityInput,
  verifyDevelopmentSensitivityInputIntegrity,
  recordDevelopmentUncertaintyAssessment,
} = require('../../src/development/development-sensitivity');
const { HBU_DECISION_STATUS } = require('../../src/hbu/hbu-workflow');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../../src/property/property-evidence-bridge');
const { calculateDevelopmentResidualLandValue } = require('../../src/engines/valuation/residual-land-value');
const {
  DEVELOPMENT_SENSITIVITY_RESULT_STATUS,
  calculateDevelopmentSensitivity,
} = require('../../src/engines/valuation/development-sensitivity');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function throws(fn, matcher, message) { assert.throws(fn, matcher, message); checks += 1; }
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }

const caseId = 'CASE-11D-001';
const propertyRef = 'PROPERTY-11D-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const scenarioId = 'HBU-DEVELOP';
const developmentUse = 'MIXED_USE_DEVELOPMENT';
const preparedAt = '2026-09-02T09:00:00.000Z';
const reviewedAt = '2026-09-02T10:00:00.000Z';

function provenance(ref) {
  return {
    sourceRef: `SRC-${ref}`,
    evidenceRefs: [`EVID-${ref}`],
    rationale: `Reviewed professional basis ${ref}`,
    preparedByRef: 'ANALYST-001', preparedAt,
    reviewedByRef: 'REVIEWER-001', reviewedAt,
    reviewEvidenceRef: `REVIEW-${ref}`,
  };
}
function propertyPacket() {
  return {
    caseId, propertyRef, valuationDate,
    status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
    professionalValuationWorkflowReady: true,
    packetHashSha256: 'a'.repeat(64),
    measurements: [{ measurementId: 'LAND-AREA', type: 'LAND_AREA', value: 1000, unit: 'sqm', source: 'INSPECTION', sourceEvidenceRef: 'AREA-EVID', measurementStandardRef: 'STD', measurementMethod: 'SURVEY', measurementHashSha256: 'b'.repeat(64) }],
  };
}
function hbuDecision() {
  const core = {
    schemaVersion: 1, decisionId: 'HBU-DEC', caseId, propertyRef, selectedScenarioId: scenarioId,
    comparisonBasis: 'Professional HBU comparison', rationale: 'Development selected', evidenceRefs: ['HBU-EVID'],
    scenarioOutcomes: [{ scenarioId, proposedUse: developmentUse, hbuScenarioHashSha256: 'c'.repeat(64), maximallyProductiveOutcome: 'PASS', selected: true, comparativeMetric: null }],
    decidedByRef: 'VALUER', decidedAt: reviewedAt, decisionEvidenceRef: 'HBU-REVIEW',
  };
  return { ...core, hbuDecisionHashSha256: sha256(core), status: HBU_DECISION_STATUS.HBU_CONCLUSION_RECORDED, highestAndBestUseConclusionEstablished: true };
}
function basePacket() {
  const gdv = createGdvComponent({ componentId: 'GDV', caseId, propertyRef, componentType: DEVELOPMENT_GDV_TYPE.SALE_RECEIPT, label: 'GDV', amountSar: 20000000, month: 24, ...provenance('GDV') });
  const cost = createDevelopmentCostComponent({ componentId: 'COST', caseId, propertyRef, componentType: DEVELOPMENT_COST_TYPE.HARD_COST, label: 'Cost', amountSar: 10000000, month: 18, ...provenance('COST') });
  const developerReturn = createRequiredDeveloperReturn({ returnId: 'RETURN', caseId, propertyRef, method: DEVELOPER_RETURN_METHOD.AMOUNT_SAR, value: 2000000, rationale: 'Explicit developer return', evidenceRefs: ['RETURN-EVID'], preparedByRef: 'ANALYST-001', preparedAt, reviewedByRef: 'REVIEWER-001', reviewedAt, reviewEvidenceRef: 'RETURN-REVIEW' });
  return buildDevelopmentResidualInputPacket({
    packetId: 'BASE-PACKET', caseId, propertyRef, valuationDate,
    propertyEvidencePacket: propertyPacket(), hbuDecision: hbuDecision(),
    developmentScenarioId: scenarioId, developmentUse, developmentStartDate: '2026-10-01T00:00:00.000Z', terminalMonth: 24,
    subjectLandAreaMeasurementId: 'LAND-AREA', gdvComponents: [gdv], developmentCostComponents: [cost], financeCostComponents: [], feeComponents: [],
    requiredDeveloperReturn: developerReturn, preparedByRef: 'VALUATION-TEAM', preparedAt: '2026-09-02T11:00:00.000Z', packetEvidenceRef: 'BASE-PACKET-EVID',
  });
}
function sensitivityScenario(id, type, values = {}) {
  return createDevelopmentSensitivityScenario({
    scenarioId: id, caseId, propertyRef, scenarioType: type, name: id,
    gdvMultiplier: values.gdv ?? 1,
    developmentCostMultiplier: values.cost ?? 1,
    financeCostMultiplier: values.finance ?? 1,
    feeMultiplier: values.fee ?? 1,
    developerReturnMultiplier: values.devReturn ?? 1,
    gdvTimingShiftMonths: values.gdvShift ?? 0,
    costTimingShiftMonths: values.costShift ?? 0,
    rationale: `Explicit ${id} stress`, evidenceRefs: [`EVID-${id}`],
    preparedByRef: 'ANALYST-001', preparedAt, reviewedByRef: 'REVIEWER-001', reviewedAt, reviewEvidenceRef: `REVIEW-${id}`,
  });
}

const packet = basePacket();
const baseResult = calculateDevelopmentResidualLandValue(packet);
equal(baseResult.residualLandValueSar, 8000000, 'base residual should be 8m');

const base = sensitivityScenario('BASE', DEVELOPMENT_SCENARIO_TYPE.BASE);
const upside = sensitivityScenario('UPSIDE', DEVELOPMENT_SCENARIO_TYPE.UPSIDE, { gdv: 1.10, cost: 0.95 });
const downside = sensitivityScenario('DOWNSIDE', DEVELOPMENT_SCENARIO_TYPE.DOWNSIDE, { gdv: 0.90, cost: 1.10, gdvShift: 3 });
const severe = sensitivityScenario('SEVERE', DEVELOPMENT_SCENARIO_TYPE.SEVERE, { gdv: 0.65, cost: 1.35, devReturn: 1.25, gdvShift: 8, costShift: 4 });

const input = buildDevelopmentSensitivityInput({ sensitivityId: 'SENS-001', caseId, propertyRef, baseInputPacket: packet, baseResidualResult: baseResult, scenarios: [base, upside, downside, severe], preparedByRef: 'VALUER', preparedAt: '2026-09-02T12:00:00.000Z', evidenceRef: 'SENS-EVID' });
equal(input.status, DEVELOPMENT_SENSITIVITY_INPUT_STATUS.READY_FOR_CANONICAL_SENSITIVITY, 'sensitivity input ready');
check(verifyDevelopmentSensitivityInputIntegrity(input), 'sensitivity input integrity');
equal(input.probabilitiesAssigned, false, 'no probabilities');
equal(input.monteCarloPerformed, false, 'no Monte Carlo in Wave 11D');

const result = calculateDevelopmentSensitivity(input, baseResult);
equal(result.status, DEVELOPMENT_SENSITIVITY_RESULT_STATUS.DEVELOPMENT_SENSITIVITY_READY, 'sensitivity result ready');
equal(result.scenarioResults.length, 4, 'four explicit scenarios retained');
equal(result.range.baseResidualSar, 8000000, 'base scenario equals canonical base residual');
check(result.range.maximumResidualSar > result.range.baseResidualSar, 'upside should exceed base');
check(result.range.minimumResidualSar < result.range.baseResidualSar, 'severe should be below base');
equal(result.probabilitiesAssigned, false, 'result remains non-probabilistic');
equal(result.monteCarloPerformed, false, 'result is deterministic sensitivity, not Monte Carlo');
equal(result.timingDiscountingApplied, false, 'timing shifts must not introduce hidden discounting');
equal(result.finalValuationConclusionEstablished, false, 'no final valuation conclusion');
equal(result.transactionAuthorized, false, 'no transaction authority');
check(result.scenarioResults.find((item) => item.scenarioId === 'DOWNSIDE').reviewFlags.includes('TIMING_SHIFT_RECORDED_NO_DISCOUNTING_EFFECT_IN_WAVE_11D'), 'timing shift should be explicit and non-discounted');
check(result.scenarioResults.every((item) => item.probability === null), 'every scenario probability must be null');

const uncertainty = recordDevelopmentUncertaintyAssessment({
  assessmentId: 'UNCERTAINTY-001', sensitivityResult: result, level: DEVELOPMENT_UNCERTAINTY_LEVEL.HIGH,
  drivers: ['GDV market depth', 'construction cost volatility', 'development timing'],
  rationale: 'Professional uncertainty assessment based on explicit scenario spread and evidence limitations.',
  evidenceRefs: ['UNCERTAINTY-EVID'], reviewedByRef: 'VALUER', reviewedAt: '2026-09-02T13:00:00.000Z', reviewEvidenceRef: 'UNCERTAINTY-REVIEW',
});
equal(uncertainty.level, DEVELOPMENT_UNCERTAINTY_LEVEL.HIGH, 'uncertainty level is explicit professional judgment');
equal(uncertainty.automaticallyClassified, false, 'uncertainty must not be automatically classified');
equal(uncertainty.observedScenarioMinimumResidualSar, result.range.minimumResidualSar, 'uncertainty records observed min');
equal(uncertainty.observedScenarioMaximumResidualSar, result.range.maximumResidualSar, 'uncertainty records observed max');
equal(uncertainty.finalValuationConclusionEstablished, false, 'uncertainty assessment is not final valuation');

throws(() => createDevelopmentSensitivityScenario({ scenarioId: 'PROB', caseId, propertyRef, scenarioType: DEVELOPMENT_SCENARIO_TYPE.CUSTOM, name: 'Probability forbidden', gdvMultiplier: 1, developmentCostMultiplier: 1, financeCostMultiplier: 1, feeMultiplier: 1, developerReturnMultiplier: 1, rationale: 'x', evidenceRefs: ['x'], preparedByRef: 'x', preparedAt, reviewedByRef: 'y', reviewedAt, reviewEvidenceRef: 'z', probability: 0.5 }), /PROBABILITY_NOT_ALLOWED/, 'probability must be rejected');

const badBase = sensitivityScenario('BADBASE', DEVELOPMENT_SCENARIO_TYPE.BASE, { gdv: 1.01 });
equal(buildDevelopmentSensitivityInput({ sensitivityId: 'BAD-BASE', caseId, propertyRef, baseInputPacket: packet, baseResidualResult: baseResult, scenarios: [badBase, downside], preparedByRef: 'VALUER', preparedAt, evidenceRef: 'BAD' }).status, DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, 'BASE must be neutral');

equal(buildDevelopmentSensitivityInput({ sensitivityId: 'NO-BASE', caseId, propertyRef, baseInputPacket: packet, baseResidualResult: baseResult, scenarios: [upside, downside], preparedByRef: 'VALUER', preparedAt, evidenceRef: 'NOBASE' }).status, DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, 'exactly one BASE required');

const tamperedScenario = { ...upside, gdvMultiplier: 9 };
equal(buildDevelopmentSensitivityInput({ sensitivityId: 'TAMPER', caseId, propertyRef, baseInputPacket: packet, baseResidualResult: baseResult, scenarios: [base, tamperedScenario], preparedByRef: 'VALUER', preparedAt, evidenceRef: 'TAMPER' }).status, DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, 'tampered scenario must fail integrity');

const duplicateScenario = { ...downside, scenarioId: base.scenarioId };
equal(buildDevelopmentSensitivityInput({ sensitivityId: 'DUP', caseId, propertyRef, baseInputPacket: packet, baseResidualResult: baseResult, scenarios: [base, duplicateScenario], preparedByRef: 'VALUER', preparedAt, evidenceRef: 'DUP' }).status, DEVELOPMENT_SENSITIVITY_INPUT_STATUS.HOLD_SCENARIOS, 'duplicate scenario IDs fail closed');

const tamperedInput = { ...input, probabilityConvention: 'SILENT_PROBABILITIES' };
equal(calculateDevelopmentSensitivity(tamperedInput, baseResult).status, DEVELOPMENT_SENSITIVITY_RESULT_STATUS.INVALID_INPUT_SET, 'tampered input set rejected');

throws(() => recordDevelopmentUncertaintyAssessment({ assessmentId: 'BAD-UNC', sensitivityResult: result, level: 'AUTO', drivers: ['x'], rationale: 'x', evidenceRefs: ['x'], reviewedByRef: 'x', reviewedAt, reviewEvidenceRef: 'x' }), /level is invalid/, 'uncertainty level must use governed taxonomy');

console.log(`WAVE_11D_DEVELOPMENT_SENSITIVITY=PASS checks=${checks}`);
