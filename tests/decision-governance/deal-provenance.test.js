'use strict';
const assert = require('assert');
const { DEAL_PROVENANCE, createDealProvenance, assertRealDealSaveAllowed } = require('../../src/decision-governance/deal-provenance');

const fresh = createDealProvenance(DEAL_PROVENANCE.NEW);
assert.strictEqual(fresh.isDemo, false);
assert.strictEqual(assertRealDealSaveAllowed({ provenance: fresh }), true);

const demo = createDealProvenance(DEAL_PROVENANCE.DEMO);
assert.strictEqual(demo.isDemo, true);
assert.strictEqual(demo.requiresRealDealConfirmation, true);
assert.match(demo.label.ar, /بيانات تجريبية/);
assert.match(demo.label.en, /DEMO DATA/);
assert.throws(() => assertRealDealSaveAllowed({ provenance: demo }), e => e.code === 'DEMO_REAL_DEAL_CONFIRMATION_REQUIRED');
assert.strictEqual(assertRealDealSaveAllowed({ provenance: demo, confirmedDemoConversion: true }), true);

const duplicate = createDealProvenance(DEAL_PROVENANCE.DUPLICATED);
assert.strictEqual(duplicate.isDemo, false);
console.log('DEAL_PROVENANCE_TESTS=PASS');
