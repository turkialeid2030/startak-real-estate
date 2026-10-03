'use strict';

const assert = require('assert');
const {
  UI_MODE,
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');

const base = {
  id: 'C41-REGISTRY-ABSENCE',
  name: 'C41 registry absence',
  mode: UI_MODE.BUILDING,
  inputs: {},
  savedAt: '2026-10-03T00:00:00.000Z',
};

const fresh = prepareNewUiDealForSave(base);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(fresh, 'assumptionRegistry'),
  false,
  'an absent optional assumption registry must remain absent on new persistence',
);
assert.doesNotThrow(() => validateSavedDealRecord(fresh));

const updated = prepareUpdatedUiDealForSave(base, 'V2');
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(updated, 'assumptionRegistry'),
  false,
  'an absent optional assumption registry must remain absent on update persistence',
);
assert.doesNotThrow(() => validateSavedDealRecord(updated));

const withRegistry = prepareNewUiDealForSave({
  ...base,
  id: 'C41-REGISTRY-PRESENT',
  assumptionRegistry: [],
});
assert.deepStrictEqual(withRegistry.assumptionRegistry, []);
assert.doesNotThrow(() => validateSavedDealRecord(withRegistry));

console.log('C41_SAVED_DEAL_OPTIONAL_REGISTRY_SEMANTICS=PASS');
console.log('C41_ABSENT_REGISTRY_REMAINS_ABSENT=PASS');
console.log('C41_PRESENT_REGISTRY_REMAINS_ARRAY=PASS');
