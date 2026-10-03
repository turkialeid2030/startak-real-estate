'use strict';

const assert = require('assert');
const {
  computeIRR,
  analyzeIRR,
  IRR_RELIABILITY,
} = require('../../src/engines/financial');

const noSignChange = [-100, -10, -1];
const noRootDiagnostic = analyzeIRR(noSignChange);
assert.strictEqual(noRootDiagnostic.reliability, IRR_RELIABILITY.NOT_COMPUTABLE);
assert.strictEqual(noRootDiagnostic.reasonCode, 'NO_SIGN_CHANGE_NO_IRR_EXISTS');
assert.ok(Number.isNaN(computeIRR(noSignChange)), 'no-root IRR must remain governed NaN, not throw');

// One conventional sign change, but the economic root is above the governed
// +1,000,000 solver ceiling. This is an intentional OUT_OF_SOLVER_RANGE state,
// not numeric corruption and must be decision-fail-closed without an exception.
const outsideGovernedBracket = [-100, 200_000_000];
const outOfRangeDiagnostic = analyzeIRR(outsideGovernedBracket);
assert.strictEqual(outOfRangeDiagnostic.reliability, IRR_RELIABILITY.OUT_OF_SOLVER_RANGE);
assert.strictEqual(outOfRangeDiagnostic.reasonCode, 'IRR_OUTSIDE_SOLVER_BRACKET');
assert.ok(Number.isNaN(computeIRR(outsideGovernedBracket)), 'out-of-range IRR must remain governed NaN, not throw');

console.log('C41_GOVERNED_NONCOMPUTABLE_IRR=PASS');
console.log('C41_IRR_NO_ROOT_FAIL_CLOSED=PASS');
console.log('C41_IRR_OUT_OF_SOLVER_RANGE_FAIL_CLOSED=PASS');
