'use strict';

const assert = require('assert/strict');
const {
  UI_MODE,
  applyExitCapInputText,
  calculateUiInvestmentState,
} = require('../../src/assumptions/ui-integration-controller');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const gold = require(require('../config/paths').getGoldBaselinePath());

const baseInputs = {
  ...gold['RE-GOLD-002_existing_building'].inputs,
  exitCapRate: 0.08,
};

// Control: a valid committed exit cap still becomes the current parent input and
// calculates normally.
const valid = applyExitCapInputText({
  inputs: baseInputs,
  rawText: '8',
  min: 0.04,
  max: 0.14,
});
assert.equal(valid.inputValid, true);
assert.equal(valid.errorCode, null);
assert.equal(valid.inputs.exitCapRate, 0.08);
assert.equal(valid.displayValue, '8');
assert.doesNotThrow(() => calculateUiInvestmentState({
  mode: UI_MODE.BUILDING,
  inputs: valid.inputs,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
}));

// F-003 reproduction: after a valid 8%, entering an explicit 0% must no longer
// leave 8% hidden in the parent state. The invalid draft is materialized as 0,
// so the canonical validator fails closed and the App's existing parent-level
// validation disclosure can identify the displayed calculation as stale.
const zero = applyExitCapInputText({
  inputs: baseInputs,
  rawText: '0',
  min: 0.04,
  max: 0.14,
});
assert.equal(zero.inputValid, false);
assert.equal(zero.errorCode, 'OPTIONAL_PERCENT_OUT_OF_RANGE');
assert.equal(zero.inputs.exitCapRate, 0);
assert.notEqual(zero.inputs.exitCapRate, baseInputs.exitCapRate);
assert.throws(
  () => calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: zero.inputs,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  }),
  (error) => error
    && error.name === 'ValidationError'
    && error.field === 'exitCapRate'
    && error.rule === 'STRICTLY_POSITIVE_REQUIRED',
  '0% exit cap must enter canonical parent validation rather than preserve stale 8% economics',
);

// A syntactically invalid numeric draft must also poison the current parent
// draft instead of allowing the previously valid exit cap to remain current.
const malformed = applyExitCapInputText({
  inputs: baseInputs,
  rawText: '1..2',
  min: 0.04,
  max: 0.14,
});
assert.equal(malformed.inputValid, false);
assert.equal(malformed.errorCode, 'OPTIONAL_PERCENT_INVALID');
assert.ok(Number.isNaN(malformed.inputs.exitCapRate));
assert.throws(
  () => calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: malformed.inputs,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  }),
  (error) => error
    && error.name === 'ValidationError'
    && error.field === 'exitCapRate'
    && error.rule === 'FINITE_NUMBER_REQUIRED',
  'malformed exit cap must fail canonical parent validation',
);

// Blank remains the governed optional/missing state and must not be converted to
// an invalid numeric sentinel.
const blank = applyExitCapInputText({
  inputs: baseInputs,
  rawText: '',
  min: 0.04,
  max: 0.14,
});
assert.equal(blank.inputValid, true);
assert.equal(blank.exitCapPresent, false);
assert.equal(Object.prototype.hasOwnProperty.call(blank.inputs, 'exitCapRate'), false);

console.log('INVALID_EXIT_CAP_FAIL_CLOSED_P15=PASS');
