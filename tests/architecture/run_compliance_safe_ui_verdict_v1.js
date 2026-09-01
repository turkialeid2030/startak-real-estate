'use strict';

const assert = require('assert');
const {
  getCustomerFacingVerdictLabel,
} = require('../../src/app/compliance-verdict-presentation.js');

const dict = {
  'recommendation.buy': 'يوصى بالشراء',
  'recommendation.conditionalBuy': 'يوصى بالشراء بشروط',
  'recommendation.noBuy': 'لا يوصى بالشراء',
};
const t = (key) => dict[key] || key;

(function testExternalLabelsDoNotEchoImperativeLegacyVerdicts() {
  const buy = getCustomerFacingVerdictLabel('يوصى بالشراء', t);
  const conditional = getCustomerFacingVerdictLabel('يوصى بالشراء بشروط', t);
  const noBuy = getCustomerFacingVerdictLabel('لا يوصى بالشراء', t);

  assert.notStrictEqual(buy, 'يوصى بالشراء');
  assert.notStrictEqual(conditional, 'يوصى بالشراء بشروط');
  assert.notStrictEqual(noBuy, 'لا يوصى بالشراء');
})();

(function testUnknownVerdictFailsClosed() {
  assert.throws(
    () => getCustomerFacingVerdictLabel('UNKNOWN_VERDICT', t),
    /Unmapped recommendation verdict/
  );
})();

(function testTranslatorRequired() {
  assert.throws(
    () => getCustomerFacingVerdictLabel('يوصى بالشراء', null),
    /translation function/
  );
})();

console.log('COMPLIANCE_SAFE_UI_VERDICT_V1=PASS');
