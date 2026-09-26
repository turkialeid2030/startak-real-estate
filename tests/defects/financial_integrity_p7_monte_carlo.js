'use strict';
const assert=require('assert');
const {runGovernedMonteCarlo,MONTE_CARLO_STATUS,periodicNpv,solvePeriodicIrr}=require('../../src/valuation-intelligence/monte-carlo-risk');
const input={seed:2030,iterations:1000,base:{initialInvestmentSar:10000000,baseNoiSar:800000,horizonYears:5,annualDebtServiceSar:500000},distributions:{noiGrowth:{type:'triangular',min:-.02,mode:.03,max:.06},exitCapRate:{type:'triangular',min:.07,mode:.08,max:.1},discountRate:{type:'triangular',min:.08,mode:.1,max:.13}},thresholds:{hurdleIrr:.08,minDscr:1.25,maxProbabilityNpvNegative:.35,maxProbabilityIrrBelowHurdle:.5,maxProbabilityDscrBreach:.25}};
const a=runGovernedMonteCarlo(input),b=runGovernedMonteCarlo(input);
assert.notStrictEqual(a.status,MONTE_CARLO_STATUS.HOLD);
assert.deepStrictEqual(a.summary,b.summary);
assert.strictEqual(a.seed,2030);assert.strictEqual(a.iterations,1000);
assert.strictEqual(a.summary.irr.method,'EXACT_PERIODIC_IRR');
assert.ok(a.summary.npvSar.p05<=a.summary.npvSar.p50&&a.summary.npvSar.p50<=a.summary.npvSar.p95);
assert.ok(a.summary.irr.p05<=a.summary.irr.p50&&a.summary.irr.p50<=a.summary.irr.p95);
assert.ok(a.summary.irr.probabilityBelowHurdle>=0&&a.summary.irr.probabilityBelowHurdle<=1);
assert.ok(a.summary.dscr.probabilityBelowMinimum>=0&&a.summary.dscr.probabilityBelowMinimum<=1);

const periodic=[-1000,0,0,1331];
const exact=solvePeriodicIrr(periodic);
assert.ok(Math.abs(exact-.1)<1e-10);
assert.ok(Math.abs(periodicNpv(exact,periodic))<1e-6);

assert.strictEqual(runGovernedMonteCarlo({...input,seed:null}).status,MONTE_CARLO_STATUS.HOLD);
assert.strictEqual(runGovernedMonteCarlo({...input,iterations:10}).status,MONTE_CARLO_STATUS.HOLD);
assert.strictEqual(runGovernedMonteCarlo({...input,base:{...input.base,annualDebtServiceSar:-1}}).status,MONTE_CARLO_STATUS.HOLD);
assert.strictEqual(runGovernedMonteCarlo({...input,thresholds:{...input.thresholds,hurdleIrr:-1}}).status,MONTE_CARLO_STATUS.HOLD);
assert.strictEqual(runGovernedMonteCarlo({...input,thresholds:{...input.thresholds,maxProbabilityIrrBelowHurdle:undefined}}).status,MONTE_CARLO_STATUS.HOLD);
const invalidDraw=runGovernedMonteCarlo({...input,distributions:{...input.distributions,noiGrowth:{type:'fixed',value:-1}}});
assert.strictEqual(invalidDraw.status,MONTE_CARLO_STATUS.HOLD);
console.log('financial_integrity_p7_monte_carlo: PASS');
