'use strict';

const assert = require('assert');
const { AI_ROLE, AI_STAGE_STATUS } = require('../../src/decision-intelligence/ai-expert-orchestrator');
const { STUDY_ORCHESTRATION_STATUS } = require('../../src/study-orchestration/end-to-end-study-orchestrator');
const {
  WORKSPACE_STATUS,
  buildDecisionIntelligenceWorkspace,
} = require('../../src/decision-intelligence/workspace');

function baseline() {
  const caseId = 'case-workspace-1';
  const projectId = 'project-workspace-1';
  const ai = (role) => ({
    caseId,
    projectId,
    role,
    status: AI_STAGE_STATUS.OUTPUT_ACCEPTED,
    narrative: `${role} narrative`,
    citedEvidenceRefs: ['ev-1'],
    uncertainties: [],
    disagreements: [],
    diligenceSuggestions: [],
  });
  return {
    caseId,
    projectId,
    studyOrchestration: {
      caseId,
      projectId,
      status: STUDY_ORCHESTRATION_STATUS.READY_FOR_AI_AND_HUMAN_REVIEW,
    },
    decisionQuality: {
      caseId,
      projectId,
      status: 'READY_FOR_HUMAN_REVIEW',
      reliability: { overallReliability: 'HIGH' },
      dueDiligence: { nextBestAction: { id: 'dd-1', priority: 'HIGH' } },
      requiredActions: { humanReviewRequired: true },
    },
    evidenceRecords: [{
      caseId,
      projectId,
      id: 'ev-1',
      domain: 'TITLE',
      label: 'Title evidence',
      sourceRef: 'source-1',
      status: 'QUALIFIED',
      versionId: 'v1',
      effectiveAt: '2026-09-01T00:00:00Z',
      stale: false,
      conflict: false,
      verified: true,
    }],
    assumptionRecords: [{
      caseId,
      projectId,
      id: 'as-1',
      domain: 'VALUATION',
      label: 'Exit cap rate',
      valueDisplay: '8.5%',
      basis: 'Caller supplied market assumption',
      evidenceRefs: ['ev-1'],
      material: true,
      sensitivityRequired: true,
      approved: true,
    }],
    aiOutputs: [ai(AI_ROLE.ANALYST), ai(AI_ROLE.CHALLENGER), ai(AI_ROLE.SYNTHESIZER)],
  };
}

(function readyWorkspace() {
  const result = buildDecisionIntelligenceWorkspace(baseline());
  assert.strictEqual(result.status, WORKSPACE_STATUS.READY_FOR_REVIEW);
  assert.strictEqual(result.summary.evidenceCount, 1);
  assert.strictEqual(result.summary.assumptionCount, 1);
  assert.strictEqual(result.summary.acceptedAiRoleCount, 3);
  assert.strictEqual(result.numericAiConfidence, null);
  assert.strictEqual(result.aiMayOverrideDeterministicResults, false);
  assert.strictEqual(result.humanDecisionRequired, true);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function studyHoldPropagates() {
  const input = baseline();
  input.studyOrchestration.status = STUDY_ORCHESTRATION_STATUS.HOLD_EVIDENCE;
  const result = buildDecisionIntelligenceWorkspace(input);
  assert.strictEqual(result.status, WORKSPACE_STATUS.HOLD_STUDY);
})();

(function staleEvidenceFailsClosed() {
  const input = baseline();
  input.evidenceRecords[0].stale = true;
  const result = buildDecisionIntelligenceWorkspace(input);
  assert.strictEqual(result.status, WORKSPACE_STATUS.HOLD_EVIDENCE);
  assert.strictEqual(result.summary.staleEvidenceCount, 1);
})();

(function conflictFailsClosed() {
  const input = baseline();
  input.evidenceRecords[0].conflict = true;
  const result = buildDecisionIntelligenceWorkspace(input);
  assert.strictEqual(result.status, WORKSPACE_STATUS.HOLD_EVIDENCE);
})();

(function materialAssumptionNeedsApproval() {
  const input = baseline();
  input.assumptionRecords[0].approved = false;
  const result = buildDecisionIntelligenceWorkspace(input);
  assert.strictEqual(result.status, WORKSPACE_STATUS.HOLD_EVIDENCE);
  assert.strictEqual(result.summary.materialUnapprovedAssumptionCount, 1);
})();

(function missingAiRoleFailsClosed() {
  const input = baseline();
  input.aiOutputs = input.aiOutputs.filter((item) => item.role !== AI_ROLE.SYNTHESIZER);
  const result = buildDecisionIntelligenceWorkspace(input);
  assert.strictEqual(result.status, WORKSPACE_STATUS.HOLD_AI_OUTPUTS);
  assert(result.summary.missingAiRoles.includes(AI_ROLE.SYNTHESIZER));
})();

(function duplicateWorkspaceIdsRejected() {
  const input = baseline();
  input.assumptionRecords[0].id = 'ev-1';
  assert.throws(() => buildDecisionIntelligenceWorkspace(input), /DUPLICATE_WORKSPACE_RECORD_ID/);
})();

(function scopeMismatchRejected() {
  const input = baseline();
  input.evidenceRecords[0].projectId = 'foreign-project';
  assert.throws(() => buildDecisionIntelligenceWorkspace(input), /SCOPE_MISMATCH/);
})();

console.log('DECISION_INTELLIGENCE_WORKSPACE_V1=PASS');
