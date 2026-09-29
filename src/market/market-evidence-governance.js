'use strict';

const crypto = require('crypto');
const {
  C2_MARKET_EVIDENCE_SCHEMA_VERSION,
  MARKET_EVIDENCE_TYPE,
  MARKET_VERIFICATION_STATUS,
  MARKET_RESOLUTION_METHOD,
  MARKET_GATE_STATUS,
  DEFAULT_REQUIRED_MARKET_EVIDENCE_TYPES,
  expectedEvidenceClassForType,
} = require('../contracts/market-evidence');
const {
  OFFICIAL_MARKET_SOURCE_REGISTRY_VERSION,
  getOfficialMarketSource,
  marketSourceSupportsEvidenceType,
  officialMarketUrlMatchesSource,
} = require('./official-market-source-registry');

const C2_MARKET_EVIDENCE_GOVERNANCE_VERSION = 'C2_MARKET_EVIDENCE_GOVERNANCE_V1';
const KNOWN_TYPES = Object.freeze(Object.values(MARKET_EVIDENCE_TYPE));
const TRANSACTION_TYPES = Object.freeze([
  MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
  MARKET_EVIDENCE_TYPE.CLOSED_RENT_TRANSACTION,
]);
const AGGREGATE_TYPES = Object.freeze([
  MARKET_EVIDENCE_TYPE.SALE_MARKET_AGGREGATE,
  MARKET_EVIDENCE_TYPE.RENT_MARKET_AGGREGATE,
  MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
  MARKET_EVIDENCE_TYPE.RENT_INDEX,
  MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
]);
const AUTHORITATIVE_TYPES = Object.freeze([...TRANSACTION_TYPES, ...AGGREGATE_TYPES]);
const ASKING_TYPES = Object.freeze([
  MARKET_EVIDENCE_TYPE.ASKING_SALE_LISTING,
  MARKET_EVIDENCE_TYPE.ASKING_RENT_LISTING,
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  const cleaned = value.map(cleanString);
  if (cleaned.some((item) => !item)) throw new TypeError(`${name} must contain only non-empty strings`);
  return [...new Set(cleaned)];
}

function toTimestamp(value) {
  const text = cleanString(value);
  if (!text) return null;
  const ms = new Date(text).getTime();
  return Number.isFinite(ms) ? ms : null;
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
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function hashValue(value) {
  try {
    if (!isJsonSafe(value)) return null;
    const serialized = JSON.stringify(canonicalize(value));
    if (typeof serialized !== 'string') return null;
    return crypto.createHash('sha256').update(serialized).digest('hex');
  } catch (_) {
    return null;
  }
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function isHttpUrl(value) {
  const text = cleanString(value);
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deriveComparableMetric(evidenceType, normalizedValue) {
  if (!normalizedValue || typeof normalizedValue !== 'object' || Array.isArray(normalizedValue)) return null;
  if (evidenceType === MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION) {
    if (isPositiveFinite(normalizedValue.pricePerSqmSar)) return normalizedValue.pricePerSqmSar;
    if (isPositiveFinite(normalizedValue.amountSar) && isPositiveFinite(normalizedValue.areaSqm)) {
      return normalizedValue.amountSar / normalizedValue.areaSqm;
    }
  }
  if (evidenceType === MARKET_EVIDENCE_TYPE.CLOSED_RENT_TRANSACTION) {
    if (isPositiveFinite(normalizedValue.annualRentPerSqmSar)) return normalizedValue.annualRentPerSqmSar;
    if (isPositiveFinite(normalizedValue.annualRentSar) && isPositiveFinite(normalizedValue.areaSqm)) {
      return normalizedValue.annualRentSar / normalizedValue.areaSqm;
    }
  }
  return null;
}

function validateMinimumPolicy(requiredEvidenceTypes, minimumCountPolicyId, governedMinimumCountPolicies) {
  const blockers = [];
  const policyId = cleanString(minimumCountPolicyId);
  const registryValid = governedMinimumCountPolicies
    && typeof governedMinimumCountPolicies === 'object'
    && !Array.isArray(governedMinimumCountPolicies);

  if (!registryValid) blockers.push('C2_MINIMUM_COUNT_POLICY_REGISTRY_REQUIRED');
  if (!policyId) blockers.push('C2_MINIMUM_COUNT_POLICY_ID_REQUIRED');

  const policy = registryValid && policyId && Object.prototype.hasOwnProperty.call(governedMinimumCountPolicies, policyId)
    ? governedMinimumCountPolicies[policyId]
    : null;
  if (policyId && !policy) blockers.push(`C2_MINIMUM_COUNT_POLICY_NOT_GOVERNED:${policyId}`);

  if (policy && (typeof policy !== 'object' || Array.isArray(policy))) {
    blockers.push(`C2_MINIMUM_COUNT_POLICY_INVALID:${policyId}`);
  }

  const normalized = {};
  for (const type of requiredEvidenceTypes) {
    const count = policy && typeof policy === 'object' && !Array.isArray(policy) ? policy[type] : undefined;
    if (!Number.isInteger(count) || count < 1) blockers.push(`C2_MINIMUM_COUNT_REQUIRED:${type}`);
    else normalized[type] = count;
  }

  return { policyId: policyId || null, minimumByEvidenceType: normalized, blockers };
}

function evaluateRecord(record, context) {
  const blockers = [];
  const warnings = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { authoritative: false, asking: false, blockers: ['C2_EVIDENCE_RECORD_OBJECT_REQUIRED'], warnings, normalized: null };
  }

  const evidenceType = cleanString(record.evidenceType);
  const evidenceClass = cleanString(record.evidenceClass);
  const authoritative = AUTHORITATIVE_TYPES.includes(evidenceType);
  const asking = ASKING_TYPES.includes(evidenceType);
  const id = cleanString(record.id);
  const marketContextId = cleanString(record.marketContextId);
  const geographyKey = cleanString(record.geographyKey);
  const assetType = cleanString(record.assetType);
  const sourceId = cleanString(record.sourceId);
  const sourceReference = cleanString(record.sourceReference);
  const sourceUrl = cleanString(record.sourceUrl);
  const transactionKey = cleanString(record.transactionKey);
  const seriesKey = cleanString(record.seriesKey);
  const periodKey = cleanString(record.periodKey);
  const verificationStatus = cleanString(record.verificationStatus);
  const verifiedBy = cleanString(record.verifiedBy);
  const verificationReference = cleanString(record.verificationReference);
  const resolutionMethod = cleanString(record.resolutionMethod);
  const freshnessPolicyId = cleanString(record.freshnessPolicyId);
  const effectiveAtMs = toTimestamp(record.effectiveAt);
  const observedAtMs = toTimestamp(record.observedAt);
  const validUntilMs = toTimestamp(record.validUntil);

  if (!id) blockers.push('C2_EVIDENCE_ID_REQUIRED');
  if (!KNOWN_TYPES.includes(evidenceType)) blockers.push(`C2_EVIDENCE_TYPE_UNSUPPORTED:${evidenceType || 'MISSING'}`);
  const expectedClass = expectedEvidenceClassForType(evidenceType);
  if (!expectedClass || evidenceClass !== expectedClass) blockers.push(`C2_EVIDENCE_CLASS_MISMATCH:${evidenceType || 'UNKNOWN'}`);

  if (!marketContextId) blockers.push('C2_MARKET_CONTEXT_REQUIRED');
  else if (marketContextId !== context.marketContextId) blockers.push(`C2_MARKET_CONTEXT_MISMATCH:${evidenceType || 'UNKNOWN'}`);
  if (!geographyKey) blockers.push('C2_GEOGRAPHY_KEY_REQUIRED');
  else if (geographyKey !== context.geographyKey) blockers.push(`C2_GEOGRAPHY_MISMATCH:${evidenceType || 'UNKNOWN'}`);
  if (!assetType) blockers.push('C2_ASSET_TYPE_REQUIRED');
  else if (assetType !== context.assetType) blockers.push(`C2_ASSET_TYPE_MISMATCH:${evidenceType || 'UNKNOWN'}`);

  const hasNormalizedValue = Object.prototype.hasOwnProperty.call(record, 'normalizedValue')
    && record.normalizedValue !== undefined
    && record.normalizedValue !== null;
  const normalizedValueHash = hasNormalizedValue ? hashValue(record.normalizedValue) : null;
  if (!hasNormalizedValue) blockers.push(`C2_NORMALIZED_VALUE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  else if (!normalizedValueHash) blockers.push(`C2_NORMALIZED_VALUE_JSON_REQUIRED:${evidenceType || 'UNKNOWN'}`);

  if (authoritative) {
    const source = getOfficialMarketSource(sourceId);
    if (!source) blockers.push(`C2_OFFICIAL_SOURCE_NOT_REGISTERED:${sourceId || 'MISSING'}`);
    if (source && evidenceType && !marketSourceSupportsEvidenceType(sourceId, evidenceType)) {
      blockers.push(`C2_SOURCE_SCOPE_MISMATCH:${sourceId}:${evidenceType}`);
    }
    if (!sourceReference) blockers.push(`C2_SOURCE_REFERENCE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    if (!officialMarketUrlMatchesSource(sourceId, sourceUrl)) blockers.push(`C2_OFFICIAL_SOURCE_URL_REQUIRED:${sourceId || 'MISSING'}`);
    if (verificationStatus !== MARKET_VERIFICATION_STATUS.VERIFIED) blockers.push(`C2_VERIFIED_EVIDENCE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    if (!verifiedBy) blockers.push(`C2_VERIFIER_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else if (!context.trustedVerifierIds.includes(verifiedBy)) blockers.push(`C2_UNTRUSTED_VERIFIER:${evidenceType || 'UNKNOWN'}`);
    if (!verificationReference) blockers.push(`C2_VERIFICATION_REFERENCE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    if (!freshnessPolicyId) blockers.push(`C2_FRESHNESS_POLICY_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else if (!context.governedFreshnessPolicyIds.includes(freshnessPolicyId)) blockers.push(`C2_FRESHNESS_POLICY_NOT_GOVERNED:${evidenceType || 'UNKNOWN'}`);

    if (effectiveAtMs === null) blockers.push(`C2_EFFECTIVE_AT_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else if (effectiveAtMs > context.asOfMs) blockers.push(`C2_FUTURE_EFFECTIVE_TIMESTAMP:${evidenceType || 'UNKNOWN'}`);

    if (observedAtMs === null) blockers.push(`C2_OBSERVED_AT_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else if (observedAtMs > context.asOfMs) blockers.push(`C2_FUTURE_EVIDENCE_TIMESTAMP:${evidenceType || 'UNKNOWN'}`);

    if (effectiveAtMs !== null && observedAtMs !== null && effectiveAtMs > observedAtMs) {
      blockers.push(`C2_EFFECTIVE_AFTER_OBSERVATION:${evidenceType || 'UNKNOWN'}`);
    }

    if (validUntilMs === null) blockers.push(`C2_VALID_UNTIL_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else {
      if (observedAtMs !== null && validUntilMs < observedAtMs) blockers.push(`C2_INVALID_VALIDITY_WINDOW:${evidenceType || 'UNKNOWN'}`);
      if (validUntilMs < context.asOfMs) blockers.push(`C2_EVIDENCE_STALE:${evidenceType || 'UNKNOWN'}`);
    }

    if (TRANSACTION_TYPES.includes(evidenceType)) {
      if (!transactionKey) blockers.push(`C2_TRANSACTION_KEY_REQUIRED:${evidenceType}`);
      if (![MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD, MARKET_RESOLUTION_METHOD.OFFICIAL_REGISTERED_CONTRACT].includes(resolutionMethod)) {
        blockers.push(`C2_CLOSED_TRANSACTION_RESOLUTION_REQUIRED:${evidenceType}`);
      }
      if (hasNormalizedValue && normalizedValueHash && deriveComparableMetric(evidenceType, record.normalizedValue) === null) {
        blockers.push(`C2_COMPARABLE_METRIC_REQUIRED:${evidenceType}`);
      }
    } else if (AGGREGATE_TYPES.includes(evidenceType)) {
      if (!seriesKey) blockers.push(`C2_SERIES_KEY_REQUIRED:${evidenceType}`);
      if (!periodKey) blockers.push(`C2_PERIOD_KEY_REQUIRED:${evidenceType}`);
      if (![MARKET_RESOLUTION_METHOD.OFFICIAL_PUBLISHED_INDICATOR, MARKET_RESOLUTION_METHOD.OFFICIAL_AGGREGATED_MARKET_DATA].includes(resolutionMethod)) {
        blockers.push(`C2_OFFICIAL_AGGREGATE_RESOLUTION_REQUIRED:${evidenceType}`);
      }
    }
  } else if (asking) {
    if (!sourceReference) warnings.push(`C2_SUPPLEMENTAL_SOURCE_REFERENCE_MISSING:${evidenceType}`);
    if (!sourceUrl) warnings.push(`C2_SUPPLEMENTAL_SOURCE_URL_MISSING:${evidenceType}`);
    else if (!isHttpUrl(sourceUrl)) blockers.push(`C2_SUPPLEMENTAL_SOURCE_URL_INVALID:${evidenceType}`);
    if (![MARKET_RESOLUTION_METHOD.COMMERCIAL_LISTING, MARKET_RESOLUTION_METHOD.USER_SUPPLIED].includes(resolutionMethod)) {
      blockers.push(`C2_ASKING_RESOLUTION_REQUIRED:${evidenceType}`);
    }
    if (verificationStatus === MARKET_VERIFICATION_STATUS.VERIFIED) warnings.push(`C2_ASKING_VERIFIED_DOES_NOT_CREATE_AUTHORITY:${evidenceType}`);
  }

  return {
    authoritative,
    asking,
    blockers,
    warnings,
    normalized: Object.freeze({
      id: id || null,
      marketContextId: marketContextId || null,
      geographyKey: geographyKey || null,
      assetType: assetType || null,
      evidenceType: evidenceType || null,
      evidenceClass: evidenceClass || null,
      normalizedValue: hasNormalizedValue ? record.normalizedValue : null,
      normalizedValueHash,
      sourceId: sourceId || null,
      sourceReference: sourceReference || null,
      sourceUrl: sourceUrl || null,
      transactionKey: transactionKey || null,
      seriesKey: seriesKey || null,
      periodKey: periodKey || null,
      resolutionMethod: resolutionMethod || null,
      verificationStatus: verificationStatus || null,
      verifiedBy: verifiedBy || null,
      verificationReference: verificationReference || null,
      freshnessPolicyId: freshnessPolicyId || null,
      effectiveAt: effectiveAtMs === null ? null : new Date(effectiveAtMs).toISOString(),
      observedAt: observedAtMs === null ? null : new Date(observedAtMs).toISOString(),
      validUntil: validUntilMs === null ? null : new Date(validUntilMs).toISOString(),
      comparableMetricSarSqm: authoritative ? deriveComparableMetric(evidenceType, record.normalizedValue) : null,
      blockers: Object.freeze([...blockers]),
      warnings: Object.freeze([...warnings]),
    }),
  };
}

function evaluateMarketEvidenceBundle({
  marketContextId,
  geographyKey,
  assetType,
  evidenceRecords,
  asOf = new Date(),
  requiredEvidenceTypes = DEFAULT_REQUIRED_MARKET_EVIDENCE_TYPES,
  trustedVerifierIds = [],
  governedFreshnessPolicyIds = [],
  minimumCountPolicyId,
  governedMinimumCountPolicies = {},
} = {}) {
  const contextId = cleanString(marketContextId);
  const geography = cleanString(geographyKey);
  const asset = cleanString(assetType);
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) throw new TypeError('asOf must be a valid date');
  if (!Array.isArray(requiredEvidenceTypes) || requiredEvidenceTypes.some((type) => !AUTHORITATIVE_TYPES.includes(type))) {
    throw new TypeError('requiredEvidenceTypes must contain only authoritative market evidence types');
  }
  const trustedVerifiers = cleanStringArray(trustedVerifierIds, 'trustedVerifierIds');
  const freshnessPolicies = cleanStringArray(governedFreshnessPolicyIds, 'governedFreshnessPolicyIds');
  const policy = validateMinimumPolicy(requiredEvidenceTypes, minimumCountPolicyId, governedMinimumCountPolicies);

  const decisionBlockers = [...policy.blockers];
  const warnings = [];
  if (!contextId) decisionBlockers.push('C2_MARKET_CONTEXT_ID_REQUIRED');
  if (!geography) decisionBlockers.push('C2_GEOGRAPHY_KEY_REQUIRED');
  if (!asset) decisionBlockers.push('C2_ASSET_TYPE_REQUIRED');
  if (!Array.isArray(evidenceRecords)) decisionBlockers.push('C2_EVIDENCE_RECORDS_ARRAY_REQUIRED');

  const records = Array.isArray(evidenceRecords) ? evidenceRecords : [];
  const findings = records.map((record) => evaluateRecord(record, {
    marketContextId: contextId,
    geographyKey: geography,
    assetType: asset,
    asOfMs,
    trustedVerifierIds: trustedVerifiers,
    governedFreshnessPolicyIds: freshnessPolicies,
  }));

  const authoritativeEligible = findings.filter((item) => item.authoritative && item.blockers.length === 0);
  const supplemental = findings.filter((item) => item.asking && item.blockers.length === 0).map((item) => item.normalized);
  findings.forEach((finding) => warnings.push(...finding.warnings));

  const conflictKeys = new Set();
  const groups = new Map();
  for (const finding of authoritativeEligible) {
    const r = finding.normalized;
    const key = r.transactionKey
      ? `TX:${r.evidenceType}:${r.transactionKey}`
      : `SERIES:${r.evidenceType}:${r.seriesKey}:${r.periodKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const deduped = [];
  for (const [key, group] of groups.entries()) {
    const hashes = [...new Set(group.map((r) => r.normalizedValueHash))];
    if (hashes.length > 1) {
      conflictKeys.add(key);
      decisionBlockers.push(`C2_EVIDENCE_CONFLICT:${key}`);
      continue;
    }
    deduped.push(Object.freeze({
      ...group[0],
      corroboratingSourceIds: Object.freeze([...new Set(group.map((r) => r.sourceId))]),
      corroboratingEvidenceIds: Object.freeze(group.map((r) => r.id)),
      sourceCount: [...new Set(group.map((r) => r.sourceId))].length,
    }));
  }

  for (const type of requiredEvidenceTypes) {
    const requiredMinimum = policy.minimumByEvidenceType[type];
    const count = deduped.filter((r) => r.evidenceType === type).length;
    if (Number.isInteger(requiredMinimum) && count < requiredMinimum) {
      decisionBlockers.push(`C2_MINIMUM_COMPARABLES_NOT_MET:${type}:${count}/${requiredMinimum}`);
    }
  }

  const saleMetrics = deduped
    .filter((r) => r.evidenceType === MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION && isPositiveFinite(r.comparableMetricSarSqm))
    .map((r) => r.comparableMetricSarSqm);
  const rentMetrics = deduped
    .filter((r) => r.evidenceType === MARKET_EVIDENCE_TYPE.CLOSED_RENT_TRANSACTION && isPositiveFinite(r.comparableMetricSarSqm))
    .map((r) => r.comparableMetricSarSqm);

  const uniqueBlockers = [...new Set(decisionBlockers)];
  const status = uniqueBlockers.length ? MARKET_GATE_STATUS.HOLD_EVIDENCE : MARKET_GATE_STATUS.READY;

  return Object.freeze({
    version: C2_MARKET_EVIDENCE_GOVERNANCE_VERSION,
    schemaVersion: C2_MARKET_EVIDENCE_SCHEMA_VERSION,
    sourceRegistryVersion: OFFICIAL_MARKET_SOURCE_REGISTRY_VERSION,
    marketContextId: contextId || null,
    geographyKey: geography || null,
    assetType: asset || null,
    asOf: new Date(asOfMs).toISOString(),
    status,
    decisionReady: status === MARKET_GATE_STATUS.READY,
    requiredEvidenceTypes: Object.freeze([...requiredEvidenceTypes]),
    minimumCountPolicy: Object.freeze({
      policyId: policy.policyId,
      minimumByEvidenceType: Object.freeze({ ...policy.minimumByEvidenceType }),
    }),
    authoritativeEvidence: Object.freeze(deduped),
    supplementalAskingEvidence: Object.freeze(supplemental),
    distributions: Object.freeze({
      closedSalePricePerSqmSar: Object.freeze({ count: saleMetrics.length, min: saleMetrics.length ? Math.min(...saleMetrics) : null, median: median(saleMetrics), max: saleMetrics.length ? Math.max(...saleMetrics) : null }),
      closedAnnualRentPerSqmSar: Object.freeze({ count: rentMetrics.length, min: rentMetrics.length ? Math.min(...rentMetrics) : null, median: median(rentMetrics), max: rentMetrics.length ? Math.max(...rentMetrics) : null }),
    }),
    conflictKeys: Object.freeze([...conflictKeys]),
    records: Object.freeze(findings.map((item) => item.normalized).filter(Boolean)),
    blockers: Object.freeze(uniqueBlockers),
    warnings: Object.freeze([...new Set(warnings)]),
    askingEvidenceIncludedInAuthoritativeDistribution: false,
    professionalValuationOpinion: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C2 keeps authoritative closed transactions and official market aggregates separate from asking/listing evidence; requires evaluator-supplied governed policy registries, provenance, trust, freshness, effective dates and exact market-context matching; deduplicates exact corroboration and fails closed on same-key conflicts. It does not create a certified valuation, infer machine-access or licensing rights, or authorize a transaction.',
  });
}

module.exports = {
  C2_MARKET_EVIDENCE_GOVERNANCE_VERSION,
  evaluateMarketEvidenceBundle,
};
