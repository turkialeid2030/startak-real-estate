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

const HOSPITALITY_OPERATING_RECORD_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
});

const HOSPITALITY_OPERATING_METRICS_STATUS = Object.freeze({
  READY: 'READY',
  NOT_APPLICABLE_ASSET_CLASS: 'NOT_APPLICABLE_ASSET_CLASS',
  NOT_APPLICABLE_OPERATING_STATE: 'NOT_APPLICABLE_OPERATING_STATE',
  HOLD_SPECIALIZED_PACKET: 'HOLD_SPECIALIZED_PACKET',
  HOLD_PERIOD_EVIDENCE: 'HOLD_PERIOD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const HOSPITALITY_ASSET_CLASSES = Object.freeze([
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_ASSET_CLASS.SERVICED_APARTMENTS,
  SPECIALIZED_ASSET_CLASS.RESORT,
]);

const ACTIVE_HOSPITALITY_STATES = Object.freeze([
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_STATE.RAMP_UP,
  SPECIALIZED_OPERATING_STATE.CLOSED_TEMPORARILY,
]);

const QUALIFIED_RECORD_STATUSES = Object.freeze([
  HOSPITALITY_OPERATING_RECORD_STATUS.VERIFIED,
  HOSPITALITY_OPERATING_RECORD_STATUS.PROFESSIONAL_REVIEWED,
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
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) throw new TypeError(`${field} must contain non-empty references`);
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function createHospitalityOperatingPeriodRecord({
  recordId,
  caseId,
  propertyRef,
  periodStart,
  periodEnd,
  availableRoomNights,
  occupiedRoomNights,
  roomsRevenueSar,
  foodBeverageRevenueSar,
  otherOperatingRevenueSar,
  departmentalExpensesSar,
  undistributedOperatingExpensesSar,
  managementAndFranchiseFeesSar,
  ffeReserveSar,
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
  if (!Object.values(HOSPITALITY_OPERATING_RECORD_STATUS).includes(status)) throw new TypeError('status is invalid');
  if (!validSha(sourceDocumentHashSha256)) throw new TypeError('sourceDocumentHashSha256 must be a SHA-256 hex string');

  const start = iso(periodStart, 'periodStart');
  const end = iso(periodEnd, 'periodEnd');
  if (Date.parse(end) < Date.parse(start)) throw new TypeError('HOSPITALITY_PERIOD_END_BEFORE_START');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(prepared) < Date.parse(end)) throw new TypeError('HOSPITALITY_RECORD_PREPARED_BEFORE_PERIOD_END');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('HOSPITALITY_RECORD_REVIEW_BEFORE_PREPARATION');

  for (const [field, value] of [
    ['availableRoomNights', availableRoomNights], ['occupiedRoomNights', occupiedRoomNights],
    ['roomsRevenueSar', roomsRevenueSar], ['foodBeverageRevenueSar', foodBeverageRevenueSar],
    ['otherOperatingRevenueSar', otherOperatingRevenueSar], ['departmentalExpensesSar', departmentalExpensesSar],
    ['undistributedOperatingExpensesSar', undistributedOperatingExpensesSar],
    ['managementAndFranchiseFeesSar', managementAndFranchiseFeesSar], ['ffeReserveSar', ffeReserveSar],
  ]) finiteNonNegative(value, field);
  if (!(availableRoomNights > 0)) throw new TypeError('availableRoomNights must be > 0');
  if (occupiedRoomNights > availableRoomNights) throw new TypeError('OCCUPIED_ROOM_NIGHTS_EXCEED_AVAILABLE');
  if (occupiedRoomNights === 0 && roomsRevenueSar > 0) throw new TypeError('ROOMS_REVENUE_WITH_ZERO_OCCUPIED_ROOM_NIGHTS');

  const core = {
    schemaVersion: 1,
    recordId: recordId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    periodStart: start,
    periodEnd: end,
    availableRoomNights,
    occupiedRoomNights,
    roomsRevenueSar,
    foodBeverageRevenueSar,
    otherOperatingRevenueSar,
    departmentalExpensesSar,
    undistributedOperatingExpensesSar,
    managementAndFranchiseFeesSar,
    ffeReserveSar,
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
    hospitalityOperatingRecordHashSha256: sha256(core),
    historicalEvidenceOnly: true,
    auditedFinancialStatementOpinionEstablished: false,
    valuationInputAdopted: false,
  });
}

function verifyHospitalityOperatingPeriodRecordIntegrity(record) {
  if (!record || !validSha(record.hospitalityOperatingRecordHashSha256)) return false;
  const core = { ...record };
  ['hospitalityOperatingRecordHashSha256', 'historicalEvidenceOnly', 'auditedFinancialStatementOpinionEstablished', 'valuationInputAdopted'].forEach((key) => delete core[key]);
  return sha256(core) === record.hospitalityOperatingRecordHashSha256.toLowerCase();
}

function evidenceTopicQualified(specializedPacket, topic) {
  const item = (Array.isArray(specializedPacket?.evidenceItems) ? specializedPacket.evidenceItems : []).find((entry) => entry?.topic === topic);
  return Boolean(item && [SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED, SPECIALIZED_EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED].includes(item.status));
}

function calculateMetrics(totals) {
  const totalOperatingRevenueSar = totals.roomsRevenueSar + totals.foodBeverageRevenueSar + totals.otherOperatingRevenueSar;
  const grossOperatingProfitBeforeOperatorFeesSar = totalOperatingRevenueSar
    - totals.departmentalExpensesSar
    - totals.undistributedOperatingExpensesSar;
  const operatingSurplusBeforeFfeAndFixedChargesSar = grossOperatingProfitBeforeOperatorFeesSar - totals.managementAndFranchiseFeesSar;
  const operatingSurplusAfterFfeReserveSar = operatingSurplusBeforeFfeAndFixedChargesSar - totals.ffeReserveSar;
  return {
    ...totals,
    totalOperatingRevenueSar,
    occupancyRate: totals.availableRoomNights > 0 ? totals.occupiedRoomNights / totals.availableRoomNights : null,
    averageDailyRateSar: totals.occupiedRoomNights > 0 ? totals.roomsRevenueSar / totals.occupiedRoomNights : null,
    revParSar: totals.availableRoomNights > 0 ? totals.roomsRevenueSar / totals.availableRoomNights : null,
    totalRevenuePerAvailableRoomNightSar: totals.availableRoomNights > 0 ? totalOperatingRevenueSar / totals.availableRoomNights : null,
    grossOperatingProfitBeforeOperatorFeesSar,
    grossOperatingProfitMarginBeforeOperatorFees: totalOperatingRevenueSar !== 0 ? grossOperatingProfitBeforeOperatorFeesSar / totalOperatingRevenueSar : null,
    grossOperatingProfitPerAvailableRoomNightSar: totals.availableRoomNights > 0 ? grossOperatingProfitBeforeOperatorFeesSar / totals.availableRoomNights : null,
    operatingSurplusBeforeFfeAndFixedChargesSar,
    operatingSurplusAfterFfeReserveSar,
    operatingSurplusAfterFfePerAvailableRoomNightSar: totals.availableRoomNights > 0 ? operatingSurplusAfterFfeReserveSar / totals.availableRoomNights : null,
  };
}

function sumRecords(records) {
  return records.reduce((totals, record) => {
    totals.availableRoomNights += record.availableRoomNights;
    totals.occupiedRoomNights += record.occupiedRoomNights;
    totals.roomsRevenueSar += record.roomsRevenueSar;
    totals.foodBeverageRevenueSar += record.foodBeverageRevenueSar;
    totals.otherOperatingRevenueSar += record.otherOperatingRevenueSar;
    totals.departmentalExpensesSar += record.departmentalExpensesSar;
    totals.undistributedOperatingExpensesSar += record.undistributedOperatingExpensesSar;
    totals.managementAndFranchiseFeesSar += record.managementAndFranchiseFeesSar;
    totals.ffeReserveSar += record.ffeReserveSar;
    return totals;
  }, {
    availableRoomNights: 0,
    occupiedRoomNights: 0,
    roomsRevenueSar: 0,
    foodBeverageRevenueSar: 0,
    otherOperatingRevenueSar: 0,
    departmentalExpensesSar: 0,
    undistributedOperatingExpensesSar: 0,
    managementAndFranchiseFeesSar: 0,
    ffeReserveSar: 0,
  });
}

function overlapBlockers(records) {
  const sorted = records.slice().sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart));
  const blockers = [];
  for (let i = 1; i < sorted.length; i += 1) {
    if (Date.parse(sorted[i].periodStart) <= Date.parse(sorted[i - 1].periodEnd)) {
      blockers.push(`HOSPITALITY_PERIOD_OVERLAP:${sorted[i - 1].recordId}:${sorted[i].recordId}`);
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

function buildHospitalityOperatingMetricsPacket({
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
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('HOSPITALITY_METRICS_REVIEW_BEFORE_PREPARATION');
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
    return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, ['SPECIALIZED_ASSET_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  if (!HOSPITALITY_ASSET_CLASSES.includes(specializedAssetPacket.assetClass)) {
    return hold(HOSPITALITY_OPERATING_METRICS_STATUS.NOT_APPLICABLE_ASSET_CLASS, ['HOSPITALITY_METRICS_NOT_APPLICABLE_TO_ASSET_CLASS'], context);
  }
  if (!ACTIVE_HOSPITALITY_STATES.includes(specializedAssetPacket.operatingState)) {
    if (operatingPeriodRecords.length > 0) {
      return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, ['HISTORICAL_OPERATING_RECORDS_REQUIRE_EXPLICIT_ACTIVE_OR_HISTORICAL_OPERATING_CONTEXT'], context);
    }
    return hold(HOSPITALITY_OPERATING_METRICS_STATUS.NOT_APPLICABLE_OPERATING_STATE, ['NO_ACTIVE_HOSPITALITY_OPERATING_STATE'], context);
  }

  if (!evidenceTopicQualified(specializedAssetPacket, SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS)
      || !evidenceTopicQualified(specializedAssetPacket, SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR)) {
    return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_SPECIALIZED_PACKET, ['QUALIFIED_OPERATING_STATEMENTS_AND_OCCUPANCY_ADR_REVPAR_EVIDENCE_REQUIRED'], context);
  }
  if (operatingPeriodRecords.length === 0) return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, ['HOSPITALITY_OPERATING_PERIOD_RECORDS_REQUIRED'], context);

  const blockers = [];
  const integrityFailures = [];
  const ids = new Set();
  const valuationDateMs = Date.parse(specializedAssetPacket.valuationDate);
  for (const record of operatingPeriodRecords) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:hospitalityOperatingRecord');
    if (!verifyHospitalityOperatingPeriodRecordIntegrity(record)) {
      integrityFailures.push(record?.recordId || 'UNKNOWN');
      continue;
    }
    if (ids.has(record.recordId)) blockers.push(`DUPLICATE_HOSPITALITY_OPERATING_RECORD_ID:${record.recordId}`);
    ids.add(record.recordId);
    if (!QUALIFIED_RECORD_STATUSES.includes(record.status)) blockers.push(`HOSPITALITY_OPERATING_RECORD_NOT_QUALIFIED:${record.recordId}:${record.status}`);
    if (Date.parse(record.periodEnd) > valuationDateMs) blockers.push(`HOSPITALITY_OPERATING_PERIOD_AFTER_VALUATION_DATE:${record.recordId}`);
    if (Date.parse(record.reviewedAt) > Date.parse(reviewed)) blockers.push(`HOSPITALITY_RECORD_REVIEW_AFTER_METRICS_REVIEW:${record.recordId}`);
  }
  if (integrityFailures.length) {
    return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, integrityFailures.map((id) => `HOSPITALITY_OPERATING_RECORD_INTEGRITY_FAILED:${id}`), context);
  }
  blockers.push(...overlapBlockers(operatingPeriodRecords));
  if (blockers.length) return hold(HOSPITALITY_OPERATING_METRICS_STATUS.HOLD_PERIOD_EVIDENCE, blockers, context);

  const sorted = operatingPeriodRecords.slice().sort((a, b) => Date.parse(a.periodStart) - Date.parse(b.periodStart));
  const periodMetrics = sorted.map((record) => deepFreeze({
    recordId: record.recordId,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    status: record.status,
    sourceRef: record.sourceRef,
    sourceDocumentHashSha256: record.sourceDocumentHashSha256,
    recordHashSha256: record.hospitalityOperatingRecordHashSha256,
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
    operatingRecordHashes: sorted.map((record) => record.hospitalityOperatingRecordHashSha256),
    periodMetrics,
    aggregateMetrics,
    metricConvention: 'STARTAK_HOSPITALITY_OPERATING_ANALYTICS_V1',
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    hospitalityOperatingMetricsHashSha256: sha256(core),
    status: HOSPITALITY_OPERATING_METRICS_STATUS.READY,
    blockers: [],
    historicalOperatingAnalyticsOnly: true,
    officialUsaliComplianceClaimed: false,
    forecastProduced: false,
    noiProduced: false,
    valuationInputAdopted: false,
    valuationArithmeticPerformed: false,
    methodSelected: false,
    auditedFinancialStatementOpinionEstablished: false,
    legalOrLicensingConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'Hospitality operating metrics are deterministic historical analytics from professionally reviewed evidence. Occupancy, ADR, RevPAR and related revenue/operating-surplus metrics are not a forecast, NOI, valuation input, audited-financial-statement opinion, USALI compliance claim, certified valuation or transaction authorization. Expense placement is explicit under STARTAK_HOSPITALITY_OPERATING_ANALYTICS_V1 and must not be represented as an external accounting standard without separate standards review.',
  });
}

function verifyHospitalityOperatingMetricsPacketIntegrity(packet) {
  if (!packet || !validSha(packet.hospitalityOperatingMetricsHashSha256)) return false;
  const core = { ...packet };
  [
    'hospitalityOperatingMetricsHashSha256', 'status', 'blockers', 'historicalOperatingAnalyticsOnly',
    'officialUsaliComplianceClaimed', 'forecastProduced', 'noiProduced', 'valuationInputAdopted',
    'valuationArithmeticPerformed', 'methodSelected', 'auditedFinancialStatementOpinionEstablished',
    'legalOrLicensingConclusionEstablished', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.hospitalityOperatingMetricsHashSha256.toLowerCase();
}

module.exports = {
  HOSPITALITY_OPERATING_RECORD_STATUS,
  HOSPITALITY_OPERATING_METRICS_STATUS,
  HOSPITALITY_ASSET_CLASSES,
  createHospitalityOperatingPeriodRecord,
  verifyHospitalityOperatingPeriodRecordIntegrity,
  calculateMetrics,
  buildHospitalityOperatingMetricsPacket,
  verifyHospitalityOperatingMetricsPacketIntegrity,
};
