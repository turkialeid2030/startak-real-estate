'use strict';

const assert = require('assert');
const {
  MARKET_EVIDENCE_LEVEL,
  MARKET_EVIDENCE_RANK,
  MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
  COMPARABLE_QUALITY_STATUS,
  createComparableEvidenceRecord,
  createComparableFingerprint,
  evaluateComparableSetQuality,
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

const CASE_ID = 'CASE-9A-001';

function comparable({
  id,
  propertyRef = id,
  level = MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
  status = MARKET_VERIFICATION_STATUS.VERIFIED,
  transactionDate = '2026-07-01T00:00:00Z',
  sourceDate = '2026-07-05T00:00:00Z',
  areaSqm = 1000,
  amountSar = 10000000,
  abnormalTransaction = false,
  abnormalRationale = null,
} = {}) {
  return createComparableEvidenceRecord({
    comparableId: id,
    caseId: CASE_ID,
    sourcePropertyRef: propertyRef,
    assetType: 'OFFICE',
    transactionType: MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel: level,
    sourceName: 'SYNTHETIC MARKET SOURCE',
    sourceRef: `SOURCE-${id}`,
    sourceUrl: null,
    sourceDate,
    transactionDate,
    location: { city: 'RIYADH', district: 'SYNTHETIC_DISTRICT', lat: 24.7, long: 46.7 },
    areaSqm,
    amountSar,
    verification: {
      status,
      verifiedByRef: status === MARKET_VERIFICATION_STATUS.NOT_VERIFIED ? null : 'USER:MARKET-ANALYST',
      verifiedAt: status === MARKET_VERIFICATION_STATUS.NOT_VERIFIED ? null : '2026-07-06T00:00:00Z',
      evidenceRef: status === MARKET_VERIFICATION_STATUS.NOT_VERIFIED ? null : `evidence://${id}`,
    },
    abnormalTransaction,
    abnormalRationale,
    capturedAt: '2026-07-07T00:00:00Z',
  });
}

check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION], 'official registered transaction outranks verified transaction');
check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION], 'verified transaction outranks confirmed transaction');
check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER], 'confirmed transaction outranks verified offer');
check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.BROKER_CONFIRMED], 'verified offer outranks broker-confirmed evidence');
check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.BROKER_CONFIRMED] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.PUBLIC_AD], 'broker-confirmed evidence outranks public ad');
check(MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.PUBLIC_AD] > MARKET_EVIDENCE_RANK[MARKET_EVIDENCE_LEVEL.UNVERIFIED], 'public ad outranks unverified evidence');

const c1 = comparable({ id: 'C1', amountSar: 10000000 });
const c2 = comparable({ id: 'C2', propertyRef: 'P2', amountSar: 10500000 });
const c3 = comparable({ id: 'C3', propertyRef: 'P3', amountSar: 9500000 });
check(c1.unitValueSarPerSqm === 10000, 'unit value normalizes deterministically to SAR/sqm');
check(/^[a-f0-9]{64}$/.test(c1.comparableHashSha256), 'comparable record has deterministic SHA-256');
check(c1.professionalSelectionMade === false && c1.valuationWeightAssigned === false, 'market record is not automatically selected or weighted');
check(createComparableFingerprint(c1) === createComparableFingerprint(c1), 'comparable fingerprint is deterministic');

throwsWith(() => comparable({
  id: 'BAD-VERIFICATION',
  level: MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
  status: MARKET_VERIFICATION_STATUS.CONFIRMED,
}), 'EVIDENCE_LEVEL_REQUIRES_VERIFIED_STATUS', 'verified transaction level cannot be claimed from merely confirmed evidence');

throwsWith(() => comparable({
  id: 'BAD-ABNORMAL', abnormalTransaction: true, abnormalRationale: null,
}), 'abnormalRationale', 'abnormal transaction flag requires rationale');

const qualified = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, c2, c3],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
  unitValueRangeSarPerSqm: { min: 7000, max: 13000 },
  contradictionTolerance: { absoluteSarPerSqm: 100, relative: 0.01 },
});
check(qualified.status === COMPARABLE_QUALITY_STATUS.QUALIFIED_FOR_PROFESSIONAL_SELECTION, 'clean comparable set qualifies for professional selection');
check(qualified.qualifiedComparableIds.length === 3, 'three qualified comparables retained');
check(qualified.professionalSelectionRequired === true && qualified.automaticComparableSelection === false, 'quality qualification still requires professional selection');
check(qualified.automaticValuationWeighting === false && qualified.valuationConclusionProduced === false, 'market quality module produces no automatic weighting or valuation conclusion');
check(qualified.transactionAuthorized === false && qualified.certifiedValuationEstablished === false, 'market evidence creates no certification or transaction authority');

const stale = comparable({ id: 'STALE', propertyRef: 'P-STALE', transactionDate: '2024-01-01T00:00:00Z', sourceDate: '2024-01-02T00:00:00Z' });
const staleResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, c2, stale],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});
check(staleResult.status === COMPARABLE_QUALITY_STATUS.HOLD_INSUFFICIENT_EVIDENCE, 'stale comparable is excluded from qualified count');
check(staleResult.blockers.some((item) => item.startsWith('STALE_COMPARABLE:STALE')), 'stale comparable blocker is explicit');

const duplicate = comparable({ id: 'DUP', propertyRef: c1.sourcePropertyRef, transactionDate: c1.transactionDate, areaSqm: c1.areaSqm, amountSar: c1.amountSar });
const duplicateResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, duplicate, c2, c3],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});
check(duplicateResult.status === COMPARABLE_QUALITY_STATUS.HOLD_QUALITY, 'duplicate evidence holds quality even when enough other comparables remain');
check(duplicateResult.blockers.some((item) => item.startsWith('DUPLICATE_COMPARABLE:DUP:C1')), 'duplicate source fingerprint is traceable');

const abnormal = comparable({ id: 'ABNORMAL', propertyRef: 'P-ABNORMAL', abnormalTransaction: true, abnormalRationale: 'Synthetic non-arm-length condition requiring professional review' });
const abnormalResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, c2, c3, abnormal],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});
check(abnormalResult.status === COMPARABLE_QUALITY_STATUS.HOLD_QUALITY, 'abnormal transaction requires professional disposition');
check(abnormalResult.blockers.some((item) => item.startsWith('ABNORMAL_TRANSACTION_REQUIRES_PROFESSIONAL_DISPOSITION:ABNORMAL')), 'abnormal transaction blocker is explicit');

const publicAd = comparable({
  id: 'PUBLIC', propertyRef: 'P-PUBLIC', level: MARKET_EVIDENCE_LEVEL.PUBLIC_AD, status: MARKET_VERIFICATION_STATUS.NOT_VERIFIED,
});
const evidenceFloorResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, c2, publicAd],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
});
check(evidenceFloorResult.status === COMPARABLE_QUALITY_STATUS.HOLD_INSUFFICIENT_EVIDENCE, 'evidence below configured hierarchy floor does not qualify');
check(evidenceFloorResult.blockers.some((item) => item.startsWith('EVIDENCE_LEVEL_BELOW_MINIMUM:PUBLIC')), 'evidence hierarchy floor blocker is explicit');

const outlier = comparable({ id: 'OUTLIER', propertyRef: 'P-OUTLIER', amountSar: 30000000 });
const outlierResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [c1, c2, c3, outlier],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
  unitValueRangeSarPerSqm: { min: 7000, max: 13000 },
});
check(outlierResult.warnings.includes('UNIT_VALUE_OUTLIER_REVIEW_REQUIRED:OUTLIER'), 'configured outlier is flagged for review rather than silently deleted');
check(outlierResult.qualifiedComparableIds.includes('OUTLIER'), 'outlier flag alone does not manufacture an automatic exclusion decision');

const contradictionA = comparable({ id: 'CON-A', propertyRef: 'P-CON', amountSar: 10000000 });
const contradictionB = comparable({ id: 'CON-B', propertyRef: 'P-CON', amountSar: 12000000 });
const contradictionResult = evaluateComparableSetQuality({
  caseId: CASE_ID,
  records: [contradictionA, contradictionB, c2, c3],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 3,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.VERIFIED_OFFER,
  contradictionTolerance: { absoluteSarPerSqm: 50, relative: 0.01 },
});
check(contradictionResult.status === COMPARABLE_QUALITY_STATUS.HOLD_QUALITY, 'contradictory evidence for same property/date holds quality');
check(contradictionResult.blockers.some((item) => item.startsWith('CONTRADICTORY_MARKET_EVIDENCE:CON-A,CON-B')), 'contradiction is source-traceable');

throwsWith(() => evaluateComparableSetQuality({
  caseId: 'CASE-OTHER',
  records: [c1],
  asOfDate: '2026-09-07T00:00:00Z',
  maxAgeDays: 365,
  minimumComparableCount: 1,
  minimumEvidenceLevel: MARKET_EVIDENCE_LEVEL.UNVERIFIED,
}), 'CASE_ISOLATION_VIOLATION', 'cross-case market evidence is rejected');

console.log(`WAVE_9A_MARKET_COMPARABLE_EVIDENCE=PASS checks=${checks}`);
