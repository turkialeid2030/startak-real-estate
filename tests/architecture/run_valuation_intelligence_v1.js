'use strict';

const assert = require('assert');
const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
  createValuationIndication,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  createComparable,
  calculateMarketComparableIndication,
  EXPENSE_TREATMENT,
  calculateDirectCapitalization,
  deriveAgeLifeDepreciation,
  calculateDepreciatedReplacementCost,
  calculateResidualLandValue,
  RECONCILIATION_STATUS,
  reconcileValuationIndications,
  METHOD_APPLICABILITY,
  planValuationMethods,
} = require('../../src/valuation-intelligence');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
} = require('../../src/project-model/project-profile');

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

function ev(field, grade = EVIDENCE_GRADE.E_MARKET_OBSERVATION, status = INPUT_STATUS.OBSERVED) {
  return { field, grade, status, sourceType: 'SYNTHETIC_TEST_FIXTURE' };
}

// 1) Market comparables: explicit status + explicit weighting policy; no hidden asking discount.
const comp1 = createComparable({
  comparableId: 'C1',
  unitValue: 1000,
  transactionStatus: TRANSACTION_STATUS.EXECUTED_SALE,
  evidenceGrade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
});
const comp2 = createComparable({
  comparableId: 'C2',
  unitValue: 1200,
  transactionStatus: TRANSACTION_STATUS.ASKING_SALE,
  evidenceGrade: EVIDENCE_GRADE.E_MARKET_OBSERVATION,
  adjustments: [{ factor: 'SIZE', percent: -0.10 }],
});
const market = calculateMarketComparableIndication({
  comparables: [comp1, comp2],
  subjectArea: 100,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  weightingPolicy: WEIGHTING_POLICY.EQUAL,
  valuationDate: '2026-08-31',
});
approx(market.components.weightedUnitValue, 1040);
approx(market.value, 104000);
assert.ok(market.warnings.includes('MIXED_EXECUTED_AND_ASKING_EVIDENCE'));
assert.strictEqual(market.components.comparables[1].adjustedUnitValue, 1080);

// 2) Direct capitalization: zero OPEX is never accepted without an explicit tenant-borne treatment.
assert.throws(() => calculateDirectCapitalization({
  effectiveGrossIncome: 100000,
  operatingExpenses: 0,
  capitalizationRate: 0.08,
  expenseTreatment: EXPENSE_TREATMENT.MARKET_ESTIMATE,
  incomeEvidence: ev('income'),
  expenseEvidence: ev('opex'),
  capRateEvidence: ev('capRate'),
}), /zero operatingExpenses/);

const income = calculateDirectCapitalization({
  effectiveGrossIncome: 100000,
  operatingExpenses: 0,
  capitalizationRate: 0.08,
  expenseTreatment: EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED,
  incomeEvidence: ev('income', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  expenseEvidence: ev('opex', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  capRateEvidence: ev('capRate'),
  valuationDate: '2026-08-31',
});
approx(income.value, 1250000);
assert.ok(income.assumptions.includes('TENANT_BORNE_OPEX_NOT_CONTRACTUALLY_VERIFIED'));

// 3) Cost approach: land + replacement cost + explicit depreciation.
approx(deriveAgeLifeDepreciation({ effectiveAge: 10, totalEconomicLife: 40 }), 0.25);
const cost = calculateDepreciatedReplacementCost({
  landValue: 500000,
  directReplacementCost: 1000000,
  indirectCosts: [{ label: 'PROFESSIONAL_AND_OTHER_COSTS', amount: 200000 }],
  depreciationRate: 0.25,
  landEvidence: ev('land', EVIDENCE_GRADE.B_VERIFIED_TRANSACTION),
  replacementCostEvidence: ev('replacement', EVIDENCE_GRADE.E_MARKET_OBSERVATION),
  depreciationEvidence: ev('depreciation', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  valuationDate: '2026-08-31',
});
approx(cost.components.replacementCostNew, 1200000);
approx(cost.components.depreciatedImprovementValue, 900000);
approx(cost.value, 1400000);

// 4) Residual: completed value less explicit deductions, then time discount.
const residual = calculateResidualLandValue({
  completedAssetValue: 10000000,
  developmentCosts: 5000000,
  financeCosts: 500000,
  developerProfit: 1000000,
  contingency: 500000,
  sellingCosts: 0,
  developmentYears: 2,
  discountRate: 0.10,
  completedValueEvidence: ev('completedValue'),
  developmentCostEvidence: ev('developmentCosts'),
  discountRateEvidence: ev('discountRate', EVIDENCE_GRADE.G_EXPERT_ASSUMPTION, INPUT_STATUS.ASSUMED),
  valuationDate: '2026-08-31',
});
approx(residual.components.residualAtCompletion, 3000000);
approx(residual.value, 3000000 / 1.21, 1e-5);

// 5) Reconciliation: no silent averaging; weights + dispersion policy are mandatory.
const r1 = createValuationIndication({
  method: VALUATION_METHOD.MARKET_COMPARABLE,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  value: 1000000,
  valuationDate: '2026-08-31',
  evidence: [createEvidenceRecord(ev('m1'))],
});
const r2 = createValuationIndication({
  method: VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
  basis: BASIS_OF_VALUE.MARKET_VALUE,
  value: 1100000,
  valuationDate: '2026-08-31',
  evidence: [createEvidenceRecord(ev('m2'))],
});
const noPolicy = reconcileValuationIndications({ indications: [r1, r2] });
assert.strictEqual(noPolicy.status, RECONCILIATION_STATUS.HOLD_POLICY_REQUIRED);
assert.strictEqual(noPolicy.reconciledValue, null);

const qualified = reconcileValuationIndications({
  indications: [r1, r2],
  methodWeights: {
    [VALUATION_METHOD.MARKET_COMPARABLE]: 0.6,
    [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: 0.4,
  },
  dispersionThreshold: 0.20,
});
assert.strictEqual(qualified.status, RECONCILIATION_STATUS.QUALIFIED);
approx(qualified.reconciledValue, 1040000);

const dispersionHold = reconcileValuationIndications({
  indications: [r1, r2],
  methodWeights: {
    [VALUATION_METHOD.MARKET_COMPARABLE]: 0.6,
    [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: 0.4,
  },
  dispersionThreshold: 0.05,
});
assert.strictEqual(dispersionHold.status, RECONCILIATION_STATUS.HOLD_DISPERSION);
assert.strictEqual(dispersionHold.reconciledValue, null);

const basisMismatch = reconcileValuationIndications({
  indications: [r1, createValuationIndication({
    method: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
    basis: BASIS_OF_VALUE.INVESTMENT_VALUE,
    value: 1020000,
    valuationDate: '2026-08-31',
    evidence: [createEvidenceRecord(ev('m3'))],
  })],
  methodWeights: {
    [VALUATION_METHOD.MARKET_COMPARABLE]: 0.5,
    [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.5,
  },
  dispersionThreshold: 0.20,
});
assert.strictEqual(basisMismatch.status, RECONCILIATION_STATUS.HOLD_BASIS_MISMATCH);

// 6) Universal planner: routing by traits, never project name.
const warehouse = createProjectProfile({
  projectId: 'WAREHOUSE-A',
  projectName: 'Synthetic Warehouse Case A',
  assetClasses: [ASSET_CLASS.INDUSTRIAL_LOGISTICS],
  lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
  investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
});
const warehouseRenamed = createProjectProfile({
  projectId: 'WAREHOUSE-B',
  projectName: 'Completely Different Project Name',
  assetClasses: [ASSET_CLASS.INDUSTRIAL_LOGISTICS],
  lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
  investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
  incomeModel: INCOME_MODEL.LEASE_INCOME,
});
const warehousePlan = planValuationMethods(warehouse);
const warehousePlanRenamed = planValuationMethods(warehouseRenamed);
assert.deepStrictEqual(warehousePlan.methods, warehousePlanRenamed.methods);
assert.ok(warehousePlan.requiredEvidence.includes('builtArea'));
assert.strictEqual(
  warehousePlan.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION).applicability,
  METHOD_APPLICABILITY.CANDIDATE,
);

const hotel = createProjectProfile({
  projectId: 'HOTEL-A',
  projectName: 'Synthetic Hotel',
  assetClasses: [ASSET_CLASS.HOSPITALITY],
  lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
  investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
  incomeModel: INCOME_MODEL.OPERATING_BUSINESS,
});
const hotelPlan = planValuationMethods(hotel);
assert.strictEqual(
  hotelPlan.methods.find((item) => item.method === VALUATION_METHOD.INCOME_OPERATING_BUSINESS).applicability,
  METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER,
);
assert.strictEqual(
  hotelPlan.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION).applicability,
  METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER,
);
assert.ok(hotelPlan.requiredEvidence.includes('seasonality'));

const land = createProjectProfile({
  projectId: 'LAND-A',
  assetClasses: [ASSET_CLASS.LAND],
  lifecycleStage: LIFECYCLE_STAGE.PLANNED,
  investmentStrategy: INVESTMENT_STRATEGY.DEVELOPMENT,
  incomeModel: INCOME_MODEL.NONE,
});
const landPlan = planValuationMethods(land);
assert.strictEqual(
  landPlan.methods.find((item) => item.method === VALUATION_METHOD.RESIDUAL).applicability,
  METHOD_APPLICABILITY.CANDIDATE,
);

console.log('VALUATION_INTELLIGENCE_V1=PASS');
console.log('NO_PROJECT_NAME_ROUTING=PASS');
console.log('RECONCILIATION_FAIL_CLOSED=PASS');
