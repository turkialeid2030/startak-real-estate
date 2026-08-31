'use strict';

const assert = require('assert');
const {
  PROFESSIONAL_TYPE,
  REVIEW_MATRIX_STATUS,
  createProfessionalReviewRule,
  evaluateProfessionalReviewNeeds,
} = require('../../src/decision-quality/professional-review-matrix');

let checks = 0;
function check(fn) { fn(); checks++; }

const rules = [
  createProfessionalReviewRule({
    ruleId: 'R-LEGAL-1',
    signalKey: 'titleRestriction',
    triggerValues: ['WAQF', 'ENCUMBERED'],
    professionalType: PROFESSIONAL_TYPE.LEGAL,
    rationale: 'Restriction or encumbrance requires legal interpretation.',
    sourceRef: 'SYNTHETIC_POLICY_RULE',
  }),
  createProfessionalReviewRule({
    ruleId: 'R-APPRAISER-1',
    signalKey: 'certifiedValueRequested',
    triggerValues: ['true'],
    professionalType: PROFESSIONAL_TYPE.LICENSED_APPRAISER,
    rationale: 'Certified valuation output requires licensed appraiser review.',
  }),
  createProfessionalReviewRule({
    ruleId: 'R-GEO-1',
    signalKey: 'geotechnicalConcern',
    triggerValues: ['MATERIAL'],
    professionalType: PROFESSIONAL_TYPE.GEOTECHNICAL_ENGINEER,
    rationale: 'Material geotechnical concern requires specialist review.',
    requiredSignal: false,
  }),
];

const clear = evaluateProfessionalReviewNeeds({
  caseId: 'CASE-1', projectId: 'PROJ-1',
  signals: { titleRestriction: 'NONE', certifiedValueRequested: false },
  rules,
});
check(() => assert.strictEqual(clear.status, REVIEW_MATRIX_STATUS.CLEAR_ANALYTICAL));
check(() => assert.deepStrictEqual(clear.requiredProfessionalTypes, []));
check(() => assert.strictEqual(clear.canIssueProfessionalOpinion, false));
check(() => assert.strictEqual(clear.transactionAuthorized, false));

const legal = evaluateProfessionalReviewNeeds({
  caseId: 'CASE-2', projectId: 'PROJ-2',
  signals: { titleRestriction: 'WAQF', certifiedValueRequested: false },
  rules,
});
check(() => assert.strictEqual(legal.status, REVIEW_MATRIX_STATUS.REVIEW_REQUIRED));
check(() => assert.ok(legal.requiredProfessionalTypes.includes(PROFESSIONAL_TYPE.LEGAL)));
check(() => assert.strictEqual(legal.triggeredReviews[0].ruleId, 'R-LEGAL-1'));

const multi = evaluateProfessionalReviewNeeds({
  caseId: 'CASE-3', projectId: 'PROJ-3',
  signals: { titleRestriction: 'ENCUMBERED', certifiedValueRequested: true, geotechnicalConcern: 'MATERIAL' },
  rules,
});
check(() => assert.strictEqual(multi.status, REVIEW_MATRIX_STATUS.REVIEW_REQUIRED));
check(() => assert.strictEqual(multi.requiredProfessionalTypes.length, 3));

const missing = evaluateProfessionalReviewNeeds({
  caseId: 'CASE-4', projectId: 'PROJ-4',
  signals: { titleRestriction: 'NONE' },
  rules,
});
check(() => assert.strictEqual(missing.status, REVIEW_MATRIX_STATUS.HOLD_EVIDENCE));
check(() => assert.ok(missing.missingSignals.includes('certifiedValueRequested')));

check(() => assert.throws(() => createProfessionalReviewRule({
  ruleId: 'X', signalKey: 'x', triggerValues: ['1'], professionalType: 'NOT_REAL', rationale: 'x',
}), /Unsupported professionalType/));

console.log(`PROFESSIONAL_REVIEW_MATRIX_V1: PASS (${checks} checks)`);
