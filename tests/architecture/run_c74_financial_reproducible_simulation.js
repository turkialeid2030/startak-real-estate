'use strict';
// C74: deterministic, synthetic stress and independent arithmetic oracle.
// This tests engineering behavior, never Saudi market prediction accuracy.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {mkdirSync,writeFileSync}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {
 runGovernedMonteCarlo,MONTE_CARLO_STATUS,periodicNpv,solvePeriodicIrr,
}=require('../../src/valuation-intelligence/monte-carlo-risk');
const ROOT=path.resolve(__dirname,'../..');
const EVIDENCE=path.join(ROOT,'runtime-evidence','c74');
mkdirSync(EVIDENCE,{recursive:true});
const seeds=[101,2030,4096,20260901,20261008,314159,8675309,4294967295];
let seededCases=0;
for(const seed of seeds){
 const run=spawnSync(process.execPath,['tests/architecture/run_financial_metamorphic_stress_v1.js'],{
  cwd:ROOT,encoding:'utf8',timeout:120000,
  env:{...process.env,TEST_SEED:String(seed)},
 });
 assert.equal(run.status,0,`metamorphic financial seed ${seed}: ${run.error||run.stderr||run.stdout}`);
 assert.match(run.stdout,/FINANCIAL_METAMORPHIC_STRESS_V1=PASS/);
 seededCases+=80;
}
function near(a,b,epsilon=1e-5){
 return Math.abs(a-b)<=Math.max(epsilon,Math.abs(b)*1e-9);
}
const base={initialInvestmentSar:10000000,baseNoiSar:800000,horizonYears:7,annualDebtServiceSar:550000};
const thresholds={
 hurdleIrr:0.09,minDscr:1.2,maxProbabilityNpvNegative:0.35,
 maxProbabilityIrrBelowHurdle:0.5,maxProbabilityDscrBreach:0.25,
};
const configurations=[
 {name:'downside',growth:-0.05,exitCap:0.12,discount:0.15},
 {name:'base',growth:0.02,exitCap:0.08,discount:0.10},
 {name:'upside',growth:0.06,exitCap:0.06,discount:0.07},
];
const records=[];
for(const [index,s] of configurations.entries()){
 const input={seed:314159+index,iterations:3000,base,thresholds,
  distributions:{
   noiGrowth:{type:'fixed',value:s.growth},
   exitCapRate:{type:'fixed',value:s.exitCap},
   discountRate:{type:'fixed',value:s.discount},
  }};
 const first=runGovernedMonteCarlo(input),repeat=runGovernedMonteCarlo(input);
 assert.notEqual(first.status,MONTE_CARLO_STATUS.HOLD,`${s.name}: simulation incorrectly held`);
 assert.deepEqual(first.summary,repeat.summary,'same seed and input must produce identical report');
 const cashflows=[-base.initialInvestmentSar];
 let noi=base.baseNoiSar,minDscr=Infinity;
 for(let y=1;y<=base.horizonYears;y++){
  noi*=1+s.growth;
  minDscr=Math.min(minDscr,noi/base.annualDebtServiceSar);
  cashflows.push(noi+(y===base.horizonYears?noi/s.exitCap:0));
 }
 // Independent present-value arithmetic, not a result copied from the engine.
 const independentNpv=cashflows.reduce((acc,cf,y)=>acc+cf/((1+s.discount)**y),0);
 const independentIrr=solvePeriodicIrr(cashflows);
 assert.ok(independentIrr!==null,'IRR must be bracketed for the synthetic fixed case');
 assert.ok(near(first.summary.npvSar.p50,independentNpv),`${s.name}: independent NPV mismatch`);
 assert.ok(near(first.summary.npvSar.p50,periodicNpv(s.discount,cashflows)),`${s.name}: periodic NPV mismatch`);
 assert.ok(Math.abs(periodicNpv(independentIrr,cashflows))<0.01,`${s.name}: IRR does not zero NPV`);
 assert.ok(near(first.summary.irr.p50,independentIrr,1e-8),`${s.name}: IRR mismatch`);
 assert.ok(near(first.summary.dscr.p50,minDscr,1e-8),`${s.name}: DSCR mismatch`);
 for(const key of ['npvSar','irr','dscr']){
  const p=first.summary[key];
  assert.ok(near(p.p05,p.p50,1e-7)&&near(p.p95,p.p50,1e-7),
   `${s.name}: fixed distributions should give identical quantiles`);
 }
 assert.equal(first.iterations,3000);
 assert.equal(first.summary.irr.method,'EXACT_PERIODIC_IRR');
 assert.equal(first.blockers.length,0);
 assert.equal(first.summary.npvSar.probabilityNegative,independentNpv< -first.numericalTolerances.npvClassificationToleranceSar?1:0);
 records.push({scenario:s.name,seed:input.seed,iterations:first.iterations,status:first.status,
  npvMedianSar:first.summary.npvSar.p50,irrMedian:first.summary.irr.p50,
  dscrMedian:first.summary.dscr.p50,flags:first.warnings});
}
// Genuinely stochastic triangular distributions; fixed-seed reproducibility
// and first-order scenario ordering, without implying market-calibrated forecasts.
const stochastic=[
 {name:'downside',growth:[-.10,-.05,0],cap:[.10,.12,.14],disc:[.13,.16,.19]},
 {name:'base',growth:[-.02,.02,.06],cap:[.07,.08,.10],disc:[.08,.10,.12]},
 {name:'upside',growth:[.02,.06,.10],cap:[.05,.06,.07],disc:[.05,.07,.09]},
];
const stochasticRecords=[];
for(const config of stochastic){
 const tri=([min,mode,max])=>({type:'triangular',min,mode,max});
 const input={seed:20261008,iterations:5000,base,thresholds,
  distributions:{noiGrowth:tri(config.growth),exitCapRate:tri(config.cap),discountRate:tri(config.disc)}};
 const a=runGovernedMonteCarlo(input),b=runGovernedMonteCarlo(input);
 assert.notEqual(a.status,MONTE_CARLO_STATUS.HOLD,config.name+' stochastic draw must not be HOLD');
 assert.deepEqual(a.summary,b.summary,config.name+' seeded stochastic replay must match');
 for(const key of ['npvSar','irr','dscr']){
  const q=a.summary[key];
  assert.ok(q.p05<q.p50&&q.p50<q.p95,config.name+' distributions must produce nondegenerate ordered quantiles '+key);
 }
 for(const p of [a.summary.npvSar.probabilityNegative,
  a.summary.irr.probabilityBelowHurdle,a.summary.dscr.probabilityBelowMinimum])
  assert.ok(p>=0&&p<=1,'stochastic risk probability in [0,1]');
 stochasticRecords.push({scenario:config.name,iterations:a.iterations,
  npvP05Sar:a.summary.npvSar.p05,npvP50Sar:a.summary.npvSar.p50,npvP95Sar:a.summary.npvSar.p95,
  irrP50:a.summary.irr.p50,negativeNpvProbability:a.summary.npvSar.probabilityNegative,
  dscrBreachProbability:a.summary.dscr.probabilityBelowMinimum,status:a.status});
}
assert.ok(stochasticRecords[0].npvP50Sar<stochasticRecords[1].npvP50Sar&&
 stochasticRecords[1].npvP50Sar<stochasticRecords[2].npvP50Sar,
 'stochastic downside/base/upside median NPV must be ordered');
assert.ok(stochasticRecords[0].irrP50<stochasticRecords[1].irrP50&&
 stochasticRecords[1].irrP50<stochasticRecords[2].irrP50,
 'stochastic downside/base/upside median IRR must be ordered');
const alternate=runGovernedMonteCarlo({
 seed:20261009,iterations:5000,base,thresholds,
 distributions:{noiGrowth:{type:'triangular',min:-.02,mode:.02,max:.06},
 exitCapRate:{type:'triangular',min:.07,mode:.08,max:.10},
 discountRate:{type:'triangular',min:.08,mode:.10,max:.12}},
});
assert.notEqual(alternate.status,MONTE_CARLO_STATUS.HOLD);
assert.notEqual(alternate.summary.npvSar.p50,stochasticRecords[1].npvP50Sar,
 'different seeded random streams should produce different central estimators');
assert.ok(records[0].npvMedianSar<records[1].npvMedianSar,'downside NPV must be worse than base');
assert.ok(records[1].npvMedianSar<records[2].npvMedianSar,'upside NPV must exceed base');
assert.ok(records[0].irrMedian<records[1].irrMedian&&records[1].irrMedian<records[2].irrMedian,
 'scenario economic ordering must hold');
const invalid=[
 {seed:null},{iterations:0},{base:{...base,initialInvestmentSar:0}},
 {distributions:{noiGrowth:{type:'fixed',value:-1},
  exitCapRate:{type:'fixed',value:0.08},discountRate:{type:'fixed',value:0.10}}},
 {thresholds:{...thresholds,maxProbabilityDscrBreach:1.2}},
];
const valid={seed:2030,iterations:1000,base,thresholds,
 distributions:{noiGrowth:{type:'fixed',value:.02},exitCapRate:{type:'fixed',value:.08},discountRate:{type:'fixed',value:.10}}};
for(const override of invalid){
 const output=runGovernedMonteCarlo({...valid,...override});
 assert.equal(output.status,MONTE_CARLO_STATUS.HOLD,'invalid model inputs must fail closed');
 assert.equal(output.summary,null);
}
const summary={schemaVersion:1,qualification:'SYNTHETIC_ENGINEERING_ONLY',
 seeds,financialLandCases:seededCases/2,financialBuildingCases:seededCases/2,
 scenarios:records,scenarioDraws:records.reduce((a,r)=>a+r.iterations,0),
 stochasticScenarios:stochasticRecords,stochasticDraws:15000,
 adversarialInvalidCases:invalid.length,
 sourceAuthentication:false,realSaudiHoldoutValidated:false,
 certifiedValuation:false,productionAuthorized:false};
const json=JSON.stringify(summary,null,2)+'\n';
writeFileSync(path.join(EVIDENCE,'financial-simulation.json'),json);
console.log(`C74_FINANCIAL_REPRODUCIBLE_SIMULATION=PASS engine_cases=${seededCases} fixed_draws=${summary.scenarioDraws} stochastic_draws=${summary.stochasticDraws} invalid_cases=${invalid.length}`);
console.log('C74_REAL_MARKET_FORECAST_VALIDATION=FALSE');
console.log('C74_INDEPENDENT_PROFESSIONAL_VALUATION=FALSE');
console.log('C74_EVIDENCE_SHA256='+createHash('sha256').update(json).digest('hex'));
