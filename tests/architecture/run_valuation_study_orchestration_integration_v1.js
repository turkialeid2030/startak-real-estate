'use strict';

const assert = require('assert');
const {
  READINESS_STATUS,
} = require('../../src/document-intelligence/contracts');
const {
  ORCHESTRATION_STATUS: EVIDENCE_ORCHESTRATION_STATUS,
} = require('../../src/project-model/universal-evidence-orchestrator');
const {
  ORCHESTRATION_STATUS: DECISION_QUALITY_STATUS,
} = require('../../src/decision-quality/orchestrator');
const {
  STUDY_ORCHESTRATION_STATUS,
  REQUIRED_ANALYTICAL_STAGES,
  buildEndToEndStudyOrchestration,
} = require('../../src/study-orchestration/end-to-end-study-orchestrator');
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
} = require('../../src/valuation-intelligence');

const caseId = 'CASE-STUDY-VAL-001';
const projectId = 'PROJECT-STUDY-VAL-001';

function descriptor(grade, ref) {
  return {
    grade,
    status: INPUT_STATUS.OBSERVED,
    sourceType: 'TEST_SOURCE',
    sourceRef: ref,
    observedAt: '2026-09-05',
  };
}

function valuationStage({ includeEvidencePolicy = true } = {}) {
  const profile = createProjectProfile({
    projectId,
    assetClasses: [ASSET_CLASS.OFFICE],
    lifecycleStage: LIFECYCLE_STAGE.STABILIZED,
    investmentStrategy: INVESTMENT_STRATEGY.CORE_INCOME,
    incomeModel: INCOME_MODEL.LEASE_INCOME,
  });
  const comparables = [
    createComparable({
      comparableId: 'C1',
      unitValue: 10000,
      transactionStatus: TRANSACTION_STATUS.EXECUTED_SALE,
      evidenceGrade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
      sourceRef: 'SALE-1',
      transactionDate: '2026-09-01',
    }),
    createComparable({
      comparableId: 'C2',
      unitValue: 10000,
      transactionStatus: TRANSACTION_STATUS.EXECUTED_SALE,
      evidenceGrade: EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
      sourceRef: 'SALE-2',
      transactionDate: '2026-09-02',
    }),
  ];
  const request = createValuationRequest({
    caseId,
    projectId,
    projectProfile: profile,
    methodInputs: {
      [VALUATION_METHOD.MARKET_COMPARABLE]: {
        comparables,
        subjectArea: 1000,
        basis: BASIS_OF_VALUE.MARKET_VALUE,
        weightingPolicy: WEIGHTING_POLICY.EQUAL,
        valuationDate: '2026-09-05',
        currency: 'SAR',
      },
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: {
        effectiveGrossIncome: 1000000,
        operatingExpenses: 200000,
        capitalizationRate: 0.08,
        expenseTreatment: EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,
        incomeEvidence: descriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'INCOME-1'),
        expenseEvidence: descriptor(EVIDENCE_GRADE.D_OPERATING_ACTUAL, 'OPEX-1'),
        capRateEvidence: descriptor(EVIDENCE_GRADE.E_MARKET_OBSERVATION, 'CAP-1'),
        basis: BASIS_OF_VALUE.MARKET_VALUE,
        valuationDate: '2026-09-05',
        currency: 'SAR',
      },
    },
    evidencePolicy: includeEvidencePolicy ? {
      minEvidenceCount: 2,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    } : null,
    reconciliationPolicy: {
      methodWeights: {
        [VALUATION_METHOD.MARKET_COMPARABLE]: 0.5,
        [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 0.5,
      },
      dispersionThreshold: 0.01,
    },
  });
  return orchestrateValuationStage(request);
}

function readyDependencies(valuation) {
  const analyticalStages = Object.fromEntries(REQUIRED_ANALYTICAL_STAGES.map((name) => [name, {
    caseId,
    projectId,
    status: 'READY',
    readyForDecisionControl: true,
    evidenceRefs: [`${name.toUpperCase()}-EVIDENCE`],
  }]));
  analyticalStages.valuation = valuation;
  return {
    caseId,
    projectId,
    evidenceOrchestration: {
      caseId,
      projectId,
      orchestrationStatus: EVIDENCE_ORCHESTRATION_STATUS.PROCESSED,
      readiness: { status: READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT },
    },
    analyticalStages,
    decisionControl: {
      caseId,
      projectId,
      readyForDecisionQuality: true,
      professionalReviewRequired: false,
    },
    decisionQuality: {
      caseId,
      projectId,
      status: DECISION_QUALITY_STATUS.READY_FOR_HUMAN_REVIEW,
      requiredActions: {},
    },
    aiStages: [],
    professionalReview: {
      caseId,
      projectId,
      required: false,
      completed: false,
    },
    icDossier: {
      caseId,
      projectId,
      readyForHumanCommittee: true,
    },
  };
}

(function testQualifiedValuationFeedsExistingStudyOrchestratorWithoutNewRootOrchestration() {
  const valuation = valuationStage();
  assert.strictEqual(valuation.status, VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
  const study = buildEndToEndStudyOrchestration(readyDependencies(valuation));
  assert.strictEqual(study.status, STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW);
  assert.strictEqual(study.gates.analyticalReady, true);
  assert.strictEqual(study.analyticalStages.valuation.readyForDecisionControl, true);
  assert.ok(study.analyticalStages.valuation.evidenceRefs.includes('SALE-1'));
  assert.strictEqual(study.transactionAuthorized, false);
})();

(function testValuationHoldFailsClosedAtExistingAnalyticalGate() {
  const valuation = valuationStage({ includeEvidencePolicy: false });
  assert.strictEqual(valuation.readyForDecisionControl, false);
  const study = buildEndToEndStudyOrchestration(readyDependencies(valuation));
  assert.strictEqual(study.status, STUDY_ORCHESTRATION_STATUS.HOLD_ANALYTICAL_ENGINES);
  assert.strictEqual(study.gates.analyticalReady, false);
  assert.ok(study.reasonCodes.includes('ANALYTICAL_STAGE_VALUATION_NOT_READY'));
})();

(function testValuationScopeMismatchIsRejectedByExistingStudyOrchestrator() {
  const valuation = { ...valuationStage(), projectId: 'OTHER-PROJECT' };
  assert.throws(
    () => buildEndToEndStudyOrchestration(readyDependencies(valuation)),
    /SCOPE_MISMATCH/,
  );
})();

console.log('VALUATION_STUDY_ORCHESTRATION_INTEGRATION_V1=PASS');
console.log('NO_DUPLICATE_ROOT_ORCHESTRATION=PASS');
console.log('VALUATION_HOLD_FAILS_CLOSED_IN_STUDY_GATE=PASS');
