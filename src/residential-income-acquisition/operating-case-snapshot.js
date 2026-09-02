'use strict';

const {
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createBuilding,
  createUnit,
  createTenant,
  createRentEscalation,
  createLease,
  createOperatingExpense,
  createCapexItem,
  createExitStrategyScenario,
  createResidentialIncomeOperatingCase,
} = require('./contracts');

const OPERATING_CASE_FILE_FORMAT = 'STARTAK_RESIDENTIAL_INCOME_OPERATING_CASE';
const OPERATING_CASE_SNAPSHOT_VERSION = 1;
const MAX_OPERATING_CASE_JSON_BYTES = 5 * 1024 * 1024;
const MAX_RECORDS = Object.freeze({
  buildings: 500,
  units: 10000,
  leases: 20000,
  tenants: 20000,
  operatingExpenses: 10000,
  capexItems: 10000,
  exitScenarios: 100,
  additionalOperatingInputs: 10000,
  evidenceLineage: 50000,
});

class OperatingCaseSnapshotError extends Error {
  constructor(reasonCode, detail = null) {
    super(`Operating-case snapshot validation failed: ${reasonCode}`);
    this.name = 'OperatingCaseSnapshotError';
    this.reasonCode = reasonCode;
    this.detail = detail;
  }
}

function plainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OperatingCaseSnapshotError('INVALID_OBJECT', field);
  }
  return value;
}

function assertNoDangerousKeys(value, path = 'root') {
  const seen = new Set();
  const stack = [{ value, path, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current.value || typeof current.value !== 'object' || seen.has(current.value)) continue;
    if (current.depth > 100) throw new OperatingCaseSnapshotError('MAXIMUM_NESTING_EXCEEDED', current.path);
    seen.add(current.value);
    visited += 1;
    if (visited > 200000) throw new OperatingCaseSnapshotError('OBJECT_GRAPH_LIMIT_EXCEEDED', current.path);
    for (const key of Object.keys(current.value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        throw new OperatingCaseSnapshotError('DANGEROUS_KEY_REJECTED', `${current.path}.${key}`);
      }
      stack.push({ value: current.value[key], path: `${current.path}.${key}`, depth: current.depth + 1 });
    }
  }
}

function safeProjectionCount(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new OperatingCaseSnapshotError('INVALID_PROJECTION_COUNT', field);
  }
  return value;
}

function arrayWithinLimit(snapshot, field) {
  const value = snapshot[field];
  if (!Array.isArray(value)) throw new OperatingCaseSnapshotError('ARRAY_REQUIRED', field);
  if (value.length > MAX_RECORDS[field]) throw new OperatingCaseSnapshotError('RECORD_LIMIT_EXCEEDED', field);
  return value;
}

function optionalArrayWithinLimit(snapshot, field) {
  if (snapshot[field] === undefined) return [];
  return arrayWithinLimit(snapshot, field);
}

function hydrateEvidenceAwareValue(value) {
  const record = plainObject(value, 'evidenceAwareValue');
  return createEvidenceAwareValue({
    field: record.field,
    value: record.value,
    unit: record.unit,
    sourceRef: record.sourceRef,
    evidenceType: record.evidenceType,
    effectiveDate: record.effectiveDate,
    verificationStatus: record.verificationStatus,
    confidence: record.confidence,
    adoptedForUnderwriting: record.adoptedForUnderwriting,
    adoptionDecisionRef: record.adoptionDecisionRef,
    assumptionOverride: record.assumptionOverride,
    lineageRefs: record.lineageRefs,
  });
}

function hydratePropertyInterest(record) {
  plainObject(record, 'propertyInterest');
  const titleAssessment = record.titleAssessment
    ? {
      caseId: record.caseId,
      propertyId: record.propertyId,
      status: record.titleAssessment.status,
      blockers: Array.from({ length: safeProjectionCount(record.titleAssessment.blockerCount || 0, 'titleAssessment.blockerCount') }, () => ({})),
      legalReviewFlags: Array.from({ length: safeProjectionCount(record.titleAssessment.legalReviewFlagCount || 0, 'titleAssessment.legalReviewFlagCount') }, () => ({})),
    }
    : null;
  return createPropertyInterest({
    caseId: record.caseId,
    propertyInterestId: record.propertyInterestId,
    propertyId: record.propertyId,
    interestType: record.interestType,
    interestEvidenceRef: record.interestEvidenceRef,
    commencementDate: record.commencementDate,
    expiryDate: record.expiryDate,
    rightsSummary: record.rightsSummary,
    titleAssessment,
    titleAssessmentRef: record.titleAssessmentRef,
    interestAdoptionDecisionRef: record.interestAdoptionDecisionRef,
    legalReviewRef: record.legalReviewRef,
    evidenceRefs: record.evidenceRefs,
  });
}

function hydrateResidentialIncomeOperatingCaseSnapshot(snapshot) {
  plainObject(snapshot, 'operatingCase');
  assertNoDangerousKeys(snapshot);
  let snapshotText;
  try { snapshotText = JSON.stringify(snapshot); } catch (error) { throw new OperatingCaseSnapshotError('SNAPSHOT_NOT_SERIALIZABLE'); }
  if (utf8ByteLength(snapshotText) > MAX_OPERATING_CASE_JSON_BYTES) throw new OperatingCaseSnapshotError('FILE_TOO_LARGE');
  if (snapshot.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new OperatingCaseSnapshotError('UNSUPPORTED_CONTRACT_TYPE', 'operatingCase.contractType');
  }
  for (const field of Object.keys(MAX_RECORDS)) {
    if (field === 'exitScenarios') optionalArrayWithinLimit(snapshot, field);
    else arrayWithinLimit(snapshot, field);
  }

  try {
    const property = createProperty({
      caseId: snapshot.property.caseId,
      propertyId: snapshot.property.propertyId,
      assetClass: snapshot.property.assetClass,
      name: snapshot.property.name,
      buildingIds: snapshot.property.buildingIds,
      evidenceRefs: snapshot.property.evidenceRefs,
    });
    const buildings = snapshot.buildings.map((record) => createBuilding({
      caseId: record.caseId,
      propertyId: record.propertyId,
      buildingId: record.buildingId,
      name: record.name,
      unitIds: record.unitIds,
      evidenceRefs: record.evidenceRefs,
    }));
    const units = snapshot.units.map((record) => createUnit({
      caseId: record.caseId,
      propertyInterestId: record.propertyInterestId,
      propertyId: record.propertyId,
      buildingId: record.buildingId,
      unitId: record.unitId,
      unitType: record.unitType,
      operatingStatus: hydrateEvidenceAwareValue(record.operatingStatus),
      rentableArea: hydrateEvidenceAwareValue(record.rentableArea),
      leaseIds: record.leaseIds,
      evidenceRefs: record.evidenceRefs,
    }));
    const tenants = snapshot.tenants.map((record) => createTenant({
      caseId: record.caseId,
      tenantId: record.tenantId,
      displayName: record.displayName,
      tenantAssessment: record.tenantAssessment ? { ...record.tenantAssessment, tenantId: record.tenantId } : null,
      tenantAssessmentRef: record.tenantAssessmentRef,
      evidenceRefs: record.evidenceRefs,
    }));
    const leases = snapshot.leases.map((record) => createLease({
      caseId: record.caseId,
      propertyInterestId: record.propertyInterestId,
      propertyId: record.propertyId,
      buildingId: record.buildingId,
      unitId: record.unitId,
      leaseId: record.leaseId,
      tenantId: record.tenantId,
      lifecycleStatus: record.lifecycleStatus,
      startDate: record.startDate,
      endDate: record.endDate,
      baseRent: hydrateEvidenceAwareValue(record.baseRent),
      rentFrequency: record.rentFrequency,
      escalation: createRentEscalation({
        type: record.escalation.type,
        intervalYears: record.escalation.intervalYears,
        changeValue: record.escalation.changeValue ? hydrateEvidenceAwareValue(record.escalation.changeValue) : null,
        schedule: record.escalation.schedule.map((entry) => ({
          effectiveDate: entry.effectiveDate,
          rent: hydrateEvidenceAwareValue(entry.rent),
        })),
        indexName: record.escalation.indexName,
        indexEvidenceRef: record.escalation.indexEvidenceRef,
      }),
      securityRefs: record.securityRefs,
      termsEvidenceRef: record.termsEvidenceRef,
      termsAdoptionDecisionRef: record.termsAdoptionDecisionRef,
      evidenceRefs: record.evidenceRefs,
    }));
    const operatingExpenses = snapshot.operatingExpenses.map((record) => createOperatingExpense({
      caseId: record.caseId,
      expenseId: record.expenseId,
      propertyId: record.propertyId,
      buildingId: record.buildingId,
      category: record.category,
      basis: record.basis,
      annualAmount: hydrateEvidenceAwareValue(record.annualAmount),
      evidenceRefs: record.evidenceRefs,
    }));
    const capexItems = snapshot.capexItems.map((record) => createCapexItem({
      caseId: record.caseId,
      capexItemId: record.capexItemId,
      propertyId: record.propertyId,
      buildingId: record.buildingId,
      category: record.category,
      severity: record.severity,
      estimatedCost: hydrateEvidenceAwareValue(record.estimatedCost),
      lifeSafety: record.lifeSafety,
      complianceImpact: record.complianceImpact,
      immediate: record.immediate,
      requiredByDate: record.requiredByDate,
      downtimeDays: record.downtimeDays,
      evidenceRefs: record.evidenceRefs,
    }));
    const exitScenarios = optionalArrayWithinLimit(snapshot, 'exitScenarios').map((record) => createExitStrategyScenario({
      caseId: record.caseId,
      scenarioId: record.scenarioId,
      strategyType: record.strategyType,
      label: record.label,
      isBenchmark: record.isBenchmark,
      inputs: Object.fromEntries(Object.entries(record.inputs || {}).map(([key, value]) => [key, hydrateEvidenceAwareValue(value)])),
      evidenceRefs: record.evidenceRefs,
    }));
    const additionalOperatingInputs = snapshot.additionalOperatingInputs.map(hydrateEvidenceAwareValue);
    const evidenceLineage = snapshot.evidenceLineage.map((record) => createEvidenceLineageRecord({
      caseId: record.caseId,
      refId: record.refId,
      kind: record.kind,
      recordedAt: record.recordedAt,
      documentId: record.documentId,
      factId: record.factId,
      contentHashSha256: record.contentHashSha256,
      sourceLocator: record.sourceLocator,
      note: record.note,
    }));

    return createResidentialIncomeOperatingCase({
      caseId: snapshot.caseId,
      asOfDate: snapshot.asOfDate,
      propertyInterest: hydratePropertyInterest(snapshot.propertyInterest),
      property,
      buildings,
      units,
      leases,
      tenants,
      operatingExpenses,
      capexItems,
      exitScenarios,
      additionalOperatingInputs,
      evidenceLineage,
    });
  } catch (error) {
    if (error instanceof OperatingCaseSnapshotError) throw error;
    throw new OperatingCaseSnapshotError('INVALID_OPERATING_CASE', String(error.message || error).slice(0, 240));
  }
}

function buildResidentialIncomeOperatingCaseEnvelope(operatingCase) {
  const hydrated = hydrateResidentialIncomeOperatingCaseSnapshot(operatingCase);
  return {
    format: OPERATING_CASE_FILE_FORMAT,
    snapshotVersion: OPERATING_CASE_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    operatingCase: JSON.parse(JSON.stringify(hydrated)),
  };
}

function utf8ByteLength(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length * 2;
}

function parseResidentialIncomeOperatingCaseEnvelope(text) {
  if (typeof text !== 'string') throw new OperatingCaseSnapshotError('JSON_TEXT_REQUIRED');
  if (utf8ByteLength(text) > MAX_OPERATING_CASE_JSON_BYTES) throw new OperatingCaseSnapshotError('FILE_TOO_LARGE');
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { throw new OperatingCaseSnapshotError('INVALID_JSON'); }
  plainObject(parsed, 'envelope');
  assertNoDangerousKeys(parsed);
  if (parsed.format !== OPERATING_CASE_FILE_FORMAT) throw new OperatingCaseSnapshotError('UNKNOWN_FORMAT');
  if (parsed.snapshotVersion !== OPERATING_CASE_SNAPSHOT_VERSION) throw new OperatingCaseSnapshotError('UNSUPPORTED_VERSION');
  return hydrateResidentialIncomeOperatingCaseSnapshot(parsed.operatingCase);
}

module.exports = {
  OPERATING_CASE_FILE_FORMAT,
  OPERATING_CASE_SNAPSHOT_VERSION,
  MAX_OPERATING_CASE_JSON_BYTES,
  OperatingCaseSnapshotError,
  hydrateResidentialIncomeOperatingCaseSnapshot,
  buildResidentialIncomeOperatingCaseEnvelope,
  parseResidentialIncomeOperatingCaseEnvelope,
};
