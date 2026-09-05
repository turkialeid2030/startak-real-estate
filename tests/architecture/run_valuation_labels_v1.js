'use strict';

const assert = require('assert');
const {
  VALUATION_METHOD,
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('../../src/valuation-intelligence');
const {
  SUPPORTED_PRESENTATION_LOCALES,
  getValuationStateLabel,
  getValuationEngineStatusLabel,
  getValuationMethodLabel,
  getValuationReasonLabel,
} = require('../../src/app/valuation-labels');

(function testEveryValuationStateHasArabicAndEnglishLabels() {
  for (const locale of SUPPORTED_PRESENTATION_LOCALES) {
    for (const state of Object.values(METHOD_STATE)) {
      assert.ok(getValuationStateLabel(locale, state));
    }
  }
})();

(function testEveryValuationStageStatusHasArabicAndEnglishLabels() {
  for (const locale of SUPPORTED_PRESENTATION_LOCALES) {
    for (const status of Object.values(VALUATION_STAGE_STATUS)) {
      assert.ok(getValuationEngineStatusLabel(locale, status));
    }
  }
})();

(function testEveryValuationMethodHasArabicAndEnglishLabels() {
  for (const locale of SUPPORTED_PRESENTATION_LOCALES) {
    for (const method of Object.values(VALUATION_METHOD)) {
      assert.ok(getValuationMethodLabel(locale, method));
    }
  }
})();

(function testEveryValuationReasonHasArabicAndEnglishLabels() {
  for (const locale of SUPPORTED_PRESENTATION_LOCALES) {
    for (const reason of Object.values(VALUATION_REASON_CODE)) {
      assert.ok(getValuationReasonLabel(locale, reason));
    }
  }
})();

(function testLabelsAreActuallyLocalized() {
  assert.strictEqual(getValuationStateLabel('ar-SA', METHOD_STATE.AVAILABLE), 'متاح');
  assert.strictEqual(getValuationStateLabel('en', METHOD_STATE.AVAILABLE), 'Available');
  assert.notStrictEqual(
    getValuationReasonLabel('ar-SA', VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED),
    getValuationReasonLabel('en', VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED),
  );
})();

(function testUnknownLocaleAndUnknownCodeFailClosed() {
  assert.throws(() => getValuationStateLabel('fr', METHOD_STATE.AVAILABLE), /Unsupported valuation presentation locale/);
  assert.throws(() => getValuationReasonLabel('en', 'UNKNOWN_REASON'), /Missing valuation reason label/);
})();

console.log('VALUATION_LABELS_V1=PASS');
