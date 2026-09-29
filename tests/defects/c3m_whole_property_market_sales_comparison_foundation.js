'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const {
  MARKET_EVIDENCE_TYPE,
  MARKET_EVIDENCE_CLASS,
  MARKET_VERIFICATION_STATUS,
  MARKET_RESOLUTION_METHOD,
} = require('../../src/contracts/market-evidence');
const {
  WHOLE_PROPERTY_UNIT_OF_COMPARISON,
  WHOLE_PROPERTY_ADJUSTMENT_DIRECTION,
  WHOLE_PROPERTY_ADJUSTMENT_METHOD,
  WHOLE_PROPERTY_ADJUSTMENT_FACTOR,
  WHOLE_PROPERTY_SALES_INPUT_STATUS,
  WHOLE_PROPERTY_SALES_RESULT_STATUS,
} = require('../../src/contracts/whole-property-sales-comparison');
const {
  buildWholePropertySalesComparisonInputPacket,
  verifyWholePropertySalesComparisonInputIntegrity,
} = require('../../src/valuation/whole-property-sales-comparison-input');
const {
  calculateWholePropertySalesComparisonIndication,
} = require('../../src/engines/valuation/whole-property-sales-comparison');

const AS_OF = '2026-09-29T19:30:00.000Z';
const CASE_ID = 'case-c3m-001';
const PROPERTY_REF = 'property-c3m-001';
const VALUATION_DATE = '2026-09-29T00:00:00.000Z';
const ASSET_TYPE = 'OFFICE';
const MARKET_CONTEXT_ID = 'riyadh-office-c3m-001';
const GEOGRAPHY_KEY = 'SA-RIYADH-OLAYA';
const UNIT = WHOLE_PROPERTY_UNIT_OF_COMPARISON.GROSS_BUILDING_AREA_SQM;
const MARKET_VERIFIER = 'C3M-MARKET-VERIFIER';
const MARKET_FRESHNESS = 'C3M-MARKET-FRESHNESS';
const MARKET_MIN_POLICY = 'C3M-C2-MIN-3';
const MARKET_BINDER = 'C3M-MARKET-BINDER';
const MEASUREMENT_VERIFIER = 'C3M-MEASUREMENT-VERIFIER';
const SELECTOR = 'C3M-COMPARABLE-SELECTOR';
const ADJUSTMENT_REVIEWER = 'C3M-ADJUSTMENT-REVIEWER';
const RECONCILER = 'C3M-RECONCILER';
const RECON_POLICY = 'C3M-OFFICE-GBA-POLICY';

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, Object.create(null));
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function propertyEvidencePacket() {
  const measurement = {
    class: 'PROFESSIONAL_MEASUREMENT',
    measurementId: 'subject-gba-001',
    type: 'GROSS_BUILDING_AREA',
    value: 2500,
    unit: 'sqm',
    source: 'PROFESSIONAL_INSPECTION',
    sourceEvidenceRef: 'MEASURE-SUBJECT-001',
    measurementStandardRef: 'MEASUREMENT-STANDARD-001',
    measurementMethod: 'FIELD_AND_DOCUMENT_RECONCILIATION',
    measuredByRef: 'SUBJECT-MEASURER',
    measuredAt: '2026-09-29T10:00:00.000Z',
    measurementHashSha256: 'd'.repeat(64),
  };
  const core = {
    schemaVersion: 1,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    assignmentRef: 'ASSIGNMENT-C3M-001',
    assignmentHashSha256: '1'.repeat(64),
    inspectionId: 'INSPECTION-C3M-001',
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
    packetHashSha256: sha256(core),
    status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW',
    reasons: [],
    professionalValuationWorkflowReady: true,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

function saleRecord(index, amountSar, overrides = {}) {
  return {
    id: `c3m-sale-${index}`,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    evidenceType: MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    evidenceClass: MARKET_EVIDENCE_CLASS.AUTHORITATIVE_CLOSED_TRANSACTION,
    normalizedValue: { amountSar, areaSqm: 1000 },
    sourceId: 'REGA_REAL_ESTATE_INDICATORS',
    sourceReference: `REGA-C3M-${index}`,
    sourceUrl: 'https://rei.rega.gov.sa/ar/advanced-search/deals',
    transactionKey: `C3M-TX-${index}`,
    resolutionMethod: MARKET_RESOLUTION_METHOD.OFFICIAL_TRANSACTION_RECORD,
    verificationStatus: MARKET_VERIFICATION_STATUS.VERIFIED,
    verifiedBy: MARKET_VERIFIER,
    verificationReference: `C3M-MARKET-VERIFY-${index}`,
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
    bindingId: 'c3m-market-binding-001',
    propertyRef: PROPERTY_REF,
    marketContextId: MARKET_CONTEXT_ID,
    geographyKey: GEOGRAPHY_KEY,
    assetType: ASSET_TYPE,
    boundBy: MARKET_BINDER,
    bindingReference: 'C3M-MARKET-BINDING-REF-001',
    boundAt: '2026-09-29T17:00:00.000Z',
    ...overrides,
  };
}

function comparableMeasurements(overrides = {}) {
  const rows = [1, 2, 3].map((index) => ({
    comparableId: `comp-${index}`,
    transactionKey: `C3M-TX-${index}`,
    sourcePropertyRef: `source-property-${index}`,
    assetType: ASSET_TYPE,
    unitOfComparison: UNIT,
    basisQuantity: 2000,
    sourceRef: `MEASUREMENT-SOURCE-${index}`,
    verifiedBy: MEASUREMENT_VERIFIER,
    verificationReference: `MEASUREMENT-VERIFY-${index}`,
    verifiedAt: '2026-09-29T17:15:00.000Z',
  }));
  for (const [index, patch] of Object.entries(overrides)) rows[Number(index)] = { ...rows[Number(index)], ...patch };
  return rows;
}

function adjustmentRecords(overrides = {}) {
  const rows = [{
    adjustmentId: 'adj-comp-2-location',
    comparableId: 'comp-2',
    factor: WHOLE_PROPERTY_ADJUSTMENT_FACTOR.LOCATION,
    direction: WHOLE_PROPERTY_ADJUSTMENT_DIRECTION.INCREASE,
    method: WHOLE_PROPERTY_ADJUSTMENT_METHOD.PERCENT_OF_BASE,
    magnitude: 0.05,
    rationale: 'Comparable location is professionally assessed as inferior to the subject.',
    evidenceRefs: ['ADJ-EVIDENCE-LOCATION-001'],
    reviewedBy: ADJUSTMENT_REVIEWER,
    reviewReference: 'ADJ-REVIEW-001',
    reviewedAt: '2026-09-29T17:40:00.000Z',
  }];
  if (overrides[0]) rows[0] = { ...rows[0], ...overrides[0] };
  return rows;
}

function policy(overrides = {}) {
  return {
    [RECON_POLICY]: {
      allowedUnitsOfComparison: [UNIT],
      allowedAssetTypes: [ASSET_TYPE],
      minimumComparableCount: 3,
      maxSingleComparableWeight: 0.5,
      maxSingleAdjustmentPercent: 0.2,
      maxNetAdjustmentPercent: 0.25,
      maxGrossAdjustmentPercent: 0.4,
      maxAdjustedUnitSpreadRatio: 0.2,
      requireAllSelectedWeighted: true,
      requireAdjustmentDisposition: true,
      ...overrides,
    },
  };
}

function build(overrides = {}) {
  return buildWholePropertySalesComparisonInputPacket({
    packetId: 'c3m-input-001',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    valuationDate: VALUATION_DATE,
    asOf: AS_OF,
    unitOfComparison: UNIT,
    subjectMeasurementId: 'subject-gba-001',
    subjectPropertyEvidencePacket: propertyEvidencePacket(),
    marketEvidence: marketEvidence(),
    marketContextBinding: marketContextBinding(),
    trustedMarketContextBinderIds: [MARKET_BINDER],
    comparableMeasurements: comparableMeasurements(),
    trustedMeasurementVerifierIds: [MEASUREMENT_VERIFIER],
    selectedComparableIds: ['comp-1', 'comp-2', 'comp-3'],
    selectionRationales: {
      'comp-1': 'Same asset class and governed market context.',
      'comp-2': 'Same asset class; location difference is explicitly adjusted.',
      'comp-3': 'Same asset class and similar physical basis.',
    },
    selectedBy: SELECTOR,
    selectionReference: 'C3M-SELECTION-REF-001',
    selectedAt: '2026-09-29T17:30:00.000Z',
    trustedComparableSelectorIds: [SELECTOR],
    adjustmentRecords: adjustmentRecords(),
    noAdjustmentRationales: {
      'comp-1': 'No material adjustment identified after professional review.',
      'comp-3': 'No material adjustment identified after professional review.',
    },
    trustedAdjustmentReviewerIds: [ADJUSTMENT_REVIEWER],
    reconciliationPolicyId: RECON_POLICY,
    governedReconciliationPolicies: policy(),
    weightsByComparableId: { 'comp-1': 0.4, 'comp-2': 0.3, 'comp-3': 0.3 },
    weightRationales: {
      'comp-1': 'Highest similarity after review.',
      'comp-2': 'Useful but adjusted for location.',
      'comp-3': 'Corroborating whole-property sale.',
    },
    reconciledBy: RECONCILER,
    reconciliationReference: 'C3M-RECON-REF-001',
    reconciledAt: '2026-09-29T18:00:00.000Z',
    trustedReconcilerIds: [RECONCILER],
    ...overrides,
  });
}

const readyPacket = build();
assert.equal(readyPacket.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.READY_FOR_CANONICAL_WHOLE_PROPERTY_SALES_CALCULATION);
assert.equal(readyPacket.readyForCanonicalWholePropertySalesCalculation, true);
assert.equal(readyPacket.valueScope, 'WHOLE_PROPERTY');
assert.equal(readyPacket.unitOfComparison, UNIT);
assert.equal(readyPacket.c2MarketEvidenceReevaluatedInternally, true);
assert.equal(readyPacket.automaticComparableSelection, false);
assert.equal(readyPacket.automaticAdjustmentEstimated, false);
assert.equal(readyPacket.automaticComparableWeighting, false);
assert.equal(verifyWholePropertySalesComparisonInputIntegrity(readyPacket), true);
assert.equal(readyPacket.indications[0].baseUnitValueSar, 5000);
assert.equal(readyPacket.indications[1].baseUnitValueSar, 4800);
assert.equal(readyPacket.indications[1].adjustedUnitValueSar, 5040);
assert.equal(readyPacket.indications[2].adjustedUnitValueSar, 5100);

const result = calculateWholePropertySalesComparisonIndication(readyPacket);
assert.equal(result.status, WHOLE_PROPERTY_SALES_RESULT_STATUS.WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY);
assert.equal(result.modelVersion, 'WHOLE_PROPERTY_SALES_COMPARISON_1.0');
assert.equal(result.approachFamily, 'MARKET');
assert.equal(result.valueScope, 'WHOLE_PROPERTY');
assert.equal(result.reconciledUnitValueSar, 5042);
assert.equal(result.subjectBasisQuantity, 2500);
assert.equal(result.valueIndicationSar, 12605000);
assert.equal(result.finalValuationConclusionEstablished, false);
assert.equal(result.certifiedValuationEstablished, false);
assert.equal(result.transactionAuthorized, false);
assert.equal(result.publicAiAuthorized, false);
assert.match(result.calculationHashSha256, /^[a-f0-9]{64}$/);

const tamperedProperty = propertyEvidencePacket();
tamperedProperty.measurements = [{ ...tamperedProperty.measurements[0], value: 9999 }];
const propertyHeld = build({ subjectPropertyEvidencePacket: tamperedProperty });
assert.equal(propertyHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE);
assert.ok(propertyHeld.blockers.includes('C3M_PROPERTY_EVIDENCE_PACKET_INTEGRITY_FAILED'));

const thinMarketHeld = build({ marketEvidence: marketEvidence([saleRecord(1, 10000000), saleRecord(2, 9600000)]) });
assert.equal(thinMarketHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_EVIDENCE);
assert.ok(thinMarketHeld.blockers.includes('C3M_MARKET_EVIDENCE_NOT_READY'));

const priceOnlyRecords = [
  saleRecord(1, 10000000),
  saleRecord(2, 9600000, { normalizedValue: { pricePerSqmSar: 4800 } }),
  saleRecord(3, 10200000),
];
const amountHeld = build({ marketEvidence: marketEvidence(priceOnlyRecords) });
assert.equal(amountHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_EVIDENCE);
assert.ok(amountHeld.blockers.includes('C3M_C2_TOTAL_SALE_AMOUNT_REQUIRED:comp-2:C3M-TX-2'));

const contextHeld = build({ marketContextBinding: marketContextBinding({ marketContextId: 'unrelated-market-context' }) });
assert.equal(contextHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_MARKET_CONTEXT_BINDING);
assert.ok(contextHeld.blockers.includes('C3M_MARKET_CONTEXT_ID_MISMATCH'));

const basisMismatchHeld = build({
  comparableMeasurements: comparableMeasurements({
    1: { unitOfComparison: WHOLE_PROPERTY_UNIT_OF_COMPARISON.NET_LEASABLE_AREA_SQM },
  }),
});
assert.equal(basisMismatchHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_COMPARABLE_MEASUREMENT);
assert.ok(basisMismatchHeld.blockers.includes('C3M_COMPARABLE_UNIT_BASIS_MISMATCH:comp-2'));

const untrustedMeasurementHeld = build({
  comparableMeasurements: comparableMeasurements({ 0: { verifiedBy: 'CALLER-INVENTED-MEASURER' } }),
});
assert.equal(untrustedMeasurementHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_COMPARABLE_MEASUREMENT);
assert.ok(untrustedMeasurementHeld.blockers.includes('C3M_COMPARABLE_MEASUREMENT_VERIFIER_UNTRUSTED:comp-1'));

const untrustedSelectorHeld = build({ selectedBy: 'CALLER-INVENTED-SELECTOR' });
assert.equal(untrustedSelectorHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_SELECTION);
assert.ok(untrustedSelectorHeld.blockers.includes('C3M_COMPARABLE_SELECTOR_UNTRUSTED:CALLER-INVENTED-SELECTOR'));

const missingDispositionHeld = build({ noAdjustmentRationales: { 'comp-1': 'Reviewed.' } });
assert.equal(missingDispositionHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_ADJUSTMENT);
assert.ok(missingDispositionHeld.blockers.includes('C3M_ADJUSTMENT_DISPOSITION_REQUIRED:comp-3'));

const untrustedAdjustmentHeld = build({
  adjustmentRecords: adjustmentRecords({ 0: { reviewedBy: 'CALLER-INVENTED-REVIEWER' } }),
});
assert.equal(untrustedAdjustmentHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_ADJUSTMENT);
assert.ok(untrustedAdjustmentHeld.blockers.includes('C3M_ADJUSTMENT_REVIEWER_UNTRUSTED:adj-comp-2-location'));

const excessiveAdjustmentHeld = build({
  adjustmentRecords: adjustmentRecords({ 0: { magnitude: 0.25 } }),
});
assert.equal(excessiveAdjustmentHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_ADJUSTMENT);
assert.ok(excessiveAdjustmentHeld.blockers.includes('C3M_SINGLE_ADJUSTMENT_EXCEEDS_POLICY:adj-comp-2-location'));

const overweightHeld = build({
  weightsByComparableId: { 'comp-1': 0.6, 'comp-2': 0.2, 'comp-3': 0.2 },
});
assert.equal(overweightHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_RECONCILIATION);
assert.ok(overweightHeld.blockers.includes('C3M_WEIGHT_EXCEEDS_POLICY:comp-1'));

const divergentMarket = marketEvidence([
  saleRecord(1, 10000000),
  saleRecord(2, 9600000),
  saleRecord(3, 20000000),
]);
const divergenceHeld = build({ marketEvidence: divergentMarket });
assert.equal(divergenceHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_RECONCILIATION);
assert.ok(divergenceHeld.blockers.some((code) => code.startsWith('C3M_ADJUSTED_UNIT_SPREAD_EXCEEDS_POLICY:')));

const invalidUnitHeld = build({ unitOfComparison: 'LAND_AREA_SQM' });
assert.equal(invalidUnitHeld.status, WHOLE_PROPERTY_SALES_INPUT_STATUS.HOLD_INTEGRITY);
assert.ok(invalidUnitHeld.blockers.includes('C3M_UNIT_OF_COMPARISON_INVALID:LAND_AREA_SQM'));

const mutatedPacket = { ...readyPacket, indications: readyPacket.indications.map((item, index) => index === 0 ? { ...item, adjustedUnitValueSar: 9000 } : item) };
assert.equal(verifyWholePropertySalesComparisonInputIntegrity(mutatedPacket), false);
const engineHeld = calculateWholePropertySalesComparisonIndication(mutatedPacket);
assert.equal(engineHeld.status, WHOLE_PROPERTY_SALES_RESULT_STATUS.INVALID_INPUT_PACKET);
assert.equal(engineHeld.valueIndicationSar, null);

console.log('C3M_WHOLE_PROPERTY_MARKET_SALES_COMPARISON_FOUNDATION=PASS');
