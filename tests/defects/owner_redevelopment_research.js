'use strict';
const assert=require('node:assert/strict');
const {VERSION,evaluateRedevelopment}=require('../../src/reporting/owner-redevelopment-research');
const {renderExternalReview}=require('../../src/reporting/reporting-studio');
let cases=0,checks=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(v){assert.ok(v);checks++;}
function denied(fn){assert.throws(fn);cases++;checks++;}
const row=(year,patch={})=>({year,propertyRentSar:0,ownerOpexSar:0,sustainingCapexSar:0,demolitionSar:0,constructionSar:0,otherDevelopmentSar:0,netExitSar:0,...patch});
const input={version:VERSION,propertyRef:'SYNTH-P',valuationDate:'2026-01-05',currentState:'IMPROVED',propertyRight:'FREEHOLD',identityRef:'SYNTH-ID',currentNetSaleSar:1000000,saleAssumptionRef:'SYNTH-SALE',years:3,discountRate:.1,planningStatus:'ASSUMPTION_ONLY',planningRef:'SYNTH-PLAN',environmentalRef:'SYNTH-ENV',costRef:'SYNTH-COST',incomeRef:'SYNTH-RENT',exitRef:'SYNTH-EXIT',propertyIncomeOnly:true,noDuplicateCosts:true,demolitionYear:0,completionYear:1,retain:[row(0),row(1,{propertyRentSar:100000,ownerOpexSar:20000}),row(2,{propertyRentSar:100000,ownerOpexSar:20000}),row(3,{propertyRentSar:100000,ownerOpexSar:20000,netExitSar:1000000})],redevelop:[row(0,{demolitionSar:50000}),row(1,{constructionSar:400000}),row(2,{propertyRentSar:150000,ownerOpexSar:30000}),row(3,{propertyRentSar:150000,ownerOpexSar:30000,netExitSar:1800000})],stress:{incomeReduction:.1,costIncrease:.1,exitReduction:.1}};
function run(x){cases++;const r=evaluateRedevelopment(x);for(const k of ['sourceAuthenticated','professionalValuationCertified','transactionAuthorized','canonicalModelUpdated','planningApproved','recommendationAuthorized'])eq(r[k],false);return r;}
function near(a,b,t=.03){ok(Math.abs(a-b)<=t);}
const r=run(input);
eq(r.sell.presentValueSar,1000000);eq(r.sell.incrementalNpvSar,0);
const ret=80000/1.1+80000/1.21+1080000/1.331,dev=-50000-400000/1.1+120000/1.21+1920000/1.331;
near(r.retain.presentValueSar,ret);near(r.redevelop.presentValueSar,dev);near(r.redevelop.incrementalNpvSar,dev-1000000);near(r.redevelopmentIncrementVsRetainSar,dev-ret);
eq(r.redevelop.periods[0].cashflowSar,-50000);eq(r.redevelop.periods[1].cashflowSar,-400000);eq(r.redevelop.periods[2].cashflowSar,120000);
eq(r.redevelop.periods[1].stressCashflowSar,-440000);eq(r.redevelop.periods[2].stressCashflowSar,102000);
ok(r.redevelop.stressIncrementalNpvSar<r.redevelop.incrementalNpvSar);ok(r.retain.stressIncrementalNpvSar<r.retain.incrementalNpvSar);
ok(r.issues.some(i=>i.code==='BUILDING_RIGHTS_UNVERIFIED'));
for(const m of [r.retain,r.redevelop]){ok(Number.isFinite(m.opportunityCostIrr));near(m.periods.reduce((s,p)=>s+p.cashflowSar/Math.pow(1+m.opportunityCostIrr,p.year),-input.currentNetSaleSar),0,.1);}
const z=run({...input,discountRate:0,stress:{incomeReduction:0,costIncrease:0,exitReduction:0}});eq(z.retain.presentValueSar,1240000);eq(z.redevelop.presentValueSar,1590000);eq(z.redevelop.stressPresentValueSar,z.redevelop.presentValueSar);
const vacant=run({...input,currentState:'VACANT_LAND',redevelop:[row(0),...input.redevelop.slice(1)]});eq(vacant.redevelop.periods[0].demolitionSar,0);near(vacant.redevelop.presentValueSar,dev+50000);
const replace=(key,index,patch)=>({...input,[key]:input[key].map((p,i)=>i===index?{...p,...patch}:p)});
for(const x of [{...input,propertyRight:'LEASEHOLD'},{...input,propertyIncomeOnly:false},{...input,noDuplicateCosts:false},{...input,planningRef:''},{...input,environmentalRef:''},{...input,currentNetSaleSar:0},{...input,years:31},{...input,discountRate:NaN},{...input,completionYear:3},{...input,demolitionYear:1},{...input,valuationDate:'2026-02-30'},{...input,stress:{...input.stress,costIncrease:1.1}},{...input,redevelop:input.redevelop.slice(1)},{...input,currentState:'VACANT_LAND'},replace('retain',1,{constructionSar:1}),replace('retain',0,{propertyRentSar:1}),replace('retain',2,{netExitSar:1}),replace('redevelop',1,{propertyRentSar:1}),replace('redevelop',2,{constructionSar:1}),replace('redevelop',0,{demolitionSar:0}),replace('redevelop',1,{constructionSar:0}),replace('redevelop',3,{netExitSar:0}),replace('redevelop',2,{year:1}),replace('redevelop',2,{ownerOpexSar:.001}),replace('redevelop',3,{otherDevelopmentSar:1})])denied(()=>evaluateRedevelopment(x));
for(const locale of ['ar-SA','en']){const out=renderExternalReview({...input,propertyRef:'<script>bad</script>'},{locale});cases++;ok(!out.html.includes('<script>'));ok(out.html.includes('&lt;script&gt;'));ok(out.html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));eq(out.report.transactionAuthorized,false);}
console.log('OWNER_REDEVELOPMENT=PASS cases='+cases+' checks='+checks);
