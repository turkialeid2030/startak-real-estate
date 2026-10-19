'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { calculateUiInvestmentState } = require('../../src/assumptions/ui-integration-controller');
const { buildPersonalFinancialStudy, htmlFinancialStudy } = require('../../src/app/personal-financial-study');
const gold = require('../reference/RE-GOLD-baseline.json')['RE-GOLD-002_existing_building'].inputs;
(async () => {
  const dom = new JSDOM('<div id="root"></div>');
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const { transformWithOxc } = await import('vite');
  const file = path.resolve(__dirname, '../../src/components/PurchasePriceAlternative.jsx');
  const source = fs.readFileSync(file, 'utf8').replace("import React from 'react';", '').replace('export default function ', 'function ');
  const { code } = await transformWithOxc(source, file, { jsx: { runtime: 'classic' } });
  const Component = new Function('React', 'require', code + '\nreturn PurchasePriceAlternative;')(React, createRequire(file));
  const root = createRoot(document.getElementById('root'));
  const context = { mode: 'building', inputs: { ...gold, discountRate: .5 }, assumptionModelVersion: 'LEGACY' };
  const alternative = calculateUiInvestmentState(context).results.purchaseAlternative;
  const report = buildPersonalFinancialStudy(context);
  assert.deepEqual(alternative, report.financial.purchaseAlternative);
  for (const locale of ['ar-SA', 'en']) {
    await React.act(async () => root.render(React.createElement(Component, { alternative, locale })));
    const amount = document.querySelector('[data-testid="building-price-alternative-value"]');
    assert.equal(amount.textContent, alternative.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (locale === 'en' ? ' SAR' : ' ر.س'));
    assert(document.querySelector('[role=status]').textContent.includes(locale === 'en' ? 'not a proven global maximum' : 'ليس إثباتًا لأعلى سعر ممكن'));
    assert(htmlFinancialStudy(report, { locale }).includes(locale === 'en' ? 'not a proven global maximum' : 'ليس إثباتًا لأعلى سعر ممكن'));
  }
  for (const status of ['NO_VERIFIED_ALTERNATIVE_FOUND', 'SEARCH_INCOMPLETE']) {
    await React.act(async () => root.render(React.createElement(Component, { alternative: { status, price: null } })));
    assert(document.querySelector('[role=status]'));
    assert.equal(document.querySelector('[data-testid="building-price-alternative-value"]'), null, 'never retain a previous verified price after failed/incomplete search');
  }
  await React.act(async () => root.render(React.createElement(Component, { alternative, inputValid: false })));
  assert(document.querySelector('[data-testid="building-price-review-invalid"]'));
  assert.equal(document.querySelector('[data-testid="building-price-alternative-value"]'), null, 'invalid current input withholds even a previously verified alternative');
  for (const alternative of [null, { status: 'NOT_SEARCHED', price: null }]) {
    await React.act(async () => root.render(React.createElement(Component, { alternative })));
    assert.equal(document.body.textContent, '');
  }
  await React.act(async () => root.unmount()); dom.window.close();
  console.log('PURCHASE_ALTERNATIVE_UI=PASS (actual React, two locales, current report parity, stale price removal)');
})().catch(error => { console.error(error); process.exitCode = 1; });
