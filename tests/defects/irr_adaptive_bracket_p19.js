'use strict';

const assert = require('assert/strict');
const financial = require('../../src/engines/financial');
const precision = require('../../src/engines/financial/precision');

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected} within ${tolerance}`);
}

// Closed-form one-period reference:
// -100 + 2100/(1+r) = 0  =>  r = 20 (2000%).
// This is above the old fixed +1000% solver endpoint and must now be solved.
const highReturn = [-100, 2100];
close(precision.preciseIRR(highReturn), 20, 1e-10, '2000% closed-form IRR');
close(financial.computeIRR(highReturn), 20, 1e-10, 'canonical computeIRR 2000%');
const highDiag = financial.analyzeIRR(highReturn);
assert.equal(highDiag.reliability, financial.IRR_RELIABILITY.RELIABLE);
assert.equal(highDiag.reasonCode, null);
close(highDiag.irr, 20, 1e-10, 'diagnostic 2000% IRR');

// A much larger but still governed conventional return remains computable.
// -1 + 100001/(1+r) = 0  =>  r = 100000. The 5e-6 absolute tolerance is
// intentionally tied to the solver's fixed 10-decimal NPV lattice at this
// extreme scale; it is not a relaxation of the financial formula.
const extremeButSupported = [-1, 100001];
close(precision.preciseIRR(extremeButSupported), 100000, 5e-6, '100000x one-period IRR');
const extremeDiag = financial.analyzeIRR(extremeButSupported);
assert.equal(extremeDiag.reliability, financial.IRR_RELIABILITY.RELIABLE);

// Caller-supplied brackets remain authoritative; automatic expansion applies
// only to the canonical default bracket and must not rewrite an explicit bound.
assert.ok(Number.isNaN(precision.preciseIRR(highReturn, { hi: 10 })),
  'explicit caller hi=10 must remain bounded');

// The auto-search is intentionally bounded. This one-period root is above the
// governed MAX_AUTO_IRR_HI and must remain an explicit out-of-range state.
const beyondGovernedCeiling = [-1, 2_000_002]; // r = 2,000,001
assert.ok(Number.isNaN(precision.preciseIRR(beyondGovernedCeiling)));
const beyondDiag = financial.analyzeIRR(beyondGovernedCeiling);
assert.equal(beyondDiag.reliability, financial.IRR_RELIABILITY.OUT_OF_SOLVER_RANGE);
assert.equal(beyondDiag.reasonCode, 'IRR_OUTSIDE_SOLVER_BRACKET');

// Ordinary institutional-scale returns remain unchanged.
close(precision.preciseIRR([-100, 110]), 0.1, 1e-10, 'ordinary 10% IRR');

// Non-conventional cash flows retain the multiple-root diagnostic boundary and
// are not converted into a single supposedly reliable IRR by the new expansion.
const multipleRoot = [-100, 230, -132];
const multipleDiag = financial.analyzeIRR(multipleRoot, { financeRate: 0.1, reinvestRate: 0.1 });
assert.equal(multipleDiag.multipleRootRisk, true);
assert.equal(multipleDiag.reliability, financial.IRR_RELIABILITY.MULTIPLE_ROOT_RISK);
assert.equal(multipleDiag.reasonCode, 'NON_CONVENTIONAL_CASHFLOW_MULTIPLE_IRR_POSSIBLE');

assert.equal(precision.DEFAULT_IRR_HI, 10);
assert.equal(precision.MAX_AUTO_IRR_HI, 1_000_000);
console.log('IRR_ADAPTIVE_BRACKET_P19=PASS');
