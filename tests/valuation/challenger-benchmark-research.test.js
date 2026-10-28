'use strict';
const assert=require('node:assert/strict');
const {parseChallengerCsv,evaluateChallengers,MODEL_IDS}=
 require('../../src/market/challenger-benchmark-research');
let n=0;function test(label,f){f();n++;console.log('PASS '+label);}
const fields='modelId,propertyRef,assetType,city,district,predictedAsOf,predictedValueSar,executedPriceSar,executionDate,runCostSar';
const samples=()=>Array.from({length:30},(_,i)=>{
 const propertyRef='SYN-RE-'+i,actual=1000000+i*10000;
 return ['STARTAK','BAYUT_TRUVALUE','GREM_AI'].map((modelId,j)=>({
  modelId,propertyRef,assetType:'RESIDENTIAL_VILLA',city:'الرياض',district:'الملقا',
  predictedAsOf:'2026-06-01',executionDate:'2026-07-01',
  predictedValueSar:actual+[-20000,30000,50000][j],executedPriceSar:actual,
  runCostSar:10+j*5}));
}).flat();
test('zero observations fail without accuracy claims',()=>{
 const r=evaluateChallengers();
 assert.equal(r.status,'HOLD_INCOMPLETE_OR_UNBALANCED_COHORT');
 assert.equal(r.publishableAccuracyClaim,false);
});
test('fair cohort of 30 properties can be scored mathematically for all models',()=>{
 const r=evaluateChallengers({observations:samples()});
 assert.equal(r.cohortSize,30);
 assert.equal(Object.keys(r.metricsByModel).length,3);
 assert.equal(r.status,'RESEARCH_MATH_ONLY_EXTERNAL_VERIFICATION_REQUIRED');
 assert.equal(r.metricsByModel.STARTAK.sampleSize,30);
 assert.equal(r.independentMarketEvidenceVerified,false);
 assert.equal(r.rankingAuthorized,false);
});
test('cost per correctly completed task accounts for all attempts',()=>{
 const r=evaluateChallengers({observations:samples()});
 assert.equal(r.metricsByModel.STARTAK.costPerCorrectCompletedTaskSar,10);
 assert.equal(r.metricsByModel.GREM_AI.costPerCorrectCompletedTaskSar,20);
});
test('model with only 29 cases cannot be compared as fair shared set',()=>{
 const s=samples().filter(x=>x.modelId!=='GREM_AI'||x.propertyRef!=='SYN-RE-0');
 const r=evaluateChallengers({observations:s});
 assert.ok(r.reasons.some(x=>x.code==='MODELS_USE_DIFFERENT_COHORTS'));
 assert.equal(Object.keys(r.metricsByModel).length,0);
});
test('same case with contradictory recorded sale price is blocked',()=>{
 const s=samples();s[1]={...s[1],executedPriceSar:s[1].executedPriceSar+100};
 const r=evaluateChallengers({observations:s});
 assert.ok(r.reasons.some(x=>x.code==='INCONSISTENT_EXECUTED_LABEL'));
});
test('training property leakage is rejected',()=>{
 const r=evaluateChallengers({observations:samples(),trainingPropertyRefs:['SYN-RE-10']});
 assert.ok(r.reasons.some(x=>x.code==='INVALID_OBSERVATION_OR_TIME_LEAKAGE'));
});
test('predicted dates after sale are rejected',()=>{
 const s=samples();s[0]={...s[0],predictedAsOf:'2026-08-01'};
 const r=evaluateChallengers({observations:s});
 assert.equal(r.status,'HOLD_INCOMPLETE_OR_UNBALANCED_COHORT');
});
test('missing provider and insufficient sample cannot produce metrics',()=>{
 const s=samples().filter(x=>x.modelId==='STARTAK');
 assert.equal(evaluateChallengers({observations:s}).metricsByModel.STARTAK,undefined);
 assert.equal(evaluateChallengers({observations:samples().slice(0,50)}).metricsByModel.STARTAK,undefined);
});
test('CSV parser rejects ambiguous number and accepts Arabic decimal',()=>{
 const rows=[fields,'STARTAK,SYN-X,LAND,الرياض,الملقا,2026-06-01,"1,2",100000,2026-07-01,5'];
 const z=parseChallengerCsv(rows.join('\n'));assert.equal(z.records.length,0);
 const a=parseChallengerCsv([fields,'STARTAK,SYN-X,LAND,الرياض,الملقا,2026-06-01,١٠٠٠٫٥,100000,2026-07-01,5'].join('\n'));
 assert.equal(a.records.length,1);assert.equal(a.records[0].predictedValueSar,1000.5);
});
test('the same property across thirty time snapshots is not 30 independent subjects',()=>{
 const all=Array.from({length:30},(_,i)=>['STARTAK','GREM_AI'].map((modelId,j)=>({
  modelId,propertyRef:'SINGLE-PROPERTY',assetType:'LAND',city:'الرياض',district:'الملقا',
  predictedAsOf:'2025-01-'+String(i+1).padStart(2,'0'),
  executionDate:'2025-02-'+String(i+1).padStart(2,'0'),
  predictedValueSar:1000000+j*10000,executedPriceSar:1000000,
  runCostSar:10
 }))).flat();
 const r=evaluateChallengers({observations:all});
 assert.ok(r.reasons.some(x=>x.code==='MINIMUM_DISTINCT_PROPERTY_COUNT_NOT_MET'));
 assert.ok(r.reasons.some(x=>x.code==='REPEATED_PROPERTY_WITH_DIFFERENT_CASE_DATE'));
 assert.equal(Object.keys(r.metricsByModel).length,0);
});
test('invalid confidence intervals are rejected, complete interval gives illustrative coverage',()=>{
 const rows=samples().map(r=>({...r,rangeLowSar:r.executedPriceSar-100000,
  rangeHighSar:r.executedPriceSar+100000}));
 const r=evaluateChallengers({observations:rows});
 assert.equal(r.metricsByModel.STARTAK.indicativeIntervalCoveragePct,100);
 assert.equal(r.independentMarketEvidenceVerified,false);
 const bad=rows.map(x=>({...x}));bad[0].rangeHighSar=null;
 assert.ok(evaluateChallengers({observations:bad}).reasons.some(x=>x.code==='INVALID_OBSERVATION_OR_TIME_LEAKAGE'));
 const cols=fields+',rangeLowSar,rangeHighSar';
 const c=parseChallengerCsv([cols,
  'STARTAK,SYN-1,LAND,الرياض,الملقا,2026-06-01,1000000,1000000,2026-07-01,1,1200000,1300000'
 ].join('\n'));
 assert.equal(c.records.length,0);
});
test('CSV only allows named model providers and never declares verified prices',()=>{
 const invalid=parseChallengerCsv([fields,'FAKE,SYN-X,LAND,الرياض,الملقا,2026-06-01,100000,100000,2026-07-01,5'].join('\n'));
 assert.equal(invalid.records.length,0);assert.equal(invalid.verifiedExecutedLabels,0);
 assert.ok(MODEL_IDS.includes('BAYUT_TRUVALUE'));
});
console.log('CHALLENGER_SAME_COHORT_SANDBOX_TESTS='+n+'/'+n);
