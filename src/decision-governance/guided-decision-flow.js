'use strict';

const GUIDED_STEP = Object.freeze({
  ASSET: 'ASSET', PRICE: 'PRICE', INCOME: 'INCOME', EXPENSES: 'EXPENSES', ASSUMPTIONS: 'ASSUMPTIONS',
  FINANCING: 'FINANCING', VALUATION: 'VALUATION', EVIDENCE: 'EVIDENCE', RISKS: 'RISKS',
  FINANCIAL_RESULT: 'FINANCIAL_RESULT', DUE_DILIGENCE: 'DUE_DILIGENCE', OVERALL_DECISION: 'OVERALL_DECISION',
});
const GUIDED_SEQUENCE = Object.freeze(Object.values(GUIDED_STEP));

function complete(value) {
  if (value === true) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object');
}

function evaluateGuidedDecisionFlow(input = {}) {
  const readiness = {
    [GUIDED_STEP.ASSET]: complete(input.asset),
    [GUIDED_STEP.PRICE]: complete(input.price),
    [GUIDED_STEP.INCOME]: complete(input.income),
    [GUIDED_STEP.EXPENSES]: complete(input.expenses),
    [GUIDED_STEP.ASSUMPTIONS]: complete(input.assumptions),
    [GUIDED_STEP.FINANCING]: input.financingNotApplicable === true || complete(input.financing),
    [GUIDED_STEP.VALUATION]: complete(input.valuation),
    [GUIDED_STEP.EVIDENCE]: complete(input.evidence),
    [GUIDED_STEP.RISKS]: input.risksReviewed === true,
    [GUIDED_STEP.FINANCIAL_RESULT]: complete(input.financialResult),
    [GUIDED_STEP.DUE_DILIGENCE]: complete(input.dueDiligence),
    [GUIDED_STEP.OVERALL_DECISION]: complete(input.overallDecision),
  };
  const firstIncompleteIndex = GUIDED_SEQUENCE.findIndex((step) => !readiness[step]);
  const nextStep = firstIncompleteIndex === -1 ? null : GUIDED_SEQUENCE[firstIncompleteIndex];
  const basicInputsComplete = GUIDED_SEQUENCE.slice(0, 6).every((step) => readiness[step]);
  const financialResultAllowed = GUIDED_SEQUENCE.slice(0, 6).every((step) => readiness[step]);
  const overallDecisionAllowed = GUIDED_SEQUENCE.slice(0, 11).every((step) => readiness[step]);
  return Object.freeze({
    sequence: GUIDED_SEQUENCE,
    readiness: Object.freeze(readiness),
    nextStep,
    basicInputsComplete,
    financialResultAllowed,
    overallDecisionAllowed,
    buyRejectDecisionAllowed: overallDecisionAllowed,
  });
}

module.exports = { GUIDED_STEP, GUIDED_SEQUENCE, evaluateGuidedDecisionFlow };
