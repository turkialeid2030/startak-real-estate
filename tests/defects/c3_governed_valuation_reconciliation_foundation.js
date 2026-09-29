'use strict';

const assert = require('assert/strict');
const {
  GEOSPATIAL_EVIDENCE_TYPE,
  GEOSPATIAL_VERIFICATION_STATUS,
  GEOSPATIAL_RESOLUTION_METHOD,
} = require('../../src/contracts/geospatial-evidence');
const {
  MARKET_EVIDENCE_TYPE,
  MARKET_EVIDENCE_CLASS,
  MARKET_VERIFICATION_STATUS,
  MARKET_RESOLUTION_METHOD,
} = require('../../src/contracts/market-evidence');
const {
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
} = require('../../src/contracts/valuation-reconciliation');
const {
  evaluateValuationReconciliation,
} = require('../../src/valuation-reconciliation/valuation-reconciliation-governance');

const AS_OF = '2026-09-29T19:30:00.000Z';
const PROPERTY_REF = 'property-001';
const VALUATION_DATE = '2026-09-29T00:00:00.000Z';
const GEO_VERIFIER = 'C3-GEO-VERIFIER';
const GEO_FRESHNESS = 'C3-GEO-FRESHNESS';
const MARKET_VERIFIER = 'C3-MARKET-VERIFIER';
const MARKET_FRESHNESS = 'C3-MARKET-FRESHNESS';
const MARKET_MIN_POLICY = 'C3-MARKET-MIN-3';
const METHOD_VERIFIER = 'C3-METHOD-VERIFIER';
const RECONCILER = 'C3-RECONCILER';
const RECON_POLICY = 'C3-THREE-APPROACH-POLICY';
const MARKET_CONTEXT_ID = 'riyadh-office-market-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const ASSET_TYPE = 'OFFICE';

function geospatialRecord(index, evidenceType, normalizedValue, sourceId, sourceUrl, resolutionMethod) {
  return {
    id: `geo-${index}`,
    subjectId: PROPERTY_REF,
    evidenceType,
    normalizedValue,
    sourceId,
    sourceReference: `GEO-REF-${index}`,
    sourceUrl,
    verificationStatus: GEOSPATIAL_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: GEO_VERIFIER,
    verificationReference: `GEO-VERIFY-${index}`,
    resolutionMethod,
    observedAt: '2026-09-29T10:00:00.000Z',
    validUntil: '2026-10-29T10:00:00.000Z',
    freshnessPolicyId: GEO_FRESHNESS,
    critical: true,
  };
}

function geospatialEvidence() {
  return {
    subjectId: PROPERTY_REF,
    trustedVerifierIds: [GEO_VERIFIER],
    governedFreshnessPolicyIds: [GEO_FRESHNESS],
    evidenceRecords: [
      geospatialRecord(
        1,
        GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY,
        { parcelNumber: '101', planNumber: '202' },
        'REGA_GEOSPATIAL_REAL_ESTATE_PORTAL',
        'https://rega.gov.sa/rega-services/platforms/geospatial-real-estate-portal/',
        GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
      ),
      geospatialRecord(
        2,
        GEOSPATIAL_EVIDENCE_TYPE.LAND_USE,
        { useCode: 'OFFICE' },
        'BALADY_URBAN_MAPS',
        'https://www.balady.gov.sa/',
        GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
      ),
      geospatialRecord(
        3,
        GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY,
        { zoningCode: 'OFFICE-C3', maxFloors: 8 },
        'BALADY_URBAN_MAPS',
        'https://www.balady.gov.sa/',
        GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
      ),
    ],
  };
}

function saleRecord(index, amountSar) {
  return {
    id: `market-sale-${index}`,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION,
    normalizedValue: { amountSar, areaSqm: 1000 },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: `REGA-C3-SALE-${index}`,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    transactionKey: `C3-SALE-${index}`,
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: MARKET_VERIFIER,
    verificationReference: `C3-MARKET-VERIFY-${index}`,
    freshnessPolicyId: MARKET_FRESHNESS,
    effectiveAt: `2026-09-${20 + index}T12:00:00.000Z`,
    observedAt: '2026-09-29T12:00:00.000Z',
    validUntil: '2026-10-29T12:00:00.000Z',
  };
}

function marketEvidence() {
  return {
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceRecords: [saleRecord(1, 9500000), saleRecord(2, 10000000), saleRecord(3, 10500000)],
    trustedVerifierIds: [MARKET_VERIFIER],
    governedFreshnessPolicyIds: [MARKET_FRESHNESS],
    minimumCountPolicyId: MARKET_MIN_POLICY,
    governedMinimumCountPolicies: {
      [MARKET_MIN_POLICY]: {
        [MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION]: 3,
      },
    },
  };
}

function sourceResult(modelVersion, valueSar, hashChar, overrides = {}) {
  const common = {
    modelVersion,
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    calculationHashSha256: hashChar.repeat(64),
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  if (modelVersion === 'LAND_SALES_COMPARISON_1.0') {
    return {
      ...common,
      status: 'LAND_VALUE_INDICATION_READY',
      indicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
      landValueIndicationSar: valueSar,
      ...overrides,
    };
  }
  if (modelVersion === 'DIRECT_CAPITALIZATION_1.0') {
    return {
      ...common,
      status: 'DIRECT_CAPITALIZATION_VALUE_INDICATION_READY',
      indicationType: 'DIRECT_CAPITALIZATION_VALUE_INDICATION',
      valueIndicationSar: valueSar,
      ...overrides,
    };
  }
  if (modelVersion === 'PROFESSIONAL_DCF_1.0') {
    return {
      ...common,
      status: 'DCF_VALUE_INDICATION_READY',
      indicationType: 'PROFESSIONAL_DCF_VALUE_INDICATION',
      valueIndicationSar: valueSar,
      ...overrides,
    };
  }
  if (modelVersion === 'COST_APPROACH_1.0') {
    return {
      ...common,
      status: 'VALUE_INDICATION_READY_FOR_RECONCILIATION',
      valueIndicationType: 'COST_APPROACH_VALUE_INDICATION',
      costApproachValueIndicationSar: valueSar,
      ...overrides,
    };
  }
  throw new Error(`unsupported fixture model ${modelVersion}`);
}

function method(id, modelVersion, valueSar, hashChar, overrides = {}) {
  return {
    id,
    sourceResult: sourceResult(modelVersion, valueSar, hashChar, overrides.sourceResult || {}),
    verifiedBy: overrides.verifiedBy || METHOD_VERIFIER,
    verificationReference: overrides.verificationReference || `METHOD-VERIFY-${id}`,
    verifiedAt: overrides.verifiedAt || '2026-09-29T18:00:00.000Z',
  };
}

function methods() {
  return [
    method('market-1', 'LAND_SALES_COMPARISON_1.0', 10000000, 'a'),
    method('income-1', 'DIRECT_CAPITALIZATION_1.0', 10500000, 'b'),
    method('cost-1', 'COST_APPROACH_1.0', 9500000, 'c'),
  ];
}

function governedPolicies(overrides = {}) {
  return {
    [RECON_POLICY]: {
      allowedModelVersions: [
        'LAND_SALES_COMPARISON_1.0',
        'DIRECT_CAPITALIZATION_1.0',
        'PROFESSIONAL_DCF_1.0',
        'COST_APPROACH_1.0',
      ],
      requiredApproachFamilies: ['MARKET', 'INCOME', 'COST'],
      minimumMethodIndications: 3,
      minimumDistinctApproachFamilies: 3,
      maxSingleIndicationWeight: 0.5,
      maxSingleApproachWeight: 0.5,
      maxSpreadRatio: 0.25,
      confidenceSpreadThresholds: { highMax: 0.1, moderateMax: 0.2 },
      requireAllEligibleIndicationsWeighted: true,
      ...overrides,
    },
  };
}

function instruction(overrides = {}) {
  return {
    instructionId: 'recon-001',
    rationale: 'Three governed approaches are reconciled using explicit professional weights after evidence review.',
    reconciledBy: RECONCILER,
    reconciliationReference: 'C3-RECON-REF-001',
    reconciledAt: '2026-09-29T18:30:00.000Z',
    weightsByIndicationId: {
      'market-1': 0.4,
      'income-1': 0.35,
      'cost-1': 0.25,
    },
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluateValuationReconciliation({
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    asOf: AS_OF,
    geospatialEvidence: geospatialEvidence(),
    marketEvidence: marketEvidence(),
    methodIndications: methods(),
    trustedMethodVerifierIds: [METHOD_VERIFIER],
    trustedReconcilerIds: [RECONCILER],
    reconciliationPolicyId: RECON_POLICY,
    governedReconciliationPolicies: governedPolicies(),
    reconciliationInstruction: instruction(),
    ...overrides,
  });
}

const ready = evaluate();
assert.equal(ready.status, RECONCILIATION_GATE_STATUS.READY);
assert.equal(ready.decisionReady, true);
assert.equal(ready.c1ReevaluatedInternally, true);
assert.equal(ready.c2ReevaluatedInternally, true);
assert.equal(ready.methodCoverage.eligibleMethodCount, 3);
assert.deepEqual([...ready.methodCoverage.eligibleApproachFamilies].sort(), ['COST', 'INCOME', 'MARKET']);
assert.equal(ready.methodCoverage.requiredFamilyCoverageRatio, 1);
assert.equal(ready.candidateWeightedValueSar, 10050000);
assert.equal(ready.analyticalValueIndicationSar, 10050000);
assert.equal(ready.analyticalRangeLowSar, 9500000);
assert.equal(ready.analyticalRangeHighSar, 10500000);
assert.ok(Math.abs(ready.spreadRatio - (1000000 / 10050000)) < 1e-12);
assert.equal(ready.analyticalConfidenceClass, RECONCILIATION_CONFIDENCE_CLASS.HIGH);
assert.equal(ready.automaticMethodSelection, false);
assert.equal(ready.automaticReconciliationWeightsGenerated, false);
assert.equal(ready.statisticalConfidenceClaimed, false);
assert.equal(ready.finalValuationConclusionEstablished, false);
assert.equal(ready.certifiedValuationEstablished, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.publicAiAuthorized, false);
assert.match(ready.resultHashSha256, /^[a-f0-9]{64}$/);

const staleGeo = geospatialEvidence();
staleGeo.evidenceRecords = staleGeo.evidenceRecords.map((record, index) => index === 2
  ? { ...record, validUntil: '2026-09-28T23:00:00.000Z' }
  : record);
const geoHeld = evaluate({ geospatialEvidence: staleGeo });
assert.equal(geoHeld.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.equal(geoHeld.decisionReady, false);
assert.ok(geoHeld.blockers.includes('C3_C1_EVIDENCE_NOT_READY'));
assert.equal(geoHeld.analyticalValueIndicationSar, null);
assert.equal(geoHeld.analyticalConfidenceClass, RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED);

const fakeReadyGeo = {
  subjectId: PROPERTY_REF,
  status: 'READY',
  decisionReady: true,
  evidenceRecords: [],
  trustedVerifierIds: [GEO_VERIFIER],
  governedFreshnessPolicyIds: [GEO_FRESHNESS],
};
const fakeGeoHeld = evaluate({ geospatialEvidence: fakeReadyGeo });
assert.equal(fakeGeoHeld.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(fakeGeoHeld.blockers.includes('C3_C1_EVIDENCE_NOT_READY'));

const thinMarket = marketEvidence();
thinMarket.evidenceRecords = thinMarket.evidenceRecords.slice(0, 2);
const marketHeld = evaluate({ marketEvidence: thinMarket });
assert.equal(marketHeld.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(marketHeld.blockers.includes('C3_C2_EVIDENCE_NOT_READY'));

const fakeReadyMarket = {
  ...marketEvidence(),
  status: 'READY',
  decisionReady: true,
  evidenceRecords: [],
};
const fakeMarketHeld = evaluate({ marketEvidence: fakeReadyMarket });
assert.equal(fakeMarketHeld.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(fakeMarketHeld.blockers.includes('C3_C2_EVIDENCE_NOT_READY'));

const untrustedMethods = methods();
untrustedMethods[1] = method('income-1', 'DIRECT_CAPITALIZATION_1.0', 10500000, 'b', { verifiedBy: 'CALLER-INVENTED-VERIFIER' });
const untrustedHeld = evaluate({ methodIndications: untrustedMethods });
assert.equal(untrustedHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(untrustedHeld.blockers.includes('C3_METHOD_VERIFIER_UNTRUSTED:income-1'));
assert.ok(untrustedHeld.blockers.includes('C3_MINIMUM_METHODS_NOT_MET:2/3'));
assert.equal(untrustedHeld.analyticalValueIndicationSar, null);

const reviewRequiredDcf = methods();
reviewRequiredDcf[1] = method('income-1', 'PROFESSIONAL_DCF_1.0', 10500000, 'd', {
  sourceResult: { status: 'REVIEW_REQUIRED' },
});
const reviewHeld = evaluate({ methodIndications: reviewRequiredDcf });
assert.equal(reviewHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(reviewHeld.blockers.includes('C3_METHOD_STATUS_NOT_RECONCILABLE:PROFESSIONAL_DCF_1.0:REVIEW_REQUIRED'));

const propertyMismatchMethods = methods();
propertyMismatchMethods[0] = method('market-1', 'LAND_SALES_COMPARISON_1.0', 10000000, 'a', {
  sourceResult: { propertyRef: 'property-OTHER' },
});
const propertyMismatchHeld = evaluate({ methodIndications: propertyMismatchMethods });
assert.equal(propertyMismatchHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(propertyMismatchHeld.blockers.includes('C3_METHOD_PROPERTY_REF_MISMATCH:market-1'));

const duplicateCalc = methods();
duplicateCalc[2] = method('cost-1', 'COST_APPROACH_1.0', 9500000, 'b');
const duplicateHeld = evaluate({ methodIndications: duplicateCalc });
assert.equal(duplicateHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(duplicateHeld.blockers.some((code) => code.startsWith('C3_DUPLICATE_METHOD_CALCULATION:')));
assert.ok(duplicateHeld.blockers.includes('C3_MINIMUM_METHODS_NOT_MET:2/3'));

const weightExceeds = evaluate({
  reconciliationInstruction: instruction({
    weightsByIndicationId: { 'market-1': 0.55, 'income-1': 0.25, 'cost-1': 0.2 },
  }),
});
assert.equal(weightExceeds.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(weightExceeds.blockers.includes('C3_RECONCILIATION_WEIGHT_EXCEEDS_POLICY:market-1'));
assert.ok(weightExceeds.blockers.includes('C3_APPROACH_WEIGHT_EXCEEDS_POLICY:MARKET'));

const badSum = evaluate({
  reconciliationInstruction: instruction({
    weightsByIndicationId: { 'market-1': 0.4, 'income-1': 0.3, 'cost-1': 0.2 },
  }),
});
assert.equal(badSum.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(badSum.blockers.some((code) => code.startsWith('C3_RECONCILIATION_WEIGHTS_SUM_INVALID:')));

const missingCostMethod = methods().slice(0, 2);
const missingCostHeld = evaluate({
  methodIndications: missingCostMethod,
  reconciliationInstruction: instruction({ weightsByIndicationId: { 'market-1': 0.5, 'income-1': 0.5 } }),
});
assert.equal(missingCostHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(missingCostHeld.blockers.includes('C3_REQUIRED_APPROACH_MISSING:COST'));
assert.ok(missingCostHeld.blockers.includes('C3_REQUIRED_APPROACH_NOT_WEIGHTED:COST'));

const divergentMethods = [
  method('market-1', 'LAND_SALES_COMPARISON_1.0', 10000000, 'a'),
  method('income-1', 'DIRECT_CAPITALIZATION_1.0', 20000000, 'b'),
  method('cost-1', 'COST_APPROACH_1.0', 9000000, 'c'),
];
const divergenceHeld = evaluate({ methodIndications: divergentMethods });
assert.equal(divergenceHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(divergenceHeld.blockers.some((code) => code.startsWith('C3_APPROACH_DIVERGENCE_EXCEEDS_POLICY:')));
assert.equal(divergenceHeld.analyticalValueIndicationSar, null);
assert.equal(divergenceHeld.analyticalConfidenceClass, RECONCILIATION_CONFIDENCE_CLASS.NOT_ESTABLISHED);
assert.ok(divergenceHeld.candidateWeightedValueSar > 0);

const ungovernedPolicy = evaluate({ reconciliationPolicyId: 'CALLER-INVENTED-POLICY' });
assert.equal(ungovernedPolicy.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(ungovernedPolicy.blockers.includes('C3_RECONCILIATION_POLICY_NOT_GOVERNED:CALLER-INVENTED-POLICY'));

const badUpstreamAuthority = methods();
badUpstreamAuthority[0] = method('market-1', 'LAND_SALES_COMPARISON_1.0', 10000000, 'a', {
  sourceResult: { certifiedValuationEstablished: true },
});
const authorityHeld = evaluate({ methodIndications: badUpstreamAuthority });
assert.equal(authorityHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(authorityHeld.blockers.includes('C3_UPSTREAM_CERTIFICATION_FLAG_INVALID:market-1'));

console.log('C3_GOVERNED_VALUATION_RECONCILIATION_FOUNDATION=PASS');
