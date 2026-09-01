'use strict';

const assert = require('assert');
const fs = require('fs');
const { OUTCOME_FEEDBACK_STATUS } = require('../../src/decision-quality/outcome-feedback');
const { LEARNING_STATUS, buildDecisionLearningReview } = require('../../src/decision-quality/learning-loop');

const baseFeedback = {
  schemaVersion: 1,
  caseId: 'case-learning-1',
  projectId: 'project-learning-1',
  status: OUTCOME_FEEDBACK_STATUS.READY_FOR_REVIEW,
  decisionRef: 'dossier-v1',
  decision: 'DEFER',
  outcomeSnapshot: { observedAt: '2027-01-01T00:00:00Z', evidenceRef: 'outcome-evidence-1', upstreamEvidenceChanged: false },
  comparisons: [
    { id: 'noi', label: 'NOI', plannedValue: 100, actualValue: 85, materialVariance: true, evidenceRef: 'outcome-evidence-1', explanation: 'Caller classified variance as material.' },
    { id: 'occupancy', label: 'Occupancy', plannedValue: 0.9, actualValue: 0.89, materialVariance: false, evidenceRef: 'outcome-evidence-1', explanation: null },
  ],
  materialVarianceCount: 1,
  materialVarianceIds: ['noi'],
  reanalysisRequired: true,
  requiredActions: { refreshEvidenceReconciliation: false, refreshFinancialAnalysis: true, refreshDecisionQuality: true, refreshAiDossier: true, humanReviewRequired: true },
  automatedDecisionReversal: false,
  humanReviewRequired: true,
  transactionAuthorized: false,
};

(function buildsLearningReviewWithoutAutomaticMutation() {
  const result = buildDecisionLearningReview({ caseId: 'case-learning-1', projectId: 'project-learning-1', outcomeFeedback: baseFeedback });
  assert.strictEqual(result.status, LEARNING_STATUS.READY_FOR_LEARNING_REVIEW);
  assert.strictEqual(result.learningCandidateCount, 2);
  assert.strictEqual(result.materialLearningCandidateCount, 1);
  assert.strictEqual(result.reanalysisRequired, true);
  assert.strictEqual(result.mayUpdatePolicyAutomatically, false);
  assert.strictEqual(result.mayUpdateModelAutomatically, false);
  assert.strictEqual(result.mayRewritePriorDecision, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function feedbackHoldFailsClosed() {
  const result = buildDecisionLearningReview({
    caseId: 'case-learning-1',
    projectId: 'project-learning-1',
    outcomeFeedback: { ...baseFeedback, status: OUTCOME_FEEDBACK_STATUS.HOLD_OUTCOME_EVIDENCE },
  });
  assert.strictEqual(result.status, LEARNING_STATUS.HOLD_OUTCOME_FEEDBACK);
  assert.strictEqual(result.learningCandidateCount, 0);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function scopeMismatchFailsClosed() {
  assert.throws(() => buildDecisionLearningReview({ caseId: 'other-case', projectId: 'project-learning-1', outcomeFeedback: baseFeedback }), /LEARNING_SCOPE_MISMATCH/);
})();

(function productionUiIsConditionalAndBounded() {
  const main = fs.readFileSync('src/main.jsx', 'utf8');
  const panel = fs.readFileSync('src/components/OutcomeMonitoringPanel.jsx', 'utf8');
  for (const token of ['__STARTAK_OUTCOME_FEEDBACK__', '__STARTAK_DECISION_LEARNING_REVIEW__', '__STARTAK_HUMAN_COMMITTEE_DECISION_RECORD__', 'OutcomeMonitoringPanel']) {
    assert.ok(main.includes(token), `missing runtime boundary: ${token}`);
  }
  for (const token of ['متابعة النتائج والتعلّم من القرار', 'المخطط مقابل الفعلي', 'إجراءات إعادة التحليل', 'حلقة التعلّم']) {
    assert.ok(panel.includes(token), `missing UI token: ${token}`);
  }
  assert.ok(!main.includes('case-learning-1'));
  assert.ok(!main.includes('outcome-evidence-1'));
  assert.ok(!panel.includes('transactionAuthorized = true'));
})();

console.log('OUTCOME_MONITORING_LEARNING_UI_V1=PASS');
