'use strict';

const assert = require('assert');
const gold = require('../reference/RE-GOLD-baseline.json');
const { STUDY_TYPE } = require('../../src/engines');
const {
  THRESHOLD_STATUS,
  OPERATOR,
  solveMaximumJustifiedInput,
  solveDecisionReversalThreshold,
} = require('../../src/decision-thresholds');

let checks = 0;
function check(fn) { fn(); checks += 1; }

const building = gold['RE-GOLD-002_existing_building'].inputs;
const land = gold['RE-GOLD-001_land_development'].inputs;

const missingPolicy = solveMaximumJustifiedInput({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  baseInputs: building,
  inputKey: 'buildingPrice',
  lowerBound: 1,
  upperBound: 300000000,
  constraints: [],
  monotonicity: 'INPUT_INCREASE_WEAKENS_FEASIBILITY',
});
check(() => assert.strictEqual(missingPolicy.status, THRESHOLD_STATUS.HOLD_POLICY));

const buildingSolve = solveMaximumJustifiedInput({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  baseInputs: building,
  inputKey: 'buildingPrice',
  lowerBound: 10000000,
  upperBound: 300000000,
  constraints: [
    { id: 'IC-IRR-TEST', metric: 'irr', operator: OPERATOR.GTE, threshold: 0.12, policyRef: 'SYNTHETIC-TEST-POLICY' },
    { id: 'IC-NPV-TEST', metric: 'npv', operator: OPERATOR.GTE, threshold: 0, policyRef: 'SYNTHETIC-TEST-POLICY' },
  ],
  tolerance: 10,
  monotonicity: 'INPUT_INCREASE_WEAKENS_FEASIBILITY',
});
check(() => assert.strictEqual(buildingSolve.status, THRESHOLD_STATUS.SOLVED));
check(() => assert.ok(buildingSolve.maximumJustifiedInput > building.buildingPrice));
check(() => assert.ok(buildingSolve.constraintEvaluationAtMaximum.passed));
check(() => assert.ok(!buildingSolve.constraintEvaluationAboveMaximum.passed));
check(() => assert.ok(buildingSolve.bindingConstraint && buildingSolve.bindingConstraint.policyRef === 'SYNTHETIC-TEST-POLICY'));
check(() => assert.match(buildingSolve.semantics, /not a certified valuation/i));

const landSolve = solveMaximumJustifiedInput({
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  baseInputs: land,
  inputKey: 'landPricePerSqm',
  lowerBound: 1000,
  upperBound: 70000,
  constraints: [
    { id: 'HURDLE-IRR', metric: 'irr', operator: OPERATOR.GTE, threshold: land.hurdleRate, policyRef: 'RE-GOLD-INPUT-HURDLE' },
  ],
  tolerance: 0.01,
  monotonicity: 'INPUT_INCREASE_WEAKENS_FEASIBILITY',
});
check(() => assert.strictEqual(landSolve.status, THRESHOLD_STATUS.SOLVED));
check(() => assert.ok(landSolve.maximumJustifiedInput > land.landPricePerSqm));
check(() => assert.ok(landSolve.constraintEvaluationAtMaximum.passed));
check(() => assert.ok(!landSolve.constraintEvaluationAboveMaximum.passed));

const reversal = solveDecisionReversalThreshold({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  baseInputs: building,
  inputKey: 'buildingPrice',
  lowerBound: 10000000,
  upperBound: 300000000,
  constraint: { id: 'REVERSAL-IRR', metric: 'irr', operator: OPERATOR.GTE, threshold: 0.12, policyRef: 'SYNTHETIC-TEST-POLICY' },
  tolerance: 10,
  monotonicity: 'INPUT_INCREASE_WEAKENS_FEASIBILITY',
});
check(() => assert.strictEqual(reversal.status, THRESHOLD_STATUS.SOLVED));
check(() => assert.strictEqual(reversal.reversalType, 'EXPLICIT_HURDLE_CROSSING'));
check(() => assert.strictEqual(reversal.reversalConstraint.id, 'REVERSAL-IRR'));

check(() => assert.throws(
  () => solveMaximumJustifiedInput({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    baseInputs: building,
    inputKey: 'buildingPrice',
    lowerBound: 1,
    upperBound: 300000000,
    constraints: [{ id: 'X', metric: 'irr', operator: OPERATOR.GTE, threshold: 0.12 }],
  }),
  /MONOTONICITY_ASSERTION_REQUIRED/,
));

console.log(`DECISION_REVERSAL_MAX_PRICE_V1: PASS (${checks} checks)`);
