'use strict';

const assert = require('assert');
const {
  CHANGE_KIND,
  AI_OPINION_STATUS,
  buildDecisionFeedback,
} = require('../../src/decision-quality/feedback-loop');

function baseSnapshot(overrides = {}) {
  return {
    caseId: 'CASE-SYNTH-001',
    projectId: 'PROJECT-SYNTH-001',
    versionId: 'v1',
    evidenceHash: 'evidence-a',
    inputHash: 'input-a',
    regulatoryRuleHash: 'rules-a',
    calculationHash: 'calc-a',
    decisionControlStatus: 'READY_FOR_ANALYTICAL_UNDERWRITING',
    reliabilityLevel: 'MODERATE',
    professionalReviewStatus: 'CLEAR',
    aiOpinionVersionId: 'ai-v1',
    ...overrides,
  };
}

(function testNoMaterialChangeAllowsOpinionReuse() {
  const previous = baseSnapshot();
  const current = baseSnapshot({ versionId: 'v2' });
  const out = buildDecisionFeedback({ previous, current });
  assert.deepStrictEqual(out.changes, []);
  assert.strictEqual(out.materialUpstreamChange, false);
  assert.strictEqual(out.reanalysis.refreshAIDossier, false);
  assert.strictEqual(out.aiOpinion.status, AI_OPINION_STATUS.CURRENT);
  assert.strictEqual(out.aiOpinion.mayReusePriorOpinion, true);
  assert.strictEqual(out.transactionAuthorized, false);
})();

(function testEvidenceChangeInvalidatesSilentReuse() {
  const previous = baseSnapshot();
  const current = baseSnapshot({ versionId: 'v2', evidenceHash: 'evidence-b' });
  const out = buildDecisionFeedback({ previous, current });
  assert.ok(out.changes.includes(CHANGE_KIND.EVIDENCE_CHANGED));
  assert.strictEqual(out.reanalysis.reRunEvidenceReconciliation, true);
  assert.strictEqual(out.reanalysis.reRunRegulatoryAssessment, true);
  assert.strictEqual(out.reanalysis.reRunDecisionControl, true);
  assert.strictEqual(out.reanalysis.refreshReliabilityScorecard, true);
  assert.strictEqual(out.reanalysis.refreshAIDossier, true);
  assert.strictEqual(out.reanalysis.humanReviewRequired, true);
  assert.strictEqual(out.aiOpinion.status, AI_OPINION_STATUS.STALE_REANALYSIS_REQUIRED);
  assert.strictEqual(out.aiOpinion.mayReusePriorOpinion, false);
  assert.strictEqual(out.aiOpinion.requiresFreshOpinion, true);
})();

(function testNewOpinionAfterMaterialChangeCanBeCurrent() {
  const previous = baseSnapshot();
  const current = baseSnapshot({
    versionId: 'v2',
    regulatoryRuleHash: 'rules-b',
    aiOpinionVersionId: 'ai-v2',
  });
  const out = buildDecisionFeedback({ previous, current });
  assert.ok(out.changes.includes(CHANGE_KIND.RULES_CHANGED));
  assert.strictEqual(out.reanalysis.reRunRegulatoryAssessment, true);
  assert.strictEqual(out.aiOpinion.status, AI_OPINION_STATUS.CURRENT);
})();

(function testInputChangeRequiresFinancialRecalculation() {
  const previous = baseSnapshot();
  const current = baseSnapshot({ versionId: 'v2', inputHash: 'input-b', calculationHash: 'calc-b' });
  const out = buildDecisionFeedback({ previous, current });
  assert.ok(out.changes.includes(CHANGE_KIND.INPUTS_CHANGED));
  assert.ok(out.changes.includes(CHANGE_KIND.CALCULATION_CHANGED));
  assert.strictEqual(out.reanalysis.reRunFinancialCalculation, true);
})();

(function testMissingCurrentOpinionIsExplicit() {
  const previous = baseSnapshot();
  const current = baseSnapshot({ versionId: 'v2', evidenceHash: 'evidence-b', aiOpinionVersionId: null });
  const out = buildDecisionFeedback({ previous, current });
  assert.strictEqual(out.aiOpinion.status, AI_OPINION_STATUS.NOT_PROVIDED);
  assert.strictEqual(out.aiOpinion.requiresFreshOpinion, true);
})();

(function testScopeIsolationAndVersionAdvanceFailClosed() {
  assert.throws(
    () => buildDecisionFeedback({ previous: baseSnapshot(), current: baseSnapshot({ versionId: 'v2', caseId: 'CASE-OTHER' }) }),
    /CASE_SCOPE_MISMATCH/
  );
  assert.throws(
    () => buildDecisionFeedback({ previous: baseSnapshot(), current: baseSnapshot({ versionId: 'v2', projectId: 'PROJECT-OTHER' }) }),
    /PROJECT_SCOPE_MISMATCH/
  );
  assert.throws(
    () => buildDecisionFeedback({ previous: baseSnapshot(), current: baseSnapshot() }),
    /VERSION_ID_MUST_ADVANCE/
  );
})();

console.log('DECISION_FEEDBACK_LOOP_V1=PASS');
