'use strict';

const assert = require('assert');
const {
  PROPERTY_INTEREST_TYPE,
  UNIT_TYPE,
  UNIT_OPERATING_STATUS,
  LEASE_LIFECYCLE_STATUS,
  RENT_FREQUENCY,
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  OPERATING_EXPENSE_BASIS,
  OPERATING_EXPENSE_CATEGORY,
  CAPEX_CATEGORY,
  CAPEX_SEVERITY,
  EXIT_STRATEGY_TYPE,
  EXIT_STRATEGY_INPUT_TYPE,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createBuilding,
  createUnit,
  createTenant,
  createLease,
  createOperatingExpense,
  createCapexItem,
  createExitStrategyInput,
  createExitStrategyScenario,
  createResidentialIncomeOperatingCase,
  createUnitAnnualMarketRentInput,
  createStabilizedIncomeInput,
  STABILIZED_INCOME_INPUT_TYPE,
  createAcquisitionBasisInput,
  ACQUISITION_BASIS_INPUT_TYPE,
  EXIT_STRATEGY_COMPARISON_STATUS,
  calculateExitStrategyComparison,
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
} = require('../../src/residential-income-acquisition');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');
const { TENANT_RESULT_STATUS } = require('../../src/tenant-intelligence');

const CASE_ID = 'CASE-RIAI-EXIT-1';
const AS_OF = '2026-09-03';
const ADOPTION_REF = 'adoption://exit/1';

function adopted(field, value, sourceRef, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'EXIT_STRATEGY_REGRESSION_FIXTURE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function marketRent() {
  return createUnitAnnualMarketRentInput({
    unitId: 'UNIT-1',
    value: 1000000,
    sourceRef: 'evidence://market-rent',
    evidenceType: 'QUALIFIED_MARKET_RENT_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function incomeInput(type, value) {
  return createStabilizedIncomeInput({
    type,
    value,
    sourceRef: `evidence://income/${type.toLowerCase()}`,
    evidenceType: 'ADOPTED_STABILIZED_INCOME_POLICY',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function acquisitionInput(type, value) {
  return createAcquisitionBasisInput({
    type,
    value,
    sourceRef: `evidence://acquisition/${type.toLowerCase()}`,
    evidenceType: 'ADOPTED_ACQUISITION_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function exitInput(scenarioId, type, value, overrides = {}) {
  return createExitStrategyInput({
    scenarioId,
    type,
    value,
    sourceRef: `policy://exit/${scenarioId}/${type.toLowerCase()}`,
    evidenceType: 'INVESTMENT_COMMITTEE_EXIT_POLICY',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    ...overrides,
  });
}

function scenario({
  scenarioId,
  strategyType,
  isBenchmark = false,
  timeLimited = false,
  hold = 5,
  capex = 0,
  execution = 0,
  retention = 1,
  noiDelta = 0,
  growth = 0.02,
  annualHoldingCost = 0,
  exitCapRate = 0.075,
  contractualTerminalValue = 0,
  sellingCostRate = 0.02,
  discountRate = 0.08,
  overrideInputs = {},
}) {
  const values = {
    holdPeriodYears: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.HOLD_PERIOD_YEARS, hold),
    strategyCapex: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.STRATEGY_CAPEX, capex),
    executionPeriodYears: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.EXECUTION_PERIOD_YEARS, execution),
    yearOneNoiRetentionRate: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.YEAR_ONE_NOI_RETENTION_RATE, retention),
    stabilizedNoiDelta: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.STABILIZED_NOI_DELTA, noiDelta),
    annualNoiGrowthRate: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE, growth),
    annualHoldingCost: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.ANNUAL_HOLDING_COST, annualHoldingCost),
    sellingCostRate: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.SELLING_COST_RATE, sellingCostRate),
    discountRate: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.DISCOUNT_RATE, discountRate),
    ...(timeLimited
      ? { contractualTerminalValue: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE, contractualTerminalValue) }
      : { exitCapRate: exitInput(scenarioId, EXIT_STRATEGY_INPUT_TYPE.EXIT_CAP_RATE, exitCapRate) }),
    ...overrideInputs,
  };
  return createExitStrategyScenario({
    caseId: CASE_ID,
    scenarioId,
    strategyType,
    label: scenarioId,
    isBenchmark,
    inputs: values,
  });
}

function defaultFreeholdScenarios() {
  return [
    scenario({ scenarioId: 'HOLD-BASE', strategyType: EXIT_STRATEGY_TYPE.HOLD_AS_IS, isBenchmark: true }),
    scenario({
      scenarioId: 'REPOSITION',
      strategyType: EXIT_STRATEGY_TYPE.RENOVATE_AND_REPOSITION,
      capex: 500000,
      execution: 2,
      retention: 0.7,
      noiDelta: 250000,
      growth: 0.025,
      annualHoldingCost: 20000,
      exitCapRate: 0.0725,
    }),
  ];
}

function buildCase({
  exitScenarios = defaultFreeholdScenarios(),
  interestType = PROPERTY_INTEREST_TYPE.FREEHOLD,
  expiryDate = null,
} = {}) {
  const propertyInterest = createPropertyInterest({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: 'PROPERTY-1',
    interestType,
    commencementDate: interestType === PROPERTY_INTEREST_TYPE.FREEHOLD ? null : AS_OF,
    expiryDate,
    interestEvidenceRef: 'evidence://interest',
    interestAdoptionDecisionRef: ADOPTION_REF,
    titleAssessment: {
      caseId: CASE_ID,
      propertyId: 'PROPERTY-1',
      status: TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS,
      blockers: [],
      legalReviewFlags: [],
    },
    titleAssessmentRef: 'assessment://title',
    legalReviewRef: interestType === PROPERTY_INTEREST_TYPE.FREEHOLD ? null : 'review://interest/legal',
  });
  const property = createProperty({ caseId: CASE_ID, propertyId: 'PROPERTY-1', buildingIds: ['BUILDING-1'] });
  const building = createBuilding({ caseId: CASE_ID, propertyId: 'PROPERTY-1', buildingId: 'BUILDING-1', unitIds: ['UNIT-1'] });
  const unit = createUnit({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: 'PROPERTY-1',
    buildingId: 'BUILDING-1',
    unitId: 'UNIT-1',
    unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
    operatingStatus: adopted('unit.1.status', UNIT_OPERATING_STATUS.OCCUPIED, 'evidence://unit/status'),
    rentableArea: adopted('unit.1.area', 100, 'evidence://unit/area', 'm2'),
    leaseIds: ['LEASE-1'],
  });
  const tenant = createTenant({
    caseId: CASE_ID,
    tenantId: 'TENANT-1',
    tenantAssessment: {
      tenantId: 'TENANT-1',
      status: TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE,
      score: 0.9,
      assessedWeight: 1,
      prohibitedClaims: ['CREDIT_RATING'],
    },
    tenantAssessmentRef: 'assessment://tenant',
  });
  const lease = createLease({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: 'PROPERTY-1',
    buildingId: 'BUILDING-1',
    unitId: 'UNIT-1',
    leaseId: 'LEASE-1',
    tenantId: 'TENANT-1',
    lifecycleStatus: LEASE_LIFECYCLE_STATUS.ACTIVE,
    startDate: '2026-01-01',
    endDate: '2032-01-01',
    baseRent: adopted('lease.1.baseRent', 1000000, 'evidence://lease/rent', 'SAR/year'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    termsEvidenceRef: 'evidence://lease/terms',
    termsAdoptionDecisionRef: ADOPTION_REF,
  });
  const operatingExpense = createOperatingExpense({
    caseId: CASE_ID,
    expenseId: 'OPEX-1',
    propertyId: 'PROPERTY-1',
    category: OPERATING_EXPENSE_CATEGORY.MAINTENANCE,
    basis: OPERATING_EXPENSE_BASIS.NORMALIZED,
    annualAmount: adopted('opex.normalized', 200000, 'evidence://opex', 'SAR/year'),
  });
  const capex = createCapexItem({
    caseId: CASE_ID,
    capexItemId: 'CAPEX-1',
    propertyId: 'PROPERTY-1',
    category: CAPEX_CATEGORY.ROOF_WATERPROOFING,
    severity: CAPEX_SEVERITY.HIGH,
    estimatedCost: adopted('capex.immediate', 100000, 'evidence://capex', 'SAR'),
    immediate: true,
  });
  const additionalOperatingInputs = [
    marketRent(),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE, 0),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE, 0),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_CONCESSIONS, 0),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_OTHER_OPERATING_INCOME, 0),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE, 8000000),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.TRANSACTION_COSTS, 100000),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_TENANT_IMPROVEMENTS, 0),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_LEASING_COSTS, 0),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES, 0),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS, 4000000),
  ];
  const fixedRefs = new Map([
    ['evidence://interest', LINEAGE_KIND.SOURCE_DOCUMENT],
    ['assessment://title', LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    ['assessment://tenant', LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    ['review://interest/legal', LINEAGE_KIND.LEGAL_REVIEW],
    ['identity://reviewer/1', LINEAGE_KIND.HUMAN_IDENTITY],
    ['policy://exit/approved', LINEAGE_KIND.POLICY],
    ['evidence://unit/status', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://unit/area', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://lease/rent', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://lease/terms', LINEAGE_KIND.SOURCE_DOCUMENT],
    ['evidence://opex', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://capex', LINEAGE_KIND.EVIDENCE_FACT],
    [ADOPTION_REF, LINEAGE_KIND.UNDERWRITING_ADOPTION],
  ]);
  const refs = [...new Set([
    ...fixedRefs.keys(),
    ...additionalOperatingInputs.flatMap((input) => input.lineageRefs),
    ...exitScenarios.flatMap((item) => Object.values(item.inputs).flatMap((input) => input.lineageRefs)),
  ])];
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest,
    property,
    buildings: [building],
    units: [unit],
    leases: [lease],
    tenants: [tenant],
    operatingExpenses: [operatingExpense],
    capexItems: [capex],
    exitScenarios,
    additionalOperatingInputs,
    evidenceLineage: refs.map((ref) => createEvidenceLineageRecord({
      caseId: CASE_ID,
      refId: ref,
      kind: fixedRefs.get(ref) || LINEAGE_KIND.EVIDENCE_FACT,
      recordedAt: '2026-09-03T12:00:00Z',
    })),
  });
}

const complete = buildCase();
const result = calculateExitStrategyComparison(complete);
assert.strictEqual(result.status, EXIT_STRATEGY_COMPARISON_STATUS.CALCULATED);
assert.strictEqual(result.exitStrategyComparisonCalculated, true);
assert.strictEqual(result.financialCalculationExecuted, true);
assert.strictEqual(result.valuationCalculated, false);
assert.strictEqual(result.recommendedStrategy, null);
assert.strictEqual(result.investmentDecision, null);
assert.strictEqual(result.transactionAuthorized, false);
assert.strictEqual(result.benchmarkScenarioId, 'HOLD-BASE');
assert.strictEqual(result.scenarioResults.length, 2);
assert.strictEqual(result.ranking.length, 2);
assert.strictEqual(result.highestModeledNpvScenario.scenarioId, 'REPOSITION');
assert.ok(result.highestModeledNpvScenario.valueCreationVsBenchmarkNpv > 0);
assert.strictEqual(result.scenarioResults.find((item) => item.scenarioId === 'HOLD-BASE').valueCreationVsBenchmarkNpv, 0);
assert.ok(result.scenarioResults.every((item) => item.cashflows.length === item.holdPeriodYears + 1));
assert.ok(result.scenarioResults.every((item) => item.terminalValue.basis === 'FORWARD_NOI_CAPITALIZATION'));
assert.strictEqual(result.calculationBasis, 'UNLEVERED_ANNUAL_CASH_FLOW');
assert.ok(result.scenarioResults.every((item) => item.inputLineage.discountRate.sourceRef));
assert.ok(result.scenarioResults.every((item) => item.inputLineage.strategyCapex.adoptionDecisionRef === ADOPTION_REF));
assert.match(result.semantics, /not a certified valuation/i);

const higherCapex = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    defaultFreeholdScenarios()[0],
    scenario({ scenarioId: 'REPOSITION', strategyType: EXIT_STRATEGY_TYPE.RENOVATE_AND_REPOSITION, capex: 1000000, execution: 2, retention: 0.7, noiDelta: 250000, growth: 0.025, annualHoldingCost: 20000, exitCapRate: 0.0725 }),
  ],
}));
const baseRepositionNpv = result.scenarioResults.find((item) => item.scenarioId === 'REPOSITION').metrics.npv;
const higherCapexNpv = higherCapex.scenarioResults.find((item) => item.scenarioId === 'REPOSITION').metrics.npv;
assert.ok(higherCapexNpv < baseRepositionNpv);

const weakerExit = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    defaultFreeholdScenarios()[0],
    scenario({ scenarioId: 'REPOSITION', strategyType: EXIT_STRATEGY_TYPE.RENOVATE_AND_REPOSITION, capex: 500000, execution: 2, retention: 0.7, noiDelta: 250000, growth: 0.025, annualHoldingCost: 20000, exitCapRate: 0.09 }),
  ],
}));
assert.ok(weakerExit.scenarioResults.find((item) => item.scenarioId === 'REPOSITION').metrics.npv < baseRepositionNpv);

const view = createResidentialIncomeAcquisitionViewModel(complete);
assert.strictEqual(view.capabilityStatus, 'STRATEGIC_ASSET_INTELLIGENCE_V1');
assert.strictEqual(view.exitStrategyComparisonCalculated, true);
assert.strictEqual(view.exitStrategyComparison.highestModeledNpvScenario.scenarioId, 'REPOSITION');
assert.strictEqual(view.investmentDecision, null);

const hydrated = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(complete)));
assert.strictEqual(hydrated.exitScenarios.length, 2);
assert.strictEqual(calculateExitStrategyComparison(hydrated).highestModeledNpvScenario.scenarioId, 'REPOSITION');

const noBenchmark = calculateExitStrategyComparison(buildCase({
  exitScenarios: defaultFreeholdScenarios().map((item) => createExitStrategyScenario({
    caseId: item.caseId,
    scenarioId: item.scenarioId,
    strategyType: item.strategyType,
    label: item.label,
    isBenchmark: false,
    inputs: item.inputs,
  })),
}));
assert.strictEqual(noBenchmark.status, EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE);
assert.ok(noBenchmark.issues.some((issue) => issue.code === 'EXACTLY_ONE_EXIT_BENCHMARK_REQUIRED'));

const missingExitCapScenario = scenario({ scenarioId: 'MISSING-CAP', strategyType: EXIT_STRATEGY_TYPE.RENOVATE_AND_REPOSITION, capex: 1, noiDelta: 1 });
const missingExitCap = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    defaultFreeholdScenarios()[0],
    createExitStrategyScenario({
      caseId: CASE_ID,
      scenarioId: missingExitCapScenario.scenarioId,
      strategyType: missingExitCapScenario.strategyType,
      inputs: Object.fromEntries(Object.entries(missingExitCapScenario.inputs).filter(([key]) => key !== 'exitCapRate')),
    }),
  ],
}));
assert.strictEqual(missingExitCap.status, EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE);
assert.ok(missingExitCap.issues.some((issue) => issue.field === 'exit.MISSING-CAP.exitCapRate'));

const passiveWithUpside = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    scenario({ scenarioId: 'PASSIVE-BAD', strategyType: EXIT_STRATEGY_TYPE.HOLD_AS_IS, isBenchmark: true, capex: 100 }),
    defaultFreeholdScenarios()[1],
  ],
}));
assert.strictEqual(passiveWithUpside.status, EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE);
assert.ok(passiveWithUpside.issues.some((issue) => issue.code === 'PASSIVE_EXIT_STRATEGY_CANNOT_CARRY_ACTION_UPSIDE'));

const inconsistentDiscountRates = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    defaultFreeholdScenarios()[0],
    scenario({ scenarioId: 'RATE-MISMATCH', strategyType: EXIT_STRATEGY_TYPE.RENOVATE_AND_REPOSITION, capex: 1, noiDelta: 1, discountRate: 0.09 }),
  ],
}));
assert.strictEqual(inconsistentDiscountRates.status, EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE);
assert.ok(inconsistentDiscountRates.issues.some((issue) => issue.code === 'EXIT_SCENARIOS_REQUIRE_COMMON_DISCOUNT_RATE'));

const timeLimitedScenarios = [
  scenario({ scenarioId: 'USUFRUCT-HOLD', strategyType: EXIT_STRATEGY_TYPE.HOLD_TO_INTEREST_EXPIRY, isBenchmark: true, timeLimited: true, hold: 10 }),
  scenario({ scenarioId: 'USUFRUCT-RELEASE', strategyType: EXIT_STRATEGY_TYPE.RE_LEASE_AND_HOLD, timeLimited: true, hold: 8, capex: 100000, execution: 1, noiDelta: 100000 }),
];
const usufruct = calculateExitStrategyComparison(buildCase({
  exitScenarios: timeLimitedScenarios,
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  expiryDate: '2040-09-03',
}));
assert.strictEqual(usufruct.status, EXIT_STRATEGY_COMPARISON_STATUS.CALCULATED);
assert.ok(usufruct.scenarioResults.every((item) => item.terminalValue.basis === 'ADOPTED_CONTRACTUAL_TERMINAL_VALUE'));
assert.ok(usufruct.scenarioResults.every((item) => item.terminalValue.gross === 0));

const excessiveTerm = calculateExitStrategyComparison(buildCase({
  exitScenarios: [
    scenario({ scenarioId: 'TERM-BASE', strategyType: EXIT_STRATEGY_TYPE.HOLD_TO_INTEREST_EXPIRY, isBenchmark: true, timeLimited: true, hold: 20 }),
    scenario({ scenarioId: 'TERM-ACTIVE', strategyType: EXIT_STRATEGY_TYPE.RE_LEASE_AND_HOLD, timeLimited: true, hold: 8, capex: 1, noiDelta: 1 }),
  ],
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  expiryDate: '2040-09-03',
}));
assert.strictEqual(excessiveTerm.status, EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE);
assert.ok(excessiveTerm.issues.some((issue) => issue.code === 'EXIT_HOLD_PERIOD_EXCEEDS_PROPERTY_INTEREST_TERM'));

const assumedGrowth = createExitStrategyInput({
  scenarioId: 'REPOSITION',
  type: EXIT_STRATEGY_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE,
  value: 0.025,
  evidenceType: 'EXPLICIT_EXIT_ASSUMPTION',
  effectiveDate: AS_OF,
  verificationStatus: OPERATING_INPUT_STATUS.ASSUMED,
  adoptedForUnderwriting: true,
  adoptionDecisionRef: ADOPTION_REF,
  assumptionOverride: {
    reason: 'Approved exit-scenario NOI growth assumption',
    approvedByRef: 'identity://reviewer/1',
    approvedAt: '2026-09-03T11:00:00Z',
    policyRef: 'policy://exit/approved',
  },
});
const assumedScenarioBase = defaultFreeholdScenarios()[1];
const assumedScenario = createExitStrategyScenario({
  caseId: CASE_ID,
  scenarioId: assumedScenarioBase.scenarioId,
  strategyType: assumedScenarioBase.strategyType,
  inputs: { ...assumedScenarioBase.inputs, annualNoiGrowthRate: assumedGrowth },
});
const assumedResult = calculateExitStrategyComparison(buildCase({ exitScenarios: [defaultFreeholdScenarios()[0], assumedScenario] }));
assert.strictEqual(assumedResult.status, EXIT_STRATEGY_COMPARISON_STATUS.CALCULATED_WITH_ASSUMPTIONS);
assert.strictEqual(assumedResult.assumedInputCount, 1);

console.log('RESIDENTIAL_INCOME_EXIT_STRATEGY_V1=PASS');
console.log('EVIDENCE_GATED_SCENARIO_COMPARISON=PASS');
console.log('TENURE_AWARE_TERMINAL_VALUE=PASS');
console.log('ANALYTICAL_RANKING_NOT_RECOMMENDATION=PASS');
console.log('NO_AUTO_DECISION_OR_TRANSACTION_AUTHORIZATION=PASS');
