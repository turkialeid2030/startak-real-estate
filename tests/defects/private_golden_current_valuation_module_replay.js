'use strict';
const assert=require('node:assert/strict');
const {replayPrivateFixture,replayPropertyCase}=require('../../tools/private-golden-engine-replay.cjs');
// Independent, entirely synthetic fixtures: no original licensed report data.
const building={landArea:1000,adoptedLandRate:null,roundStep:1,
 landComparables:[{price:1000,netAdjPct:0,weightPct:50},{price:1200,netAdjPct:0,weightPct:50}],
 components:[{area:200,rate:1000}],softCostsPct:{professional:10,utilities:0,management:0,finance:0,contractorProfit:0},
 effectiveAge:10,usefulLife:40,rentalYieldPct:5,expected:{marketValue:1265000,marketRent:63250}};
const land={...building,components:[],expected:{marketValue:1100000,marketRent:55000}};
const hotel={seasons:[{days:365,occPct:50}],roomTypes:[{count:10,adr:[100]}],opexPct:20,capRatePct:10,
 scenario:{dev:500000,othPct:10},periodYears:1,discountPct:10,residualArea:1000,roundStep:10,
 expected:{grossIncome:182500,noi:146000,gdv:1460000,presentValue:827273,residualRate:830}};
const commercial={id:'synth-commercial',scenarios:[{weightPct:50},{weightPct:50}],periodYears:0,discountPct:0,
 residualArea:1000,roundStep:1,marketLandRate:2000,marketWeightPct:50,
 expected:{scenarioLand:[1000000,2000000],presentValue:1500000,residualRate:1500,adoptedLandRate:1750}};
const unit={id:'synth-units',units:[{count:10,annualRent:10000,occPct:90}],opexPct:20,capRatePct:10,
 expected:{grossIncome:90000,noi:72000,incomeValue:720000}};
const fixture={cases:[...Array.from({length:16},(_,i)=>({...building,id:'synth-property-'+i})),{...land,id:'synth-land'}],
 residualCases:[{...hotel,id:'synth-hotel-one'},{...hotel,id:'synth-hotel-two'},unit,commercial]};
const report=replayPrivateFixture(fixture);
assert.equal(report.valueMatches,17);
assert.equal(report.derivedRentMatches,17);
assert.equal(report.costModuleCases,16);
assert.equal(report.landComparableModuleCases,17);
assert.equal(report.auxiliaryEngineMatches,3);
assert.equal(report.commercialScenarioBasisBlocked,1);
assert.equal(report.exactFixtureEngineParityEstablished,false);
assert.equal(report.rentalEvidenceIndependent,false);
assert.equal(report.releaseAuthorized,false);
assert.equal(replayPropertyCase({...building,expected:{marketValue:1,marketRent:1}}).valueMatches,false);
assert.throws(()=>replayPropertyCase({...building,landComparables:[{price:1000,netAdjPct:0,weightPct:25},{price:1200,netAdjPct:0,weightPct:50}]}),/weights must sum/);
assert.throws(()=>replayPrivateFixture({...fixture,cases:fixture.cases.slice(1)}),/EXPECTED_17_PLUS_4/);
assert.throws(()=>replayPrivateFixture({...fixture,cases:[fixture.cases[0],...fixture.cases.slice(0,16)]}),/IDS_INVALID/);
console.log('PRIVATE_GOLDEN_CURRENT_VALUATION_MODULE_REPLAY=PASS synthetic_only=true authority=false');
