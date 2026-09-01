'use strict';

const assert = require('assert');
const { IC_CASE_STATUS } = require('../../src/investment-committee');
const { DECISION_RECORD_STATUS, buildHumanCommitteeDecisionRecord } = require('../../src/investment-committee/human-decision-record');
const { OUTCOME_FEEDBACK_STATUS, buildOutcomeFeedback } = require('../../src/decision-quality/outcome-feedback');

function committeeDecision(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: 'case-1',
    projectId: 'project-1',
    status: IC_CASE_STATUS.DECIDED_BY_HUMANS,
    decision: 'DEFER',
    conditions: [],
    rationale: 'Human committee rationale',
    decidedAt: '2026-09-01T10:00:00Z',
    recordedBy: 'secretary-1',
    governance: { quorumMet: true, declarationGaps: [], eligiblePresent: ['m1', 'm2', 'm3'] },
    voteSummary: { forCount: 2, againstCount: 1, abstainCount: 0, approvalThresholdMet: true },
    humanDecision: true,
    automatedDecision: false,
    transactionAuthorized: false,
    ...overrides,
  };
}

(function recordsHumanDecision() {
  const result = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1', committeeDecision: committeeDecision(),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  assert.strictEqual(result.status, DECISION_RECORD_STATUS.RECORDED);
  assert.strictEqual(result.humanDecisionConfirmed, true);
  assert.strictEqual(result.automatedDecision, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function rejectsNonHumanDecision() {
  const result = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1',
    committeeDecision: committeeDecision({ status: 'READY_FOR_COMMITTEE', humanDecision: false }),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  assert.strictEqual(result.status, DECISION_RECORD_STATUS.HOLD_COMMITTEE_STATUS);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function governanceFailsClosed() {
  const result = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1',
    committeeDecision: committeeDecision({ governance: { quorumMet: false, declarationGaps: [] } }),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  assert.strictEqual(result.status, DECISION_RECORD_STATUS.HOLD_GOVERNANCE);
})();

(function outcomeVarianceTriggersReanalysis() {
  const decisionRecord = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1', committeeDecision: committeeDecision(),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  const result = buildOutcomeFeedback({
    caseId: 'case-1', projectId: 'project-1', decisionRecord,
    outcomeSnapshot: { caseId: 'case-1', projectId: 'project-1', verified: true, evidenceRef: 'outcome-source-1', observedAt: '2027-09-01T00:00:00Z', upstreamEvidenceChanged: false },
    comparisonItems: [{ id: 'noi', label: 'NOI', plannedValue: 10, actualValue: 8, materialVariance: true, evidenceRef: 'outcome-source-1' }],
  });
  assert.strictEqual(result.status, OUTCOME_FEEDBACK_STATUS.READY_FOR_REVIEW);
  assert.strictEqual(result.reanalysisRequired, true);
  assert.strictEqual(result.requiredActions.refreshFinancialAnalysis, true);
  assert.strictEqual(result.automatedDecisionReversal, false);
  assert.strictEqual(result.transactionAuthorized, false);
})();

(function unchangedOutcomeDoesNotForceReanalysis() {
  const decisionRecord = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1', committeeDecision: committeeDecision(),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  const result = buildOutcomeFeedback({
    caseId: 'case-1', projectId: 'project-1', decisionRecord,
    outcomeSnapshot: { caseId: 'case-1', projectId: 'project-1', verified: true, evidenceRef: 'outcome-source-1', observedAt: '2027-09-01T00:00:00Z', upstreamEvidenceChanged: false },
    comparisonItems: [{ id: 'occ', label: 'Occupancy', plannedValue: 90, actualValue: 90, materialVariance: false, evidenceRef: 'outcome-source-1' }],
  });
  assert.strictEqual(result.reanalysisRequired, false);
  assert.strictEqual(result.humanReviewRequired, true);
})();

(function outcomeEvidenceFailsClosed() {
  const decisionRecord = buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1', committeeDecision: committeeDecision(),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  });
  const result = buildOutcomeFeedback({
    caseId: 'case-1', projectId: 'project-1', decisionRecord,
    outcomeSnapshot: { caseId: 'case-1', projectId: 'project-1', verified: false, evidenceRef: null },
    comparisonItems: [],
  });
  assert.strictEqual(result.status, OUTCOME_FEEDBACK_STATUS.HOLD_OUTCOME_EVIDENCE);
})();

(function scopeMismatchRejected() {
  assert.throws(() => buildHumanCommitteeDecisionRecord({
    caseId: 'case-1', projectId: 'project-1', committeeDecision: committeeDecision({ projectId: 'other' }),
    dossierRef: 'dossier-v1', recordedBy: 'recorder-1', recordedAt: '2026-09-01T11:00:00Z',
  }), /COMMITTEE_DECISION_SCOPE_MISMATCH/);
})();

console.log('HUMAN_COMMITTEE_DECISION_OUTCOME_FEEDBACK_V1=PASS');
