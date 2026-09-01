'use strict';

const assert = require('assert');
const {
  PRIORITY_LEVEL,
  IMPACT_LEVEL,
  EFFORT_LEVEL,
  URGENCY_LEVEL,
  buildNextBestDueDiligence,
} = require('../../src/decision-quality/next-best-due-diligence');

(function testDecisionBlockingRanksFirst() {
  const out = buildNextBestDueDiligence({
    caseId: 'CASE-SYNTH-001',
    projectId: 'PROJECT-SYNTH-001',
    candidates: [
      {
        id: 'DD-RENT',
        question: 'Verify rent evidence',
        impact: IMPACT_LEVEL.MATERIAL,
        effort: EFFORT_LEVEL.LOW,
        urgency: URGENCY_LEVEL.IMMEDIATE,
      },
      {
        id: 'DD-TITLE',
        question: 'Resolve title restriction conflict',
        impact: IMPACT_LEVEL.DECISION_BLOCKING,
        effort: EFFORT_LEVEL.HIGH,
        urgency: URGENCY_LEVEL.NEAR_TERM,
        professionalReviewType: 'LEGAL',
        blockingGate: 'TITLE',
      },
    ],
  });
  assert.strictEqual(out.nextBestAction.id, 'DD-TITLE');
  assert.strictEqual(out.nextBestAction.priority, PRIORITY_LEVEL.CRITICAL);
  assert.strictEqual(out.numericValueOfInformation, null);
  assert.strictEqual(out.expectedMonetaryValue, null);
  assert.strictEqual(out.transactionAuthorized, false);
})();

(function testEffortBreaksEqualImpactAndUrgency() {
  const out = buildNextBestDueDiligence({
    caseId: 'CASE-SYNTH-002',
    projectId: 'PROJECT-SYNTH-002',
    candidates: [
      {
        id: 'DD-HIGH-EFFORT',
        question: 'High effort item',
        impact: IMPACT_LEVEL.MATERIAL,
        effort: EFFORT_LEVEL.HIGH,
        urgency: URGENCY_LEVEL.NEAR_TERM,
      },
      {
        id: 'DD-LOW-EFFORT',
        question: 'Low effort item',
        impact: IMPACT_LEVEL.MATERIAL,
        effort: EFFORT_LEVEL.LOW,
        urgency: URGENCY_LEVEL.NEAR_TERM,
      },
    ],
  });
  assert.strictEqual(out.rankedActions[0].id, 'DD-LOW-EFFORT');
  assert.strictEqual(out.rankedActions[0].priority, PRIORITY_LEVEL.HIGH);
})();

(function testCallerSuppliedRefsPreserved() {
  const out = buildNextBestDueDiligence({
    caseId: 'CASE-SYNTH-003',
    projectId: 'PROJECT-SYNTH-003',
    candidates: [{
      id: 'DD-REG',
      question: 'Confirm effective regulatory reference',
      impact: IMPACT_LEVEL.MODERATE,
      effort: EFFORT_LEVEL.MODERATE,
      urgency: URGENCY_LEVEL.NORMAL,
      evidenceRefs: ['EVID-SYNTH-1'],
      rationale: 'Synthetic fixture',
    }],
  });
  assert.deepStrictEqual(out.nextBestAction.evidenceRefs, ['EVID-SYNTH-1']);
  assert.strictEqual(out.nextBestAction.priority, PRIORITY_LEVEL.MODERATE);
})();

(function testFailClosedValidation() {
  assert.throws(() => buildNextBestDueDiligence({ caseId: 'C', projectId: 'P', candidates: [] }), /non-empty array/);
  assert.throws(() => buildNextBestDueDiligence({
    caseId: 'C',
    projectId: 'P',
    candidates: [
      { id: 'DUP', question: 'a', impact: IMPACT_LEVEL.LIMITED, effort: EFFORT_LEVEL.LOW, urgency: URGENCY_LEVEL.NORMAL },
      { id: 'DUP', question: 'b', impact: IMPACT_LEVEL.LIMITED, effort: EFFORT_LEVEL.LOW, urgency: URGENCY_LEVEL.NORMAL },
    ],
  }), /DUPLICATE_DUE_DILIGENCE_ID/);
})();

console.log('NEXT_BEST_DUE_DILIGENCE_V1=PASS');
