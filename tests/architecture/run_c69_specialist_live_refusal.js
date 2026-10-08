'use strict';
const assert=require('node:assert/strict');
const {VALUATION_METHOD}=require('../../src/valuation-intelligence');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {evaluateExistingBuildingValuation}=require('../../src/app/existing-building-valuation-runtime');
const {specializeUnsupportedValuationCase}=require('../../src/app/specialist-live-hold');
const {displayBlocker}=require('../../src/app/institutional-valuation-reason-presentation');

function configured(assetClass) {return {
 schemaVersion:1,projectId:'C69-SPECIALIST-'+assetClass,
 classification:{assetClass,lifecycleStage:'STABILIZED',investmentStrategy:'CORE_INCOME',incomeModel:'LEASE_INCOME'},
 incomePolicy:{expenseTreatment:'MARKET_ESTIMATE',basis:'MARKET_VALUE',currency:'SAR',valuationDate:'2026-09-05'},
};}
const legacyInput={marketRentPerSqm:1800,occupancyRate:0.92,marketCapRate:0.08};
const legacyResult={noi:5000000,propertyValue:62500000};
for(const asset of [ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS]){
 const valuationCase=configured(asset);
 const caseId='C69-SPECIALIST-'+asset;
 const res=evaluateExistingBuildingValuation({caseId,legacyInput,legacyResult,valuationCase});
 assert.equal(res.mode,'VALUATION_V1');
 assert.equal(res.stage,null);
 assert.equal(res.presentation,null);
 assert.equal(res.institutionalDecision.status,'HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
 assert.equal(res.institutionalDecision.finalValueSar,null);
 assert.equal(res.institutionalDecision.arithmeticPreliminaryValueSar,null);
 assert.equal(res.institutionalDecision.readyForInstitutionalDecision,false);
 assert.equal(res.institutionalDecision.publicValuationReportExportAuthorized,false);
 assert.equal(res.institutionalDecision.transactionAuthorized,false);
 assert.equal(res.specialistRoute.adapterIntegrated,false);
 assert.equal(res.specialistRoute.officialReportAuthorized,false);
 assert.equal(res.specialistRoute.status,'HOLD_SPECIALIST_METHOD_NOT_WIRED');
 assert.equal(res.institutionalDecision.blockers.length,6);
 assert(Object.isFrozen(res));
 assert(Object.isFrozen(res.specialistRoute.blockers));
 for(const blocker of res.institutionalDecision.blockers){
  const ar=displayBlocker(blocker,'ar-SA');
  assert(/[\u0600-\u06FF]/u.test(ar));
  assert(!ar.includes('محتوى واجهة غير معرّب'));
  assert(!ar.includes('حالة نظامية غير معرّفة'));
  assert(!ar.includes('السجل التدقيقي'),'unmapped specialist blocker: '+blocker);
 }
 assert.equal(specializeUnsupportedValuationCase({classification:{assetClass:ASSET_CLASS.OFFICE}}),null);
 console.log('C69_SPECIALIST_NO_GENERIC_VALUE_'+asset+'=PASS');
}
console.log('C69_EXTERNAL_HOTEL_INDUSTRIAL_EVIDENCE_AUTHENTICATED=FALSE');
