'use strict';
const assert=require('node:assert/strict');
const {validateIndependentHoldout:e,calculateResearchErrorMetrics:metric}=require('../../src/market/appraisal-market-validation');
let n=0;function t(x,f){f();n++;console.log('PASS '+x);}
const obs=i=>({propertyRef:'SYN-'+i,assetType:'WAREHOUSE',city:'Riyadh',district:'District',
 predictedValueSar:1000000,executedPriceSar:1100000,
 predictedAsOf:'2026-01-01',executionDate:'2026-04-01',executedTransactionConfirmed:true,
 independentlyVerified:true,reuseRightsVerified:true,
 observationSourceType:'EXECUTED_REAL_ESTATE_TRANSACTION'});
t('pure error arithmetic does not invent sale verification',()=>{
 const m=metric([{predictedValueSar:900,executedPriceSar:1000}]);
 assert.equal(m.maeSar,100);assert.equal(m.mapePct,10);
 assert.throws(()=>metric([{predictedValueSar:0,executedPriceSar:1000}]),/VALUES_INVALID/);
});
t('valuation reports are rejected as ground truth',()=>{
 const r=e({observations:[{...obs(1),observationSourceType:'APPRAISAL_REPORT'}]});
 assert.equal(r.validObservations,0);assert.equal(r.publishableAccuracyClaim,false);
});
t('cross-sample leakage rejected',()=>{
 const r=e({observations:[obs(1)],trainingPropertyRefs:['SYN-1']});
 assert.ok(r.errors[0].reason.includes('PROPERTY_LEAKAGE'));
});
t('future prediction leaks and is rejected',()=>{
 const r=e({observations:[{...obs(1),predictedAsOf:'2026-05-01'}]});
 assert.ok(r.errors[0].reason.includes('TIME_LEAKAGE'));
});
t('unverified rights rejected',()=>{
 const r=e({observations:[{...obs(1),reuseRightsVerified:false}]});
 assert.equal(r.validObservations,0);
});
t('property transaction duplicates rejected',()=>{
 const r=e({observations:[obs(1),obs(1)]});
 assert.equal(r.rejectedObservations,1);
});
t('small sample produces metrics only with insufficient-coverage label',()=>{
 const r=e({observations:[obs(1)]});assert.equal(r.status,'HOLD_INSUFFICIENT_OR_UNVERIFIED_MARKET_EVIDENCE');
 assert.equal(r.overall.maeSar,100000);assert.equal(r.publishableAccuracyClaim,false);
});
t('30 synthetic rows permit research diagnostic but never certified accuracy',()=>{
 const r=e({observations:Array.from({length:30},(_,i)=>obs(i+1))});
 assert.equal(r.status,'RESEARCH_HOLDOUT_CALCULATED_NOT_CERTIFIED');
 assert.ok(Math.abs(r.overall.mapePct-100/11)<1e-10,'floating-point MAPE arithmetic tolerance');
 assert.equal(r.certifiedAppraisalAccuracy,false);
 assert.equal(r.bySectorAndCity['WAREHOUSE|Riyadh'].count,30);
});
t('no observed sale means no validation',()=>{
 const r=e({observations:[]});assert.equal(r.overall,null);assert.equal(r.validObservations,0);
});
console.log('HOLDOUT_TESTS='+n+'/'+n);
