'use strict';

const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
  createEvidenceRecord,
} = require('../valuation-intelligence/contracts');

const MARKET_USAGE = Object.freeze({
  MARKET_RENT: 'MARKET_RENT',
  SALE_COMPARABLE: 'SALE_COMPARABLE',
  CAP_RATE: 'CAP_RATE',
  VACANCY: 'VACANCY',
  OPEX: 'OPEX',
  CONSTRUCTION_COST: 'CONSTRUCTION_COST',
  LAND_PRICE: 'LAND_PRICE',
  EXIT_ASSUMPTION: 'EXIT_ASSUMPTION',
});

const MARKET_EVIDENCE_STATUS = Object.freeze({
  QUALIFIED_FOR_ANALYTICAL_USE: 'QUALIFIED_FOR_ANALYTICAL_USE',
  HOLD_SCOPE: 'HOLD_SCOPE',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_METADATA: 'HOLD_METADATA',
  HOLD_GEOGRAPHY: 'HOLD_GEOGRAPHY',
  HOLD_ASSET_TYPE: 'HOLD_ASSET_TYPE',
  HOLD_REVIEW: 'HOLD_REVIEW',
  HOLD_STALE: 'HOLD_STALE',
  HOLD_EVIDENCE_QUALITY: 'HOLD_EVIDENCE_QUALITY',
  HOLD_CONFLICT: 'HOLD_CONFLICT',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function normalize(value) {
  return nonEmptyString(value) ? value.trim().toUpperCase() : '';
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return null;
  if (!policy.maxAgeDaysByUsage || typeof policy.maxAgeDaysByUsage !== 'object') return null;
  if (!policy.allowedGradesByUsage || typeof policy.allowedGradesByUsage !== 'object') return null;
  if (!policy.allowedStatusesByUsage || typeof policy.allowedStatusesByUsage !== 'object') return null;
  return policy;
}

function hold(status, reasons, context = {}) {
  return {
    caseId: context.caseId || null,
    projectId: context.projectId || null,
    status,
    reasons,
    qualifiedEvidence: [],
    evidenceRecords: [],
    analyticalUseAllowed: false,
    externalMarketTruthEstablished: false,
    certifiedValuationEstablished: false,
    humanReviewRequired: true,
  };
}

function qualifyMarketEvidence({
  caseId,
  projectId,
  asOfDate,
  targetGeography,
  targetAssetType,
  items,
  policy,
}) {
  const context = { caseId, projectId };
  if (!nonEmptyString(caseId) || !nonEmptyString(projectId) || !isIsoDate(asOfDate)) {
    return hold(MARKET_EVIDENCE_STATUS.HOLD_SCOPE, ['caseId, projectId, and valid asOfDate are required'], context);
  }
  if (!targetGeography || !nonEmptyString(targetGeography.country) || !nonEmptyString(targetGeography.city) || !nonEmptyString(targetAssetType)) {
    return hold(MARKET_EVIDENCE_STATUS.HOLD_SCOPE, ['target country, city, and asset type are required'], context);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return hold(MARKET_EVIDENCE_STATUS.HOLD_METADATA, ['at least one market evidence item is required'], context);
  }

  const governance = normalizePolicy(policy);
  if (!governance) {
    return hold(MARKET_EVIDENCE_STATUS.HOLD_POLICY, ['caller-supplied freshness and evidence-quality policy is required'], context);
  }

  const qualified = [];
  const evidenceRecords = [];
  const failures = [];

  for (const [index, item] of items.entries()) {
    const usage = item?.usage;
    const metadataValid =
      nonEmptyString(item?.field) &&
      Object.values(MARKET_USAGE).includes(usage) &&
      Object.values(EVIDENCE_GRADE).includes(item?.grade) &&
      Object.values(INPUT_STATUS).includes(item?.status) &&
      nonEmptyString(item?.sourceType) &&
      nonEmptyString(item?.sourceRef) &&
      isIsoDate(item?.observedAt) &&
      item?.geography &&
      nonEmptyString(item.geography.country) &&
      nonEmptyString(item.geography.city) &&
      nonEmptyString(item?.assetType);
    if (!metadataValid) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_METADATA });
      continue;
    }

    if (item.status === INPUT_STATUS.CONFLICT) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_CONFLICT, field: item.field });
      continue;
    }

    const allowedCountries = Array.isArray(governance.allowedCountries) && governance.allowedCountries.length
      ? governance.allowedCountries.map(normalize)
      : [normalize(targetGeography.country)];
    const allowedCities = Array.isArray(governance.allowedCities) && governance.allowedCities.length
      ? governance.allowedCities.map(normalize)
      : [normalize(targetGeography.city)];
    if (!allowedCountries.includes(normalize(item.geography.country)) || !allowedCities.includes(normalize(item.geography.city))) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_GEOGRAPHY, field: item.field });
      continue;
    }

    const allowedAssetTypes = Array.isArray(governance.allowedAssetTypes) && governance.allowedAssetTypes.length
      ? governance.allowedAssetTypes.map(normalize)
      : [normalize(targetAssetType)];
    if (!allowedAssetTypes.includes(normalize(item.assetType))) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_ASSET_TYPE, field: item.field });
      continue;
    }

    if (!nonEmptyString(item?.reviewerRef) || !isIsoDate(item?.reviewedAt)) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_REVIEW, field: item.field });
      continue;
    }

    const maxAgeDays = governance.maxAgeDaysByUsage[usage];
    if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_POLICY, field: item.field });
      continue;
    }
    const ageDays = Math.floor((Date.parse(asOfDate) - Date.parse(item.observedAt)) / 86400000);
    if (ageDays < 0 || ageDays > maxAgeDays) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_STALE, field: item.field, ageDays, maxAgeDays });
      continue;
    }

    const allowedGrades = governance.allowedGradesByUsage[usage];
    const allowedStatuses = governance.allowedStatusesByUsage[usage];
    if (!Array.isArray(allowedGrades) || !allowedGrades.includes(item.grade) || !Array.isArray(allowedStatuses) || !allowedStatuses.includes(item.status)) {
      failures.push({ index, reason: MARKET_EVIDENCE_STATUS.HOLD_EVIDENCE_QUALITY, field: item.field });
      continue;
    }

    const record = createEvidenceRecord({
      field: item.field,
      grade: item.grade,
      status: item.status,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef,
      observedAt: item.observedAt,
      note: item.note || null,
    });
    evidenceRecords.push(record);
    qualified.push({
      index,
      field: item.field,
      usage,
      sourceRef: item.sourceRef.trim(),
      observedAt: item.observedAt,
      reviewerRef: item.reviewerRef.trim(),
      reviewedAt: item.reviewedAt,
      geography: {
        country: item.geography.country.trim(),
        city: item.geography.city.trim(),
        district: nonEmptyString(item.geography.district) ? item.geography.district.trim() : null,
      },
      assetType: item.assetType.trim(),
      grade: item.grade,
      inputStatus: item.status,
      ageDays,
    });
  }

  if (failures.length > 0) {
    const precedence = [
      MARKET_EVIDENCE_STATUS.HOLD_CONFLICT,
      MARKET_EVIDENCE_STATUS.HOLD_METADATA,
      MARKET_EVIDENCE_STATUS.HOLD_POLICY,
      MARKET_EVIDENCE_STATUS.HOLD_GEOGRAPHY,
      MARKET_EVIDENCE_STATUS.HOLD_ASSET_TYPE,
      MARKET_EVIDENCE_STATUS.HOLD_REVIEW,
      MARKET_EVIDENCE_STATUS.HOLD_STALE,
      MARKET_EVIDENCE_STATUS.HOLD_EVIDENCE_QUALITY,
    ];
    const status = precedence.find((candidate) => failures.some((failure) => failure.reason === candidate)) || MARKET_EVIDENCE_STATUS.HOLD_METADATA;
    return {
      ...hold(status, ['one or more market evidence items failed qualification'], context),
      failures,
      qualifiedEvidence: qualified,
      evidenceRecords,
    };
  }

  return {
    caseId,
    projectId,
    status: MARKET_EVIDENCE_STATUS.QUALIFIED_FOR_ANALYTICAL_USE,
    reasons: [],
    asOfDate,
    targetGeography: {
      country: targetGeography.country.trim(),
      city: targetGeography.city.trim(),
      district: nonEmptyString(targetGeography.district) ? targetGeography.district.trim() : null,
    },
    targetAssetType: targetAssetType.trim(),
    qualifiedEvidence: qualified,
    evidenceRecords,
    analyticalUseAllowed: true,
    externalMarketTruthEstablished: false,
    certifiedValuationEstablished: false,
    humanReviewRequired: true,
    semantics: 'QUALIFIED_FOR_ANALYTICAL_USE means the supplied market evidence satisfies the caller-supplied geography, freshness, review, grade, and status policy. It does not establish external market truth, fetch live/official data, or constitute a certified valuation.',
  };
}

module.exports = {
  MARKET_USAGE,
  MARKET_EVIDENCE_STATUS,
  qualifyMarketEvidence,
};
