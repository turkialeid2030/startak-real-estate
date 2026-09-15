'use strict';

const assert = require('assert');
const { GUIDED_SEQUENCE, evaluateGuidedDecisionFlow } = require('../../src/decision-governance/guided-decision-flow');

assert.strictEqual(GUIDED_SEQUENCE.length, 12);
let flow = evaluateGuidedDecisionFlow({});
assert.strictEqual(flow.nextStep, 'ASSET');
assert.strictEqual(flow.financialResultAllowed, false);
assert.strictEqual(flow.buyRejectDecisionAllowed, false);

flow = evaluateGuidedDecisionFlow({ asset: 'building', price: 100, income: 10, expenses: 2, assumptions: { discountRate: 0.1 }, financingNotApplicable: true });
assert.strictEqual(flow.basicInputsComplete, true);
assert.strictEqual(flow.financialResultAllowed, true);
assert.strictEqual(flow.nextStep, 'VALUATION');
assert.strictEqual(flow.buyRejectDecisionAllowed, false);

flow = evaluateGuidedDecisionFlow({
  asset: 'building', price: 100, income: 10, expenses: 2, assumptions: { discountRate: 0.1 }, financingNotApplicable: true,
  valuation: 'READY', evidence: 'SUFFICIENT_FOR_IC', risksReviewed: true, financialResult: 'PASS', dueDiligence: 'PASS',
});
assert.strictEqual(flow.nextStep, 'OVERALL_DECISION');
assert.strictEqual(flow.buyRejectDecisionAllowed, false);

flow = evaluateGuidedDecisionFlow({
  asset: 'building', price: 100, income: 10, expenses: 2, assumptions: { discountRate: 0.1 }, financingNotApplicable: true,
  valuation: 'READY', evidence: 'SUFFICIENT_FOR_IC', risksReviewed: true, financialResult: 'PASS', dueDiligence: 'PASS', overallDecision: 'READY_FOR_IC',
});
assert.strictEqual(flow.nextStep, null);
assert.strictEqual(flow.overallDecisionAllowed, true);
assert.strictEqual(flow.buyRejectDecisionAllowed, true);

console.log('GUIDED_DECISION_FLOW_TESTS=PASS');
