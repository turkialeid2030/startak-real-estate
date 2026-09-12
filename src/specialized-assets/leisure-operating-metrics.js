'use strict';

const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_ASSET_PACKET_STATUS,
  SPECIALIZED_EVIDENCE_TOPIC,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  verifySpecializedAssetEvidencePacketIntegrity,
} = require('./specialized-asset-evidence');

const LEISURE_OPERATING_RECORD_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
});

const LEISURE_OPERATING_METRICS_STATUS = Object.freeze({
  READY: 'READY',
  NOT_APPLICABLE_ASSET_CLASS: 'NOT_APPLICABLE_ASSET_CLASS',
  NOT_APPLICABLE_OPERATING_STATE: 'NOT_APPLICABLE_OPERATING_STATE',
  HOLD_SPECIALIZED_PACKET: 'HOLD_SPECIALIZED_PACKET',
  HOLD_PERIOD_EVIDENCE: 'HOLD_PERIOD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const ACTIVE_LEISURE_STATES = Object.freeze([
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_STATE.RAMP_UP,
  SPECIALIZED_OPERATING_STATE.CLOSED_TEMPORARILY,
]);

const QUALIFIED_RECORD_STATUSES = Object.freeze([
  LEISURE_OPERATING_RECORD_STATUS.VERIFIED,
  LEISURE_OPERATING_RECORD_STATUS.PROFESSIONAL_REVIEWED,
]);

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty date/time`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
}
function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive integer`);
}
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) throw new TypeError(`${field} must contain non-empty references`);
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function createLeisureOperatingPeriodRecord({
  recordId,
  caseId,
  propertyRef,
  periodStart,
  periodEnd,
  operatingDays,
  attendanceCount,
  admissionsRevenueSar,
  foodBeverageRevenueSar,
  retailMerchandiseRevenueSar,
  otherOperatingRevenueSar,
  directOperatingExpensesSar,
  undistributedOperatingExpensesSar,
  managementFeesSar,
  capitalReserveSar,
  sourceRef,
  sourceDocumentHashSha256,
  evidenceRefs,
  status,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['recordId', recordId], ['caseId', caseId], ['propertyRef', propertyRef], ['sourceRef', sourceRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  if (!Object.values(LEISURE_OPERATING_RECORD_STATUS).includes(status)) throw new TypeError('status is invalid');
  if (!validSha(sourceDocumentHashSha256)) throw new TypeError('sourceDocumentHashSha256 must be a SHA-256 hex string');

  const start = iso(periodStart, 'periodStart');
  const end = iso(periodEnd, 'periodEnd');
  if (Date.parse(end) < Date.parse(start)) throw new TypeError('LEISURE_PERIOD_END_BEFORE_START');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(prepared) < Date.parse(end)) throw new TypeError('LEISURE_RECORD_PREPARED_BEFORE_PERIOD_END');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('LEISURE_RECORD_REVIEW_BEFORE_PREPARATION');

  positiveInteger(operatingDays, 'operatingDays');
  if (!Number.isInteger(attendanceCount) || attendanceCount < 0) throw new TypeError('attendanceCount must be a non-negative integer');
  for (const [field, value] of [
    ['admissionsRevenueSar', admissionsRevenueSar], ['foodBeverageRevenueSar', foodBeverageRevenueSar],
    ['retailMerchandiseRevenueSar', retailMerchandiseRevenueSar], ['otherOperatingRevenueSar', otherOperatingRevenueSar],
    ['directOperatingExpensesSar', directOperatingExpensesSar], ['undistributedOperatingExpensesSar', undistributedOperatingExpensesSar],
    ['managementFeesSar', managementFeesSar], ['capitalReserveSar', capitalReserveSar],
  ]) finiteNonNegative(value, field);
  const visitorLinkedRevenue = admissionsRevenueSar + foodBeverageRevenueSar + retailMerchandiseRevenueSar + otherOperatingRevenueSar;
  if (attendanceCount === 0 && visitorLinkedRevenue > 0) throw new TypeError('LEISURE_REVENUE_WITH_ZERO_ATTENDANCE');

  const core = {
    schemaVersion: 1,
    recordId: recordId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodStart: start,
    periodEnd: end,
    operatingDays,
    attendanceCount,
    admissionsRevenueSar,
    foodBeverageRevenueSar,
    retailMerchandiseRevenueSar,
    otherOperatingRevenueSar,
    directOperatingExpensesSar,
    undistributedOperatingExpensesSar,
    managementFeesSar,
    capitalReserveSar,
    sourceRef: sourceRef.trim(),
    sourceDocumentHashSha256: sourceDocumentHashSha256.toLowerCase(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    status,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    leisureOperatingRecordHashSha256: sha256(core),
    historicalEvidenceOnly: true,
    auditedFinancialStatementOpinionEstablished: false,
    valuationInputAdopted: false,
  });
}

function verifyLeisureOperatingPeriodRecordIntegrity(record) {
  if (!record || !validSha(record.leisureOperatingRecordHashSha256)) return false;
  const core = { ...record };
  ['leisureOperatingRecordHashSha256', 'historicalEvidenceOnly', 'auditedFinancialStatementOpinionEstablished', 'valuationInputAdopted'].forEach((key) => delete core[key]);
  return sha256(core) === record.leisureOperatingRecordHashSha256.toLowerCase();
}

function evidenceTopicQualified(packet, topic) {
  const item = (Array.isArray(packet?.evidenceItems) ? packet.evidenceItems : []).find((entry) => entry?.topic === topic);
  return Boolean(item && [SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED, SPECIALIZED_EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED].includes(item.status));
}

function sumRecords(records) {
  return records.reduce((totals, record) => {
    totals.operatingDays += record.operatingDays;
    totals.attendanceCount += record.attendanceCount;
    totals.admissionsRevenueSar += record.admissionsRevenueSar;
    totals.foodBeverageRevenueSar += record.foodBeverageRevenueSar;
    totals.retailMerchandiseRevenueSar += record.retailMerchandiseRevenueSar;
    totals.otherOperatingRevenueSar += record.otherOperatingRevenueSar;
    totals.directOperatingExpensesSar += record.directOperatingExpensesSar;
    totals.undistributedOperatingExpensesSar += record.undistributedOperatingExpensesSar;
    totals.managementFeesSar += record.managementFeesSar;
    totals.capitalReserveSar += record.capitalReserveSar;
    return totals;
  }, {
    operatingDays: 0,
    attendanceCount: 0,
    admissionsRevenueSar: 0,
    foodBeverageRevenueSar: 0,
    retailMerchandiseRevenueSar: 0,
    otherOperatingRevenueSar: 0,
    directOperatingExpensesSar: 0,
    undistributedOperatingExpensesSar: 0,
    managementFeesSar: 0,
    capitalReserveSar: 0,
  });
}

function calculateMetrics(totals) {
  const ancillaryRevenueSar = totals.foodBeverageRevenueSar + totals.retailMerchandiseRevenueSar + totals.otherOperatingRevenueSar;
  const totalOperatingRevenueSar = totals.admissionsRevenueSar + ancillaryRevenueSar;
  const operatingSurplusBeforeManagementAndReserveSar = totalOperatingRevenueSar
    - totals.directOperatingExpensesSar
    - totals.undistributedOperatingExpensesSar;
  const operatingSurplusBeforeReserveSar = operatingSurplusBeforeManagementAndReserveSar - totals.managementFeesSar;
  const operatingSurplusAfterCapitalReserveSar = operatingSurplusBeforeReserveSar - totals.capitalReserveSar;
  return {
    ...totals,
    ancillaryRevenueSar,
    totalOperatingRevenueSar,
    attendancePerOperatingDay: totals.operatingDays > 0 ? totals.attendanceCount / totals.operatingDays : null,
    admissionsRevenuePerVisitorSar: totals.attendanceCount > 0 ? totals.admissionsRevenueSar / totals.attendanceCount : null,
    ancillarySpendPerVisitorSar: totals.attendanceCount > 0 ? ancillaryRevenueSar / totals.attendanceCount : null,
    totalRevenuePerVisitorSar: totals.attendanceCount > 0 ? totalOperatingRevenueSar / totals.attendanceCount : null,
    operatingSurplusBeforeManagementAndReserveSar,
    operatingSurplusBeforeReserveSar,
    operatingSurplusAfterCapitalReserveSar,
    operatingSurplusAfterReserveMargin: totalOperatingRevenueSar !== 0 ? operatingSurplusAfterCapitalReserveSar / totalOperatingRevenueSar : null,
    operatingSurplusAfterReservePerVisitorSar: totals.attendanceCount > 0 ? operatingSurplusAfterCapitalReserveSar / totals.attendanceCount : null,
  };
}

function overlapBlockers(records) {
  const sorted = records.slice().sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart));
  const blockers = [];
  for (let i = 1; i < sorted.length; i += 1) {
    if (Date.parse(sorted[i].periodStart) <= Date.parse(sorted[i - 1].periodEnd)) {
      blockers.push(`LEISURE_PERIOD_OVERLAP:${sorted[i - 1].recordId}:${sorted[i].recordId}`);
    }
  }
  return blockers;
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    specializedAssetEvidenceHashSha256: context.specializedAssetEvidenceHashSha256 || null,
    periodMetrics: null,
    aggregateMetrics: null,
    historicalOperatingAnalyticsOnly: true,
    forecastProduced: false,
    noiProduced: false,
    valuationInputAdopted: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    auditedFinancialStatementOpinionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildLeisureOperatingMetricsPacket({
  metricsPacketId,
  caseId,
  propertyRef,
  specializedAssetPacket,
  operatingPeriodRecords,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['metricsPacketId', metricsPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('LEISURE_METRICS_REVIEW_BEFORE_PREPARATION');
  if (!Array.isArray(operatingPeriodRecords)) throw new TypeError('operatingPeriodRecords must be an array');

  if (!specializedAssetPacket || specializedAssetPacket.caseId !== caseId || specializedAssetPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedAssetPacket');
  }
  const context = {
    caseId,
    propertyRef,
    specializedAssetEvidenceHashSha256: specializedAssetPacket.specializedAssetEvidenceHashSha256 || null,
  };
  if (specializedAssetPacket.status !== SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW
      || specializedAssetPacket.readyForSpecializedAssetProfessionalWorkflow !== true
      || !verifySpecializedAssetEvidencePacketIntegrity(specializedAssetPacket)) {
    return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, ['SPECIALIZED_ASSET_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }
  if (specializedAssetPacket.assetClass !== SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION) {
    return hold(LEISURE_OPERATING_METRICS_STATUS.NOT_APPLICABLE_ASSET_CLASS, ['LEISURE_METRICS_NOT_APPLICABLE_TO_ASSET_CLASS'], context);
  }
  if (!ACTIVE_LEISURE_STATES.includes(specializedAssetPacket.operatingState)) {
    if (operatingPeriodRecords.length > 0) {
      return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, ['HISTORICAL_LEISURE_RECORDS_REQUIRE_EXPLICIT_ACTIVE_OR_HISTORICAL_OPERATING_CONTEXT'], context);
    }
    return hold(LEISURE_OPERATING_METRICS_STATUS.NOT_APPLICABLE_OPERATING_STATE, ['NO_ACTIVE_LEISURE_OPERATING_STATE'], context);
  }
  if (!evidenceTopicQualified(specializedAssetPacket, SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS)
      || !evidenceTopicQualified(specializedAssetPacket, SPECIALIZED_EVIDENCE_TOPIC.LEISURE_ATTENDANCE_AND_SPEND)) {
    return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, ['QUALIFIED_OPERATING_STATEMENTS_AND_ATTENDANCE_SPEND_EVIDENCE_REQUIRED'], context);
  }
  if (operatingPeriodRecords.length === 0) return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, ['LEISURE_OPERATING_PERIOD_RECORDS_REQUIRED'], context);

  const blockers = [];
  const integrityFailures = [];
  const ids = new Set();
  const valuationDateMs = Date.parse(specializedAssetPacket.valuationDate);
  for (const record of operatingPeriodRecords) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:leisureOperatingRecord');
    if (!verifyLeisureOperatingPeriodRecordIntegrity(record)) {
      integrityFailures.push(record?.recordId || 'UNKNOWN');
      continue;
    }
    if (ids.has(record.recordId)) blockers.push(`DUPLICATE_LEISURE_OPERATING_RECORD_ID:${record.recordId}`);
    ids.add(record.recordId);
    if (!QUALIFIED_RECORD_STATUSES.includes(record.status)) blockers.push(`LEISURE_OPERATING_RECORD_NOT_QUALIFIED:${record.recordId}:${record.status}`);
    if (Date.parse(record.periodEnd) > valuationDateMs) blockers.push(`LEISURE_OPERATING_PERIOD_AFTER_VALUATION_DATE:${record.recordId}`);
    if (Date.parse(record.reviewedAt) > Date.parse(reviewed)) blockers.push(`LEISURE_RECORD_REVIEW_AFTER_METRICS_REVIEW:${record.recordId}`);
  }
  if (integrityFailures.length) return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, integrityFailures.map((id) => `LEISURE_OPERATING_RECORD_INTEGRITY_FAILED:${id}`), context);
  blockers.push(...overlapBlockers(operatingPeriodRecords));
  if (blockers.length) return hold(LEISURE_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, blockers, context);

  const sorted = operatingPeriodRecords.slice().sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart));
  const periodMetrics = sorted.map((record) => deepFreeze({
    recordId: record.recordId,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    status: record.status,
    sourceRef: record.sourceRef,
    sourceDocumentHashSha256: record.sourceDocumentHashSha256,
    recordHashSha256: record.leisureOperatingRecordHashSha256,
    metrics: calculateMetrics(sumRecords([record])),
  }));
  const aggregateMetrics = calculateMetrics(sumRecords(sorted));

  const core = {
    schemaVersion: 1,
    metricsPacketId: metricsPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: specializedAssetPacket.valuationDate,
    assetClass: specializedAssetPacket.assetClass,
    operatingState: specializedAssetPacket.operatingState,
    operatingModel: specializedAssetPacket.operatingModel,
    specializedAssetEvidenceHashSha256: specializedAssetPacket.specializedAssetEvidenceHashSha256,
    coveragePeriodStart: sorted[0].periodStart,
    coveragePeriodEnd: sorted[sorted.length - 1].periodEnd,
    operatingRecordCount: sorted.length,
    operatingRecordHashes: sorted.map((record) => record.leisureOperatingRecordHashSha256),
    periodMetrics,
    aggregateMetrics,
    metricConvention: 'STARTAK_LEISURE_OPERATING_ANALYTICS_V1',
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    leisureOperatingMetricsHashSha256: sha256(core),
    status: LEISURE_OPERATING_METRICS_STATUS.READY,
    blockers: [],
    historicalOperatingAnalyticsOnly: true,
    officialIndustryAccountingStandardClaimed: false,
    forecastProduced: false,
    noiProduced: false,
    valuationInputAdopted: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    auditedFinancialStatementOpinionEstablished: false,
    legalOrLicensingConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'Leisure operating metrics are deterministic historical analytics from reviewed attendance and operating evidence. Per-visitor and operating-surplus measures are not forecasts, NOI, valuation inputs, audited-financial-statement opinions, industry-standard compliance claims, certified valuations or transaction authorizations.',
  });
}

function verifyLeisureOperatingMetricsPacketIntegrity(packet) {
  if (!packet || !validSha(packet.leisureOperatingMetricsHashSha256)) return false;
  const core = { ...packet };
  [
    'leisureOperatingMetricsHashSha256', 'status', 'blockers', 'historicalOperatingAnalyticsOnly',
    'officialIndustryAccountingStandardClaimed', 'forecastProduced', 'noiProduced', 'valuationInputAdopted',
    'valuationArithmeticPerformed', 'methodSelected', 'auditedFinancialStatementOpinionEstablished',
    'legalOrLicensingConclusionEstablished', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.leisureOperatingMetricsHashSha256.toLowerCase();
}

module.exports = {
  LEISURE_OPERATING_RECORD_STATUS,
  LEISURE_OPERATING_METRICS_STATUS,
  createLeisureOperatingPeriodRecord,
  verifyLeisureOperatingPeriodRecordIntegrity,
  calculateMetrics,
  buildLeisureOperatingMetricsPacket,
  verifyLeisureOperatingMetricsPacketIntegrity,
};
