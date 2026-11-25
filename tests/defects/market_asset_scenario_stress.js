'use strict';
const assert=require('node:assert/strict');
const {ASSET_TYPES,evaluateMarketStudy:e}=require('../../src/market/instant-market-study');
const specialists=new Set(['HOTEL','FUEL_STATION','HEALTHCARE_PROPERTY','INDUSTRIAL_PROPERTY']);
let scenarios=0;
for(const type of Object.keys(ASSET_TYPES)){
 const specialist=specialists.has(type),land=type==='LAND',income=!land&&!specialist;
 const subject={assetType:type,city:'الرياض',district:'SYNTH',location:'24.7,46.7',landArea:1000,builtArea:1000,rentableArea:800,buildingCount:1,unitCount:10,roomCount:20};
 const rows=Array.from({length:3},(_,i)=>({assetType:type,status:'EXECUTED',date:'2026-11-24',sourceUrl:'https://example.org/synthetic/row-'+i,sourceRecordId:'row-'+i,location:'24.7,46.7',landArea:1000,builtArea:1000,rentableArea:800,price:1000000,annualRent:100000}));
 const base={subject,sales:rows,rentals:rows,assumptions:{occupancy:1,expenseRatio:0.2,capRate:0.08},asOf:new Date('2026-11-25T00:00:00Z')};
 const run=(name,patch,test)=>{
  const v=e({...base,...patch});
  try{test(v);assert.equal(v.certifiedMarketValue,false);assert.equal(v.independentlyVerified,false);assert.equal(v.hasLiveLicensedFeed,false);}catch(err){throw Error(type+' / '+name+': '+err.message);}
  scenarios++;
 };
 run('valid',{},v=>{assert.equal(v.eligibleSalesCount,3);assert.equal(v.saleIndicationSar,1000000);assert.equal(v.eligibleRentalsCount,income?3:0);assert.equal(v.todayValueScenarioSar,specialist?null:1000000);});
 for(const [name,patch] of [['stale',{date:'2024-01-01'}],['asking',{status:'ASKING'}],['wrong-type',{assetType:'OTHER'}],['distant',{location:'25.7,46.7'}],['large-size',{landArea:3000,builtArea:3000,rentableArea:3000}],['future-date',{date:'2027-01-01'}]]){
  run(name,{sales:rows.map(x=>({...x,...patch})),rentals:rows.map(x=>({...x,...patch}))},v=>{assert.equal(v.eligibleSalesCount,0);assert.equal(v.eligibleRentalsCount,0);assert.equal(v.todayValueScenarioSar,null);});
 }
 run('duplicate',{sales:rows.map(x=>({...x,sourceRecordId:'same'})),rentals:rows.map(x=>({...x,sourceRecordId:'same'}))},v=>{assert.equal(v.eligibleSalesCount,1);assert.equal(v.eligibleRentalsCount,income?1:0);assert.equal(v.todayValueScenarioSar,null);});
 // Same transaction ID with different economics is not an independent comparable.
 const duplicateConflict=(key)=>[rows[0],{...rows[0],sourceUrl:'https://example.org/synthetic/conflict-copy',[key]:rows[0][key]*3},rows[1],rows[2]];
 for(const reverse of [false,true]){
  const conflict=duplicateConflict('price');
  run('conflicting sale '+reverse,{sales:reverse?[...conflict].reverse():conflict,rentals:[]},v=>{
   assert.equal(v.eligibleSalesCount,2);assert.equal(v.saleIndicationSar,null);
   assert.equal(v.todayValueScenarioSar,null);assert.ok(v.issues.includes('SALE_SOURCE_RECORD_CONFLICT'));
  });
  for(const [kind,patch] of [['stale',{date:'2024-01-01'}],['asking',{status:'ASKING'}],['area',{builtArea:3000,landArea:3000,rentableArea:3000}],['location',{location:'25.7,46.7'}],['malformed',{price:'bad',annualRent:'bad'}]]){
   const inconsistent=[...rows,{...rows[0],...patch,sourceUrl:'https://example.org/synthetic/ineligible-copy'}];
   const cohort=reverse?[...inconsistent].reverse():inconsistent;
   run('excluded conflicting sale '+kind+' '+reverse,{sales:cohort,rentals:[]},v=>{
    assert.equal(v.eligibleSalesCount,2);assert.equal(v.saleIndicationSar,null);
    assert.equal(v.todayValueScenarioSar,null);assert.ok(v.issues.includes('SALE_SOURCE_RECORD_CONFLICT'));
   });
   if(income)run('excluded conflicting rent '+kind+' '+reverse,{sales:[],rentals:cohort},v=>{
    assert.equal(v.eligibleRentalsCount,2);assert.equal(v.marketAnnualRentPotentialSar,null);
    assert.equal(v.todayValueScenarioSar,null);assert.ok(v.issues.includes('RENT_SOURCE_RECORD_CONFLICT'));
   });
  }
  const exact=[rows[0],{...rows[0],sourceUrl:'https://example.org/synthetic/exact-copy'},rows[1],rows[2]];
  run('exact duplicate '+reverse,{sales:reverse?[...exact].reverse():exact,rentals:[]},v=>{
   assert.equal(v.eligibleSalesCount,3);assert.equal(v.saleIndicationSar,1000000);
   assert.ok(!v.issues.includes('SALE_SOURCE_RECORD_CONFLICT'));
  });
  if(income){
   const conflictRent=duplicateConflict('annualRent');
   run('conflicting rent '+reverse,{sales:[],rentals:reverse?[...conflictRent].reverse():conflictRent},v=>{
    assert.equal(v.eligibleRentalsCount,2);assert.equal(v.marketAnnualRentPotentialSar,null);
    assert.equal(v.todayValueScenarioSar,null);assert.ok(v.issues.includes('RENT_SOURCE_RECORD_CONFLICT'));
   });
  }
 }
 if(income){
  for(const field of ['occupancy','expenseRatio','capRate']){
   for(const bad of [undefined,null,'','bad',NaN,Infinity,-0.1,1.1]){
    const assumptions={...base.assumptions,[field]:bad};
    const issue={occupancy:'OCCUPANCY_INVALID',expenseRatio:'EXPENSE_RATIO_INVALID',capRate:'CAP_RATE_INVALID'}[field];
    run(field+' invalid '+String(bad),{sales:[],assumptions},v=>{
     assert.ok(v.issues.includes(issue));assert.equal(v.incomeIndicationSar,null);assert.equal(v.todayValueScenarioSar,null);
     assert.equal(v.marketAnnualRentPotentialSar,100000);
     if(field==='occupancy'){assert.equal(v.expectedCollectedAnnualRentSar,null);assert.equal(v.estimatedAnnualNoiSar,null);}
     if(field==='expenseRatio'){assert.equal(v.expectedCollectedAnnualRentSar,100000);assert.equal(v.estimatedAnnualNoiSar,null);}
    });
   }
  }
  run('explicit zero occupancy',{sales:[],assumptions:{...base.assumptions,occupancy:0}},v=>{assert.equal(v.expectedCollectedAnnualRentSar,0);assert.equal(v.estimatedAnnualNoiSar,0);assert.equal(v.incomeIndicationSar,0);assert.ok(!v.issues.includes('OCCUPANCY_INVALID'));});
  run('explicit zero expenses',{sales:[],assumptions:{...base.assumptions,expenseRatio:0}},v=>{assert.equal(v.estimatedAnnualNoiSar,100000);assert.equal(v.incomeIndicationSar,1250000);assert.ok(!v.issues.includes('EXPENSE_RATIO_INVALID'));});
  run('zero cap rate',{sales:[],assumptions:{...base.assumptions,capRate:0}},v=>{assert.ok(v.issues.includes('CAP_RATE_INVALID'));assert.equal(v.incomeIndicationSar,null);});
  run('method conflict',{assumptions:{...base.assumptions,capRate:0.16}},v=>{assert.equal(v.materialMethodGap,true);assert.equal(v.todayValueScenarioSar,null);});
  run('sale independent of missing expenses',{assumptions:{occupancy:1,capRate:0.08}},v=>{assert.equal(v.saleIndicationSar,1000000);assert.equal(v.incomeIndicationSar,null);assert.ok(v.issues.includes('EXPENSE_RATIO_INVALID'));assert.equal(v.todayValueScenarioSar,1000000);});
 }
}
console.log('MARKET_ASSET_SCENARIO_STRESS=PASS scenarios='+scenarios+' synthetic_only=true');
