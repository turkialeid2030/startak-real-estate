'use strict';
// Forecast/backtest of published district aggregate metrics, NOT an individual-property AVM.
const norm=s=>String(s??'').trim().replace(/[أإآٱ]/g,'ا').replace(/\s+/g,' ').toLowerCase();
const fields=['region','city','district','kind','classification'];
const key=r=>JSON.stringify(fields.map(k=>norm(r[k])));
const valid=(r,metric)=>r&&fields.every(k=>norm(r[k]))&&Number.isSafeInteger(r.count)&&r.count>=3&&typeof r[metric]==='number'&&Number.isFinite(r[metric])&&r[metric]>0;
const index=(r)=>r.year*4+r.quarter-1;
function buildIndex(rows){
 const groups=new Map();
 for(const r of rows){
  if(!Number.isInteger(r.year)||r.year<2000||r.year>2099||![1,2,3,4].includes(r.quarter)||!fields.every(k=>norm(r[k])))continue;
  const k=key(r),t=index(r);if(!groups.has(k))groups.set(k,new Map());const periods=groups.get(k);
  if(!periods.has(t))periods.set(t,[]);periods.get(t).push(r);
 }
 return groups;
}
function single(periods,t,metric){const a=periods.get(t);return a?.length===1&&valid(a[0],metric)?a[0][metric]:null;}
const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
function predictions(periods,t,metric){
 const prior=single(periods,t-1,metric),seasonal=single(periods,t-4,metric);
 const last4=[1,2,3,4].map(d=>single(periods,t-d,metric));
 return {PRIOR_QUARTER:prior,SEASONAL_NAIVE:seasonal,FOUR_QUARTER_MEDIAN:last4.every(x=>x!==null)?median(last4):null};
}
const round=x=>Math.round(x*100)/100;
function backtestAggregates(rows,{year,quarter,metric}={}){
 if(!Array.isArray(rows)||!Number.isInteger(year)||year<2001||year>2099||![1,2,3,4].includes(quarter)||!['reportedRentSar','reportedRentPerSqmSar'].includes(metric))throw Error('AGGREGATE_BACKTEST_SCOPE');
 const target=year*4+quarter-1,groups=buildIndex(rows),models=['PRIOR_QUARTER','SEASONAL_NAIVE','FOUR_QUARTER_MEDIAN'];
 const pairs=[];let actualEligible=0;
 for(const [k,p] of groups){const actual=single(p,target,metric);if(actual===null)continue;actualEligible++;const pred=predictions(p,target,metric);if(models.every(m=>pred[m]!==null))pairs.push({k,actual,pred});}
 const results=models.map(model=>{const n=pairs.length,abs=pairs.map(x=>Math.abs(x.pred[model]-x.actual));return {model,n,mae:n?round(abs.reduce((s,x)=>s+x,0)/n):null,mapePct:n?round(pairs.reduce((s,x,i)=>s+abs[i]/x.actual,0)/n*100):null,bias:n?round(pairs.reduce((s,x)=>s+x.pred[model]-x.actual,0)/n):null,within20Pct:n?round(pairs.filter((x,i)=>abs[i]/x.actual<=.2).length/n*100):null};});
 return {targetPeriod:year+'-Q'+quarter,metric,actualEligible,commonCohort:pairs.length,coveragePct:actualEligible?round(pairs.length/actualEligible*100):null,models:results,propertyAvmQualified:false,independentContractValidation:false,modelSelected:false,sourceBasis:'PUBLISHED_AGGREGATE_UNKNOWN_VAT_AND_AREA'};
}
function forecastAggregate(rows,scope,{year,quarter,metric}={}){
 if(!scope||!fields.every(k=>norm(scope[k]))||!Number.isInteger(year)||year<2001||year>2099||![1,2,3,4].includes(quarter)||!['reportedRentSar','reportedRentPerSqmSar'].includes(metric))throw Error('AGGREGATE_FORECAST_SCOPE');
 const t=year*4+quarter-1,p=buildIndex(rows).get(key(scope))||new Map();
 return {period:year+'-Q'+quarter,metric,predictions:predictions(p,t,metric),propertyEstimateSar:null,financialInputEligible:false};
}
module.exports={backtestAggregates,forecastAggregate};
