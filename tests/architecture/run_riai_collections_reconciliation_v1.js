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
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createBuilding,
  createUnit,
  createTenant,
  createLease,
  createRentCollectionRecord,
  createResidentialIncomeOperatingCase,
  calculateOperatingMetrics,
  COLLECTIONS_RECONCILIATION_STATUS,
  addVerifiedRentCollection,
  updateVerifiedLeaseTerms,
  buildResidentialIncomeOperatingCaseEnvelope,
  hydrateResidentialIncomeOperatingCaseSnapshot,
} = require('../../src/residential-income-acquisition');

const CASE_ID = 'CASE-COLLECTIONS-1';
const AS_OF = '2026-09-01';
const ADOPTION = 'adoption://collections/1';

function lineage(refId, kind = LINEAGE_KIND.EVIDENCE_FACT) {
  return createEvidenceLineageRecord({ caseId: CASE_ID, refId, kind, recordedAt: '2026-09-01T00:00:00Z' });
}

function verified(field, value, unit, sourceRef, effectiveDate = AS_OF) {
  return createEvidenceAwareValue({
    field,
    value,
    unit,
    sourceRef,
    evidenceType: 'SYNTHETIC_VERIFIED_COLLECTION_FIXTURE',
    effectiveDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION,
  });
}

function unavailable(field, unit) {
  return createEvidenceAwareValue({
    field,
    value: null,
    unit,
    evidenceType: 'SYNTHETIC_NOT_AVAILABLE',
    verificationStatus: OPERATING_INPUT_STATUS.NOT_AVAILABLE,
  });
}

function collectionRecord({ collectionId = 'COLL-1', potentialAvailable = true, periodStart = '2026-01-01', periodEnd = AS_OF } = {}) {
  const sourceRef = `evidence://collection/${collectionId}`;
  return createRentCollectionRecord({
    caseId: CASE_ID,
    collectionId,
    propertyId: 'PROPERTY-1',
    buildingId: 'BUILDING-1',
    unitId: 'UNIT-1',
    leaseId: 'LEASE-1',
    periodStart,
    periodEnd,
    contractualRentDue: verified(`collection.${collectionId}.contractualRentDue`, 100000, 'SAR', sourceRef),
    collectedRent: verified(`collection.${collectionId}.collectedRent`, 90000, 'SAR', sourceRef),
    potentialGrossRent: potentialAvailable
      ? verified(`collection.${collectionId}.potentialGrossRent`, 120000, 'SAR', sourceRef)
      : unavailable(`collection.${collectionId}.potentialGrossRent`, 'SAR'),
    concessions: verified(`collection.${collectionId}.concessions`, 5000, 'SAR', sourceRef),
    evidenceRefs: [sourceRef, ADOPTION],
  });
}

function operatingCase({ collections = [collectionRecord()], additionalInputs = [] } = {}) {
  const interest = createPropertyInterest({
    caseId: CASE_ID,
    propertyInterestId: 'INTEREST-1',
    propertyId: 'PROPERTY-1',
    interestType: PROPERTY_INTEREST_TYPE.FREEHOLD,
    interestEvidenceRef: 'evidence://interest/1',
    interestAdoptionDecisionRef: ADOPTION,
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
    operatingStatus: verified('unit.UNIT-1.operatingStatus', UNIT_OPERATING_STATUS.OCCUPIED, null, 'evidence://unit/status'),
    rentableArea: verified('unit.UNIT-1.rentableArea', 200, 'm2', 'evidence://unit/area'),
    leaseIds: ['LEASE-1'],
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
    endDate: '2027-01-01',
    baseRent: verified('lease.LEASE-1.baseRent', 1200000, 'SAR/year', 'evidence://lease/rent'),
    rentFrequency: RENT_FREQUENCY.ANNUAL,
    termsEvidenceRef: 'evidence://lease/terms',
    termsAdoptionDecisionRef: ADOPTION,
  });
  const tenant = createTenant({ caseId: CASE_ID, tenantId: 'TENANT-1', displayName: 'Synthetic Tenant' });
  const sourceRefs = new Set([
    'evidence://interest/1', 'evidence://unit/status', 'evidence://unit/area', 'evidence://lease/rent', 'evidence://lease/terms',
    ...collections.flatMap((record) => [record.contractualRentDue.sourceRef, record.collectedRent.sourceRef, record.potentialGrossRent.sourceRef, record.concessions.sourceRef]),
    ...additionalInputs.map((input) => input.sourceRef),
  ].filter(Boolean));
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest: interest,
    property,
    buildings: [building],
    units: [unit],
    leases: [lease],
    rentCollections: collections,
    tenants: [tenant],
    additionalOperatingInputs: additionalInputs,
    evidenceLineage: [
      ...[...sourceRefs].map((refId) => lineage(refId)),
      lineage(ADOPTION, LINEAGE_KIND.UNDERWRITING_ADOPTION),
    ],
  });
}

const sourceTotal = verified('rentRoll.sourceAnnualRentTotal', 1200000, 'SAR/year', 'evidence://rent-roll/source-total');
const readyCase = operatingCase({ additionalInputs: [sourceTotal] });
const metrics = calculateOperatingMetrics(readyCase);
assert.strictEqual(metrics.status, 'CALCULATED');
assert.strictEqual(metrics.rentRoll.sourceTotalReconciliation.status, 'RECONCILED');
assert.strictEqual(metrics.collectionsReconciliation.status, COLLECTIONS_RECONCILIATION_STATUS.CALCULATED);
assert.strictEqual(metrics.collectionsReconciliation.collectionRate, 0.9);
assert.strictEqual(metrics.collectionsReconciliation.economicOccupancy, 0.75);
assert.strictEqual(metrics.collectionsReconciliation.totals.creditLoss, 10000);
assert.strictEqual(metrics.collectionsReconciliation.totals.economicLoss, 30000);
assert.strictEqual(metrics.occupancy.economicOccupancy, 0.75);
assert.strictEqual(metrics.collectionsReconciliation.stabilizedNoiCalculated, false);

const vacantUnit = createUnit({
  caseId: CASE_ID,
  propertyInterestId: 'INTEREST-1',
  propertyId: 'PROPERTY-1',
  buildingId: 'BUILDING-1',
  unitId: 'UNIT-2',
  unitType: UNIT_TYPE.RESIDENTIAL_APARTMENT,
  operatingStatus: verified('unit.UNIT-2.operatingStatus', UNIT_OPERATING_STATUS.VACANT, null, 'evidence://unit-2/status'),
  rentableArea: verified('unit.UNIT-2.rentableArea', 100, 'm2', 'evidence://unit-2/area'),
  leaseIds: [],
});
const vacantCollection = createRentCollectionRecord({
  caseId: CASE_ID,
  collectionId: 'COLL-VACANT-1',
  propertyId: 'PROPERTY-1',
  buildingId: 'BUILDING-1',
  unitId: 'UNIT-2',
  leaseId: null,
  periodStart: '2026-01-01',
  periodEnd: AS_OF,
  contractualRentDue: verified('collection.COLL-VACANT-1.contractualRentDue', 0, 'SAR', 'evidence://collection/vacant'),
  collectedRent: verified('collection.COLL-VACANT-1.collectedRent', 0, 'SAR', 'evidence://collection/vacant'),
  potentialGrossRent: verified('collection.COLL-VACANT-1.potentialGrossRent', 50000, 'SAR', 'evidence://collection/vacant'),
  concessions: verified('collection.COLL-VACANT-1.concessions', 0, 'SAR', 'evidence://collection/vacant'),
  evidenceRefs: ['evidence://collection/vacant', ADOPTION],
});
function caseWithVacantUnit(rentCollections) {
  return createResidentialIncomeOperatingCase({
    caseId: CASE_ID,
    asOfDate: AS_OF,
    propertyInterest: readyCase.propertyInterest,
    property: readyCase.property,
    buildings: [createBuilding({ caseId: CASE_ID, propertyId: 'PROPERTY-1', buildingId: 'BUILDING-1', unitIds: ['UNIT-1', 'UNIT-2'] })],
    units: [readyCase.units[0], vacantUnit],
    leases: readyCase.leases,
    rentCollections,
    tenants: readyCase.tenants,
    additionalOperatingInputs: readyCase.additionalOperatingInputs,
    evidenceLineage: [
      ...readyCase.evidenceLineage,
      lineage('evidence://unit-2/status'),
      lineage('evidence://unit-2/area'),
      lineage('evidence://collection/vacant'),
    ],
  });
}
const incompleteInventoryCoverage = calculateOperatingMetrics(caseWithVacantUnit([readyCase.rentCollections[0]]));
assert.strictEqual(incompleteInventoryCoverage.occupancy.economicOccupancy, null);
assert(incompleteInventoryCoverage.collectionsReconciliation.issues.some((item) => item.code === 'ECONOMIC_OCCUPANCY_UNIT_COVERAGE_REQUIRED'));
const completeInventoryCoverage = calculateOperatingMetrics(caseWithVacantUnit([readyCase.rentCollections[0], vacantCollection]));
assert.strictEqual(completeInventoryCoverage.collectionsReconciliation.status, COLLECTIONS_RECONCILIATION_STATUS.CALCULATED);
assert(Math.abs(completeInventoryCoverage.occupancy.economicOccupancy - (90000 / 170000)) < 1e-12);

const partialMetrics = calculateOperatingMetrics(operatingCase({ collections: [collectionRecord({ potentialAvailable: false })] }));
assert.strictEqual(partialMetrics.collectionsReconciliation.status, COLLECTIONS_RECONCILIATION_STATUS.COLLECTION_RATE_ONLY);
assert.strictEqual(partialMetrics.collectionsReconciliation.collectionRate, 0.9);
assert.strictEqual(partialMetrics.occupancy.economicOccupancy, null);

const futurePeriodMetrics = calculateOperatingMetrics(operatingCase({ collections: [collectionRecord({ periodEnd: '2026-10-01' })] }));
assert.strictEqual(futurePeriodMetrics.collectionsReconciliation.status, COLLECTIONS_RECONCILIATION_STATUS.NOT_CALCULABLE);
assert.strictEqual(futurePeriodMetrics.collectionsReconciliation.collectionRate, null);
assert(futurePeriodMetrics.collectionsReconciliation.issues.some((item) => item.code === 'COLLECTION_PERIOD_ENDS_AFTER_AS_OF_DATE'));

assert.throws(
  () => operatingCase({ collections: [collectionRecord(), collectionRecord({ collectionId: 'COLL-2', periodStart: '2026-08-01' })] }),
  /OVERLAPPING_COLLECTION_PERIODS/,
);
assert.throws(
  () => addVerifiedRentCollection(readyCase, { leaseId: 'LEASE-1', confirmed: false }),
  /EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED/,
);

const editorCollectionCase = operatingCase({ collections: [] });
const withCollection = addVerifiedRentCollection(editorCollectionCase, {
  collectionId: 'COLL-EDITOR-1',
  leaseId: 'LEASE-1',
  periodStart: '2026-01-01',
  periodEnd: AS_OF,
  contractualRentDue: 100000,
  collectedRent: 95000,
  potentialGrossRent: 125000,
  concessions: 0,
  sourceRef: 'evidence://collection/editor-1',
  adoptionDecisionRef: 'adoption://collection/editor-1',
  confirmed: true,
}, { recordedAt: '2026-09-01T00:00:00Z' });
assert.strictEqual(withCollection.rentCollections.length, 1);
assert.strictEqual(calculateOperatingMetrics(withCollection).collectionsReconciliation.economicOccupancy, 0.76);

const updatedLeaseCase = updateVerifiedLeaseTerms(withCollection, {
  leaseId: 'LEASE-1',
  baseRent: 1300000,
  endDate: '2027-06-01',
  sourceRef: 'evidence://lease/editor-update',
  adoptionDecisionRef: 'adoption://lease/editor-update',
  confirmed: true,
}, { recordedAt: '2026-09-01T00:00:00Z' });
assert.strictEqual(updatedLeaseCase.leases[0].baseRent.value, 1300000);
assert.strictEqual(updatedLeaseCase.leases[0].endDate, '2027-06-01');

const envelope = buildResidentialIncomeOperatingCaseEnvelope(updatedLeaseCase);
assert.strictEqual(envelope.operatingCase.rentCollections.length, 1);
assert.strictEqual(hydrateResidentialIncomeOperatingCaseSnapshot(envelope.operatingCase).rentCollections[0].collectionId, 'COLL-EDITOR-1');
const legacySnapshot = JSON.parse(JSON.stringify(envelope.operatingCase));
delete legacySnapshot.rentCollections;
assert.deepStrictEqual(hydrateResidentialIncomeOperatingCaseSnapshot(legacySnapshot).rentCollections, []);

console.log('RIAI collections reconciliation v1: PASS');
