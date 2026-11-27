'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {ASSUMPTION_MODEL_VERSION}=require('../../src/assumptions/assumption-model');
const {buildFinancialTimingBasis,FINANCIAL_TIMING_BASIS_VERSION}=require('../../src/contracts/financial-timing-basis');
const {buildFinancialTimingBasisReportDisclosure:report}=require('../../src/reporting/financial-timing-basis-report');
const corpus=require('../reference/current-model-reference-v1.json');
let checks=0;
for(const fixtureRef of corpus.cases){
  const fixture=require(path.join(__dirname,'../..',fixtureRef.sourceFixture));
  const inputs={...fixture.input_set,...fixtureRef.inputOverrides};
  const studyType=STUDY_TYPE[fixtureRef.studyType];
  const request={studyType,inputs,leverageEnabled:inputs.leverageEnabled===true};
  if(fixtureRef.assumptionModelVersion)request.assumptionModelVersion=ASSUMPTION_MODEL_VERSION.V2;
  const result=calculateInvestmentCase(request);
  const before=JSON.stringify(result);
  for(const locale of ['ar-SA','en']){
    const d=report(result,{locale});
    assert.equal(d.locale,locale);
    assert.equal(d.timingBasisVersion,FINANCIAL_TIMING_BASIS_VERSION);
    assert.equal(d.methodology.terminalValueTiming,result.timingBasis.terminalValueTiming);
    assert.equal(d.methodology.constructionDebtPeriodsPerYear,result.timingBasis.constructionDebtPeriodsPerYear);
    assert.equal(d.methodology.xirrUsed,false);
    assert.equal(d.methodology.xnpvUsed,false);
    assert.equal(d.transactionAuthorized,false);
    assert.equal(d.rows.find(r=>r.code==='CONSTRUCTION_DEBT_DRAW_TIMING').applicable,studyType===STUDY_TYPE.LAND_DEVELOPMENT);
    assert.equal(JSON.stringify(result),before);
    checks+=9;
  }
}
const building=buildFinancialTimingBasis(STUDY_TYPE.EXISTING_BUILDING);
const land=buildFinancialTimingBasis(STUDY_TYPE.LAND_DEVELOPMENT);
const invalid=[
 {timingBasis:{version:FINANCIAL_TIMING_BASIS_VERSION}},
 {timingBasis:{...building,datedCashflowMethod:true,xirrUsed:true,xnpvUsed:true}},
 {timingBasis:{...land,constructionDebtPeriodsPerYear:1}},
 {timingBasis:{...building,npvConvention:'UNVERIFIED'}},
 {timingBasis:{...building,transactionAuthorized:true}},
 {timingBasis:{...land,periodsPerYear:12}},
 {timingBasis:building,studyType:STUDY_TYPE.LAND_DEVELOPMENT},
 {timingBasis:{...building,get xirrUsed(){throw new Error('ACCESSOR_EXECUTED')}}},
];
for(const f of invalid){assert.throws(()=>report(f),/Invalid or inconsistent financial timing basis/);checks++;}
assert.throws(()=>report({}),/result.timingBasis is required/);checks++;
assert.throws(()=>report({timingBasis:{version:'UNKNOWN'}}),/Unsupported timing basis version/);checks++;
const frac=report({timingBasis:land,constructionPeriodYears:1.5,annualConstructionYears:2},{locale:'en'});
assert.equal(frac.fractionalConstructionReview.status,'REQUIRES_DATED_CASHFLOW_RECONCILIATION');
assert.equal(frac.fractionalConstructionReview.nominalConstructionFinanceMonths,18);
assert.equal(frac.fractionalConstructionReview.xirrCalculatedByThisReport,false);checks+=3;
const fixtureRef=corpus.cases.find(c=>c.id==='BUILDING_V2_UNLEVERED');
const fixture=require(path.join(__dirname,'../..',fixtureRef.sourceFixture));
const held=calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:{...fixture.input_set,...fixtureRef.inputOverrides},leverageEnabled:false,assumptionModelVersion:ASSUMPTION_MODEL_VERSION.V2,assumptionRegistry:[{id:'maintenanceRate',value:0.06,critical:true,override:true,overrideReason:'Synthetic P26 review',approvalStatus:'PENDING'}]});
for(const locale of ['ar-SA','en']){
 const d=report(held,{locale});
 assert.equal(d.decisionStatus,'INCOMPLETE_INPUTS');
 assert.equal(d.analyticalResultsOnly,true);
 assert.equal(d.transactionAuthorized,false);checks+=3;
}
console.log('FINANCIAL_TIMING_BASIS_REPORT_P26=PASS checks='+checks+' reference=VALIDATION_ONLY');
