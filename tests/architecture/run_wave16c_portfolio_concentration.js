'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  WEIGHT_BASIS,
  EXPOSURE_BASIS,
  PORTFOLIO_STATUS,
  createPortfolioMember,
  verifyPortfolioMember,
  createPortfolioSnapshot,
  verifyPortfolioSnapshot,
} = require('../../src/portfolio');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function member(id, weight, amount, overrides = {}) {
  return createPortfolioMember({
    memberId: `MEM-${id}`,
    assetId: `ASSET-${id}`,
    caseId: `CASE-${id}`,
    propertyRef: `PROPERTY-${id}`,
    assetClass: id === 'A' ? 'OFFICE' : id === 'B' ? 'LOGISTICS' : 'RETAIL',
    geography: id === 'C' ? 'JEDDAH' : 'RIYADH',
    sector: id === 'B' ? 'INDUSTRIAL' : 'COMMERCIAL',
    exposureAmount: amount,
    currency: 'SAR',
    exposureBasis: EXPOSURE_BASIS.INVESTED_EQUITY,
    allocationWeight: weight,
    sourceArtifactId: `ART-${id}`,
    sourceArtifactHashSha256: sha(`artifact-${id}`),
    sourceArtifactClassification: 'QUALIFIED_INVESTMENT_ANALYSIS',
    sourceAsOfDate: '2026-09-01',
    membershipRationale: 'Explicit portfolio membership for Wave 16C synthetic fixture.',
    evidenceRefs: [`E-${id}`],
    preparedBy: 'ANALYST-1',
    reviewedBy: 'REVIEWER-1',
    preparedAt: '2026-09-07T08:00:00Z',
    reviewedAt: '2026-09-07T09:00:00Z',
    riskEvidenceRefs: [`RISK-${id}`],
    ...overrides,
  });
}

const a = member('A', 0.5, 500);
const b = member('B', 0.3, 300);
const c = member('C', 0.2, 200);

check(() => assert.strictEqual(verifyPortfolioMember(a).valid, true));
check(() => assert.strictEqual(a.currency, 'SAR'));
check(() => assert.strictEqual(a.allocationWeight, 0.5));
check(() => assert.strictEqual(a.exposureAmount, 500));
check(() => assert.strictEqual(a.exposureBasis, EXPOSURE_BASIS.INVESTED_EQUITY));
check(() => assert.ok(Object.isFrozen(a)));
check(() => assert.ok(Object.isFrozen(a.evidenceRefs)));

const snapshot = createPortfolioSnapshot({
  snapshotId: 'SNAP-16C-1',
  portfolioId: 'PORT-1',
  portfolioName: 'Synthetic Portfolio',
  asOfDate: '2026-09-08',
  currency: 'SAR',
  weightBasis: WEIGHT_BASIS.CURRENT_EXPOSURE,
  maximumSourceAgeDays: 30,
  members: [a, b, c],
  createdAt: '2026-09-08T05:00:00Z',
});

check(() => assert.strictEqual(snapshot.status, PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY));
check(() => assert.deepStrictEqual(snapshot.blockingCodes, []));
check(() => assert.strictEqual(snapshot.memberCount, 3));
check(() => assert.strictEqual(snapshot.totalExposureAmount, 1000));
check(() => assert.ok(Math.abs(snapshot.weightSum - 1) < 1e-12));
check(() => assert.ok(Math.abs(snapshot.concentration.hhi - 0.38) < 1e-12));
check(() => assert.strictEqual(snapshot.concentration.top1Weight, 0.5));
check(() => assert.ok(Math.abs(snapshot.concentration.top3Weight - 1) < 1e-12));
check(() => assert.ok(Math.abs(snapshot.concentration.top5Weight - 1) < 1e-12));
check(() => assert.deepStrictEqual(snapshot.concentration.byGeography, [
  { key: 'RIYADH', weight: 0.8 },
  { key: 'JEDDAH', weight: 0.2 },
]));
check(() => assert.strictEqual(snapshot.concentration.byAssetClass[0].weight, 0.5));
check(() => assert.strictEqual(snapshot.concentration.bySector[0].key, 'COMMERCIAL'));
check(() => assert.ok(Math.abs(snapshot.exposureWeightReconciliation[0].difference) < 1e-12));
check(() => assert.strictEqual(snapshot.portfolioProbabilisticAggregationPerformed, false));
check(() => assert.strictEqual(snapshot.crossAssetCorrelationModel, 'NOT_MODELED'));
check(() => assert.strictEqual(snapshot.jointDistributionEstablished, false));
check(() => assert.strictEqual(snapshot.portfolioVaRCalculated, false));
check(() => assert.strictEqual(snapshot.diversificationBenefitCalculated, false));
check(() => assert.strictEqual(snapshot.concentrationLimitComplianceDerived, false));
check(() => assert.strictEqual(snapshot.decisionStateDerived, false));
check(() => assert.strictEqual(snapshot.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(snapshot.humanCommitteeDecisionRequired, true));
check(() => assert.strictEqual(snapshot.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(snapshot.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(snapshot.transactionAuthorized, false));
check(() => assert.strictEqual(snapshot.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(verifyPortfolioSnapshot(snapshot).valid, true));
check(() => assert.ok(Object.isFrozen(snapshot)));

const target = createPortfolioSnapshot({
  snapshotId: 'SNAP-TARGET', portfolioId: 'PORT-1', portfolioName: 'Target allocation',
  asOfDate: '2026-09-08', currency: 'SAR', weightBasis: WEIGHT_BASIS.TARGET_ALLOCATION,
  maximumSourceAgeDays: 30,
  members: [member('TA', 0.6, 500), member('TB', 0.4, 500)],
});
check(() => assert.strictEqual(target.status, PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY));
check(() => assert.strictEqual(target.exposureWeightReconciliation[0].impliedExposureWeight, 0.5));
check(() => assert.strictEqual(target.exposureWeightReconciliation[0].allocationWeight, 0.6));

const currentMismatch = createPortfolioSnapshot({
  snapshotId: 'SNAP-MISMATCH', portfolioId: 'PORT-1', portfolioName: 'Current mismatch',
  asOfDate: '2026-09-08', currency: 'SAR', weightBasis: WEIGHT_BASIS.CURRENT_EXPOSURE,
  maximumSourceAgeDays: 30,
  members: [member('MA', 0.6, 500), member('MB', 0.4, 500)],
});
check(() => assert.ok(currentMismatch.blockingCodes.includes(PORTFOLIO_STATUS.HOLD_EXPOSURE_WEIGHT_RECONCILIATION)));

const weightMismatch = createPortfolioSnapshot({
  snapshotId: 'SNAP-WEIGHT', portfolioId: 'PORT-1', portfolioName: 'Weight mismatch',
  asOfDate: '2026-09-08', currency: 'SAR', weightBasis: WEIGHT_BASIS.TARGET_ALLOCATION,
  maximumSourceAgeDays: 30,
  members: [member('WA', 0.5, 500), member('WB', 0.4, 500)],
});
check(() => assert.ok(weightMismatch.blockingCodes.includes(PORTFOLIO_STATUS.HOLD_WEIGHT_RECONCILIATION)));

const stale = createPortfolioSnapshot({
  snapshotId: 'SNAP-STALE', portfolioId: 'PORT-1', portfolioName: 'Stale source',
  asOfDate: '2026-09-08', currency: 'SAR', weightBasis: WEIGHT_BASIS.CURRENT_EXPOSURE,
  maximumSourceAgeDays: 3,
  members: [a, b],
});
check(() => assert.ok(stale.blockingCodes.includes(PORTFOLIO_STATUS.HOLD_SOURCE_FRESHNESS)));

const futureMember = member('FUT', 0.5, 500, { sourceAsOfDate: '2026-09-09' });
const peerMember = member('PEER', 0.5, 500);
const future = createPortfolioSnapshot({
  snapshotId: 'SNAP-FUTURE', portfolioId: 'PORT-1', portfolioName: 'Future source',
  asOfDate: '2026-09-08', currency: 'SAR', weightBasis: WEIGHT_BASIS.CURRENT_EXPOSURE,
  maximumSourceAgeDays: 30, members: [futureMember, peerMember],
});
check(() => assert.ok(future.blockingCodes.includes(PORTFOLIO_STATUS.HOLD_TEMPORAL_VALIDITY)));

const tampered = { ...a, exposureAmount: 999 };
check(() => assert.strictEqual(verifyPortfolioMember(tampered).valid, false));
check(() => assert.throws(() => createPortfolioSnapshot({
  snapshotId: 'BAD', portfolioId: 'PORT', portfolioName: 'Bad', asOfDate: '2026-09-08', currency: 'SAR',
  weightBasis: WEIGHT_BASIS.CURRENT_EXPOSURE, maximumSourceAgeDays: 30, members: [tampered, b],
}), /PORTFOLIO_MEMBER_INTEGRITY_FAILURE/));

const snapshotTampered = { ...snapshot, portfolioName: 'tampered' };
check(() => assert.strictEqual(verifyPortfolioSnapshot(snapshotTampered).valid, false));
check(() => assert.throws(() => createPortfolioSnapshot({
  snapshotId: 'DUP-ASSET', portfolioId: 'PORT', portfolioName: 'Dup', asOfDate: '2026-09-08', currency: 'SAR',
  weightBasis: WEIGHT_BASIS.TARGET_ALLOCATION, maximumSourceAgeDays: 30,
  members: [a, createPortfolioMember({ ...b, memberId: 'OTHER-MEM', assetId: a.assetId, sourceArtifactHashSha256: sha('other') })],
}), /DUPLICATE_PORTFOLIO_ASSET_ID/));
check(() => assert.throws(() => createPortfolioSnapshot({
  snapshotId: 'CUR', portfolioId: 'PORT', portfolioName: 'Currency', asOfDate: '2026-09-08', currency: 'SAR',
  weightBasis: WEIGHT_BASIS.TARGET_ALLOCATION, maximumSourceAgeDays: 30,
  members: [a, member('USD', 0.5, 500, { currency: 'USD' })],
}), /PORTFOLIO_CURRENCY_MISMATCH/));
check(() => assert.throws(() => createPortfolioSnapshot({
  snapshotId: 'ONE', portfolioId: 'PORT', portfolioName: 'One', asOfDate: '2026-09-08', currency: 'SAR',
  weightBasis: WEIGHT_BASIS.TARGET_ALLOCATION, maximumSourceAgeDays: 30, members: [a],
}), /AT_LEAST_TWO_MEMBERS/));
check(() => assert.throws(() => member('BADWEIGHT', 1.2, 100), /allocationWeight/));
check(() => assert.throws(() => member('BADEVID', 0.5, 100, { evidenceRefs: [] }), /PORTFOLIO_MEMBER_EVIDENCE_REQUIRED/));
check(() => assert.throws(() => member('BADDATE', 0.5, 100, { reviewedAt: '2026-09-07T07:00:00Z' }), /REVIEW_BEFORE_PREPARATION/));

console.log(`WAVE_16C_PORTFOLIO_CONCENTRATION=PASS checks=${checks}`);
