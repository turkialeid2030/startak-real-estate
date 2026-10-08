'use strict';
const assert=require('node:assert/strict');
const {createHash,randomBytes}=require('node:crypto');
const {
 STATE,EVENT,createCustodyLedger,verifyCustodyLedger,appendCustodyEvent,
}=require('../../src/security/c73-signed-document-custody');
const {assessLocalDocumentManifest}=require('../../src/app/specialist-document-intake');
const KEY=randomBytes(32),OTHER_KEY=randomBytes(32),KEY_REF='staging-test-key-1';
const PDF=Buffer.from('%PDF-1.4\n1 0 obj\nC73 synthetic only\nendobj\n');
const PNG=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68]);
const JPEG=Buffer.from([255,216,255,224,0,0,255,217]);
const NOW='2026-10-08T12:00:00.000Z';
const LATER='2026-10-08T12:01:00.000Z';
const AFTER='2026-10-08T12:02:00.000Z';
let checks=0;
function check(name,fn){try{fn();checks++;}catch(e){e.message=name+': '+e.message;throw e;}}
function scope(tenantId='tenant-a'){
 return {tenantId,caseId:'CASE-C73-01',projectId:'PROJECT-C73',
  propertyRef:'PROPERTY-C73',valuationDate:'2026-10-08',documentId:'DOCUMENT-C73-01',
  evidenceType:'inspection',referenceId:'INSPECTION-C73',artifactVersion:1,
  mediaType:'application/pdf'};
}
function verified(ledger,opts={}){
 return verifyCustodyLedger(ledger,{
  key:KEY,keyRef:KEY_REF,expectedScope:scope(),
  expectedHeadTag:ledger.headTag,expectedRevision:ledger.events.length,
  assessedAt:AFTER,maxAgeSeconds:3600,...opts,
 });
}
function copy(x){return JSON.parse(JSON.stringify(x));}
const record=createCustodyLedger({key:KEY,keyRef:KEY_REF,scope:scope(),
  bytes:PDF,actorRef:'test-issuer-not-a-licensed-valuer',observedAt:NOW});
check('server observed correct real synthetic bytes',()=>{
 assert.equal(record.scope.sha256Hex,createHash('sha256').update(PDF).digest('hex'));
 assert.equal(record.scope.sizeBytes,PDF.length);
 assert.equal(record.scope.tenantId,'tenant-a');
 assert.equal(record.events.length,1);
 assert.equal(Object.isFrozen(record.events[0]),true);
});
check('integrity holds external official authority',()=>{
 const v=verified(record);
 assert.equal(v.status,STATE.INTEGRITY_MATCHED_UNVERIFIED);
 assert.equal(v.integrityVerified,true);
 for(const f of ['bytesPersistedByThisModule','malwareScannedByThisModule',
  'sourceIndependentlyVerified','sourceRightsVerified','reviewerLicenseVerified',
  'professionalReportAuthorized','transactionAuthorized','productionVaultReady'])
  assert.equal(v[f],false);
});
check('same JSON record roundtrips within trusted head',()=>{
 assert.equal(verified(copy(record)).status,STATE.INTEGRITY_MATCHED_UNVERIFIED);
});
check('missing high water mark rejects replay',()=>{
 assert.equal(verified(record,{expectedHeadTag:undefined}).status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
 assert.equal(verified(record,{expectedRevision:undefined}).status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
});
check('key and key ref mismatches reject',()=>{
 assert.equal(verified(record,{key:OTHER_KEY}).status,STATE.HOLD_INTEGRITY);
 assert.equal(verified(record,{keyRef:'rotated-key'}).status,STATE.HOLD_INTEGRITY);
});
check('all required trusted scope identifiers protected',()=>{
 const attrs=['tenantId','caseId','projectId','propertyRef','valuationDate',
  'documentId','evidenceType','referenceId','artifactVersion'];
 for(const f of attrs){
  const expected=scope();
  expected[f]=f==='artifactVersion'?2:'DIFFERENT-'+f;
  assert.equal(verified(record,{expectedScope:expected}).status,
   STATE.HOLD_SCOPE_MISMATCH,f);
  delete expected[f];
  assert.equal(verified(record,{expectedScope:expected}).status,
   STATE.HOLD_SCOPE_MISMATCH,f+' absent');
 }
 assert.equal(verified(record,{expectedScope:null}).status,STATE.HOLD_SCOPE_MISMATCH);
});
check('never accept unsigned client claims of professional approval',()=>{
 for(const candidate of [
  {...copy(record),licensedReviewerApproved:true},
  {...copy(record),sourceRightsVerified:true},
  {...copy(record),status:'OFFICIALLY_AUTHORIZED'},
  {...copy(record),scope:{...record.scope,sourceVerified:true}},
  {...copy(record),events:[{...record.events[0],professionalReportAuthorized:true}]},
 ]){
  assert.equal(verified(candidate).status,STATE.HOLD_INTEGRITY);
 }
});
check('cross tenant/case transfer and digest mutation are rejected',()=>{
 for(const field of ['tenantId','caseId','projectId','propertyRef','documentId',
  'referenceId','evidenceType','valuationDate','sha256Hex','mediaType','sizeBytes',
  'artifactVersion','nonce']){
  const altered=copy(record);
  altered.scope[field]=field==='artifactVersion'?3:
    field==='sizeBytes'?PDF.length+1:field==='valuationDate'?'2026-09-01':
    field==='mediaType'?'image/png':field==='sha256Hex'?'a'.repeat(64):
    field==='nonce'?'f'.repeat(32):'MUTATED';
  assert.notEqual(verified(altered).status,STATE.INTEGRITY_MATCHED_UNVERIFIED,field);
 }
});
check('reject malformed signatures and deleted or replaced events',()=>{
 const wrongTag=copy(record);wrongTag.events[0].tag='0'.repeat(64);
 assert.equal(verified(wrongTag).status,STATE.HOLD_INTEGRITY);
 const removed=copy(record);removed.events=[];
 assert.equal(verified(removed).status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
 const wrongVersion=copy(record);wrongVersion.schemaVersion=0;
 assert.equal(verified(wrongVersion).status,STATE.HOLD_INTEGRITY);
 const otherKind=copy(record);otherKind.events[0].kind='OFFICIALLY_AUTHORIZED';
 assert.equal(verified(otherKind).status,STATE.HOLD_INTEGRITY);
});
check('wrong key, unsafe weak key, or forged type cannot mint custody',()=>{
 assert.throws(()=>createCustodyLedger({key:Buffer.alloc(8),keyRef:KEY_REF,scope:scope(),
  bytes:PDF,actorRef:'actor',observedAt:NOW}),/256_BIT/);
 assert.throws(()=>createCustodyLedger({key:'source-controlled-secret',keyRef:KEY_REF,
  scope:scope(),bytes:PDF,actorRef:'actor',observedAt:NOW}),/256_BIT/);
 assert.throws(()=>createCustodyLedger({key:KEY,keyRef:KEY_REF,scope:scope(),
  bytes:PDF,actorRef:'actor',observedAt:'2026-10-08T12:00:00Z'}),/UTC_TIMESTAMP/);
 assert.throws(()=>createCustodyLedger({key:KEY,keyRef:KEY_REF,
  scope:{...scope(),mediaType:'image/png'},bytes:PDF,
  actorRef:'actor',observedAt:NOW}),/FILE_HEADER/);
 assert.throws(()=>createCustodyLedger({key:KEY,keyRef:KEY_REF,
  scope:{...scope(),valuationDate:'2026-02-30'},bytes:PDF,
  actorRef:'actor',observedAt:NOW}),/VALUATION_DATE/);
});
check('valid synthetic png jpeg receive different true byte fingerprints',()=>{
 for(const [mediaType,bytes] of [['image/png',PNG],['image/jpeg',JPEG]]){
  const p=createCustodyLedger({key:KEY,keyRef:KEY_REF,
   scope:{...scope(),mediaType,documentId:'IMAGE-'+mediaType},
   bytes,actorRef:'actor',observedAt:NOW});
  assert.equal(p.scope.sha256Hex,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(verified(p,{expectedScope:{...scope(),documentId:'IMAGE-'+mediaType}})
    .status,STATE.INTEGRITY_MATCHED_UNVERIFIED);
 }
});
const checked=appendCustodyEvent(record,{key:KEY,keyRef:KEY_REF,
 expectedScope:scope(),expectedHeadTag:record.headTag,expectedRevision:1,
 bytes:PDF,actorRef:'checker',observedAt:LATER,kind:EVENT.RECHECKED});
check('recheck appends immutable signed chain and preserves original',()=>{
 assert.equal(record.events.length,1);
 assert.equal(checked.events.length,2);
 assert.equal(checked.events[1].previousTag,record.headTag);
 assert.notEqual(checked.headTag,record.headTag);
 assert.equal(verified(checked).status,STATE.INTEGRITY_MATCHED_UNVERIFIED);
});
check('replay old full signed ledger fails against newer trusted head',()=>{
 assert.equal(verified(record,{expectedHeadTag:checked.headTag,expectedRevision:2})
  .status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
 assert.equal(verified(checked,{expectedHeadTag:record.headTag,expectedRevision:1})
  .status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
});
check('mutation or out of order chain events invalid',()=>{
 const missing=copy(checked);missing.events.pop();
 assert.equal(verified(missing).status,STATE.HOLD_TRUSTED_HEAD_REQUIRED);
 const altered=copy(checked);altered.events[1].previousTag='a'.repeat(64);
 assert.equal(verified(altered).status,STATE.HOLD_INTEGRITY);
 const reverse=copy(checked);reverse.events.reverse();
 assert.equal(verified(reverse).status,STATE.HOLD_INTEGRITY);
 const backdate=copy(checked);backdate.events[1].observedAt=NOW;
 assert.equal(verified(backdate).status,STATE.HOLD_INTEGRITY);
});
check('recheck requires same actual physical bytes',()=>{
 const mutated=Buffer.from(PDF);mutated[12]^=1;
 assert.throws(()=>appendCustodyEvent(record,{key:KEY,keyRef:KEY_REF,
  expectedScope:scope(),expectedHeadTag:record.headTag,expectedRevision:1,
  bytes:mutated,actorRef:'checker',observedAt:LATER,kind:EVENT.RECHECKED}),
  /BYTE_RECHECK_MISMATCH/);
});
check('reject backdated and unsupported event writes',()=>{
 const options={key:KEY,keyRef:KEY_REF,expectedScope:scope(),
  expectedHeadTag:record.headTag,expectedRevision:1,
  actorRef:'checker',observedAt:LATER,kind:EVENT.RECHECKED,bytes:PDF};
 assert.throws(()=>appendCustodyEvent(record,{...options,kind:'SOURCE_VERIFIED'}),/EVENT_KIND/);
 assert.throws(()=>appendCustodyEvent(record,{...options,observedAt:NOW}),/CURRENT_SIGNED|NONMONOTONIC/);
});
check('stale and future attestations hold without authority',()=>{
 assert.equal(verified(record,{assessedAt:NOW,maxAgeSeconds:0}).status,
  STATE.INTEGRITY_MATCHED_UNVERIFIED);
 assert.equal(verified(record,{assessedAt:AFTER,maxAgeSeconds:1}).status,
  STATE.HOLD_STALE);
 assert.equal(verified(record,{assessedAt:'2026-10-08T11:59:59.000Z'}).status,
  STATE.HOLD_FUTURE_EVENT);
 assert.equal(verified(record,{maxAgeSeconds:undefined}).status,STATE.HOLD_STALE);
});
const revoked=appendCustodyEvent(checked,{key:KEY,keyRef:KEY_REF,
 expectedScope:scope(),expectedHeadTag:checked.headTag,expectedRevision:2,
 actorRef:'reviewer',observedAt:AFTER,kind:EVENT.REVOKED});
check('revoked evidence cannot be promoted or rechecked',()=>{
 const result=verified(revoked,{assessedAt:'2026-10-08T12:03:00.000Z'});
 assert.equal(result.status,STATE.HOLD_REVOKED);
 assert.equal(result.professionalReportAuthorized,false);
 assert.throws(()=>appendCustodyEvent(revoked,{key:KEY,keyRef:KEY_REF,
  expectedScope:scope(),expectedHeadTag:revoked.headTag,expectedRevision:3,
  actorRef:'checker',observedAt:'2026-10-08T12:04:00.000Z',
  kind:EVENT.RECHECKED,bytes:PDF}),/CURRENT_SIGNED_CUSTODY_REQUIRED/);
});
check('local C72 manifest remains non-authorizing',()=>{
 assert.equal(assessLocalDocumentManifest({}).officialReportAuthorized,false);
});
console.log('C73_SIGNED_CUSTODY_INTEGRITY=PASS checks='+checks);
console.log('C73_TRUSTED_PERSISTED_HIGH_WATER_MARK=NOT_IMPLEMENTED');
console.log('C73_EXTERNAL_SOURCE_RIGHTS_LICENSE_VAULT=HOLD');
