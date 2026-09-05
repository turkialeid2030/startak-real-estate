'use strict';

const assert = require('assert');
const {
  DEFAULT_UNAVAILABLE,
  isFiniteNumber,
  formatNumber,
  formatInteger,
  formatSar,
  formatSignedSar,
  formatPercent,
  formatYears,
  formatMultiple,
  buildExitDependentMetricPresentation,
} = require('../../src/assumptions/ui-safe-formatters');

function run() {
  assert.strictEqual(isFiniteNumber(0), true);
  assert.strictEqual(isFiniteNumber(null), false);
  assert.strictEqual(isFiniteNumber(undefined), false);
  assert.strictEqual(isFiniteNumber(NaN), false);
  assert.strictEqual(isFiniteNumber(Infinity), false);
  assert.strictEqual(isFiniteNumber('0'), false);

  for (const value of [null, undefined, NaN, Infinity, -Infinity, '0']) {
    assert.strictEqual(formatNumber(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatInteger(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatSar(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatSignedSar(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatPercent(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatYears(value), DEFAULT_UNAVAILABLE);
    assert.strictEqual(formatMultiple(value), DEFAULT_UNAVAILABLE);
  }

  assert.strictEqual(formatInteger(1234.6), '1,235');
  assert.strictEqual(formatSar(1234.6), '1,235 ريال');
  assert.strictEqual(formatSignedSar(-1234.6), '-1,235 ريال');
  assert.strictEqual(formatPercent(0.075), '7.50%');
  assert.strictEqual(formatYears(5), '5.0 سنة');
  assert.strictEqual(formatMultiple(1.234), '1.23x');
  assert.strictEqual(formatPercent(null, { fallback: 'N/A' }), 'N/A');

  const incomplete = buildExitDependentMetricPresentation({
    terminalSaleValue: null,
    terminalNetSaleProceeds: null,
    irr: null,
    npv: null,
    leveredIRR: null,
    leveredNPV: null,
    exitDependentAnalyticsReady: false,
    financialModelStatus: 'INCOMPLETE_INPUTS',
  });
  assert.strictEqual(incomplete.terminalSaleValue, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.terminalNetSaleProceeds, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.irr, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.npv, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.leveredIRR, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.leveredNPV, DEFAULT_UNAVAILABLE);
  assert.strictEqual(incomplete.exitDependentAnalyticsReady, false);
  assert.strictEqual(incomplete.financialModelStatus, 'INCOMPLETE_INPUTS');
  assert.strictEqual(incomplete.transactionAuthorized, false);

  const complete = buildExitDependentMetricPresentation({
    terminalSaleValue: 1000000,
    terminalNetSaleProceeds: 950000,
    irr: 0.12,
    npv: 125000,
    leveredIRR: 0.15,
    leveredNPV: 150000,
    exitDependentAnalyticsReady: true,
    financialModelStatus: 'VALID',
  });
  assert.strictEqual(complete.terminalSaleValue, '1,000,000 ريال');
  assert.strictEqual(complete.terminalNetSaleProceeds, '950,000 ريال');
  assert.strictEqual(complete.irr, '12.00%');
  assert.strictEqual(complete.npv, '125,000 ريال');
  assert.strictEqual(complete.leveredIRR, '15.00%');
  assert.strictEqual(complete.leveredNPV, '150,000 ريال');
  assert.strictEqual(complete.exitDependentAnalyticsReady, true);
  assert.strictEqual(complete.transactionAuthorized, false);

  console.log('WAVE2_UI_NULL_NOT_ZERO=PASS');
  console.log('WAVE2_UI_SAFE_FORMATTERS=PASS');
  console.log('WAVE2_UI_INCOMPLETE_PRESENTATION=PASS');
  console.log('WAVE2_UI_PRESENTATION_NO_TRANSACTION_AUTHORITY=PASS');
}

run();
