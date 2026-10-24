'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEVELOPMENT_GDV_TYPE,
  DEVELOPMENT_COST_TYPE,
  FINANCE_COST_TYPE,
  DEVELOPMENT_FEE_TYPE,
  DEVELOPER_RETURN_METHOD,
  DEVELOPMENT_RESIDUAL_INPUT_STATUS,
  createGdvComponent,
  createDevelopmentCostComponent,
  createFinanceCostComponent,
  createDevelopmentFeeComponent,
  createRequiredDeveloperReturn,
  buildDevelopmentResidualInputPacket,
  verifyDevelopmentResidualInputIntegrity,
} = require('../../src/development/development-property');
const { HBU_DECISION_STATUS } = require('../../src/hbu/hbu-workflow');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../../src/property/property-evidence-bridge');
const {
  DEVELOPMENT_RESIDUAL_RESULT_STATUS,
  calculateDevelopmentResidualLandValue,
} = require('../../src/engines/valuation/residual-land-value');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  checks += 1;
}
function throws(fn, matcher, message) {
  assert.throws(fn, matcher, message);
  checks += 1;
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

const caseId = 'CASE-11C-001';
const propertyRef = 'PROPERTY-11C-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const scenarioId = 'HBU-SCENARIO-DEVELOP';
const developmentUse = 'MIXED_USE_DEVELOPMENT';
const preparedAt = '2026-09-02T09:00:00.000Z';
const reviewedAt = '2026-09-02T10:00:00.000Z';

function propertyPacket(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId,
    propertyRef,
    valuationDate,
    status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
    professionalValuationWorkflowReady: true,
    packetHashSha256: 'b'.repeat(64),
    measurements: [{
      measurementId: 'LAND-AREA-001',
      type: 'LAND_AREA',
      value: 1000,
      unit: 'sqm',
      source: 'PROFESSIONAL_INSPECTION',
      sourceEvidenceRef: 'EVID-LAND-AREA',
      measurementStandardRef: 'MEASURE-STD-001',
      measurementMethod: 'SURVEY_RECONCILIATION',
      measurementHashSha256: 'c'.repeat(64),
    }],
    ...overrides,
  };
}

function hbuDecision(overrides = {}) {
  const core = {
    schemaVersion: 1,
    decisionId: 'HBU-DEC-001',
    caseId,
    propertyRef,
    selectedScenarioId: scenarioId,
    comparisonBasis: 'Professional comparison of legally permissible, physically possible and financially feasible uses',
    rationale: 'Selected development use is the professionally concluded maximally productive feasible scenario.',
    evidenceRefs: ['HBU-EVID-001'],
    scenarioOutcomes: [{
      scenarioId,
      proposedUse: developmentUse,
      hbuScenarioHashSha256: 'd'.repeat(64),
      maximallyProductiveOutcome: 'PASS',
      selected: true,
      comparativeMetric: null,
    }],
    decidedByRef: 'VALUER-001',
    decidedAt: reviewedAt,
    decisionEvidenceRef: 'HBU-DECISION-EVIDENCE',
  };
  return {
    ...core,
    hbuDecisionHashSha256: sha256(core),
    status: HBU_DECISION_STATUS.HBU_CONCLUSION_RECORDED,
    blockers: [],
    highestAndBestUseConclusionEstablished: true,
    professionalJudgmentExplicit: true,
    automaticUseSelection: false,
    automaticMaxProductivityRanking: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    ...overrides,
  };
}

function provenance(label) {
  return {
    sourceRef: `SOURCE-${label}`,
    evidenceRefs: [`EVID-${label}`],
    rationale: `Reviewed professional basis for ${label}`,
    preparedByRef: 'ANALYST-001',
    preparedAt,
    reviewedByRef: 'REVIEWER-001',
    reviewedAt,
    reviewEvidenceRef: `REVIEW-${label}`,
  };
}

function baseComponents() {
  return {
    gdv: [
      createGdvComponent({ componentId: 'GDV-1', caseId, propertyRef, componentType: DEVELOPMENT_GDV_TYPE.SALE_RECEIPT, label: 'Unit sales receipts', amountSar: 20000000, month: 30, ...provenance('GDV-1') }),
      createGdvComponent({ componentId: 'GDV-2', caseId, propertyRef, componentType: DEVELOPMENT_GDV_TYPE.CAPITAL_VALUE, label: 'Retained stabilized component value', amountSar: 5000000, month: 36, ...provenance('GDV-2') }),
    ],
    costs: [
      createDevelopmentCostComponent({ componentId: 'COST-1', caseId, propertyRef, componentType: DEVELOPMENT_COST_TYPE.HARD_COST, label: 'Hard construction cost', amountSar: 10000000, month: 18, ...provenance('COST-1') }),
      createDevelopmentCostComponent({ componentId: 'COST-2', caseId, propertyRef, componentType: DEVELOPMENT_COST_TYPE.CONTINGENCY, label: 'Explicit contingency', amountSar: 2000000, month: 24, ...provenance('COST-2') }),
    ],
    finance: [createFinanceCostComponent({ componentId: 'FIN-1', caseId, propertyRef, componentType: FINANCE_COST_TYPE.INTEREST, label: 'Explicit reviewed finance cost', amountSar: 1000000, month: 30, ...provenance('FIN-1') })],
    fees: [createDevelopmentFeeComponent({ componentId: 'FEE-1', caseId, propertyRef, componentType: DEVELOPMENT_FEE_TYPE.STATUTORY_FEE, label: 'Explicit statutory/development fees', amountSar: 500000, month: 12, ...provenance('FEE-1') })],
  };
}

function developerReturn(method = DEVELOPER_RETURN_METHOD.AMOUNT_SAR, value = 2500000, suffix = 'A') {
  return createRequiredDeveloperReturn({
    returnId: `DEV-RETURN-${suffix}`,
    caseId,
    propertyRef,
    method,
    value,
    rationale: 'Explicit developer return supplied and professionally reviewed.',
    evidenceRefs: [`DEV-RETURN-EVID-${suffix}`],
    preparedByRef: 'ANALYST-001',
    preparedAt,
    reviewedByRef: 'REVIEWER-001',
    reviewedAt,
    reviewEvidenceRef: `DEV-RETURN-REVIEW-${suffix}`,
  });
}

function buildPacket({ components = baseComponents(), requiredReturn = developerReturn(), property = propertyPacket(), hbu = hbuDecision(), terminalMonth = 36 } = {}) {
  return buildDevelopmentResidualInputPacket({
    packetId: `DEV-PACKET-${requiredReturn.returnId}`,
    caseId,
    propertyRef,
    valuationDate,
    propertyEvidencePacket: property,
    hbuDecision: hbu,
    developmentScenarioId: scenarioId,
    developmentUse,
    developmentStartDate: '2026-10-01T00:00:00.000Z',
    terminalMonth,
    subjectLandAreaMeasurementId: 'LAND-AREA-001',
    gdvComponents: components.gdv,
    developmentCostComponents: components.costs,
    financeCostComponents: components.finance,
    feeComponents: components.fees,
    requiredDeveloperReturn: requiredReturn,
    preparedByRef: 'VALUATION-TEAM-001',
    preparedAt: '2026-09-02T11:00:00.000Z',
    packetEvidenceRef: 'DEV-PACKET-EVIDENCE',
  });
}

const {
  MODEL_VERSION,
  STATUS,
  RETURN_TREATMENT,
  DISCOUNT_CONVENTION,
  calculateDatedDevelopmentResidual,
} = require('../../src/engines/valuation/dated-development-residual');

const qualityEvidence = {
  sourceRef: 'RISK-FREE-REVIEWED-ASSUMPTION',
  methodologyRef: 'TIME-CONVENTION-REVIEW',
  reviewedByRef: 'INDEPENDENT-REVIEWER',
  reviewEvidenceRef: 'RISK-RATE-REVIEW-DOCUMENT',
  reviewedAt: '2026-09-03T00:00:00Z',
};
const basePolicy = {
  discountRate: 0.1,
  returnTreatment: RETURN_TREATMENT.EXPLICIT_DEVELOPER_RETURN,
  discountConvention: DISCOUNT_CONVENTION.TIME_VALUE_ONLY,
  discountRateEvidence: qualityEvidence,
  financingTreatment: 'UNLEVERED_NO_EXPLICIT_FINANCING',
};
const financeBlocked = calculateDatedDevelopmentResidual(buildPacket(), basePolicy);
equal(financeBlocked.status, STATUS.HOLD, 'existing packet with finance-cost items must fail closed');
check(financeBlocked.blockers.includes('FINANCE_COSTS_MUST_BE_REMOVED_FROM_UNLEVERED_DCF'), 'double financing guard');

const components = baseComponents();
components.finance = [];
const cleanPacket = buildPacket({ components });
equal(cleanPacket.status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.READY_FOR_CANONICAL_RESIDUAL_CALCULATION);
const oldNominal = calculateDevelopmentResidualLandValue(cleanPacket);
equal(oldNominal.residualLandValueSar, 10000000, 'original nominal legacy formula unchanged');

const zero = calculateDatedDevelopmentResidual(cleanPacket, {...basePolicy, discountRate: 0});
equal(zero.status, STATUS.READY_FOR_PROFESSIONAL_REVIEW);
equal(zero.residualLandValueSar, oldNominal.residualLandValueSar, 'zero-discount reconciliation with nominal method');
equal(zero.discountingApplied, true, 'dated cashflow arithmetically executed even at zero discount rate');
equal(zero.finalValuationConclusionEstablished, false);
equal(zero.transactionAuthorized, false);
equal(zero.saudiMarketAccuracyEstablished, false);
check(Object.isFrozen(zero) && Object.isFrozen(zero.discountedSchedule), 'immutable calculation result');

const dated = calculateDatedDevelopmentResidual(cleanPacket, basePolicy);
equal(dated.status, STATUS.READY_FOR_PROFESSIONAL_REVIEW, 'dated value returns reviewed indication');
const independentPv = dated.discountedSchedule.reduce((acc, row) =>
  acc + row.nominalNetSar / Math.pow(1.1, row.elapsedYears), 0);
check(Math.abs(dated.residualLandValueSar - independentPv) < 0.000001, 'manual independent dated NPV formula');
check(Math.abs(dated.residualLandValueSar - zero.residualLandValueSar) > 1, 'dated time profile changes value');
check(dated.discountedSchedule.every(row => row.date && row.discountFactor > 0), 'each row dated');

const risk = calculateDatedDevelopmentResidual(cleanPacket, {
  ...basePolicy,
  returnTreatment: RETURN_TREATMENT.RISK_INCLUDED_IN_DISCOUNT_RATE,
  discountConvention: DISCOUNT_CONVENTION.RISK_ADJUSTED_UNLEVERED,
});
equal(risk.status, STATUS.READY_FOR_PROFESSIONAL_REVIEW);
equal(risk.developerReturnDeducted, false, 'risk-adjusted discount rate does not deduct developer profit twice');
check(risk.residualLandValueSar > dated.residualLandValueSar, 'risk representation differs under identical numerical discount rate');
const dblCount = calculateDatedDevelopmentResidual(cleanPacket, {
  ...basePolicy, discountConvention: DISCOUNT_CONVENTION.RISK_ADJUSTED_UNLEVERED,
});
equal(dblCount.status, STATUS.HOLD);
check(dblCount.blockers.includes('DEVELOPER_RETURN_DISCOUNT_RATE_DOUBLE_COUNT'));

const invalidPolicy = [
  null, { ...basePolicy, discountRate: -0.1 },
  { ...basePolicy, discountRate: 1 },
  { ...basePolicy, discountRateEvidence: null },
  { ...basePolicy, financingTreatment: 'LEVERED' },
];
for (const policy of invalidPolicy) {
  equal(calculateDatedDevelopmentResidual(cleanPacket, policy).status, STATUS.HOLD,
    'invalid/absent risk policy must hold');
}
const zeroRisk = calculateDatedDevelopmentResidual(cleanPacket, {
  ...basePolicy, discountRate: 0,
  returnTreatment: RETURN_TREATMENT.RISK_INCLUDED_IN_DISCOUNT_RATE,
  discountConvention: DISCOUNT_CONVENTION.RISK_ADJUSTED_UNLEVERED,
});
check(zeroRisk.blockers.includes('RISK_ADJUSTED_DISCOUNT_RATE_MUST_BE_POSITIVE'));

const negatives = calculateDatedDevelopmentResidual(buildPacket({
  components, requiredReturn: developerReturn(DEVELOPER_RETURN_METHOD.AMOUNT_SAR, 30000000, 'C55NEG'),
}), {...basePolicy, discountRate: 0});
equal(negatives.status, STATUS.REVIEW_REQUIRED);
check(negatives.residualLandValueSar < 0, 'negative economics are preserved and flagged');

const tainted = calculateDatedDevelopmentResidual({ ...cleanPacket, terminalMonth: 99 }, basePolicy);
equal(tainted.status, STATUS.HOLD, 'upstream integrity tampering is never accepted');

const historic = calculateDatedDevelopmentResidual({
  ...cleanPacket,
  developmentStartDate: '2025-01-01T00:00:00.000Z',
}, basePolicy);
equal(historic.status, STATUS.HOLD, 'historical cost timing requires separate methodology');

console.log(`C55_DATED_DEVELOPMENT_RESIDUAL=PASS checks=${checks}`);
