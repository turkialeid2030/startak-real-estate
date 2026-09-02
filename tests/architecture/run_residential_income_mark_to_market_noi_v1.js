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
  createResidentialIncomeOperatingCase,
  createUnitAnnualMarketRentInput,
  createStabilizedIncomeInput,
  STABILIZED_INCOME_INPUT_TYPE,
  INCOME_ANALYSIS_STATUS,
  MARK_TO_MARKET_CLASS,
  calculateIncomeAnalysis,
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
} = require('../../src/residential-income-acquisition');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');
const { TENANT_RESULT_STATUS } = require('../../src/tenant-intelligence');

const CASE_ID = 'CASE-RIAI-INCOME-1';
const PROPERTY_ID = 'PROPERTY-1';
const BUILDING_ID = 'BUILDING-1';
const ADOPTION_REF = 'adoption://income/1';
const AS_OF = '2026-09-02';

function lineage(caseId, refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId, refId, kind, recordedAt: '2026-09-02T12:00:00Z' });
}

function adopted(field, value, sourceRef, unit = null, effectiveDate = AS_OF) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'INCOME_ANALYSIS_REGRESSION_FIXTURE',
    effectiveDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function marketRent(unitId, value, sourceRef, overrides = {}) {
  return createUnitAnnualMarketRentInput({
    unitId,
    value,
    sourceRef,
    evidenceType: 'QUALIFIED_MARKET_RENT_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    ...overrides,
  });
}

function incomeInput(type, value, sourceRef, overrides = {}) {
  return createStabilizedIncomeInput({
    type,
    value,
    sourceRef,
    evidenceType: 'ADOPTED_STABILIZED_INCOME_POLICY',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    ...overrides,
  });
}

function buildCase({ caseId = CASE_ID, extraInputs = [], replaceInputs = null, operatingExpenses = null } = {}) {
  const propertyInterest = createPropertyInterest({
    caseId,
    propertyInterestId: 'INTEREST-1',
    propertyId: PROPERTY_ID,
    interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
    interestEvidenceRef: 'evidence://interest',
    interestAdoptionDecisionRef: ADOPTION_REF,
    titleAssessment: {
      caseId,
      propertyId: PROPERTY_ID,
      status: TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS,
      blockers: [],
      legalReviewFlags: [],
    },
    titleAssessmentRef: 'assessment://title',
  });
  const property = createProperty({ caseId, propertyId: PROPERTY_ID, buildingIds: [BUILDING_ID] });
  const building = createBuilding({
    caseId,
    propertyId: PROPERTY_ID,
    buildingId: BUILDING_ID,
    unitIds: ['UNIT-1', 'UNIT-2'],
  });
  const units = [
    createUnit({
      caseId,
      propertyInterestId: 'INTEREST-1',
      propertyId: PROPERTY_ID,
      buildingId: BUILDING_ID,
      unitId: 'UNIT-1',
      unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
      operatingStatus: adopted('unit.1.status', UNIT_OPERATING_STATUS.OCCUPIED, 'evidence://unit/1/status'),
      rentableArea: adopted('unit.1.area', 100, 'evidence://unit/1/area', 'm2'),
      leaseIds: ['LEASE-1'],
    }),
    createUnit({
      caseId,
      propertyInterestId: 'INTEREST-1',
      propertyId: PROPERTY_ID,
      buildingId: BUILDING_ID,
      unitId: 'UNIT-2',
      unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
      operatingStatus: adopted('unit.2.status', UNIT_OPERATING_STATUS.VACANT, 'evidence://unit/2/status'),
      rentableArea: adopted('unit.2.area', 80, 'evidence://unit/2/area', 'm2'),
      leaseIds: [],
    }),
  ];
  const tenant = createTenant({
    caseId,
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
    caseId,
    propertyInterestId: 'INTEREST-1',
    propertyId: PROPERTY_ID,
    buildingId: BUILDING_ID,
    unitId: 'UNIT-1',
    leaseId: 'LEASE-1',
    tenantId: 'TENANT-1',
    lifecycleStatus: LEASE_LIFECYCLE_STATUS.ACTIVE,
    startDate: '2026-01-01',
    endDate: '2031-01-01',
    baseRent: adopted('lease.1.baseRent', 100000, 'evidence://lease/rent', 'SAR/year'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    termsEvidenceRef: 'evidence://lease/terms',
    termsAdoptionDecisionRef: ADOPTION_REF,
  });
  const defaultExpenses = [createOperatingExpense({
    caseId,
    expenseId: 'OPEX-NORMALIZED',
    propertyId: PROPERTY_ID,
    category: OPERATING_EXPENSE_CATEGORY.MAINTENANCE,
    basis: OPERATING_EXPENSE_BASIS.NORMALIZED,
    annualAmount: adopted('opex.normalized', 50000, 'evidence://opex', 'SAR/year'),
  })];
  const capex = createCapexItem({
    caseId,
    capexItemId: 'CAPEX-1',
    propertyId: PROPERTY_ID,
    category: CAPEX_CATEGORY.ROOF_WATERPROOFING,
    severity: CAPEX_SEVERITY.MEDIUM,
    estimatedCost: adopted('capex.roof', 20000, 'evidence://capex', 'SAR'),
  });
  const defaultInputs = [
    marketRent('UNIT-1', 120000, 'evidence://market/unit-1'),
    marketRent('UNIT-2', 80000, 'evidence://market/unit-2'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE, 0.05, 'evidence://income/vacancy'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE, 0.02, 'evidence://income/credit'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_CONCESSIONS, 2000, 'evidence://income/concessions'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_OTHER_OPERATING_INCOME, 6000, 'evidence://income/other'),
  ];
  const additionalOperatingInputs = replaceInputs || [...defaultInputs, ...extraInputs];
  const sourceRefs = [
    'evidence://interest',
    'assessment://title',
    'assessment://tenant',
    'evidence://unit/1/status',
    'evidence://unit/1/area',
    'evidence://unit/2/status',
    'evidence://unit/2/area',
    'evidence://lease/rent',
    'evidence://lease/terms',
    'evidence://opex',
    'evidence://capex',
    ...additionalOperatingInputs.flatMap((input) => input.lineageRefs),
  ];
  const kindByRef = {
    'evidence://interest': LINEAGE_KIND.SOURCE_DOCUMENT,
    'assessment://title': LINEAGE_KIND.ANALYTICAL_ASSESSMENT,
    'assessment://tenant': LINEAGE_KIND.ANALYTICAL_ASSESSMENT,
    'evidence://lease/terms': LINEAGE_KIND.SOURCE_DOCUMENT,
    'identity://reviewer/1': LINEAGE_KIND.HUMAN_IDENTITY,
    'policy://income/1': LINEAGE_KIND.POLICY,
    [ADOPTION_REF]: LINEAGE_KIND.UNDERWRITING_ADOPTION,
  };
  const uniqueRefs = [...new Set([...sourceRefs, ADOPTION_REF])];
  return createResidentialIncomeOperatingCase({
    caseId,
    asOfDate: AS_OF,
    propertyInterest,
    property,
    buildings: [building],
    units,
    leases: [lease],
    tenants: [tenant],
    operatingExpenses: operatingExpenses === null ? defaultExpenses : operatingExpenses,
    capexItems: [capex],
    additionalOperatingInputs,
    evidenceLineage: uniqueRefs.map((refId) => lineage(caseId, refId, kindByRef[refId] || LINEAGE_KIND.EVIDENCE_FACT)),
  });
}

const completeCase = buildCase();
const analysis = calculateIncomeAnalysis(completeCase);
assert.strictEqual(analysis.status, INCOME_ANALYSIS_STATUS.CALCULATED);
assert.strictEqual(analysis.markToMarket.totals.totalAnnualContractRent, 100000);
assert.strictEqual(analysis.markToMarket.totals.totalAnnualMarketRent, 200000);
assert.strictEqual(analysis.markToMarket.totals.headlineAnnualRentDelta, 100000);
assert.strictEqual(analysis.markToMarket.totals.headlineMarkToMarketRatio, 1);
assert.strictEqual(analysis.markToMarket.rows[0].classification, MARK_TO_MARKET_CLASS.POSITIVE_REVERSION);
assert.strictEqual(analysis.markToMarket.rows[1].classification, MARK_TO_MARKET_CLASS.VACANT_MARKET_OPPORTUNITY);
assert.strictEqual(analysis.markToMarket.realizableAnnualRentDelta, null);
assert.strictEqual(analysis.stabilizedIncome.potentialGrossIncome, 200000);
assert.strictEqual(analysis.stabilizedIncome.vacancyLoss, 10000);
assert.strictEqual(analysis.stabilizedIncome.creditLoss, 4000);
assert.strictEqual(analysis.stabilizedIncome.effectiveGrossIncome, 190000);
assert.strictEqual(analysis.stabilizedIncome.normalizedAnnualOpex, 50000);
assert.strictEqual(analysis.stabilizedIncome.stabilizedNoi, 140000);
assert.strictEqual(analysis.stabilizedIncome.stabilizedNoiMargin, 140000 / 190000);
assert.ok(analysis.stabilizedIncome.excludedFromNoi.includes('DEBT_SERVICE'));
assert.ok(analysis.stabilizedIncome.excludedFromNoi.includes('CAPITAL_IMPROVEMENTS'));
assert.strictEqual(analysis.financialCalculationExecuted, true);
assert.strictEqual(analysis.valuationCalculated, false);
assert.strictEqual(analysis.investmentDecision, null);

const view = createResidentialIncomeAcquisitionViewModel(completeCase);
assert.strictEqual(view.incomeAnalysis.stabilizedIncome.stabilizedNoi, 140000);
assert.strictEqual(view.financialCalculationExecuted, true);
assert.strictEqual(view.stabilizedNoiCalculated, true);
assert.strictEqual(view.investmentDecision, null);
assert.strictEqual(view.transactionAuthorized, false);

const hydratedCase = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(completeCase)));
const hydratedAnalysis = calculateIncomeAnalysis(hydratedCase);
assert.strictEqual(hydratedAnalysis.stabilizedIncome.stabilizedNoi, 140000);
assert.strictEqual(hydratedAnalysis.markToMarket.totals.headlineAnnualRentDelta, 100000);

const baseInputs = completeCase.additionalOperatingInputs;
const missingUnitMarket = buildCase({ replaceInputs: baseInputs.filter((input) => input.field !== 'unit.UNIT-2.annualMarketRent') });
const missingAnalysis = calculateIncomeAnalysis(missingUnitMarket);
assert.strictEqual(missingAnalysis.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(missingAnalysis.issues.some((item) => item.field === 'unit.UNIT-2.annualMarketRent'));
assert.strictEqual(missingAnalysis.stabilizedNoiCalculated, false);

const duplicateMarket = buildCase({ extraInputs: [marketRent('UNIT-1', 125000, 'evidence://market/unit-1/duplicate')] });
const duplicateAnalysis = calculateIncomeAnalysis(duplicateMarket);
assert.strictEqual(duplicateAnalysis.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(duplicateAnalysis.issues.some((item) => item.code === 'DUPLICATE_INCOME_INPUT'));

const orphanMarket = buildCase({ extraInputs: [marketRent('UNIT-404', 50000, 'evidence://market/orphan')] });
const orphanAnalysis = calculateIncomeAnalysis(orphanMarket);
assert.strictEqual(orphanAnalysis.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(orphanAnalysis.issues.some((item) => item.code === 'MARKET_RENT_UNIT_REFERENCE_MISSING'));

const excessiveLossInputs = baseInputs.map((input) => {
  if (input.field === 'income.stabilizedVacancyLossRate') {
    return incomeInput(STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE, 0.8, 'evidence://income/vacancy-high');
  }
  if (input.field === 'income.stabilizedCreditLossRate') {
    return incomeInput(STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE, 0.3, 'evidence://income/credit-high');
  }
  return input;
});
const excessiveLossAnalysis = calculateIncomeAnalysis(buildCase({ replaceInputs: excessiveLossInputs }));
assert.strictEqual(excessiveLossAnalysis.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(excessiveLossAnalysis.issues.some((item) => item.code === 'COMBINED_INCOME_LOSS_RATE_EXCEEDS_ONE'));

const futureMarketInputs = baseInputs.map((input) => (input.field === 'unit.UNIT-1.annualMarketRent'
  ? marketRent('UNIT-1', 120000, 'evidence://market/unit-1/future', { effectiveDate: '2027-01-01' })
  : input));
const futureAnalysis = calculateIncomeAnalysis(buildCase({ replaceInputs: futureMarketInputs }));
assert.strictEqual(futureAnalysis.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(futureAnalysis.issues.some((item) => item.code === 'FUTURE_EFFECTIVE_INCOME_INPUT'));

const noNormalizedOpex = calculateIncomeAnalysis(buildCase({ operatingExpenses: [] }));
assert.strictEqual(noNormalizedOpex.status, INCOME_ANALYSIS_STATUS.NOT_CALCULABLE);
assert.ok(noNormalizedOpex.issues.some((item) => item.code === 'COMPLETE_NORMALIZED_OPEX_REQUIRED'));

const assumedVacancyInputs = baseInputs.map((input) => (input.field === 'income.stabilizedVacancyLossRate'
  ? createStabilizedIncomeInput({
    type: STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE,
    value: 0.05,
    evidenceType: 'EXPLICIT_UNDERWRITING_ASSUMPTION',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.ASSUMED,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    assumptionOverride: {
      reason: 'Approved stabilized vacancy assumption',
      approvedByRef: 'identity://reviewer/1',
      approvedAt: '2026-09-02T11:00:00Z',
      policyRef: 'policy://income/1',
    },
  })
  : input));
const assumedCase = buildCase({ replaceInputs: assumedVacancyInputs });
const assumedAnalysis = calculateIncomeAnalysis(assumedCase);
assert.strictEqual(assumedAnalysis.status, INCOME_ANALYSIS_STATUS.CALCULATED_WITH_ASSUMPTIONS);
assert.strictEqual(assumedAnalysis.assumedInputCount, 1);

console.log('RESIDENTIAL_INCOME_MARK_TO_MARKET_NOI_V1=PASS');
console.log('MARKET_RENT_REQUIRED_FOR_EVERY_UNIT=PASS');
console.log('LOSS_AND_OPEX_GATES_FAIL_CLOSED=PASS');
console.log('STABILIZED_NOI_EXCLUDES_CAPEX_AND_DEBT=PASS');
console.log('REALIZABLE_REVERSION_REMAINS_UNCALCULATED=PASS');
console.log('NO_VALUE_PRICE_RETURN_OR_DECISION_CLAIM=PASS');
