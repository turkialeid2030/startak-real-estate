'use strict';
const assert=require('node:assert/strict');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {calculateUiInvestmentState}=require('../../src/assumptions/ui-integration-controller');
const {validateEngineInputs}=require('../../src/validation/numeric-safety');
const {buildPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const gold=require('../reference/RE-GOLD-baseline.json');
let checks=0;
for(const [mode,id,studyType] of [['building','RE-GOLD-002_existing_building',STUDY_TYPE.EXISTING_BUILDING],['land','RE-GOLD-001_land_development',STUDY_TYPE.LAND_DEVELOPMENT]]){
 const original=gold[id].inputs,baseline=JSON.stringify(original);
 for(const field of ['landLength','landWidth'])for(const value of [0,0.005,-1]){
  const inputs={...original,[field]:value},reject=e=>e.name==='ValidationError'&&e.field===field&&e.message_ar&&e.message_en;
  for(const run of [()=>validateEngineInputs(inputs,{studyType}),()=>calculateInvestmentCase({studyType,inputs,assumptionModelVersion:'LEGACY'}),()=>calculateUiInvestmentState({mode,inputs,assumptionModelVersion:'LEGACY',includePurchaseAlternative:false})]){assert.throws(run,e=>Boolean(reject(e)));checks++;}
  const report=buildPersonalFinancialStudy({mode,inputs,assumptionModelVersion:'LEGACY'});
  assert.equal(report.financial.status,'INPUTS_INVALID');assert.equal(report.financial.results,null);checks++;
 }
 for(const field of ['landLength','landWidth'])for(const value of [0.01,100]){assert.equal(validateEngineInputs({...original,[field]:value},{studyType}),true);checks++;}
 assert.equal(JSON.stringify(original),baseline);checks++;
}
console.log('LAND_DIMENSION_CURRENT_RESULTS=PASS checks='+checks);
