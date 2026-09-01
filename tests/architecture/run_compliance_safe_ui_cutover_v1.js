'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  getVerdictLabel,
  setVerdictPresentationMode,
  getVerdictPresentationMode,
  VERDICT_PRESENTATION_MODE,
} = require('../../src/i18n/domain-presentation.js');
const {
  activateCustomerFacingVerdictPresentation,
} = require('../../src/app/compliance-verdict-presentation.js');

const dictAr = {
  'recommendation.buy': 'يوصى بالشراء',
  'recommendation.conditionalBuy': 'يوصى بالشراء بشروط',
  'recommendation.noBuy': 'لا يوصى بالشراء',
};
const tAr = (key) => dictAr[key] || key;

(function testLegacyModeRemainsDefaultForCharacterization() {
  setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION);
  assert.strictEqual(getVerdictPresentationMode(), VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION);
  assert.strictEqual(getVerdictLabel('يوصى بالشراء', tAr), 'يوصى بالشراء');
})();

(function testExplicitProductionActivationCutsOverPresentationOnly() {
  const active = activateCustomerFacingVerdictPresentation();
  assert.strictEqual(active, VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT);
  assert.strictEqual(getVerdictPresentationMode(), VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT);

  const buy = getVerdictLabel('يوصى بالشراء', tAr);
  const conditional = getVerdictLabel('يوصى بالشراء بشروط', tAr);
  const noBuy = getVerdictLabel('لا يوصى بالشراء', tAr);

  assert.notStrictEqual(buy, 'يوصى بالشراء');
  assert.notStrictEqual(conditional, 'يوصى بالشراء بشروط');
  assert.notStrictEqual(noBuy, 'لا يوصى بالشراء');
})();

(function testUnsupportedModeFailsClosed() {
  assert.throws(() => setVerdictPresentationMode('UNSAFE_OR_UNKNOWN'), /Unsupported verdict presentation mode/);
})();

(function testProductionEntryPointExplicitlyActivatesSafeMode() {
  const mainPath = path.resolve(__dirname, '../../src/main.jsx');
  const mainSource = fs.readFileSync(mainPath, 'utf8');
  assert.match(mainSource, /activateCustomerFacingVerdictPresentation/);
  assert.match(mainSource, /activateCustomerFacingVerdictPresentation\(\);/);
})();

setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.LEGACY_CHARACTERIZATION);
console.log('COMPLIANCE_SAFE_UI_CUTOVER_V1=PASS');
