'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  WIRING_MARKER,
  transformAppSource,
} = require('../../tools/wave2-app-wiring-transform');

const appPath = path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx');
const original = fs.readFileSync(appPath, 'utf8');

function run() {
  const transformed = transformAppSource(original);
  assert.strictEqual(transformed.changed, true);
  assert.strictEqual(transformed.alreadyApplied, false);
  const source = transformed.source;

  assert.ok(source.includes(WIRING_MARKER));
  assert.ok(source.includes('calculateUiInvestmentState({'));
  assert.ok(source.includes('hydrateUiDeal({'));
  assert.ok(source.includes('prepareNewUiDealForSave({'));
  assert.ok(source.includes('prepareUpdatedUiDealForSave({'));
  assert.ok(source.includes('<OptionalPercentField'));
  assert.ok(source.includes('disabled={v2Governed}'));
  assert.ok(source.includes('sensitivityReady={mode === UI_MODE.BUILDING'));
  assert.ok(source.includes('SHOW_CONTROLLED_UNAVAILABLE_STATE'));
  assert.ok(source.includes('AssumptionDisclosureBanner'));
  assert.ok(source.includes('buildingAssumptionModelVersion'));
  assert.ok(source.includes('landAssumptionModelVersion'));
  assert.ok(source.includes('isFiniteNumber('));
  assert.ok(!/(^|[^.\w])isFinite\(/m.test(source));
  assert.ok(!source.includes('<PercentField label={t("inputBuilding.exitCapRate")}'));
  assert.ok(!source.includes('setBuildingInputs(DEFAULT_BUILDING_INPUTS)'));
  assert.ok(!source.includes('setLandInputs(DEFAULT_LAND_INPUTS)'));
  assert.ok(!source.includes('transactionAuthorized: true'));

  assert.ok(source.includes('assumptionModelVersion,'), 'sensitivity calculations must carry the assumption version');
  assert.ok(source.includes('? "exitCapRate" : "marketCapRate"'), 'V2 sensitivity must perturb exitCapRate rather than marketCapRate');
  assert.ok(source.includes('prepareUpdatedUiDealForSave({ id: activeDealId'), 'Saved Deal updates must preserve the active assumption version');
  assert.ok(source.includes('cumulativeAvailable'), 'cash-flow cumulative presentation must fail closed after a missing row');

  const second = transformAppSource(source);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(second.alreadyApplied, true);
  assert.strictEqual(second.source, source);

  console.log('WAVE2_APP_WIRING_TRANSFORM_ANCHORS=PASS');
  console.log('WAVE2_APP_WIRING_NULL_SAFE_FORMATTING=PASS');
  console.log('WAVE2_APP_WIRING_EXPLICIT_EXIT_CAP=PASS');
  console.log('WAVE2_APP_WIRING_SENSITIVITY_GATE=PASS');
  console.log('WAVE2_APP_WIRING_SAVED_DEAL_VERSIONING=PASS');
  console.log('WAVE2_APP_WIRING_IDEMPOTENT=PASS');
  console.log('WAVE2_APP_WIRING_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
