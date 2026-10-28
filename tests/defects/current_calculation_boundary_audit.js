'use strict';
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Boundary = require('../../src/components/CurrentCalculationBoundary');
const { presentCode } = require('../../src/i18n/strict-arabic-presentation');
const { VALUATION_METHOD } = require('../../src/valuation-intelligence/contracts');

const priorResult = React.createElement('section', null,
  '13594392 16505425.82 10.66% BUY historical calculation');
let checks = 0;
for (const locale of ['ar-SA', 'en']) {
  const invalid = renderToStaticMarkup(React.createElement(Boundary,
    { invalid: true, locale }, priorResult));
  assert.doesNotMatch(invalid, /13594392|16505425|10\.66|BUY|historical calculation/);
  assert.match(invalid, /current-calculation-unavailable/);
  assert.match(invalid, /role="status"/);
  const recovered = renderToStaticMarkup(React.createElement(Boundary,
    { invalid: false, locale }, priorResult));
  assert.match(recovered, /13594392/);
  assert.doesNotMatch(recovered, /current-calculation-unavailable/);
  checks += 5;
}
for (const method of Object.values(VALUATION_METHOD)) {
  assert.match(presentCode(method, 'ar-SA'), /[\u0600-\u06ff]/);
  assert.doesNotMatch(presentCode(method, 'ar-SA'), /[A-Za-z]|غير معرّفة/);
  assert.equal(presentCode(method, 'en'), method);
  checks += 3;
}
console.log(`CURRENT_CALCULATION_BOUNDARY_AUDIT=PASS checks=${checks}`);
