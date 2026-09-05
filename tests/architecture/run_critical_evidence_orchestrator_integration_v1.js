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
  EXPENSE_TREATMENT,
  createValuationRequest,
  orchestrateValuationStage,
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('../../src/valuation-intelligence');

function profile(projectId) {
  return createProjectProfile({
    projectId,
    assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
}

function descriptor(field) {
  return {
    grade: field === 'capitalizationRate' ? EVIDENCE_GRADE.E_MARKET_OBSERVATION : EVIDENCE_GRADE.D_OPERATING_ACTUAL,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'TEST_EVIDENCE',
    sourceRef: `REF-${field}`,
    observedAt: '2026-09-05',
  };
}

function incomeInput() {
  return {
    effectiveGrossIncome: 1000000,
    operatingExpenses: 200000,
    capitalizationRate: 0.08,
    expenseTreatment: EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,
    incomeEvidence: descriptor('effectiveGrossIncome'),
    expenseEvidence: descriptor('operatingExpenses'),
    capRateEvidence: descriptor('capitalizationRate'),
    basis: BASIS_OF_VALUE.MARKET_VALUE,
    valuationDate: '2026-09-05',
    currency: 'SAR',
  };
}

const evidencePolicy = {
  minEvidenceCount: 3,
  maxAssumptionBurdenRatio: 0,
  maxLowGradeRatio: 0,
};
const singleMethodPolicy = {
  allowedMethod: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
  justification: 'Explicit single-method acceptance for critical evidence integration test.',
};

(function criticalRequirementPassesOnExactEngineEvidenceField() {
  const projectProfile = profile('PROJECT-CRIT-001');
  const request = createValuationRequest({
    caseId: 'CASE-CRIT-001',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: {
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: incomeInput(),
    },
    evidencePolicy,
    criticalEvidenceRequirements: {
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: [{
        field: 'effectiveGrossIncome',
        allowedGrades: [EVIDENCE_GRADE.D_OPERATING_ACTUAL],
        allowedStatuses: [INPUT_STATUS.OBSERVED],
      }],
    },
    singleMethodPolicy,
  });
  const stage = orchestrateValuationStage(request);
  const income = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(income.state, METHOD_STATE.AVAILABLE);
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
  assert.strictEqual(stage.readyForDecisionControl, true);
})();

(function criticalRequirementFailsClosedWhenQualityDoesNotMatch() {
  const projectProfile = profile('PROJECT-CRIT-002');
  const request = createValuationRequest({
    caseId: 'CASE-CRIT-002',
    projectId: projectProfile.projectId,
    projectProfile,
    methodInputs: {
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: incomeInput(),
    },
    evidencePolicy,
    criticalEvidenceRequirements: {
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: [{
        field: 'effectiveGrossIncome',
        allowedGrades: [EVIDENCE_GRADE.A_VERIFIED_OFFICIAL],
        allowedStatuses: [INPUT_STATUS.VERIFIED],
      }],
    },
    singleMethodPolicy,
  });
  const stage = orchestrateValuationStage(request);
  const income = stage.methods.find((item) => item.method === VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION);
  assert.strictEqual(income.state, METHOD_STATE.HOLD);
  assert.strictEqual(income.reasonCode, VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD);
  assert.ok(income.evidenceGaps.includes(`${VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION}.effectiveGrossIncome`));
  assert.strictEqual(stage.status, VALUATION_STAGE_STATUS.HOLD_EVIDENCE);
  assert.strictEqual(stage.readyForDecisionControl, false);
  assert.ok(stage.reasonCodes.includes(VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD));
})();

console.log('CRITICAL_EVIDENCE_ORCHESTRATOR_INTEGRATION_V1=PASS');
console.log('CRITICAL_EVIDENCE_FAIL_CLOSED=PASS');
