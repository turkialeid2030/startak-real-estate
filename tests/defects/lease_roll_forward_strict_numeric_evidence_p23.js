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

const numeric = calculate(6);
assert.equal(numeric.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD_AND_FORWARD_NOI);
assert.notEqual(numeric.decisionStatus, 'INCOMPLETE_INPUTS');

for (const weakValue of ['6', '', true, null, undefined]) {
  const result = calculate(weakValue);
  assert.equal(result.leaseRollForwardStatus, LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED);
  assert.equal(result.decisionStatus, 'INCOMPLETE_INPUTS');
  assert.equal(result.npv, null);
  assert.equal(result.irr, null);
  assert.equal(result.terminalSaleValue, null);
  assert.equal(result.terminalNetSaleProceeds, null);
}

console.log('P23_STRICT_NUMERIC_LEASE_EVIDENCE=PASS');
