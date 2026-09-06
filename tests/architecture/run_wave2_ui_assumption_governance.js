'use strict';

const assert = require('assert');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { EXIT_CAP_SOURCE } = require('../../src/engines/valuation/exit-cap-resolver');
const {
  formatOptionalPercentInput,
  parseOptionalPercentInput,
  applyOptionalPercentToInputs,
  buildUiAssumptionGovernance,
} = require('../../src/assumptions/ui-assumption-governance');

function expectCode(fn, code) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught, `expected ${code}`);
  assert.strictEqual(caught.code, code);
}

function run() {
  assert.strictEqual(formatOptionalPercentInput(undefined), '');
  assert.strictEqual(formatOptionalPercentInput(null), '');
  assert.strictEqual(formatOptionalPercentInput(0.075), '7.5');
  expectCode(() => formatOptionalPercentInput(NaN), 'OPTIONAL_PERCENT_NON_FINITE');

  const blank = parseOptionalPercentInput('   ');
  assert.deepStrictEqual(blank, { present: false, value: undefined });
  const explicit = parseOptionalPercentInput('7.5');
  assert.deepStrictEqual(explicit, { present: true, value: 0.075 });
  expectCode(() => parseOptionalPercentInput('not-a-rate'), 'OPTIONAL_PERCENT_INVALID');
  expectCode(() => parseOptionalPercentInput('150'), 'OPTIONAL_PERCENT_OUT_OF_RANGE');

  const sourceInputs = { marketCapRate: 0.07, exitCapRate: 0.08 };
  const cleared = applyOptionalPercentToInputs(sourceInputs, 'exitCapRate', blank);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(cleared, 'exitCapRate'), false);
  assert.strictEqual(sourceInputs.exitCapRate, 0.08);
  const restored = applyOptionalPercentToInputs(cleared, 'exitCapRate', explicit);
  assert.strictEqual(restored.exitCapRate, 0.075);

  const incomplete = buildUiAssumptionGovernance({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    financialResults: {
      financialModelStatus: 'INCOMPLETE_INPUTS',
      exitCapSource: EXIT_CAP_SOURCE.MISSING_REQUIRED,
    },
  });
  assert.strictEqual(incomplete.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(incomplete.exitCapInputRequired, true);
  assert.strictEqual(incomplete.sensitivityReady, false);
  assert.strictEqual(incomplete.sensitivity.status, 'HOLD_INCOMPLETE_INPUTS');
  assert.strictEqual(incomplete.disclosure.requiresExplicitExitCap, true);
  assert.strictEqual(incomplete.transactionAuthorized, false);

  const completeV2 = buildUiAssumptionGovernance({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    financialResults: {
      financialModelStatus: 'VALID',
      exitCapSource: EXIT_CAP_SOURCE.EXPLICIT,
    },
  });
  assert.strictEqual(completeV2.exitCapInputRequired, false);
  assert.strictEqual(completeV2.sensitivityReady, true);
  assert.strictEqual(completeV2.transactionAuthorized, false);

  const legacy = buildUiAssumptionGovernance({
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.LEGACY,
    financialResults: {
      financialModelStatus: 'VALID',
      exitCapSource: EXIT_CAP_SOURCE.LEGACY_DERIVED,
    },
  });
  assert.strictEqual(legacy.disclosure.legacyCompatibility, true);
  assert.strictEqual(legacy.exitCapInputRequired, false);
  assert.strictEqual(legacy.sensitivityReady, true);

  console.log('WAVE2_UI_OPTIONAL_EXIT_CAP_BLANK_PRESERVED=PASS');
  console.log('WAVE2_UI_OPTIONAL_EXIT_CAP_STRICT_PARSE=PASS');
  console.log('WAVE2_UI_INCOMPLETE_DISCLOSURE=PASS');
  console.log('WAVE2_UI_SENSITIVITY_FAIL_CLOSED=PASS');
  console.log('WAVE2_UI_ASSUMPTION_GOVERNANCE_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
