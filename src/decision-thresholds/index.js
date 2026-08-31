'use strict';

const { calculateInvestmentCase, STUDY_TYPE } = require('../engines');

const THRESHOLD_STATUS = Object.freeze({
  SOLVED: 'SOLVED',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_BOUNDS: 'HOLD_BOUNDS',
  NO_FEASIBLE_POINT: 'NO_FEASIBLE_POINT',
});

const OPERATOR = Object.freeze({ GTE: 'GTE', LTE: 'LTE' });

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function validateConstraints(constraints) {
  if (!Array.isArray(constraints) || constraints.length === 0) return null;
  return constraints.map((c, i) => {
    if (!c || typeof c !== 'object') throw new TypeError(`constraint[${i}] must be an object`);
    if (!c.id || !c.metric) throw new TypeError(`constraint[${i}] requires id and metric`);
    if (![OPERATOR.GTE, OPERATOR.LTE].includes(c.operator)) throw new TypeError(`constraint[${i}] has invalid operator`);
    return Object.freeze({
      id: String(c.id),
      metric: String(c.metric),
      operator: c.operator,
      threshold: finite(Number(c.threshold), `constraint[${i}].threshold`),
      policyRef: c.policyRef ? String(c.policyRef) : null,
    });
  });
}

function evaluateConstraintSet(result, constraints) {
  const evaluations = constraints.map((c) => {
    const actual = result[c.metric];
    if (!Number.isFinite(actual)) throw new Error(`THRESHOLD_METRIC_UNAVAILABLE: ${c.metric}`);
    const passed = c.operator === OPERATOR.GTE ? actual >= c.threshold : actual <= c.threshold;
    const rawMargin = c.operator === OPERATOR.GTE ? actual - c.threshold : c.threshold - actual;
    const scale = Math.max(Math.abs(c.threshold), 1e-9);
    return Object.freeze({ ...c, actual, passed, normalizedMargin: rawMargin / scale });
  });
  const binding = [...evaluations].sort((a, b) => a.normalizedMargin - b.normalizedMargin)[0] || null;
  return Object.freeze({
    passed: evaluations.every((e) => e.passed),
    evaluations: Object.freeze(evaluations),
    bindingConstraint: binding,
  });
}

function evaluateCase({ studyType, inputs, leverageEnabled, constraints }) {
  const result = calculateInvestmentCase({ studyType, inputs, leverageEnabled });
  const thresholdEvaluation = evaluateConstraintSet(result, constraints);
  return Object.freeze({ result, thresholdEvaluation });
}

/**
 * Solves the maximum feasible value for a price-like input under explicit,
 * caller-supplied policy hurdles. No hurdle rate or policy threshold is
 * invented. The caller must explicitly assert the monotonic relationship.
 */
function solveMaximumJustifiedInput({
  studyType,
  baseInputs,
  inputKey,
  lowerBound,
  upperBound,
  constraints,
  leverageEnabled = false,
  tolerance = 1,
  maxIterations = 80,
  monotonicity,
}) {
  if (![STUDY_TYPE.EXISTING_BUILDING, STUDY_TYPE.LAND_DEVELOPMENT].includes(studyType)) {
    throw new TypeError(`Unsupported studyType: ${studyType}`);
  }
  if (!baseInputs || typeof baseInputs !== 'object') throw new TypeError('baseInputs is required');
  if (!inputKey) throw new TypeError('inputKey is required');
  if (monotonicity !== 'INPUT_INCREASE_WEAKENS_FEASIBILITY') {
    throw new Error('MONOTONICITY_ASSERTION_REQUIRED');
  }

  const policy = validateConstraints(constraints);
  if (!policy) {
    return Object.freeze({ status: THRESHOLD_STATUS.HOLD_POLICY, reason: 'EXPLICIT_DECISION_THRESHOLDS_REQUIRED' });
  }

  let lo = finite(Number(lowerBound), 'lowerBound');
  let hi = finite(Number(upperBound), 'upperBound');
  const tol = finite(Number(tolerance), 'tolerance');
  if (!(hi > lo) || lo < 0 || tol <= 0) throw new RangeError('Invalid solver bounds/tolerance');

  const at = (value) => evaluateCase({
    studyType,
    inputs: { ...baseInputs, [inputKey]: value },
    leverageEnabled,
    constraints: policy,
  });

  const lowEval = at(lo);
  if (!lowEval.thresholdEvaluation.passed) {
    return Object.freeze({
      status: THRESHOLD_STATUS.NO_FEASIBLE_POINT,
      inputKey,
      lowerBound: lo,
      lowerEvaluation: lowEval.thresholdEvaluation,
    });
  }

  const highEval = at(hi);
  if (highEval.thresholdEvaluation.passed) {
    return Object.freeze({
      status: THRESHOLD_STATUS.HOLD_BOUNDS,
      reason: 'UPPER_BOUND_STILL_FEASIBLE',
      inputKey,
      upperBound: hi,
      upperEvaluation: highEval.thresholdEvaluation,
    });
  }

  let iterations = 0;
  while ((hi - lo) > tol && iterations < maxIterations) {
    const mid = (lo + hi) / 2;
    const midEval = at(mid);
    if (midEval.thresholdEvaluation.passed) lo = mid;
    else hi = mid;
    iterations += 1;
  }

  const solved = at(lo);
  const above = at(hi);
  return Object.freeze({
    status: THRESHOLD_STATUS.SOLVED,
    inputKey,
    maximumJustifiedInput: lo,
    firstKnownInfeasibleInput: hi,
    tolerance: tol,
    iterations,
    bindingConstraint: solved.thresholdEvaluation.bindingConstraint,
    constraintEvaluationAtMaximum: solved.thresholdEvaluation,
    constraintEvaluationAboveMaximum: above.thresholdEvaluation,
    semantics: 'Analytical threshold under explicit caller-supplied policy constraints; not a certified valuation, transaction instruction, or investment recommendation.',
  });
}

/**
 * Returns the value at which a single explicit analytical hurdle reverses.
 * This is a bounded decision-reversal explanation, not a forecast.
 */
function solveDecisionReversalThreshold({
  studyType,
  baseInputs,
  inputKey,
  lowerBound,
  upperBound,
  constraint,
  leverageEnabled = false,
  tolerance = 1e-4,
  maxIterations = 80,
  monotonicity,
}) {
  const solved = solveMaximumJustifiedInput({
    studyType,
    baseInputs,
    inputKey,
    lowerBound,
    upperBound,
    constraints: constraint ? [constraint] : [],
    leverageEnabled,
    tolerance,
    maxIterations,
    monotonicity,
  });
  if (solved.status !== THRESHOLD_STATUS.SOLVED) return solved;
  return Object.freeze({
    ...solved,
    reversalType: 'EXPLICIT_HURDLE_CROSSING',
    reversalConstraint: solved.bindingConstraint,
  });
}

module.exports = {
  THRESHOLD_STATUS,
  OPERATOR,
  validateConstraints,
  evaluateConstraintSet,
  solveMaximumJustifiedInput,
  solveDecisionReversalThreshold,
};
