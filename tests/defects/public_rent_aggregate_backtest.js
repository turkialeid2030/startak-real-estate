'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {parsePublicRentCsv}=require('../../src/reporting/public-rent-reference');
const {backtestAggregates,forecastAggregate}=require('../../src/reporting/public-rent-aggregate-backtest');
const {assess}=require('../../tools/check-public-rental-reuse');
const scope={region:'الرياض',city:'الرياض',district:'الملقا',kind:'شقة',classification:'سكني'};
const metric='reportedRentPerSqmSar',target={year:2026,quarter:1,metric};
const a=[100,110,120,130].map((v,i)=>({...scope,year:2025,quarter:i+1,count:4,[metric]:v}));
const actual={...scope,year:2026,quarter:1,count:4,[metric]:150};
const future={...actual,quarter:2,[metric]:9999};
assert.deepEqual(forecastAggregate([...a,actual,future],scope,target).predictions,{PRIOR_QUARTER:130,SEASONAL_NAIVE:100,FOUR_QUARTER_MEDIAN:115});
const b=backtestAggregates([...a,actual,future],target);
assert.equal(b.commonCohort,1);assert.equal(b.models[0].mae,20);assert.equal(b.models[1].mae,50);assert.equal(b.models[2].mae,35);assert.equal(b.propertyAvmQualified,false);
assert.equal(backtestAggregates([...a,actual,actual],target).commonCohort,0);
assert.equal(backtestAggregates([...a.slice(1),actual],target).commonCohort,0);
assert.equal(backtestAggregates([...a,{...actual,count:1}],target).commonCohort,0);
assert.equal(forecastAggregate(a,scope,target).propertyEstimateSar,null);
assert.equal(assess({files:[{sourcePath:'x',gitBlobSha:'x'}]},{datasets:[]}).publishable,false);
assert.equal(assess({files:[]},{datasets:[]}).publishable,false);
const m=JSON.parse(fs.readFileSync('public/market-data/rental-manifest.json','utf8'));
const rows=m.files.flatMap(f=>parsePublicRentCsv(fs.readFileSync('public/market-data/'+f.filename,'utf8')));
assert.ok(rows.length>=90497);
for(const metric of ['reportedRentSar','reportedRentPerSqmSar']){
 const report=backtestAggregates(rows,{...target,metric});
 assert.ok(report.commonCohort>100);assert.ok(report.commonCohort<=report.actualEligible);
 assert.ok(report.models.every(x=>x.n===report.commonCohort&&Number.isFinite(x.mae)&&Number.isFinite(x.mapePct)));
 console.log('PUBLIC_RENT_AGGREGATE_BACKTEST '+JSON.stringify(report));
}
console.log('PUBLIC_RENT_AGGREGATE_RULES=PASS');
