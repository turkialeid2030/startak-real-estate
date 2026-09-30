'use strict';

const crypto = require('crypto');
const {
  MARKET_EVIDENCE_TYPE,
  MARKET_GATE_STATUS,
} = require('../contracts/market-evidence');
const {
  evaluateMarketEvidenceBundle,
} = require('./market-evidence-governance');

const CAPABILITY = 'C10_GOVERNED_MARKET_INTERPRETATION_LIQUIDITY_V1';
const POLICY_VERSION = 'C10_MARKET_INTERPRETATION_POLICY_V1';

const MARKET_INTERPRETATION_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_MARKET_REVIEW: 'READY_FOR_PROFESSIONAL_MARKET_REVIEW',
  HOLD_UPSTREAM_EVIDENCE: 'HOLD_UPSTREAM_EVIDENCE',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_EVIDENCE_BINDING: 'HOLD_EVIDENCE_BINDING',
  HOLD_METRIC: 'HOLD_METRIC',
  HOLD_UNIT_COMPATIBILITY: 'HOLD_UNIT_COMPATIBILITY',
});

const MARKET_INTERPRETATION_DIMENSION = Object.freeze({
  LIQUIDITY: 'LIQUIDITY',
  SALE_MARKET_MOVEMENT: 'SALE_MARKET_MOVEMENT',
  RENT_MARKET_MOVEMENT: 'RENT_MARKET_MOVEMENT',
  MARKET_ACTIVITY: 'MARKET_ACTIVITY',
});

const ALLOWED_EVIDENCE_TYPES_BY_DIMENSION = Object.freeze({
  [MARKET_INTERPRETATION_DIMENSION.LIQUIDITY]: Object.freeze([
    MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
  ]),
  [MARKET_INTERPRETATION_DIMENSION.SALE_MARKET_MOVEMENT]: Object.freeze([
    MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
    MARKET_EVIDENCE_TYPE.SALE_MARKET_AGGREGATE,
  ]),
  [MARKET_INTERPRETATION_DIMENSION.RENT_MARKET_MOVEMENT]: Object.freeze([
    MARKET_EVIDENCE_TYPE.RENT_INDEX,
    MARKET_EVIDENCE_TYPE.RENT_MARKET_AGGREGATE,
  ]),
  [MARKET_INTERPRETATION_DIMENSION.MARKET_ACTIVITY]: Object.freeze([
    MARKET_EVIDENCE_TYPE.SALE_MARKET_AGGREGATE,
    MARKET_EVIDENCE_TYPE.RENT_MARKET_AGGREGATE,
    MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
  ]),
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isJsonSafe(value, seen = new Set()) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => isJsonSafe(value[key], seen));
  seen.delete(value);
  return valid;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, Object.create(null));
  }
  return value;
}

function sha256(value) {
  try {
    if (!isJsonSafe(value)) return null;
    const serialized = JSON.stringify(canonicalize(value));
    if (typeof serialized !== 'string') return null;
    return crypto.createHash('sha256').update(serialized).digest('hex');
  } catch (_) {
    return null;
  }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function computeMarketEvidenceHash(marketEvidenceResult) {
  return sha256(marketEvidenceResult);
}

function computeMarketInterpretationPolicyHash(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return null;
  const payload = { ...policy };
  delete payload.policyHash;
  return sha256(payload);
}

function validTopLevelFieldName(value) {
  const key = cleanString(value);
  return !!key
    && !key.includes('.')
    && !key.includes('[')
    && !key.includes(']')
    && !['__proto__', 'prototype', 'constructor'].includes(key);
}

function finiteOrNull(value) {
  return value === null || Number.isFinite(value);
}

function normalizedBands(bands, ruleId, blockers) {
  if (!Array.isArray(bands) || bands.length === 0) {
    blockers.push(`C10_POLICY_BANDS_REQUIRED:${ruleId}`);
    return [];
  }

  const ids = new Set();
  const normalized = bands.map((band, index) => {
    if (!band || typeof band !== 'object' || Array.isArray(band)) {
      blockers.push(`C10_POLICY_BAND_OBJECT_REQUIRED:${ruleId}:${index}`);
      return null;
    }
    const bandId = cleanString(band.bandId);
    const label = cleanString(band.label);
    const minInclusive = band.minInclusive === undefined ? null : band.minInclusive;
    const maxExclusive = band.maxExclusive === undefined ? null : band.maxExclusive;
    if (!bandId) blockers.push(`C10_POLICY_BAND_ID_REQUIRED:${ruleId}:${index}`);
    else if (ids.has(bandId)) blockers.push(`C10_POLICY_BAND_ID_DUPLICATE:${ruleId}:${bandId}`);
    else ids.add(bandId);
    if (!label) blockers.push(`C10_POLICY_BAND_LABEL_REQUIRED:${ruleId}:${index}`);
    if (!finiteOrNull(minInclusive)) blockers.push(`C10_POLICY_BAND_MIN_INVALID:${ruleId}:${bandId || index}`);
    if (!finiteOrNull(maxExclusive)) blockers.push(`C10_POLICY_BAND_MAX_INVALID:${ruleId}:${bandId || index}`);
    if (Number.isFinite(minInclusive) && Number.isFinite(maxExclusive) && minInclusive >= maxExclusive) {
      blockers.push(`C10_POLICY_BAND_RANGE_INVALID:${ruleId}:${bandId || index}`);
    }
    return {
      bandId: bandId || null,
      label: label || null,
      minInclusive,
      maxExclusive,
    };
  }).filter(Boolean);

  const sorted = [...normalized].sort((a, b) => {
    const av = a.minInclusive === null ? Number.NEGATIVE_INFINITY : a.minInclusive;
    const bv = b.minInclusive === null ? Number.NEGATIVE_INFINITY : b.minInclusive;
    if (av !== bv) return av - bv;
    const ax = a.maxExclusive === null ? Number.POSITIVE_INFINITY : a.maxExclusive;
    const bx = b.maxExclusive === null ? Number.POSITIVE_INFINITY : b.maxExclusive;
    return ax - bx;
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const previousMax = previous.maxExclusive === null ? Number.POSITIVE_INFINITY : previous.maxExclusive;
    const currentMin = current.minInclusive === null ? Number.NEGATIVE_INFINITY : current.minInclusive;
    if (currentMin < previousMax) {
      blockers.push(`C10_POLICY_BANDS_OVERLAP:${ruleId}:${previous.bandId || i - 1}:${current.bandId || i}`);
    }
  }

  return normalized;
}

function validatePolicy(policy, policyId, upstream, marketEvidenceHash) {
  const blockers = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { blockers: ['C10_GOVERNED_POLICY_OBJECT_REQUIRED'], rules: [] };
  }

  if (cleanString(policy.version) !== POLICY_VERSION) blockers.push('C10_POLICY_VERSION_MISMATCH');
  if (cleanString(policy.policyId) !== policyId) blockers.push('C10_POLICY_ID_MISMATCH');
  if (cleanString(policy.marketContextId) !== cleanString(upstream.marketContextId)) blockers.push('C10_POLICY_MARKET_CONTEXT_MISMATCH');
  if (cleanString(policy.geographyKey) !== cleanString(upstream.geographyKey)) blockers.push('C10_POLICY_GEOGRAPHY_MISMATCH');
  if (cleanString(policy.assetType) !== cleanString(upstream.assetType)) blockers.push('C10_POLICY_ASSET_TYPE_MISMATCH');

  if (!isSha256(policy.marketEvidenceHash) || String(policy.marketEvidenceHash).toLowerCase() !== marketEvidenceHash) {
    blockers.push('C10_POLICY_MARKET_EVIDENCE_HASH_MISMATCH');
  }
  const computedPolicyHash = computeMarketInterpretationPolicyHash(policy);
  if (!isSha256(policy.policyHash) || !computedPolicyHash || String(policy.policyHash).toLowerCase() !== computedPolicyHash) {
    blockers.push('C10_POLICY_INTEGRITY_HASH_MISMATCH');
  }

  const reviewedBy = cleanString(policy.reviewedBy);
  const reviewReference = cleanString(policy.reviewReference);
  const reviewedAt = cleanString(policy.reviewedAt);
  if (!reviewedBy) blockers.push('C10_POLICY_REVIEWER_REQUIRED');
  if (!reviewReference) blockers.push('C10_POLICY_REVIEW_REFERENCE_REQUIRED');
  const reviewedAtMs = reviewedAt ? new Date(reviewedAt).getTime() : Number.NaN;
  const asOfMs = new Date(upstream.asOf).getTime();
  if (!Number.isFinite(reviewedAtMs)) blockers.push('C10_POLICY_REVIEWED_AT_REQUIRED');
  else if (Number.isFinite(asOfMs) && reviewedAtMs > asOfMs) blockers.push('C10_POLICY_REVIEW_AFTER_AS_OF');

  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    blockers.push('C10_POLICY_RULES_REQUIRED');
    return { blockers, rules: [] };
  }

  const ruleIds = new Set();
  const rules = policy.rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      blockers.push(`C10_POLICY_RULE_OBJECT_REQUIRED:${index}`);
      return null;
    }
    const ruleId = cleanString(rule.ruleId);
    const dimension = cleanString(rule.dimension);
    const evidenceId = cleanString(rule.evidenceId);
    const evidenceType = cleanString(rule.evidenceType);
    const metricField = cleanString(rule.metricField);
    const unitField = cleanString(rule.unitField);
    const expectedUnit = cleanString(rule.expectedUnit);

    if (!ruleId) blockers.push(`C10_POLICY_RULE_ID_REQUIRED:${index}`);
    else if (ruleIds.has(ruleId)) blockers.push(`C10_POLICY_RULE_ID_DUPLICATE:${ruleId}`);
    else ruleIds.add(ruleId);
    if (!Object.values(MARKET_INTERPRETATION_DIMENSION).includes(dimension)) {
      blockers.push(`C10_POLICY_DIMENSION_UNSUPPORTED:${ruleId || index}:${dimension || 'MISSING'}`);
    }
    if (!evidenceId) blockers.push(`C10_POLICY_EVIDENCE_ID_REQUIRED:${ruleId || index}`);
    const allowedTypes = ALLOWED_EVIDENCE_TYPES_BY_DIMENSION[dimension] || [];
    if (!allowedTypes.includes(evidenceType)) {
      blockers.push(`C10_POLICY_EVIDENCE_TYPE_NOT_ALLOWED:${ruleId || index}:${evidenceType || 'MISSING'}`);
    }
    if (!validTopLevelFieldName(metricField)) blockers.push(`C10_POLICY_METRIC_FIELD_INVALID:${ruleId || index}`);
    if (!validTopLevelFieldName(unitField)) blockers.push(`C10_POLICY_UNIT_FIELD_INVALID:${ruleId || index}`);
    if (!expectedUnit) blockers.push(`C10_POLICY_EXPECTED_UNIT_REQUIRED:${ruleId || index}`);

    const bands = normalizedBands(rule.bands, ruleId || String(index), blockers);
    return {
      ruleId: ruleId || null,
      dimension: dimension || null,
      evidenceId: evidenceId || null,
      evidenceType: evidenceType || null,
      metricField: metricField || null,
      unitField: unitField || null,
      expectedUnit: expectedUnit || null,
      bands,
    };
  }).filter(Boolean);

  return { blockers, rules };
}

function valueMatchesBand(value, band) {
  const lower = band.minInclusive === null || value >= band.minInclusive;
  const upper = band.maxExclusive === null || value < band.maxExclusive;
  return lower && upper;
}

function baseResult({ status, blockers, warnings, upstream, marketEvidenceHash, policyId, interpretations = [] }) {
  return deepFreeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    professionalReviewReady: status === MARKET_INTERPRETATION_STATUS.READY_FOR_PROFESSIONAL_MARKET_REVIEW,
    marketContextId: upstream?.marketContextId || null,
    geographyKey: upstream?.geographyKey || null,
    assetType: upstream?.assetType || null,
    asOf: upstream?.asOf || null,
    upstreamMarketEvidenceStatus: upstream?.status || null,
    marketEvidenceHash: marketEvidenceHash || null,
    interpretationPolicyId: policyId || null,
    interpretations: Object.freeze(interpretations),
    blockers: Object.freeze([...new Set(blockers)]),
    warnings: Object.freeze([...new Set(warnings)]),
    authoritativeEvidenceOnly: true,
    askingEvidenceCreatesAuthority: false,
    compositeScoreCreated: false,
    forecastCreated: false,
    certifiedValuationEstablished: false,
    professionalValuationOpinion: false,
    automaticUnderwritingAdoption: false,
    automaticAcquisitionRecommendation: false,
    highestBestUseEstablished: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C10 classifies explicit authoritative market metrics only under an integrity-bound governed policy and a C2-ready evidence bundle. Thresholds, bands, metric fields and units are caller-governed; C10 does not invent market standards, blend asking evidence into authority, create a valuation opinion, forecast, composite score, transaction authority or production authorization.',
  });
}

function evaluateGovernedMarketInterpretation({
  marketEvidenceInput,
  interpretationPolicyId,
  governedInterpretationPolicies = {},
} = {}) {
  const policyId = cleanString(interpretationPolicyId);
  let upstream;
  try {
    upstream = evaluateMarketEvidenceBundle(marketEvidenceInput || {});
  } catch (error) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_UPSTREAM_EVIDENCE,
      blockers: [`C10_UPSTREAM_EVALUATION_FAILED:${cleanString(error?.name) || 'ERROR'}`],
      warnings: [],
      upstream: null,
      marketEvidenceHash: null,
      policyId,
    });
  }

  const marketEvidenceHash = computeMarketEvidenceHash(upstream);
  if (upstream.status !== MARKET_GATE_STATUS.READY || upstream.decisionReady !== true) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_UPSTREAM_EVIDENCE,
      blockers: ['C10_UPSTREAM_MARKET_EVIDENCE_NOT_READY', ...(Array.isArray(upstream.blockers) ? upstream.blockers : [])],
      warnings: Array.isArray(upstream.warnings) ? upstream.warnings : [],
      upstream,
      marketEvidenceHash,
      policyId,
    });
  }

  if (!marketEvidenceHash) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_INTEGRITY,
      blockers: ['C10_UPSTREAM_MARKET_EVIDENCE_NOT_HASHABLE'],
      warnings: [],
      upstream,
      marketEvidenceHash: null,
      policyId,
    });
  }

  if (!policyId) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_POLICY,
      blockers: ['C10_GOVERNED_POLICY_ID_REQUIRED'],
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId: null,
    });
  }
  if (!governedInterpretationPolicies || typeof governedInterpretationPolicies !== 'object' || Array.isArray(governedInterpretationPolicies)) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_POLICY,
      blockers: ['C10_GOVERNED_POLICY_REGISTRY_REQUIRED'],
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(governedInterpretationPolicies, policyId)) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_POLICY,
      blockers: [`C10_GOVERNED_POLICY_NOT_FOUND:${policyId}`],
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId,
    });
  }

  const policy = governedInterpretationPolicies[policyId];
  const validated = validatePolicy(policy, policyId, upstream, marketEvidenceHash);
  const integrityBlockers = validated.blockers.filter((item) => item.includes('INTEGRITY_HASH') || item.includes('MARKET_EVIDENCE_HASH'));
  if (integrityBlockers.length) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_INTEGRITY,
      blockers: validated.blockers,
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId,
    });
  }
  if (validated.blockers.length) {
    return baseResult({
      status: MARKET_INTERPRETATION_STATUS.HOLD_POLICY,
      blockers: validated.blockers,
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId,
    });
  }

  const authoritativeById = new Map((upstream.authoritativeEvidence || []).map((item) => [item.id, item]));
  const requiredTypes = new Set(Array.isArray(upstream.requiredEvidenceTypes) ? upstream.requiredEvidenceTypes : []);
  const blockers = [];
  const interpretations = [];

  for (const rule of validated.rules) {
    const evidence = authoritativeById.get(rule.evidenceId);
    if (!evidence) {
      blockers.push(`C10_AUTHORITATIVE_EVIDENCE_NOT_FOUND:${rule.ruleId}:${rule.evidenceId}`);
      continue;
    }
    if (evidence.evidenceType !== rule.evidenceType) {
      blockers.push(`C10_EVIDENCE_TYPE_MISMATCH:${rule.ruleId}:${evidence.evidenceType || 'MISSING'}:${rule.evidenceType}`);
      continue;
    }
    if (!requiredTypes.has(rule.evidenceType)) {
      blockers.push(`C10_EVIDENCE_TYPE_NOT_GATED_UPSTREAM:${rule.ruleId}:${rule.evidenceType}`);
      continue;
    }

    const valueObject = evidence.normalizedValue;
    if (!valueObject || typeof valueObject !== 'object' || Array.isArray(valueObject)) {
      blockers.push(`C10_METRIC_OBJECT_REQUIRED:${rule.ruleId}`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(valueObject, rule.metricField) || !Number.isFinite(valueObject[rule.metricField])) {
      blockers.push(`C10_METRIC_FINITE_NUMBER_REQUIRED:${rule.ruleId}:${rule.metricField}`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(valueObject, rule.unitField)) {
      blockers.push(`C10_METRIC_UNIT_REQUIRED:${rule.ruleId}:${rule.unitField}`);
      continue;
    }
    const actualUnit = cleanString(valueObject[rule.unitField]);
    if (actualUnit !== rule.expectedUnit) {
      blockers.push(`C10_METRIC_UNIT_MISMATCH:${rule.ruleId}:${actualUnit || 'MISSING'}:${rule.expectedUnit}`);
      continue;
    }

    const value = valueObject[rule.metricField];
    const matchingBands = rule.bands.filter((band) => valueMatchesBand(value, band));
    if (matchingBands.length !== 1) {
      blockers.push(`C10_METRIC_BAND_RESOLUTION_FAILED:${rule.ruleId}:${matchingBands.length}`);
      continue;
    }
    const band = matchingBands[0];
    interpretations.push(deepFreeze({
      ruleId: rule.ruleId,
      dimension: rule.dimension,
      evidenceId: evidence.id,
      evidenceType: evidence.evidenceType,
      metricField: rule.metricField,
      value,
      unit: rule.expectedUnit,
      bandId: band.bandId,
      classification: band.label,
      thresholdSemantics: '[minInclusive,maxExclusive)',
      lineage: Object.freeze({
        sourceId: evidence.sourceId || null,
        sourceReference: evidence.sourceReference || null,
        sourceUrl: evidence.sourceUrl || null,
        verificationReference: evidence.verificationReference || null,
        effectiveAt: evidence.effectiveAt || null,
        observedAt: evidence.observedAt || null,
        validUntil: evidence.validUntil || null,
        seriesKey: evidence.seriesKey || null,
        periodKey: evidence.periodKey || null,
        normalizedValueHash: evidence.normalizedValueHash || null,
      }),
    }));
  }

  if (blockers.length) {
    const unitIssue = blockers.some((item) => item.startsWith('C10_METRIC_UNIT_'));
    const metricIssue = blockers.some((item) => item.startsWith('C10_METRIC_') && !item.startsWith('C10_METRIC_UNIT_'));
    const status = unitIssue
      ? MARKET_INTERPRETATION_STATUS.HOLD_UNIT_COMPATIBILITY
      : metricIssue
        ? MARKET_INTERPRETATION_STATUS.HOLD_METRIC
        : MARKET_INTERPRETATION_STATUS.HOLD_EVIDENCE_BINDING;
    return baseResult({
      status,
      blockers,
      warnings: [],
      upstream,
      marketEvidenceHash,
      policyId,
      interpretations: [],
    });
  }

  return baseResult({
    status: MARKET_INTERPRETATION_STATUS.READY_FOR_PROFESSIONAL_MARKET_REVIEW,
    blockers: [],
    warnings: Array.isArray(upstream.warnings) ? upstream.warnings : [],
    upstream,
    marketEvidenceHash,
    policyId,
    interpretations,
  });
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  MARKET_INTERPRETATION_STATUS,
  MARKET_INTERPRETATION_DIMENSION,
  ALLOWED_EVIDENCE_TYPES_BY_DIMENSION,
  computeMarketEvidenceHash,
  computeMarketInterpretationPolicyHash,
  evaluateGovernedMarketInterpretation,
};
