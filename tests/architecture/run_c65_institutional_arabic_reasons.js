'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {AR,EN,displayBlocker,institutionalStatusText,institutionalCountLabel,displayEvidenceGap}=
  require('../../src/app/institutional-valuation-reason-presentation');
const {VALUATION_METHOD}=require('../../src/valuation-intelligence');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {evaluateExistingBuildingValuation}=require('../../src/app/existing-building-valuation-runtime');
const gold=require('../reference/RE-GOLD-baseline.json');
const cfg={
 schemaVersion:1,projectId:'C65-OFFICE',
 classification:{assetClass:'OFFICE',lifecycleStage:'STABILIZED',investmentStrategy:'CORE_INCOME',
 incomeModel:'LEASE_INCOME',jurisdiction:{country:'SA',city:'Riyadh'}},
 incomePolicy:{expenseTreatment:'MARKET_ESTIMATE',basis:'MARKET_VALUE',currency:'SAR',
 valuationDate:'2026-09-05'},
 evidencePolicy:{minEvidenceCount:3,maxAssumptionBurdenRatio:1,maxLowGradeRatio:1},
 singleMethodPolicy:{allowedMethod:VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
 justification:'Explicit narrowly scoped preliminary method test'},
};
const i=gold['RE-GOLD-002_existing_building'].inputs;
const n=calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:i,leverageEnabled:false});
const copy=JSON.stringify(n);
const result=evaluateExistingBuildingValuation({caseId:'C65-AUDIT',legacyInput:i,legacyResult:n,valuationCase:cfg});
assert.equal(result.institutionalDecision.status,'HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
assert.equal(result.institutionalDecision.readyForInstitutionalDecision,false);
assert.equal(result.institutionalDecision.finalValueSar,null);
assert.equal(result.institutionalDecision.publicValuationReportExportAuthorized,false);
const b=result.institutionalDecision.blockers;
assert(b.length>=2);
for(const code of b){
 const ar=displayBlocker(code,'ar-SA'),en=displayBlocker(code,'en');
 assert(/[؀-ۿ]/.test(ar),'Arabic label required for '+code);
 assert(/[a-zA-Z]/.test(en),'English label required for '+code);
 assert(!ar.includes('محتوى واجهة غير معرّب'));
 assert(!ar.includes('حالة نظامية غير معرّفة'));
 assert(!ar.includes(code),'raw internal code leaked into Arabic UI');
}
const key='C62_SIGNED_METHOD_EVIDENCE_PACKET_REQUIRED';
assert(displayBlocker(VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION+':'+key,'ar-SA')
 .startsWith('رسملة الدخل المباشرة:'));
assert(displayBlocker('UNKNOWN_METHOD:'+key,'ar-SA').startsWith('متطلب خاص بأحد المناهج:'));
assert(displayBlocker('UNKNOWN_RATE_POLICY','ar-SA').includes('السجل التدقيقي'));
assert(displayBlocker('', 'ar-SA').includes('السجل التدقيقي'));
assert.equal(institutionalStatusText('ar-SA'),'الاعتماد المؤسسي معلّق إلى حين التحقق الخارجي');
assert.equal(institutionalCountLabel(4,'ar-SA'),'عدد متطلبات التعليق: 4');
assert.equal(institutionalCountLabel(4,'en'),'Outstanding institutional requirements: 4');
assert(!displayEvidenceGap(0,'ar-SA').includes('محتوى واجهة غير معرّب'));
assert(Object.isFrozen(AR));assert(Object.isFrozen(EN));
assert.deepEqual(JSON.stringify(n),copy);
const ui=fs.readFileSync(path.join(__dirname,'../../src/components/ValuationIntelligenceBasePanel.jsx'),'utf8');
assert(ui.includes('data-testid="institutional-hold-description"'));
assert(ui.includes('data-testid="institutional-hold-count"'));
assert(ui.includes('data-testid="institutional-hold-reasons"'));
assert(ui.includes('displayBlocker(reason,locale)'));
assert(ui.includes('displayEvidenceGap(index,locale)'));
assert(ui.includes('data-c62-status={institutionalDecision.status}'));
console.log('C65_ARABIC_INSTITUTIONAL_REASONS=PASS');
console.log('C65_BACKEND_FINANCIAL_INTEGRITY_UNCHANGED=TRUE');
console.log('C65_INDEPENDENT_SAUDI_SOURCE_AUTHENTICITY=FALSE');
