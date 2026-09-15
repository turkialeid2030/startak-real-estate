'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  STANDARD_STATUS,
  AUTHORITY_LEVEL,
  ENFORCEMENT_CLASS,
  APPLICABILITY_DATE_BASIS,
  REVIEW_STATUS,
  CONFLICT_STATE,
  createInitialNonEnforcingRegistry,
  createStandardsRegistry,
  evaluateStandardFreshness,
  routeStandards,
  createStandardsSnapshot,
  verifyStandardsSnapshot,
} = require('../../src/standards');

let checks = 0;
function check(fn) { fn(); checks++; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function standard(overrides = {}) {
  return {
    standardId: 'STD-TEST-1',
    titleAr: 'معيار اختباري',
    titleEn: 'Test Standard',
    issuer: 'TEST_AUTHORITY',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version: '2026.1',
    publicationDate: '2026-01-01',
    effectiveDate: '2026-02-01',
    expiryDate: null,
    status: STANDARD_STATUS.ACTIVE,
    sourceUrl: 'https://example.invalid/official-test-source',
    officialSource: true,
    lastVerifiedAt: '2026-09-01',
    nextReviewAt: '2026-12-01',
    supersedesStandardIds: [],
    supersededByStandardIds: [],
    applicableAssetTypes: ['OFFICE'],
    applicablePurposes: ['MARKET_VALUE'],
    authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL,
    guidanceOrMandatory: 'MANDATORY',
    ruleVersionHash: 'test-rule-version-hash-v1',
    professionalReviewStatus: REVIEW_STATUS.APPROVED,
    legalReviewStatus: REVIEW_STATUS.NOT_REQUIRED,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    ruleId: 'RULE-TEST-1',
    standardId: 'STD-TEST-1',
    provisionReference: '1.1',
    ruleTitle: 'Test rule',
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
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
    severity: 'CRITICAL',
    requiredInputs: ['valuationDate'],
    validationExpression: null,
    calculationEffect: null,
    reportingEffect: null,
    blockingEffect: 'BLOCK_IF_MISSING',
    implementationVersion: 'W7A_TEST_V1',
    testIds: ['W7A-T-001'],
    evidenceIds: ['EVIDENCE-TEST-1'],
    reviewStatus: REVIEW_STATUS.APPROVED,
    activationApprovalId: 'ACT-TEST-1',
    ...overrides,
  };
}

const baseContext = Object.freeze({
  jurisdiction: 'SAUDI_ARABIA',
  valuationPurpose: 'MARKET_VALUE',
  intendedUse: 'INTERNAL_DECISION_SUPPORT',
  intendedUsers: ['CLIENT'],
  assetType: 'OFFICE',
  valuedPropertyInterest: 'OWNERSHIP',
  reportingFramework: 'NONE',
  regulatedEntityStatus: 'UNREGULATED',
  transactionContext: 'NONE',
  financingContext: 'NONE',
  engagementDate: '2026-08-15',
  valuationDate: '2026-09-01',
  reportDate: '2026-09-07',
  transactionDate: null,
  financingDecisionDate: null,
});

// Initial registry is deliberately empty and cannot accidentally establish legal/professional truth.
const initial = createInitialNonEnforcingRegistry('2026-09-07');
check(() => assert.strictEqual(initial.mode, 'NON_ENFORCING_LIBRARY_ONLY'));
check(() => assert.strictEqual(initial.standards.length, 0));
check(() => assert.strictEqual(initial.rules.length, 0));
check(() => assert.strictEqual(initial.legalApprovalEstablished, false));
check(() => assert.strictEqual(initial.professionalAuthorizationEstablished, false));
check(() => assert.strictEqual(initial.transactionAuthorized, false));

// Registry integrity.
const registry = createStandardsRegistry({ standards: [standard()], rules: [rule()], asOfDate: '2026-09-07' });
check(() => assert.deepStrictEqual(registry.activeStandardIds, ['STD-TEST-1']));
check(() => assert.deepStrictEqual(registry.staleStandardIds, []));
check(() => assert.throws(
  () => createStandardsRegistry({ standards: [standard(), standard()], rules: [], asOfDate: '2026-09-07' }),
  /DUPLICATE_STANDARD_ID/,
));
check(() => assert.throws(
  () => createStandardsRegistry({ standards: [standard()], rules: [rule({ standardId: 'MISSING' })], asOfDate: '2026-09-07' }),
  /ORPHAN_STANDARD_RULE/,
));
const stale = evaluateStandardFreshness(standard({ nextReviewAt: '2026-09-06' }), '2026-09-07');
check(() => assert.strictEqual(stale.fresh, false));
check(() => assert.ok(stale.reasons.includes('STANDARD_VERIFICATION_STALE')));
check(() => assert.strictEqual(stale.finalComplianceConclusionPermitted, false));

// Approved ACTIVE rule routes deterministically.
const activeRoute = routeStandards({ context: baseContext, standards: [standard()], rules: [rule()] });
check(() => assert.deepStrictEqual(activeRoute.applicableRuleIds, ['RULE-TEST-1']));
check(() => assert.deepStrictEqual(activeRoute.applicableStandardIds, ['STD-TEST-1']));
check(() => assert.deepStrictEqual(activeRoute.blockingCodes, []));
check(() => assert.strictEqual(activeRoute.productionIntegration, 'NON_ENFORCING_LIBRARY_ONLY'));
check(() => assert.strictEqual(activeRoute.transactionAuthorized, false));

// DRAFT can never change production routing.
const draftRoute = routeStandards({ context: baseContext, standards: [standard({ status: STANDARD_STATUS.DRAFT })], rules: [rule()] });
check(() => assert.deepStrictEqual(draftRoute.applicableRuleIds, []));
check(() => assert.ok(draftRoute.excludedRules[0].reason.includes('DRAFT_NON_ENFORCING')));
check(() => assert.deepStrictEqual(draftRoute.blockingCodes, []));

// FUTURE does not auto-activate, even after its nominal effective date.
const futureRoute = routeStandards({
  context: { ...baseContext, valuationDate: '2027-01-01' },
  standards: [standard({ status: STANDARD_STATUS.FUTURE, effectiveDate: '2026-12-01' })],
  rules: [rule({ effectiveFrom: '2026-12-01' })],
});
check(() => assert.deepStrictEqual(futureRoute.applicableRuleIds, []));
check(() => assert.ok(futureRoute.excludedRules[0].reason.includes('FUTURE_NON_ENFORCING')));

// ACTIVE without explicit rule activation/review approval fails closed.
const unapprovedRoute = routeStandards({
  context: baseContext,
  standards: [standard()],
  rules: [rule({ reviewStatus: REVIEW_STATUS.PENDING, activationApprovalId: null })],
});
check(() => assert.deepStrictEqual(unapprovedRoute.applicableRuleIds, []));
check(() => assert.ok(unapprovedRoute.blockingCodes.includes('STANDARD_RULE_UNAPPROVED')));

// Applicability date basis is rule-specific, not universally valuationDate.
const reportDateRule = rule({
  ruleId: 'RULE-REPORT-DATE',
  applicabilityDateBasis: APPLICABILITY_DATE_BASIS.REPORT_DATE,
  effectiveFrom: '2026-09-05',
});
const reportRoute = routeStandards({ context: baseContext, standards: [standard()], rules: [reportDateRule] });
check(() => assert.deepStrictEqual(reportRoute.applicableRuleIds, ['RULE-REPORT-DATE']));
const reportBeforeEffective = routeStandards({
  context: { ...baseContext, reportDate: '2026-09-04' },
  standards: [standard()],
  rules: [reportDateRule],
});
check(() => assert.deepStrictEqual(reportBeforeEffective.applicableRuleIds, []));
check(() => assert.strictEqual(reportBeforeEffective.excludedRules[0].reason, 'RULE_NOT_YET_EFFECTIVE'));

// Missing date for a relevant date basis produces review/block rather than guessing.
const missingFinanceDate = routeStandards({
  context: baseContext,
  standards: [standard()],
  rules: [rule({ ruleId: 'RULE-FIN-DATE', applicabilityDateBasis: APPLICABILITY_DATE_BASIS.FINANCING_DECISION_DATE })],
});
check(() => assert.deepStrictEqual(missingFinanceDate.applicableRuleIds, []));
check(() => assert.ok(missingFinanceDate.requiredReviews.includes('STANDARDS_APPLICABILITY_REVIEW')));
check(() => assert.ok(missingFinanceDate.blockingCodes.includes('STANDARD_RULESET_CONFLICT')));

// Scope mismatch excludes without inventing applicability.
const wrongAsset = routeStandards({ context: { ...baseContext, assetType: 'HOTEL' }, standards: [standard()], rules: [rule()] });
check(() => assert.deepStrictEqual(wrongAsset.applicableRuleIds, []));
check(() => assert.strictEqual(wrongAsset.excludedRules[0].reason, 'SCOPE_NOT_MATCHED'));

// Unresolved material conflict fails closed to human professional/legal review.
const conflictRoute = routeStandards({
  context: baseContext,
  standards: [standard()],
  rules: [rule()],
  conflicts: [{
    conflictId: 'CONFLICT-1',
    ruleIds: ['RULE-TEST-1', 'RULE-OTHER'],
    subject: 'BASIS_OF_VALUE',
    state: CONFLICT_STATE.LEGAL_OR_PROFESSIONAL_REVIEW_REQUIRED,
  }],
});
check(() => assert.ok(conflictRoute.blockingCodes.includes('STANDARD_RULESET_CONFLICT')));
check(() => assert.ok(conflictRoute.requiredReviews.includes('LEGAL_OR_PROFESSIONAL_STANDARDS_REVIEW')));

// Content-addressed snapshot: stable for identical semantic content and detects mutation.
const snapshotInput = {
  standardsSnapshotId: 'SNAP-1',
  snapshotVersion: '1',
  createdAt: '2026-09-07T12:00:00Z',
  hashFn: sha256,
  routerVersion: activeRoute.routerVersion,
  routerInputHash: 'router-input-hash-test',
  standardRefs: [{ standardId: 'STD-TEST-1', version: '2026.1', status: 'ACTIVE', ruleVersionHash: 'test-rule-version-hash-v1' }],
  ruleRefs: [{ ruleId: 'RULE-TEST-1', implementationVersion: 'W7A_TEST_V1' }],
  activationApprovalRefs: ['ACT-TEST-1'],
  valuationDate: baseContext.valuationDate,
  reportDate: baseContext.reportDate,
  engagementDate: baseContext.engagementDate,
};
const snapshotA = createStandardsSnapshot(snapshotInput);
const snapshotB = createStandardsSnapshot({ ...snapshotInput, standardsSnapshotId: 'SNAP-2', createdAt: '2026-09-08T12:00:00Z' });
check(() => assert.strictEqual(snapshotA.snapshotHash, snapshotB.snapshotHash));
check(() => assert.strictEqual(verifyStandardsSnapshot(snapshotA, sha256).valid, true));
const mutated = { ...snapshotA, ruleRefs: [{ ruleId: 'RULE-TEST-1', implementationVersion: 'W7A_TEST_V2' }] };
check(() => assert.strictEqual(verifyStandardsSnapshot(mutated, sha256).valid, false));
check(() => assert.ok(Object.isFrozen(snapshotA)));
check(() => assert.ok(Object.isFrozen(activeRoute)));

console.log(`STANDARDS_REGISTRY_ROUTER_ARCHITECTURE: PASS (${checks} checks)`);