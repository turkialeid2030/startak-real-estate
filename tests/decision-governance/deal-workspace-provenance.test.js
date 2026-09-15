'use strict';

const assert = require('assert');
const { DEAL_PROVENANCE } = require('../../src/decision-governance/deal-provenance');
const {
  provenanceForNewDeal,
  provenanceForDemoDeal,
  provenanceForSavedDeal,
  provenanceForDuplicatedDeal,
  provenanceForLoadedRecord,
  assertWorkspaceSaveAllowed,
  withDealProvenance,
} = require('../../src/decision-governance/deal-workspace-provenance');

const fresh = provenanceForNewDeal();
assert.strictEqual(fresh.kind, DEAL_PROVENANCE.NEW);
assert.strictEqual(fresh.isDemo, false);
assert.strictEqual(assertWorkspaceSaveAllowed({ provenance: fresh }), true);

const demo = provenanceForDemoDeal();
assert.strictEqual(demo.kind, DEAL_PROVENANCE.DEMO);
assert.strictEqual(demo.isDemo, true);
assert.strictEqual(demo.requiresRealDealConfirmation, true);
assert.throws(
  () => assertWorkspaceSaveAllowed({ provenance: demo }),
  (error) => error && error.code === 'DEMO_REAL_DEAL_CONFIRMATION_REQUIRED',
);
assert.strictEqual(assertWorkspaceSaveAllowed({ provenance: demo, confirmedDemoConversion: true }), true);

const persistedDemo = withDealProvenance({ id: 'demo-1' }, demo);
assert.deepStrictEqual(persistedDemo.provenance, {
  kind: DEAL_PROVENANCE.DEMO,
  isDemo: true,
  requiresRealDealConfirmation: true,
});
assert.strictEqual(provenanceForLoadedRecord(persistedDemo).kind, DEAL_PROVENANCE.DEMO);

assert.strictEqual(provenanceForSavedDeal().kind, DEAL_PROVENANCE.SAVED);
assert.strictEqual(provenanceForLoadedRecord({ id: 'legacy-without-provenance' }).kind, DEAL_PROVENANCE.SAVED);
assert.strictEqual(provenanceForDuplicatedDeal().kind, DEAL_PROVENANCE.DUPLICATED);
assert.strictEqual(
  provenanceForLoadedRecord({ provenance: { kind: DEAL_PROVENANCE.DUPLICATED } }).kind,
  DEAL_PROVENANCE.DUPLICATED,
);

console.log('DEAL_WORKSPACE_PROVENANCE_TESTS=PASS');
