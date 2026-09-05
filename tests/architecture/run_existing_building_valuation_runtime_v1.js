'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  VALUATION_METHOD,
  VALUATION_STAGE_STATUS,
  VALUATION_CASE_SCHEMA_VERSION,
} = require('../../src/valuation-intelligence');
const {
  VALUATION_RUNTIME_MODE,
  evaluateExistingBuildingValuation,
} = require('../../src/app/existing-building-valuation-runtime');
const gold = require('../reference/RE-GOLD-baseline.json');

function valuationCase() {
  return {
    schemaVersion: VALUATION_CASE_SCHEMA_VERSION,
    projectId: 'PROJECT-RUNTIME-001',
    classification: {
      assetClass: 'OFFICE',
      lifecycleStage: 'STABILIZED',
      investmentStrategy: 'CORE_INCOME',
      incomeModel: 'LEASE_INCOME',
      jurisdiction: { country: 'SA', city: 'Riyadh' },
    },
    incomePolicy: {
      expenseTreatment: 'MARKET_ESTIMATE',
      basis: 'MARKET_VALUE',
      currency: 'SAR',
      valuationDate: '2026-09-05',
    },
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
    singleMethodPolicy: {
      allowedMethod: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      justification: 'Explicit test-scope acceptance of one qualified income indication.',
    },
  };
}

(function testNoValuationConfigurationPreservesLegacyOnlyMode() {
  const input = gold['RE-GOLD-002_existing_building'].inputs;
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: input, leverageEnabled: false });
  const inputBefore = JSON.stringify(input);
  const resultBefore = JSON.stringify(result);

  const runtime = evaluateExistingBuildingValuation({
    caseId: 'CASE-RUNTIME-LEGACY',
    legacyInput: input,
    legacyResult: result,
  });

  assert.strictEqual(runtime.mode, VALUATION_RUNTIME_MODE.LEGACY_ONLY);
  assert.strictEqual(runtime.stage, null);
  assert.strictEqual(runtime.presentation, null);
  assert.strictEqual(runtime.projectId, null);
  assert.strictEqual(JSON.stringify(input), inputBefore);
  assert.strictEqual(JSON.stringify(result), resultBefore);
})();

(function testConfiguredValuationRunsAdditivelyFromLegacyResult() {
  const input = gold['RE-GOLD-002_existing_building'].inputs;
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: input, leverageEnabled: false });
  const inputBefore = JSON.stringify(input);
  const resultBefore = JSON.stringify(result);

  const runtime = evaluateExistingBuildingValuation({
    caseId: 'CASE-RUNTIME-V1',
    legacyInput: input,
    legacyResult: result,
    valuationCase: valuationCase(),
  });

  assert.strictEqual(runtime.mode, VALUATION_RUNTIME_MODE.VALUATION_V1);
  assert.strictEqual(runtime.projectId, 'PROJECT-RUNTIME-001');
  assert.strictEqual(runtime.stage.status, VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
  assert.strictEqual(runtime.stage.readyForDecisionControl, true);
  assert.strictEqual(runtime.stage.reconciliation, null);
  assert.strictEqual(runtime.stage.singleMethodAcceptance.method, VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(runtime.presentation.state, 'AVAILABLE');
  assert.strictEqual(runtime.presentation.singleMethodAcceptance.method, VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(runtime.stage.finalValue, result.NOI / input.marketCapRate);
  assert.strictEqual(JSON.stringify(input), inputBefore);
  assert.strictEqual(JSON.stringify(result), resultBefore);
})();

(function testConfiguredValuationStillFailsClosedWithoutEvidencePolicy() {
  const input = gold['RE-GOLD-002_existing_building'].inputs;
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: input, leverageEnabled: false });
  const config = valuationCase();
  delete config.evidencePolicy;

  const runtime = evaluateExistingBuildingValuation({
    caseId: 'CASE-RUNTIME-HOLD',
    legacyInput: input,
    legacyResult: result,
    valuationCase: config,
  });

  assert.strictEqual(runtime.mode, VALUATION_RUNTIME_MODE.VALUATION_V1);
  assert.strictEqual(runtime.stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.strictEqual(runtime.stage.readyForDecisionControl, false);
  assert.strictEqual(runtime.presentation.state, 'HOLD');
})();

(function testInvalidValuationCaseIsRejectedRatherThanRepaired() {
  const input = gold['RE-GOLD-002_existing_building'].inputs;
  const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: input, leverageEnabled: false });
  const config = valuationCase();
  config.schemaVersion = 999;

  assert.throws(() => evaluateExistingBuildingValuation({
    caseId: 'CASE-RUNTIME-INVALID',
    legacyInput: input,
    legacyResult: result,
    valuationCase: config,
  }), /UNSUPPORTED_SCHEMA_VERSION/);
})();

console.log('EXISTING_BUILDING_VALUATION_RUNTIME_V1=PASS');
