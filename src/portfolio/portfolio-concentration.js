'use strict';

const crypto = require('crypto');

const WEIGHT_BASIS = Object.freeze({
  CURRENT_EXPOSURE: 'CURRENT_EXPOSURE',
  TARGET_ALLOCATION: 'TARGET_ALLOCATION',
});

const EXPOSURE_BASIS = Object.freeze({
  PROFESSIONAL_VALUE_INDICATION: 'PROFESSIONAL_VALUE_INDICATION',
  INVESTED_EQUITY: 'INVESTED_EQUITY',
  COST_BASIS: 'COST_BASIS',
  COMMITMENT: 'COMMITMENT',
  OTHER_EXPLICIT: 'OTHER_EXPLICIT',
});

const PORTFOLIO_STATUS = Object.freeze({
  READY_FOR_IC_EVIDENCE_ASSEMBLY: 'READY_FOR_IC_EVIDENCE_ASSEMBLY',
  HOLD_WEIGHT_RECONCILIATION: 'HOLD_WEIGHT_RECONCILIATION',
  HOLD_EXPOSURE_WEIGHT_RECONCILIATION: 'HOLD_EXPOSURE_WEIGHT_RECONCILIATION',
  HOLD_SOURCE_FRESHNESS: 'HOLD_SOURCE_FRESHNESS',
  HOLD_TEMPORAL_VALIDITY: 'HOLD_TEMPORAL_VALIDITY',
});

const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = canonicalize(value[key]);
    return acc;
  }, {});
}

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function finite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function positive(value, field) {
  finite(value, field);
  if (value <= 0) throw new RangeError(`${field} must be > 0`);
  return value;
}

function unitWeight(value, field) {
  finite(value, field);
  if (value <= 0 || value > 1) throw new RangeError(`${field} must be > 0 and <= 1`);
  return value;
}

function assertSha(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${field} must be a 64-character SHA-256 hex digest`);
  }
  return value.toLowerCase();
}

function realIsoDate(value, field) {
  requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must be YYYY-MM-DD`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new TypeError(`${field} must be a real ISO date`);
  return value;
}

function isoTime(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}

function daysBetween(earlier, later) {
  return Math.floor((new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) / 86400000);
}

function normalizeCurrency(value) {
  const c = requiredString(value, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) throw new TypeError('currency must be a 3-letter code');
  return c;
}

function createPortfolioMember(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const exposureBasis = requiredString(input.exposureBasis, 'exposureBasis');
  if (!Object.values(EXPOSURE_BASIS).includes(exposureBasis)) throw new TypeError('exposureBasis is invalid');
  const preparedAt = isoTime(input.preparedAt || Date.now(), 'preparedAt');
  const reviewedAt = isoTime(input.reviewedAt, 'reviewedAt');
  if (reviewedAt < preparedAt) throw new Error('PORTFOLIO_MEMBER_REVIEW_BEFORE_PREPARATION');
  const evidenceRefs = Array.isArray(input.evidenceRefs)
    ? input.evidenceRefs.map((v) => requiredString(v, 'evidenceRef')) : [];
  if (evidenceRefs.length === 0) throw new Error('PORTFOLIO_MEMBER_EVIDENCE_REQUIRED');

  const core = {
    schemaVersion: 1,
    memberId: requiredString(input.memberId, 'memberId'),
    assetId: requiredString(input.assetId, 'assetId'),
    caseId: requiredString(input.caseId, 'caseId'),
    propertyRef: requiredString(input.propertyRef, 'propertyRef'),
    assetClass: requiredString(input.assetClass, 'assetClass'),
    geography: requiredString(input.geography, 'geography'),
    sector: requiredString(input.sector, 'sector'),
    exposureAmount: positive(input.exposureAmount, 'exposureAmount'),
    currency: normalizeCurrency(input.currency),
    exposureBasis,
    allocationWeight: unitWeight(input.allocationWeight, 'allocationWeight'),
    sourceArtifactId: requiredString(input.sourceArtifactId, 'sourceArtifactId'),
    sourceArtifactHashSha256: assertSha(input.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
    sourceArtifactClassification: requiredString(input.sourceArtifactClassification, 'sourceArtifactClassification'),
    sourceAsOfDate: realIsoDate(input.sourceAsOfDate, 'sourceAsOfDate'),
    membershipRationale: requiredString(input.membershipRationale, 'membershipRationale'),
    evidenceRefs,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    preparedAt,
    reviewedAt,
    riskEvidenceRefs: Array.isArray(input.riskEvidenceRefs)
      ? input.riskEvidenceRefs.map((v) => requiredString(v, 'riskEvidenceRef')) : [],
  };
  return deepFreeze({ ...core, memberHashSha256: hashObject(core) });
}

function verifyPortfolioMember(member) {
  if (!member || typeof member !== 'object') return deepFreeze({ valid: false, reason: 'MEMBER_REQUIRED' });
  const { memberHashSha256, ...core } = member;
  try {
    const expected = assertSha(memberHashSha256, 'memberHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: expected === computed, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'MEMBER_HASH_INVALID' });
  }
}

function groupConcentration(members, field) {
  const groups = new Map();
  for (const member of members) {
    const key = member[field];
    groups.set(key, (groups.get(key) || 0) + member.allocationWeight);
  }
  return [...groups.entries()]
    .map(([key, weight]) => ({ key, weight }))
    .sort((a, b) => b.weight - a.weight || String(a.key).localeCompare(String(b.key)));
}

function topNWeight(members, n) {
  return [...members]
    .sort((a, b) => b.allocationWeight - a.allocationWeight)
    .slice(0, n)
    .reduce((sum, member) => sum + member.allocationWeight, 0);
}

function createPortfolioSnapshot(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const weightBasis = requiredString(input.weightBasis, 'weightBasis');
  if (!Object.values(WEIGHT_BASIS).includes(weightBasis)) throw new TypeError('weightBasis is invalid');
  const members = Array.isArray(input.members) ? [...input.members] : [];
  if (members.length < 2) throw new Error('PORTFOLIO_REQUIRES_AT_LEAST_TWO_MEMBERS');
  const asOfDate = realIsoDate(input.asOfDate, 'asOfDate');
  const currency = normalizeCurrency(input.currency);
  const maximumSourceAgeDays = Number(input.maximumSourceAgeDays);
  if (!Number.isInteger(maximumSourceAgeDays) || maximumSourceAgeDays < 0) {
    throw new RangeError('maximumSourceAgeDays must be an integer >= 0');
  }
  const weightTolerance = input.weightTolerance == null ? 1e-9 : positive(input.weightTolerance, 'weightTolerance');
  const exposureWeightTolerance = input.exposureWeightTolerance == null
    ? 1e-6 : positive(input.exposureWeightTolerance, 'exposureWeightTolerance');

  const memberIds = new Set();
  const assetIds = new Set();
  const blockers = new Set();
  for (const member of members) {
    if (!verifyPortfolioMember(member).valid) throw new Error(`PORTFOLIO_MEMBER_INTEGRITY_FAILURE:${member?.memberId || 'UNKNOWN'}`);
    if (memberIds.has(member.memberId)) throw new Error(`DUPLICATE_PORTFOLIO_MEMBER_ID:${member.memberId}`);
    if (assetIds.has(member.assetId)) throw new Error(`DUPLICATE_PORTFOLIO_ASSET_ID:${member.assetId}`);
    memberIds.add(member.memberId);
    assetIds.add(member.assetId);
    if (member.currency !== currency) throw new Error(`PORTFOLIO_CURRENCY_MISMATCH:${member.memberId}`);
    if (member.sourceAsOfDate > asOfDate) blockers.add(PORTFOLIO_STATUS.HOLD_TEMPORAL_VALIDITY);
    else if (daysBetween(member.sourceAsOfDate, asOfDate) > maximumSourceAgeDays) blockers.add(PORTFOLIO_STATUS.HOLD_SOURCE_FRESHNESS);
  }

  const weightSum = members.reduce((sum, member) => sum + member.allocationWeight, 0);
  if (Math.abs(weightSum - 1) > weightTolerance) blockers.add(PORTFOLIO_STATUS.HOLD_WEIGHT_RECONCILIATION);

  const totalExposureAmount = members.reduce((sum, member) => sum + member.exposureAmount, 0);
  const exposureWeightReconciliation = members.map((member) => {
    const impliedExposureWeight = member.exposureAmount / totalExposureAmount;
    return {
      memberId: member.memberId,
      allocationWeight: member.allocationWeight,
      impliedExposureWeight,
      difference: member.allocationWeight - impliedExposureWeight,
    };
  });
  if (weightBasis === WEIGHT_BASIS.CURRENT_EXPOSURE
      && exposureWeightReconciliation.some((row) => Math.abs(row.difference) > exposureWeightTolerance)) {
    blockers.add(PORTFOLIO_STATUS.HOLD_EXPOSURE_WEIGHT_RECONCILIATION);
  }

  const sortedWeights = [...members].sort((a, b) => b.allocationWeight - a.allocationWeight);
  const hhi = members.reduce((sum, member) => sum + member.allocationWeight ** 2, 0);
  const blockerList = [...blockers].sort();
  const status = blockerList.length === 0 ? PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY : blockerList[0];

  const core = {
    schemaVersion: 1,
    snapshotId: requiredString(input.snapshotId, 'snapshotId'),
    portfolioId: requiredString(input.portfolioId, 'portfolioId'),
    portfolioName: requiredString(input.portfolioName, 'portfolioName'),
    asOfDate,
    currency,
    weightBasis,
    maximumSourceAgeDays,
    weightTolerance,
    exposureWeightTolerance,
    memberCount: members.length,
    members: members.map((member) => ({ ...member })),
    totalExposureAmount,
    weightSum,
    exposureWeightReconciliation,
    concentration: {
      hhi,
      top1Weight: sortedWeights.length ? sortedWeights[0].allocationWeight : 0,
      top3Weight: topNWeight(members, 3),
      top5Weight: topNWeight(members, 5),
      byAssetClass: groupConcentration(members, 'assetClass'),
      byGeography: groupConcentration(members, 'geography'),
      bySector: groupConcentration(members, 'sector'),
    },
    blockingCodes: blockerList,
    status,
    portfolioProbabilisticAggregationPerformed: false,
    crossAssetCorrelationModel: 'NOT_MODELED',
    jointDistributionEstablished: false,
    portfolioVaRCalculated: false,
    diversificationBenefitCalculated: false,
    concentrationLimitComplianceDerived: false,
    decisionStateDerived: false,
    automaticInvestmentDecisionAuthorized: false,
    humanCommitteeDecisionRequired: true,
    professionalValuationConclusionModified: false,
    externalIssuanceAuthorized: false,
    transactionAuthorized: false,
    operatingMode: OPERATING_MODE,
    semantics: 'Portfolio concentration analytics use explicit membership and allocation weights. No cross-asset probability aggregation, correlation model, diversification benefit, approval/rejection or transaction instruction is inferred.',
    createdAt: isoTime(input.createdAt || Date.now(), 'createdAt'),
  };
  return deepFreeze({ ...core, snapshotHashSha256: hashObject(core) });
}

function verifyPortfolioSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return deepFreeze({ valid: false, reason: 'SNAPSHOT_REQUIRED' });
  const { snapshotHashSha256, ...core } = snapshot;
  try {
    const expected = assertSha(snapshotHashSha256, 'snapshotHashSha256');
    const computed = hashObject(core);
    return deepFreeze({ valid: expected === computed, expectedHash: expected, computedHash: computed });
  } catch (error) {
    return deepFreeze({ valid: false, reason: 'SNAPSHOT_HASH_INVALID' });
  }
}

module.exports = {
  WEIGHT_BASIS,
  EXPOSURE_BASIS,
  PORTFOLIO_STATUS,
  createPortfolioMember,
  verifyPortfolioMember,
  createPortfolioSnapshot,
  verifyPortfolioSnapshot,
};
