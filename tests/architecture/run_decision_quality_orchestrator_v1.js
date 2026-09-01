'use strict';

const assert = require('assert');
const { ORCHESTRATION_STATUS, buildDecisionQualityOrchestration } = require('../../src/decision-quality/orchestrator');
const { RELIABILITY_DIMENSION, RELIABILITY_LEVEL } = require('../../src/decision-quality/reliability-scorecard');
const { IMPACT_LEVEL, EFFORT_LEVEL, URGENCY_LEVEL } = require('../../src/decision-quality/next-best-due-diligence');

function snapshot(overrides = {}) {
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

function reliability(level = RELIABILITY_LEVEL.MODERATE) {
  return [
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level, rationale: 'synthetic' },
    { dimension: RELIABILITY_DIMENSION.MODEL_APPLICABILITY, level: RELIABILITY_LEVEL.MODERATE, rationale: 'synthetic' },
  ];
}

function diligence(overrides = {}) {
  return [{
    id: 'DD-1',
    question: 'Resolve the next synthetic diligence question',
    impact: IMPACT_LEVEL.MATERIAL,
    effort: EFFORT_LEVEL.LOW,
    urgency: URGENCY_LEVEL.NEAR_TERM,
    blockingGate: null,
    professionalReviewType: null,
    ...overrides,
  }];
}

(function testReadyForHumanReviewWhenFreshAndNonCritical() {
  const out = buildDecisionQualityOrchestration({
    previousSnapshot: snapshot(),
    currentSnapshot: snapshot({ versionId: 'v2' }),
    reliabilityDimensions: reliability(),
    dueDiligenceCandidates: diligence(),
  });
  assert.strictEqual(out.status, ORCHESTRATION_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(out.requiredActions.refreshAIDossier, false);
  assert.strictEqual(out.humanDecisionRequired, true);
  assert.strictEqual(out.transactionAuthorized, false);
  assert.strictEqual(out.numericConfidenceScore, null);
  assert.strictEqual(out.aiMayOverrideDeterministicResults, false);
})();

(function testMaterialChangeWithSameAiOpinionFailsClosed() {
  const out = buildDecisionQualityOrchestration({
    previousSnapshot: snapshot(),
    currentSnapshot: snapshot({ versionId: 'v2', evidenceHash: 'evidence-b' }),
    reliabilityDimensions: reliability(),
    dueDiligenceCandidates: diligence(),
  });
  assert.strictEqual(out.status, ORCHESTRATION_STATUS.HOLD_STALE_AI_OPINION);
  assert.strictEqual(out.requiredActions.refreshAIDossier, true);
})();

(function testLowReliabilityHoldsWhenAiIsFresh() {
  const out = buildDecisionQualityOrchestration({
    previousSnapshot: snapshot(),
    currentSnapshot: snapshot({ versionId: 'v2', evidenceHash: 'evidence-b', aiOpinionVersionId: 'ai-v2' }),
    reliabilityDimensions: reliability(RELIABILITY_LEVEL.LOW),
    dueDiligenceCandidates: diligence(),
  });
  assert.strictEqual(out.status, ORCHESTRATION_STATUS.HOLD_RELIABILITY);
})();

(function testCriticalDueDiligenceRequiresResolution() {
  const out = buildDecisionQualityOrchestration({
    previousSnapshot: snapshot(),
    currentSnapshot: snapshot({ versionId: 'v2' }),
    reliabilityDimensions: reliability(),
    dueDiligenceCandidates: diligence({
      impact: IMPACT_LEVEL.DECISION_BLOCKING,
      blockingGate: 'TITLE',
      professionalReviewType: 'LEGAL',
    }),
  });
  assert.strictEqual(out.status, ORCHESTRATION_STATUS.DUE_DILIGENCE_REQUIRED);
  assert.strictEqual(out.requiredActions.blockingGate, 'TITLE');
  assert.strictEqual(out.requiredActions.professionalReviewType, 'LEGAL');
})();

(function testMissingFreshOpinionAfterMaterialChangeFailsClosed() {
  const out = buildDecisionQualityOrchestration({
    previousSnapshot: snapshot(),
    currentSnapshot: snapshot({ versionId: 'v2', regulatoryRuleHash: 'rules-b', aiOpinionVersionId: null }),
    reliabilityDimensions: reliability(),
    dueDiligenceCandidates: diligence(),
  });
  assert.strictEqual(out.status, ORCHESTRATION_STATUS.HOLD_STALE_AI_OPINION);
})();

console.log('DECISION_QUALITY_ORCHESTRATOR_V1=PASS');
