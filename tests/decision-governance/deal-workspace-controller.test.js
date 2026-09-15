'use strict';

const assert = require('assert');
const { DEAL_PROVENANCE } = require('../../src/decision-governance/deal-provenance');
const {
  createNewWorkspace,
  createDemoWorkspace,
  evaluateWorkspace,
  prepareWorkspaceRecordForSave,
} = require('../../src/decision-governance/deal-workspace-controller');

const fresh = createNewWorkspace('building');
assert.strictEqual(fresh.provenance.kind, DEAL_PROVENANCE.NEW);
assert.strictEqual(fresh.calculationAllowed, false);
assert.strictEqual(fresh.readiness.status, 'INCOMPLETE');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fresh.inputs, 'buildingPrice'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(fresh.inputs, 'transferFeeRate'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(fresh.inputs, 'commissionRate'), false);

const completeBuilding = {
  ...fresh.inputs,
  buildingPrice: 1000000,
  rentPerSqm: 1000,
  occupancyRate: 0.9,
  marketCapRate: 0.07,
  discountRate: 0.1,
  holdPeriod: 5,
};
const evaluated = evaluateWorkspace('building', completeBuilding, fresh.provenance);
assert.strictEqual(evaluated.calculationAllowed, true);
assert.strictEqual(evaluated.readiness.status, 'READY_FOR_FINANCIAL_ANALYSIS');

const demo = createDemoWorkspace('building', { projectTitle: 'Sample', buildingPrice: 140000000 });
assert.strictEqual(demo.provenance.kind, DEAL_PROVENANCE.DEMO);
assert.strictEqual(demo.provenance.isDemo, true);
assert.strictEqual(demo.calculationAllowed, true);
assert.throws(
  () => prepareWorkspaceRecordForSave({ id: 'd1', mode: 'building', inputs: demo.inputs }, demo.provenance),
  (error) => error && error.code === 'DEMO_REAL_DEAL_CONFIRMATION_REQUIRED',
);

const converted = prepareWorkspaceRecordForSave(
  { id: 'd1', mode: 'building', inputs: demo.inputs },
  demo.provenance,
  { confirmedDemoConversion: true },
);
assert.strictEqual(converted.provenance.kind, DEAL_PROVENANCE.SAVED);
assert.strictEqual(converted.provenance.isDemo, false);

const newSaved = prepareWorkspaceRecordForSave(
  { id: 'n1', mode: 'building', inputs: completeBuilding },
  fresh.provenance,
);
assert.strictEqual(newSaved.provenance.kind, DEAL_PROVENANCE.NEW);
assert.strictEqual(newSaved.provenance.isDemo, false);

console.log('DEAL_WORKSPACE_CONTROLLER_TESTS=PASS');
