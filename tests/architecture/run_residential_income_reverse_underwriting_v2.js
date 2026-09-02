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
  createAcquisitionBasisInput,
  ACQUISITION_BASIS_INPUT_TYPE,
  createReverseUnderwritingInput,
  REVERSE_UNDERWRITING_INPUT_TYPE,
  REVERSE_UNDERWRITING_STATUS,
  REVERSE_UNDERWRITING_OUTCOME,
  PRICE_LIMIT_STATUS,
  calculateReverseUnderwriting,
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
} = require('../../src/residential-income-acquisition');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');
const { TENANT_RESULT_STATUS } = require('../../src/tenant-intelligence');

const CASE_ID = 'CASE-RIAI-REVERSE-1';
const AS_OF = '2026-09-02';
const ADOPTION_REF = 'adoption://reverse/1';

function lineage(caseId, refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId, refId, kind, recordedAt: '2026-09-02T12:00:00Z' });
}

function adopted(field, value, sourceRef, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'REVERSE_UNDERWRITING_REGRESSION_FIXTURE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function marketRent(value = 1000000) {
  return createUnitAnnualMarketRentInput({
    unitId: 'UNIT-1',
    value,
    sourceRef: 'evidence://market-rent',
    evidenceType: 'QUALIFIED_MARKET_RENT_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function incomeInput(type, value, ref) {
  return createStabilizedIncomeInput({
    type,
    value,
    sourceRef: ref,
    evidenceType: 'ADOPTED_STABILIZED_INCOME_POLICY',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function acquisitionInput(type, value, ref) {
  return createAcquisitionBasisInput({
    type,
    value,
    sourceRef: ref,
    evidenceType: 'ADOPTED_ACQUISITION_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function reverseInput(type, value, ref = `policy://reverse/${type.toLowerCase()}`, overrides = {}) {
  return createReverseUnderwritingInput({
    type,
    value,
    sourceRef: ref,
    evidenceType: 'INVESTMENT_COMMITTEE_POLICY',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    ...overrides,
  });
}

function defaultReverseInputs({ timeLimited = false } = {}) {
  const values = [
    [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_UNLEVERED_IRR, 0.08],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_EQUITY_MULTIPLE, 1.3],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_CASH_ON_CASH, 0.05],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_DSCR, 1.25],
    [REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV, 0.5],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MAX_LTV, 0.65],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT, 6000000],
    [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_STABILIZED_YIELD, 0.07],
    [REVERSE_UNDERWRITING_INPUT_TYPE.HOLD_PERIOD_YEARS, 5],
    [REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE, 0.02],
    [REVERSE_UNDERWRITING_INPUT_TYPE.SELLING_COST_RATE, 0.02],
    [REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_DEBT_RATE, 0.05],
    [REVERSE_UNDERWRITING_INPUT_TYPE.DEBT_AMORTIZATION_YEARS, 20],
    timeLimited
      ? [REVERSE_UNDERWRITING_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE, 0]
      : [REVERSE_UNDERWRITING_INPUT_TYPE.EXIT_CAP_RATE, 0.075],
  ];
  return values.map(([type, value]) => reverseInput(type, value));
}

function buildCase({
  reverseInputs = defaultReverseInputs(),
  interestType = PROPERTY_INTEREST_TYPE.FREEHOLD,
  expiryDate = null,
  purchasePrice = 8000000,
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
    endDate: '2031-01-01',
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
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE, 0, 'evidence://income/vacancy'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE, 0, 'evidence://income/credit'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_CONCESSIONS, 0, 'evidence://income/concessions'),
    incomeInput(STABILIZED_INCOME_INPUT_TYPE.ANNUAL_OTHER_OPERATING_INCOME, 0, 'evidence://income/other'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE, purchasePrice, 'evidence://acquisition/price'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.TRANSACTION_COSTS, 100000, 'evidence://acquisition/transaction'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_TENANT_IMPROVEMENTS, 0, 'evidence://acquisition/ti'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_LEASING_COSTS, 0, 'evidence://acquisition/leasing'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES, 0, 'evidence://acquisition/reserves'),
    acquisitionInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS, 4000000, 'evidence://acquisition/debt'),
    ...reverseInputs,
  ];
  const fixedRefs = [
    ['evidence://interest', LINEAGE_KIND.SOURCE_DOCUMENT],
    ['assessment://title', LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    ['assessment://tenant', LINEAGE_KIND.ANALYTICAL_ASSESSMENT],
    ['review://interest/legal', LINEAGE_KIND.LEGAL_REVIEW],
    ['identity://reviewer/1', LINEAGE_KIND.HUMAN_IDENTITY],
    ['policy://reverse/approved', LINEAGE_KIND.POLICY],
    ['evidence://unit/status', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://unit/area', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://lease/rent', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://lease/terms', LINEAGE_KIND.SOURCE_DOCUMENT],
    ['evidence://opex', LINEAGE_KIND.EVIDENCE_FACT],
    ['evidence://capex', LINEAGE_KIND.EVIDENCE_FACT],
    [ADOPTION_REF, LINEAGE_KIND.UNDERWRITING_ADOPTION],
  ];
  const kindByRef = new Map(fixedRefs);
  const refs = [...new Set([
    ...fixedRefs.map(([ref]) => ref),
    ...additionalOperatingInputs.flatMap((input) => input.lineageRefs),
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
    additionalOperatingInputs,
    evidenceLineage: refs.map((ref) => lineage(CASE_ID, ref, kindByRef.get(ref) || LINEAGE_KIND.EVIDENCE_FACT)),
  });
}

const completeCase = buildCase();
const result = calculateReverseUnderwriting(completeCase);
assert.strictEqual(result.status, REVERSE_UNDERWRITING_STATUS.CALCULATED);
assert.strictEqual(result.reverseUnderwritingCalculated, true);
assert.strictEqual(result.acquisitionPriceCalculated, true);
assert.strictEqual(result.valuationCalculated, false);
assert.strictEqual(result.investmentDecision, null);
assert.strictEqual(result.transactionAuthorized, false);
assert.strictEqual(result.priceLimits.length, 6);
assert.ok(result.priceLimits.every((limit) => limit.status === PRICE_LIMIT_STATUS.SOLVED));
assert.ok(result.maximumJustifiedPurchasePrice > 8000000);
assert.strictEqual(result.maximumJustifiedPurchasePrice, Math.min(...result.priceLimits.map((limit) => limit.maximumPurchasePrice)));
assert.strictEqual(result.bindingConstraint.maximumPurchasePrice, result.maximumJustifiedPurchasePrice);
assert.strictEqual(result.outcome, REVERSE_UNDERWRITING_OUTCOME.CURRENT_PRICE_WITHIN_ALL_LIMITS);
assert.strictEqual(result.currentPriceAnalysis.allConstraintsPassed, true);
assert.strictEqual(result.currentPriceAnalysis.metrics.actualLtv, 0.5);
assert.ok(result.currentPriceAnalysis.metrics.unleveredIrr >= 0.08);
assert.ok(result.currentPriceAnalysis.metrics.dscr >= 1.25);
const yieldLimit = result.priceLimits.find((limit) => limit.code === 'MAX_PRICE_BY_STABILIZED_YIELD');
assert.ok(Math.abs(yieldLimit.maximumPurchasePrice - ((800000 / 0.07) - 200000)) <= 1);
const equityCapLimit = result.priceLimits.find((limit) => limit.code === 'MAX_PRICE_BY_LTV_AND_EQUITY_CAP');
assert.ok(Math.abs(equityCapLimit.maximumPurchasePrice - ((6000000 / (1 - 0.65)) - 200000)) <= 1);
assert.strictEqual(equityCapLimit.policyInputField, 'reverse.maxEquityCommitment');
assert.ok(equityCapLimit.policySourceRef);
assert.match(result.semantics, /not a certified valuation/i);

const view = createResidentialIncomeAcquisitionViewModel(completeCase);
assert.strictEqual(view.capabilityStatus, 'REVERSE_UNDERWRITING_V2');
assert.strictEqual(view.reverseUnderwritingCalculated, true);
assert.strictEqual(view.reverseUnderwriting.maximumJustifiedPurchasePrice, result.maximumJustifiedPurchasePrice);
assert.strictEqual(view.investmentDecision, null);

const hydrated = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(completeCase)));
assert.strictEqual(calculateReverseUnderwriting(hydrated).maximumJustifiedPurchasePrice, result.maximumJustifiedPurchasePrice);

const withoutIrrPolicy = defaultReverseInputs().filter((input) => input.field !== 'reverse.minUnleveredIrr');
const missingPolicy = calculateReverseUnderwriting(buildCase({ reverseInputs: withoutIrrPolicy }));
assert.strictEqual(missingPolicy.status, REVERSE_UNDERWRITING_STATUS.NOT_CALCULABLE);
assert.ok(missingPolicy.issues.some((issue) => issue.field === 'reverse.minUnleveredIrr'));
assert.strictEqual(missingPolicy.maximumJustifiedPurchasePrice, null);

const invalidLtvPolicy = defaultReverseInputs().map((input) => (input.field === 'reverse.targetLtv'
  ? reverseInput(REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV, 0.7)
  : input));
const invalidLtv = calculateReverseUnderwriting(buildCase({ reverseInputs: invalidLtvPolicy }));
assert.strictEqual(invalidLtv.status, REVERSE_UNDERWRITING_STATUS.NOT_CALCULABLE);
assert.ok(invalidLtv.issues.some((issue) => issue.code === 'TARGET_LTV_EXCEEDS_MAX_LTV_POLICY'));

const overpriced = calculateReverseUnderwriting(buildCase({ purchasePrice: 20000000 }));
assert.strictEqual(overpriced.status, REVERSE_UNDERWRITING_STATUS.CALCULATED);
assert.strictEqual(overpriced.outcome, REVERSE_UNDERWRITING_OUTCOME.CURRENT_PRICE_EXCEEDS_MAXIMUM);
assert.strictEqual(overpriced.currentPriceAnalysis.allConstraintsPassed, false);
assert.ok(overpriced.currentPriceAnalysis.priceHeadroom < 0);

const infeasibleEquityInputs = defaultReverseInputs().map((input) => (input.field === 'reverse.maxEquityCommitment'
  ? reverseInput(REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT, 50000)
  : input));
const infeasibleEquity = calculateReverseUnderwriting(buildCase({ reverseInputs: infeasibleEquityInputs }));
assert.strictEqual(infeasibleEquity.status, REVERSE_UNDERWRITING_STATUS.CALCULATED);
assert.strictEqual(infeasibleEquity.outcome, REVERSE_UNDERWRITING_OUTCOME.NO_FEASIBLE_PURCHASE_PRICE);
assert.strictEqual(infeasibleEquity.maximumJustifiedPurchasePrice, 0);
assert.ok(infeasibleEquity.priceLimits.some((limit) => limit.status === PRICE_LIMIT_STATUS.NO_FEASIBLE_PRICE));

const usufructCase = buildCase({
  reverseInputs: defaultReverseInputs({ timeLimited: true }),
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  expiryDate: '2040-09-02',
});
const usufruct = calculateReverseUnderwriting(usufructCase);
assert.strictEqual(usufruct.status, REVERSE_UNDERWRITING_STATUS.CALCULATED);
assert.strictEqual(usufruct.terminalValue.gross, 0);
assert.strictEqual(usufruct.terminalValue.basis, 'ADOPTED_CONTRACTUAL_TERMINAL_VALUE');

const excessiveHoldInputs = defaultReverseInputs({ timeLimited: true }).map((input) => (input.field === 'reverse.holdPeriodYears'
  ? reverseInput(REVERSE_UNDERWRITING_INPUT_TYPE.HOLD_PERIOD_YEARS, 20)
  : input));
const excessiveHold = calculateReverseUnderwriting(buildCase({
  reverseInputs: excessiveHoldInputs,
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  expiryDate: '2040-09-02',
}));
assert.strictEqual(excessiveHold.status, REVERSE_UNDERWRITING_STATUS.NOT_CALCULABLE);
assert.ok(excessiveHold.issues.some((issue) => issue.code === 'HOLD_PERIOD_EXCEEDS_PROPERTY_INTEREST_TERM'));

const assumedGrowthInputs = defaultReverseInputs().map((input) => (input.field === 'reverse.annualNoiGrowthRate'
  ? createReverseUnderwritingInput({
    type: REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE,
    value: 0.02,
    evidenceType: 'EXPLICIT_UNDERWRITING_ASSUMPTION',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.ASSUMED,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    assumptionOverride: {
      reason: 'Approved NOI growth assumption',
      approvedByRef: 'identity://reviewer/1',
      approvedAt: '2026-09-02T11:00:00Z',
      policyRef: 'policy://reverse/approved',
    },
  })
  : input));
const assumedCase = buildCase({ reverseInputs: assumedGrowthInputs });
const assumed = calculateReverseUnderwriting(assumedCase);
assert.strictEqual(assumed.status, REVERSE_UNDERWRITING_STATUS.CALCULATED_WITH_ASSUMPTIONS);
assert.strictEqual(assumed.assumedInputCount, 1);

console.log('RESIDENTIAL_INCOME_REVERSE_UNDERWRITING_V2=PASS');
console.log('MULTI_CONSTRAINT_MAXIMUM_PRICE=PASS');
console.log('EXPLICIT_POLICY_AND_EVIDENCE_GATES=PASS');
console.log('TIME_LIMITED_INTEREST_TERMINAL_VALUE_GATE=PASS');
console.log('NO_AUTO_DECISION_OR_TRANSACTION_AUTHORIZATION=PASS');
