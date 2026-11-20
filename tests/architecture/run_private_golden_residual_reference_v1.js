'use strict';
// Entirely synthetic negative/positive tests. Do not place any private
// property reports, expected outcomes, or personal source bytes in GitHub.
const assert = require('node:assert/strict');
const {verifyResidualCases} = require('../../tools/private-golden-residual-reference.cjs');
let checks = 0;
function test(run) {run();checks++;}
const hotel = {
  id:'SYNTHETIC-HOTEL-A',
  seasons:[{days:10,occPct:100}],
  roomTypes:[{count:2,adr:[100]}],
  opexPct:20,capRatePct:10,
  scenario:{dev:500,othPct:0},
  periodYears:1,discountPct:0,residualArea:100,roundStep:5,
  expected:{grossIncome:2000,noi:1600,gdv:16000,presentValue:15500,residualRate:155},
};
const income = {
  id:'SYNTHETIC-INCOME',
  units:[{count:2,annualRent:1000,occPct:100}],
  opexPct:10,capRatePct:10,
  expected:{grossIncome:2000,noi:1800,incomeValue:18000},
};
const commercial = {
  id:'SYNTHETIC-COMM',
  scenarios:[{weightPct:50},{weightPct:50}],
  discountPct:0,periodYears:1,
  residualArea:10,roundStep:10,
  marketLandRate:300,marketWeightPct:30,
  expected:{scenarioLand:[2000,3000],presentValue:2500,residualRate:250,adoptedLandRate:265},
};
const fixture = {
  residualCases:[hotel,{...hotel,id:'SYNTHETIC-HOTEL-B'},income,commercial],
};
const clone = value => JSON.parse(JSON.stringify(value));
const mutate = fn => {const x=clone(fixture);fn(x.residualCases);return x;};
test(() => assert.equal(verifyResidualCases(fixture).cases,4));
test(() => assert.equal(verifyResidualCases(fixture).hotelCases,2));
test(() => assert.equal(verifyResidualCases(fixture).unitIncomeCases,1));
test(() => assert.equal(verifyResidualCases(fixture).commercialDownstreamOnlyCases,1));
test(() => assert.equal(verifyResidualCases(fixture).sourceBytesVerified,false));
test(() => assert.equal(verifyResidualCases(fixture).startakEngineParityVerified,false));
test(() => assert.equal(verifyResidualCases(fixture).independentMarketEvidenceVerified,false));
test(() => assert.throws(()=>verifyResidualCases({residualCases:[]}), /COUNT_NOT_FOUR/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[1].id=x[0].id})), /ID_INVALID/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[0].seasons[0].occPct=101})), /PERCENT_SEASON_OCC/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[0].expected.gdv+=1})), /EXPECTED_MISMATCH_gdv/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[0].roomTypes[0].adr=[]})), /ADR_LENGTH/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[2].expected.incomeValue+=1})), /EXPECTED_MISMATCH_incomeValue/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[3].scenarios[0].weightPct=60})), /WEIGHTS/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[3].expected.presentValue+=1})), /MISMATCH_COMM_PRESENT_VALUE/));
test(() => assert.throws(()=>verifyResidualCases(mutate(x=>{x[3].expected.scenarioLand=[2000]})), /COMM_SCENARIOS/));
// A commercial scenario result is supplied by the source and deliberately
// NOT independently recomputed from development cost and GDV here.
test(() => assert.equal(verifyResidualCases(fixture).commercialDownstreamOnlyCases,1));
console.log('PRIVATE_GOLDEN_RESIDUAL_REFERENCE_V1: PASS ('+checks+' synthetic checks; private cases not supplied)');
