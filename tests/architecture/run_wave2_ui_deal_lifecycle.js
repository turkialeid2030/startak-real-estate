'use strict';

const assert = require('assert');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
} = require('../../src/assumptions/assumption-model');
const {
  createFreshWorkspaceState,
  hydrateSavedDealForUi,
  buildNewSavedDealRecord,
  buildUpdatedSavedDealRecord,
  explicitlyUpgradeUiDeal,
} = require('../../src/assumptions/ui-deal-lifecycle');

function run() {
  const defaults = {
    buildingPrice: 140000000,
    marketCapRate: 0.07,
    exitCapRate: 0.07,
    managementFeeRate: 0,
  };

  const fresh = createFreshWorkspaceState(defaults);
  assert.strictEqual(fresh.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(fresh.legacyCompatibility, false);
  assert.strictEqual(fresh.transactionAuthorized, false);
  assert.notStrictEqual(fresh.inputs, defaults);
  assert.deepStrictEqual(defaults, {
    buildingPrice: 140000000,
    marketCapRate: 0.07,
    exitCapRate: 0.07,
    managementFeeRate: 0,
  });

  const legacyRecord = {
    id: 'legacy-1',
    name: 'Legacy building',
    mode: 'building',
    inputs: {
      buildingPrice: 120000000,
      marketCapRate: 0.075,
    },
    savedAt: '2026-09-05T00:00:00.000Z',
  };
  const legacySnapshot = JSON.parse(JSON.stringify(legacyRecord));
  const hydratedLegacy = hydrateSavedDealForUi(legacyRecord, defaults);
  assert.strictEqual(hydratedLegacy.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(hydratedLegacy.legacyCompatibility, true);
  assert.strictEqual(hydratedLegacy.explicitUpgradeRequired, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(hydratedLegacy.inputs, 'exitCapRate'), false);
  assert.strictEqual(hydratedLegacy.inputs.marketCapRate, 0.075);
  assert.strictEqual(hydratedLegacy.transactionAuthorized, false);
  assert.deepStrictEqual(legacyRecord, legacySnapshot);

  const v2IncompleteRecord = {
    ...legacyRecord,
    id: 'v2-incomplete',
    assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
  };
  const hydratedV2Incomplete = hydrateSavedDealForUi(v2IncompleteRecord, defaults);
  assert.strictEqual(hydratedV2Incomplete.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(hydratedV2Incomplete.inputs, 'exitCapRate'), false);
  assert.strictEqual(hydratedV2Incomplete.explicitUpgradeRequired, false);

  const newRecord = buildNewSavedDealRecord({
    id: 'new-1',
    name: 'New building',
    mode: 'building',
    inputs: { ...defaults },
    savedAt: '2026-09-05T01:00:00.000Z',
  });
  assert.strictEqual(newRecord.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);

  const legacyUpdate = buildUpdatedSavedDealRecord(legacyRecord, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(legacyUpdate.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyUpdate.inputs, 'exitCapRate'), false);

  const v2Update = buildUpdatedSavedDealRecord(v2IncompleteRecord, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(v2Update.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(v2Update.inputs, 'exitCapRate'), false);

  const upgraded = explicitlyUpgradeUiDeal(legacyRecord);
  assert.strictEqual(upgraded.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(upgraded.transactionAuthorized, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(upgraded.inputs, 'exitCapRate'), false);
  for (const [key, value] of Object.entries(V2_APPROVED_ASSUMPTIONS)) {
    assert.strictEqual(upgraded.inputs[key], value, `${key} must use the approved V2 assumption`);
  }
  assert.deepStrictEqual(legacyRecord, legacySnapshot);

  const legacyWithExplicitExit = {
    ...legacyRecord,
    id: 'legacy-explicit',
    inputs: { ...legacyRecord.inputs, exitCapRate: 0.08 },
  };
  const hydratedExplicit = hydrateSavedDealForUi(legacyWithExplicitExit, defaults);
  assert.strictEqual(hydratedExplicit.inputs.exitCapRate, 0.08);
  const upgradedExplicit = explicitlyUpgradeUiDeal(legacyWithExplicitExit);
  assert.strictEqual(upgradedExplicit.inputs.exitCapRate, 0.08);

  console.log('WAVE2_UI_NEW_WORKSPACE_V2=PASS');
  console.log('WAVE2_UI_LEGACY_EXIT_CAP_PROVENANCE=PASS');
  console.log('WAVE2_UI_V2_MISSING_EXIT_CAP_FAIL_CLOSED=PASS');
  console.log('WAVE2_UI_UPDATE_PRESERVES_MODEL_VERSION=PASS');
  console.log('WAVE2_UI_EXPLICIT_UPGRADE_ONLY=PASS');
  console.log('WAVE2_UI_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
