'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {emptySpecialistReferenceIntake,EVIDENCE_TYPES}=require('../../src/app/specialist-reference-intake');
const {
 MAX_BYTES,emptyManifest,normalizeManifest,fingerprintLocalFile,addDocumentHash,
 assessLocalDocumentManifest,
}=require('../../src/app/specialist-document-intake');
const {evaluateExistingBuildingValuation}=require('../../src/app/existing-building-valuation-runtime');
const {buildC6SavedDeal}=require('../fixtures/c6-governed-saved-deal');
const {evaluateGovernedDecisionOperationalState}=require('../../src/app/governed-decision-operational');
const {evaluateControlledHumanReviewState}=require('../../src/decision-intelligence/governed-human-review');

function clone(obj){return JSON.parse(JSON.stringify(obj));}
function fakeFile(bytes,type='application/pdf'){
 return {type,size:bytes.length,async arrayBuffer(){
  return Uint8Array.from(bytes).buffer;
 }};
}
const content=Buffer.from('%PDF-1.4\n1 0 obj\nC72 synthetic proof bytes\nendobj\n');
const changed=Buffer.from('%PDF-1.4\n1 0 obj\nC72 modified proof bytes\nendobj\n');
function caseFor(cls){
 const intake=emptySpecialistReferenceIntake(cls);
 intake.assetSubtype=cls===ASSET_CLASS.HOSPITALITY?'HOTEL_FULL_SERVICE':'WAREHOUSE';
 intake.propertyRef='مرجع العقار ٧٢';
 intake.asOf='2026-10-08';
 intake.evidenceRefs.inspection='معاينة محلية ٧٢';
 intake.evidenceRefs.zoning='ترخيص محلي ٧٢';
 const val={
  schemaVersion:1,projectId:'PROJECT-C72',
  classification:{assetClass:cls,lifecycleStage:'STABILIZED',investmentStrategy:'CORE_INCOME',incomeModel:'LEASE_INCOME'},
  incomePolicy:{expenseTreatment:'MARKET_ESTIMATE',basis:'MARKET_VALUE',currency:'SAR',valuationDate:'2026-09-05'},
  institutionalEvidence:{specialistIntake:intake},
 };
 return {intake,val};
}
async function run(){
 assert.equal(EVIDENCE_TYPES.length,9);
 for(const cls of [ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS]){
  const {intake,val}=caseFor(cls);
  assert.equal(MAX_BYTES,5*1024*1024);
  const record=await fingerprintLocalFile(fakeFile(content),intake,'inspection');
  assert.equal(record.sha256Hex,createHash('sha256').update(content).digest('hex'));
  assert.equal(record.sizeBytes,content.length);
  assert.equal(record.status,'LOCAL_HASH_ONLY_UNVERIFIED');
  assert.equal(record.bytesStored,false);
  assert.equal(record.sourceIndependentlyVerified,false);
  assert.equal(record.licensedReviewerApproved,false);
  const diff=await fingerprintLocalFile(fakeFile(changed),intake,'inspection');
  assert.notEqual(diff.sha256Hex,record.sha256Hex,'one-byte content variation must alter digest');
  let manifest=addDocumentHash(null,intake,record);
  assert.equal(manifest.entries.length,1);
  manifest=addDocumentHash(manifest,intake,diff);
  assert.equal(manifest.entries.length,1,'one control has only current digest');
  assert.equal(manifest.entries[0].sha256Hex,diff.sha256Hex);
  assert.equal(JSON.stringify(manifest).includes('synthetic proof bytes'),false);
  val.institutionalEvidence.specialistDocumentManifest=manifest;
  const roundtrip=clone(val);
  assert.equal(normalizeManifest(roundtrip.institutionalEvidence.specialistDocumentManifest,
    roundtrip.institutionalEvidence.specialistIntake).entries[0].sha256Hex,diff.sha256Hex);
  assert.equal(assessLocalDocumentManifest(roundtrip).hashedControlCount,1);
  assert.equal(assessLocalDocumentManifest(roundtrip).sourceIndependentlyVerified,false);
  assert.equal(assessLocalDocumentManifest(roundtrip).officialReportAuthorized,false);
  const runtime=evaluateExistingBuildingValuation({
   caseId:'C72-CASE',legacyInput:{},legacyResult:{},valuationCase:val,
  });
  assert.equal(runtime.specialistRoute.documentFingerprintIntake.hashedControlCount,1);
  assert.equal(runtime.specialistRoute.documentFingerprintIntake.status,'HOLD_LOCAL_HASH_NOT_PROVENANCE');
  assert.equal(runtime.institutionalDecision.readyForInstitutionalDecision,false);
  assert.equal(runtime.institutionalDecision.finalValueSar,null);

  const altered=clone(val);
  altered.institutionalEvidence.specialistDocumentManifest.entries[0].sha256Hex='a'.repeat(64);
  assert.equal(assessLocalDocumentManifest(altered).sourceIndependentlyVerified,false,
   'synthetic SHA metadata cannot claim real source authentication');
  altered.institutionalEvidence.specialistDocumentManifest.entries[0].licensedReviewerApproved=true;
  assert.equal(assessLocalDocumentManifest(altered).invalid,true,
   'forged professional authority in manifest rejected');
  assert.equal(evaluateExistingBuildingValuation({
   caseId:'C72-CASE',legacyInput:{},legacyResult:{},valuationCase:altered,
  }).institutionalDecision.transactionAuthorized,false);
  const shifted=clone(val);
  shifted.institutionalEvidence.specialistIntake.evidenceRefs.inspection='مرجع آخر';
  assert.equal(assessLocalDocumentManifest(shifted).invalid,true,'no cross-reference digest reuse');
  const differentAsset=caseFor(cls===ASSET_CLASS.HOSPITALITY?ASSET_CLASS.INDUSTRIAL_LOGISTICS:ASSET_CLASS.HOSPITALITY);
  assert.throws(()=>normalizeManifest(manifest,differentAsset.intake),/C72_MANIFEST_CASE_CONTEXT_MISMATCH/);
  await assert.rejects(()=>fingerprintLocalFile(fakeFile(Buffer.from('not a pdf')),intake,'inspection'),
    /C72_FILE_SIGNATURE_MISMATCH/);
  await assert.rejects(()=>fingerprintLocalFile(fakeFile(content,'application/octet-stream'),intake,'inspection'),
    /C72_FILE_MEDIA_REJECTED/);
  await assert.rejects(()=>fingerprintLocalFile({size:MAX_BYTES+1,type:'application/pdf',arrayBuffer(){
   throw Error('oversize MUST NEVER be read');
  }},intake,'inspection'),/C72_FILE_SIZE_OR_TYPE_REJECTED/);
  await assert.rejects(()=>fingerprintLocalFile(fakeFile(content),intake,'fireLifeSafety'),
    /C72_REFERENCE_REQUIRED_FIRST/);
  const deal=buildC6SavedDeal({now:new Date(),id:'DEAL-C72-'+cls});
  deal.valuationCase=clone(val);
  deal.valuationCase.projectId='PROJECT-C6-001';
  const c5=evaluateGovernedDecisionOperationalState({savedDealRecord:deal,asOf:new Date()});
  assert.equal(c5.canExport,false);
  assert.equal(c5.status,'HOLD_SPECIALIST_METHOD_NOT_QUALIFIED');
  const c6=evaluateControlledHumanReviewState({savedDealRecord:deal,asOf:new Date()});
  assert.equal(c6.canRecordReview,false);assert.equal(c6.canExportReviewedOutput,false);
  console.log('C72_ACTUAL_LOCAL_BYTE_DIGEST_TAMPER_AND_C61_HOLD_'+cls+'=PASS');
 }
 console.log('C72_PROFESSIONAL_SOURCE_RIGHTS_AND_DOC_VERIFICATION=FALSE');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
