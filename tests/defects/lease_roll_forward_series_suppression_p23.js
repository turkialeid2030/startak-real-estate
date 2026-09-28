'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));

function calculate(leaseYears) {
  return calculateInvestmentCase({
    studyType: STUDY_TYPE.EXISTING_BUILDING,
    inputs: {
      ...fixture.input_set,
      leaseYears,
      holdPeriod: 5,
      exitCapRate: 0.07,
      exitTransferFeeRate: 0.05,
      leverageEnabled: false,
    },
    leverageEnabled: false,
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  });
}

const oneYear = calculate(1);
assert.equal(oneYear.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(oneYear.operatingNoiCashflows.length, 1);
assert.equal(oneYear.paybackNoiCashflows.length, 1);
assert.equal(oneYear.cashflows.length, 2);
assert.deepEqual(oneYear.cashflows.slice(1), oneYear.operatingNoiCashflows);

const equalHorizon = calculate(5);
assert.equal(equalHorizon.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(equalHorizon.operatingNoiCashflows.length, 5);
assert.equal(equalHorizon.paybackNoiCashflows.length, 5);
assert.equal(equalHorizon.cashflows.length, 6);
assert.deepEqual(equalHorizon.cashflows.slice(1), equalHorizon.operatingNoiCashflows);

console.log('P23_UNSUPPORTED_POST_EXPIRY_NOI_SERIES_SUPPRESSED=PASS');
