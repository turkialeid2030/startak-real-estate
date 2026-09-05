'use strict';

const assert = require('assert');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
  createProjectProfile,
} = require('../../src/project-model/project-profile');
const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
  EXPENSE_TREATMENT,
  createComparable,
  createValuationRequest,
  orchestrateValuationStage,
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('../../src/valuation-intelligence');

function officeProfile(projectId = 'PROJECT-VAL-001') {
  return createProjectProfile({
    projectId,
    projectName: 'Office valuation orchestration test',
    assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
    jurisdiction: { country: 'SA', city: 'Riyadh' },
  });
}

function evidenceDescriptor(grade, sourceRef) {
  return {
    grade,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'TEST_EVIDENCE',
    sourceRef,
    observedAt: '2026-09-05',
  };
}

function evidencePolicy() {
  return {
    minEvidenceCount: 2,
    maxAssumptionBurdenRatio: 1,
    maxLowGradeRatio: 1,
  };
}

function qualifiedMethodInputs({ incomeBasis = BASIS_OF_VALUE.MARKET_VALUE, income = 1000000, opex = 200000, capRate = 0.08 } = {}) {
  const comparables = [
    createComparable({
      comparableId: 'COMP-1',
      unitValue: 10000,
      transactionStatus: TRANSACTION_STATUS.EXECUTED_SALE,
      evidenceGrade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
      sourceRef: 'SALE-1',
      transactionDate: '2026-08-01',
    }),
    createComparable({
      comparableId: 'COMP-2',
      unitValue: 11000,
      transactionStatus: TRANSACTION_STATUS.EXECUTED_SALE,
      evidenceGrade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
      sourceRef: 'SALE-2',
      transactionDate: '2026-08-15',
    }),
  ];

  return {
    [VALUATION_METHOD.MARKET_COMPARABLE]: {
      comparables,
      subjectArea: 1000,
      basis: BASIS_OF_VALUE.MARKET_VALUE,
      weightingPolicy: WEIGHTING_POLICY.EQUAL,
      valuationDate: '2026-09-05',
      currency: 'SAR',
    },
    [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: {
      effectiveGrossIncome: income,
      operatingExpenses: opex,
      capitalizationRate: capRate,
      expenseTreatment: EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,
      incomeEvidence: evidenceDescriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'INCOME-1'),
      expenseEvidence: evidenceDescriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'OPEX-1'),
      capRateEvidence: evidenceDescriptor(EVIDENCE_GRADE.E_MARKET_OBSERVATION, 'CAP-1'),
      basis: incomeBasis,
      valuationDate: '2026-09-05',
      currency: 'SAR',
    },
  };
}

function explicitPolicy() {
  return {
    methodWeights: {
      [VALUATION_METHOD.MARKET_COMPARABLE]: 0.5,
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.5,
    },
    dispersionThreshold: 0.1,
  };
}

(function testQualifiedTwoMethodStageBecomesReady() {
  const projectProfile = officeProfile();
  const request = createValuationRequest({
    caseId: 'CASE-VAL-001',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    evidencePolicy: evidencePolicy(),
    reconciliationPolicy: explicitPolicy(),
  });
  const stage = orchestrateValuationStage(request);

  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
  assert.strictEqual(stage.readyForDecisionControl, true);
  assert.strictEqual(stage.finalValue, 10250000);
  assert.strictEqual(stage.reconciliation.reconciledValue, 10250000);
  assert.deepStrictEqual(stage.reasonCodes, []);
  assert.strictEqual(stage.transactionAuthorized, false);

  const market = stage.methods.find((item) => item.method === VALUATION_METHOD.MARKET_COMPARABLE);
  const income = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  const cost = stage.methods.find((item) => item.method === VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT);
  assert.strictEqual(market.state, METHOD_STATE.AVAILABLE);
  assert.strictEqual(income.state, METHOD_STATE.AVAILABLE);
  assert.strictEqual(cost.state, METHOD_STATE.HOLD);
  assert.strictEqual(cost.reasonCode, VALUATION_REASON_CODE.METHOD_INPUTS_REQUIRED);
  assert.strictEqual(market.evidenceQuality.status, 'QUALIFIED');
  assert.strictEqual(income.evidenceQuality.status, 'QUALIFIED');
  assert.ok(stage.evidenceRefs.includes('SALE-1'));
  assert.ok(stage.evidenceRefs.includes('CAP-1'));
})();

(function testNoHiddenEvidenceQualityPolicyDefault() {
  const projectProfile = officeProfile('PROJECT-VAL-002');
  const request = createValuationRequest({
    caseId: 'CASE-VAL-002',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    reconciliationPolicy: explicitPolicy(),
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.strictEqual(stage.readyForDecisionControl, false);
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD));
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.EVIDENCE_QUALITY_POLICY_REQUIRED));
  const market = stage.methods.find((item) => item.method === VALUATION_METHOD.MARKET_COMPARABLE);
  assert.strictEqual(market.state, METHOD_STATE.HOLD);
  assert.strictEqual(market.reasonCode, VALUATION_REASON_CODE.EVIDENCE_QUALITY_POLICY_REQUIRED);
})();

(function testNoHiddenReconciliationPolicyDefault() {
  const projectProfile = officeProfile('PROJECT-VAL-003');
  const request = createValuationRequest({
    caseId: 'CASE-VAL-003',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    evidencePolicy: evidencePolicy(),
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.strictEqual(stage.readyForDecisionControl, false);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED]);
  assert.strictEqual(stage.finalValue, null);
})();

(function testReconciliationPolicyMustMatchQualifiedMethodSetExactly() {
  const projectProfile = officeProfile('PROJECT-VAL-004');
  const request = createValuationRequest({
    caseId: 'CASE-VAL-004',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    evidencePolicy: evidencePolicy(),
    reconciliationPolicy: {
      methodWeights: {
        [VALUATION_METHOD.MARKET_COMPARABLE]: 0.4,
        [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.4,
        [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: 0.2,
      },
      dispersionThreshold: 0.1,
    },
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.RECONCILIATION_METHOD_SET_MISMATCH]);
})();

(function testMissingInputsAreVisibleAndFailClosed() {
  const projectProfile = officeProfile('PROJECT-VAL-005');
  const request = createValuationRequest({
    caseId: 'CASE-VAL-005',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: {},
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_INPUTS);
  assert.strictEqual(stage.readyForDecisionControl, false);
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD));
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.METHOD_INPUTS_REQUIRED));
  assert.ok(stage.evidenceGaps.includes(`${VALUATION_METHOD.MARKET_COMPARABLE}.comparables`));
  assert.ok(stage.evidenceGaps.includes(`${VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION}.capitalizationRate`));
})();

(function testEngineValidationFailureIsConvertedToMethodHold() {
  const projectProfile = officeProfile('PROJECT-VAL-006');
  const badInputs = qualifiedMethodInputs({ capRate: 1.2 });
  const request = createValuationRequest({
    caseId: 'CASE-VAL-006',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: badInputs,
    evidencePolicy: evidencePolicy(),
  });
  const stage = orchestrateValuationStage(request);
  const income = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(income.state, METHOD_STATE.HOLD);
  assert.strictEqual(income.reasonCode, VALUATION_REASON_CODE.METHOD_INPUT_INVALID);
  assert.match(income.errorMessage, /capitalizationRate/);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_REQUIRED]);
})();

(function testBasisMismatchFailsClosedAtReconciliation() {
  const projectProfile = officeProfile('PROJECT-VAL-007');
  const request = createValuationRequest({
    caseId: 'CASE-VAL-007',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs({ incomeBasis: BASIS_OF_VALUE.INVESTMENT_VALUE }),
    evidencePolicy: evidencePolicy(),
    reconciliationPolicy: explicitPolicy(),
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_POLICY);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.RECONCILIATION_BASIS_MISMATCH]);
  assert.strictEqual(stage.finalValue, null);
})();

(function testOperatingBusinessIncomeDoesNotSilentlyUseGenericCapitalization() {
  const projectProfile = createProjectProfile({
    projectId: 'PROJECT-VAL-008',
    assetClasses: [ASSET_CLASS.HOSPITALITY],
    lifecycleStage: LIFECYCLE_STAGE.EXISTING_OPERATING,
    investmentStrategy: INVESTMENT_STRATEGY.ACQUIRE_HOLD,
    incomeModel: INCOME_MODEL.OPERATING_BUSINESS,
  });
  const request = createValuationRequest({
    caseId: 'CASE-VAL-008',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    evidencePolicy: evidencePolicy(),
  });
  const stage = orchestrateValuationStage(request);
  const directCap = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  const operatingBusiness = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_OPERATING_BUSINESS);
  assert.strictEqual(directCap.state, METHOD_STATE.UNAVAILABLE);
  assert.strictEqual(directCap.reasonCode, VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED);
  assert.strictEqual(operatingBusiness.state, METHOD_STATE.UNAVAILABLE);
  assert.strictEqual(operatingBusiness.reasonCode, VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED);
})();

(function testMixedUseRequiresExplicitComponents() {
  const projectProfile = createProjectProfile({
    projectId: 'PROJECT-VAL-009',
    assetClasses: [ASSET_CLASS.MIXED_USE],
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.MIXED,
  });
  const request = createValuationRequest({
    caseId: 'CASE-VAL-009',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: qualifiedMethodInputs(),
    evidencePolicy: evidencePolicy(),
    reconciliationPolicy: explicitPolicy(),
  });
  const stage = orchestrateValuationStage(request);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_INPUTS);
  assert.deepStrictEqual(stage.reasonCodes, [VALUATION_REASON_CODE.MIXED_USE_COMPONENTS_REQUIRED]);
  assert.ok(stage.evidenceGaps.includes('useComponents'));
})();

(function testProjectScopeMismatchIsRejected() {
  const projectProfile = officeProfile('PROJECT-VAL-010');
  assert.throws(() => createValuationRequest({
    caseId: 'CASE-VAL-010',
    projectId: 'OTHER-PROJECT',
    projectProfile,
  }), /VALUATION_REQUEST_PROJECT_SCOPE_MISMATCH/);
})();

console.log('VALUATION_STAGE_ORCHESTRATOR_V1=PASS');
