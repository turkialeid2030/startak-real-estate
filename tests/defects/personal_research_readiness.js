'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { calculateInvestmentCase, STUDY_TYPE }=require('../../src/engines');
const { PERSONAL_STATUS, evaluatePersonalResearchReadiness }=
  require('../../src/governance/personal-research-readiness');
function fixture(name){return JSON.parse(fs.readFileSync(path.join(__dirname,
  '../characterization/fixtures',name+'.json'),'utf8')).input_set;}
function calc(studyType,inputs){return calculateInvestmentCase({
  studyType,inputs,leverageEnabled:Boolean(inputs.leverageEnabled),
  assumptionModelVersion:'LEGACY',
});}
const building=fixture('RE-GOLD-002-U');
const land=fixture('RE-GOLD-001-U');
const b=calc(STUDY_TYPE.EXISTING_BUILDING,building);
const l=calc(STUDY_TYPE.LAND_DEVELOPMENT,land);
let assertions=0;
function checked(out){
  assert.equal(out.computationChecked,true);
  assert.equal(out.personalResearchAllowed,true);
  assert.equal(out.financialDecisionAuthorized,false);
  assert.equal(out.commercialProductionAuthorized,false);
  assert.equal(out.independentlyVerifiedMarketAccuracy,false);
  assert.equal(out.realDataSourceVerified,false);
  assertions+=6;
}
for(const [mode,result,inputs] of [['building',b,building],['land',l,land]]){
 const out=evaluatePersonalResearchReadiness({mode,results:result,inputs});
 checked(out);
 assert.notEqual(out.status,PERSONAL_STATUS.HOLD);
 assert.ok(out.checks.every(c=>c.pass));
 assertions+=2;
}
function mustHold({mode,results,inputs,validationError},code){
 const x=evaluatePersonalResearchReadiness({mode,results,inputs,validationError});
 assert.equal(x.status,PERSONAL_STATUS.HOLD);
 assert.ok(x.reasonCodes.includes(code),x.reasonCodes.join(','));
 assert.equal(x.personalResearchAllowed,false);
 assert.equal(x.financialDecisionAuthorized,false);
 assertions+=4;
}
mustHold({mode:'building',inputs:building,results:{...b,totalPurchaseCost:b.totalPurchaseCost+100}},
  'ACQUISITION_COST_ROLLUP');
mustHold({mode:'building',inputs:building,results:{...b,NOI:b.NOI+300}},
  'NOI_RECONCILIATION');
mustHold({mode:'land',inputs:land,results:{...l,totalProjectCost:l.totalProjectCost-40}},
  'PROJECT_COST_ROLLUP');
mustHold({mode:'land',inputs:land,results:{...l,stabilizedNOI:l.stabilizedNOI-40}},
  'STABILIZED_NOI_RECONCILIATION');
mustHold({mode:'land',inputs:land,results:{...l,cashflows:[-1000,NaN]}},
  'CASHFLOW_VALUES_FINITE');
mustHold({mode:'building',inputs:building,results:{...b,criteriaDetail:[]}},
  'FINANCIAL_CRITERIA_COMPLETE');
mustHold({mode:'building',inputs:building,results:{...b,financialModelStatus:'INCOMPLETE_INPUTS'}},
  'MODEL_INCOMPLETE_OR_INVALID');
mustHold({mode:'warehouse',inputs:building,results:b},'STUDY_MODE_UNSUPPORTED');
mustHold({mode:'building',inputs:building,results:b,validationError:new Error('missing input')},
  'INPUT_OR_CALCULATION_NOT_AVAILABLE');
const caution=evaluatePersonalResearchReadiness({mode:'land',inputs:land,
  results:{...l,failedHardGates:['NPV_NON_NEGATIVE'],npv:-1000}});
assert.equal(caution.status,PERSONAL_STATUS.CAUTION);
assert.equal(caution.personalResearchAllowed,true);
assert.equal(caution.financialDecisionAuthorized,false);
assert.ok(caution.reasonCodes.includes('FINANCIAL_HARD_GATES_NOT_MET'));
assertions+=4;
console.log('PERSONAL_RESEARCH_MODEL_INTEGRITY=PASS assertions='+assertions);
