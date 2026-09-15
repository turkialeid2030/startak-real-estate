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

const packet = buildPacket();
equal(packet.status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.READY_FOR_CANONICAL_RESIDUAL_CALCULATION, 'valid packet should be calculation-ready');
check(packet.readyForCanonicalResidualCalculation, 'ready flag should be true');
check(verifyDevelopmentResidualInputIntegrity(packet), 'packet integrity should verify');
equal(packet.automaticGdvEstimated, false, 'GDV must not be automatically estimated');
equal(packet.automaticDeveloperReturnEstimated, false, 'developer return must not be automatic');
equal(packet.canonicalEngineInputsWritten, false, 'professional packet must not write production engine inputs');

const result = calculateDevelopmentResidualLandValue(packet);
equal(result.status, DEVELOPMENT_RESIDUAL_RESULT_STATUS.RESIDUAL_LAND_VALUE_INDICATION_READY, 'valid economics should produce residual indication');
equal(result.totalGdvSar, 25000000, 'GDV sum');
equal(result.totalDevelopmentCostsSar, 12000000, 'development-cost sum');
equal(result.totalFinanceCostsSar, 1000000, 'finance-cost sum');
equal(result.totalFeesSar, 500000, 'fee sum');
equal(result.requiredDeveloperReturnSar, 2500000, 'developer return amount');
equal(result.residualLandValueSar, 9000000, 'residual formula');
equal(result.residualLandValuePerSqm, 9000, 'residual per sqm');
equal(result.discountingApplied, false, 'Wave 11C must not silently discount timing');
equal(result.timingArithmeticConvention, 'NOMINAL_UNDISCOUNTED_RESIDUAL', 'timing convention must be explicit');
equal(result.indicationType, 'DEVELOPMENT_RESIDUAL_LAND_VALUE_INDICATION', 'output must remain a method indication');
equal(result.finalValuationConclusionEstablished, false, 'no final valuation conclusion');
equal(result.transactionAuthorized, false, 'no transaction authority');
check(Array.isArray(result.nominalSchedule) && result.nominalSchedule.length >= 4, 'timeline should be preserved');

const percentPacket = buildPacket({ requiredReturn: developerReturn(DEVELOPER_RETURN_METHOD.PERCENT_OF_GDV, 0.10, 'PCT') });
const percentResult = calculateDevelopmentResidualLandValue(percentPacket);
equal(percentResult.requiredDeveloperReturnSar, 2500000, 'percent-of-GDV return must be calculated canonically');
equal(percentResult.residualLandValueSar, 9000000, 'percent-of-GDV residual');

const negativePacket = buildPacket({ requiredReturn: developerReturn(DEVELOPER_RETURN_METHOD.AMOUNT_SAR, 20000000, 'NEG') });
const negativeResult = calculateDevelopmentResidualLandValue(negativePacket);
equal(negativeResult.status, DEVELOPMENT_RESIDUAL_RESULT_STATUS.REVIEW_REQUIRED, 'non-positive residual should be review-required, not crash');
check(negativeResult.residualLandValueSar < 0, 'negative residual remains an economically meaningful result');
check(negativeResult.reviewFlags.includes('NON_POSITIVE_RESIDUAL_REVIEW_REQUIRED'), 'negative residual review flag');

const badProperty = propertyPacket({ status: PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, professionalValuationWorkflowReady: false });
equal(buildPacket({ property: badProperty }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, 'property-evidence hold must fail closed');

const unconcludedHbu = hbuDecision({ status: HBU_DECISION_STATUS.HOLD_DECISION, highestAndBestUseConclusionEstablished: false });
equal(buildPacket({ hbu: unconcludedHbu }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, 'unconcluded HBU must fail closed');

const wrongUseHbu = hbuDecision();
wrongUseHbu.scenarioOutcomes = [{ ...wrongUseHbu.scenarioOutcomes[0], proposedUse: 'OFFICE_ONLY' }];
equal(buildPacket({ hbu: wrongUseHbu }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, 'tampered/mismatched HBU use must fail closed');

const timelineComponents = baseComponents();
timelineComponents.costs = [createDevelopmentCostComponent({ componentId: 'COST-LATE', caseId, propertyRef, componentType: DEVELOPMENT_COST_TYPE.HARD_COST, label: 'Late cost', amountSar: 1000000, month: 40, ...provenance('COST-LATE') })];
equal(buildPacket({ components: timelineComponents, terminalMonth: 36 }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_TIMELINE, 'component after terminal month must fail closed');

const tamperedComponents = baseComponents();
tamperedComponents.gdv = [{ ...tamperedComponents.gdv[0], amountSar: 99999999 }, tamperedComponents.gdv[1]];
equal(buildPacket({ components: tamperedComponents }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_INTEGRITY, 'tampered economic component must fail integrity');

const duplicateComponents = baseComponents();
duplicateComponents.finance = [{ ...duplicateComponents.finance[0], componentId: 'COST-1' }];
equal(buildPacket({ components: duplicateComponents }).status, DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_INTEGRITY, 'duplicate component IDs across groups must fail closed');

throws(() => developerReturn(DEVELOPER_RETURN_METHOD.PERCENT_OF_GDV, 1.01, 'BADPCT'), /PERCENT_OF_GDV_VALUE_MUST_BE_FRACTION/, 'developer return percent above one must be rejected');
throws(() => createGdvComponent({ componentId: 'BAD-REVIEW', caseId, propertyRef, componentType: DEVELOPMENT_GDV_TYPE.SALE_RECEIPT, label: 'Bad review ordering', amountSar: 1, month: 1, ...provenance('BAD-REVIEW'), preparedAt: reviewedAt, reviewedAt: preparedAt }), /REVIEW_BEFORE_PREPARATION/, 'review-before-preparation must be rejected');
throws(() => buildDevelopmentResidualInputPacket({}), /packetId/, 'empty packet must fail semantic validation');

const tamperedPacket = { ...packet, terminalMonth: 37 };
equal(calculateDevelopmentResidualLandValue(tamperedPacket).status, DEVELOPMENT_RESIDUAL_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered input packet must be rejected by canonical engine');

const professionalSource = fs.readFileSync(path.join(__dirname, '../../src/development/development-property.js'), 'utf8');
const engineSource = fs.readFileSync(path.join(__dirname, '../../src/engines/valuation/residual-land-value.js'), 'utf8');
check(!professionalSource.includes("require('../engines/valuation/land-development')"), 'professional module must not reuse legacy investment land-development engine');
check(!engineSource.includes("require('./land-development')"), 'canonical professional residual must be isolated from legacy investment engine');
check(!/marketValueAfterCompletion|maxJustifiedLandPricePerSqm/.test(engineSource), 'professional residual engine must not depend on legacy underwriting outputs');
check(engineSource.includes('totalGdvSar - totalDevelopmentCostsSar - totalFinanceCostsSar - totalFeesSar - requiredDeveloperReturnSar'), 'canonical residual formula must be explicit in one engine');
check(engineSource.includes('discountingApplied: false'), 'no hidden discounting must be encoded');

console.log(`WAVE_11C_DEVELOPMENT_RESIDUAL=PASS checks=${checks}`);
