'use strict';

const {
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  deepFreeze,
} = require('./contracts');

const COLLECTIONS_RECONCILIATION_STATUS = Object.freeze({
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
  COLLECTION_RATE_ONLY: 'COLLECTION_RATE_ONLY',
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
});

const SOURCE_KINDS = new Set([LINEAGE_KIND.SOURCE_DOCUMENT, LINEAGE_KIND.EVIDENCE_FACT]);

function issue(issues, code, field, refId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId)) {
    issues.push({ code, field, refId });
  }
}

function validateValue({ value, field, allowAssumption, asOfMs, lineageByRef, issues }) {
  if (!value || typeof value !== 'object') {
    issue(issues, 'COLLECTION_INPUT_REQUIRED', field);
    return false;
  }
  const validStatus = value.verificationStatus === OPERATING_INPUT_STATUS.VERIFIED_FACT
    || (allowAssumption && value.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED);
  if (!validStatus || value.adoptedForUnderwriting !== true || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0) {
    issue(issues, allowAssumption ? 'ADOPTED_COLLECTION_INPUT_REQUIRED' : 'ADOPTED_VERIFIED_COLLECTION_FACT_REQUIRED', field, value.sourceRef);
    return false;
  }
  if (value.unit !== 'SAR') {
    issue(issues, 'COLLECTION_INPUT_UNIT_MUST_BE_SAR', field, value.sourceRef);
    return false;
  }
  if (!value.effectiveDate || new Date(value.effectiveDate).getTime() > asOfMs) {
    issue(issues, 'COLLECTION_INPUT_EFFECTIVE_DATE_INVALID', field, value.sourceRef);
    return false;
  }
  if (value.verificationStatus === OPERATING_INPUT_STATUS.VERIFIED_FACT) {
    const source = lineageByRef.get(value.sourceRef);
    if (!source || !SOURCE_KINDS.has(source.kind)) {
      issue(issues, 'COLLECTION_SOURCE_LINEAGE_INVALID', field, value.sourceRef);
      return false;
    }
  }
  const adoption = lineageByRef.get(value.adoptionDecisionRef);
  if (!adoption || adoption.kind !== LINEAGE_KIND.UNDERWRITING_ADOPTION) {
    issue(issues, 'COLLECTION_ADOPTION_LINEAGE_INVALID', field, value.adoptionDecisionRef);
    return false;
  }
  return true;
}

function empty(operatingCase, status, issues = [], recordCount = 0) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    issues,
    reportingPeriod: null,
    recordCount,
    totals: {
      contractualRentDue: null,
      rentCollected: null,
      potentialGrossRent: null,
      concessions: null,
      creditLoss: null,
      economicLoss: null,
    },
    collectionRate: null,
    economicOccupancy: null,
    collectionRateStatus: 'NOT_CALCULABLE_WITHOUT_ADOPTED_DUE_AND_COLLECTION_FACTS',
    economicOccupancyStatus: 'NOT_CALCULABLE_WITHOUT_ADOPTED_POTENTIAL_GROSS_RENT',
    internalReconciliation: { status: recordCount ? 'FAILED_VALIDATION' : 'NOT_AVAILABLE', recordCount },
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    investmentDecision: null,
    semantics: 'Collection evidence is unavailable or incomplete. Missing collection or potential-rent values are never treated as zero.',
  });
}

function assessEconomicCoverage(operatingCase, records, issues) {
  const ranges = [];
  let complete = true;
  for (const unit of operatingCase.units) {
    const unitRecords = records
      .filter((record) => record.unitId === unit.unitId)
      .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    if (!unitRecords.length) {
      issue(issues, 'ECONOMIC_OCCUPANCY_UNIT_COVERAGE_REQUIRED', `unit.${unit.unitId}.rentCollections`);
      complete = false;
      continue;
    }
    for (let index = 1; index < unitRecords.length; index += 1) {
      if (new Date(unitRecords[index].periodStart).getTime() !== new Date(unitRecords[index - 1].periodEnd).getTime()) {
        issue(issues, 'ECONOMIC_OCCUPANCY_PERIOD_GAP', `unit.${unit.unitId}.rentCollections`);
        complete = false;
      }
    }
    ranges.push({
      unitId: unit.unitId,
      start: new Date(unitRecords[0].periodStart).getTime(),
      end: new Date(unitRecords[unitRecords.length - 1].periodEnd).getTime(),
    });
  }
  if (ranges.length) {
    const benchmark = ranges[0];
    for (const range of ranges.slice(1)) {
      if (range.start !== benchmark.start || range.end !== benchmark.end) {
        issue(issues, 'ECONOMIC_OCCUPANCY_PERIOD_COVERAGE_MISMATCH', `unit.${range.unitId}.rentCollections`);
        complete = false;
      }
    }
  }
  return complete;
}

function calculateCollectionsReconciliation(operatingCase) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }
  const records = operatingCase.rentCollections || [];
  if (!records.length) return empty(operatingCase, COLLECTIONS_RECONCILIATION_STATUS.NOT_AVAILABLE);

  const asOfMs = new Date(operatingCase.asOfDate).getTime();
  const lineageByRef = new Map((operatingCase.evidenceLineage || []).map((record) => [record.refId, record]));
  const issues = [];
  const validity = [];
  let hasAssumptions = false;

  for (const record of records) {
    const prefix = `collection.${record.collectionId}`;
    const periodValid = new Date(record.periodEnd).getTime() <= asOfMs;
    if (!periodValid) {
      issue(issues, 'COLLECTION_PERIOD_ENDS_AFTER_AS_OF_DATE', prefix);
    }
    const dueValid = validateValue({ value: record.contractualRentDue, field: `${prefix}.contractualRentDue`, allowAssumption: false, asOfMs, lineageByRef, issues });
    const collectedValid = validateValue({ value: record.collectedRent, field: `${prefix}.collectedRent`, allowAssumption: false, asOfMs, lineageByRef, issues });
    const potentialValid = validateValue({ value: record.potentialGrossRent, field: `${prefix}.potentialGrossRent`, allowAssumption: true, asOfMs, lineageByRef, issues });
    const concessionsValid = validateValue({ value: record.concessions, field: `${prefix}.concessions`, allowAssumption: false, asOfMs, lineageByRef, issues });
    if (potentialValid && record.potentialGrossRent.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED) hasAssumptions = true;
    validity.push({ record, periodValid, dueValid, collectedValid, potentialValid, concessionsValid });
  }

  const collectionRows = validity.filter((item) => item.periodValid && item.dueValid && item.collectedValid);
  const economicRows = validity.filter((item) => item.periodValid && item.dueValid && item.collectedValid && item.potentialValid);
  if (collectionRows.length !== records.length) {
    return empty(operatingCase, COLLECTIONS_RECONCILIATION_STATUS.NOT_CALCULABLE, issues, records.length);
  }

  const totalDue = collectionRows.reduce((sum, item) => sum + item.record.contractualRentDue.value, 0);
  const totalCollected = collectionRows.reduce((sum, item) => sum + item.record.collectedRent.value, 0);
  const collectionRate = totalDue > 0 ? totalCollected / totalDue : null;
  if (totalDue === 0) issue(issues, 'CONTRACTUAL_RENT_DUE_MUST_BE_POSITIVE', 'rentCollections');

  const inventoryCoverageComplete = assessEconomicCoverage(operatingCase, records, issues);
  const completeEconomicCoverage = economicRows.length === records.length && inventoryCoverageComplete;
  const totalPotential = completeEconomicCoverage
    ? economicRows.reduce((sum, item) => sum + item.record.potentialGrossRent.value, 0)
    : null;
  const economicOccupancy = totalPotential !== null && totalPotential > 0 ? totalCollected / totalPotential : null;
  if (totalPotential === 0) issue(issues, 'POTENTIAL_GROSS_RENT_MUST_BE_POSITIVE', 'rentCollections');

  const completeConcessionCoverage = validity.every((item) => item.concessionsValid);
  const totalConcessions = completeConcessionCoverage
    ? validity.reduce((sum, item) => sum + item.record.concessions.value, 0)
    : null;
  const periodStart = records.reduce((min, record) => Math.min(min, new Date(record.periodStart).getTime()), Infinity);
  const periodEnd = records.reduce((max, record) => Math.max(max, new Date(record.periodEnd).getTime()), -Infinity);

  let status = COLLECTIONS_RECONCILIATION_STATUS.COLLECTION_RATE_ONLY;
  if (economicOccupancy !== null) {
    status = hasAssumptions
      ? COLLECTIONS_RECONCILIATION_STATUS.CALCULATED_WITH_ASSUMPTIONS
      : COLLECTIONS_RECONCILIATION_STATUS.CALCULATED;
  }

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    issues,
    reportingPeriod: {
      startDate: new Date(periodStart).toISOString(),
      endDate: new Date(periodEnd).toISOString(),
      coveragePolicy: 'Aggregate of non-overlapping unit collection periods ending on or before the case as-of date.',
    },
    recordCount: records.length,
    totals: {
      contractualRentDue: totalDue,
      rentCollected: totalCollected,
      potentialGrossRent: totalPotential,
      concessions: totalConcessions,
      creditLoss: Math.max(0, totalDue - totalCollected),
      economicLoss: totalPotential === null ? null : Math.max(0, totalPotential - totalCollected),
    },
    collectionRate,
    economicOccupancy,
    collectionRateStatus: collectionRate === null ? 'NOT_CALCULABLE_ZERO_CONTRACTUAL_RENT_DUE' : 'CALCULATED_FROM_VERIFIED_COLLECTION_FACTS',
    economicOccupancyStatus: economicOccupancy === null
      ? 'NOT_CALCULABLE_WITHOUT_COMPLETE_ADOPTED_POTENTIAL_GROSS_RENT'
      : hasAssumptions ? 'CALCULATED_WITH_EXPLICIT_POTENTIAL_RENT_ASSUMPTIONS' : 'CALCULATED_FROM_ADOPTED_EVIDENCE',
    internalReconciliation: {
      status: collectionRows.length === records.length ? 'RECONCILED' : 'PARTIAL_COVERAGE',
      recordCount: records.length,
      collectionRateRecordCount: collectionRows.length,
      economicOccupancyRecordCount: economicRows.length,
    },
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    investmentDecision: null,
    semantics: 'Collection rate equals verified cash collected divided by verified contractual rent due. Economic occupancy equals cash collected divided by complete adopted potential gross rent. Neither metric is silently written into stabilized NOI.',
  });
}

module.exports = {
  COLLECTIONS_RECONCILIATION_STATUS,
  calculateCollectionsReconciliation,
};
