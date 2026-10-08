'use strict';

const assert = require('assert');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  VALUATION_METHOD,
  VALUATION_STAGE_STATUS,
  VALUATION_CASE_SCHEMA_VERSION,
} = require('../../src/valuation-intelligence');
const {
  VALUATION_RUNTIME_MODE,
  evaluateExistingBuildingValuation,
} = require('../../src/app/existing-building-valuation-runtime');
const gold = require('../reference/RE-GOLD-baseline.json');

function valuationCase() {
  return {
    schemaVersion: VALUATION_CASE_SCHEMA_VERSION,
    projectId: 'PROJECT-RUNTIME-001',
    classification: {
      assetClass: 'OFFICE',
      lifecycleStage: 'STABILIZED',
      investmentStrategy: 'CORE_INCOME',
      incomeModel: 'LEASE_INCOME',
      jurisdiction: { country: 'SA', city: 'Riyadh' },
    },
    incomePolicy: {
      expenseTreatment: 'MARKET_ESTIMATE',
      basis: 'MARKET_VALUE',
      currency: 'SAR',
      valuationDate: '2026-09-05',
    },
    evidencePolicy: {
      minEvidenceCount: 3,
      maxAssumptionBurdenRatio: 1,
      maxLowGradeRatio: 1,
    },
    singleMethodPolicy: {
      allowedMethod: VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
      justification: 'Explicit test-scope acceptance of one qualified income indication.',
    },
  };
}


const fs=require('node:fs');
const path=require('node:path');
const {
 STATUS,assessInstitutionalValuationDecisionBoundary,
 buildInstitutionalValuationReportExport,
}=require('../../src/app/institutional-valuation-decision-boundary');
const {
 valuationCaseFromSavedDeal,withValuationCase,
}=require('../../src/app/valuation-saved-deal-bridge');
const input=gold['RE-GOLD-002_existing_building'].inputs;
const result=calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:input,leverageEnabled:false});
const originalInput=JSON.stringify(input),originalResult=JSON.stringify(result);
function runtime(config=valuationCase()){
 return evaluateExistingBuildingValuation({
   caseId:'CASE-RUNTIME-C62',
   legacyInput:input,legacyResult:result,valuationCase:config,
 });
}
const r1=runtime();
assert.equal(r1.mode,VALUATION_RUNTIME_MODE.VALUATION_V1);
assert.equal(r1.stage.status,VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL);
assert.equal(r1.presentation.readyForDecisionControl,true);
assert.equal(r1.stage.finalValue,result.NOI/input.marketCapRate);
assert.equal(r1.institutionalDecision.status,STATUS.HOLD);
assert.equal(r1.institutionalDecision.arithmeticPreliminaryValueSar,r1.stage.finalValue);
assert.equal(r1.institutionalDecision.finalValueSar,null);
assert.equal(r1.institutionalDecision.readyForInstitutionalDecision,false);
assert.equal(r1.institutionalDecision.publicValuationReportExportAuthorized,false);
assert.equal(r1.institutionalDecision.transactionAuthorized,false);
assert(r1.institutionalDecision.blockers.includes('C62_INDEPENDENT_SOURCE_AND_PROFESSIONAL_AUTHORITY_NOT_ESTABLISHED'));
assert(r1.institutionalDecision.methodChecks.some(m=>m.blockers.includes('C62_SIGNED_METHOD_EVIDENCE_PACKET_REQUIRED')));
assert(Object.isFrozen(r1.institutionalDecision));
assert.throws(()=>buildInstitutionalValuationReportExport(r1.institutionalDecision),
  /C62_GOVERNED_REPORT_EXPORT_BLOCKED/);
assert.throws(()=>buildInstitutionalValuationReportExport({
  readyForInstitutionalDecision:true,publicValuationReportExportAuthorized:true,
}),/C62_EXTERNAL_AUTHORIZED_REPORT_PIPELINE_NOT_IMPLEMENTED/);
const bogus=valuationCase();
bogus.institutionalEvidence={
 [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]:{
  assetClass:'OFFICE',city:'Riyadh',entryCapRate:input.marketCapRate,
  comparables:[{transactionStatus:'EXECUTED_SALE',sourceProviderRef:'SELF-CLAIMED'}],
 },
 authoritativeReview:{approved:true,licensedReviewerRef:'SELF-ASSERTED'},
};
const r2=runtime(bogus);
assert.equal(r2.institutionalDecision.status,STATUS.HOLD);
assert.equal(r2.institutionalDecision.finalValueSar,null);
assert(r2.institutionalDecision.blockers.includes('C62_AUTHORITY_CANNOT_BE_SELF_DECLARED'));
assert(r2.institutionalDecision.blockers.some(x=>x.includes('INSUFFICIENT_QUALIFIED_INCOME_COMPARABLES')||
 x.includes('PREDECLARED_RATE_STRESS_AND_EVIDENCE_POLICY_REQUIRED')));
const changed=runtime({...valuationCase(),institutionalEvidence:{authoritativeReview:{approved:false}}});
assert.equal(changed.institutionalDecision.status,STATUS.HOLD);
assert.equal(changed.institutionalDecision.readyForInstitutionalDecision,false);
assert.notEqual(changed.institutionalDecision.decisionEvidenceHashSha256,r2.institutionalDecision.decisionEvidenceHashSha256);
assert.equal(JSON.stringify(input),originalInput);
assert.equal(JSON.stringify(result),originalResult);

const record={id:'TEST-C62-SAVED',mode:'building',valuationCase:bogus};
const restored=valuationCaseFromSavedDeal(record);
assert.deepEqual(restored.institutionalEvidence,bogus.institutionalEvidence);
const saved=withValuationCase({id:'TEST-C62-SAVED',mode:'building'},restored);
assert.equal(saved.valuationCase.institutionalEvidence.authoritativeReview.approved,true);
assert.equal(runtime(saved.valuationCase).institutionalDecision.readyForInstitutionalDecision,false);

const noConfig=evaluateExistingBuildingValuation({
 caseId:'C62-LEGACY',legacyInput:input,legacyResult:result,
});
assert.equal(noConfig.mode,VALUATION_RUNTIME_MODE.LEGACY_ONLY);
assert.equal(noConfig.stage,null);
assert.equal(noConfig.institutionalDecision,undefined);
const panel=fs.readFileSync(path.join(__dirname,'../../src/components/ValuationIntelligenceBasePanel.jsx'),'utf8');
assert(panel.includes('الاعتماد الاستثماري والتقييم المهني والتصدير الرسمي: معلّق'));
assert(panel.includes('مؤشر القيمة الحسابي الأولي (غير معتمد)'));
assert(panel.includes('institutionalDecision.blockers'));
const source=fs.readFileSync(path.join(__dirname,'../../src/app/existing-building-valuation-runtime.js'),'utf8');
assert(source.includes('const institutionalDecision = assessInstitutionalValuationDecisionBoundary('));
console.log('C62_ACTUAL_EXISTING_BUILDING_RUNTIME_BOUNDARY=PASS');
console.log('C62_REAL_EXTERNAL_SOURCE_AUTHENTICATION=FALSE');
console.log('C62_FULL_REAL_BROWSER_UAT_OR_OFFICIAL_EXPORT=FALSE');
