'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildPersonalFinancialStudy,verifyPersonalFinancialStudy,htmlFinancialStudy}=
 require('../../src/app/personal-financial-study');
const dir=path.join(__dirname,'../characterization/fixtures');
const source=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8')).input_set;
const at=new Date('2026-10-24T15:00:00Z');
let checks=0;
for(const [mode,name] of [['building','RE-GOLD-002-U'],['land','RE-GOLD-001-U']]){
 const inputs=source(name);
 const report=buildPersonalFinancialStudy({mode,inputs,assumptionModelVersion:'LEGACY',generatedAt:at});
 assert.equal(verifyPersonalFinancialStudy(report),true);
 assert.equal(report.financial.personalResearchIntegrity.computationChecked,true);
 assert.equal(report.financial.personalResearchIntegrity.financialDecisionAuthorized,false);
 assert.equal(report.financial.personalResearchIntegrity.independentlyVerifiedMarketAccuracy,false);
 assert.equal(report.financial.usesPreviousValidResults,false);
 assert.ok(report.financial.results && report.financial.annualCashflows.length>=2);
 const html=htmlFinancialStudy(report,{locale:'ar-SA'});
 assert.ok(html.includes('سلامة النتائج المالية'));
 assert.ok(html.includes('الاعتماد على مصادر سوق مستقلة'));
 checks+=8;
 const invalid=buildPersonalFinancialStudy({mode,inputs:{...inputs,
   [mode==='building'?'buildingPrice':'landPricePerSqm']:NaN},
   assumptionModelVersion:'LEGACY',generatedAt:at});
 assert.equal(verifyPersonalFinancialStudy(invalid),true);
 assert.equal(invalid.financial.status,'INPUTS_INVALID');
 assert.equal(invalid.financial.results,null);
 assert.equal(invalid.financial.governance,null);
 assert.equal(invalid.financial.personalResearchIntegrity.computationChecked,false);
 assert.deepEqual(invalid.financial.annualCashflows,[]);
 assert.equal(invalid.financial.usesPreviousValidResults,false);
 checks+=7;
}
const report=buildPersonalFinancialStudy({mode:'building',inputs:source('RE-GOLD-002-U'),
  assumptionModelVersion:'LEGACY',generatedAt:at});
const mutation=JSON.parse(JSON.stringify(report));
mutation.financial.personalResearchIntegrity.reasonCodes.push('MANUAL_OVERRIDE');
assert.equal(verifyPersonalFinancialStudy(mutation),false);
checks++;
console.log('PERSONAL_REPORT_ARITHMETIC_SAFETY=PASS checks='+checks);
