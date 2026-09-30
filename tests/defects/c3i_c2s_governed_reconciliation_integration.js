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
  WHOLE_PROPERTY_UNIT_OF_COMPARISON,
  WHOLE_PROPERTY_ADJUSTMENT_DIRECTION,
  WHOLE_PROPERTY_ADJUSTMENT_METHOD,
  WHOLE_PROPERTY_ADJUSTMENT_FACTOR,
  WHOLE_PROPERTY_SALES_INPUT_STATUS,
  WHOLE_PROPERTY_SALES_RESULT_STATUS,
} = require('../../src/contracts/whole-property-sales-comparison');
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
  buildWholePropertySalesComparisonInputPacket,
  verifyWholePropertySalesComparisonInputIntegrity,
} = require('../../src/valuation/whole-property-sales-comparison-input');
const {
  calculateWholePropertySalesComparisonIndication,
} = require('../../src/engines/valuation/whole-property-sales-comparison');
const {
  evaluateC3IC2SGovernedReconciliation,
} = require('../../src/valuation-reconciliation/c3i-c2s-governed-reconciliation');

const AS_OF = '2026-09-29T19:30:00.000Z';
const CASE_ID = 'case-c3i-c2s-001';
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
const C3M_UNIT = WHOLE_PROPERTY_UNIT_OF_COMPARISON.GROSS_BUILDING_AREA_SQM;
const C3M_MEASUREMENT_VERIFIER = 'C3I-C2S-C3M-MEASUREMENT-VERIFIER';
const C3M_SELECTOR = 'C3I-C2S-C3M-SELECTOR';
const C3M_ADJUSTMENT_REVIEWER = 'C3I-C2S-C3M-ADJUSTMENT-REVIEWER';
const C3M_RECONCILER = 'C3I-C2S-C3M-RECONCILER';
const C3M_POLICY = 'C3I-C2S-C3M-OFFICE-GBA-POLICY';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function saleRecord(index, amountSar, overrides = {}) {
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
    ...overrides,
  };
}

function marketEvidence(records = null) {
  return {
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceRecords: records || [saleRecord(1, 10000000), saleRecord(2, 9600000), saleRecord(3, 10200000)],
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

function propertyEvidencePacket() {
  const measurement = {
    class: 'PROFESSIONAL_MEASUREMENT',
    measurementId: 'subject-gba-c3i-c2s-001',
    type: 'GROSS_BUILDING_AREA',
    value: 2500,
    unit: 'sqm',
    source: 'PROFESSIONAL_INSPECTION',
    sourceEvidenceRef: 'C3I-C2S-SUBJECT-MEASURE-001',
    measurementStandardRef: 'C3I-C2S-MEASUREMENT-STANDARD-001',
    measurementMethod: 'FIELD_AND_DOCUMENT_RECONCILIATION',
    measuredByRef: 'C3I-C2S-SUBJECT-MEASURER',
    measuredAt: '2026-09-29T10:00:00.000Z',
    measurementHashSha256: 'd'.repeat(64),
  };
  const core = {
    schemaVersion: 1,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    assignmentRef: 'ASSIGNMENT-C3I-C2S-001',
    assignmentHashSha256: '1'.repeat(64),
    inspectionId: 'INSPECTION-C3I-C2S-001',
    inspectionHashSha256: '2'.repeat(64),
    valuationDate: VALUATION_DATE,
    reportDate: '2026-09-29T19:00:00.000Z',
    jurisdiction: 'SA',
    assetType: ASSET_TYPE,
    assetLocation: 'Riyadh',
    valuedRights: 'FULL_INTEREST',
    basisOfValue: 'MARKET_VALUE',
    purpose: 'INTERNAL_DECISION_SUPPORT',
    evidenceFacts: [],
    measurements: [measurement],
    propertyDataGateStatus: 'CLEAR',
    measurementGateStatus: 'CLEAR',
  };
  return {
    ...core,
    packetHashSha256: hashValue(core),
    status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW',
    reasons: [],
    professionalValuationWorkflowReady: true,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

function comparableMeasurements() {
  return [1, 2, 3].map((index) => ({
    comparableId: `comp-${index}`,
    transactionKey: `C3I-C2S-SALE-${index}`,
    sourcePropertyRef: `c3i-c2s-source-property-${index}`,
    assetType: ASSET_TYPE,
    unitOfComparison: C3M_UNIT,
    basisQuantity: 2000,
    sourceRef: `C3I-C2S-COMP-MEASURE-SOURCE-${index}`,
    effectiveAt: `2026-09-${20 + index}T12:00:00.000Z`,
    validUntil: '2026-10-30T00:00:00.000Z',
    verifiedBy: C3M_MEASUREMENT_VERIFIER,
    verificationReference: `C3I-C2S-COMP-MEASURE-VERIFY-${index}`,
    verifiedAt: '2026-09-29T17:15:00.000Z',
  }));
}

function noneAdjustment(comparableId, index) {
  return {
    adjustmentId: `adj-${comparableId}-none`,
    comparableId,
    factor: WHOLE_PROPERTY_ADJUSTMENT_FACTOR.OTHER,
    factorLabel: 'NO_MATERIAL_ADJUSTMENT',
    direction: WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.NONE,
    method: WHOLE_PROPERTY_ADJUSTMENT_METHOD.PERCENT_OF_BASE,
    magnitude: 0,
    rationale: 'Reviewed evidence supports no material adjustment.',
    evidenceRefs: [`C3I-C2S-ADJ-EVIDENCE-NONE-${index}`],
    reviewedBy: C3M_ADJUSTMENT_REVIEWER,
    reviewReference: `C3I-C2S-ADJ-REVIEW-NONE-${index}`,
    reviewedAt: '2026-09-29T17:40:00.000Z',
  };
}

function c3mAdjustmentRecords() {
  return [
    noneAdjustment('comp-1', 1),
    {
      adjustmentId: 'adj-comp-2-location',
      comparableId: 'comp-2',
      factor: WHOLE_PROPERTY_ADJUSTMENT_FACTOR.LOCATION,
      direction: WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.INCREASE,
      method: WHOLE_PROPERTY_ADJUSTMENT_METHOD.PERCENT_OF_BASE,
      magnitude: 0.05,
      rationale: 'Comparable location is reviewed as inferior to the subject.',
      evidenceRefs: ['C3I-C2S-ADJ-EVIDENCE-LOCATION-001'],
      reviewedBy: C3M_ADJUSTMENT_REVIEWER,
      reviewReference: 'C3I-C2S-ADJ-REVIEW-LOCATION-001',
      reviewedAt: '2026-09-29T17:40:00.000Z',
    },
    noneAdjustment('comp-3', 3),
  ];
}

function c3mPolicy() {
  return {
    [C3M_POLICY]: {
      allowedUnitsOfComparison: [C3M_UNIT],
      allowedAssetTypes: [ASSET_TYPE],
      minimumComparableCount: 3,
      maxMeasurementTransactionDateGapDays: 30,
      maxSingleComparableWeight: 0.5,
      maxSingleAdjustmentPercent: 0.2,
      maxNetAdjustmentPercent: 0.25,
      maxGrossAdjustmentPercent: 0.4,
      maxAdjustedUnitSpreadRatio: 0.2,
      requireAllSelectedWeighted: true,
      requireAdjustmentDisposition: true,
    },
  };
}

function wholePropertyMarketInputDraft(overrides = {}) {
  return {
    packetId: 'c3i-c2s-c3m-input-001',
    caseId: CASE_ID,
    unitOfComparison: C3M_UNIT,
    subjectMeasurementId: 'subject-gba-c3i-c2s-001',
    subjectPropertyEvidencePacket: propertyEvidencePacket(),
    comparableMeasurements: comparableMeasurements(),
    trustedMeasurementVerifierIds: [C3M_MEASUREMENT_VERIFIER],
    selectedComparableIds: ['comp-1', 'comp-2', 'comp-3'],
    selectionRationales: {
      'comp-1': 'Same asset class and governed market context.',
      'comp-2': 'Same asset class with reviewed location adjustment.',
      'comp-3': 'Same asset class and comparable physical basis.',
    },
    selectedBy: C3M_SELECTOR,
    selectionReference: 'C3I-C2S-C3M-SELECTION-REF-001',
    selectedAt: '2026-09-29T17:30:00.000Z',
    trustedComparableSelectorIds: [C3M_SELECTOR],
    adjustmentRecords: c3mAdjustmentRecords(),
    trustedAdjustmentReviewerIds: [C3M_ADJUSTMENT_REVIEWER],
    reconciliationPolicyId: C3M_POLICY,
    governedReconciliationPolicies: c3mPolicy(),
    weightsByComparableId: { 'comp-1': 0.4, 'comp-2': 0.3, 'comp-3': 0.3 },
    weightRationales: {
      'comp-1': 'Highest similarity after review.',
      'comp-2': 'Useful after explicit location adjustment.',
      'comp-3': 'Corroborating whole-property transaction.',
    },
    reconciledBy: C3M_RECONCILER,
    reconciliationReference: 'C3I-C2S-C3M-RECON-REF-001',
    reconciledAt: '2026-09-29T18:00:00.000Z',
    trustedReconcilerIds: [C3M_RECONCILER],
    ...overrides,
  };
}

function canonicalMarketPacketAndResult(market, binding, draft = wholePropertyMarketInputDraft()) {
  const packet = buildWholePropertySalesComparisonInputPacket({
    ...draft,
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    asOf: AS_OF,
    marketEvidence: market,
    marketContextBinding: binding,
    trustedMarketContextBinderIds: [MARKET_BINDER],
  });
  assert.equal(packet.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.READY_FOR_CANONICAL_WHOLE_PROPERTY_SALES_CALCULATION, (packet.blockers || []).join('\n'));
  assert.equal(verifyWholePropertySalesComparisonInputIntegrity(packet), true);
  const result = calculateWholePropertySalesComparisonIndication(packet);
  assert.equal(result.status, WHOLE_PROPERTY_SALES_RESULT_STATUS.WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY, (result.blockers || []).join('\n'));
  return { packet, result };
}

function incomeResult(overrides = {}) {
  return {
    modelVersion: 'DIRECT_CAPITALIZATION_1.0',
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    calculationHashSha256: 'a'.repeat(64),
    status: 'DIRECT_CAPITALIZATION_VALUE_INDICATION_READY',
    indicationType: 'DIRECT_CAPITALIZATION_VALUE_INDICATION',
    valueIndicationSar: 12200000,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    ...overrides,
  };
}

function costResult(overrides = {}) {
  return {
    modelVersion: 'COST_APPROACH_1.0',
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    calculationHashSha256: 'c'.repeat(64),
    status: 'VALUE_INDICATION_READY_FOR_RECONCILIATION',
    valueIndicationType: 'COST_APPROACH_VALUE_INDICATION',
    costApproachValueIndicationSar: 12000000,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    ...overrides,
  };
}

function method(id, sourceResult, overrides = {}) {
  return {
    id,
    sourceResult,
    verifiedBy: overrides.verifiedBy || METHOD_VERIFIER,
    verificationReference: overrides.verificationReference || `C3I-C2S-METHOD-VERIFY-${id}`,
    verifiedAt: overrides.verifiedAt || '2026-09-29T18:10:00.000Z',
  };
}

function methods(marketResult, overrides = {}) {
  return [
    method('market-sales', overrides.market || marketResult, overrides.marketMethod || {}),
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
    rationale: 'Whole-property MARKET, INCOME and COST indications are reconciled only after C2S provenance and canonical C3M current-input binding pass.',
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
    evidencePayload: clone(evidence),
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
  const binding = overrides.marketContextBinding || marketContextBinding();
  const c3mDraft = overrides.c3mDraft || wholePropertyMarketInputDraft();
  const canonical = canonicalMarketPacketAndResult(market, binding, c3mDraft);
  const marketSourceResult = overrides.marketSourceResult || canonical.result;
  return {
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    valuationScope: VALUATION_SCOPE,
    asOf: AS_OF,
    geospatialEvidence: geo,
    marketEvidence: market,
    marketContextBinding: binding,
    trustedMarketContextBinderIds: [MARKET_BINDER],
    methodIndications: overrides.methodIndications || methods(marketSourceResult),
    wholePropertyMarketInputsByIndicationId: overrides.wholePropertyMarketInputsByIndicationId || {
      'market-sales': c3mDraft,
    },
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
assert.equal(ready.status, RECONCILIATION_GATE_STATUS.READY, ready.blockers.join('\n'));
assert.equal(ready.sourceProvenanceReady, true);
assert.equal(ready.sourceProvenanceEvaluation.provenanceClassificationReady, true);
assert.equal(ready.sourceProvenanceEvaluation.decisionReady, false);
assert.equal(ready.sourceProvenanceEvaluation.authoritativeEvidenceReady, true);
assert.equal(ready.sourceProvenanceEvaluation.authoritativeEvidence.length, 6);
assert.equal(ready.sourceProvenanceBindingEvaluation.status, 'READY');
assert.equal(ready.sourceProvenanceBindingEvaluation.expectedEvidenceCount, 6);
assert.equal(ready.sourceProvenanceBindingEvaluation.boundEvidenceCount, 6);
assert.equal(ready.wholePropertyMarketMethodEvaluation.status, 'READY');
assert.equal(ready.wholePropertyMarketMethodEvaluation.requiredMethodCount, 1);
assert.equal(ready.wholePropertyMarketMethodEvaluation.verifiedMethodCount, 1);
assert.equal(ready.wholePropertyMarketMethodEvaluation.traces[0].canonicalResultRecomputedFromCurrentMarketEvidence, true);
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
tamperedEvidence.marketEvidence.evidenceRecords[0].normalizedValue.amountSar = 10050000;
const tamperedEvidenceResult = evaluateC3IC2SGovernedReconciliation(tamperedEvidence);
assert.equal(tamperedEvidenceResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(tamperedEvidenceResult.blockers.some((blocker) => blocker.includes('C3I_C2S_EVIDENCE_HASH_BINDING_MISMATCH:MARKET:')));
assert.equal(tamperedEvidenceResult.analyticalValueIndicationSar, null);

const duplicateBinding = fixture();
duplicateBinding.sourceProvenanceBindings.push({ ...duplicateBinding.sourceProvenanceBindings[0] });
const duplicateBindingResult = evaluateC3IC2SGovernedReconciliation(duplicateBinding);
assert.equal(duplicateBindingResult.status, RECONCILIATION_GATE_STATUS.HOLD_EVIDENCE);
assert.ok(duplicateBindingResult.blockers.some((blocker) => blocker.includes('C3I_C2S_DUPLICATE_EVIDENCE_BINDING:')));

const missingC3MDraft = fixture();
missingC3MDraft.wholePropertyMarketInputsByIndicationId = {};
const missingC3MDraftResult = evaluateC3IC2SGovernedReconciliation(missingC3MDraft);
assert.equal(missingC3MDraftResult.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(missingC3MDraftResult.blockers.includes('C3I_C2S_C3M_INPUT_DRAFT_REQUIRED:market-sales'));
assert.equal(missingC3MDraftResult.analyticalValueIndicationSar, null);

const baselineMarket = marketEvidence();
const baselineBinding = marketContextBinding();
const baselineCanonical = canonicalMarketPacketAndResult(baselineMarket, baselineBinding);
const changedMarket = marketEvidence([
  saleRecord(1, 10100000),
  saleRecord(2, 9600000),
  saleRecord(3, 10200000),
]);
const staleMarketResultInput = fixture({
  marketEvidence: changedMarket,
  marketSourceResult: baselineCanonical.result,
});
const staleMarketResult = evaluateC3IC2SGovernedReconciliation(staleMarketResultInput);
assert.equal(staleMarketResult.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(staleMarketResult.blockers.some((blocker) => blocker.startsWith('C3I_C2S_C3M_CANONICAL_RESULT_MISMATCH:market-sales:')));
assert.equal(staleMarketResult.analyticalValueIndicationSar, null);

const forgedInputHashInput = fixture();
forgedInputHashInput.methodIndications = methods({
  ...forgedInputHashInput.methodIndications[0].sourceResult,
  inputPacketHashSha256: 'f'.repeat(64),
});
const forgedInputHashResult = evaluateC3IC2SGovernedReconciliation(forgedInputHashInput);
assert.equal(forgedInputHashResult.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(forgedInputHashResult.blockers.some((blocker) => blocker.includes('C3I_C2S_C3M_CANONICAL_RESULT_MISMATCH:market-sales:inputPacketHashSha256')));

function heldForMarketMutation(mutator, expectedField) {
  const input = fixture();
  const original = input.methodIndications[0].sourceResult;
  input.methodIndications = methods(mutator({ ...original }));
  const result = evaluateC3IC2SGovernedReconciliation(input);
  assert.equal(result.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
  assert.equal(result.decisionReady, false);
  assert.equal(result.analyticalValueIndicationSar, null);
  assert.ok(result.blockers.some((blocker) => blocker.includes(`C3I_C2S_C3M_CANONICAL_RESULT_MISMATCH:market-sales:${expectedField}`)), result.blockers.join('\n'));
}

heldForMarketMutation((result) => ({ ...result, status: 'READY' }), 'status');
heldForMarketMutation((result) => ({ ...result, indicationType: 'GENERIC_MARKET_VALUE_INDICATION' }), 'indicationType');
heldForMarketMutation((result) => ({ ...result, transactionAuthorized: true }), 'transactionAuthorized');
heldForMarketMutation((result) => ({ ...result, calculationHashSha256: '9'.repeat(64) }), 'calculationHashSha256');

const landOnlyMarket = {
  modelVersion: 'LAND_SALES_COMPARISON_1.0',
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  calculationHashSha256: 'f'.repeat(64),
  status: 'LAND_VALUE_INDICATION_READY',
  indicationType: 'LAND_SALES_COMPARISON_VALUE_INDICATION',
  landValueIndicationSar: 7000000,
  finalValuationConclusionEstablished: false,
  certifiedValuationEstablished: false,
  transactionAuthorized: false,
};
const scopeHeldInput = fixture();
scopeHeldInput.methodIndications = [
  method('market-land-only', landOnlyMarket),
  method('income-cap', incomeResult()),
  method('cost-1', costResult()),
];
scopeHeldInput.wholePropertyMarketInputsByIndicationId = {};
scopeHeldInput.governedReconciliationPolicies = governedPolicies({
  allowedModelVersions: ['LAND_SALES_COMPARISON_1.0', 'DIRECT_CAPITALIZATION_1.0', 'COST_APPROACH_1.0'],
});
scopeHeldInput.reconciliationInstruction = instruction({
  weightsByIndicationId: { 'market-land-only': 0.35, 'income-cap': 0.35, 'cost-1': 0.30 },
});
const scopeHeld = evaluateC3IC2SGovernedReconciliation(scopeHeldInput);
assert.equal(scopeHeld.status, RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION);
assert.ok(scopeHeld.blockers.some((blocker) => blocker.includes('C3_POLICY_MODEL_SCOPE_MISMATCH:LAND_SALES_COMPARISON_1.0:LAND_ONLY/WHOLE_PROPERTY')));
assert.equal(scopeHeld.analyticalValueIndicationSar, null);

console.log('C3I_C2S_GOVERNED_RECONCILIATION_INTEGRATION=PASS');