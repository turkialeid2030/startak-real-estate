'use strict';

const assert = require('assert');
const { resolveGovernedPresentationText } = require('../../src/i18n/LocaleContext');
const { getAboutMethodology, MODEL_CARD } = require('../../src/decision-governance/model-card');

const ar = getAboutMethodology('ar');
const en = getAboutMethodology('en');

assert.strictEqual(resolveGovernedPresentationText('globalApp.methodologyNote', 'ar-SA'), ar.notice);
assert.strictEqual(resolveGovernedPresentationText('globalApp.methodologyNote', 'en'), en.notice);
assert.strictEqual(resolveGovernedPresentationText('globalApp.footerCurrency', 'ar-SA'), null);
assert.strictEqual(ar.modelVersion, MODEL_CARD.modelVersion);
assert.strictEqual(en.modelVersion, MODEL_CARD.modelVersion);
assert.ok(ar.notice.includes('تحليل مالي داعم للقرار'));
assert.ok(en.notice.includes('financial analysis supporting a decision'));
assert.ok(ar.notice.includes('لا تمثل اعتمادًا قانونيًا'));
assert.ok(en.notice.includes('not legal or regulatory approval'));

console.log('METHODOLOGY_UI_PRESENTATION_TESTS=PASS');
