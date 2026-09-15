'use strict';

const assert = require('assert');
const { DEMO_BUILDING_INPUTS, DEMO_LAND_INPUTS } = require('../../src/decision-governance/deal-datasets');
const { NEW_DEAL_STATUS, createNewDealInputs, evaluateNewDealReadiness } = require('../../src/decision-governance/new-deal-workspace');

for (const mode of ['building', 'land']) {
  const inputs = createNewDealInputs(mode);
  const readiness = evaluateNewDealReadiness(mode, inputs);
  assert.strictEqual(inputs.projectTitle, '');
  assert.strictEqual(readiness.status, NEW_DEAL_STATUS.INCOMPLETE);
  assert.strictEqual(readiness.calculationAllowed, false);
  assert.strictEqual(readiness.provenance.kind, 'NEW');
  assert.ok(readiness.missingFields.length > 0);
}

const newBuilding = createNewDealInputs('building');
assert.strictEqual(Object.prototype.hasOwnProperty.call(newBuilding, 'buildingPrice'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(newBuilding, 'commissionRate'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(newBuilding, 'transferFeeRate'), false);
assert.notDeepStrictEqual(newBuilding, DEMO_BUILDING_INPUTS);

const newLand = createNewDealInputs('land');
assert.strictEqual(Object.prototype.hasOwnProperty.call(newLand, 'landPricePerSqm'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(newLand, 'landCommissionRate'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(newLand, 'landTransferFeeRate'), false);
assert.notDeepStrictEqual(newLand, DEMO_LAND_INPUTS);

const readyBuilding = evaluateNewDealReadiness('building', {
  buildingPrice: 1,
  rentPerSqm: 1,
  occupancyRate: 0.9,
  marketCapRate: 0.07,
  discountRate: 0.08,
  holdPeriod: 5,
});
assert.strictEqual(readyBuilding.status, NEW_DEAL_STATUS.READY_FOR_FINANCIAL_ANALYSIS);
assert.strictEqual(readyBuilding.calculationAllowed, true);
assert.deepStrictEqual([...readyBuilding.missingFields], []);

console.log('NEW_DEAL_WORKSPACE_TESTS=PASS');
