'use strict';

const STATUS = Object.freeze({
  READY: 'READY_FOR_ANALYTICAL_REVIEW',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_POLICY: 'HOLD_POLICY',
});

function finiteNonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be finite and non-negative`);
  return value;
}

function normalizeHolding(h) {
  if (!h || typeof h !== 'object') throw new TypeError('holding is required');
  const holdingId = String(h.holdingId || '').trim();
  const projectId = String(h.projectId || '').trim();
  if (!holdingId || !projectId) throw new TypeError('holdingId and projectId are required');
  return Object.freeze({
    holdingId,
    projectId,
    exposure: finiteNonNegative(Number(h.exposure), 'exposure'),
    assetClass: h.assetClass ? String(h.assetClass) : 'UNCLASSIFIED',
    geography: h.geography ? String(h.geography) : 'UNCLASSIFIED',
    strategy: h.strategy ? String(h.strategy) : 'UNCLASSIFIED',
    evidenceReady: h.evidenceReady !== false,
    professionalReviewRequired: Boolean(h.professionalReviewRequired),
    decisionReliability: h.decisionReliability ? String(h.decisionReliability) : 'UNASSESSED',
  });
}

function aggregateBy(holdings, key) {
  const total = holdings.reduce((s, h) => s + h.exposure, 0);
  const m = new Map();
  for (const h of holdings) m.set(h[key], (m.get(h[key]) || 0) + h.exposure);
  return Object.freeze([...m.entries()].map(([bucket, exposure]) => Object.freeze({
    bucket,
    exposure,
    share: total > 0 ? exposure / total : 0,
  })).sort((a, b) => b.exposure - a.exposure));
}

function hhi(rows) {
  return rows.reduce((sum, row) => sum + row.share * row.share, 0);
}

function concentrationLevel(index, policy) {
  if (!policy) return 'NOT_ASSESSED';
  const moderate = Number(policy.moderateHhi);
  const high = Number(policy.highHhi);
  if (!Number.isFinite(moderate) || !Number.isFinite(high) || moderate < 0 || high <= moderate || high > 1) {
    throw new TypeError('invalid concentration policy');
  }
  if (index >= high) return 'HIGH';
  if (index >= moderate) return 'MODERATE';
  return 'LOW';
}

function buildPortfolioIntelligence({ portfolioId, holdings, concentrationPolicy = null } = {}) {
  const id = String(portfolioId || '').trim();
  if (!id) throw new TypeError('portfolioId is required');
  if (!Array.isArray(holdings) || holdings.length === 0) throw new TypeError('holdings must be non-empty');
  const normalized = holdings.map(normalizeHolding);
  const ids = new Set();
  for (const h of normalized) {
    if (ids.has(h.holdingId)) throw new Error(`DUPLICATE_HOLDING_ID: ${h.holdingId}`);
    ids.add(h.holdingId);
  }
  const totalExposure = normalized.reduce((sum, h) => sum + h.exposure, 0);
  if (!(totalExposure > 0)) return Object.freeze({ schemaVersion: 1, portfolioId: id, status: STATUS.HOLD_EVIDENCE, reasonCodes: Object.freeze(['ZERO_TOTAL_EXPOSURE']) });

  const assetClass = aggregateBy(normalized, 'assetClass');
  const geography = aggregateBy(normalized, 'geography');
  const strategy = aggregateBy(normalized, 'strategy');
  const indices = Object.freeze({ assetClass: hhi(assetClass), geography: hhi(geography), strategy: hhi(strategy) });
  const evidenceGapCount = normalized.filter((h) => !h.evidenceReady).length;
  let status = STATUS.READY;
  const reasonCodes = [];
  if (evidenceGapCount > 0) { status = STATUS.HOLD_EVIDENCE; reasonCodes.push('PORTFOLIO_CONTAINS_EVIDENCE_GAPS'); }
  else if (!concentrationPolicy) { status = STATUS.HOLD_POLICY; reasonCodes.push('CONCENTRATION_POLICY_NOT_SUPPLIED'); }

  return Object.freeze({
    schemaVersion: 1,
    portfolioId: id,
    status,
    reasonCodes: Object.freeze(reasonCodes),
    holdingCount: normalized.length,
    totalExposure,
    exposures: Object.freeze({ assetClass, geography, strategy }),
    concentrationHhi: indices,
    concentration: Object.freeze({
      assetClass: concentrationLevel(indices.assetClass, concentrationPolicy),
      geography: concentrationLevel(indices.geography, concentrationPolicy),
      strategy: concentrationLevel(indices.strategy, concentrationPolicy),
    }),
    evidenceGapCount,
    professionalReviewCount: normalized.filter((h) => h.professionalReviewRequired).length,
    unassessedReliabilityCount: normalized.filter((h) => h.decisionReliability === 'UNASSESSED').length,
    maxSingleHoldingShare: Math.max(...normalized.map((h) => h.exposure / totalExposure)),
    optimizerUsed: false,
    correlationsAssumed: false,
    semantics: 'Aggregates supplied holdings and explicit concentration policy only; no inferred correlations or allocation optimization.',
  });
}

module.exports = { STATUS, buildPortfolioIntelligence, aggregateBy, hhi, concentrationLevel };
