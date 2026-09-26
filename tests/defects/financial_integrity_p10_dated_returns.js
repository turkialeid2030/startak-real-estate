'use strict';

const assert = require('assert');
const {
  DATED_RETURNS_STATUS,
  normalizeCashflows,
  xnpv,
  solveDatedXirr,
} = require('../../src/valuation-intelligence/dated-returns');

function approx(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}

// 1) Reference annual case under ACT/365.2425.
const annual = [
  { date: '2026-01-01', amount: -1000 },
  { date: '2027-01-01', amount: 1100 },
];
const annualResult = solveDatedXirr({ cashflows: annual });
assert.strictEqual(annualResult.status, DATED_RETURNS_STATUS.QUALIFIED);
approx(annualResult.xirr, 0.10006965697, 1e-8, 'annual XIRR');
assert.ok(Math.abs(xnpv(annualResult.xirr, annual)) <= annualResult.npvToleranceSar);
assert.strictEqual(annualResult.transactionAuthorized, false);
assert.strictEqual(annualResult.humanDecisionRequired, true);

// 2) Irregular real-estate style cash flows: acquisition, interim distribution, exit.
const irregular = [
  { date: '2026-01-01', amount: -1_000_000 },
  { date: '2026-06-30', amount: 300_000 },
  { date: '2026-12-31', amount: 800_000 },
];
const irregularResult = solveDatedXirr({ cashflows: irregular });
assert.strictEqual(irregularResult.status, DATED_RETURNS_STATUS.QUALIFIED);
approx(irregularResult.xirr, 0.11772373795, 1e-8, 'irregular XIRR');
assert.ok(Math.abs(irregularResult.residualNpvSar) <= irregularResult.npvToleranceSar);

// 3) Same-date cash flows are aggregated before solving.
const sameDate = [
  { date: '2026-01-01', amount: -600 },
  { date: '2026-01-01', amount: -400 },
  { date: '2027-01-01', amount: 1100 },
];
const normalized = normalizeCashflows(sameDate);
assert.strictEqual(normalized.length, 2);
assert.strictEqual(normalized[0].amount, -1000);
const sameDateResult = solveDatedXirr({ cashflows: sameDate });
assert.strictEqual(sameDateResult.status, DATED_RETURNS_STATUS.QUALIFIED);
approx(sameDateResult.xirr, annualResult.xirr, 1e-12, 'same-date aggregation XIRR');

// 4) Discount-rate sensitivity must be directionally coherent for conventional cash flows.
const npvAt5 = xnpv(0.05, annual);
const npvAt15 = xnpv(0.15, annual);
assert.ok(npvAt5 > npvAt15);
assert.ok(npvAt5 > 0);
assert.ok(npvAt15 < 0);

// 5) Impossible calendar dates must fail closed, not be normalized by JavaScript Date.
const invalidDate = solveDatedXirr({
  cashflows: [
    { date: '2026-02-30', amount: -1000 },
    { date: '2027-01-01', amount: 1200 },
  ],
});
assert.strictEqual(invalidDate.status, DATED_RETURNS_STATUS.HOLD);
assert.ok(invalidDate.blockers.includes('INVALID_DATED_CASHFLOW'));
assert.ok(Number.isNaN(xnpv(0.1, [
  { date: '2026-02-30', amount: -1000 },
  { date: '2027-01-01', amount: 1200 },
])));

// 6) A single-sign stream cannot produce an investment IRR.
const noSignChange = solveDatedXirr({
  cashflows: [
    { date: '2026-01-01', amount: 100 },
    { date: '2027-01-01', amount: 120 },
  ],
});
assert.strictEqual(noSignChange.status, DATED_RETURNS_STATUS.HOLD);
assert.ok(noSignChange.blockers.includes('CASHFLOW_SIGN_CHANGE_REQUIRED'));

// 7) Multiple net sign changes are economically ambiguous and must not return an arbitrary XIRR.
const multipleIrr = solveDatedXirr({
  cashflows: [
    { date: '2026-01-01', amount: -1000 },
    { date: '2027-01-01', amount: 3000 },
    { date: '2028-01-01', amount: -2200 },
  ],
});
assert.strictEqual(multipleIrr.status, DATED_RETURNS_STATUS.HOLD);
assert.ok(multipleIrr.blockers.includes('MULTIPLE_IRR_AMBIGUITY'));
assert.strictEqual(multipleIrr.xirr, null);

// 8) Solver configuration and root bracketing are explicit fail-closed gates.
const invalidSolver = solveDatedXirr({ cashflows: annual, lowerBound: -1 });
assert.strictEqual(invalidSolver.status, DATED_RETURNS_STATUS.HOLD);
assert.ok(invalidSolver.blockers.includes('SOLVER_CONFIGURATION_INVALID'));

const notBracketed = solveDatedXirr({
  cashflows: [
    { date: '2026-01-01', amount: -1000 },
    { date: '2027-01-01', amount: 5000 },
  ],
  lowerBound: 0,
  upperBound: 0.1,
});
assert.strictEqual(notBracketed.status, DATED_RETURNS_STATUS.HOLD);
assert.ok(notBracketed.blockers.includes('XIRR_ROOT_NOT_BRACKETED'));

// 9) XNPV rejects mathematically invalid discount rates.
assert.ok(Number.isNaN(xnpv(-1, annual)));
assert.ok(Number.isNaN(xnpv(Number.NaN, annual)));

console.log('financial_integrity_p10_dated_returns: PASS');
