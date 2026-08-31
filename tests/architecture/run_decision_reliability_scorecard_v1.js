'use strict';

const assert = require('assert');
const {
  RELIABILITY_LEVEL,
  RELIABILITY_DIMENSION,
  createDecisionReliabilityScorecard,
} = require('../../src/decision-quality/reliability-scorecard');

let checks = 0;
function check(fn) { fn(); checks++; }

const high = createDecisionReliabilityScorecard({
  caseId: 'CASE-R1', projectId: 'PROJ-R1',
  dimensions: [
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level: RELIABILITY_LEVEL.HIGH },
    { dimension: RELIABILITY_DIMENSION.MODEL_APPLICABILITY, level: RELIABILITY_LEVEL.HIGH },
    { dimension: RELIABILITY_DIMENSION.REGULATORY_READINESS, level: RELIABILITY_LEVEL.HIGH },
  ],
});
check(() => assert.strictEqual(high.overallReliability, RELIABILITY_LEVEL.HIGH));
check(() => assert.strictEqual(high.numericConfidenceScore, null));
check(() => assert.strictEqual(high.transactionAuthorized, false));

const mixed = createDecisionReliabilityScorecard({
  caseId: 'CASE-R2', projectId: 'PROJ-R2',
  dimensions: [
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level: RELIABILITY_LEVEL.HIGH },
    { dimension: RELIABILITY_DIMENSION.ASSUMPTION_BURDEN, level: RELIABILITY_LEVEL.MODERATE, rationale: 'Several material assumptions remain.' },
    { dimension: RELIABILITY_DIMENSION.TITLE_READINESS, level: RELIABILITY_LEVEL.LOW, evidenceRefs: ['E-TITLE-1'] },
  ],
});
check(() => assert.strictEqual(mixed.overallReliability, RELIABILITY_LEVEL.LOW));
check(() => assert.strictEqual(mixed.limitingDimensions.length, 1));
check(() => assert.strictEqual(mixed.limitingDimensions[0].dimension, RELIABILITY_DIMENSION.TITLE_READINESS));
check(() => assert.strictEqual(mixed.lowOrInsufficientDimensions.length, 1));
check(() => assert.strictEqual(mixed.moderateDimensions.length, 1));

const insufficient = createDecisionReliabilityScorecard({
  caseId: 'CASE-R3', projectId: 'PROJ-R3',
  dimensions: [
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_AUTHORITY, level: RELIABILITY_LEVEL.INSUFFICIENT },
    { dimension: RELIABILITY_DIMENSION.PROFESSIONAL_REVIEW, level: RELIABILITY_LEVEL.LOW },
  ],
});
check(() => assert.strictEqual(insufficient.overallReliability, RELIABILITY_LEVEL.INSUFFICIENT));
check(() => assert.ok(insufficient.semantics.includes('No synthetic percentage confidence')));

check(() => assert.throws(() => createDecisionReliabilityScorecard({
  caseId: 'CASE-R4', projectId: 'PROJ-R4',
  dimensions: [
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level: RELIABILITY_LEVEL.HIGH },
    { dimension: RELIABILITY_DIMENSION.EVIDENCE_COMPLETENESS, level: RELIABILITY_LEVEL.LOW },
  ],
}), /DUPLICATE_RELIABILITY_DIMENSION/));

check(() => assert.throws(() => createDecisionReliabilityScorecard({
  caseId: 'CASE-R5', projectId: 'PROJ-R5', dimensions: [],
}), /dimensions must be a non-empty array/));

console.log(`DECISION_RELIABILITY_SCORECARD_V1: PASS (${checks} checks)`);
