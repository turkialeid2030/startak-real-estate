'use strict';

const assert = require('assert/strict');
const {
  MARKET_EVIDENCE_TYPE,
  MARKET_EVIDENCE_CLASS,
  MARKET_VERIFICATION_STATUS,
  MARKET_RESOLUTION_METHOD,
  MARKET_GATE_STATUS,
} = require('../../src/contracts/market-evidence');
const {
  OFFICIAL_MARKET_SOURCE_REGISTRY,
  marketSourceSupportsEvidenceType,
  officialMarketUrlMatchesSource,
} = require('../../src/market/official-market-source-registry');
const {
  evaluateMarketEvidenceBundle,
} = require('../../src/market/market-evidence-governance');

const AS_OF = '2026-09-29T18:00:00.000Z';
const MARKET_CONTEXT_ID = 'riyadh-office-sale-study-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const ASSET_TYPE = 'OFFICE';
const TRUSTED_VERIFIER = 'C2-TEST-VERIFIER';
const FRESHNESS_POLICY = 'C2-TEST-FRESHNESS';
const MINIMUM_POLICY = 'C2-TEST-MINIMUM-COMPS';

function minimumCountPolicy(count = 3) {
  return {
    policyId: MINIMUM_POLICY,
    minimumByEvidenceType: {
      [MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION]: count,
    },
  };
}

function evaluate(evidenceRecords, options = {}) {
  return evaluateMarketEvidenceBundle({
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceRecords,
    asOf: AS_OF,
    trustedVerifierIds: [TRUSTED_VERIFIER],
    governedFreshnessPolicyIds: [FRESHNESS_POLICY],
    governedMinimumCountPolicyIds: [MINIMUM_POLICY],
    minimumCountPolicy: minimumCountPolicy(),
    ...options,
  });
}

function saleRecord(index, overrides = {}) {
  const amountSar = [1000000, 1200000, 800000, 1100000][index - 1] || 1000000;
  return {
    id: `c2-sale-${index}`,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION,
    normalizedValue: { amountSar, areaSqm: 100 },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: `REGA-SALE-${index}`,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    transactionKey: `SALE-${index}`,
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: TRUSTED_VERIFIER,
    verificationReference: `C2-VERIFY-${index}`,
    freshnessPolicyId: FRESHNESS_POLICY,
    observedAt: '2026-09-29T12:00:00.000Z',
    validUntil: '2026-10-29T12:00:00.000Z',
    ...overrides,
  };
}

function threeSales() {
  return [saleRecord(1), saleRecord(2), saleRecord(3)];
}

assert.equal(marketSourceSupportsEvidenceType('REGA_REAL_ESTATE_INDICATORS', MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION), true);
assert.equal(marketSourceSupportsEvidenceType('GASTAT_REAL_ESTATE_INDICES', MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION), false);
assert.equal(officialMarketUrlMatchesSource('REGA_REAL_ESTATE_INDICATORS', 'https://rei.rega.gov.sa/ar'), true);
assert.equal(officialMarketUrlMatchesSource('REGA_REAL_ESTATE_INDICATORS', 'https://example.com/fake'), false);
for (const source of Object.values(OFFICIAL_MARKET_SOURCE_REGISTRY)) {
  assert.equal(source.productionAdapterEnabled, false, `${source.id}: production adapter must remain disabled in C2 Phase 0`);
}

const noMinimumPolicy = evaluateMarketEvidenceBundle({
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceRecords: threeSales(),
  asOf: AS_OF,
  trustedVerifierIds: [TRUSTED_VERIFIER],
  governedFreshnessPolicyIds: [FRESHNESS_POLICY],
});
assert.equal(noMinimumPolicy.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(noMinimumPolicy.blockers.includes('C2_MINIMUM_COUNT_POLICY_ID_REQUIRED'));
assert.ok(noMinimumPolicy.blockers.includes('C2_MINIMUM_COUNT_POLICY_MAP_REQUIRED'));

const inventedMinimumPolicy = evaluate(threeSales(), {
  governedMinimumCountPolicyIds: [],
});
assert.equal(inventedMinimumPolicy.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(inventedMinimumPolicy.blockers.includes(`C2_MINIMUM_COUNT_POLICY_NOT_GOVERNED:${MINIMUM_POLICY}`));

const empty = evaluate([]);
assert.equal(empty.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.equal(empty.decisionReady, false);
assert.ok(empty.blockers.includes('C2_MINIMUM_COMPARABLES_NOT_MET:CLOSED_SALE_TRANSACTION:0/3'));
assert.equal(empty.professionalValuationOpinion, false);
assert.equal(empty.transactionAuthorized, false);
assert.equal(empty.publicAiAuthorized, false);

const ready = evaluate(threeSales());
assert.equal(ready.status, MARKET_GATE_STATUS.READY);
assert.equal(ready.decisionReady, true);
assert.equal(ready.authoritativeEvidence.length, 3);
assert.equal(ready.distributions.closedSalePricePerSqmSar.count, 3);
assert.equal(ready.distributions.closedSalePricePerSqmSar.min, 8000);
assert.equal(ready.distributions.closedSalePricePerSqmSar.median, 10000);
assert.equal(ready.distributions.closedSalePricePerSqmSar.max, 12000);
assert.equal(ready.askingEvidenceIncludedInAuthoritativeDistribution, false);
assert.equal(ready.professionalValuationOpinion, false);
assert.equal(ready.transactionAuthorized, false);

const asking = {
  id: 'c2-asking-1',
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceType: MARKET_EVIDENCE_TYPE.ASKING_SALE_LISTING,
  evidenceClass: MARKET_EVIDENCE_CLASS.SUPPLEMENTAL_ASKING,
  normalizedValue: { askingAmountSar: 9000000, areaSqm: 100 },
  sourceId: 'COMMERCIAL-LISTING-SITE',
  sourceReference: 'LISTING-001',
  sourceUrl: 'https://example.com/listing/001',
  resolutionMethod: MARKET_RESOLUTION_METHOD.COMMERCIAL_LISTING,
  verificationStatus: MARKET_VERIFICATION_STATUS.UNVERIFIED,
  observedAt: '2026-09-29T12:00:00.000Z',
};
const withAsking = evaluate([...threeSales(), asking]);
assert.equal(withAsking.status, MARKET_GATE_STATUS.READY);
assert.equal(withAsking.authoritativeEvidence.length, 3);
assert.equal(withAsking.supplementalAskingEvidence.length, 1);
assert.equal(withAsking.distributions.closedSalePricePerSqmSar.median, 10000);
assert.equal(withAsking.askingEvidenceIncludedInAuthoritativeDistribution, false);

assert.throws(() => evaluateMarketEvidenceBundle({
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceRecords: [asking],
  requiredEvidenceTypes: [MARKET_EVIDENCE_TYPE.ASKING_SALE_LISTING],
}), /requiredEvidenceTypes/);

const untrusted = threeSales();
untrusted[0] = { ...untrusted[0], verifiedBy: 'CALLER-INVENTED-VERIFIER' };
const untrustedHeld = evaluate(untrusted);
assert.equal(untrustedHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(untrustedHeld.records[0].blockers.includes('C2_UNTRUSTED_VERIFIER:CLOSED_SALE_TRANSACTION'));
assert.ok(untrustedHeld.blockers.includes('C2_MINIMUM_COMPARABLES_NOT_MET:CLOSED_SALE_TRANSACTION:2/3'));

const wrongGeography = threeSales();
wrongGeography[1] = { ...wrongGeography[1], geographyKey: 'SA-JEDDAH-OTHER' };
const geographyHeld = evaluate(wrongGeography);
assert.equal(geographyHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(geographyHeld.records[1].blockers.includes('C2_GEOGRAPHY_MISMATCH:CLOSED_SALE_TRANSACTION'));
assert.ok(geographyHeld.blockers.includes('C2_MINIMUM_COMPARABLES_NOT_MET:CLOSED_SALE_TRANSACTION:2/3'));

const stale = threeSales();
stale[2] = { ...stale[2], validUntil: '2026-09-28T23:00:00.000Z' };
const staleHeld = evaluate(stale);
assert.equal(staleHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(staleHeld.records[2].blockers.includes('C2_EVIDENCE_STALE:CLOSED_SALE_TRANSACTION'));

const scopeMismatch = threeSales();
scopeMismatch[0] = {
  ...scopeMismatch[0],
  sourceId: 'GASTAT_REAL_ESTATE_INDICES',
  sourceReference: 'GASTAT-INVALID-SALE',
  sourceUrl: 'https://www.stats.gov.sa/',
};
const scopeHeld = evaluate(scopeMismatch);
assert.equal(scopeHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(scopeHeld.records[0].blockers.includes('C2_SOURCE_SCOPE_MISMATCH:GASTAT_REAL_ESTATE_INDICES:CLOSED_SALE_TRANSACTION'));

const badDomain = threeSales();
badDomain[0] = { ...badDomain[0], sourceUrl: 'https://example.com/rega-lookalike' };
const domainHeld = evaluate(badDomain);
assert.equal(domainHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(domainHeld.records[0].blockers.includes('C2_OFFICIAL_SOURCE_URL_REQUIRED:REGA_REAL_ESTATE_INDICATORS'));

const cyclicValue = { amountSar: 1000000, areaSqm: 100 };
cyclicValue.self = cyclicValue;
const cyclic = threeSales();
cyclic[0] = { ...cyclic[0], normalizedValue: cyclicValue };
assert.doesNotThrow(() => evaluate(cyclic));
const cyclicHeld = evaluate(cyclic);
assert.equal(cyclicHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(cyclicHeld.records[0].blockers.includes('C2_NORMALIZED_VALUE_JSON_REQUIRED:CLOSED_SALE_TRANSACTION'));

const conflict = threeSales();
conflict.push(saleRecord(4, {
  id: 'c2-sale-conflict',
  transactionKey: 'SALE-1',
  normalizedValue: { amountSar: 1500000, areaSqm: 100 },
  sourceReference: 'REGA-SALE-CONFLICT',
  verificationReference: 'C2-VERIFY-CONFLICT',
}));
const conflictHeld = evaluate(conflict);
assert.equal(conflictHeld.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(conflictHeld.blockers.includes('C2_EVIDENCE_CONFLICT:TX:CLOSED_SALE_TRANSACTION:SALE-1'));
assert.ok(conflictHeld.blockers.includes('C2_MINIMUM_COMPARABLES_NOT_MET:CLOSED_SALE_TRANSACTION:2/3'));

const corroborated = threeSales();
corroborated.push(saleRecord(4, {
  id: 'c2-sale-corroboration',
  transactionKey: 'SALE-1',
  normalizedValue: { amountSar: 1000000, areaSqm: 100 },
  sourceId: 'REAL_ESTATE_REGISTRY_MARKET_RECORDS',
  sourceReference: 'RER-SALE-1',
  sourceUrl: 'https://www.rer.sa/',
  verificationReference: 'C2-VERIFY-RER-1',
}));
const corroboratedReady = evaluate(corroborated);
assert.equal(corroboratedReady.status, MARKET_GATE_STATUS.READY);
assert.equal(corroboratedReady.authoritativeEvidence.length, 3);
const sale1 = corroboratedReady.authoritativeEvidence.find((record) => record.transactionKey === 'SALE-1');
assert.equal(sale1.sourceCount, 2);
assert.deepEqual([...sale1.corroboratingSourceIds].sort(), ['REAL_ESTATE_REGISTRY_MARKET_RECORDS', 'REGA_REAL_ESTATE_INDICATORS'].sort());

console.log('C2_OFFICIAL_MARKET_EVIDENCE_COMPARABLES_FOUNDATION=PASS');
