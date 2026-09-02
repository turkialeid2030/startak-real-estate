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
  createCapexItem,
  createResidentialIncomeOperatingCase,
  createAcquisitionBasisInput,
  ACQUISITION_BASIS_INPUT_TYPE,
  ACQUISITION_BASIS_STATUS,
  calculateAcquisitionBasis,
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
} = require('../../src/residential-income-acquisition');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');

const CASE_ID = 'CASE-RIAI-BASIS-1';
const AS_OF = '2026-09-02';
const ADOPTION_REF = 'adoption://acquisition/1';

function lineage(caseId, refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId, refId, kind, recordedAt: '2026-09-02T12:00:00Z' });
}

function adopted(field, value, sourceRef, unit) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'ACQUISITION_BASIS_REGRESSION_FIXTURE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function basisInput(type, value, sourceRef, overrides = {}) {
  return createAcquisitionBasisInput({
    type,
    value,
    sourceRef,
    evidenceType: 'ADOPTED_TRANSACTION_EVIDENCE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    ...overrides,
  });
}

function buildCase({ inputs = null, capexItems = null } = {}) {
  const propertyInterest = createPropertyInterest({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: 'PROPERTY-1',
    interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
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
  const tenant = createTenant({ caseId: CASE_ID, tenantId: 'TENANT-1' });
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
    baseRent: adopted('lease.1.baseRent', 800000, 'evidence://lease/rent', 'SAR/year'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    termsEvidenceRef: 'evidence://lease/terms',
    termsAdoptionDecisionRef: ADOPTION_REF,
  });
  const defaultCapex = [
    createCapexItem({
      caseId: CASE_ID,
      capexItemId: 'CAPEX-IMMEDIATE',
      propertyId: 'PROPERTY-1',
      category: CAPEX_CATEGORY.ROOF_WATERPROOFING,
      severity: CAPEX_SEVERITY.HIGH,
      estimatedCost: adopted('capex.immediate', 100000, 'evidence://capex/immediate', 'SAR'),
      immediate: true,
    }),
    createCapexItem({
      caseId: CASE_ID,
      capexItemId: 'CAPEX-DEFERRED',
      propertyId: 'PROPERTY-1',
      category: CAPEX_CATEGORY.COSMETIC,
      severity: CAPEX_SEVERITY.COSMETIC,
      estimatedCost: adopted('capex.deferred', 50000, 'evidence://capex/deferred', 'SAR'),
      immediate: false,
    }),
  ];
  const defaultInputs = [
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE, 10000000, 'evidence://acquisition/price'),
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.TRANSACTION_COSTS, 300000, 'evidence://acquisition/transaction-costs'),
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_TENANT_IMPROVEMENTS, 200000, 'evidence://acquisition/ti'),
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_LEASING_COSTS, 100000, 'evidence://acquisition/leasing'),
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES, 400000, 'evidence://acquisition/reserves'),
    basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS, 6000000, 'evidence://acquisition/debt'),
  ];
  const additionalOperatingInputs = inputs || defaultInputs;
  const resolvedCapex = capexItems || defaultCapex;
  const kindByRef = {
    'evidence://interest': LINEAGE_KIND.SOURCE_DOCUMENT,
    'assessment://title': LINEAGE_KIND.ANALYTICAL_ASSESSMENT,
    'evidence://lease/terms': LINEAGE_KIND.SOURCE_DOCUMENT,
    'identity://reviewer/1': LINEAGE_KIND.HUMAN_IDENTITY,
    'policy://acquisition/1': LINEAGE_KIND.POLICY,
    [ADOPTION_REF]: LINEAGE_KIND.UNDERWRITING_ADOPTION,
  };
  const refs = [
    'evidence://interest',
    'assessment://title',
    'evidence://unit/status',
    'evidence://unit/area',
    'evidence://lease/rent',
    'evidence://lease/terms',
    ...resolvedCapex.flatMap((item) => item.estimatedCost.lineageRefs),
    ...additionalOperatingInputs.flatMap((input) => input.lineageRefs),
    ADOPTION_REF,
  ];
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest,
    property,
    buildings: [building],
    units: [unit],
    leases: [lease],
    tenants: [tenant],
    capexItems: resolvedCapex,
    additionalOperatingInputs,
    evidenceLineage: [...new Set(refs)].map((refId) => lineage(CASE_ID, refId, kindByRef[refId] || LINEAGE_KIND.EVIDENCE_FACT)),
  });
}

const completeCase = buildCase();
const basis = calculateAcquisitionBasis(completeCase);
assert.strictEqual(basis.status, ACQUISITION_BASIS_STATUS.CALCULATED);
assert.strictEqual(basis.components.purchasePrice, 10000000);
assert.strictEqual(basis.components.immediateCapex, 100000);
assert.strictEqual(basis.components.nonPriceBasis, 1100000);
assert.strictEqual(basis.bases.priceOnlyBasis, 10000000);
assert.strictEqual(basis.bases.allInBasis, 11100000);
assert.strictEqual(basis.bases.equityBasis, 5100000);
assert.strictEqual(basis.bases.nonPricePremiumRatio, 0.11);
assert.strictEqual(basis.bases.initialDebtToCostRatio, 6000000 / 11100000);
assert.strictEqual(basis.acquisitionBasisCalculated, true);
assert.strictEqual(basis.acquisitionPriceCalculated, false);
assert.strictEqual(basis.valuationCalculated, false);
assert.strictEqual(basis.investmentDecision, null);

const view = createResidentialIncomeAcquisitionViewModel(completeCase);
assert.strictEqual(view.acquisitionBasis.bases.allInBasis, 11100000);
assert.strictEqual(view.acquisitionBasisCalculated, true);
assert.strictEqual(view.transactionAuthorized, false);

const hydrated = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(completeCase)));
assert.strictEqual(calculateAcquisitionBasis(hydrated).bases.equityBasis, 5100000);

const missingPriceInputs = completeCase.additionalOperatingInputs.filter((input) => input.field !== 'acquisition.purchasePrice');
const missingPrice = calculateAcquisitionBasis(buildCase({ inputs: missingPriceInputs }));
assert.strictEqual(missingPrice.status, ACQUISITION_BASIS_STATUS.NOT_CALCULABLE);
assert.ok(missingPrice.issues.some((item) => item.field === 'acquisition.purchasePrice'));

const duplicateDebtInputs = [
  ...completeCase.additionalOperatingInputs,
  basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS, 5000000, 'evidence://acquisition/debt/duplicate'),
];
const duplicateDebt = calculateAcquisitionBasis(buildCase({ inputs: duplicateDebtInputs }));
assert.strictEqual(duplicateDebt.status, ACQUISITION_BASIS_STATUS.NOT_CALCULABLE);
assert.ok(duplicateDebt.issues.some((item) => item.code === 'DUPLICATE_ACQUISITION_INPUT'));

const excessiveDebtInputs = completeCase.additionalOperatingInputs.map((input) => (input.field === 'acquisition.initialDebtProceeds'
  ? basisInput(ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS, 12000000, 'evidence://acquisition/debt/excessive')
  : input));
const excessiveDebt = calculateAcquisitionBasis(buildCase({ inputs: excessiveDebtInputs }));
assert.strictEqual(excessiveDebt.status, ACQUISITION_BASIS_STATUS.NOT_CALCULABLE);
assert.ok(excessiveDebt.issues.some((item) => item.code === 'INITIAL_DEBT_EXCEEDS_ALL_IN_BASIS'));

const unpricedCapex = createCapexItem({
  caseId: CASE_ID,
  capexItemId: 'CAPEX-UNKNOWN',
  propertyId: 'PROPERTY-1',
  category: CAPEX_CATEGORY.FIRE_PROTECTION,
  severity: CAPEX_SEVERITY.CRITICAL,
  estimatedCost: createEvidenceAwareValue({
    field: 'capex.fire',
    value: null,
    unit: 'SAR',
    sourceRef: 'evidence://capex/unknown',
    evidenceType: 'UNPRICED_TECHNICAL_ITEM',
    verificationStatus: OPERATING_INPUT_STATUS.NOT_AVAILABLE,
  }),
  lifeSafety: true,
  immediate: true,
});
const unknownCapexBasis = calculateAcquisitionBasis(buildCase({ capexItems: [unpricedCapex] }));
assert.strictEqual(unknownCapexBasis.status, ACQUISITION_BASIS_STATUS.NOT_CALCULABLE);
assert.ok(unknownCapexBasis.issues.some((item) => item.code === 'COMPLETE_IMMEDIATE_CAPEX_ASSESSMENT_REQUIRED'));

const assumedInputs = completeCase.additionalOperatingInputs.map((input) => (input.field === 'acquisition.initialReserves'
  ? createAcquisitionBasisInput({
    type: ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES,
    value: 400000,
    evidenceType: 'EXPLICIT_UNDERWRITING_ASSUMPTION',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.ASSUMED,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    assumptionOverride: {
      reason: 'Approved initial reserve assumption',
      approvedByRef: 'identity://reviewer/1',
      approvedAt: '2026-09-02T11:00:00Z',
      policyRef: 'policy://acquisition/1',
    },
  })
  : input));
const assumedBasis = calculateAcquisitionBasis(buildCase({ inputs: assumedInputs }));
assert.strictEqual(assumedBasis.status, ACQUISITION_BASIS_STATUS.CALCULATED_WITH_ASSUMPTIONS);
assert.strictEqual(assumedBasis.assumedInputCount, 1);

console.log('RESIDENTIAL_INCOME_ACQUISITION_BASIS_V1=PASS');
console.log('PRICE_ONLY_ALL_IN_EQUITY_BASES=PASS');
console.log('COMPLETE_IMMEDIATE_CAPEX_GATE=PASS');
console.log('DEBT_CANNOT_EXCEED_ALL_IN_BASIS=PASS');
console.log('PURCHASE_PRICE_REMAINS_ADOPTED_INPUT=PASS');
console.log('NO_VALUE_RETURN_FINANCING_OR_DECISION_CLAIM=PASS');
