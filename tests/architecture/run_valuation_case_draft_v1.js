'use strict';

const assert = require('assert');
const {
  VALUATION_METHOD,
  VALUATION_CASE_SCHEMA_VERSION,
} = require('../../src/valuation-intelligence');
const {
  emptyValuationCaseDraft,
  draftFromValuationCase,
  buildValuationCaseFromDraft,
  ValuationCaseDraftError,
} = require('../../src/app/valuation-case-draft');

function completeDraft() {
  const draft = emptyValuationCaseDraft();
  draft.projectId = 'PROJECT-DRAFT-001';
  draft.classification.assetClass = 'OFFICE';
  draft.classification.lifecycleStage = 'STABILIZED';
  draft.classification.investmentStrategy = 'CORE_INCOME';
  draft.classification.incomeModel = 'LEASE_INCOME';
  draft.incomePolicy.expenseTreatment = 'MARKET_ESTIMATE';
  draft.incomePolicy.basis = 'MARKET_VALUE';
  draft.incomePolicy.currency = 'SAR';
  draft.incomePolicy.valuationDate = '2026-09-05';
  return draft;
}

(function testEmptyDraftContainsNoEconomicDefaults() {
  const draft = emptyValuationCaseDraft();
  assert.strictEqual(draft.projectId, '');
  assert.strictEqual(draft.classification.assetClass, '');
  assert.strictEqual(draft.classification.lifecycleStage, '');
  assert.strictEqual(draft.classification.investmentStrategy, '');
  assert.strictEqual(draft.classification.incomeModel, '');
  assert.strictEqual(draft.incomePolicy.expenseTreatment, '');
  assert.strictEqual(draft.incomePolicy.basis, '');
  assert.strictEqual(draft.incomePolicy.currency, '');
  assert.strictEqual(draft.evidencePolicy.enabled, false);
  assert.strictEqual(draft.singleMethodPolicy.enabled, false);
})();

(function testIncompleteDraftFailsClosedAtFirstMissingExplicitField() {
  assert.throws(
    () => buildValuationCaseFromDraft(emptyValuationCaseDraft()),
    (error) => error instanceof ValuationCaseDraftError && error.reasonCode === 'REQUIRED_FIELD' && error.field === 'projectId',
  );
})();

(function testCompleteCoreDraftBuildsWithoutAddingOptionalPolicies() {
  const valuationCase = buildValuationCaseFromDraft(completeDraft());
  assert.strictEqual(valuationCase.schemaVersion, VALUATION_CASE_SCHEMA_VERSION);
  assert.strictEqual(valuationCase.projectId, 'PROJECT-DRAFT-001');
  assert.strictEqual(valuationCase.classification.assetClass, 'OFFICE');
  assert.strictEqual(valuationCase.incomePolicy.expenseTreatment, 'MARKET_ESTIMATE');
  assert.strictEqual(valuationCase.incomePolicy.basis, 'MARKET_VALUE');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(valuationCase, 'evidencePolicy'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(valuationCase, 'singleMethodPolicy'), false);
})();

(function testEvidencePolicyIsOnlyAddedWhenExplicitlyEnabledAndComplete() {
  const draft = completeDraft();
  draft.evidencePolicy.enabled = true;
  draft.evidencePolicy.minEvidenceCount = '3';
  draft.evidencePolicy.maxAssumptionBurdenRatio = '1';
  draft.evidencePolicy.maxLowGradeRatio = '1';
  const valuationCase = buildValuationCaseFromDraft(draft);
  assert.deepStrictEqual(valuationCase.evidencePolicy, {
    minEvidenceCount: 3,
    maxAssumptionBurdenRatio: 1,
    maxLowGradeRatio: 1,
  });

  const incomplete = completeDraft();
  incomplete.evidencePolicy.enabled = true;
  assert.throws(
    () => buildValuationCaseFromDraft(incomplete),
    (error) => error instanceof ValuationCaseDraftError && error.field === 'evidencePolicy.minEvidenceCount',
  );
})();

(function testSingleMethodAcceptanceRequiresExplicitMethodAndJustification() {
  const draft = completeDraft();
  draft.singleMethodPolicy.enabled = true;
  draft.singleMethodPolicy.allowedMethod = VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION;
  draft.singleMethodPolicy.justification = 'Professional review accepted one qualified method for this case.';
  const valuationCase = buildValuationCaseFromDraft(draft);
  assert.deepStrictEqual(valuationCase.singleMethodPolicy, {
    allowedMethod: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
    justification: 'Professional review accepted one qualified method for this case.',
  });

  const missingJustification = completeDraft();
  missingJustification.singleMethodPolicy.enabled = true;
  missingJustification.singleMethodPolicy.allowedMethod = VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION;
  assert.throws(
    () => buildValuationCaseFromDraft(missingJustification),
    (error) => error instanceof ValuationCaseDraftError && error.field === 'singleMethodPolicy.justification',
  );
})();

(function testDraftRoundTripPreservesExplicitPolicies() {
  const source = {
    schemaVersion: VALUATION_CASE_SCHEMA_VERSION,
    projectId: 'PROJECT-DRAFT-ROUNDTRIP',
    classification: {
      assetClass: 'RETAIL',
      lifecycleStage: 'EXISTING_OPERATING',
      investmentStrategy: 'ACQUIRE_HOLD',
      incomeModel: 'LEASE_INCOME',
    },
    incomePolicy: {
      expenseTreatment: 'ACTUAL_LANDLORD_OPEX',
      basis: 'INVESTMENT_VALUE',
      currency: 'SAR',
      valuationDate: null,
    },
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 0.5,
      maxLowGradeRatio: 0.25,
    },
    singleMethodPolicy: {
      allowedMethod: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      justification: 'Documented single-method policy.',
    },
  };

  const rebuilt = buildValuationCaseFromDraft(draftFromValuationCase(source));
  assert.deepStrictEqual(rebuilt, source);
})();

(function testInvalidPolicyRatiosDoNotGetClampedSilently() {
  const draft = completeDraft();
  draft.evidencePolicy.enabled = true;
  draft.evidencePolicy.minEvidenceCount = '3';
  draft.evidencePolicy.maxAssumptionBurdenRatio = '1.2';
  draft.evidencePolicy.maxLowGradeRatio = '1';
  assert.throws(
    () => buildValuationCaseFromDraft(draft),
    (error) => error instanceof ValuationCaseDraftError && error.reasonCode === 'OUT_OF_RANGE',
  );
})();

console.log('VALUATION_CASE_DRAFT_V1=PASS');
