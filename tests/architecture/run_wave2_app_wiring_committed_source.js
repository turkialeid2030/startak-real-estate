'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx');
const source = fs.readFileSync(appPath, 'utf8');

function run() {
  // Production React wiring must be committed directly in App.jsx. These checks
  // deliberately inspect the committed source rather than a generated transform.
  assert.ok(source.includes('// WAVE2_PRODUCTION_UI_WIRING_V1'));
  assert.ok(source.includes('calculateUiInvestmentState({'));
  assert.ok(source.includes('hydrateUiDeal({'));
  assert.ok(source.includes('prepareNewUiDealForSave({'));
  assert.ok(source.includes('prepareUpdatedUiDealForSave({ id: activeDealId'));
  assert.ok(source.includes('buildingAssumptionModelVersion'));
  assert.ok(source.includes('landAssumptionModelVersion'));

  // Existing-building V2 exit cap must remain explicit and nullable. The old
  // zero-coercing PercentField route is prohibited for this governed input.
  assert.ok(source.includes('<OptionalPercentField'));
  assert.ok(source.includes('applyExitCapInputText({'));
  assert.ok(!source.includes('<PercentField label={t("inputBuilding.exitCapRate")}'));
  assert.ok(!source.includes('setBuildingInputs(DEFAULT_BUILDING_INPUTS)'));
  assert.ok(!source.includes('setLandInputs(DEFAULT_LAND_INPUTS)'));

  // V2 approved assumptions are governed rather than silently editable.
  assert.ok(source.includes('disabled={v2Governed}'));
  assert.ok(source.includes('AssumptionDisclosureBanner'));

  // Sensitivity must be version-aware and fail closed when exit-dependent
  // metrics are unavailable.
  assert.ok(source.includes('assumptionModelVersion,'));
  assert.ok(source.includes('? "exitCapRate" : "marketCapRate"'));
  assert.ok(source.includes('sensitivityReady={mode === UI_MODE.BUILDING'));
  assert.ok(source.includes('SHOW_CONTROLLED_UNAVAILABLE_STATE'));

  // Presentation must not coerce null/undefined exit-dependent metrics to zero.
  assert.ok(source.includes('isFiniteNumber('));
  assert.ok(!/(^|[^.\w])isFinite\(/m.test(source));
  assert.ok(source.includes('cumulativeAvailable'));

  // UI wiring cannot grant execution authority.
  assert.ok(!source.includes('transactionAuthorized: true'));

  console.log('WAVE2_COMMITTED_APP_WIRING=PASS');
  console.log('WAVE2_COMMITTED_EXIT_CAP_GOVERNANCE=PASS');
  console.log('WAVE2_COMMITTED_ASSUMPTION_DISCLOSURE=PASS');
  console.log('WAVE2_COMMITTED_SENSITIVITY_GOVERNANCE=PASS');
  console.log('WAVE2_COMMITTED_NULL_SAFE_PRESENTATION=PASS');
  console.log('WAVE2_COMMITTED_SAVED_DEAL_VERSIONING=PASS');
  console.log('WAVE2_COMMITTED_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
