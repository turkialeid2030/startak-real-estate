'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { ASSUMPTION_MODEL_VERSION } = require('../../src/assumptions/assumption-model');
const { LEASE_ROLL_FORWARD_STATUS } = require('../../src/engines/valuation/existing-building-lease-roll-forward-governance');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));

const result = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: {
    ...fixture.input_set,
    leaseYears: 1,
    holdPeriod: 5,
    exitCapRate: 0.07,
    exitTransferFeeRate: 0.05,
    leverageEnabled: true,
    ltv: 0,
  },
  leverageEnabled: true,
  assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
});

assert.equal(result.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED);
assert.equal(result.decisionStatus, 'INCOMPLETE_INPUTS');
assert.equal(result.loanAmount, 0);
assert.equal(result.debtService, 0);
assert.equal(result.dscrMin, null);
assert.equal(result.leveredCashflows, null);
assert.equal(result.leveredIRR, null);
assert.equal(result.leveredNPV, null);
assert.equal(result.financingEngineVersion, undefined);

console.log('P23_ZERO_DEBT_INCOMPLETE_LEASE_REMAINS_FAIL_CLOSED=PASS');
