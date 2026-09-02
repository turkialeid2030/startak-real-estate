'use strict';

const assert = require('assert');
const capabilityRegistry = require('../../src/registries/capability-registry.json');
const { ExistingBuildingStudyDefinition } = require('../../src/modules/studies/existing-building');
const {
  PROPERTY_INTEREST_TYPE,
  UNIT_TYPE,
  UNIT_OPERATING_STATUS,
  LEASE_LIFECYCLE_STATUS,
  RENT_FREQUENCY,
  RENT_ESCALATION_TYPE,
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  OPERATING_UNDERWRITING_STATUS,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createBuilding,
  createUnit,
  createTenant,
  createRentEscalation,
  createLease,
  createResidentialIncomeOperatingCase,
  assessOperatingUnderwritingReadiness,
  RESIDENTIAL_INCOME_ACQUISITION_API_STATUS,
  createResidentialIncomeAcquisitionViewModel,
  OPERATING_METRICS_STATUS,
  annualizePeriodicRent,
  calculateOperatingMetrics,
} = require('../../src/residential-income-acquisition');
const {
  TITLE_FACT_STATUS,
  createTitleFact,
  assessTitleFacts,
} = require('../../src/title-intelligence');
const {
  TENANT_EVIDENCE_STATUS,
  TENANT_CLASS,
  createTenantEvidenceFact,
  assessTenant,
} = require('../../src/tenant-intelligence');

const AS_OF_DATE = '2026-09-01';
const ADOPTION_REF = 'adoption://riai/input-version-1';

function lineage(caseId, refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId, refId, kind, recordedAt: '2026-09-01T12:00:00Z' });
}

function adopted(field, value, sourceRef, unit = null, effectiveDate = AS_OF_DATE) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'SYNTHETIC_VERIFIED_FIXTURE',
    effectiveDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function assumed(field, value, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    evidenceType: 'EXPLICIT_UNDERWRITING_ASSUMPTION',
    effectiveDate: AS_OF_DATE,
    verificationStatus: OPERATING_INPUT_STATUS.ASSUMED,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    assumptionOverride: {
      reason: 'Synthetic sensitivity assumption for contract regression',
      approvedByRef: 'identity://reviewer/1',
      approvedAt: '2026-09-01T11:50:00Z',
      policyRef: 'policy://underwriting/1',
    },
  });
}

function titleAssessment(caseId, propertyId, { waqf = false } = {}) {
  const fact = (key, value, status = TITLE_FACT_STATUS.VERIFIED) => createTitleFact({
    caseId,
    propertyId,
    key,
    value,
    status,
    sourceType: 'SYNTHETIC_TITLE_FIXTURE',
    sourceRef: `synthetic-title://${key}`,
    observedAt: AS_OF_DATE,
  });
  const facts = [
    fact('documentId', 'SYNTHETIC-DOC'),
    fact('ownerName', 'Synthetic Owner'),
    fact('propertyAreaSqm', 4918.61),
    fact('city', 'Synthetic City'),
    fact('parcelOrPlotId', 'SYNTHETIC-PLOT'),
  ];
  if (waqf) facts.push(fact('waqfRestrictionDetected', true, TITLE_FACT_STATUS.OBSERVED));
  return assessTitleFacts({ caseId, propertyId, facts });
}

function tenantAssessment(tenantId) {
  const fact = (key, score, value = null) => createTenantEvidenceFact({
    tenantId,
    key,
    value,
    score,
    status: TENANT_EVIDENCE_STATUS.VERIFIED,
    sourceType: 'SYNTHETIC_TENANT_FIXTURE',
    sourceRef: `synthetic-tenant://${key}`,
    observedAt: AS_OF_DATE,
  });
  const facts = [
    fact('auditedFinancialStatements3Y', 0.9),
    fact('liquidity', 0.9),
    fact('operatingCashFlow', 0.9),
    fact('leverageDebtRatio', 0.8),
    fact('paidInCapital', 0.9),
    fact('creditReport', 0.9),
    fact('enforcementCases', 1, false),
    fact('bankruptcyProceedings', 1, false),
    fact('priorContractualRentalBehaviour', 0.8),
    fact('businessAge', 1),
    fact('sectorStability', 1),
    fact('useCompatibility', 1),
    fact('guaranteeStrength', 1),
    fact('sectorRisk', 1),
    fact('annualRevenue', 1, 20000000),
  ];
  return assessTenant({
    tenantId,
    facts,
    annualRent: 2000000,
    annualRevenue: 20000000,
    tenantClass: TENANT_CLASS.LARGE,
    annualContractValue: 2000000,
  });
}

function buildOperatingCase({
  caseId = 'CASE-RIAI-READY',
  interestType = PROPERTY_INTEREST_TYPE.FREEHOLD,
  commencementDate = null,
  expiryDate = null,
  legalReviewRef = null,
  waqf = false,
  areaInput = null,
  statusInput = null,
  baseRentInput = null,
  escalation = null,
  additionalOperatingInputs = [],
  additionalLineage = [],
  omitLineageRef = null,
  secondActiveLease = false,
  includeVacantUnit = false,
  asOfDate = AS_OF_DATE,
  leaseEndDate = '2046-01-01',
}) {
  const propertyId = 'PROPERTY-1';
  const buildingId = 'BUILDING-1';
  const unitId = 'UNIT-1';
  const tenantId = 'TENANT-1';
  const title = titleAssessment(caseId, propertyId, { waqf });
  const tenant = tenantAssessment(tenantId);

  const interest = createPropertyInterest({
    caseId,
    propertyInterestId: 'INTEREST-1',
    propertyId,
    interestType,
    interestEvidenceRef: 'evidence://interest/1',
    commencementDate,
    expiryDate,
    titleAssessment: title,
    titleAssessmentRef: 'assessment://title/1',
    interestAdoptionDecisionRef: ADOPTION_REF,
    legalReviewRef,
  });
  const property = createProperty({ caseId, propertyId, buildingIds: [buildingId] });
  const vacantUnitId = 'UNIT-2';
  const building = createBuilding({ caseId, propertyId, buildingId, unitIds: includeVacantUnit ? [unitId, vacantUnitId] : [unitId] });

  const leaseIds = secondActiveLease ? ['LEASE-1', 'LEASE-2'] : ['LEASE-1'];
  const unit = createUnit({
    caseId,
    propertyInterestId: interest.propertyInterestId,
    propertyId,
    buildingId,
    unitId,
    unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
    operatingStatus: statusInput || adopted('unit.operatingStatus', UNIT_OPERATING_STATUS.OCCUPIED, 'evidence://unit/status'),
    rentableArea: areaInput || adopted('unit.rentableArea', 200, 'evidence://unit/area', 'm2'),
    leaseIds,
  });
  const tenantRecord = createTenant({
    caseId,
    tenantId,
    tenantAssessment: tenant,
    tenantAssessmentRef: 'assessment://tenant/1',
  });
  const rentEscalation = escalation || createRentEscalation({
    type: RENT_ESCALATION_TYPE.FIXED_AMOUNT,
    intervalYears: 5,
    changeValue: adopted('lease.escalation.fixedAmount', 100000, 'evidence://lease/escalation', 'SAR/year'),
  });
  const makeLease = (leaseId) => createLease({
    caseId,
    propertyInterestId: interest.propertyInterestId,
    propertyId,
    buildingId,
    unitId,
    leaseId,
    tenantId,
    lifecycleStatus: LEASE_LIFECYCLE_STATUS.ACTIVE,
    startDate: '2026-01-01',
    endDate: leaseEndDate,
    baseRent: baseRentInput || adopted('lease.baseRent', 2000000, 'evidence://lease/base-rent', 'SAR/year', '2026-01-01'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    escalation: rentEscalation,
    termsEvidenceRef: 'evidence://lease/contract',
    termsAdoptionDecisionRef: ADOPTION_REF,
  });
  const leases = leaseIds.map(makeLease);
  const units = [unit];
  if (includeVacantUnit) {
    units.push(createUnit({
      caseId,
      propertyInterestId: interest.propertyInterestId,
      propertyId,
      buildingId,
      unitId: vacantUnitId,
      unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
      operatingStatus: adopted('unit.2.operatingStatus', UNIT_OPERATING_STATUS.VACANT, 'evidence://unit/2/status'),
      rentableArea: adopted('unit.2.rentableArea', 100, 'evidence://unit/2/area', 'm2'),
      leaseIds: [],
    }));
  }

  const baseLineage = [
    lineage(caseId, 'evidence://interest/1', LINEAGE_KIND.SOURCE_DOCUMENT),
    lineage(caseId, 'assessment://title/1', LINEAGE_KIND.ANALYTICAL_ASSESSMENT),
    lineage(caseId, 'assessment://tenant/1', LINEAGE_KIND.ANALYTICAL_ASSESSMENT),
    lineage(caseId, 'evidence://unit/status'),
    lineage(caseId, 'evidence://unit/area'),
    lineage(caseId, 'evidence://lease/base-rent'),
    lineage(caseId, 'evidence://lease/escalation'),
    lineage(caseId, 'evidence://lease/contract', LINEAGE_KIND.SOURCE_DOCUMENT),
    lineage(caseId, ADOPTION_REF, LINEAGE_KIND.UNDERWRITING_ADOPTION),
  ];
  if (includeVacantUnit) {
    baseLineage.push(lineage(caseId, 'evidence://unit/2/status'));
    baseLineage.push(lineage(caseId, 'evidence://unit/2/area'));
  }
  if (legalReviewRef) baseLineage.push(lineage(caseId, legalReviewRef, LINEAGE_KIND.LEGAL_REVIEW));
  const evidenceLineage = [...baseLineage, ...additionalLineage].filter((item) => item.refId !== omitLineageRef);

  return createResidentialIncomeOperatingCase({
    caseId,
    asOfDate,
    propertyInterest: interest,
    property,
    buildings: [building],
    units,
    leases,
    tenants: [tenantRecord],
    additionalOperatingInputs,
    evidenceLineage,
  });
}

// Reference-derived long-lease case: SAR 2m annual rent, +SAR 100k every five years, 20 years.
const readyCase = buildOperatingCase({});
const ready = assessOperatingUnderwritingReadiness(readyCase);
const readyView = createResidentialIncomeAcquisitionViewModel(readyCase);
const readyMetrics = calculateOperatingMetrics(readyCase);
assert.strictEqual(ready.status, OPERATING_UNDERWRITING_STATUS.READY_FOR_OPERATING_UNDERWRITING);
assert.strictEqual(readyView.apiStatus, RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.CASE_LOADED);
assert.strictEqual(readyView.readinessStatus, ready.status);
assert.strictEqual(readyView.summary.unitCount, 1);
assert.strictEqual(readyView.summary.leaseCount, 1);
assert.strictEqual(readyView.financialCalculationExecuted, false);
assert.strictEqual(readyView.investmentDecision, null);
assert.strictEqual(readyView.transactionAuthorized, false);
assert.ok(Object.isFrozen(readyView));
assert.strictEqual(readyMetrics.status, OPERATING_METRICS_STATUS.CALCULATED);
assert.strictEqual(readyMetrics.rentRoll.totals.totalAnnualContractRent, 2000000);
assert.strictEqual(readyMetrics.occupancy.physicalOccupancyByUnits, 1);
assert.strictEqual(readyMetrics.occupancy.economicOccupancy, null);
assert.strictEqual(readyMetrics.leaseTiming.activeLeaseCount, 1);
assert.ok(readyMetrics.leaseTiming.waleYears > 19 && readyMetrics.leaseTiming.waleYears < 20);
assert.strictEqual(readyMetrics.financialCalculationExecuted, false);
assert.strictEqual(readyMetrics.stabilizedNoiCalculated, false);
assert.strictEqual(readyView.operatingMetrics.status, OPERATING_METRICS_STATUS.CALCULATED);
assert.strictEqual(readyCase.leases[0].baseRent.value, 2000000);
assert.strictEqual(readyCase.leases[0].escalation.type, RENT_ESCALATION_TYPE.FIXED_AMOUNT);
assert.strictEqual(readyCase.leases[0].escalation.intervalYears, 5);
assert.strictEqual(readyCase.leases[0].escalation.changeValue.value, 100000);
assert.strictEqual(readyCase.financialCalculationExecuted, false);
assert.strictEqual(ready.financialCalculationExecuted, false);
assert.strictEqual(ready.investmentDecision, null);

// Rent frequency annualization is deterministic and never inferred for CUSTOM frequency.
assert.strictEqual(annualizePeriodicRent(1000, RENT_FREQUENCY.MONTHLY), 12000);
assert.strictEqual(annualizePeriodicRent(3000, RENT_FREQUENCY.QUARTERLY), 12000);
assert.strictEqual(annualizePeriodicRent(6000, RENT_FREQUENCY.SEMI_ANNUAL), 12000);
assert.strictEqual(annualizePeriodicRent(12000, RENT_FREQUENCY.ANNUAL), 12000);
assert.throws(() => annualizePeriodicRent(1000, RENT_FREQUENCY.CUSTOM), /UNSUPPORTED_RENT_FREQUENCY/);

// The reference step increases annual contract rent by SAR 100k after five completed years.
const steppedCase = buildOperatingCase({ caseId: 'CASE-RIAI-STEPPED-2031', asOfDate: '2031-01-01' });
const steppedMetrics = calculateOperatingMetrics(steppedCase);
assert.strictEqual(steppedMetrics.status, OPERATING_METRICS_STATUS.CALCULATED);
assert.strictEqual(steppedMetrics.rentRoll.totals.totalAnnualContractRent, 2100000);

// Physical and contracted occupancy include vacant inventory; economic occupancy remains unavailable without collections.
const mixedOccupancyCase = buildOperatingCase({ caseId: 'CASE-RIAI-MIXED-OCCUPANCY', includeVacantUnit: true });
const mixedMetrics = calculateOperatingMetrics(mixedOccupancyCase);
assert.strictEqual(mixedMetrics.rentRoll.totals.unitCount, 2);
assert.strictEqual(mixedMetrics.rentRoll.totals.totalRentableAreaSqm, 300);
assert.strictEqual(mixedMetrics.occupancy.physicalOccupancyByUnits, 0.5);
assert.strictEqual(mixedMetrics.occupancy.physicalOccupancyByArea, 2 / 3);
assert.strictEqual(mixedMetrics.occupancy.contractedOccupancyByArea, 2 / 3);
assert.strictEqual(mixedMetrics.occupancy.economicOccupancy, null);
assert.strictEqual(mixedMetrics.leaseTiming.expiryByYear[0].year, 2046);
assert.strictEqual(mixedMetrics.leaseTiming.expiryByYear[0].rentExposureRatio, 1);
assert.strictEqual(mixedMetrics.leaseTiming.leaseCliffs.length, 1);

// Rent units must agree with payment frequency; the engine never guesses whether a value is monthly or annual.
const mismatchedRentUnit = adopted('lease.baseRent', 2000000, 'evidence://lease/base-rent', 'SAR/month', '2026-01-01');
const mismatchedUnitCase = buildOperatingCase({ caseId: 'CASE-RIAI-RENT-UNIT-MISMATCH', baseRentInput: mismatchedRentUnit });
const mismatchedUnitMetrics = calculateOperatingMetrics(mismatchedUnitCase);
assert.strictEqual(mismatchedUnitMetrics.status, OPERATING_METRICS_STATUS.NOT_CALCULABLE);
assert.ok(mismatchedUnitMetrics.issues.some((item) => item.code === 'RENT_UNIT_FREQUENCY_MISMATCH'));

// Explicit adopted assumptions are visible and never relabelled as verified facts.
const assumptionCaseId = 'CASE-RIAI-ASSUMPTION';
const assumptionCase = buildOperatingCase({
  caseId: assumptionCaseId,
  areaInput: assumed('unit.rentableArea', 210, 'm2'),
  additionalLineage: [
    lineage(assumptionCaseId, 'identity://reviewer/1', LINEAGE_KIND.HUMAN_IDENTITY),
    lineage(assumptionCaseId, 'policy://underwriting/1', LINEAGE_KIND.POLICY),
  ],
});
const assumptionReadiness = assessOperatingUnderwritingReadiness(assumptionCase);
assert.strictEqual(assumptionReadiness.status, OPERATING_UNDERWRITING_STATUS.READY_WITH_ASSUMPTIONS);
assert.ok(assumptionReadiness.assumptions.some((item) => item.field === 'unit.rentableArea'));
assert.strictEqual(assumptionCase.units[0].rentableArea.verificationStatus, OPERATING_INPUT_STATUS.ASSUMED);

// Time-limited usufruct is preserved as a bounded interest and cannot imply freehold terminal value.
const usufruct = buildOperatingCase({
  caseId: 'CASE-RIAI-USUFRUCT',
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  commencementDate: '2025-01-01',
  expiryDate: '2039-12-15',
});
const usufructReadiness = assessOperatingUnderwritingReadiness(usufruct);
assert.strictEqual(usufructReadiness.status, OPERATING_UNDERWRITING_STATUS.NEEDS_DUE_DILIGENCE);
assert.ok(usufructReadiness.dueDiligence.some((item) => item.code === 'TIME_LIMITED_INTEREST_LEGAL_REVIEW_REQUIRED'));
assert.ok(usufructReadiness.warnings.some((item) => item.code === 'NO_FREEHOLD_TERMINAL_VALUE_INFERENCE'));

// Conflicting 93%/95% occupancy evidence is blocked rather than silently resolved.
const occupancyConflictCaseId = 'CASE-RIAI-OCCUPANCY-CONFLICT';
const occupancyConflict = createEvidenceAwareValue({
  field: 'property.occupancyRate',
  value: [0.93, 0.95],
  unit: 'ratio',
  sourceRef: 'evidence://occupancy/conflict',
  evidenceType: 'CONFLICTING_SOURCE_VALUES',
  effectiveDate: AS_OF_DATE,
  verificationStatus: OPERATING_INPUT_STATUS.CONFLICT,
});
const conflictCase = buildOperatingCase({
  caseId: occupancyConflictCaseId,
  interestType: PROPERTY_INTEREST_TYPE.USUFRUCT,
  commencementDate: '2025-01-01',
  expiryDate: '2039-12-15',
  legalReviewRef: 'legal-review://interest/1',
  additionalOperatingInputs: [occupancyConflict],
  additionalLineage: [lineage(occupancyConflictCaseId, 'evidence://occupancy/conflict')],
});
const conflictReadiness = assessOperatingUnderwritingReadiness(conflictCase);
assert.strictEqual(conflictReadiness.status, OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED);
assert.ok(conflictReadiness.blockers.some((item) => item.field === 'property.occupancyRate'));

// Omitted/unpriced management expense remains NOT_AVAILABLE, never zero.
const missingCost = createEvidenceAwareValue({
  field: 'opex.managementFee',
  value: null,
  unit: 'SAR/year',
  sourceRef: 'evidence://management-cost/omitted',
  evidenceType: 'SOURCE_EXPLICITLY_OMITS_COST',
  verificationStatus: OPERATING_INPUT_STATUS.NOT_AVAILABLE,
});
const missingCostCaseId = 'CASE-RIAI-MISSING-COST';
const missingCostCase = buildOperatingCase({
  caseId: missingCostCaseId,
  additionalOperatingInputs: [missingCost],
  additionalLineage: [lineage(missingCostCaseId, 'evidence://management-cost/omitted')],
});
const missingCostReadiness = assessOperatingUnderwritingReadiness(missingCostCase);
assert.strictEqual(missingCostReadiness.status, OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE);
assert.ok(missingCostReadiness.evidenceGaps.some((item) => item.field === 'opex.managementFee' && item.code === 'MATERIAL_INPUT_NOT_AVAILABLE'));
assert.strictEqual(missingCostCase.additionalOperatingInputs[0].value, null);

// A waqf restriction is routed to legal review without creating a legal conclusion.
const waqfCase = buildOperatingCase({ caseId: 'CASE-RIAI-WAQF', waqf: true });
const waqfReadiness = assessOperatingUnderwritingReadiness(waqfCase);
assert.strictEqual(waqfReadiness.status, OPERATING_UNDERWRITING_STATUS.NEEDS_DUE_DILIGENCE);
assert.ok(waqfReadiness.dueDiligence.some((item) => item.code === 'TITLE_LEGAL_REVIEW_REQUIRED'));
assert.strictEqual(waqfCase.propertyInterest.legalConclusion, null);
assert.strictEqual(waqfReadiness.legalConclusion, null);

// Evidence references fail closed when the declared lineage packet is incomplete.
const missingLineageCase = buildOperatingCase({ caseId: 'CASE-RIAI-MISSING-LINEAGE', omitLineageRef: 'evidence://lease/base-rent' });
const missingLineageReadiness = assessOperatingUnderwritingReadiness(missingLineageCase);
assert.strictEqual(missingLineageReadiness.status, OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE);
assert.ok(missingLineageReadiness.evidenceGaps.some((item) => item.refId === 'evidence://lease/base-rent'));

// Contradictory unit/lease topology blocks the path even when every numeric value is verified.
const duplicateActive = buildOperatingCase({ caseId: 'CASE-RIAI-DUPLICATE-ACTIVE', secondActiveLease: true });
const duplicateActiveReadiness = assessOperatingUnderwritingReadiness(duplicateActive);
const duplicateActiveMetrics = calculateOperatingMetrics(duplicateActive);
assert.strictEqual(duplicateActiveReadiness.status, OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED);
assert.ok(duplicateActiveReadiness.blockers.some((item) => item.code === 'MULTIPLE_ACTIVE_LEASES_ON_UNIT'));
assert.strictEqual(duplicateActiveMetrics.status, OPERATING_METRICS_STATUS.NOT_CALCULABLE);
assert.ok(duplicateActiveMetrics.issues.some((item) => item.code === 'MULTIPLE_ACTIVE_LEASES_ON_UNIT'));

// Structural contradictions are rejected before readiness assessment.
assert.throws(() => createPropertyInterest({
  caseId: 'CASE-X',
  propertyInterestId: 'INTEREST-X',
  propertyId: 'PROPERTY-X',
  interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
  expiryDate: '2039-01-01',
}), /FREEHOLD/);
assert.throws(() => createEvidenceAwareValue({
  field: 'property.occupancyRate',
  value: [0.93, 0.95],
  sourceRef: 'evidence://conflict',
  evidenceType: 'CONFLICT',
  effectiveDate: AS_OF_DATE,
  verificationStatus: OPERATING_INPUT_STATUS.CONFLICT,
  adoptedForUnderwriting: true,
  adoptionDecisionRef: ADOPTION_REF,
}), /cannot be adopted/);
assert.throws(() => createResidentialIncomeOperatingCase({
  caseId: 'CASE-X',
  asOfDate: AS_OF_DATE,
  propertyInterest: readyCase.propertyInterest,
  property: readyCase.property,
}), /ISOLATION/);

// The Existing Building study exposes the contract/readiness boundary but keeps calculations separate.
assert.strictEqual(ExistingBuildingStudyDefinition.createOperatingUnderwritingCase, createResidentialIncomeOperatingCase);
assert.strictEqual(ExistingBuildingStudyDefinition.assessOperatingUnderwritingReadiness, assessOperatingUnderwritingReadiness);
assert.strictEqual(ExistingBuildingStudyDefinition.projectOperatingUnderwritingReadiness, createResidentialIncomeAcquisitionViewModel);
assert.strictEqual(ExistingBuildingStudyDefinition.calculateResidentialIncomeOperatingMetrics, calculateOperatingMetrics);
assert.ok(!ExistingBuildingStudyDefinition.supportedSections.includes('operating-underwriting'));

const emptyView = createResidentialIncomeAcquisitionViewModel(null);
assert.strictEqual(emptyView.apiStatus, RESIDENTIAL_INCOME_ACQUISITION_API_STATUS.NOT_LOADED);
assert.strictEqual(emptyView.summary, null);
assert.strictEqual(emptyView.financialCalculationExecuted, false);
assert.strictEqual(emptyView.transactionAuthorized, false);
assert.throws(() => createResidentialIncomeAcquisitionViewModel({}), /createResidentialIncomeOperatingCase/);

const capability = capabilityRegistry.find((item) => item.capability_id === 'CAP-RIAI-OPERATING-CONTRACT');
assert.ok(capability);
assert.strictEqual(capability.implementation_status, 'PARTIALLY_IMPLEMENTED');
assert.ok(capability.limitations.includes('Economic occupancy'));
assert.ok(capability.limitations.includes('source-total reconciliation'));

console.log('RESIDENTIAL_INCOME_OPERATING_CONTRACT_V1=PASS');
console.log('PROPERTY_UNIT_LEASE_TENANT_GRAPH_ISOLATION=PASS');
console.log('EVIDENCE_AWARE_INPUT_AND_ADOPTION_LINEAGE=PASS');
console.log('LONG_LEASE_STEP_RENT_REFERENCE_CASE=PASS');
console.log('USUFRUCT_EXPIRY_AND_NO_FREEHOLD_TERMINAL_INFERENCE=PASS');
console.log('OCCUPANCY_CONFLICT_FAILS_CLOSED=PASS');
console.log('UNKNOWN_MANAGEMENT_COST_IS_NOT_ZERO=PASS');
console.log('WAQF_RESTRICTION_ROUTES_TO_LEGAL_REVIEW=PASS');
console.log('NO_FINANCIAL_OR_LEGAL_OR_CREDIT_DECISION_CLAIM=PASS');
console.log('DETERMINISTIC_API_PROJECTION_AND_EMPTY_STATE=PASS');
console.log('RENT_ROLL_OCCUPANCY_LEASE_TIMING_V1=PASS');
