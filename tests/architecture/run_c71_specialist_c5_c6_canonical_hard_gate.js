'use strict';
const assert=require('node:assert/strict');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {buildC6SavedDeal}=require('../fixtures/c6-governed-saved-deal');
const {C5_OPERATIONAL_STATUS,evaluateGovernedDecisionOperationalState,buildGovernedDecisionOperationalExport}=require('../../src/app/governed-decision-operational');
const {evaluateControlledHumanReviewState,buildGovernedHumanReview,buildGovernedReviewedDecisionExport}=require('../../src/decision-intelligence/governed-human-review');
const {EVIDENCE_TYPES,emptySpecialistReferenceIntake}=require('../../src/app/specialist-reference-intake');
const {validateSavedDealRecord}=require('../../src/validation/saved-deal-schema');

const now=new Date();
function specialistDeal(asset){
 const deal=buildC6SavedDeal({now,id:'DEAL-C71-'+asset});
 deal.name='C71 adverse specialist scenario';
 deal.valuationCase.classification={assetClass:asset};
 if(asset!==ASSET_CLASS.MIXED_USE){
  const intake=emptySpecialistReferenceIntake(asset);
  intake.assetSubtype=asset===ASSET_CLASS.HOSPITALITY?'HOTEL_FULL_SERVICE':'WAREHOUSE';
  intake.propertyRef='ملف متخصص ٧١';
  intake.asOf=now.toISOString().slice(0,10);
  for(const key of EVIDENCE_TYPES)intake.evidenceRefs[key]='مرجع محلي ٧١';
  deal.valuationCase.institutionalEvidence={
    specialistIntake:intake,
    // Deliberately forged user assertions, not independent reviewer proof.
    professionalValuationApproved:true,
    sourceRightsIndependentlyVerified:true,
  };
 }
 validateSavedDealRecord(deal);
 return deal;
}
for(const asset of [ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS,ASSET_CLASS.MIXED_USE]){
 const deal=specialistDeal(asset);
 const c5=evaluateGovernedDecisionOperationalState({savedDealRecord:deal,asOf:now});
 assert.equal(c5.status,C5_OPERATIONAL_STATUS.HOLD_SPECIALIST_METHOD_NOT_QUALIFIED);
 assert.equal(c5.canExport,false);
 assert.equal(c5.analyticalValueIndicationSar,null);
 assert.equal(c5.transactionAuthorized,false);
 assert(c5.reasonCodes.includes('C71_SPECIALIST_METHOD_NOT_OPERATIONALLY_QUALIFIED'));
 const c6=evaluateControlledHumanReviewState({savedDealRecord:deal,asOf:now});
 assert.equal(c6.status,'HOLD');
 assert.equal(c6.canRecordReview,false);
 assert.equal(c6.canExportReviewedOutput,false);
 assert.equal(c6.transactionAuthorized,false);
 assert.throws(()=>buildGovernedDecisionOperationalExport({savedDealRecord:deal,reportId:'C71-BLOCKED',generatedAt:now}),
  e=>e&&e.code==='C5_EXPORT_BLOCKED');
 assert.throws(()=>buildGovernedHumanReview({savedDealRecord:deal,reviewerId:'spoofed-licensed-valuer',
  recommendation:'HOLD_FOR_EVIDENCE',rationale:'synthetic reviewer must fail',reviewedAt:now}),
  e=>e&&e.code==='C6_REVIEW_BLOCKED');
 assert.throws(()=>buildGovernedReviewedDecisionExport({savedDealRecord:deal,reportId:'C71-BLOCKED',generatedAt:now}),
  e=>e&&e.code==='C6_REVIEWED_EXPORT_BLOCKED');
 console.log('C71_CANONICAL_C5_C6_SPECIALIST_BLOCK_'+asset+'=PASS');
}
const baseline=buildC6SavedDeal({now,id:'DEAL-C71-BUILDING'});
const v=evaluateGovernedDecisionOperationalState({savedDealRecord:baseline,asOf:now});
assert.equal(v.status,C5_OPERATIONAL_STATUS.READY_FOR_GOVERNED_EXPORT);
assert.equal(v.canExport,true);
const envelope=buildGovernedDecisionOperationalExport({savedDealRecord:baseline,reportId:'C71-BUILDING-C5',generatedAt:now});
assert.equal(envelope.classification,'NON_AUTHORIZING_ANALYTICAL_OUTPUT');
assert.equal(envelope.certifiedValuationEstablished,false);
assert.equal(envelope.transactionAuthorized,false);
console.log('C71_ORIGINAL_C5_GENERIC_BUILDING_ANALYTICAL_EXPORT_UNCHANGED=PASS');
console.log('C71_LICENSED_SPECIALIST_VALUATION_AND_REPORT=FALSE');
