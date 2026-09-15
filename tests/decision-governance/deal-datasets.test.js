'use strict';
const assert = require('assert');
const {
  DEMO_BUILDING_INPUTS,
  DEMO_LAND_INPUTS,
  LEGACY_BUILDING_HYDRATION_DEFAULTS,
  LEGACY_LAND_HYDRATION_DEFAULTS,
} = require('../../src/decision-governance/deal-datasets');

assert(Object.isFrozen(DEMO_BUILDING_INPUTS));
assert(Object.isFrozen(DEMO_LAND_INPUTS));
assert.strictEqual(DEMO_BUILDING_INPUTS.buildingPrice, 140000000);
assert.strictEqual(DEMO_BUILDING_INPUTS.commissionRate, 0.025);
assert.strictEqual(DEMO_BUILDING_INPUTS.transferFeeRate, 0.05);
assert.strictEqual(DEMO_LAND_INPUTS.landPricePerSqm, 20000);
assert.strictEqual(DEMO_LAND_INPUTS.landCommissionRate, 0.025);
assert.strictEqual(DEMO_LAND_INPUTS.landTransferFeeRate, 0.05);

// Migration contract: old saved deals still hydrate against the exact historical
// fallback dataset; this alias must not be repurposed as a New Deal initializer.
assert.strictEqual(LEGACY_BUILDING_HYDRATION_DEFAULTS, DEMO_BUILDING_INPUTS);
assert.strictEqual(LEGACY_LAND_HYDRATION_DEFAULTS, DEMO_LAND_INPUTS);

console.log('DEAL_DATASETS_TESTS=PASS');
