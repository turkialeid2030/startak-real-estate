'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { Simulate } = require('react-dom/test-utils');
const { validateUserEnteredZakatCase } = require('../../src/zakat/user-entered-zakat');
const { buildPersonalFinancialStudy } = require('../../src/app/personal-financial-study');
const gold = require('../reference/RE-GOLD-baseline.json');

(async () => {
  const dom = new JSDOM('<div id="root"></div>');
  global.window = dom.window; global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const { transformWithOxc } = await import('vite');
  async function load(file, imports, exports) {
    const filename = path.resolve(__dirname, '../../src/components', file);
    let source = fs.readFileSync(filename, 'utf8');
    for (const [from, to] of imports) source = source.replace(from, to);
    source = source.replaceAll('export default function ', 'function ').replaceAll('export function ', 'function ');
    const { code } = await transformWithOxc(source, filename, { jsx: { runtime: 'classic' } });
    return new Function('require', 'React', 'NumericDraftInput', code + '\nreturn ' + exports)(createRequire(filename), React, NumericDraftInput);
  }
  let NumericDraftInput;
  NumericDraftInput = await load('NumericDraftInput.jsx', [
    ["import React from 'react';", ''],
    ["import { parseNumericText } from '../validation/numeric-text';", "const { parseNumericText } = require('../validation/numeric-text');"],
  ], 'NumericDraftInput');
  const ZakatInputSection = await load('ZakatLayerPanel.jsx', [
    ['import React, { useEffect, useMemo, useState } from "react";', 'const { useEffect, useMemo, useState } = React;'],
    ["import NumericDraftInput from './NumericDraftInput';", ''],
    ["import { parseNumericText } from '../validation/numeric-text';", "const { parseNumericText } = require('../validation/numeric-text');"],
  ], 'ZakatInputSection');
  const { LocaleProvider } = require('../../src/i18n/LocaleContext');
  let current, setCurrent;
  function Harness() {
    const [state, setState] = React.useState({ annualAmount: 100, source: 'ACCOUNTANT' });
    current = state; setCurrent = setState;
    return React.createElement(LocaleProvider, null, React.createElement(ZakatInputSection, { zakatCase: state, setZakatCase: setState }));
  }
  const root = createRoot(document.getElementById('root'));
  await React.act(async () => root.render(React.createElement(Harness)));
  const input = () => document.querySelector('input');
  const change = text => React.act(async () => { input().value = text; Simulate.change(input(), { target: { value: text } }); });
  for (const text of ['١٬٨٠٠٫٥', '۱٬۸۰۰٫۵', '1,800.5']) {
    await change(text);
    assert.equal(current.annualAmount, 1800.5);
    assert.equal(input().value, text);
    assert.equal(input().checkValidity(), true);
  }
  for (const text of ['1e3', '1800٫5x', '1,80', '-1']) {
    await change(text);
    await React.act(async () => Simulate.blur(input()));
    assert.equal(current.annualAmount, text, 'invalid current input replaces the previous valid state');
    assert.equal(input().value, text);
    assert.equal(input().getAttribute('aria-invalid'), 'true');
    assert.equal(input().checkValidity(), false);
    assert.throws(() => validateUserEnteredZakatCase(current));
    const report = buildPersonalFinancialStudy({ mode: 'building', inputs: gold['RE-GOLD-002_existing_building'].inputs, zakatCase: current });
    assert.equal(report.financial.zakat.status, 'ZAKAT_INPUTS_INVALID');
    assert.equal(report.financial.zakat.layer, null);
  }
  await change('۰'); assert.equal(current.annualAmount, 0);
  assert.equal(validateUserEnteredZakatCase(current).annualAmount, 0);
  await change(''); assert.equal(current, null);
  await React.act(async () => setCurrent({ annualAmount: 250, source: 'ACCOUNTANT' }));
  assert.equal(input().value, '250', 'loading another saved value replaces the raw draft');
  const OperatingFinancialComparison = await load('OperatingFinancialComparison.jsx', [["import React from 'react';", '']], 'OperatingFinancialComparison');
  const { operatingCase, verified } = require('../fixtures/synthetic-collections-case');
  const { createOperatingExpense } = require('../../src/residential-income-acquisition');
  const { createRentalCalendar } = require('../../src/app/rental-calendar-disclosure');
  const operating = JSON.parse(JSON.stringify(operatingCase()));
  operating.operatingExpenses = [createOperatingExpense({ caseId: operating.caseId, expenseId: 'EXP-1', propertyId: 'PROPERTY-1', category: 'MAINTENANCE', basis: 'NORMALIZED', annualAmount: verified('opex', 12000, 'SAR/year', 'evidence://lease/rent') })];
  const context = { mode: 'building', inputs: gold['RE-GOLD-002_existing_building'].inputs, operatingCase: operating };
  const unmatched = buildPersonalFinancialStudy(context);
  await React.act(async () => root.render(React.createElement(OperatingFinancialComparison, { operatingReport: unmatched.operatingReport })));
  assert(document.querySelector('[role=status]').textContent.includes('المقارنة غير متاحة'));
  assert.equal(document.querySelectorAll('table').length, 0, 'no stale comparison shown without calendar alignment');
  const matched = buildPersonalFinancialStudy({ ...context, rentalContext: createRentalCalendar({ studyStartDate: '2026-09-01', locationScope: 'OTHER', leaseCategory: 'RESIDENTIAL', contractReference: '', lastRentReference: '', exceptionReference: '' }) });
  await React.act(async () => root.render(React.createElement(OperatingFinancialComparison, { operatingReport: matched.operatingReport, locale: 'en' })));
  assert(document.body.textContent.includes('Arithmetic reconciliation is complete'));
  const rows = document.querySelector('table').querySelectorAll('tbody tr');
  assert(rows[0].textContent.includes('400,000') && rows[0].textContent.includes('388,000'));
  assert.equal(rows[1].querySelectorAll('td')[0].textContent, '0', 'post-expiry zero rent is shown rather than a renewed stabilized value');
  assert(document.body.textContent.includes('aggregate study returns are unchanged'));
  await React.act(async () => root.unmount()); dom.window.close();
  console.log('ARABIC_MONEY_UI_COMPLETION=PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
