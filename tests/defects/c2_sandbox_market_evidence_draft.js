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
  createSandboxMarketEvidenceDraft,
} = require('../../src/market/sandbox-market-evidence-draft');
const {
  evaluateMarketEvidenceBundle,
} = require('../../src/market/market-evidence-governance');

const MARKET_CONTEXT_ID = 'riyadh-office-sale-study-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const ASSET_TYPE = 'OFFICE';
const AS_OF = '2026-09-29T18:00:00.000Z';
const TRUSTED_VERIFIER = 'C2-TEST-VERIFIER';
const FRESHNESS_POLICY = 'C2-TEST-FRESHNESS';
const MINIMUM_POLICY = 'C2-TEST-MINIMUM-COMPS';

function verifiedSale(index) {
  return {
    id: `verified-${index}`,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION,
    normalizedValue: { amountSar: 1000000 + (index * 100000), areaSqm: 100 },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: `REGA-${index}`,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    transactionKey: `TX-${index}`,
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: TRUSTED_VERIFIER,
    verificationReference: `VERIFY-${index}`,
    freshnessPolicyId: FRESHNESS_POLICY,
    observedAt: '2026-09-29T12:00:00.000Z',
    validUntil: '2026-10-29T12:00:00.000Z',
  };
}

function evaluate(records) {
  return evaluateMarketEvidenceBundle({
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceRecords: records,
    asOf: AS_OF,
    trustedVerifierIds: [TRUSTED_VERIFIER],
    governedFreshnessPolicyIds: [FRESHNESS_POLICY],
    governedMinimumCountPolicyIds: [MINIMUM_POLICY],
    minimumCountPolicy: {
      policyId: MINIMUM_POLICY,
      minimumByEvidenceType: {
        [MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION]: 3,
      },
    },
  });
}

const draft = createSandboxMarketEvidenceDraft({
  id: 'sandbox-sale-1',
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
  normalizedValue: { amountSar: 950000, areaSqm: 100 },
  sourceId: 'REGA_REAL_ESTATE_INDICATORS',
  sourceReference: 'REGA-SANDBOX-1',
  sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
  transactionKey: 'TX-SANDBOX-1',
  observedAt: '2026-09-29T12:00:00.000Z',
  validUntil: '2026-10-29T12:00:00.000Z',
  freshnessPolicyId: FRESHNESS_POLICY,
});

assert.equal(draft.evidenceClass, MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION);
assert.equal(draft.verificationStatus, MARKET_VERIFICATION_STATUS.UNVERIFIED);
assert.equal(draft.resolutionMethod, MARKET_RESOLUTION_METHOD.USER_SUPPLIED);
assert.equal(draft.verifiedBy, null);
assert.equal(draft.verificationReference, null);
assert.equal(draft.sandboxOnly, true);
assert.equal(draft.productionConnectorUsed, false);
assert.equal(draft.decisionReady, false);
assert.equal(draft.professionalValuationOpinion, false);
assert.equal(draft.transactionAuthorized, false);
assert.equal(draft.publicAiAuthorized, false);

const held = evaluate([verifiedSale(1), verifiedSale(2), draft]);
assert.equal(held.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(held.records[2].blockers.includes('C2_VERIFIED_EVIDENCE_REQUIRED:CLOSED_SALE_TRANSACTION'));
assert.ok(held.records[2].blockers.includes('C2_CLOSED_TRANSACTION_RESOLUTION_REQUIRED:CLOSED_SALE_TRANSACTION'));
assert.ok(held.blockers.includes('C2_MINIMUM_COMPARABLES_NOT_MET:CLOSED_SALE_TRANSACTION:2/3'));

assert.throws(() => createSandboxMarketEvidenceDraft({
  ...draft,
  verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
}), /cannot set trust\/authority fields/);

assert.throws(() => createSandboxMarketEvidenceDraft({
  id: 'bad-url',
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
  normalizedValue: { amountSar: 1000000, areaSqm: 100 },
  sourceId: 'REGA_REAL_ESTATE_INDICATORS',
  sourceReference: 'REGA-BAD',
  sourceUrl: 'https://example.com/fake',
}), /does not match registered official domains/);

assert.throws(() => createSandboxMarketEvidenceDraft({
  id: 'bad-scope',
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
  normalizedValue: { amountSar: 1000000, areaSqm: 100 },
  sourceId: 'GASTAT_REAL_ESTATE_INDICES',
  sourceReference: 'GASTAT-BAD',
  sourceUrl: 'https://www.stats.gov.sa/',
}), /does not support evidence type/);

const askingDraft = createSandboxMarketEvidenceDraft({
  id: 'asking-draft',
  marketContextId: MARKET_CONTEXT_ID,
  geographyKey: GEOGRAPHY_KEY,
  assetType: ASSET_TYPE,
  evidenceType: MARKET_EVIDENCE_TYPE.ASKING_SALE_LISTING,
  normalizedValue: { askingAmountSar: 3000000, areaSqm: 100 },
  sourceId: 'COMMERCIAL-SITE',
  sourceReference: 'LISTING-22',
  sourceUrl: 'https://example.com/listing/22',
});
assert.equal(askingDraft.evidenceClass, MARKET_EVIDENCE_CLASS.SUPPLEMENTAL_ASKING);
assert.equal(askingDraft.verificationStatus, MARKET_VERIFICATION_STATUS.UNVERIFIED);
assert.equal(askingDraft.resolutionMethod, MARKET_RESOLUTION_METHOD.USER_SUPPLIED);
assert.equal(askingDraft.decisionReady, false);

const readyWithAsking = evaluate([verifiedSale(1), verifiedSale(2), verifiedSale(3), askingDraft]);
assert.equal(readyWithAsking.status, MARKET_GATE_STATUS.READY);
assert.equal(readyWithAsking.authoritativeEvidence.length, 3);
assert.equal(readyWithAsking.supplementalAskingEvidence.length, 1);
assert.equal(readyWithAsking.askingEvidenceIncludedInAuthoritativeDistribution, false);

console.log('C2_SANDBOX_MARKET_EVIDENCE_DRAFT=PASS');
