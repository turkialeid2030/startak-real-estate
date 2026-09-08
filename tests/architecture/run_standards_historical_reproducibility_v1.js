'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  STANDARD_STATUS,
  AUTHORITY_LEVEL,
  ENFORCEMENT_CLASS,
  APPLICABILITY_DATE_BASIS,
  REVIEW_STATUS,
  ROUTER_VERSION,
  createStandardsSnapshot,
  createStandardsReplayPackage,
  verifyStandardsReplayPackage,
  replayHistoricalStandardsPackage,
  createHistoricalStandardsLedger,
  appendHistoricalStandardsPackage,
  verifyHistoricalStandardsLedger,
  REPLAY_STATUS,
} = require('../../src/standards');

let checks = 0;
function check(fn) { fn(); checks++; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function standard(overrides = {}) {
  return {
    standardId: 'STD-HISTORY-1',
    titleAr: 'معيار تاريخي اختباري',
    titleEn: 'Historical Test Standard',
    issuer: 'TEST_AUTHORITY',
    jurisdiction: 'SAUDI_ARABIA',
    category: 'VALUATION',
    version: '2026.1',
    publicationDate: '2026-01-01',
    effectiveDate: '2026-02-01',
    expiryDate: null,
    status: STANDARD_STATUS.ACTIVE,
    sourceUrl: 'https://example.invalid/history-standard',
    officialSource: true,
    lastVerifiedAt: '2026-09-01',
    nextReviewAt: '2026-12-01',
    supersedesStandardIds: [],
    supersededByStandardIds: [],
    applicableAssetTypes: ['OFFICE'],
    applicablePurposes: ['MARKET_VALUE'],
    authorityLevel: AUTHORITY_LEVEL.SAUDI_MANDATORY_PROFESSIONAL,
    guidanceOrMandatory: 'MANDATORY',
    ruleVersionHash: 'history-rule-version-hash-v1',
    professionalReviewStatus: REVIEW_STATUS.APPROVED,
    legalReviewStatus: REVIEW_STATUS.NOT_REQUIRED,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    ruleId: 'RULE-HISTORY-1',
    standardId: 'STD-HISTORY-1',
    provisionReference: '2.1',
    ruleTitle: 'Historical replay test rule',
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
    implementationVersion: 'HISTORY-RULE-IMPL-1',
    testIds: ['W7D-T-001'],
    evidenceIds: ['W7D-EVIDENCE-1'],
    reviewStatus: REVIEW_STATUS.APPROVED,
    activationApprovalId: 'ACT-HISTORY-1',
    ...overrides,
  };
}

const context = Object.freeze({
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

function makeSnapshot(id = 'SNAP-HISTORY-1') {
  return createStandardsSnapshot({
    standardsSnapshotId: id,
    snapshotVersion: '1',
    createdAt: '2026-09-07T20:00:00Z',
    hashFn: sha256,
    routerVersion: ROUTER_VERSION,
    routerInputHash: sha256('router-input-history-1'),
    standardRefs: [{
      standardId: 'STD-HISTORY-1',
      version: '2026.1',
      status: 'ACTIVE',
      ruleVersionHash: 'history-rule-version-hash-v1',
    }],
    ruleRefs: [{ ruleId: 'RULE-HISTORY-1', implementationVersion: 'HISTORY-RULE-IMPL-1' }],
    activationApprovalRefs: ['ACT-HISTORY-1'],
    valuationDate: context.valuationDate,
    reportDate: context.reportDate,
    engagementDate: context.engagementDate,
  });
}

function makePackage(overrides = {}) {
  return createStandardsReplayPackage({
    packageId: overrides.packageId || 'PKG-HISTORY-1',
    caseId: overrides.caseId || 'CASE-HISTORY-1',
    engagementId: overrides.engagementId || 'ENG-HISTORY-1',
    assignmentScopeVersion: overrides.assignmentScopeVersion || 'SCOPE-1',
    standardsSnapshot: overrides.standardsSnapshot || makeSnapshot(overrides.snapshotId),
    standards: overrides.standards || [standard()],
    rules: overrides.rules || [rule()],
    context: overrides.context || context,
    conflicts: overrides.conflicts || [],
    codeArtifactRef: overrides.codeArtifactRef || 'git:33c1ff5c57cbf2cb68cc85b628ae468a2ea1bd30',
    createdAt: overrides.createdAt || '2026-09-07T20:05:00Z',
    createdBy: overrides.createdBy || 'history-recorder',
    hashFn: sha256,
  });
}

const replayPackage = makePackage();
check(() => assert.strictEqual(replayPackage.packageId, 'PKG-HISTORY-1'));
check(() => assert.strictEqual(replayPackage.caseId, 'CASE-HISTORY-1'));
check(() => assert.strictEqual(replayPackage.productionIntegration, 'NON_ENFORCING_HISTORY_LIBRARY_ONLY'));
check(() => assert.strictEqual(replayPackage.replayPolicy, 'STORED_FACTS_RULES_CONTEXT_ONLY_NO_CURRENT_REGISTRY_FALLBACK'));
check(() => assert.strictEqual(replayPackage.exactRuntimeReconstructionRequiresCodeArtifact, true));
check(() => assert.strictEqual(replayPackage.professionalAuthorizationEstablished, false));
check(() => assert.strictEqual(replayPackage.legalApprovalEstablished, false));
check(() => assert.strictEqual(replayPackage.transactionAuthorized, false));
check(() => assert.strictEqual(replayPackage.routeResult.transactionAuthorized, false));
check(() => assert.deepStrictEqual(replayPackage.routeResult.applicableRuleIds, ['RULE-HISTORY-1']));
check(() => assert.ok(/^[a-f0-9]{64}$/.test(replayPackage.packageHash)));
check(() => assert.ok(Object.isFrozen(replayPackage)));

const integrity = verifyStandardsReplayPackage(replayPackage, sha256);
check(() => assert.strictEqual(integrity.valid, true));
check(() => assert.strictEqual(integrity.snapshotValid, true));
check(() => assert.strictEqual(integrity.packageHashValid, true));
check(() => assert.strictEqual(integrity.transactionAuthorized, false));

// Any semantic mutation is detected by the content-addressed package hash.
const tamperedContext = {
  ...replayPackage,
  context: { ...replayPackage.context, assetType: 'HOTEL' },
};
check(() => assert.strictEqual(verifyStandardsReplayPackage(tamperedContext, sha256).valid, false));
const tamperedRule = {
  ...replayPackage,
  rules: replayPackage.rules.map((item) => ({ ...item, implementationVersion: 'MUTATED' })),
};
check(() => assert.strictEqual(verifyStandardsReplayPackage(tamperedRule, sha256).valid, false));
const tamperedSnapshot = {
  ...replayPackage,
  standardsSnapshot: {
    ...replayPackage.standardsSnapshot,
    ruleRefs: [{ ruleId: 'RULE-HISTORY-1', implementationVersion: 'MUTATED' }],
  },
};
check(() => assert.strictEqual(verifyStandardsReplayPackage(tamperedSnapshot, sha256).valid, false));

// Replay uses only the captured package, never the current registry.
const replay = replayHistoricalStandardsPackage(replayPackage, { hashFn: sha256 });
check(() => assert.strictEqual(replay.status, REPLAY_STATUS.REPRODUCIBLE));
check(() => assert.strictEqual(replay.routeMatchesStoredResult, true));
check(() => assert.strictEqual(replay.currentRegistryConsulted, false));
check(() => assert.strictEqual(replay.exactRuntimeReconstructionRequiresCodeArtifact, true));
check(() => assert.strictEqual(replay.codeArtifactRef, replayPackage.codeArtifactRef));
check(() => assert.strictEqual(replay.transactionAuthorized, false));

// Changed router behaviour is surfaced as drift; it is not silently accepted.
const driftReplay = replayHistoricalStandardsPackage(replayPackage, {
  hashFn: sha256,
  routeFn: () => ({
    ...replayPackage.routeResult,
    applicableRuleIds: [],
    blockingCodes: ['SIMULATED_ROUTER_DRIFT'],
  }),
});
check(() => assert.strictEqual(driftReplay.status, REPLAY_STATUS.DRIFT_DETECTED));
check(() => assert.strictEqual(driftReplay.routeMatchesStoredResult, false));
check(() => assert.strictEqual(driftReplay.currentRegistryConsulted, false));

// Integrity failure halts replay before routing.
let routeCalled = false;
const integrityHold = replayHistoricalStandardsPackage(tamperedContext, {
  hashFn: sha256,
  routeFn: () => { routeCalled = true; return replayPackage.routeResult; },
});
check(() => assert.strictEqual(integrityHold.status, REPLAY_STATUS.HOLD_INTEGRITY_FAILURE));
check(() => assert.strictEqual(routeCalled, false));
check(() => assert.strictEqual(integrityHold.transactionAuthorized, false));

// Snapshot/router mismatch cannot be packaged as historical truth.
const wrongRouterSnapshot = createStandardsSnapshot({
  standardsSnapshotId: 'SNAP-WRONG-ROUTER',
  snapshotVersion: '1',
  createdAt: '2026-09-07T20:00:00Z',
  hashFn: sha256,
  routerVersion: 'OLD_ROUTER_VERSION',
  routerInputHash: sha256('router-input-history-1'),
  standardRefs: [],
  ruleRefs: [],
  activationApprovalRefs: [],
  valuationDate: context.valuationDate,
  reportDate: context.reportDate,
  engagementDate: context.engagementDate,
});
check(() => assert.throws(
  () => makePackage({ packageId: 'PKG-WRONG-ROUTER', standardsSnapshot: wrongRouterSnapshot }),
  (error) => error && error.code === 'STANDARDS_SNAPSHOT_ROUTER_VERSION_MISMATCH',
));

// Append-only history ledger is case-isolated and hash-chained.
let ledger = createHistoricalStandardsLedger({
  ledgerId: 'LEDGER-HISTORY-1',
  caseId: 'CASE-HISTORY-1',
  createdAt: '2026-09-07T20:10:00Z',
  createdBy: 'history-service',
});
check(() => assert.strictEqual(ledger.entries.length, 0));
check(() => assert.strictEqual(ledger.headHash, null));
check(() => assert.strictEqual(ledger.appendOnly, true));
check(() => assert.strictEqual(ledger.transactionAuthorized, false));

ledger = appendHistoricalStandardsPackage(ledger, replayPackage, {
  persistedAt: '2026-09-07T20:11:00Z',
  persistedBy: 'history-service',
  hashFn: sha256,
});
check(() => assert.strictEqual(ledger.entries.length, 1));
check(() => assert.strictEqual(ledger.entries[0].sequence, 1));
check(() => assert.strictEqual(ledger.entries[0].previousEntryHash, null));
check(() => assert.strictEqual(ledger.headHash, ledger.entries[0].entryHash));
check(() => assert.strictEqual(verifyHistoricalStandardsLedger(ledger, sha256).valid, true));

const secondPackage = makePackage({ packageId: 'PKG-HISTORY-2', snapshotId: 'SNAP-HISTORY-2', createdAt: '2026-09-07T20:12:00Z' });
ledger = appendHistoricalStandardsPackage(ledger, secondPackage, {
  persistedAt: '2026-09-07T20:13:00Z',
  persistedBy: 'history-service',
  hashFn: sha256,
});
check(() => assert.strictEqual(ledger.entries.length, 2));
check(() => assert.strictEqual(ledger.entries[1].sequence, 2));
check(() => assert.strictEqual(ledger.entries[1].previousEntryHash, ledger.entries[0].entryHash));
check(() => assert.strictEqual(ledger.headHash, ledger.entries[1].entryHash));
check(() => assert.strictEqual(verifyHistoricalStandardsLedger(ledger, sha256).entryCount, 2));
check(() => assert.strictEqual(verifyHistoricalStandardsLedger(ledger, sha256).valid, true));
check(() => assert.ok(Object.isFrozen(ledger)));

// Duplicate package and cross-case append are blocked.
check(() => assert.throws(
  () => appendHistoricalStandardsPackage(ledger, replayPackage, {
    persistedAt: '2026-09-07T20:14:00Z', persistedBy: 'history-service', hashFn: sha256,
  }),
  (error) => error && error.code === 'DUPLICATE_STANDARDS_REPLAY_PACKAGE',
));
const otherCasePackage = makePackage({ packageId: 'PKG-OTHER-CASE', caseId: 'CASE-OTHER' });
check(() => assert.throws(
  () => appendHistoricalStandardsPackage(ledger, otherCasePackage, {
    persistedAt: '2026-09-07T20:14:00Z', persistedBy: 'history-service', hashFn: sha256,
  }),
  (error) => error && error.code === 'STANDARDS_HISTORY_CASE_ISOLATION_VIOLATION',
));

// Any historical ledger mutation breaks the chain/head verification.
const tamperedLedger = {
  ...ledger,
  entries: ledger.entries.map((entry, index) => index === 0
    ? { ...entry, persistedBy: 'tampered-actor' }
    : { ...entry }),
};
const tamperedLedgerVerification = verifyHistoricalStandardsLedger(tamperedLedger, sha256);
check(() => assert.strictEqual(tamperedLedgerVerification.valid, false));
check(() => assert.ok(tamperedLedgerVerification.issues.some((issue) => issue.startsWith('ENTRY_HASH_MISMATCH:1'))));
check(() => assert.strictEqual(tamperedLedgerVerification.transactionAuthorized, false));

console.log(`STANDARDS_HISTORICAL_REPRODUCIBILITY_ARCHITECTURE: PASS (${checks} checks)`);
