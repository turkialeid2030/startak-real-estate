'use strict';

const assert = require('assert');
const {
  APP_WORKSPACE_KIND,
  createAppNewWorkspace,
  createAppDemoWorkspace,
  legacyHydrationDefaults,
  evaluateAppCalculationReadiness,
} = require('../../src/decision-governance/app-workspace-cutover');

let workspace = createAppNewWorkspace('building');
assert.strictEqual(workspace.kind, APP_WORKSPACE_KIND.NEW);
assert.strictEqual(workspace.inputs.buildingPrice, undefined);
assert.strictEqual(workspace.inputs.commissionRate, undefined);
assert.strictEqual(workspace.inputs.transferFeeRate, undefined);
assert.strictEqual(workspace.readiness.status, 'INCOMPLETE');
assert.strictEqual(workspace.readiness.calculationAllowed, false);
assert.ok(workspace.readiness.missingFields.includes('buildingPrice'));

workspace = createAppNewWorkspace('land');
assert.strictEqual(workspace.inputs.landPricePerSqm, undefined);
assert.strictEqual(workspace.inputs.landCommissionRate, undefined);
assert.strictEqual(workspace.inputs.landTransferFeeRate, undefined);
assert.strictEqual(workspace.readiness.calculationAllowed, false);

workspace = createAppDemoWorkspace('building');
assert.strictEqual(workspace.kind, APP_WORKSPACE_KIND.DEMO);
assert.strictEqual(workspace.inputs.buildingPrice, 140000000);
assert.strictEqual(workspace.provenance.isDemo, true);
assert.strictEqual(workspace.readiness.calculationAllowed, true);

workspace = createAppDemoWorkspace('land');
assert.strictEqual(workspace.inputs.landPricePerSqm, 20000);
assert.strictEqual(workspace.provenance.isDemo, true);

assert.strictEqual(legacyHydrationDefaults('building').buildingPrice, 140000000);
assert.strictEqual(legacyHydrationDefaults('land').landPricePerSqm, 20000);

let readiness = evaluateAppCalculationReadiness({ kind: APP_WORKSPACE_KIND.NEW, mode: 'building', inputs: { projectTitle: '' } });
assert.strictEqual(readiness.calculationAllowed, false);
readiness = evaluateAppCalculationReadiness({ kind: APP_WORKSPACE_KIND.DEMO, mode: 'building', inputs: workspace.inputs });
assert.strictEqual(readiness.calculationAllowed, true);
readiness = evaluateAppCalculationReadiness({ kind: 'UNKNOWN', mode: 'building', inputs: {} });
assert.strictEqual(readiness.calculationAllowed, false);

console.log('APP_WORKSPACE_CUTOVER_TESTS=PASS');
