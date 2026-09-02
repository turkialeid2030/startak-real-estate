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
  createResidentialIncomeAcquisitionViewModel,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
  OperatingCaseSnapshotError,
  OPERATING_CASE_FILE_FORMAT,
  OPERATING_CASE_SNAPSHOT_VERSION,
  MAX_OPERATING_CASE_JSON_BYTES,
} = require('../../src/residential-income-acquisition');
const { validateSavedDealRecord, SavedDealValidationError } = require('../../src/validation/saved-deal-schema');
const { buildExportPayload, planRestore, BACKUP_VERSION } = require('../../src/storage/saved-deals-backup');
const { TITLE_RESULT_STATUS } = require('../../src/title-intelligence');
const { TENANT_RESULT_STATUS } = require('../../src/tenant-intelligence');

const CASE_ID = 'CASE-PERSISTENCE-1';
const PROPERTY_ID = 'PROPERTY-1';
const BUILDING_ID = 'BUILDING-1';
const UNIT_ID = 'UNIT-1';
const TENANT_ID = 'TENANT-1';
const ADOPTION_REF = 'adoption://operating-case/1';
const AS_OF = '2026-09-02';

function lineage(refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId: CASE_ID, refId, kind, recordedAt: '2026-09-02T12:00:00Z' });
}

function adopted(field, value, sourceRef, unit = null) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'PERSISTENCE_REGRESSION_FIXTURE',
    effectiveDate: AS_OF,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
  });
}

function buildCase() {
  const interest = createPropertyInterest({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: PROPERTY_ID,
    interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
    interestEvidenceRef: 'evidence://interest',
    interestAdoptionDecisionRef: ADOPTION_REF,
    titleAssessment: {
      caseId: CASE_ID,
      propertyId: PROPERTY_ID,
      status: TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS,
      blockers: [],
      legalReviewFlags: [],
    },
    titleAssessmentRef: 'assessment://title',
  });
  const property = createProperty({ caseId: CASE_ID, propertyId: PROPERTY_ID, buildingIds: [BUILDING_ID] });
  const building = createBuilding({ caseId: CASE_ID, propertyId: PROPERTY_ID, buildingId: BUILDING_ID, unitIds: [UNIT_ID] });
  const unit = createUnit({
    caseId: CASE_ID,
    propertyInterestId: interest.propertyInterestId,
    propertyId: PROPERTY_ID,
    buildingId: BUILDING_ID,
    unitId: UNIT_ID,
    unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
    operatingStatus: adopted('unit.status', UNIT_OPERATING_STATUS.OCCUPIED, 'evidence://unit/status'),
    rentableArea: adopted('unit.area', 120, 'evidence://unit/area', 'm2'),
    leaseIds: ['LEASE-1'],
  });
  const tenant = createTenant({
    caseId: CASE_ID,
    tenantId: TENANT_ID,
    displayName: 'Tenant',
    tenantAssessment: {
      tenantId: TENANT_ID,
      status: TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE,
      score: 0.9,
      assessedWeight: 1,
      prohibitedClaims: ['CREDIT_RATING'],
    },
    tenantAssessmentRef: 'assessment://tenant',
  });
  const lease = createLease({
    caseId: CASE_ID,
    propertyInterestId: interest.propertyInterestId,
    propertyId: PROPERTY_ID,
    buildingId: BUILDING_ID,
    unitId: UNIT_ID,
    leaseId: 'LEASE-1',
    tenantId: TENANT_ID,
    lifecycleStatus: LEASE_LIFECYCLE_STATUS.ACTIVE,
    startDate: '2026-01-01',
    endDate: '2031-01-01',
    baseRent: adopted('lease.baseRent', 120000, 'evidence://lease/rent', 'SAR/year'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    termsEvidenceRef: 'evidence://lease/terms',
    termsAdoptionDecisionRef: ADOPTION_REF,
  });
  const expense = createOperatingExpense({
    caseId: CASE_ID,
    expenseId: 'OPEX-1',
    propertyId: PROPERTY_ID,
    category: OPERATING_EXPENSE_CATEGORY.MAINTENANCE,
    basis: OPERATING_EXPENSE_BASIS.NORMALIZED,
    annualAmount: adopted('opex.maintenance', 20000, 'evidence://opex', 'SAR/year'),
  });
  const capex = createCapexItem({
    caseId: CASE_ID,
    capexItemId: 'CAPEX-1',
    propertyId: PROPERTY_ID,
    category: CAPEX_CATEGORY.ROOF_WATERPROOFING,
    severity: CAPEX_SEVERITY.MEDIUM,
    estimatedCost: adopted('capex.roof', 50000, 'evidence://capex', 'SAR'),
    immediate: true,
  });
  const refs = [
    lineage('evidence://interest', LINEAGE_KIND.SOURCE_DOCUMENT),
    lineage('assessment://title', LINEAGE_KIND.ANALYTICAL_ASSESSMENT),
    lineage('assessment://tenant', LINEAGE_KIND.ANALYTICAL_ASSESSMENT),
    lineage('evidence://unit/status'),
    lineage('evidence://unit/area'),
    lineage('evidence://lease/rent'),
    lineage('evidence://lease/terms', LINEAGE_KIND.SOURCE_DOCUMENT),
    lineage('evidence://opex'),
    lineage('evidence://capex'),
    lineage(ADOPTION_REF, LINEAGE_KIND.UNDERWRITING_ADOPTION),
  ];
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest: interest,
    property,
    buildings: [building],
    units: [unit],
    leases: [lease],
    tenants: [tenant],
    operatingExpenses: [expense],
    capexItems: [capex],
    evidenceLineage: refs,
  });
}

(async () => {
  const operatingCase = buildCase();
  const envelope = buildResidentialIncomeOperatingCaseEnvelope(operatingCase);
  assert.strictEqual(envelope.format, OPERATING_CASE_FILE_FORMAT);
  assert.strictEqual(envelope.snapshotVersion, OPERATING_CASE_SNAPSHOT_VERSION);
  const hydrated = parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(envelope));
  assert.strictEqual(hydrated.caseId, CASE_ID);
  assert.strictEqual(hydrated.operatingExpenses[0].annualAmount.value, 20000);
  assert.strictEqual(hydrated.capexItems[0].estimatedCost.value, 50000);
  assert.strictEqual(hydrated.propertyInterest.titleAssessment.status, TITLE_RESULT_STATUS.FACTS_SUFFICIENT_FOR_ANALYSIS);
  assert.strictEqual(hydrated.tenants[0].tenantAssessment.status, TENANT_RESULT_STATUS.TENANT_ANALYTICAL_FAVOURABLE);
  assert.ok(Object.isFrozen(hydrated));
  assert.strictEqual(createResidentialIncomeAcquisitionViewModel(hydrated).apiStatus, 'CASE_LOADED');

  for (const invalid of [
    { ...envelope, format: 'UNKNOWN' },
    { ...envelope, snapshotVersion: 99 },
  ]) {
    assert.throws(() => parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(invalid)), OperatingCaseSnapshotError);
  }
  const corrupted = JSON.parse(JSON.stringify(envelope));
  corrupted.operatingCase.units[0].rentableArea.value = -1;
  assert.throws(() => parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(corrupted)), /INVALID_OPERATING_CASE/);
  const projectionOverflow = JSON.parse(JSON.stringify(envelope));
  projectionOverflow.operatingCase.propertyInterest.titleAssessment.blockerCount = 10001;
  assert.throws(() => parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(projectionOverflow)), /INVALID_PROJECTION_COUNT/);
  const dangerous = `{"format":"${OPERATING_CASE_FILE_FORMAT}","snapshotVersion":1,"__proto__":{},"operatingCase":{}}`;
  assert.throws(() => parseResidentialIncomeOperatingCaseEnvelope(dangerous), /DANGEROUS_KEY_REJECTED/);
  assert.throws(() => parseResidentialIncomeOperatingCaseEnvelope('x'.repeat(MAX_OPERATING_CASE_JSON_BYTES + 1)), /FILE_TOO_LARGE/);

  const deal = { id: 'deal-1', name: 'Operating Deal', mode: 'building', inputs: { buildingPrice: 1 }, savedAt: AS_OF, operatingCase };
  assert.strictEqual(validateSavedDealRecord(deal), deal);
  assert.throws(
    () => validateSavedDealRecord({ ...deal, mode: 'land' }),
    (error) => error instanceof SavedDealValidationError && error.reasonCode === 'OPERATING_CASE_REQUIRES_BUILDING_MODE',
  );
  assert.throws(
    () => validateSavedDealRecord({ ...deal, operatingCase: { contractType: 'BAD' } }),
    (error) => error instanceof SavedDealValidationError && error.reasonCode === 'INVALID_OPERATING_CASE',
  );

  const store = { 'deal:deal-1': JSON.stringify(deal) };
  const provider = { get: async (key) => store[key] || null, set: async (key, value) => { store[key] = value; } };
  const backup = await buildExportPayload([{ id: 'deal-1' }], provider);
  assert.strictEqual(backup.backupVersion, BACKUP_VERSION);
  assert.strictEqual(backup.deals[0].operatingCase.caseId, CASE_ID);
  const restore = planRestore(backup, [], new Map());
  assert.strictEqual(restore.toWrite[0].record.operatingCase.caseId, CASE_ID);

  // Version 1 remains accepted and produces a deal with no operating case.
  const legacyBackup = { format: 'STARTAK_SAVED_DEALS_BACKUP', backupVersion: 1, deals: [{ id: 'legacy', name: 'Legacy', mode: 'building', inputs: {}, savedAt: AS_OF }] };
  const legacyRestore = planRestore(legacyBackup, [], new Map());
  assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyRestore.toWrite[0].record, 'operatingCase'), false);

  console.log('RESIDENTIAL_INCOME_OPERATING_CASE_PERSISTENCE_V1=PASS');
  console.log('VERSIONED_JSON_IMPORT_AND_REHYDRATION=PASS');
  console.log('SAVED_DEAL_AND_BACKUP_ROUND_TRIP=PASS');
  console.log('LEGACY_BACKUP_V1_COMPATIBILITY=PASS');
  console.log('INVALID_OR_OVERSIZED_CASE_FAILS_CLOSED=PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
