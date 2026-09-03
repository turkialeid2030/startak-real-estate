'use strict';

const {
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createLease,
  createRentCollectionRecord,
  createResidentialIncomeOperatingCase,
} = require('./contracts');

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function nonNegativeNumber(value, field) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${field} must be a finite number >= 0`);
  return parsed;
}

function isoDate(value, field) {
  const text = requiredText(value, field);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date`);
  return text;
}

function extendEvidenceLineage(operatingCase, { sourceRef, adoptionDecisionRef, recordedAt, note }) {
  const records = [...operatingCase.evidenceLineage];
  const source = records.find((record) => record.refId === sourceRef);
  if (source && ![LINEAGE_KIND.SOURCE_DOCUMENT, LINEAGE_KIND.EVIDENCE_FACT].includes(source.kind)) {
    throw new TypeError('EDITOR_SOURCE_LINEAGE_KIND_INVALID');
  }
  if (!source) {
    records.push(createEvidenceLineageRecord({
      caseId: operatingCase.caseId,
      refId: sourceRef,
      kind: LINEAGE_KIND.EVIDENCE_FACT,
      recordedAt,
      note,
    }));
  }
  const adoption = records.find((record) => record.refId === adoptionDecisionRef);
  if (adoption && adoption.kind !== LINEAGE_KIND.UNDERWRITING_ADOPTION) {
    throw new TypeError('EDITOR_ADOPTION_LINEAGE_KIND_INVALID');
  }
  if (!adoption) {
    records.push(createEvidenceLineageRecord({
      caseId: operatingCase.caseId,
      refId: adoptionDecisionRef,
      kind: LINEAGE_KIND.UNDERWRITING_ADOPTION,
      recordedAt,
      note: 'Explicit human adoption recorded through the STARTAK operating workspace.',
    }));
  }
  return records;
}

function verifiedMoney(field, value, sourceRef, adoptionDecisionRef, effectiveDate) {
  return createEvidenceAwareValue({
    field,
    value: nonNegativeNumber(value, field),
    unit: 'SAR',
    sourceRef,
    evidenceType: 'OPERATOR_VERIFIED_SOURCE_ENTRY',
    effectiveDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef,
  });
}

function rebuildCase(operatingCase, overrides) {
  return createResidentialIncomeOperatingCase({
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    propertyInterest: operatingCase.propertyInterest,
    property: operatingCase.property,
    buildings: operatingCase.buildings,
    units: operatingCase.units,
    leases: overrides.leases || operatingCase.leases,
    rentCollections: overrides.rentCollections || operatingCase.rentCollections || [],
    tenants: operatingCase.tenants,
    operatingExpenses: operatingCase.operatingExpenses,
    capexItems: operatingCase.capexItems,
    exitScenarios: operatingCase.exitScenarios,
    additionalOperatingInputs: operatingCase.additionalOperatingInputs,
    evidenceLineage: overrides.evidenceLineage || operatingCase.evidenceLineage,
  });
}

function updateVerifiedLeaseTerms(operatingCase, draft, { recordedAt = new Date().toISOString() } = {}) {
  if (!draft || draft.confirmed !== true) throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const leaseId = requiredText(draft.leaseId, 'leaseId');
  const sourceRef = requiredText(draft.sourceRef, 'sourceRef');
  const adoptionDecisionRef = requiredText(draft.adoptionDecisionRef, 'adoptionDecisionRef');
  const target = operatingCase.leases.find((lease) => lease.leaseId === leaseId);
  if (!target) throw new TypeError('LEASE_NOT_FOUND');
  const endDate = isoDate(draft.endDate, 'endDate');
  const baseRentValue = nonNegativeNumber(draft.baseRent, 'baseRent');
  const evidenceLineage = extendEvidenceLineage(operatingCase, {
    sourceRef,
    adoptionDecisionRef,
    recordedAt,
    note: 'Lease terms evidence explicitly verified through the STARTAK operating workspace.',
  });
  const baseRent = createEvidenceAwareValue({
    field: `lease.${leaseId}.baseRent`,
    value: baseRentValue,
    unit: target.baseRent.unit,
    sourceRef,
    evidenceType: 'OPERATOR_VERIFIED_LEASE_TERMS',
    effectiveDate: operatingCase.asOfDate,
    verificationStatus: OPERATING_INPUT_STATUS.VERIFIED_FACT,
    confidence: 1,
    adoptedForUnderwriting: true,
    adoptionDecisionRef,
  });
  const updatedLease = createLease({
    caseId: target.caseId,
    propertyInterestId: target.propertyInterestId,
    propertyId: target.propertyId,
    buildingId: target.buildingId,
    unitId: target.unitId,
    leaseId: target.leaseId,
    tenantId: target.tenantId,
    lifecycleStatus: target.lifecycleStatus,
    startDate: target.startDate,
    endDate,
    baseRent,
    rentFrequency: target.rentFrequency,
    escalation: target.escalation,
    securityRefs: target.securityRefs,
    termsEvidenceRef: sourceRef,
    termsAdoptionDecisionRef: adoptionDecisionRef,
    evidenceRefs: target.evidenceRefs,
  });
  const leases = operatingCase.leases.map((lease) => lease.leaseId === leaseId ? updatedLease : lease);
  return rebuildCase(operatingCase, { leases, evidenceLineage });
}

function addVerifiedRentCollection(operatingCase, draft, { recordedAt = new Date().toISOString() } = {}) {
  if (!draft || draft.confirmed !== true) throw new TypeError('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');
  const collectionId = requiredText(draft.collectionId, 'collectionId');
  const leaseId = typeof draft.leaseId === 'string' && draft.leaseId.trim() ? draft.leaseId.trim() : null;
  const sourceRef = requiredText(draft.sourceRef, 'sourceRef');
  const adoptionDecisionRef = requiredText(draft.adoptionDecisionRef, 'adoptionDecisionRef');
  const periodStart = isoDate(draft.periodStart, 'periodStart');
  const periodEnd = isoDate(draft.periodEnd, 'periodEnd');
  const lease = leaseId ? operatingCase.leases.find((record) => record.leaseId === leaseId) : null;
  if (leaseId && !lease) throw new TypeError('LEASE_NOT_FOUND');
  const unitId = lease ? lease.unitId : requiredText(draft.unitId, 'unitId');
  const unit = operatingCase.units.find((record) => record.unitId === unitId);
  if (!unit) throw new TypeError('UNIT_NOT_FOUND');
  const evidenceLineage = extendEvidenceLineage(operatingCase, {
    sourceRef,
    adoptionDecisionRef,
    recordedAt,
    note: 'Collection evidence explicitly verified through the STARTAK operating workspace.',
  });
  const money = (key, value) => verifiedMoney(`collection.${collectionId}.${key}`, value, sourceRef, adoptionDecisionRef, periodEnd);
  const collection = createRentCollectionRecord({
    caseId: operatingCase.caseId,
    collectionId,
    propertyId: unit.propertyId,
    buildingId: unit.buildingId,
    unitId: unit.unitId,
    leaseId,
    periodStart,
    periodEnd,
    contractualRentDue: money('contractualRentDue', draft.contractualRentDue),
    collectedRent: money('collectedRent', draft.collectedRent),
    potentialGrossRent: money('potentialGrossRent', draft.potentialGrossRent),
    concessions: money('concessions', draft.concessions),
    evidenceRefs: [sourceRef, adoptionDecisionRef],
  });
  return rebuildCase(operatingCase, {
    rentCollections: [...(operatingCase.rentCollections || []), collection],
    evidenceLineage,
  });
}

module.exports = {
  updateVerifiedLeaseTerms,
  addVerifiedRentCollection,
};
