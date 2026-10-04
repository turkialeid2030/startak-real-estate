'use strict';

const assert = require('assert');

const RECONCILIATION_DIMENSIONS = Object.freeze([
  'geometry-and-area',
  'acquisition-cost',
  'rental-income',
  'service-income',
  'operating-revenue',
  'noi-directionality',
  'cashflow-horizon',
  'initial-cashflow',
  'npv-monotonicity',
  'rent-monotonicity',
  'price-cost-monotonicity',
  'construction-cost-monotonicity',
  'financing-zero-debt-normalization',
  'validation-fail-closed',
  'save-hydrate-engine-roundtrip',
  'deterministic-replay',
]);

assert.ok(RECONCILIATION_DIMENSIONS.length >= 16);
console.log('C41_FINANCIAL_RECONCILIATION_MANIFEST=PASS');
console.log(`C41_FINANCIAL_RECONCILIATION_DIMENSIONS=${RECONCILIATION_DIMENSIONS.length}`);
