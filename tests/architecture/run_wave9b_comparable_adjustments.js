'use strict';

const assert = require('assert');
const {
  MARKET_EVIDENCE_LEVEL,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  evaluateComparableSetQuality,
  createComparableEvidenceRecord,
  COMPARABLE_SELECTION_STATUS,
  ADJUSTMENT_FACTOR,
  ADJUSTMENT_DIRECTION,
  ADJUSTMENT_METHOD,
  ADJUSTMENT_CONFIDENCE,
  ADJUSTMENT_ANALYSIS_STATUS,
  CALCULATION_CONVENTION,
  recordProfessionalComparableSelection,
  createComparableAdjustmentRecord,
  buildComparableAdjustmentAnalysis,
} = require('../../src/market');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function throwsWith(fn, fragment, message) {
  let ok = false;
  try { fn(); } catch (error) { ok = String(error.message).includes(fragment); }
  check(ok, message);
}

const CASE_ID = 'CASE-9B-001';

function comparable(id, amountSar, propertyRef = id) {
  return createComparableEvidenceRecord({
    comparableId: id,
    caseId: CASE_ID,
    sourcePropertyRef: propertyRef,
    assetType: 'OFFICE',
    transactionType: MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
    sourceName: 'SYNTHETIC VERIFIED SOURCE',
    sourceRef: `SOURCE-${id}`,
    sourceDate: '2026-07-02T00:00:00Z',
    transactionDate: '2026-07-01T00:00:00Z',
    location: { city: 'RIYADH', district: 'SYNTHETIC_DISTRICT' },
    areaSqm: 1000,
    amountSar,
    verification: {
      status: MARKET_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'USER:MARKET-ANALYST',
      verifiedAt: '2026-07-03T00:00:00Z',
      evidenceRef: `evidence://${id}`,
    },
    capturedAt: '2026-07-04T00:00:00Z',
  });
}

const c1 = comparable('C1', 10000000, 'P1');
const c2 = comparable('C2', 10500000, 'P2');
const c3 = comparable('C3', 9500000, 'P3');
const records = [c1, c2, c3];
const quality = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records,
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});

const selection = recordProfessionalComparableSelection({
  caseId: CASE_ID,
  qualityGate: quality,
  records,
  selectedComparableIds: ['C1', 'C2'],
  selectionRationales: {
    C1: 'Closest verified transaction by location and use.',
    C2: 'Secondary verified office transaction with similar scale.',
  },
  selectedByRef: 'USER:VALUER',
  selectionEvidenceRef: 'review://comparable-selection',
  selectedAt: '2026-09-07T09:00:00Z',
  minimumSelectedCount: 2,
});
check(selection.status === COMPARABLE_SELECTION_STATUS.READY_FOR_ADJUSTMENT_ANALYSIS, 'qualified human selection becomes ready for adjustment analysis');
check(selection.professionalSelectionRecorded === true, 'professional selection is explicitly recorded');
check(selection.automaticComparableSelection === false && selection.automaticValuationWeighting === false, 'selection does not create automatic selection or weights');
check(selection.selected.length === 2 && selection.selected[0].rationale.length > 0, 'selected comparables preserve professional rationale');
check(/^[a-f0-9]{64}$/.test(selection.selectionHashSha256), 'selection has deterministic SHA-256');

const badQualitySelection = recordProfessionalComparableSelection({
  caseId: CASE_ID,
  qualityGate: { ...quality, status: 'HOLD_QUALITY' },
  records,
  selectedComparableIds: ['C1'],
  selectionRationales: { C1: 'x' },
  selectedByRef: 'USER:VALUER',
  selectionEvidenceRef: 'review://selection',
  selectedAt: '2026-09-07T09:00:00Z',
});
check(badQualitySelection.status === COMPARABLE_SELECTION_STATUS.HOLD_QUALITY_GATE, 'selection cannot bypass comparable quality gate');

const badIdSelection = recordProfessionalComparableSelection({
  caseId: CASE_ID,
  qualityGate: quality,
  records,
  selectedComparableIds: ['C1', 'NOT-QUALIFIED'],
  selectionRationales: { C1: 'x', 'NOT-QUALIFIED': 'x' },
  selectedByRef: 'USER:VALUER',
  selectionEvidenceRef: 'review://selection',
  selectedAt: '2026-09-07T09:00:00Z',
  minimumSelectedCount: 2,
});
check(badIdSelection.status === COMPARABLE_SELECTION_STATUS.HOLD_SELECTION, 'non-qualified comparable cannot be selected into professional adjustment workflow');
check(badIdSelection.reasons.some((item) => item.includes('SELECTED_COMPARABLE_NOT_QUALITY_QUALIFIED')), 'selection hold explains non-qualified comparable');

function adjustment(overrides = {}) {
  return createComparableAdjustmentRecord({
    adjustmentId: 'A1',
    caseId: CASE_ID,
    comparableId: 'C1',
    factor: ADJUSTMENT_FACTOR.TIME_MARKET_CONDITIONS,
    factorLabel: null,
    direction: ADJUSTMENT_DIRECTION.INCREASE,
    method: ADJUSTMENT_METHOD.PERCENT_OF_BASE,
    magnitude: 0.05,
    rationale: 'Explicit synthetic time adjustment supplied by professional user.',
    evidenceRefs: ['evidence://market-time-series'],
    confidence: ADJUSTMENT_CONFIDENCE.HIGH,
    preparedByRef: 'USER:VALUER',
    preparedAt: '2026-09-07T09:05:00Z',
    reviewedByRef: 'USER:REVIEWER',
    reviewedAt: '2026-09-07T09:10:00Z',
    reviewEvidenceRef: 'review://A1',
    ...overrides,
  });
}

const a1 = adjustment();
const a2 = adjustment({
  adjustmentId: 'A2',
  factor: ADJUSTMENT_FACTOR.SIZE,
  direction: ADJUSTMENT_DIRECTION.DECREASE,
  method: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  magnitude: 200,
  rationale: 'Explicit synthetic size adjustment.',
  evidenceRefs: ['evidence://size-analysis'],
  confidence: ADJUSTMENT_CONFIDENCE.MODERATE,
  reviewEvidenceRef: 'review://A2',
});
const a3 = adjustment({
  adjustmentId: 'A3',
  comparableId: 'C2',
  factor: ADJUSTMENT_FACTOR.LOCATION,
  direction: ADJUSTMENT_DIRECTION.DECREASE,
  magnitude: 0.02,
  rationale: 'Explicit synthetic location adjustment.',
  evidenceRefs: ['evidence://location-analysis'],
  reviewEvidenceRef: 'review://A3',
});
const a4 = adjustment({
  adjustmentId: 'A4',
  comparableId: 'C2',
  factor: ADJUSTMENT_FACTOR.PARKING,
  direction: ADJUSTMENT_DIRECTION.NONE,
  method: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  magnitude: 0,
  rationale: 'Parking considered comparable; no adjustment.',
  evidenceRefs: ['evidence://parking-comparison'],
  reviewEvidenceRef: 'review://A4',
});
check(a1.professionalJudgmentSuppliedByUser === true && a1.automaticAdjustmentEstimated === false, 'adjustment magnitude is explicit professional input, not an estimate from this module');
check(/^[a-f0-9]{64}$/.test(a1.adjustmentHashSha256), 'adjustment record has deterministic SHA-256');

throwsWith(() => adjustment({ direction: ADJUSTMENT_DIRECTION.NONE, magnitude: 0.1 }), 'NONE_DIRECTION_REQUIRES_ZERO_MAGNITUDE', 'NONE direction cannot hide a non-zero adjustment');
throwsWith(() => adjustment({ factor: ADJUSTMENT_FACTOR.OTHER, factorLabel: null }), 'OTHER_FACTOR_REQUIRES_LABEL', 'OTHER adjustment factor requires explicit label');
throwsWith(() => adjustment({ reviewedAt: '2026-09-07T09:00:00Z' }), 'ADJUSTMENT_REVIEW_BEFORE_PREPARATION', 'review cannot predate adjustment preparation');

const analysis = buildComparableAdjustmentAnalysis({
  caseId: CASE_ID,
  selection,
  records,
  adjustmentRecords: [a1, a2, a3, a4],
  calculationConvention: CALCULATION_CONVENTION.ADDITIVE_TO_BASE_UNIT_VALUE,
  materialNetAdjustmentThreshold: 0.25,
  materialGrossAdjustmentThreshold: 0.40,
  materialSinglePercentAdjustmentThreshold: 0.20,
});
check(analysis.status === ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION, 'bounded reviewed adjustments become ready for professional reconciliation');
check(analysis.reconciliationReady === true && analysis.professionalReconciliationRequired === true, 'adjustment arithmetic can be ready while reconciliation remains professional');
check(analysis.indications[0].adjustedUnitValueSarPerSqm === 10300, 'C1 adjusted indication uses explicit additive-to-base convention');
check(analysis.indications[1].adjustedUnitValueSarPerSqm === 10290, 'C2 percent adjustment is deterministic');
check(analysis.indications.every((item) => item.valuationWeight === null), 'no valuation weight is manufactured');
check(analysis.automaticValuationWeighting === false && analysis.valuationConclusionProduced === false, 'adjustment analysis creates neither weights nor final value');
check(analysis.indications[0].adjustmentTrace.every((item) => item.rationale && item.evidenceRefs.length && item.reviewEvidenceRef), 'adjustment trace preserves rationale, evidence and review provenance');
check(/^[a-f0-9]{64}$/.test(analysis.analysisHashSha256), 'adjustment analysis has deterministic SHA-256');
check(analysis.transactionAuthorized === false && analysis.certifiedValuationEstablished === false, 'adjustment analysis creates no transaction or certification authority');

const material = adjustment({
  adjustmentId: 'MAT',
  comparableId: 'C1',
  factor: ADJUSTMENT_FACTOR.LOCATION,
  direction: ADJUSTMENT_DIRECTION.INCREASE,
  magnitude: 0.30,
  rationale: 'Synthetic deliberately material adjustment.',
  evidenceRefs: ['evidence://material-location'],
  reviewEvidenceRef: 'review://MAT',
});
const materialAnalysis = buildComparableAdjustmentAnalysis({
  caseId: CASE_ID,
  selection,
  records,
  adjustmentRecords: [material],
  materialSinglePercentAdjustmentThreshold: 0.20,
  materialNetAdjustmentThreshold: 0.25,
  materialGrossAdjustmentThreshold: 0.40,
});
check(materialAnalysis.status === ADJUSTMENT_ANALYSIS_STATUS.REVIEW_REQUIRED, 'material adjustment emits explicit professional review state');
check(materialAnalysis.reconciliationReady === false, 'material review flag blocks reconciliation readiness');
check(materialAnalysis.reviewFlags.some((item) => item.startsWith('MATERIAL_SINGLE_ADJUSTMENT_REVIEW_REQUIRED:')), 'single material adjustment flag is traceable');

const duplicateFactor = adjustment({ adjustmentId: 'DUP', rationale: 'duplicate factor', reviewEvidenceRef: 'review://DUP' });
const duplicateAnalysis = buildComparableAdjustmentAnalysis({
  caseId: CASE_ID,
  selection,
  records,
  adjustmentRecords: [a1, duplicateFactor],
});
check(duplicateAnalysis.status === ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT, 'duplicate factor for the same comparable fails closed');
check(duplicateAnalysis.reasons.some((item) => item.includes('DUPLICATE_ADJUSTMENT_FACTOR')), 'duplicate factor hold is explicit');

const unselected = adjustment({
  adjustmentId: 'UNSELECTED',
  comparableId: 'C3',
  factor: ADJUSTMENT_FACTOR.LOCATION,
  rationale: 'should not be accepted',
  reviewEvidenceRef: 'review://UNSELECTED',
});
const unselectedAnalysis = buildComparableAdjustmentAnalysis({ caseId: CASE_ID, selection, records, adjustmentRecords: [unselected] });
check(unselectedAnalysis.status === ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT, 'adjustment for unselected comparable fails closed');

const excessive = adjustment({
  adjustmentId: 'EXCESS',
  comparableId: 'C1',
  factor: ADJUSTMENT_FACTOR.OTHER,
  factorLabel: 'Synthetic destructive adjustment',
  direction: ADJUSTMENT_DIRECTION.DECREASE,
  method: ADJUSTMENT_METHOD.AMOUNT_SAR_PER_SQM,
  magnitude: 12000,
  rationale: 'Synthetic negative-value test.',
  evidenceRefs: ['evidence://negative-test'],
  reviewEvidenceRef: 'review://EXCESS',
});
const excessiveAnalysis = buildComparableAdjustmentAnalysis({ caseId: CASE_ID, selection, records, adjustmentRecords: [excessive] });
check(excessiveAnalysis.status === ADJUSTMENT_ANALYSIS_STATUS.HOLD_ADJUSTMENT, 'non-positive adjusted indication fails closed');
check(excessiveAnalysis.reasons.includes('ADJUSTED_UNIT_VALUE_NON_POSITIVE:C1'), 'non-positive adjusted indication hold is explicit');

throwsWith(() => buildComparableAdjustmentAnalysis({
  caseId: CASE_ID,
  selection,
  records,
  adjustmentRecords: [{ ...a1, caseId: 'CASE-OTHER' }],
}), 'CASE_ISOLATION_VIOLATION', 'cross-case adjustment evidence is rejected');

console.log(`WAVE_9B_COMPARABLE_ADJUSTMENTS=PASS checks=${checks}`);
