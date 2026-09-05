'use strict';

const assert = require('assert');
const {
  EVIDENCE_GRADE,
  INPUT_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  VALUATION_METHOD,
} = require('../../src/valuation-intelligence');
const {
  emptyAdvancedValuationDraft,
  emptyComparableDraft,
  advancedDraftFromValuationCase,
  applyAdvancedDraftToValuationCase,
  AdvancedValuationDraftError,
} = require('../../src/app/valuation-advanced-draft');

function baseCase() {
  return {
    schemaVersion: 1,
    projectId: 'PROJECT-ADV-001',
    classification: {
      assetClass: 'OFFICE',
      lifecycleStage: 'STABILIZED',
      investmentStrategy: 'CORE_INCOME',
      incomeModel: 'LEASE_INCOME',
    },
    incomePolicy: {
      expenseTreatment: 'ACTUAL_LANDLORD_OPEX',
      basis: 'MARKET_VALUE',
      currency: 'SAR',
      valuationDate: '2026-09-05',
    },
    evidencePolicy: {
      minEvidenceCount: 2,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
    criticalEvidenceRequirements: {
      INCOME_DIRECT_CAPITALIZATION: [{ field: 'capitalizationRate', allowedGrades: ['E_MARKET_OBSERVATION'], allowedStatuses: ['OBSERVED'] }],
    },
  };
}

function comparable(id, unitValue) {
  const row = emptyComparableDraft();
  row.comparableId = id;
  row.unitValue = String(unitValue);
  row.transactionStatus = TRANSACTION_STATUS.EXECUTED_SALE;
  row.evidenceGrade = EVIDENCE_GRADE.B_VERIFIED_TRANSACTION;
  row.transactionDate = '2026-09-01';
  row.sourceRef = `SRC-${id}`;
  return row;
}

(function testEmptyAdvancedDraftHasNoEconomicDefaults() {
  const draft = emptyAdvancedValuationDraft();
  assert.strictEqual(draft.marketComparable.enabled, false);
  assert.strictEqual(draft.marketComparable.subjectArea, '');
  assert.strictEqual(draft.marketComparable.basis, '');
  assert.strictEqual(draft.marketComparable.weightingPolicy, '');
  assert.strictEqual(draft.cost.enabled, false);
  assert.strictEqual(draft.cost.depreciationRate, '');
  assert.strictEqual(draft.reconciliation.enabled, false);
  assert.strictEqual(draft.reconciliation.dispersionThreshold, '');
  assert.strictEqual(draft.evidence.income.enabled, false);
})();

(function testEvidenceDescriptorIsExplicitAndBasePolicyIsPreserved() {
  const draft = emptyAdvancedValuationDraft();
  draft.evidence.income = {
    enabled: true,
    grade: EVIDENCE_GRADE.D_OPERATING_ACTUAL,
    status: INPUT_STATUS.VERIFIED,
    sourceType: 'LEASE_LEDGER',
    sourceRef: 'LEDGER-001',
    observedAt: '2026-09-05',
    note: 'Verified operating ledger.',
  };
  const base = baseCase();
  const next = applyAdvancedDraftToValuationCase(base, draft);
  assert.strictEqual(next.evidence.income.grade, EVIDENCE_GRADE.D_OPERATING_ACTUAL);
  assert.strictEqual(next.evidence.income.status, INPUT_STATUS.VERIFIED);
  assert.strictEqual(next.evidence.income.sourceRef, 'LEDGER-001');
  assert.deepStrictEqual(next.evidencePolicy, base.evidencePolicy);
  assert.deepStrictEqual(next.criticalEvidenceRequirements, base.criticalEvidenceRequirements);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(base, 'evidence'), false);
})();

(function testEqualWeightedMarketComparablesBuildCanonicalComparableObjects() {
  const draft = emptyAdvancedValuationDraft();
  draft.marketComparable.enabled = true;
  draft.marketComparable.subjectArea = '1000';
  draft.marketComparable.basis = 'MARKET_VALUE';
  draft.marketComparable.weightingPolicy = WEIGHTING_POLICY.EQUAL;
  draft.marketComparable.currency = 'SAR';
  draft.marketComparable.valuationDate = '2026-09-05';
  draft.marketComparable.comparables = [comparable('C1', 10000), comparable('C2', 11000)];
  const next = applyAdvancedDraftToValuationCase(baseCase(), draft);
  assert.strictEqual(next.marketComparableInput.comparables.length, 2);
  assert.strictEqual(next.marketComparableInput.comparables[0].adjustedUnitValue, 10000);
  assert.strictEqual(next.marketComparableInput.comparables[1].adjustedUnitValue, 11000);
  assert.strictEqual(next.marketComparableInput.comparables[0].weight, null);
  assert.strictEqual(next.marketComparableInput.weightingPolicy, WEIGHTING_POLICY.EQUAL);
})();

(function testExplicitComparableWeightsMustSumToOne() {
  const draft = emptyAdvancedValuationDraft();
  draft.marketComparable.enabled = true;
  draft.marketComparable.subjectArea = '1000';
  draft.marketComparable.basis = 'MARKET_VALUE';
  draft.marketComparable.weightingPolicy = WEIGHTING_POLICY.EXPLICIT;
  draft.marketComparable.currency = 'SAR';
  const c1 = comparable('C1', 10000); c1.weight = '0.4';
  const c2 = comparable('C2', 11000); c2.weight = '0.4';
  draft.marketComparable.comparables = [c1, c2];
  assert.throws(
    () => applyAdvancedDraftToValuationCase(baseCase(), draft),
    (error) => error instanceof AdvancedValuationDraftError && error.reasonCode === 'WEIGHTS_MUST_SUM_TO_ONE',
  );
})();

(function testCostPolicyRequiresExplicitDepreciationAndSupportsExplicitIndirectCosts() {
  const draft = emptyAdvancedValuationDraft();
  draft.cost.enabled = true;
  draft.cost.depreciationRate = '0.2';
  draft.cost.indirectCostsJson = JSON.stringify([{ label: 'Professional fees', amount: 500000 }]);
  draft.cost.basis = 'MARKET_VALUE';
  draft.cost.currency = 'SAR';
  draft.cost.valuationDate = '2026-09-05';
  const next = applyAdvancedDraftToValuationCase(baseCase(), draft);
  assert.strictEqual(next.costPolicy.depreciationRate, 0.2);
  assert.deepStrictEqual(next.costPolicy.indirectCosts, [{ label: 'Professional fees', amount: 500000 }]);

  const incomplete = emptyAdvancedValuationDraft();
  incomplete.cost.enabled = true;
  assert.throws(
    () => applyAdvancedDraftToValuationCase(baseCase(), incomplete),
    (error) => error instanceof AdvancedValuationDraftError && error.field === 'cost.depreciationRate',
  );
})();

(function testReconciliationHasNoDefaultWeightsOrThresholdAndRequiresExactExplicitSum() {
  const draft = emptyAdvancedValuationDraft();
  draft.reconciliation.enabled = true;
  draft.reconciliation.dispersionThreshold = '0.1';
  draft.reconciliation.methodWeights[VALUATION_METHOD.MARKET_COMPARABLE] = '0.5';
  draft.reconciliation.methodWeights[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION] = '0.5';
  const next = applyAdvancedDraftToValuationCase(baseCase(), draft);
  assert.deepStrictEqual(next.reconciliationPolicy, {
    methodWeights: {
      [VALUATION_METHOD.MARKET_COMPARABLE]: 0.5,
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.5,
    },
    dispersionThreshold: 0.1,
  });

  const missing = emptyAdvancedValuationDraft();
  missing.reconciliation.enabled = true;
  assert.throws(
    () => applyAdvancedDraftToValuationCase(baseCase(), missing),
    (error) => error instanceof AdvancedValuationDraftError && error.field === 'reconciliation.dispersionThreshold',
  );
})();

(function testDraftRoundTripPreservesUnknownEvidenceKeysAndAdvancedConfiguration() {
  const source = baseCase();
  source.evidence = {
    income: {
      grade: EVIDENCE_GRADE.D_OPERATING_ACTUAL,
      status: INPUT_STATUS.OBSERVED,
      sourceType: 'LEDGER',
      sourceRef: 'L-1',
      observedAt: null,
      note: null,
    },
    customEvidence: { external: true },
  };
  source.costPolicy = {
    depreciationRate: 0.1,
    indirectCosts: [],
    basis: 'MARKET_VALUE',
    currency: 'SAR',
    valuationDate: null,
  };
  source.reconciliationPolicy = {
    methodWeights: {
      [VALUATION_METHOD.MARKET_COMPARABLE]: 0.5,
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.5,
    },
    dispersionThreshold: 0.2,
  };

  const rebuilt = applyAdvancedDraftToValuationCase(source, advancedDraftFromValuationCase(source));
  assert.deepStrictEqual(rebuilt.evidence.customEvidence, { external: true });
  assert.deepStrictEqual(rebuilt.costPolicy, source.costPolicy);
  assert.deepStrictEqual(rebuilt.reconciliationPolicy, source.reconciliationPolicy);
})();

(function testDisablingAdvancedSectionsRemovesOnlyThoseSections() {
  const source = baseCase();
  source.marketComparableInput = { shouldBeRemoved: true };
  source.costPolicy = { shouldBeRemoved: true };
  source.reconciliationPolicy = { shouldBeRemoved: true };
  source.evidence = { shouldBeRemoved: true };
  const next = applyAdvancedDraftToValuationCase(source, emptyAdvancedValuationDraft());
  assert.strictEqual(Object.prototype.hasOwnProperty.call(next, 'marketComparableInput'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(next, 'costPolicy'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(next, 'reconciliationPolicy'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(next, 'evidence'), false);
  assert.deepStrictEqual(next.criticalEvidenceRequirements, source.criticalEvidenceRequirements);
})();

console.log('VALUATION_ADVANCED_DRAFT_V1=PASS');
