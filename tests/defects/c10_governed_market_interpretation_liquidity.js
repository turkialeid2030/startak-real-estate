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
  evaluateMarketEvidenceBundle,
} = require('../../src/market/market-evidence-governance');
const {
  POLICY_VERSION,
  MARKET_INTERPRETATION_STATUS,
  MARKET_INTERPRETATION_DIMENSION,
  computeMarketEvidenceHash,
  computeMarketInterpretationPolicyHash,
  evaluateGovernedMarketInterpretation,
} = require('../../src/market/governed-market-interpretation');

const AS_OF = '2026-09-30T19:00:00.000Z';
const MARKET_CONTEXT_ID = 'c10-riyadh-office-market-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const ASSET_TYPE = 'OFFICE';
const TRUSTED_VERIFIER = 'C10-TEST-VERIFIER';
const FRESHNESS_POLICY = 'C10-TEST-FRESHNESS';
const MINIMUM_POLICY = 'C10-TEST-MINIMUM';
const INTERPRETATION_POLICY = 'C10-TEST-INTERPRETATION-POLICY';

const GOVERNED_MINIMUM_POLICIES = Object.freeze({
  [MINIMUM_POLICY]: Object.freeze({
    [MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR]: 1,
    [MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX]: 1,
  }),
});

function liquidityRecord(overrides = {}) {
  return {
    id: 'c10-liquidity-2026-q3',
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_AGGREGATE,
    normalizedValue: { turnoverRatePct: 5, unit: 'PERCENT' },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: 'REGA-LIQUIDITY-2026-Q3',
    sourceUrl: 'https://rei.rega.gov.sa/ar',
    seriesKey: 'REGA-OFFICE-LIQUIDITY-RIYADH',
    periodKey: '2026-Q3',
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_PUBLISHED_INDICATOR,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: TRUSTED_VERIFIER,
    verificationReference: 'C10-VERIFY-LIQUIDITY-2026-Q3',
    freshnessPolicyId: FRESHNESS_POLICY,
    effectiveAt: '2026-09-29T10:00:00.000Z',
    observedAt: '2026-09-30T10:00:00.000Z',
    validUntil: '2026-10-31T23:59:59.000Z',
    ...overrides,
  };
}

function saleIndexRecord(overrides = {}) {
  return {
    id: 'c10-sale-index-2026-q3',
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_AGGREGATE,
    normalizedValue: { yearOnYearChangePct: 3.5, unit: 'PERCENT' },
    sourceId: 'GASTAT_REAL_ESTATE_INDICES',
    sourceReference: 'GASTAT-REPI-2026-Q3',
    sourceUrl: 'https://www.stats.gov.sa/',
    seriesKey: 'GASTAT-REPI-OFFICE-RIYADH',
    periodKey: '2026-Q3',
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_PUBLISHED_INDICATOR,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: TRUSTED_VERIFIER,
    verificationReference: 'C10-VERIFY-INDEX-2026-Q3',
    freshnessPolicyId: FRESHNESS_POLICY,
    effectiveAt: '2026-09-29T10:00:00.000Z',
    observedAt: '2026-09-30T10:00:00.000Z',
    validUntil: '2026-10-31T23:59:59.000Z',
    ...overrides,
  };
}

function askingRecord(overrides = {}) {
  return {
    id: 'c10-asking-1',
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.ASKING_SALE_LISTING,
    evidenceClass: MARKET_EVIDENCE_CLASS.SUPPLEMENTAL_ASKING,
    normalizedValue: { turnoverRatePct: 99, unit: 'PERCENT' },
    sourceId: 'COMMERCIAL-LISTING-SITE',
    sourceReference: 'LISTING-C10-1',
    sourceUrl: 'https://example.com/listing/c10-1',
    resolutionMethod: MARKET_RESOLUTION_METHOD.COMMERCIAL_LISTING,
    verificationStatus: MARKET_VERIFICATION_STATUS.UNVERIFIED,
    observedAt: '2026-09-30T10:00:00.000Z',
    ...overrides,
  };
}

function marketInput(evidenceRecords = [liquidityRecord(), saleIndexRecord()], overrides = {}) {
  return {
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceRecords,
    asOf: AS_OF,
    requiredEvidenceTypes: [
      MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
      MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
    ],
    trustedVerifierIds: [TRUSTED_VERIFIER],
    governedFreshnessPolicyIds: [FRESHNESS_POLICY],
    minimumCountPolicyId: MINIMUM_POLICY,
    governedMinimumCountPolicies: GOVERNED_MINIMUM_POLICIES,
    ...overrides,
  };
}

function defaultRules() {
  return [
    {
      ruleId: 'LIQUIDITY-TURNOVER',
      dimension: MARKET_INTERPRETATION_DIMENSION.LIQUIDITY,
      evidenceId: 'c10-liquidity-2026-q3',
      evidenceType: MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
      metricField: 'turnoverRatePct',
      unitField: 'unit',
      expectedUnit: 'PERCENT',
      bands: [
        { bandId: 'LOW', label: 'LOW_LIQUIDITY', minInclusive: null, maxExclusive: 5 },
        { bandId: 'BALANCED', label: 'BALANCED_LIQUIDITY', minInclusive: 5, maxExclusive: 10 },
        { bandId: 'HIGH', label: 'HIGH_LIQUIDITY', minInclusive: 10, maxExclusive: null },
      ],
    },
    {
      ruleId: 'SALE-YOY-MOVEMENT',
      dimension: MARKET_INTERPRETATION_DIMENSION.SALE_MARKET_MOVEMENT,
      evidenceId: 'c10-sale-index-2026-q3',
      evidenceType: MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
      metricField: 'yearOnYearChangePct',
      unitField: 'unit',
      expectedUnit: 'PERCENT',
      bands: [
        { bandId: 'DECLINING', label: 'DECLINING', minInclusive: null, maxExclusive: 0 },
        { bandId: 'STABLE_TO_GROWING', label: 'STABLE_TO_GROWING', minInclusive: 0, maxExclusive: 5 },
        { bandId: 'STRONG_GROWTH', label: 'STRONG_GROWTH', minInclusive: 5, maxExclusive: null },
      ],
    },
  ];
}

function buildPolicy(input = marketInput(), overrides = {}) {
  const upstream = evaluateMarketEvidenceBundle(input);
  assert.equal(upstream.status, MARKET_GATE_STATUS.READY, 'test policy requires C2-ready upstream evidence');
  const core = {
    version: POLICY_VERSION,
    policyId: INTERPRETATION_POLICY,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    marketEvidenceHash: computeMarketEvidenceHash(upstream),
    reviewedBy: 'C10-TEST-PROFESSIONAL-REVIEWER',
    reviewReference: 'C10-POLICY-REVIEW-001',
    reviewedAt: '2026-09-30T18:00:00.000Z',
    rules: defaultRules(),
    ...overrides,
  };
  return { ...core, policyHash: computeMarketInterpretationPolicyHash(core) };
}

function evaluate(input = marketInput(), policy = buildPolicy(input), registryOverrides = null) {
  const registry = registryOverrides || { [INTERPRETATION_POLICY]: policy };
  return evaluateGovernedMarketInterpretation({
    marketEvidenceInput: input,
    interpretationPolicyId: INTERPRETATION_POLICY,
    governedInterpretationPolicies: registry,
  });
}

const baseInput = marketInput();
const basePolicy = buildPolicy(baseInput);
const ready = evaluate(baseInput, basePolicy);
assert.equal(ready.status, MARKET_INTERPRETATION_STATUS.READY_FOR_PROFESSIONAL_MARKET_REVIEW);
assert.equal(ready.professionalReviewReady, true);
assert.equal(ready.interpretations.length, 2);
assert.equal(ready.interpretations[0].classification, 'BALANCED_LIQUIDITY');
assert.equal(ready.interpretations[0].value, 5);
assert.equal(ready.interpretations[0].thresholdSemantics, '[minInclusive,maxExclusive)');
assert.equal(ready.interpretations[0].lineage.sourceId, 'REGA_REAL_ESTATE_INDICATORS');
assert.equal(ready.interpretations[1].classification, 'STABLE_TO_GROWING');
assert.equal(ready.certifiedValuationEstablished, false);
assert.equal(ready.professionalValuationOpinion, false);
assert.equal(ready.automaticUnderwritingAdoption, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.approvalAuthorized, false);
assert.equal(ready.decisionBinding, false);
assert.equal(ready.productionAuthorityGranted, false);
assert.equal(ready.publicAiAuthorized, false);
assert.equal(ready.commercialGoLiveAuthorized, false);
assert.equal(ready.compositeScoreCreated, false);
assert.equal(ready.forecastCreated, false);

const repeat1 = evaluate(baseInput, basePolicy);
const repeat2 = evaluate(baseInput, basePolicy);
assert.equal(JSON.stringify(repeat1), JSON.stringify(repeat2), 'C10 must be deterministic for identical inputs');

const missingPolicyId = evaluateGovernedMarketInterpretation({
  marketEvidenceInput: baseInput,
  governedInterpretationPolicies: { [INTERPRETATION_POLICY]: basePolicy },
});
assert.equal(missingPolicyId.status, MARKET_INTERPRETATION_STATUS.HOLD_POLICY);
assert.ok(missingPolicyId.blockers.includes('C10_GOVERNED_POLICY_ID_REQUIRED'));

const missingRegistryPolicy = evaluateGovernedMarketInterpretation({
  marketEvidenceInput: baseInput,
  interpretationPolicyId: INTERPRETATION_POLICY,
  governedInterpretationPolicies: {},
});
assert.equal(missingRegistryPolicy.status, MARKET_INTERPRETATION_STATUS.HOLD_POLICY);
assert.ok(missingRegistryPolicy.blockers.includes(`C10_GOVERNED_POLICY_NOT_FOUND:${INTERPRETATION_POLICY}`));

const staleInput = marketInput([
  liquidityRecord({ validUntil: '2026-09-30T18:59:59.000Z' }),
  saleIndexRecord(),
]);
const staleHeld = evaluateGovernedMarketInterpretation({
  marketEvidenceInput: staleInput,
  interpretationPolicyId: INTERPRETATION_POLICY,
  governedInterpretationPolicies: { [INTERPRETATION_POLICY]: basePolicy },
});
assert.equal(staleHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_UPSTREAM_EVIDENCE);
assert.ok(staleHeld.blockers.includes('C10_UPSTREAM_MARKET_EVIDENCE_NOT_READY'));
assert.ok(staleHeld.blockers.some((item) => item.includes('C2_EVIDENCE_STALE:MARKET_LIQUIDITY_INDICATOR')));

const conflictInput = marketInput([
  liquidityRecord(),
  liquidityRecord({
    id: 'c10-liquidity-conflict',
    normalizedValue: { turnoverRatePct: 8, unit: 'PERCENT' },
    sourceReference: 'REGA-LIQUIDITY-CONFLICT',
    verificationReference: 'C10-VERIFY-LIQUIDITY-CONFLICT',
  }),
  saleIndexRecord(),
]);
const conflictUpstream = evaluateMarketEvidenceBundle(conflictInput);
assert.equal(conflictUpstream.status, MARKET_GATE_STATUS.HOLD_EVIDENCE);
const conflictHeld = evaluateGovernedMarketInterpretation({
  marketEvidenceInput: conflictInput,
  interpretationPolicyId: INTERPRETATION_POLICY,
  governedInterpretationPolicies: { [INTERPRETATION_POLICY]: basePolicy },
});
assert.equal(conflictHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_UPSTREAM_EVIDENCE);
assert.ok(conflictHeld.blockers.some((item) => item.includes('C2_EVIDENCE_CONFLICT:SERIES:MARKET_LIQUIDITY_INDICATOR')));

const missingEvidencePolicy = buildPolicy(baseInput, {
  rules: [{ ...defaultRules()[0], evidenceId: 'not-present-authoritative-evidence' }],
});
const missingEvidenceHeld = evaluate(baseInput, missingEvidencePolicy);
assert.equal(missingEvidenceHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_EVIDENCE_BINDING);
assert.ok(missingEvidenceHeld.blockers.includes('C10_AUTHORITATIVE_EVIDENCE_NOT_FOUND:LIQUIDITY-TURNOVER:not-present-authoritative-evidence'));

const wrongTypePolicy = buildPolicy(baseInput, {
  rules: [{
    ...defaultRules()[1],
    evidenceId: 'c10-liquidity-2026-q3',
  }],
});
const wrongTypeHeld = evaluate(baseInput, wrongTypePolicy);
assert.equal(wrongTypeHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_EVIDENCE_BINDING);
assert.ok(wrongTypeHeld.blockers.includes('C10_EVIDENCE_TYPE_MISMATCH:SALE-YOY-MOVEMENT:MARKET_LIQUIDITY_INDICATOR:SALE_PRICE_INDEX'));

const nonNumericInput = marketInput([
  liquidityRecord({ normalizedValue: { turnoverRatePct: '5', unit: 'PERCENT' } }),
  saleIndexRecord(),
]);
const nonNumericPolicy = buildPolicy(nonNumericInput);
const nonNumericHeld = evaluate(nonNumericInput, nonNumericPolicy);
assert.equal(nonNumericHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_METRIC);
assert.ok(nonNumericHeld.blockers.includes('C10_METRIC_FINITE_NUMBER_REQUIRED:LIQUIDITY-TURNOVER:turnoverRatePct'));

const wrongUnitInput = marketInput([
  liquidityRecord({ normalizedValue: { turnoverRatePct: 5, unit: 'RATIO' } }),
  saleIndexRecord(),
]);
const wrongUnitPolicy = buildPolicy(wrongUnitInput);
const wrongUnitHeld = evaluate(wrongUnitInput, wrongUnitPolicy);
assert.equal(wrongUnitHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_UNIT_COMPATIBILITY);
assert.ok(wrongUnitHeld.blockers.includes('C10_METRIC_UNIT_MISMATCH:LIQUIDITY-TURNOVER:RATIO:PERCENT'));

const tamperedPolicy = {
  ...basePolicy,
  rules: basePolicy.rules.map((rule, index) => index === 0
    ? { ...rule, bands: rule.bands.map((band, bandIndex) => bandIndex === 1 ? { ...band, label: 'TAMPERED' } : band) }
    : rule),
};
const tamperedHeld = evaluate(baseInput, tamperedPolicy);
assert.equal(tamperedHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_INTEGRITY);
assert.ok(tamperedHeld.blockers.includes('C10_POLICY_INTEGRITY_HASH_MISMATCH'));

const changedEvidenceInput = marketInput([
  liquidityRecord({ normalizedValue: { turnoverRatePct: 6, unit: 'PERCENT' } }),
  saleIndexRecord(),
]);
const changedEvidenceHeld = evaluate(changedEvidenceInput, basePolicy);
assert.equal(changedEvidenceHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_INTEGRITY);
assert.ok(changedEvidenceHeld.blockers.includes('C10_POLICY_MARKET_EVIDENCE_HASH_MISMATCH'));

const overlapPolicy = buildPolicy(baseInput, {
  rules: [{
    ...defaultRules()[0],
    bands: [
      { bandId: 'A', label: 'A', minInclusive: null, maxExclusive: 6 },
      { bandId: 'B', label: 'B', minInclusive: 5, maxExclusive: null },
    ],
  }],
});
const overlapHeld = evaluate(baseInput, overlapPolicy);
assert.equal(overlapHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_POLICY);
assert.ok(overlapHeld.blockers.some((item) => item.startsWith('C10_POLICY_BANDS_OVERLAP:LIQUIDITY-TURNOVER')));

const gapPolicy = buildPolicy(baseInput, {
  rules: [{
    ...defaultRules()[0],
    bands: [
      { bandId: 'A', label: 'A', minInclusive: null, maxExclusive: 4 },
      { bandId: 'B', label: 'B', minInclusive: 6, maxExclusive: null },
    ],
  }],
});
const gapHeld = evaluate(baseInput, gapPolicy);
assert.equal(gapHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_METRIC);
assert.ok(gapHeld.blockers.includes('C10_METRIC_BAND_RESOLUTION_FAILED:LIQUIDITY-TURNOVER:0'));

const askingInput = marketInput([liquidityRecord(), saleIndexRecord(), askingRecord()]);
const askingPolicy = buildPolicy(askingInput, {
  rules: [{ ...defaultRules()[0], evidenceId: 'c10-asking-1' }],
});
const askingHeld = evaluate(askingInput, askingPolicy);
assert.equal(askingHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_EVIDENCE_BINDING);
assert.ok(askingHeld.blockers.includes('C10_AUTHORITATIVE_EVIDENCE_NOT_FOUND:LIQUIDITY-TURNOVER:c10-asking-1'));
assert.equal(askingHeld.askingEvidenceCreatesAuthority, false);

const ungatedInput = marketInput([liquidityRecord(), saleIndexRecord()], {
  requiredEvidenceTypes: [MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX],
  governedMinimumCountPolicies: {
    [MINIMUM_POLICY]: { [MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX]: 1 },
  },
});
const ungatedPolicy = buildPolicy(ungatedInput, { rules: [defaultRules()[0]] });
const ungatedHeld = evaluate(ungatedInput, ungatedPolicy);
assert.equal(ungatedHeld.status, MARKET_INTERPRETATION_STATUS.HOLD_EVIDENCE_BINDING);
assert.ok(ungatedHeld.blockers.includes('C10_EVIDENCE_TYPE_NOT_GATED_UPSTREAM:LIQUIDITY-TURNOVER:MARKET_LIQUIDITY_INDICATOR'));

console.log('PASS c10_governed_market_interpretation_liquidity');
