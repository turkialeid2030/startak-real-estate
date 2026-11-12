'use strict';

const FRESHNESS_STATUS = Object.freeze({ CURRENT: 'CURRENT', AGING: 'AGING', STALE: 'STALE', UNKNOWN: 'UNKNOWN' });

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function ageInDays(sourceDate, asOf) {
  const source = parseDate(sourceDate);
  const now = parseDate(asOf);
  if (!source || !now) return null;
  // A future-dated source cannot be treated as zero-days-old/current evidence.
  // Refuse temporal inconsistencies rather than silently clamping negatives.
  if (source.getTime() > now.getTime()) return null;
  return Math.floor((now - source) / 86400000);
}

function evaluateDataFreshness(source = {}, { asOf = new Date().toISOString(), agingAfterDays = 30, staleAfterDays = 90 } = {}) {
  if (!Number.isFinite(agingAfterDays) || agingAfterDays < 0) throw new TypeError('agingAfterDays must be non-negative');
  if (!Number.isFinite(staleAfterDays) || staleAfterDays < agingAfterDays) throw new TypeError('staleAfterDays must be >= agingAfterDays');
  const age = ageInDays(source.sourceDate, asOf);
  let freshnessStatus = FRESHNESS_STATUS.UNKNOWN;
  if (age != null) {
    if (age > staleAfterDays) freshnessStatus = FRESHNESS_STATUS.STALE;
    else if (age > agingAfterDays) freshnessStatus = FRESHNESS_STATUS.AGING;
    else freshnessStatus = FRESHNESS_STATUS.CURRENT;
  }
  return Object.freeze({
    sourceName: source.sourceName || null,
    sourceType: source.sourceType || null,
    sourceDate: source.sourceDate || null,
    retrievedAt: source.retrievedAt || null,
    ageInDays: age,
    freshnessStatus,
    sourceReference: source.sourceUrl || source.reference || null,
    manualOrAutomated: source.manualOrAutomated || null,
    verifiedBy: source.verifiedBy || null,
    // Historical age is informative, but a stale/unknown indicator cannot
    // underpin a CURRENT market-value/rent claim or governed report export.
    materialMarketIndicatorAllowed: Boolean(source.sourceName && source.sourceDate &&
      (freshnessStatus === FRESHNESS_STATUS.CURRENT || freshnessStatus === FRESHNESS_STATUS.AGING)),
  });
}

function assertMaterialMarketIndicatorSource(source, options) {
  const result = evaluateDataFreshness(source, options);
  if (!result.materialMarketIndicatorAllowed) {
    const error = new Error('Material market indicator requires a named source and valid source date');
    error.code = 'MATERIAL_MARKET_SOURCE_DATE_REQUIRED';
    error.freshness = result;
    throw error;
  }
  return result;
}

module.exports = { FRESHNESS_STATUS, ageInDays, evaluateDataFreshness, assertMaterialMarketIndicatorSource };
