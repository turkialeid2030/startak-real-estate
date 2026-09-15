'use strict';

const crypto = require('crypto');

const MARKET_EVIDENCE_LEVEL = Object.freeze({
  OFFICIAL_REGISTERED_TRANSACTION: 'OFFICIAL_REGISTERED_TRANSACTION',
  VERIFIED_TRANSACTION: 'VERIFIED_TRANSACTION',
  CONFIRMED_TRANSACTION: 'CONFIRMED_TRANSACTION',
  VERIFIED_OFFER: 'VERIFIED_OFFER',
  BROKER_CONFIRMED: 'BROKER_CONFIRMED',
  PUBLIC_AD: 'PUBLIC_AD',
  UNVERIFIED: 'UNVERIFIED',
});

const MARKET_EVIDENCE_RANK = Object.freeze({
  [MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION]: 7,
  [MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION]: 6,
  [MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION]: 5,
  [MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER]: 4,
  [MARKET_EVIDENCE_LEVEL.BROKER_CONFIRMED]: 3,
  [MARKET_EVIDENCE_LEVEL.PUBLIC_AD]: 2,
  [MARKET_EVIDENCE_LEVEL.UNVERIFIED]: 1,
});

const MARKET_TRANSACTION_TYPE = Object.freeze({
  SALE: 'SALE',
  RENT: 'RENT',
});

const MARKET_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  CONFIRMED: 'CONFIRMED',
  NOT_VERIFIED: 'NOT_VERIFIED',
});

const COMPARABLE_QUALITY_STATUS = Object.freeze({
  QUALIFIED_FOR_PROFESSIONAL_SELECTION: 'QUALIFIED_FOR_PROFESSIONAL_SELECTION',
  HOLD_QUALITY: 'HOLD_QUALITY',
  HOLD_INSUFFICIENT_EVIDENCE: 'HOLD_INSUFFICIENT_EVIDENCE',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function finitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
}

function validateVerificationForLevel(level, verification) {
  if (!verification || typeof verification !== 'object') throw new TypeError('verification is required');
  assertEnum(verification.status, MARKET_VERIFICATION_STATUS, 'verification.status');
  if (verification.status !== MARKET_VERIFICATION_STATUS.NOT_VERIFIED) {
    assertNonEmpty(verification.verifiedByRef, 'verification.verifiedByRef');
    iso(verification.verifiedAt, 'verification.verifiedAt');
    assertNonEmpty(verification.evidenceRef, 'verification.evidenceRef');
  }
  if (level === MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION
      || level === MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION
      || level === MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER) {
    if (verification.status !== MARKET_VERIFICATION_STATUS.VERIFIED) {
      throw new TypeError(`EVIDENCE_LEVEL_REQUIRES_VERIFIED_STATUS:${level}`);
    }
  }
  if (level === MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION
      || level === MARKET_EVIDENCE_LEVEL.BROKER_CONFIRMED) {
    if (![MARKET_VERIFICATION_STATUS.VERIFIED, MARKET_VERIFICATION_STATUS.CONFIRMED].includes(verification.status)) {
      throw new TypeError(`EVIDENCE_LEVEL_REQUIRES_CONFIRMED_STATUS:${level}`);
    }
  }
}

function createComparableEvidenceRecord({
  comparableId,
  caseId,
  sourcePropertyRef,
  assetType,
  transactionType,
  evidenceLevel,
  sourceName,
  sourceRef,
  sourceUrl = null,
  sourceDate,
  transactionDate,
  location,
  areaSqm,
  amountSar,
  verification,
  abnormalTransaction = false,
  abnormalRationale = null,
  capturedAt,
}) {
  [
    ['comparableId', comparableId], ['caseId', caseId], ['sourcePropertyRef', sourcePropertyRef],
    ['assetType', assetType], ['sourceName', sourceName], ['sourceRef', sourceRef],
  ].forEach(([field, value]) => assertNonEmpty(value, field));
  assertEnum(transactionType, MARKET_TRANSACTION_TYPE, 'transactionType');
  assertEnum(evidenceLevel, MARKET_EVIDENCE_LEVEL, 'evidenceLevel');
  finitePositive(areaSqm, 'areaSqm');
  finitePositive(amountSar, 'amountSar');
  if (sourceUrl !== null && !nonEmpty(sourceUrl)) throw new TypeError('sourceUrl must be null or non-empty string');
  if (typeof abnormalTransaction !== 'boolean') throw new TypeError('abnormalTransaction must be boolean');
  if (abnormalTransaction && !nonEmpty(abnormalRationale)) throw new TypeError('abnormalRationale is required when abnormalTransaction=true');
  validateVerificationForLevel(evidenceLevel, verification);

  const sourceDateIso = iso(sourceDate, 'sourceDate');
  const transactionDateIso = iso(transactionDate, 'transactionDate');
  const capturedAtIso = iso(capturedAt, 'capturedAt');
  if (Date.parse(sourceDateIso) > Date.parse(capturedAtIso)) throw new TypeError('MARKET_SOURCE_DATE_AFTER_CAPTURE');
  if (Date.parse(transactionDateIso) > Date.parse(capturedAtIso)) throw new TypeError('MARKET_TRANSACTION_DATE_AFTER_CAPTURE');
  if (!location || typeof location !== 'object') throw new TypeError('location is required');
  assertNonEmpty(location.city, 'location.city');
  assertNonEmpty(location.district, 'location.district');
  if (location.lat !== undefined && (typeof location.lat !== 'number' || !Number.isFinite(location.lat) || location.lat < -90 || location.lat > 90)) throw new TypeError('location.lat is invalid');
  if (location.long !== undefined && (typeof location.long !== 'number' || !Number.isFinite(location.long) || location.long < -180 || location.long > 180)) throw new TypeError('location.long is invalid');

  const unitValueSarPerSqm = amountSar / areaSqm;
  const record = {
    schemaVersion: 1,
    comparableId: comparableId.trim(),
    caseId: caseId.trim(),
    sourcePropertyRef: sourcePropertyRef.trim(),
    assetType: assetType.trim(),
    transactionType,
    evidenceLevel,
    evidenceRank: MARKET_EVIDENCE_RANK[evidenceLevel],
    sourceName: sourceName.trim(),
    sourceRef: sourceRef.trim(),
    sourceUrl: sourceUrl ? sourceUrl.trim() : null,
    sourceDate: sourceDateIso,
    transactionDate: transactionDateIso,
    location: {
      city: location.city.trim(),
      district: location.district.trim(),
      lat: location.lat ?? null,
      long: location.long ?? null,
    },
    areaSqm,
    amountSar,
    unitValueSarPerSqm,
    verification: {
      status: verification.status,
      verifiedByRef: verification.verifiedByRef ? verification.verifiedByRef.trim() : null,
      verifiedAt: verification.verifiedAt ? iso(verification.verifiedAt, 'verification.verifiedAt') : null,
      evidenceRef: verification.evidenceRef ? verification.evidenceRef.trim() : null,
    },
    abnormalTransaction,
    abnormalRationale: abnormalTransaction ? abnormalRationale.trim() : null,
    capturedAt: capturedAtIso,
    professionalSelectionMade: false,
    valuationWeightAssigned: false,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
  };
  record.comparableHashSha256 = hash(record);
  return freeze(record);
}

function daysBetween(earlier, later) {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000);
}

function createComparableFingerprint(record) {
  return hash({
    sourcePropertyRef: record.sourcePropertyRef,
    transactionType: record.transactionType,
    transactionDate: record.transactionDate,
    areaSqm: record.areaSqm,
    amountSar: record.amountSar,
  });
}

function evaluateComparableSetQuality({
  caseId,
  records,
  asOfDate,
  maxAgeDays,
  minimumComparableCount,
  minimumEvidenceLevel,
  unitValueRangeSarPerSqm = null,
  contradictionTolerance = {},
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) throw new TypeError('maxAgeDays must be a non-negative integer');
  if (!Number.isInteger(minimumComparableCount) || minimumComparableCount < 1) throw new TypeError('minimumComparableCount must be a positive integer');
  assertEnum(minimumEvidenceLevel, MARKET_EVIDENCE_LEVEL, 'minimumEvidenceLevel');
  const asOf = iso(asOfDate, 'asOfDate');
  if (unitValueRangeSarPerSqm !== null) {
    if (!unitValueRangeSarPerSqm || typeof unitValueRangeSarPerSqm !== 'object') throw new TypeError('unitValueRangeSarPerSqm is invalid');
    finitePositive(unitValueRangeSarPerSqm.min, 'unitValueRangeSarPerSqm.min');
    finitePositive(unitValueRangeSarPerSqm.max, 'unitValueRangeSarPerSqm.max');
    if (unitValueRangeSarPerSqm.max < unitValueRangeSarPerSqm.min) throw new TypeError('unitValueRangeSarPerSqm range is inverted');
  }

  const blockers = [];
  const warnings = [];
  const fingerprints = new Map();
  const byPropertyAndDate = new Map();
  const recordQuality = [];
  const minimumRank = MARKET_EVIDENCE_RANK[minimumEvidenceLevel];

  for (const record of records) {
    if (!record || record.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION: comparable belongs to another case');
    const fingerprint = createComparableFingerprint(record);
    const ageDays = daysBetween(record.transactionDate, asOf);
    const stale = ageDays < 0 || ageDays > maxAgeDays;
    const belowEvidenceFloor = record.evidenceRank < minimumRank;
    const outlier = unitValueRangeSarPerSqm !== null
      && (record.unitValueSarPerSqm < unitValueRangeSarPerSqm.min || record.unitValueSarPerSqm > unitValueRangeSarPerSqm.max);
    const duplicateOf = fingerprints.get(fingerprint) || null;
    if (!duplicateOf) fingerprints.set(fingerprint, record.comparableId);
    const groupKey = `${record.sourcePropertyRef}|${record.transactionType}|${record.transactionDate}`;
    const group = byPropertyAndDate.get(groupKey) || [];
    group.push(record);
    byPropertyAndDate.set(groupKey, group);

    if (stale) blockers.push(`STALE_COMPARABLE:${record.comparableId}`);
    if (belowEvidenceFloor) blockers.push(`EVIDENCE_LEVEL_BELOW_MINIMUM:${record.comparableId}`);
    if (duplicateOf) blockers.push(`DUPLICATE_COMPARABLE:${record.comparableId}:${duplicateOf}`);
    if (record.abnormalTransaction) blockers.push(`ABNORMAL_TRANSACTION_REQUIRES_PROFESSIONAL_DISPOSITION:${record.comparableId}`);
    if (outlier) warnings.push(`UNIT_VALUE_OUTLIER_REVIEW_REQUIRED:${record.comparableId}`);
    if (record.verification.status === MARKET_VERIFICATION_STATUS.NOT_VERIFIED) warnings.push(`UNVERIFIED_MARKET_EVIDENCE:${record.comparableId}`);

    recordQuality.push({
      comparableId: record.comparableId,
      ageDays,
      stale,
      belowEvidenceFloor,
      duplicateOf,
      abnormalTransaction: record.abnormalTransaction,
      outlier,
      evidenceLevel: record.evidenceLevel,
      evidenceRank: record.evidenceRank,
    });
  }

  const absoluteTolerance = Number.isFinite(contradictionTolerance.absoluteSarPerSqm)
    ? Math.max(0, contradictionTolerance.absoluteSarPerSqm)
    : 0;
  const relativeTolerance = Number.isFinite(contradictionTolerance.relative)
    ? Math.max(0, contradictionTolerance.relative)
    : 0;
  for (const group of byPropertyAndDate.values()) {
    if (group.length < 2) continue;
    const reference = group[0].unitValueSarPerSqm;
    const contradictory = group.slice(1).some((item) => {
      const delta = Math.abs(reference - item.unitValueSarPerSqm);
      if (delta <= absoluteTolerance) return false;
      const scale = Math.max(Math.abs(reference), Math.abs(item.unitValueSarPerSqm), 1);
      return delta > scale * relativeTolerance;
    });
    if (contradictory) blockers.push(`CONTRADICTORY_MARKET_EVIDENCE:${group.map((item) => item.comparableId).join(',')}`);
  }

  const uniqueQualifiedIds = recordQuality
    .filter((item) => !item.stale && !item.belowEvidenceFloor && !item.duplicateOf && !item.abnormalTransaction)
    .map((item) => item.comparableId);
  if (uniqueQualifiedIds.length < minimumComparableCount) {
    blockers.push(`INSUFFICIENT_QUALIFIED_COMPARABLES:${uniqueQualifiedIds.length}/${minimumComparableCount}`);
  }

  let status = COMPARABLE_QUALITY_STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION;
  if (uniqueQualifiedIds.length < minimumComparableCount) status = COMPARABLE_QUALITY_STATUS.HOLD_INSUFFICIENT_EVIDENCE;
  else if (blockers.length) status = COMPARABLE_QUALITY_STATUS.HOLD_QUALITY;

  return freeze({
    schemaVersion: 1,
    caseId,
    asOfDate: asOf,
    status,
    recordQuality,
    qualifiedComparableIds: uniqueQualifiedIds,
    blockers,
    warnings,
    professionalSelectionRequired: true,
    automaticComparableSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    transactionAuthorized: false,
    certifiedValuationEstablished: false,
    semantics: 'Quality qualification removes neither professional judgment nor comparable-selection responsibility. Evidence hierarchy, freshness, duplication, abnormality, contradiction and configured outlier review are explicit; no comparable is automatically selected or weighted for valuation.',
  });
}

module.exports = {
  MARKET_EVIDENCE_LEVEL,
  MARKET_EVIDENCE_RANK,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  COMPARABLE_QUALITY_STATUS,
  createComparableEvidenceRecord,
  createComparableFingerprint,
  evaluateComparableSetQuality,
};
