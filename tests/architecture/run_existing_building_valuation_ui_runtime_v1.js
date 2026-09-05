'use strict';

const assert = require('assert');
const gold = require('../reference/RE-GOLD-baseline.json');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  VALUATION_STAGE_STATUS,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
} = require('../../src/valuation-intelligence');
const {
  emptyAdvancedValuationDraft,
  emptyComparableDraft,
  applyAdvancedDraftToValuationCase,
} = require('../../src/app/valuation-advanced-draft');
const {
  evaluateExistingBuildingValuation,
  VALUATION_RUNTIME_MODE,
} = require('../../src/app/existing-building-valuation-runtime');

const legacyInput = gold['RE-GOLD-002_existing_building'].inputs;
const legacyResult = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: legacyInput,
  leverageEnabled: false,
});

function baseValuationCase() {
  return {
    schemaVersion: 1,
    projectId: 'PROJECT-UI-RUNTIME-001',
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
  };
}

function evidenceDescriptor(grade, sourceType, sourceRef) {
  return {
    enabled: true,
    grade,
    status: INPUT_STATUS.OBSERVED,
    sourceType,
    sourceRef,
    observedAt: '2026-09-05',
    note: '',
  };
}

function comparableRow(id, unitValue) {
  const row = emptyComparableDraft();
  row.comparableId = id;
  row.unitValue = String(unitValue);
  row.transactionStatus = TRANSACTION_STATUS.EXECUTED_SALE;
  row.evidenceGrade = EVIDENCE_GRADE.B_VERIFIED_TRANSACTION;
  row.transactionDate = '2026-09-01';
  row.sourceRef = `SOURCE-${id}`;
  return row;
}

(function testNoConfigurationKeepsLegacyOnlyRuntime() {
  const runtime = evaluateExistingBuildingValuation({
    caseId: 'CASE-LEGACY-ONLY',
    legacyInput,
    legacyResult,
    valuationCase: null,
  });
  assert.strictEqual(runtime.mode, VALUATION_RUNTIME_MODE.LEGACY_ONLY);
  assert.strictEqual(runtime.stage, null);
  assert.strictEqual(runtime.presentation, null);
  assert.strictEqual(legacyResult.financialModelVersion.startsWith('BUILDING_WAVE_A_'), true);
})();

(function testAdvancedDraftFlowsThroughAdapterOrchestratorAndPresentation() {
  const directCapValue = legacyResult.NOI / legacyInput.marketCapRate;
  const area = legacyResult.netLeasableArea;
  const unitValue = directCapValue / area;

  const draft = emptyAdvancedValuationDraft();
  draft.evidence.income = evidenceDescriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'OPERATING_LEDGER', 'INCOME-001');
  draft.evidence.expenses = evidenceDescriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'OPERATING_LEDGER', 'OPEX-001');
  draft.evidence.capRate = evidenceDescriptor(EVIDENCE_GRADE.E_MARKET_OBSERVATION, 'MARKET_RESEARCH', 'CAP-001');

  draft.marketComparable.enabled = true;
  draft.marketComparable.subjectArea = String(area);
  draft.marketComparable.basis = 'MARKET_VALUE';
  draft.marketComparable.weightingPolicy = WEIGHTING_POLICY.EQUAL;
  draft.marketComparable.valuationDate = '2026-09-05';
  draft.marketComparable.currency = 'SAR';
  draft.marketComparable.comparables = [
    comparableRow('COMP-001', unitValue * 0.98),
    comparableRow('COMP-002', unitValue * 1.02),
  ];

  draft.reconciliation.enabled = true;
  draft.reconciliation.dispersionThreshold = '0.05';
  draft.reconciliation.methodWeights[VALUATION_METHOD.MARKET_COMPARABLE] = '0.5';
  draft.reconciliation.methodWeights[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION] = '0.5';

  const valuationCase = applyAdvancedDraftToValuationCase(baseValuationCase(), draft);
  const runtime = evaluateExistingBuildingValuation({
    caseId: 'CASE-UI-RUNTIME-001',
    legacyInput,
    legacyResult,
    valuationCase,
  });

  assert.strictEqual(runtime.mode, VALUATION_RUNTIME_MODE.VALUATION_V1);
  assert.strictEqual(runtime.stage.status, VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
  assert.strictEqual(runtime.stage.readyForDecisionControl, true);
  assert.strictEqual(runtime.presentation.state, 'AVAILABLE');
  assert.strictEqual(runtime.presentation.transactionAuthorized, false);
  assert.ok(Number.isFinite(runtime.presentation.finalValue));
  assert.ok(Math.abs(runtime.presentation.finalValue - directCapValue) < 1e-6);

  const market = runtime.stage.methods.find((item) => item.method === VALUATION_METHOD.MARKET_COMPARABLE);
  const income = runtime.stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(market.state, 'AVAILABLE');
  assert.strictEqual(income.state, 'AVAILABLE');
  assert.ok(runtime.stage.evidenceRefs.includes('SOURCE-COMP-001'));
  assert.ok(runtime.stage.evidenceRefs.includes('CAP-001'));
})();

(function testAdvancedEvidenceNeverMutatesLegacyFinancialResult() {
  const before = JSON.stringify(legacyResult);
  const draft = emptyAdvancedValuationDraft();
  draft.evidence.income = evidenceDescriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'LEDGER', 'I-2');
  const valuationCase = applyAdvancedDraftToValuationCase(baseValuationCase(), draft);
  evaluateExistingBuildingValuation({
    caseId: 'CASE-UI-RUNTIME-002',
    legacyInput,
    legacyResult,
    valuationCase,
  });
  assert.strictEqual(JSON.stringify(legacyResult), before);
})();

console.log('EXISTING_BUILDING_VALUATION_UI_RUNTIME_V1=PASS');
console.log('LEGACY_ENGINE_OUTPUT_IMMUTABLE=PASS');
console.log('ADVANCED_CONFIGURATION_TO_RUNTIME=PASS');
