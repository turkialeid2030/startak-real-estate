'use strict';

const assert = require('assert');
const {
  FORMULA_REGISTRY_VERSION,
  getFormula,
} = require('../../src/engines/financial/formula-registry');
const {
  DATED_RETURNS_VERSION,
  xnpv,
  solveDatedXirr,
  DATED_RETURNS_STATUS,
} = require('../../src/valuation-intelligence/dated-returns');

assert.strictEqual(FORMULA_REGISTRY_VERSION, 'REAL_ESTATE_FORMULA_REGISTRY_1.2');
assert.strictEqual(DATED_RETURNS_VERSION, 'DATED_RETURNS_V5');

const xnpvFormula = getFormula('XNPV');
assert.ok(xnpvFormula, 'XNPV formula must exist');
assert.strictEqual(xnpvFormula.dayCount, 'ACT/365.2425');
assert.strictEqual(xnpvFormula.dateFormat, 'YYYY-MM-DD');
assert.ok(xnpvFormula.expression.includes('365.2425'), 'XNPV registry expression must match engine day-count basis');
assert.ok(!/ActualDays_i\s*\/\s*365\)/.test(xnpvFormula.expression), 'XNPV registry must not disclose obsolete ACT/365 denominator');

const xirrFormula = getFormula('XIRR');
assert.ok(xirrFormula, 'XIRR formula must exist');
assert.strictEqual(xirrFormula.dayCount, 'ACT/365.2425');
assert.strictEqual(xirrFormula.dateFormat, 'YYYY-MM-DD');
assert.ok(xirrFormula.expression.includes('ACT/365.2425'), 'XIRR registry expression must identify the engine day-count basis');
assert.ok(xirrFormula.note.includes('rate-bracket convergence'), 'XIRR registry must disclose convergence qualification');

const flows = [
  { date: '2028-01-01', amount: -1000 },
  { date: '2029-01-01', amount: 1100 },
];
const rate = 0.10;
const actualDays = 366;
const expectedAct3652425 = -1000 + 1100 / Math.pow(1 + rate, actualDays / 365.2425);
const obsoleteAct365 = -1000 + 1100 / Math.pow(1 + rate, actualDays / 365);
const engineXnpv = xnpv(rate, flows);
assert.ok(Math.abs(engineXnpv - expectedAct3652425) < 1e-10, 'engine XNPV must match ACT/365.2425 reference');
assert.ok(Math.abs(engineXnpv - obsoleteAct365) > 1e-4, 'test vector must distinguish ACT/365.2425 from obsolete ACT/365');

const xirrResult = solveDatedXirr({ cashflows: flows, npvToleranceSar: 1e-8, tolerance: 1e-12 });
assert.strictEqual(xirrResult.status, DATED_RETURNS_STATUS.QUALIFIED);
assert.strictEqual(xirrResult.dayCount, 'ACT/365.2425');
assert.ok(Number.isFinite(xirrResult.xirr));
assert.ok(Math.abs(xirrResult.residualNpvSar) <= xirrResult.npvToleranceSar);

// Default solver must now converge the rate itself, not stop merely because a loose residual threshold was reached.
const annual = [
  { date: '2026-01-01', amount: -100 },
  { date: '2027-01-01', amount: 110 },
];
const exactAnnualXirr = Math.pow(1.10, 365.2425 / 365) - 1;
const annualDefault = solveDatedXirr({ cashflows: annual });
assert.strictEqual(annualDefault.status, DATED_RETURNS_STATUS.QUALIFIED);
assert.ok(Math.abs(annualDefault.xirr - exactAnnualXirr) <= 1e-9, `default XIRR rate error too large: ${annualDefault.xirr} vs ${exactAnnualXirr}`);
assert.ok(Math.abs(annualDefault.residualNpvSar) <= annualDefault.npvToleranceSar);

console.log('financial_formula_registry_daycount: PASS');
