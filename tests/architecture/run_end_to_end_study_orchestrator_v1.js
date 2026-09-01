'use strict';

const assert = require('assert');
const { READINESS_STATUS } = require('../../src/document-intelligence/contracts');
const { ORCHESTRATION_STATUS: EVIDENCE_ORCHESTRATION_STATUS } = require('../../src/project-model/universal-evidence-orchestrator');
const { ORCHESTRATION_STATUS: DECISION_QUALITY_STATUS } = require('../../src/decision-quality/orchestrator');
const { AI_STAGE_STATUS } = require('../../src/decision-intelligence/ai-expert-orchestrator');
const {
  STUDY_ORCHESTRATION_STATUS,
  buildEndToEndStudyOrchestration,
} = require('../../src/study-orchestration/end-to-end-study-orchestrator');

function baseline() {
  const caseId = 'case-e2e-1';
  const projectId = 'project-e2e-1';
  const stage = (status = 'READY') => ({ caseId, projectId, status, readyForDecisionControl: true, evidenceRefs: ['ev-1'] });
  return {
    caseId,
    projectId,
    evidenceOrchestration: {
      caseId,
      projectId,
      orchestrationStatus: EVIDENCE_ORCHESTRATION_STATUS.PROCESSED,
      readiness: { status: READINESS_STATUS.READY_FOR_UNDERWRITING_INPUT },
    },
    analyticalStages: {
      property: stage(),
      tenant: stage(),
      regulatory: stage(),
      valuation: stage(),
      financial: stage(),
      scenarioRisk: stage(),
      decisionThresholds: stage(),
    },
    decisionControl: {
      caseId,
      projectId,
      status: 'READY',
      readyForDecisionQuality: true,
      professionalReviewRequired: false,
    },
    decisionQuality: {
      caseId,
      projectId,
      status: DECISION_QUALITY_STATUS.READY_FOR_HUMAN_REVIEW,
      requiredActions: { nextBestDueDiligenceActionId: 'dd-1' },
    },
    aiStages: [
      { caseId, projectId, role: 'ANALYST', status: AI_STAGE_STATUS.OUTPUT_ACCEPTED },
      { caseId, projectId, role: 'CHALLENGER', status: AI_STAGE_STATUS.OUTPUT_ACCEPTED },
      { caseId, projectId, role: 'SYNTHESIZER', status: AI_STAGE_STATUS.READY_FOR_MODEL_CALL },
    ],
    professionalReview: { caseId, projectId, required: false, completed: false, status: 'NOT_REQUIRED' },
    icDossier: { caseId, projectId, status: 'READY', readyForHumanCommittee: true },
  };
}

(function readyPath() {
  const result = buildEndToEndStudyOrchestration(baseline());
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW);
  assert.strictEqual(result.gates.evidenceReady, true);
  assert.strictEqual(result.gates.analyticalReady, true);
  assert.strictEqual(result.gates.decisionControlReady, true);
  assert.strictEqual(result.gates.decisionQualityReady, true);
  assert.strictEqual(result.gates.aiReady, true);
  assert.strictEqual(result.gates.icDossierReady, true);
  assert.strictEqual(result.humanDecisionRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
  assert.strictEqual(result.aiMayOverrideDeterministicResults, false);
})();

(function evidenceFailureFailsClosed() {
  const input = baseline();
  input.evidenceOrchestration.readiness.status = READINESS_STATUS.HOLD_EVIDENCE;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_EVIDENCE);
})();

(function analyticalFailureFailsClosed() {
  const input = baseline();
  input.analyticalStages.valuation.readyForDecisionControl = false;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_ANALYTICAL_ENGINES);
  assert(result.reasonCodes.includes('ANALYTICAL_STAGE_VALUATION_NOT_READY'));
})();

(function decisionControlFailureFailsClosed() {
  const input = baseline();
  input.decisionControl.readyForDecisionQuality = false;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_DECISION_CONTROL);
})();

(function decisionQualityFailureFailsClosed() {
  const input = baseline();
  input.decisionQuality.status = DECISION_QUALITY_STATUS.HOLD_RELIABILITY;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_DECISION_QUALITY);
})();

(function aiFailureFailsClosed() {
  const input = baseline();
  input.aiStages[1].status = AI_STAGE_STATUS.HOLD_RELIABILITY;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_AI);
})();

(function professionalReviewFailureFailsClosed() {
  const input = baseline();
  input.professionalReview.required = true;
  input.professionalReview.completed = false;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_PROFESSIONAL_REVIEW);
})();

(function icDossierFailureFailsClosed() {
  const input = baseline();
  input.icDossier.readyForHumanCommittee = false;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.HOLD_IC_DOSSIER);
})();

(function scopeMismatchRejected() {
  const input = baseline();
  input.analyticalStages.financial.projectId = 'foreign-project';
  assert.throws(() => buildEndToEndStudyOrchestration(input), /SCOPE_MISMATCH/);
})();

(function dueDiligenceRequiredCanStillProceedToHumanReview() {
  const input = baseline();
  input.decisionQuality.status = DECISION_QUALITY_STATUS.DUE_DILIGENCE_REQUIRED;
  const result = buildEndToEndStudyOrchestration(input);
  assert.strictEqual(result.status, STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW);
  assert.strictEqual(result.nextBestDueDiligenceActionId, 'dd-1');
})();

console.log('END_TO_END_STUDY_ORCHESTRATOR_V1=PASS');
