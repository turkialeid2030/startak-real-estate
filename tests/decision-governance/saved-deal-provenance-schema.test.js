'use strict';

const assert = require('assert');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const { DEAL_PROVENANCE } = require('../../src/decision-governance/deal-provenance');

const legacy = { id: 'legacy', name: 'Legacy', mode: 'building', inputs: {}, savedAt: '2026-09-15T00:00:00.000Z' };
assert.strictEqual(validateSavedDealRecord(legacy), legacy, 'legacy record without provenance must remain valid');

const governed = {
  ...legacy,
  id: 'governed',
  provenance: { kind: DEAL_PROVENANCE.SAVED, isDemo: false, requiresRealDealConfirmation: false },
};
assert.strictEqual(validateSavedDealRecord(governed), governed);

assert.throws(
  () => validateSavedDealRecord({ ...legacy, provenance: { kind: 'UNTRUSTED' } }),
  (error) => error && error.reasonCode === 'INVALID_DEAL_PROVENANCE_KIND',
);
assert.throws(
  () => validateSavedDealRecord({ ...legacy, inputs: { provenance: { kind: DEAL_PROVENANCE.DEMO } } }),
  (error) => error && error.reasonCode === 'DEAL_PROVENANCE_IN_ECONOMIC_INPUTS',
);

console.log('SAVED_DEAL_PROVENANCE_SCHEMA_TESTS=PASS');
