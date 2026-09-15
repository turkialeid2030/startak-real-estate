'use strict';

const assert = require('assert');
const {
  FRESHNESS_STATUS,
  evaluateDataFreshness,
  assertMaterialMarketIndicatorSource,
} = require('../../src/decision-governance/data-freshness');

const asOf = '2026-09-15T00:00:00.000Z';
let r = evaluateDataFreshness({ sourceName: 'Official', sourceDate: '2026-09-01' }, { asOf });
assert.strictEqual(r.freshnessStatus, FRESHNESS_STATUS.CURRENT);
assert.strictEqual(r.ageInDays, 14);
assert.strictEqual(r.materialMarketIndicatorAllowed, true);

r = evaluateDataFreshness({ sourceName: 'Official', sourceDate: '2026-07-31' }, { asOf });
assert.strictEqual(r.freshnessStatus, FRESHNESS_STATUS.AGING);

r = evaluateDataFreshness({ sourceName: 'Official', sourceDate: '2026-05-01' }, { asOf });
assert.strictEqual(r.freshnessStatus, FRESHNESS_STATUS.STALE);

r = evaluateDataFreshness({ sourceName: 'Official' }, { asOf });
assert.strictEqual(r.freshnessStatus, FRESHNESS_STATUS.UNKNOWN);
assert.strictEqual(r.materialMarketIndicatorAllowed, false);

assert.throws(
  () => assertMaterialMarketIndicatorSource({ sourceName: 'Official' }, { asOf }),
  (error) => error && error.code === 'MATERIAL_MARKET_SOURCE_DATE_REQUIRED',
);

r = assertMaterialMarketIndicatorSource({
  sourceName: 'Official', sourceType: 'REGISTRY', sourceDate: '2026-09-01', retrievedAt: asOf,
  reference: 'registry-ref', manualOrAutomated: 'MANUAL', verifiedBy: 'reviewer-id',
}, { asOf });
assert.strictEqual(r.sourceReference, 'registry-ref');
assert.strictEqual(r.verifiedBy, 'reviewer-id');

console.log('DATA_FRESHNESS_TESTS=PASS');
