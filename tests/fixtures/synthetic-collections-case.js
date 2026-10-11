'use strict';

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

module.exports = {operatingCase, collectionRecord, verified, AS_OF, CASE_ID};
