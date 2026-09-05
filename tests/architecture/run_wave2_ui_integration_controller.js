'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  UI_MODE,
  createUiWorkspace,
  hydrateUiDeal,
  calculateUiInvestmentState,
  applyExitCapInputText,
  buildUiDisclosureViewModel,
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
  explicitlyUpgradeUiDealToV2,
} = require('../../src/assumptions/ui-integration-controller');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
} = require('../../src/assumptions/assumption-model');
const { EXIT_CAP_SOURCE } = require('../../src/engines/valuation/exit-cap-resolver');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'),
  'utf8',
));
const baseInputs = fixture.input_set;
const defaults = { ...baseInputs, exitCapRate: 0.07 };

function assertV2AssumptionsMaterialized(inputs) {
  for (const [key, value] of Object.entries(V2_APPROVED_ASSUMPTIONS)) {
    assert.strictEqual(inputs[key], value, `${key} must reflect the governed V2 assumption in UI state`);
  }
}

function run() {
  const fresh = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: defaults });
  assert.strictEqual(fresh.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(fresh.legacyCompatibility, false);
  assert.strictEqual(fresh.transactionAuthorized, false);
  assert.notStrictEqual(fresh.inputs, defaults);
  assertV2AssumptionsMaterialized(fresh.inputs);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(fresh.inputs, 'exitCapRate'), false,
    'fresh V2 building work must not inherit a template/default exit cap');
  assert.strictEqual(defaults.exitCapRate, 0.07, 'caller defaults must remain unmodified');

  const incomplete = calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: fresh.inputs,
    assumptionModelVersion: fresh.assumptionModelVersion,
  });
  assert.strictEqual(incomplete.results.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(incomplete.results.exitCapSource, EXIT_CAP_SOURCE.MISSING_REQUIRED);
  assert.strictEqual(incomplete.exitCapInputRequired, true);
  assert.strictEqual(incomplete.sensitivityReady, false);
  assert.strictEqual(incomplete.sensitivityRenderPolicy, 'SHOW_CONTROLLED_UNAVAILABLE_STATE');
  assert.strictEqual(incomplete.transactionAuthorized, false);

  const blankExit = applyExitCapInputText({ inputs: { ...fresh.inputs, exitCapRate: 0.08 }, rawText: '' });
  assert.strictEqual(blankExit.exitCapPresent, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(blankExit.inputs, 'exitCapRate'), false);
  assert.strictEqual(blankExit.displayValue, '');

  const incompleteDisclosureAr = buildUiDisclosureViewModel({
    governance: incomplete.governance,
    locale: 'ar-SA',
  });
  const incompleteDisclosureEn = buildUiDisclosureViewModel({
    governance: incomplete.governance,
    locale: 'en',
  });
  assert.ok(incompleteDisclosureAr.badge.includes('V2'));
  assert.ok(incompleteDisclosureEn.badge.includes('V2'));
  assert.strictEqual(typeof incompleteDisclosureAr.exitCapNotice, 'string');
  assert.strictEqual(typeof incompleteDisclosureEn.exitCapNotice, 'string');
  assert.strictEqual(incompleteDisclosureAr.exitCapInputRequired, true);
  assert.strictEqual(incompleteDisclosureAr.transactionAuthorized, false);

  const explicitExit = applyExitCapInputText({ inputs: fresh.inputs, rawText: '7.5' });
  assert.strictEqual(explicitExit.exitCapPresent, true);
  assert.strictEqual(explicitExit.inputs.exitCapRate, 0.075);
  assert.strictEqual(explicitExit.displayValue, '7.5');

  const complete = calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: explicitExit.inputs,
    assumptionModelVersion: fresh.assumptionModelVersion,
  });
  assert.notStrictEqual(complete.results.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(complete.results.exitCapSource, EXIT_CAP_SOURCE.EXPLICIT);
  assert.strictEqual(complete.sensitivityReady, true);
  assert.strictEqual(complete.exitCapInputRequired, false);

  const legacyRecord = {
    id: 'deal_legacy_1',
    name: 'Legacy Building',
    mode: 'building',
    inputs: { ...baseInputs },
    savedAt: '2026-01-01T00:00:00.000Z',
  };
  const hydratedLegacy = hydrateUiDeal({ record: legacyRecord, defaultInputs: defaults });
  assert.strictEqual(hydratedLegacy.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(hydratedLegacy.legacyCompatibility, true);
  assert.strictEqual(hydratedLegacy.explicitUpgradeRequired, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(hydratedLegacy.inputs, 'exitCapRate'), false,
    'legacy hydration must not manufacture the default exit cap');
  for (const [key, value] of Object.entries(V2_APPROVED_ASSUMPTIONS)) {
    if (Object.prototype.hasOwnProperty.call(baseInputs, key)) {
      assert.strictEqual(hydratedLegacy.inputs[key], baseInputs[key],
        `${key} must retain persisted Legacy semantics during hydration`);
    }
  }

  const legacyState = calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: hydratedLegacy.inputs,
    assumptionModelVersion: hydratedLegacy.assumptionModelVersion,
  });
  assert.strictEqual(legacyState.results.financialModelStatus, 'VALID');
  assert.strictEqual(legacyState.results.exitCapSource, EXIT_CAP_SOURCE.LEGACY_DERIVED);
  assert.strictEqual(legacyState.sensitivityReady, true);

  const newSaved = prepareNewUiDealForSave({
    id: 'deal_new_1',
    name: 'New Building',
    mode: 'building',
    inputs: { ...explicitExit.inputs },
    savedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.strictEqual(newSaved.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);

  const updatedLegacy = prepareUpdatedUiDealForSave(legacyRecord, hydratedLegacy.assumptionModelVersion);
  assert.strictEqual(updatedLegacy.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.LEGACY);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(updatedLegacy.inputs, 'exitCapRate'), false);

  const upgraded = explicitlyUpgradeUiDealToV2(legacyRecord);
  assert.strictEqual(upgraded.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(upgraded.inputs, 'exitCapRate'), false,
    'explicit upgrade must not derive or invent an exit cap');
  assert.strictEqual(upgraded.transactionAuthorized, false);

  const hydratedV2Missing = hydrateUiDeal({
    record: {
      ...legacyRecord,
      id: 'deal_v2_missing',
      assumptionModelVersion: ASSUMPTION_MODEL_VERSION.V2,
    },
    defaultInputs: defaults,
  });
  assert.strictEqual(hydratedV2Missing.assumptionModelVersion, ASSUMPTION_MODEL_VERSION.V2);
  assertV2AssumptionsMaterialized(hydratedV2Missing.inputs);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(hydratedV2Missing.inputs, 'exitCapRate'), false);
  const v2MissingState = calculateUiInvestmentState({
    mode: UI_MODE.BUILDING,
    inputs: hydratedV2Missing.inputs,
    assumptionModelVersion: hydratedV2Missing.assumptionModelVersion,
  });
  assert.strictEqual(v2MissingState.results.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(v2MissingState.sensitivityReady, false);

  assert.throws(
    () => applyExitCapInputText({ inputs: fresh.inputs, rawText: 'not-a-number' }),
    (error) => error && error.code === 'OPTIONAL_PERCENT_INVALID',
  );

  const landFresh = createUiWorkspace({
    mode: UI_MODE.LAND,
    defaultInputs: { ...baseInputs, exitCapRate: 0.085 },
  });
  assert.strictEqual(landFresh.inputs.exitCapRate, 0.085,
    'land/development exit-cap semantics are intentionally unchanged');
  assertV2AssumptionsMaterialized(landFresh.inputs);

  console.log('WAVE2_UI_CONTROLLER_FRESH_V2_EXPLICIT_EXIT_REQUIRED=PASS');
  console.log('WAVE2_UI_CONTROLLER_V2_ASSUMPTIONS_MATERIALIZED=PASS');
  console.log('WAVE2_UI_CONTROLLER_V2_FAIL_CLOSED=PASS');
  console.log('WAVE2_UI_CONTROLLER_LEGACY_COMPATIBILITY=PASS');
  console.log('WAVE2_UI_CONTROLLER_SAVE_VERSIONING=PASS');
  console.log('WAVE2_UI_CONTROLLER_DISCLOSURE_AND_SENSITIVITY=PASS');
  console.log('WAVE2_UI_CONTROLLER_LAND_EXIT_SCOPE_UNCHANGED=PASS');
  console.log('WAVE2_UI_CONTROLLER_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
