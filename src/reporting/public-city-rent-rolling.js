'use strict';
// Retrospective rolling-origin diagnostics on CITY aggregates only.
// The adapter uses an explicit non-geographic sentinel; never mix with district data.
const {backtestAggregates}=require('./public-rent-aggregate-backtest');
const round=x=>Math.round(x*100)/100;
const models=['PRIOR_QUARTER','SEASONAL_NAIVE','FOUR_QUARTER_MEDIAN'];
function summarize(periods){
 const n=periods.reduce((s,r)=>s+r.commonCohort,0),eligible=periods.reduce((s,r)=>s+r.actualEligible,0);
 return {n,eligible,coveragePct:eligible?round(100*n/eligible):null,metricsApproximateFromRoundedQuarterlyResults:true,models:models.map((model,i)=>({model,...Object.fromEntries(['mae','mapePct','bias','within20Pct'].map(k=>[k,n?round(periods.reduce((s,r)=>s+(r.commonCohort?r.models[i][k]*r.commonCohort:0),0)/n):null]))}))};
}
function evaluateCityRolling(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>100000||rows.some(r=>!r||r.geographyLevel!=='CITY'||!Number.isInteger(r.year)||r.year<2019||r.year>2024||![1,2,3,4].includes(r.quarter)||!['region','city','category'].every(k=>typeof r[k]==='string'&&r[k].trim())||!Number.isSafeInteger(r.reportedDealCount)||r.reportedDealCount<1||typeof r.reportedAverageSar!=='number'||!Number.isFinite(r.reportedAverageSar)||r.reportedAverageSar<=0||r.propertyEstimateEligible!==false))throw Error('CITY_ROLLING_SCOPE');
 const adapted=rows.map(r=>({year:r.year,quarter:r.quarter,region:r.region,city:r.city,district:'CITY_AGGREGATE_SCOPE_ONLY',kind:r.category,classification:'CITY_CATEGORY_AS_REPORTED',count:r.reportedDealCount,reportedRentSar:r.reportedAverageSar}));
 const quarters=[];
 for(let year=2020;year<=2024;year++)for(let quarter=1;quarter<=4;quarter++)quarters.push(backtestAggregates(adapted,{year,quarter,metric:'reportedRentSar'}));
 const development=summarize(quarters.slice(0,16)),holdout=summarize(quarters.slice(16));
 const ranked=development.models.filter(x=>x.mapePct!==null).sort((a,b)=>a.mapePct-b.mapePct||a.model.localeCompare(b.model));
 return {version:1,geographyLevel:'CITY',status:'RETROSPECTIVE_TEMPORAL_DIAGNOSTIC',rows:rows.length,developmentPeriod:'2020–2023',holdoutPeriod:'2024',quarters,development,holdout,developmentMapeCandidate:ranked[0]?.model??null,productionModelSelected:false,independentSourceValidation:false,propertyAvmQualified:false,financialInputEligible:false};
}
module.exports={evaluateCityRolling};
