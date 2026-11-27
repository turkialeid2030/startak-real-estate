'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {ASSUMPTION_MODEL_VERSION}=require('../../src/assumptions/assumption-model');
const {buildFinancialTimingBasis}=require('../../src/contracts/financial-timing-basis');
const corpus=require('../reference/current-model-reference-v1.json');
let checks=0;
for(const fixtureRef of corpus.cases){
  const fixture=require(path.join(__dirname,'../..',fixtureRef.sourceFixture));
  const inputs={...fixture.input_set,...fixtureRef.inputOverrides};
  const studyType=STUDY_TYPE[fixtureRef.studyType];
  const request={studyType,inputs,leverageEnabled:inputs.leverageEnabled===true};
  if(fixtureRef.assumptionModelVersion)request.assumptionModelVersion=ASSUMPTION_MODEL_VERSION.V2;
  const result=calculateInvestmentCase(request);
  const expected=buildFinancialTimingBasis(studyType);
  assert.deepEqual(result.timingBasis,expected);
  assert.equal(expected.periodsPerYear,1);
  assert.equal(expected.datedCashflowMethod,false);
  assert.equal(expected.xirrUsed,false);
  assert.equal(expected.xnpvUsed,false);
  assert.equal(expected.transactionAuthorized,false);
  assert.equal(result.cashflows.length,fixtureRef.expected.cashflowLength);
  assert.ok(Math.abs(result.npv-fixtureRef.expected.npv)<=corpus.numericTolerance.currencySar);
  assert.ok(Math.abs(result.irr-fixtureRef.expected.irr)<=corpus.numericTolerance.irr);
  checks+=9;
  if(studyType===STUDY_TYPE.LAND_DEVELOPMENT&&request.leverageEnabled){
    assert.equal(expected.constructionDebtPeriodsPerYear,12);
    assert.equal(expected.landDebtDrawTiming,'TIME_ZERO');
    assert.equal(expected.constructionDebtDrawTiming,'MONTHLY_BEGINNING_OF_PERIOD');
    assert.equal(expected.constructionInterestCapitalizationTiming,'MONTHLY_END_OF_PERIOD');
    assert.equal(expected.annualConstructionDebtDrawsAreAggregationOnly,true);
    assert.equal(result.constructionDebtSchedule.length,fixtureRef.expected.constructionDebtScheduleLength);
    assert.equal(result.annualConstructionDebtDraws.length,fixtureRef.expected.annualConstructionDebtDrawsLength);
    const monthly=result.constructionDebtSchedule.reduce((sum,row)=>sum+row.constructionDebtDraw,0);
    const annual=result.annualConstructionDebtDraws.reduce((sum,row)=>sum+row.debtDraw,0);
    assert.ok(Math.abs(monthly-annual)<=corpus.numericTolerance.currencySar);
    checks+=8;
  }
}
console.log('FINANCIAL_TIMING_BASIS_DISCLOSURE_P26=PASS checks='+checks+' reference=VALIDATION_ONLY');
