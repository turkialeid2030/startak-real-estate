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
  SOURCE_TIER,
  SOURCE_LICENSING_STATUS,
} = require('../../src/contracts/source-intelligence');
const {
  VALUATION_VALUE_SCOPE,
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
  RECOGNIZED_METHOD_MODELS_BY_VERSION,
} = require('../../src/contracts/valuation-reconciliation');
const {
  hashValue,
} = require('../../src/source-intelligence/source-provenance-governance');
const {
  evaluateC3IC2SGovernedReconciliation,
} = require('../../src/valuation-reconciliation/c3i-c2s-governed-reconciliation');

const AS_OF = '2026-09-29T19:30:00.000Z';
const PROPERTY_REF = 'property-c3i-c2s-001';
const VALUATION_DATE = '2026-09-29T00:00:00.000Z';
const VALUATION_SCOPE = VALUATION_VALUE_SCOPE.WHOLE_PROPERTY;
const GEO_VERIFIER = 'C3I-C2S-GEO-VERIFIER';
const GEO_FRESHNESS = 'C3I-C2S-GEO-FRESHNESS';
const MARKET_VERIFIER = 'C3I-C2S-MARKET-VERIFIER';
const MARKET_FRESHNESS = 'C3I-C2S-MARKET-FRESHNESS';
const MARKET_MIN_POLICY = 'C3I-C2S-MARKET-MIN-3';
const MARKET_BINDER = 'C3I-C2S-MARKET-CONTEXT-BINDER';
const METHOD_VERIFIER = 'C3I-C2S-METHOD-VERIFIER';
const RECONCILER = 'C3I-C2S-RECONCILER';
const RECON_POLICY = 'C3I-C2S-WHOLE-PROPERTY-MARKET-INCOME-COST-POLICY';
const MARKET_CONTEXT_ID = 'riyadh-office-c3i-c2s-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const ASSET_TYPE = 'OFFICE';
const PROVENANCE_VERIFIER = 'C3I-C2S-PROVENANCE-VERIFIER';

function geospatialRecord(index, evidenceType, normalizedValue, sourceId, sourceUrl, resolutionMethod) {
  return {
    id: `c3i-c2s-geo-${index}`,
    subjectId: PROPERTY_REF,
    evidenceType,
    normalizedValue,
    sourceId,
    sourceReference: `C3I-C2S-GEO-REF-${index}`,
    sourceUrl,
    verificationStatus: GEOSPATIAL_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: GEO_VERIFIER,
    verificationReference: `C3I-C2S-GEO-VERIFY-${index}`,
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
        { parcelNumber: 'C3I-C2S-101', planNumber: 'C3I-C2S-202' },
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
        { zoningCode: 'OFFICE-C3I-C2S', maxFloors: 12 },
        'BALADY_URBAN_MAPS',
        'https://www.balady.gov.sa/',
        GEOSPATIAL_RESOLUTION_METHOD.OFFICIAL_MAP_QUERY,
      ),
    ],
  };
}

function saleRecord(index, amountSar) {
  return {
    id: `c3i-c2s-market-sale-${index}`,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION,
    normalizedValue: { amountSar, areaSqm: 2000 },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: `REGA-C3I-C2S-SALE-${index}`,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    transactionKey: `C3I-C2S-SALE-${index}`,
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: MARKET_VERIFIER,
    verificationReference: `C3I-C2S-MARKET-VERIFY-${index}`,
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
    evidenceRecords: [saleRecord(1, 10000000), saleRecord(2, 9600000), saleRecord(3, 10200000)],
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

function marketContextBinding(overrides = {}) {
  return {
    bindingId: 'c3i-c2s-market-binding-001',
    propertyRef: PROPERTY_REF,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    boundBy: MARKET_BINDER,
    bindingReference: 'C3I-C2S-MARKET-BINDING-REF-001',
    boundAt: '2026-09-29T17:45:00.000Z',
    ...overrides,
  };
}

function commonResult(modelVersion, hashChar) {
  return {
    modelVersion,
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    calculationHashSha256: hashChar.repeat(64),
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

function marketResult(overrides = {}) {
  return {
    ...commonResult('WHOLE_PROPERTY_SALES_COMPARISON_1.0', 'd'),
    status: 'WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY',
    valueScope: 'WHOLE_PROPERTY',
    approachFamily: 'MARKET',
    inputPacketHashSha256: 'e'.repeat(64),
    indicationType: 'WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION',
    valueIndicationSar: 12605000,
    canonicalCalculationEngine: true,
    professionalComparableSelectionUsed: true,
    professionalAdjustmentDispositionUsed: true,
    professionalWeightsUsed: true,
    automaticComparableSelection: false,
    automaticAdjustmentEstimated: false,
    automaticComparableWeighting: false,
    publicAiAuthorized: false,
    ...overrides,
  };
}

function incomeResult(overrides = {}) {
  return {
    ...commonResult('DIRECT_CAPITALIZATION_1.0', 'a'),
    status: 'DIRECT_CAPITALIZATION_VALUE_INDICATION_READY',
    indicationType: 'DIRECT_CAPITALIZATION_VALUE_INDICATION',
    valueIndicationSar: 12200000,
    ...overrides,
  };
}

function costResult(overrides = {}) {
  return {
    ...commonResult('COST_APPROACH_1.0', 'c'),
    status: 'VALUE_INDICATION_READY_FOR_RECONCILIATION',
    valueIndicationType: 'COST_APPROACH_VALUE_INDICATION',
    costApproachValueIndicationSar: 12000000,
    ...overrides,
  };
}

function method(id, sourceResult, overrides = {}) {
  return {
    id,
    sourceResult,
    verifiedBy: overrides.verifiedBy || METHOD_VERIFIER,
    verificationReference: overrides.verificationReference || `C3I-C2S-METHOD-VERIFY-${id}`,
    verifiedAt: overrides.verifiedAt || '2026-09-29T18:00:00.000Z',
  };
}

function methods(overrides = {}) {
  return [
    method('market-sales', overrides.market || marketResult(), overrides.marketMethod || {}),
    method('income-cap', overrides.income || incomeResult(), overrides.incomeMethod || {}),
    method('cost-1', overrides.cost || costResult(), overrides.costMethod || {}),
  ];
}

function governedPolicies(overrides = {}) {
  return {
    [RECON_POLICY]: {
      valuationScope: VALUATION_SCOPE,
      allowedModelVersions: [
        'WHOLE_PROPERTY_SALES_COMPARISON_1.0',
        'DIRECT_CAPITALIZATION_1.0',
        'COST_APPROACH_1.0',
      ],
      requiredApproachFamilies: ['MARKET', 'INCOME', 'COST'],
      minimumMethodIndications: 3,
      minimumDistinctApproachFamilies: 3,
      maxSingleIndicationWeight: 0.5,
      maxSingleApproachWeight: 0.5,
      maxSpreadRatio: 0.20,
      confidenceSpreadThresholds: { highMax: 0.08, moderateMax: 0.15 },
      requireAllEligibleIndicationsWeighted: true,
      ...overrides,
    },
  };
}

function instruction(overrides = {}) {
  return {
    instructionId: 'c3i-c2s-recon-001',
    rationale: 'Qualified whole-property MARKET, INCOME and COST indications are reconciled only after every C1/C2 evidence record passes C2S provenance and exact evidence-hash binding.',
    reconciledBy: RECONCILER,
    reconciliationReference: 'C3I-C2S-RECON-REF-001',
    reconciledAt: '2026-09-29T18:30:00.000Z',
    weightsByIndicationId: {
      'market-sales': 0.35,
      'income-cap': 0.35,
      'cost-1': 0.30,
    },
    ...overrides,
  };
}

function officialUnderlyingAuthority(evidence) {
  if (evidence.sourceId === 'REGA_REAL_ESTATE_INDICATORS') return 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS';
  return evidence.sourceId;
}

function provenanceRecord(evidence, domain, index, overrides = {}) {
  const effectiveAt = evidence.effectiveAt || evidence.observedAt;
  const retrievedAt = evidence.observedAt || '2026-09-29T12:30:00.000Z';
  return {
    id: `c3i-c2s-source-${domain.toLowerCase()}-${index}`,
    sourceProvider: evidence.sourceId,
    underlyingAuthority: officialUnderlyingAuthority(evidence),
    provenanceVerified: true,
    provenanceVerifiedBy: PROVENANCE_VERIFIER,
    provenanceVerificationReference: `C3I-C2S-PROVENANCE-VERIFY-${domain}-${index}`,
    provenanceVerifiedAt: '2026-09-29T18:15:00.000Z',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    licensingStatus: SOURCE_LICENSING_STATUS.NOT_APPLICABLE_OFFICIAL,
    sourceUrl: evidence.sourceUrl,
    retrievedAt,
    effectiveAt,
    validUntil: evidence.validUntil,
    originalSourceReference: evidence.sourceReference,
    methodologyVersion: `C3I-C2S-SOURCE-METHOD-${evidence.sourceId}`,
    corroboratedBy: [],
    evidencePayload: evidence,
    evidenceHashSha256: hashValue(evidence),
    ...overrides,
  };
}

function sourceProvenance(geo, market, overrides = {}) {
  const records = [];
  geo.evidenceRecords.forEach((record, index) => records.push(provenanceRecord(record, 'GEOSPATIAL', index + 1)));
  market.evidenceRecords.forEach((record, index) => records.push(provenanceRecord(record, 'MARKET', index + 1)));
  return {
    records,
    trustedProvenanceVerifierIds: [PROVENANCE_VERIFIER],
    governedProfessionalProviders: {},
    trustedLicenseVerifierIds: [],
    ...overrides,
  };
}

function sourceProvenanceBindings(geo, market) {
  const bindings = [];
  geo.evidenceRecords.forEach((record, index) => bindings.push({
    evidenceDomain: 'GEOSPATIAL',
    evidenceRecordId: record.id,
    sourceRecordId: `c3i-c2s-source-geospatial-${index + 1}`,
  }));
  market.evidenceRecords.forEach((record, index) => bindings.push({
    evidenceDomain: 'MARKET',
    evidenceRecordId: record.id,
    sourceRecordId: `c3i-c2s-source-market-${index + 1}`,
  }));
  return bindings;
}

function fixture(overrides = {}) {
  const geo = overrides.geospatialEvidence || geospatialEvidence();
  const market = overrides.marketEvidence || marketEvidence();
  return {
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    valuationScope: VALUATION_SCOPE,
    asOf: AS_OF,
    geospatialEvidence: geo,
    marketEvidence: market,
    marketContextBinding: marketContextBinding(),
    trustedMarketContextBinderIds: [MARKET_BINDER],
    methodIndications: methods(),
    trustedMethodVerifierIds: [METHOD_VERIFIER],
    trustedReconcilerIds: [RECONCILER],
    reconciliationPolicyId: RECON_POLICY,
    governedReconciliationPolicies: governedPolicies(),
    reconciliationInstruction: instruction(),
    sourceProvenance: sourceProvenance(geo, market),
    sourceProvenanceBindings: sourceProvenanceBindings(geo, market),
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluateC3IC2SGovernedReconciliation(fixture(overrides));
}

const c3mModel = RECOGNIZED_METHOD_MODELS_BY_VERSION['WHOLE_PROPERTY_SALES_COMPARISON_1.0'];
assert.equal(c3mModel.approachFamily, 'MARKET');
assert.equal(c3mModel.valueScope, 'WHOLE_PROPERTY');
assert.deepEqual([...c3mModel.acceptedStatuses], ['WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY']);
assert.equal(c3mModel.expectedIndicationType, 'WHOLE_PROPERTY_SALES_COMPARISON_VALUE_INDICATION');
assert.equal(c3mModel.requiredSourceValueScope, 'WHOLE_PROPERTY');
assert.equal(c3mModel.requiredSourceApproachFamily, 'MARKET');
assert.deepEqual([...c3mModel.requiredSourceHashFields], ['inputPacketHashSha256']);

const ready = evaluate();
assert.equal(ready.status, RECONCILIATION_GATE_STATUS.READY);
assert.equal(ready.sourceProvenanceReady, true);
assert.equal(ready.sourceProvenanceEvaluation.provenanceClassificationReady, true);
assert.equal(ready.sourceProvenanceEvaluation.decisionReady, false);
assert.equal(ready.sourceProvenanceEvaluation.authoritativeEvidenceReady, true);
assert.equal(ready.sourceProvenanceEvaluation.authoritativeEvidence.length, 6);
assert.equal(ready.sourceProvenanceBindingEvaluation.status, 'READY');
assert.equal(ready.sourceProvenanceBindingEvaluation.expectedEvidenceCount, 6);
assert.equal(ready.sourceProvenanceBindingEvaluation.boundEvidenceCount, 6);
assert.equal(ready.decisionReady, true);
assert.equal(ready.valuationScope, VALUATION_SCOPE);
assert.equal(ready.methodCoverage.eligibleMethodCount, 3);
assert.deepEqual([...ready.methodCoverage.eligibleApproachFamilies].sort(), ['COST', 'INCOME', 'MARKET']);
assert.equal(ready.methodCoverage.requiredFamilyCoverageRatio, 1);
assert.equal(ready.candidateWeightedValueSar, 12281750);
assert.equal(ready.analyticalValueIndicationSar, 12281750);
assert.equal(ready.analyticalRangeLowSar, 12000000);
assert.equal(ready.analyticalRangeHighSar, 12605000);
assert.ok(Math.abs(ready.spreadRatio - (605000 / 12281750)) < 1e-12);
assert.equal(ready.analyticalConfidenceClass, RECONCILIATION_CONFIDENCE_CLASS.HIGH);
assert.equal(ready.finalValuationConclusionEstablished, false);
assert.equal(ready.certifiedValuationEstablished, false);
assert.equal(ready.transactionAuthorized, false);
assert.equal(ready.publicAiAuthorized, false);

const noProvenance = fixture();
delete noProvenance.sourceProvenance;
const noProvenanceResult = evaluateC3IC2SGovernedReconciliation(noProvenance);
assert.equal(noProvenanceResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.equal(noProvenanceResult.decisionReady, false);
assert.equal(noProvenanceResult.analyticalValueIndicationSar, null);
assert.ok(noProvenanceResult.blockers.includes('C3I_C2S_SOURCE_PROVENANCE_PACKET_REQUIRED'));

const missingBinding = fixture();
missingBinding.sourceProvenanceBindings = missingBinding.sourceProvenanceBindings.slice(1);
const missingBindingResult = evaluateC3IC2SGovernedReconciliation(missingBinding);
assert.equal(missingBindingResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(missingBindingResult.blockers.some((blocker) => blocker.startsWith('C3I_C2S_EVIDENCE_BINDING_REQUIRED:GEOSPATIAL:')));
assert.equal(missingBindingResult.analyticalValueIndicationSar, null);

const untrustedProvenance = fixture();
untrustedProvenance.sourceProvenance = {
  ...untrustedProvenance.sourceProvenance,
  trustedProvenanceVerifierIds: ['OTHER-VERIFIER'],
};
const untrustedProvenanceResult = evaluateC3IC2SGovernedReconciliation(untrustedProvenance);
assert.equal(untrustedProvenanceResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(untrustedProvenanceResult.blockers.some((blocker) => blocker.includes('C2S_PROVENANCE_VERIFIER_UNTRUSTED')));

const commercialAsAuthority = fixture();
const firstGeo = commercialAsAuthority.geospatialEvidence.evidenceRecords[0];
commercialAsAuthority.sourceProvenance.records[0] = provenanceRecord(firstGeo, 'GEOSPATIAL', 1, {
  sourceProvider: 'EARTHAPP_COMMERCIAL_INTELLIGENCE',
  underlyingAuthority: null,
  provenanceVerified: false,
  provenanceVerifiedBy: null,
  provenanceVerificationReference: null,
  provenanceVerifiedAt: null,
  sourceTier: SOURCE_TIER.B_COMMERCIAL_CORROBORATION,
  licensingStatus: SOURCE_LICENSING_STATUS.TERMS_OR_LICENSE_NOT_VERIFIED,
  sourceUrl: 'https://map.earthapp.com.sa/',
});
const commercialAsAuthorityResult = evaluateC3IC2SGovernedReconciliation(commercialAsAuthority);
assert.equal(commercialAsAuthorityResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(commercialAsAuthorityResult.blockers.some((blocker) => blocker.includes('C3I_C2S_BOUND_SOURCE_NOT_AUTHORITATIVE:GEOSPATIAL:')));
assert.equal(commercialAsAuthorityResult.analyticalValueIndicationSar, null);

const wrongProvider = fixture();
const firstMarket = wrongProvider.marketEvidence.evidenceRecords[0];
wrongProvider.sourceProvenance.records[3] = provenanceRecord(firstMarket, 'MARKET', 1, {
  sourceProvider: 'BALADY_URBAN_MAPS',
  underlyingAuthority: 'BALADY_URBAN_MAPS',
  sourceUrl: 'https://www.balady.gov.sa/',
});
const wrongProviderResult = evaluateC3IC2SGovernedReconciliation(wrongProvider);
assert.equal(wrongProviderResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(wrongProviderResult.blockers.some((blocker) => blocker.includes('C3I_C2S_SOURCE_PROVIDER_MISMATCH:MARKET:')));

const tamperedEvidence = fixture();
tamperedEvidence.marketEvidence.evidenceRecords[0].normalizedValue.amountSar = 77777777;
const tamperedEvidenceResult = evaluateC3IC2SGovernedReconciliation(tamperedEvidence);
assert.equal(tamperedEvidenceResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(tamperedEvidenceResult.blockers.some((blocker) => blocker.includes('C3I_C2S_EVIDENCE_HASH_BINDING_MISMATCH:MARKET:')));
assert.equal(tamperedEvidenceResult.analyticalValueIndicationSar, null);

const duplicateBinding = fixture();
duplicateBinding.sourceProvenanceBindings.push({ ...duplicateBinding.sourceProvenanceBindings[0] });
const duplicateBindingResult = evaluateC3IC2SGovernedReconciliation(duplicateBinding);
assert.equal(duplicateBindingResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(duplicateBindingResult.blockers.some((blocker) => blocker.includes('C3I_C2S_DUPLICATE_EVIDENCE_BINDING:')));

function heldForMarketResult(sourceResult, expectedBlockerFragment) {
  const input = fixture({ methodIndications: methods({ market: sourceResult }) });
  const result = evaluateC3IC2SGovernedReconciliation(input);
  assert.equal(result.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
  assert.equal(result.decisionReady, false);
  assert.equal(result.analyticalValueIndicationSar, null);
  assert.ok(result.blockers.some((blocker) => blocker.includes(expectedBlockerFragment)), result.blockers.join('\n'));
}

heldForMarketResult(
  marketResult({ status: 'READY' }),
  'C3_METHOD_STATUS_NOT_RECONCILABLE:WHOLE_PROPERTY_SALES_COMPARISON_1.0:READY',
);
heldForMarketResult(
  marketResult({ indicationType: 'GENERIC_MARKET_VALUE_INDICATION' }),
  'C3_METHOD_INDICATION_TYPE_MISMATCH:market-sales',
);

const authorityInjection = fixture({
  methodIndications: methods({ market: marketResult({ transactionAuthorized: true }) }),
});
const authorityInjectionResult = evaluateC3IC2SGovernedReconciliation(authorityInjection);
assert.equal(authorityInjectionResult.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(authorityInjectionResult.blockers.some((blocker) => blocker.includes('C3_UPSTREAM_TRANSACTION_AUTHORITY_INVALID:market-sales')));
assert.equal(authorityInjectionResult.transactionAuthorized, false);

const landOnlyMarket = {
  ...commonResult('LAND_SALES_COMPARISON_1.0', 'f'),
  status: 'LAND_VALUE_INDICATION_READY',
  indicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
  landValueIndicationSar: 7000000,
};
const scopeHeldInput = fixture({
  methodIndications: [
    method('market-land-only', landOnlyMarket),
    method('income-cap', incomeResult()),
    method('cost-1', costResult()),
  ],
  governedReconciliationPolicies: governedPolicies({
    allowedModelVersions: ['LAND_SALES_COMPARISON_1.0', 'DIRECT_CAPITALIZATION_1.0', 'COST_APPROACH_1.0'],
  }),
  reconciliationInstruction: instruction({
    weightsByIndicationId: { 'market-land-only': 0.35, 'income-cap': 0.35, 'cost-1': 0.30 },
  }),
});
const scopeHeld = evaluateC3IC2SGovernedReconciliation(scopeHeldInput);
assert.equal(scopeHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(scopeHeld.blockers.some((blocker) => blocker.includes('C3_POLICY_MODEL_SCOPE_MISMATCH:LAND_SALES_COMPARISON_1.0:LAND_ONLY/WHOLE_PROPERTY')));
assert.equal(scopeHeld.analyticalValueIndicationSar, null);

console.log('C3I_C2S_GOVERNED_RECONCILIATION_INTEGRATION=PASS');