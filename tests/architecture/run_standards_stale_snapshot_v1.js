'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  STANDARD_STATUS,
  AUTHORITY_LEVEL,
  ENFORCEMENT_CLASS,
  APPLICABILITY_DATE_BASIS,
  REVIEW_STATUS,
  normalizeStandardRecord,
  routeStandards,
  createStandardsSnapshot,
} = require('../../src/standards');

let checks = 0;
function check(fn) { fn(); checks++; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

const baseStandard = {
  standardId: 'STD-STALE-TEST',
  titleAr: 'معيار اختباري',
  titleEn: 'Stale Test Standard',
  issuer: 'TEST_AUTHORITY',
  jurisdiction: 'SAUDI_ARABIA',
  category: 'VALUATION',
  version: '1',
  publicationDate: '2026-01-01',
  effectiveDate: '2026-01-01',
  expiryDate: null,
  status: STANDARD_STATUS.ACTIVE,
  sourceUrl: 'https://example.invalid/source',
  officialSource: true,
  lastVerifiedAt: '2026-08-01',
  nextReviewAt: '2026-09-06',
  supersedesStandardIds: [],
  supersededByStandardIds: [],
  applicableAssetTypes: ['OFFICE'],
  applicablePurposes: ['MARKET_VALUE'],
  authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL,
  guidanceOrMandatory: 'MANDATORY',
  ruleVersionHash: 'hash-v1',
  professionalReviewStatus: REVIEW_STATUS.APPROVED,
  legalReviewStatus: REVIEW_STATUS.NOT_REQUIRED,
};

const baseRule = {
  ruleId: 'RULE-STALE-TEST',
  standardId: 'STD-STALE-TEST',
  provisionReference: '1',
  ruleTitle: 'Stale test rule',
  ruleType: 'VALIDATION',
  authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL,
  enforcementClass: ENFORCEMENT_CLASS.BLOCKING,
  jurisdiction: 'SAUDI_ARABIA',
  appliesWhen: {},
  excludesWhen: {},
  purposeScope: ['MARKET_VALUE'],
  assetScope: ['OFFICE'],
  regulatedEntityScope: [],
  transactionScope: [],
  financingScope: [],
  applicabilityDateBasis: APPLICABILITY_DATE_BASIS.VALUATION_DATE,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  severity: 'CRITICAL',
  requiredInputs: ['valuationDate'],
  validationExpression: null,
  calculationEffect: null,
  reportingEffect: null,
  blockingEffect: 'BLOCK_IF_STALE',
  implementationVersion: 'W7A',
  testIds: ['W7A-STALE-1'],
  evidenceIds: ['TEST-EVIDENCE'],
  reviewStatus: REVIEW_STATUS.APPROVED,
  activationApprovalId: 'ACT-STALE-1',
};

const context = {
  jurisdiction: 'SAUDI_ARABIA',
  valuationPurpose: 'MARKET_VALUE',
  assetType: 'OFFICE',
  regulatedEntityStatus: 'UNREGULATED',
  transactionContext: 'NONE',
  financingContext: 'NONE',
  valuationDate: '2026-09-01',
  reportDate: '2026-09-07',
  engagementDate: '2026-08-01',
};

const staleRoute = routeStandards({ context, standards: [baseStandard], rules: [baseRule] });
check(() => assert.deepStrictEqual(staleRoute.applicableRuleIds, []));
check(() => assert.ok(staleRoute.blockingCodes.includes('STANDARD_VERIFICATION_STALE')));
check(() => assert.ok(staleRoute.requiredReviews.includes('STANDARDS_SOURCE_VERIFICATION_REVIEW')));
check(() => assert.ok(staleRoute.excludedRules[0].reason.includes('STANDARD_VERIFICATION_STALE')));

const refreshedRoute = routeStandards({
  context,
  standards: [{ ...baseStandard, lastVerifiedAt: '2026-09-07', nextReviewAt: '2026-12-01' }],
  rules: [baseRule],
});
check(() => assert.deepStrictEqual(refreshedRoute.applicableRuleIds, ['RULE-STALE-TEST']));
check(() => assert.deepStrictEqual(refreshedRoute.blockingCodes, []));

check(() => assert.throws(
  () => normalizeStandardRecord({ ...baseStandard, publicationDate: '2026-02-31' }),
  /real ISO date/,
));

const common = {
  snapshotVersion: '1',
  createdAt: '2026-09-07T12:00:00Z',
  hashFn: sha256,
  routerVersion: 'W7A_PURPOSE_ROUTER_V1',
  routerInputHash: 'abc',
  activationApprovalRefs: ['ACT-B', 'ACT-A'],
  valuationDate: '2026-09-01',
  reportDate: '2026-09-07',
  engagementDate: '2026-08-01',
};
const snapA = createStandardsSnapshot({
  ...common,
  standardsSnapshotId: 'SNAP-A',
  standardRefs: [{ standardId: 'B' }, { standardId: 'A' }],
  ruleRefs: [{ ruleId: 'B' }, { ruleId: 'A' }],
});
const snapB = createStandardsSnapshot({
  ...common,
  standardsSnapshotId: 'SNAP-B',
  createdAt: '2026-09-08T12:00:00Z',
  activationApprovalRefs: ['ACT-A', 'ACT-B'],
  standardRefs: [{ standardId: 'A' }, { standardId: 'B' }],
  ruleRefs: [{ ruleId: 'A' }, { ruleId: 'B' }],
});
check(() => assert.strictEqual(snapA.snapshotHash, snapB.snapshotHash));
check(() => assert.deepStrictEqual(snapA.activationApprovalRefs, ['ACT-A', 'ACT-B']));
check(() => assert.strictEqual(snapA.snapshotHash.length, 64));

console.log(`STANDARDS_STALE_SNAPSHOT_ARCHITECTURE: PASS (${checks} checks)`);