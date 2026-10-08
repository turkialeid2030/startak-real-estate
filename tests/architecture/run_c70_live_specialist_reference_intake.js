'use strict';
const assert=require('node:assert/strict');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {EVIDENCE_TYPES,emptySpecialistReferenceIntake,normalizeSpecialistReferenceIntake,
 evaluateSpecialistReferenceIntake}=require('../../src/app/specialist-reference-intake');
const {evaluateExistingBuildingValuation}=require('../../src/app/existing-building-valuation-runtime');

function caseFor(assetClass){
 const intake=emptySpecialistReferenceIntake(assetClass);
 intake.assetSubtype=assetClass===ASSET_CLASS.HOSPITALITY?'HOTEL_FULL_SERVICE':'WAREHOUSE';
 intake.propertyRef='مرجع عقار ٧٠';
 intake.asOf='2026-10-08';
 intake.evidenceRefs.zoning='مرجع تخطيط ١';
 intake.evidenceRefs.titleInterest='مرجع صك ٢';
 intake.evidenceRefs.inspection='مرجع معاينة ٣';
 return {schemaVersion:1,projectId:'C70-SPECIALIST',
  classification:{assetClass,lifecycleStage:'STABILIZED',investmentStrategy:'CORE_INCOME',incomeModel:'LEASE_INCOME'},
  incomePolicy:{expenseTreatment:'MARKET_ESTIMATE',basis:'MARKET_VALUE',currency:'SAR',valuationDate:'2026-09-05'},
  institutionalEvidence:{specialistIntake:intake},
 };
}
function runtime(c){return evaluateExistingBuildingValuation({
 caseId:'C70-CASE',legacyInput:{rent:1000},legacyResult:{value:1200000},valuationCase:c,
});}
for(const cls of [ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS]){
 const c=caseFor(cls);
 const evidence=JSON.stringify(c.institutionalEvidence);
 const result=runtime(c);
 assert.equal(result.stage,null);
 assert.equal(result.presentation,null);
 assert.equal(result.institutionalDecision.readyForInstitutionalDecision,false);
 assert.equal(result.institutionalDecision.finalValueSar,null);
 assert.equal(result.institutionalDecision.publicValuationReportExportAuthorized,false);
 assert.equal(result.specialistRoute.referenceIntakeInvalid,false);
 const intake=result.specialistRoute.referenceIntake;
 assert.equal(intake.c61Status,'HOLD_SPECIALIZED_ASSET_EVIDENCE');
 assert.equal(intake.submittedReferenceCount,3);
 assert.equal(intake.requiredControlCount,EVIDENCE_TYPES.length);
 assert.equal(intake.metadataComplete,true);
 assert(intake.c61Blockers.length>=4);
 assert(intake.c61Blockers.some(x=>String(x).startsWith('SPECIALIST_CONTROL_UNRESOLVED')));
 assert.equal(intake.sourceRightsIndependentlyVerified,false);
 assert.equal(intake.professionalValuationApproved,false);
 assert.equal(intake.transactionAuthorized,false);
 assert.equal(intake.authorizedProfessionalReport,false);
 assert.equal(JSON.stringify(c.institutionalEvidence),evidence,'pure runtime cannot mutate original saved refs');
 const full=JSON.parse(JSON.stringify(c));
 for(const key of EVIDENCE_TYPES)full.institutionalEvidence.specialistIntake.evidenceRefs[key]='مرجع مستقل ١';
 const spoof=runtime(full);
 assert.equal(spoof.specialistRoute.referenceIntake.submittedReferenceCount,9);
 assert.equal(spoof.specialistRoute.referenceIntake.c61Status,'HOLD_SPECIALIZED_ASSET_EVIDENCE');
 assert.equal(spoof.institutionalDecision.finalValueSar,null);
 assert.equal(spoof.institutionalDecision.transactionAuthorized,false);
 const altered=JSON.parse(JSON.stringify(c));
 altered.institutionalEvidence.specialistIntake.evidenceRefs.zoning='https://malicious.test';
 assert.throws(()=>normalizeSpecialistReferenceIntake(altered.institutionalEvidence.specialistIntake,cls),/C70_UNSAFE_EVIDENCE_REFERENCE/);
 assert.equal(runtime(altered).specialistRoute.referenceIntakeInvalid,true);
 assert.equal(runtime(altered).institutionalDecision.readyForInstitutionalDecision,false);
 const cross=caseFor(cls===ASSET_CLASS.HOSPITALITY?ASSET_CLASS.INDUSTRIAL_LOGISTICS:ASSET_CLASS.HOSPITALITY);
 altered.institutionalEvidence.specialistIntake=cross.institutionalEvidence.specialistIntake;
 assert.equal(runtime(altered).specialistRoute.referenceIntakeInvalid,true);
 assert.equal(runtime(altered).institutionalDecision.finalValueSar,null);
 const forged=caseFor(cls);
 forged.institutionalEvidence.specialistIntake.evidenceRefs.inspection='مراجعة فنية';
 forged.institutionalEvidence.specialistIntake.evidenceRefs.professionalSpecialistReview='مقيم مرخص ١';
 const stillHold=runtime(forged);
 assert.equal(stillHold.specialistRoute.referenceIntake.c61Status,'HOLD_SPECIALIZED_ASSET_EVIDENCE');
 assert.equal(stillHold.institutionalDecision.professionalValuationApproved,false);
 console.log('C70_LIVE_SPECIALIST_C61_REFERENCE_HOLD_'+cls+'=PASS');
}
assert.equal(EVIDENCE_TYPES.length,9);
console.log('C70_REAL_INDEPENDENT_SAUDI_SOURCE_AND_LICENSE=FALSE');
