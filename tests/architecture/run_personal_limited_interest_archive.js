'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs');
const {
 createLimitedInterestArchive,verifyLimitedInterestArchive,canonicalState,MAX_ARCHIVE_BYTES,
 AMOUNT_FIELDS,CONFIRMATION_FIELDS,
}=require('../../src/valuation-intelligence/personal-limited-interest-case-archive');
const {RIGHTS}=require('../../src/valuation-intelligence/personal-limited-interest-dcf');

const sample=(assetClass='HOSPITALITY')=>({
 assetClass,right:RIGHTS.USUFRUCT,term:'14',valuationDate:'2026-10-25',
 inputs:Object.fromEntries(AMOUNT_FIELDS.map(k=>[k,'0'])),
 confirmed:Object.fromEntries(CONFIRMATION_FIELDS.map(k=>[k,false])),
});
async function rejected(value,expectedAssetClass='HOSPITALITY'){
 await assert.rejects(
  ()=>verifyLimitedInterestArchive(value,{subtle:webcrypto.subtle,expectedAssetClass}),
 );
}
async function main(){
 const state=sample();
 state.inputs.annualPropertyIncomeSar='4408730';
 state.inputs.annualGroundRentSar='2000000';
 state.inputs.nominalDiscountRate='0.10';
 state.confirmed.terms=true;
 const archive=await createLimitedInterestArchive(state,{subtle:webcrypto.subtle,
  createdAt:'2026-10-25T10:30:00.000Z'});
 assert.equal(archive.version,'PERSONAL_LIMITED_INTEREST_CASE_V1');
 assert.equal(archive.sha256.length,64);
 assert.ok(Buffer.byteLength(JSON.stringify(archive))<MAX_ARCHIVE_BYTES);
 const restored=await verifyLimitedInterestArchive(archive,{
  subtle:webcrypto.subtle,expectedAssetClass:'HOSPITALITY',
 });
 assert.deepEqual(restored,canonicalState(state));
 assert.equal('result' in restored,false);
 assert.equal('purchaseAuthorized' in restored,false);
 assert.equal('consentVerified' in restored,false); // user declaration remains nested; no independent approval
 const replacedValue=structuredClone(archive);
 replacedValue.state.inputs.annualGroundRentSar='1';
 await rejected(replacedValue);
 const forgedPermission=structuredClone(archive);
 forgedPermission.state.purchaseAuthorized=true;
 await rejected(forgedPermission);
 const unknownTop=structuredClone(archive);
 unknownTop.certifiedAppraisal=true;
 await rejected(unknownTop);
 const wrongSector=structuredClone(archive);
 await rejected(wrongSector,'RETAIL');
 const wrongBoolean=structuredClone(archive);
 wrongBoolean.state.confirmed.terms='true';
 await rejected(wrongBoolean);
 const wrongRight=structuredClone(archive);
 wrongRight.state.right='FREEHOLD';
 await rejected(wrongRight);
 const wrongDate=structuredClone(archive);
 wrongDate.createdAt='invalid';
 await rejected(wrongDate);
 const brokenHash=structuredClone(archive);
 brokenHash.sha256='0'.repeat(64);
 await rejected(brokenHash);
 const injected=structuredClone(archive);
 injected.state.confirmed.permissionsApproved=true;
 await rejected(injected);
 await assert.rejects(()=>createLimitedInterestArchive(
  {...state,inputs:{...state.inputs,annualGroundRentSar:'x'.repeat(300)}},
  {subtle:webcrypto.subtle}
 ));
 await assert.rejects(()=>createLimitedInterestArchive(state,{subtle:null}));
 const draft=sample('LAND');
 draft.right='';draft.term='';draft.valuationDate='';
 const draftArchive=await createLimitedInterestArchive(draft,{subtle:webcrypto.subtle});
 const draftRestore=await verifyLimitedInterestArchive(draftArchive,{
  subtle:webcrypto.subtle,expectedAssetClass:'LAND'});
 assert.deepEqual(draftRestore,canonicalState(draft));
 // Runtime UI must clear computed output and never restore authority.
 const ui=fs.readFileSync('src/components/PersonalLimitedInterestDcfPanel.jsx','utf8');
 assert.ok(ui.includes('الإيراد العقاري السنوي قبل مصروفات التشغيل'),
  'rights income must not be mislabeled as NOI then charged costs twice');
 for(const t of [
  'data-testid="limited-interest-export-case"',
  'data-testid="limited-interest-import-case"',
  'verifyLimitedInterestArchive(JSON.parse(raw)',
  'setConfirmed(restored.confirmed);setResult(null)',
  'expectedAssetClass:assetClass',
 ])assert.ok(ui.includes(t),'MISSING_UI_RIGHTS_ARCHIVE_'+t);
 console.log('RIGHTS_CASE_ARCHIVE_REGRESSION=PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
