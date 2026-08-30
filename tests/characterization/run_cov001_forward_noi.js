// tests/characterization/run_cov001_forward_noi.js -- PERMANENT executable
// test for COV-001. Neither existing RE-GOLD fixture exercises a non-zero
// growth rate for Existing Building, so no prior test could catch a future
// accidental change to its exit-value convention. This test closes that gap
// directly: it asserts the Forward NOI relationship mathematically, using a
// non-zero growth rate and holdPeriod>1, independent of any fixture file.
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const gold = require(require('../config/paths').getGoldBaselinePath());

const B = gold['RE-GOLD-002_existing_building'].inputs;
const inputs = { ...B, rentGrowthRate: 0.03, holdPeriod: 5, leverageEnabled: false };

const result = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs, leverageEnabled: false });

// Independently recompute NOI_N (the terminal year's NOI before any exit-step growth)
let noiYear = result.NOI;
for (let y = 1; y <= inputs.holdPeriod; y++) if (y > 1) noiYear *= (1 + inputs.rentGrowthRate);
const NOI_N = noiYear;

// Recover the implied exit (sale) value from the final cashflow entry:
// cashflows[last] = noiYear + netSaleProceeds, netSaleProceeds = saleValue*(1-transferFeeRate)
const cashflowsLast = result.cashflows[result.cashflows.length - 1];
const impliedSaleValue = (cashflowsLast - NOI_N) / (1 - inputs.transferFeeRate);

const expectedForwardSaleValue = (NOI_N * (1 + inputs.rentGrowthRate)) / inputs.marketCapRate;
const terminalToNOIRatio = impliedSaleValue > 0 ? (impliedSaleValue * inputs.marketCapRate) / NOI_N : null;

const results = [];
function assert(id, cond, detail) { results.push({ id, status: cond ? 'PASS' : 'FAIL', detail }); console.log(`${id}: ${cond ? 'PASS' : 'FAIL'} -- ${detail}`); }

assert('COV-001-POSITIVE-GROWTH', inputs.rentGrowthRate > 0, `rentGrowthRate=${inputs.rentGrowthRate}`);
assert('COV-001-HOLDING-PERIOD-GT-1', inputs.holdPeriod > 1, `holdPeriod=${inputs.holdPeriod}`);
assert('COV-001-FORWARD-NOI-ASSERTION', Math.abs(impliedSaleValue - expectedForwardSaleValue) < 1,
  `implied saleValue=${impliedSaleValue.toFixed(2)} expected(forward)=${expectedForwardSaleValue.toFixed(2)}`);
assert('COV-001-RATIO-CHECK', Math.abs(terminalToNOIRatio - (1 + inputs.rentGrowthRate)) < 1e-6,
  `terminal/NOI_N ratio=${terminalToNOIRatio.toFixed(4)} expected=${(1+inputs.rentGrowthRate).toFixed(4)}`);

const allPass = results.every(r => r.status === 'PASS');
console.log('');
console.log('COV_001_TEST_EXISTS=true (this file)');
console.log('COV_001_POSITIVE_GROWTH=' + (inputs.rentGrowthRate > 0));
console.log('COV_001_HOLDING_PERIOD_GT_1=' + (inputs.holdPeriod > 1));
console.log('COV_001_FORWARD_NOI_ASSERTION=' + (Math.abs(impliedSaleValue - expectedForwardSaleValue) < 1));
console.log('COV_001_TEST=' + (allPass ? 'PASS' : 'FAIL'));
process.exit(allPass ? 0 : 1);
