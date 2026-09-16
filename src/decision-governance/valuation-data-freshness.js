'use strict';

const { FRESHNESS_STATUS, evaluateDataFreshness } = require('./data-freshness');

const FRESHNESS_PRIORITY = Object.freeze({
  [FRESHNESS_STATUS.CURRENT]: 0,
  [FRESHNESS_STATUS.AGING]: 1,
  [FRESHNESS_STATUS.UNKNOWN]: 2,
  [FRESHNESS_STATUS.STALE]: 3,
});

function evidenceEntries(valuationCase) {
  if (!valuationCase || typeof valuationCase !== 'object' || Array.isArray(valuationCase)) return [];
  const evidence = valuationCase.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return [];
  return Object.entries(evidence).filter(([, descriptor]) => descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor));
}

function evaluateValuationEvidenceFreshness(valuationCase, options = {}) {
  const items = evidenceEntries(valuationCase).map(([field, descriptor]) => Object.freeze({
    field,
    grade: descriptor.grade || null,
    status: descriptor.status || null,
    ...evaluateDataFreshness({
      sourceName: descriptor.sourceType || field,
      sourceType: descriptor.sourceType || null,
      sourceDate: descriptor.observedAt || null,
      reference: descriptor.sourceRef || null,
      manualOrAutomated: 'MANUAL_EVIDENCE_ENTRY',
      verifiedBy: descriptor.status === 'VERIFIED' ? 'EVIDENCE_STATUS_VERIFIED' : null,
    }, options),
  }));

  const counts = Object.fromEntries(Object.values(FRESHNESS_STATUS).map((status) => [status, 0]));
  for (const item of items) counts[item.freshnessStatus] += 1;

  let overallStatus = FRESHNESS_STATUS.UNKNOWN;
  if (items.length > 0) {
    overallStatus = items.reduce((worst, item) => (
      FRESHNESS_PRIORITY[item.freshnessStatus] > FRESHNESS_PRIORITY[worst]
        ? item.freshnessStatus
        : worst
    ), FRESHNESS_STATUS.CURRENT);
  }

  return Object.freeze({
    status: overallStatus,
    counts: Object.freeze(counts),
    items: Object.freeze(items),
    evidenceCount: items.length,
    allMaterialSourcesDated: items.length > 0 && items.every((item) => item.materialMarketIndicatorAllowed),
    semantics: 'Freshness describes source age only; it does not upgrade evidence quality, legal validity, or valuation authority.',
  });
}

module.exports = { evaluateValuationEvidenceFreshness };
