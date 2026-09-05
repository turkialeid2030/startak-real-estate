'use strict';

const assert = require('assert');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../../src/project-model/project-profile');
const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  EXPENSE_TREATMENT,
  createExistingBuildingValuationRequest,
  orchestrateValuationStage,
  VALUATION_STAGE_STATUS,
  VALUATION_REASON_CODE,
} = require('../../src/valuation-intelligence');

function classification(assetClass = ASSET_CLASS.OFFICE) {
  return {
    assetClass,
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
    jurisdiction: { country: 'SA', city: 'Riyadh' },
  };
}

function legacyInput() {
  return {
    projectTitle: 'Existing office building',
    marketCapRate: 0.07,
    currentLandPricePerSqm: 15000,
    buildingAge: 1,
    buildingUsefulLife: 30,
  };
}

function legacyResult() {
  return {
    totalAnnualIncome: 15724800,
    opexAmount: 864864,
    NOI: 14859936,
    currentLandValue: 79890000,
    totalReplacementConstructionValue: 65280000,
    totalAppraisedValue: 145170000,
    marketValueByIncomeCap: 212284800,
  };
}

function incomePolicy() {
  return {
    expenseTreatment: EXPENSE_TREATMENT.MARKET_ESTIMATE,
    basis: BASIS_OF_VALUE.MARKET_VALUE,
    currency: 'SAR',
    valuationDate: '2026-09-05',
  };
}

(function testAdapterRequiresExplicitSupportedClassification() {
  assert.throws(() => createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-001',
    projectId: 'PROJECT-EB-001',
    classification: classification(ASSET_CLASS.HOSPITALITY),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
    incomePolicy: incomePolicy(),
  }), /not supported by existing-building-ui adapter/);
})();

(function testAdapterRequiresExplicitIncomePolicy() {
  assert.throws(() => createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-002',
    projectId: 'PROJECT-EB-002',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
  }), /incomePolicy must be an object/);
})();

(function testAdapterDoesNotFabricateMarketComparablesOrCostPolicy() {
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-003',
    projectId: 'PROJECT-EB-003',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
    incomePolicy: incomePolicy(),
  });

  assert.ok(request.methodInputs[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]);
  assert.strictEqual(request.methodInputs[VALUATION_METHOD.MARKET_COMPARABLE], undefined);
  assert.strictEqual(request.methodInputs[VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT], undefined);
})();

(function testLegacyResultNumbersAreCarriedWithoutReimplementation() {
  const input = legacyInput();
  const result = legacyResult();
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-004',
    projectId: 'PROJECT-EB-004',
    classification: classification(),
    legacyInput: input,
    legacyResult: result,
    incomePolicy: incomePolicy(),
  });
  const income = request.methodInputs[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION];

  assert.strictEqual(income.effectiveGrossIncome, result.totalAnnualIncome);
  assert.strictEqual(income.operatingExpenses, result.opexAmount);
  assert.strictEqual(income.capitalizationRate, input.marketCapRate);
  assert.strictEqual(income.expenseTreatment, EXPENSE_TREATMENT.MARKET_ESTIMATE);
  assert.strictEqual(income.basis, BASIS_OF_VALUE.MARKET_VALUE);
})();

(function testDefaultEvidenceIsExplicitlyUnverifiedClientInput() {
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-005',
    projectId: 'PROJECT-EB-005',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
    incomePolicy: incomePolicy(),
  });
  const income = request.methodInputs[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION];

  for (const descriptor of [income.incomeEvidence, income.expenseEvidence, income.capRateEvidence]) {
    assert.strictEqual(descriptor.grade, EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED);
    assert.strictEqual(descriptor.status, INPUT_STATUS.UNVERIFIED);
    assert.strictEqual(descriptor.sourceType, 'STARTAK_EXISTING_BUILDING_UI');
  }
})();

(function testUnverifiedUiEvidenceCannotBecomeReadyWithoutGovernancePolicy() {
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-006',
    projectId: 'PROJECT-EB-006',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
    incomePolicy: incomePolicy(),
  });
  const stage = orchestrateValuationStage(request);

  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.strictEqual(stage.readyForDecisionControl, false);
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.EVIDENCE_QUALITY_POLICY_REQUIRED));
})();

(function testPermissiveEvidencePolicyStillRequiresSingleMethodAcceptancePolicy() {
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-007',
    projectId: 'PROJECT-EB-007',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: legacyResult(),
    incomePolicy: incomePolicy(),
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
  });
  const stage = orchestrateValuationStage(request);

  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_REQUIRED]);
  assert.strictEqual(stage.readyForDecisionControl, false);
})();

(function testCostApproachRequiresExplicitDepreciationAndCarriesLegacyComponentsExactly() {
  const result = legacyResult();
  const request = createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-008',
    projectId: 'PROJECT-EB-008',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: result,
    incomePolicy: incomePolicy(),
    costPolicy: {
      depreciationRate: 0.1,
      indirectCosts: [],
      basis: BASIS_OF_VALUE.MARKET_VALUE,
      currency: 'SAR',
      valuationDate: '2026-09-05',
    },
  });
  const cost = request.methodInputs[VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT];

  assert.strictEqual(cost.landValue, result.currentLandValue);
  assert.strictEqual(cost.directReplacementCost, result.totalReplacementConstructionValue);
  assert.strictEqual(cost.depreciationRate, 0.1);
  assert.deepStrictEqual(cost.indirectCosts, []);

  assert.throws(() => createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-009',
    projectId: 'PROJECT-EB-009',
    classification: classification(),
    legacyInput: legacyInput(),
    legacyResult: result,
    incomePolicy: incomePolicy(),
    costPolicy: {
      indirectCosts: [],
      basis: BASIS_OF_VALUE.MARKET_VALUE,
      currency: 'SAR',
    },
  }), /costPolicy.depreciationRate/);
})();

(function testAdapterDoesNotMutateLegacyInputOrResult() {
  const input = legacyInput();
  const result = legacyResult();
  const inputBefore = JSON.stringify(input);
  const resultBefore = JSON.stringify(result);

  createExistingBuildingValuationRequest({
    caseId: 'CASE-EB-010',
    projectId: 'PROJECT-EB-010',
    classification: classification(),
    legacyInput: input,
    legacyResult: result,
    incomePolicy: incomePolicy(),
  });

  assert.strictEqual(JSON.stringify(input), inputBefore);
  assert.strictEqual(JSON.stringify(result), resultBefore);
})();

console.log('EXISTING_BUILDING_VALUATION_ADAPTER_V1=PASS');
