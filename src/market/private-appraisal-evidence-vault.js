'use strict';
// Server-side storage contract, NOT a deployed service. The external authenticated backend,
// tenant boundary, KMS, PDPL retention policy and audit persistence must be supplied.
const crypto=require('node:crypto');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {isPlainJson}=require('../validation/plain-json-boundary');
const MAX_BYTES=20*1024*1024;
const VERSION='STARTAK_PRIVATE_APPRAISAL_VAULT_CONTRACT_V1';
// New envelopes authenticate the immutable metadata with GCM AAD.
// Old envelopes lacking this marker must undergo a controlled, verified migration.
const ENVELOPE_AUTH_VERSION=2;
const VERSIONED_KEY_ENVELOPE_AUTH_VERSION=3;
const SHA=/^[a-f0-9]{64}$/i, REF=/^[a-zA-Z0-9_.:-]{2,128}$/;
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function privateRef(s,label){if(typeof s!=='string'||!REF.test(s))throw Error(label+'_INVALID');return s;}
function decodeCanonical(s,max,exact=null){if(typeof s!=='string'||s.length>Math.ceil(max/3)*4||!s.length||s.length%4!==0)throw Error('EVIDENCE_ENVELOPE_INVALID');const b=Buffer.from(s,'base64');if(!b.length||b.length>max||(exact!==null&&b.length!==exact)||b.toString('base64')!==s)throw Error('EVIDENCE_ENVELOPE_INVALID');return b;}
function storageId(tenant,ref){return 'appraisal-evidence:v1:'+encodeURIComponent(privateRef(tenant,'TENANT'))+':'+encodeURIComponent(privateRef(ref,'EVIDENCE_REF'));}
async function role(requestActor,tenant,caseRef,permitted,authorizeActor,action){
 // The caller's actor object is an *untrusted request hint*. Never accept
 // authenticatedByTrustedBackend / role / tenant directly from user input.
 let context;
 try { context=await authorizeActor({requestActor,tenantId:tenant,caseRef,action}); }
 catch(_) { throw Error('EVIDENCE_ACCESS_DENIED'); }
 if(!context||typeof context!=='object'||!isPlainJson(context)||context===requestActor||
    context.verifiedByServer!==true||context.tenantId!==tenant||
    !permitted.includes(context.role)||typeof context.actorId!=='string'||
    !REF.test(context.actorId)||!Array.isArray(context.caseRefs)||
    !context.caseRefs.includes(caseRef))
   throw Error('EVIDENCE_ACCESS_DENIED');
 return context;
}
function authenticatedEnvelopeMetadata(v){
 // Fixed field order avoids a canonicalization mismatch between put and read.
 const fields=[
  v.version,v.envelopeAuthVersion,v.tenantId,v.evidenceRef,v.caseRef,
  v.sha256,v.uploadedByActorRef,v.uploadedAt,
  v.legalReuseRightsVerified,v.independentlyProfessionallyReviewed,
  v.releaseAuthorized,v.storageAdapterSecurityVerified,
 ];
 if(v.envelopeAuthVersion===VERSIONED_KEY_ENVELOPE_AUTH_VERSION)fields.push(v.keyRef);
 return Buffer.from(JSON.stringify(fields));
}
function keyFrom(keyProvider,tenant){
 const k=keyProvider(tenant);
 if(!Buffer.isBuffer(k)||k.length!==32)throw Error('EXTERNAL_KMS_KEY_REQUIRED');
 return Buffer.from(k);
}
// This is a trusted server-side key-provider contract, not a KMS implementation.
function versionedKey(record,tenant,expectedRef=null){
 if(!record||typeof record!=='object'||record.tenantId!==tenant||typeof record.keyRef!=='string'||!REF.test(record.keyRef)||!Buffer.isBuffer(record.keyBytes)||record.keyBytes.length!==32||(expectedRef!==null&&record.keyRef!==expectedRef))throw Error('EXTERNAL_KMS_KEY_SCOPE_OR_VERSION_INVALID');
 return {keyRef:record.keyRef,key:Buffer.from(record.keyBytes)};
}
function makePrivateAppraisalVault({adapter,keyProvider,keyring,authorizeActor,restoreInventoryProvider,clock=()=>new Date()}={}){
 if(!adapter||typeof adapter.get!=='function'||typeof adapter.putIfAbsent!=='function'||
  (typeof keyProvider!=='function'&&!keyring)||typeof authorizeActor!=='function'||typeof clock!=='function'||
  (keyring!==undefined&&(!keyring||typeof keyring.activeKey!=='function'||typeof keyring.resolveKey!=='function'))||
  (restoreInventoryProvider!==undefined&&typeof restoreInventoryProvider!=='function'))
  throw Error('TRUSTED_ADAPTER_KMS_AND_SERVER_AUTHORIZER_REQUIRED');
 const idOf=storageId;
 async function writeKey(tenant){return keyring?versionedKey(await keyring.activeKey(tenant),tenant):{keyRef:null,key:keyFrom(keyProvider,tenant)};}
 async function readKey(tenant,v){if(v.envelopeAuthVersion===VERSIONED_KEY_ENVELOPE_AUTH_VERSION){if(!keyring)throw Error('EXTERNAL_VERSIONED_KMS_REQUIRED');return versionedKey(await keyring.resolveKey(tenant,v.keyRef),tenant,v.keyRef).key;}if(typeof keyProvider!=='function')throw Error('EXPLICIT_LEGACY_KEY_PROVIDER_REQUIRED');return keyFrom(keyProvider,tenant);}
 async function put({actor,tenantId,evidenceRef,caseRef,sourceBytes,expectedSha256}={}){
  privateRef(tenantId,'TENANT');privateRef(caseRef,'CASE');privateRef(evidenceRef,'EVIDENCE_REF');
  if(!Buffer.isBuffer(sourceBytes)||!sourceBytes.length||sourceBytes.length>MAX_BYTES)
   throw Error('EVIDENCE_BYTES_INVALID');
  // Snapshot before the first asynchronous boundary; caller cannot change
  // the bytes between digest calculation and encrypted persistence.
  const snapshot=Buffer.from(sourceBytes);
  try{
  const identity=await role(actor,tenantId,caseRef,['REVIEWER','DATA_ADMIN'],
    authorizeActor,'APPRAISAL_EVIDENCE_WRITE');
  const actorId=identity.actorId;
  const sha=digest(snapshot);
  if(typeof expectedSha256!=='string'||!SHA.test(expectedSha256)||expectedSha256.toLowerCase()!==sha)
   throw Error('EVIDENCE_SOURCE_DIGEST_MISMATCH');
  const storageKey=idOf(tenantId,evidenceRef);
  if(await adapter.get(storageKey)!==null)throw Error('EVIDENCE_IMMUTABLE_REF_ALREADY_EXISTS');
  const uploadedAt=clock().toISOString();
  if(!Number.isFinite(strictCalendarDateMs(uploadedAt))||strictCalendarDateMs(uploadedAt)>Date.now())throw Error('EVIDENCE_CLOCK_INVALID');
  const active=await writeKey(tenantId);
  const metadata={version:VERSION,envelopeAuthVersion:active.keyRef===null?ENVELOPE_AUTH_VERSION:VERSIONED_KEY_ENVELOPE_AUTH_VERSION,
   ...(active.keyRef===null?{}:{keyRef:active.keyRef}),
   tenantId,evidenceRef,caseRef,sha256:sha,
   uploadedByActorRef:actorId,uploadedAt,
   legalReuseRightsVerified:false,independentlyProfessionallyReviewed:false,
   releaseAuthorized:false,storageAdapterSecurityVerified:false};
  const iv=crypto.randomBytes(12);
  const key=active.key;
  let cipher,enc;
  try{cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(authenticatedEnvelopeMetadata(metadata));enc=Buffer.concat([cipher.update(snapshot),cipher.final()]);}
  finally{key.fill(0);}
  const core={...metadata,iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),ciphertext:enc.toString('base64')};
  // Atomic insert prevents parallel reviewers from silently overwriting the same immutable ref.
  if(await adapter.putIfAbsent(storageKey,JSON.stringify(core))!==true)
   throw Error('EVIDENCE_IMMUTABLE_REF_ALREADY_EXISTS');
  return {tenantId,evidenceRef,caseRef,sha256:sha,status:'SEALED_UNVERIFIED',
    professionalValueReleaseAuthorized:false};
  }finally{snapshot.fill(0);}
 }
 async function read({actor,tenantId,evidenceRef,caseRef}={}){
  privateRef(tenantId,'TENANT');privateRef(evidenceRef,'EVIDENCE_REF');
  privateRef(caseRef,'CASE');
  await role(actor,tenantId,caseRef,['REVIEWER','DATA_ADMIN','AUDITOR'],
    authorizeActor,'APPRAISAL_EVIDENCE_READ');
  const raw=await adapter.get(idOf(tenantId,evidenceRef));
  if(raw===null){
   // Ambiguous historical colon-delimited keys cannot be safely adopted.
   // Explicit operator migration with authenticated old envelope is required.
   if(tenantId.includes(':')||evidenceRef.includes(':'))throw Error('EVIDENCE_LEGACY_NAMESPACE_MIGRATION_REQUIRED_OR_NOT_FOUND');
   return {found:false};
  }
  if(typeof raw!=='string'||raw.length>35*1024*1024)throw Error('EVIDENCE_ENVELOPE_INVALID');
  let v;try{v=JSON.parse(raw);}catch{throw Error('EVIDENCE_ENVELOPE_INVALID');}
  if(!isPlainJson(v)||!v||typeof v!=='object'||Array.isArray(v)||v.version!==VERSION||v.tenantId!==tenantId||v.evidenceRef!==evidenceRef||
   typeof v.caseRef!=='string'||!REF.test(v.caseRef)||typeof v.sha256!=='string'||!SHA.test(v.sha256))throw Error('EVIDENCE_CONTEXT_TAMPERED');
  if(v.caseRef!==caseRef)throw Error('EVIDENCE_CASE_SCOPE_MISMATCH');
  if(![ENVELOPE_AUTH_VERSION,VERSIONED_KEY_ENVELOPE_AUTH_VERSION].includes(v.envelopeAuthVersion))
   throw Error('EVIDENCE_LEGACY_ENVELOPE_REQUIRES_AUTHENTICATED_MIGRATION');
  if(v.envelopeAuthVersion===VERSIONED_KEY_ENVELOPE_AUTH_VERSION?(typeof v.keyRef!=='string'||!REF.test(v.keyRef)):Object.hasOwn(v,'keyRef'))throw Error('EVIDENCE_KEY_VERSION_INVALID');
  if(typeof v.uploadedByActorRef!=='string'||!REF.test(v.uploadedByActorRef)||typeof v.uploadedAt!=='string'||!Number.isFinite(strictCalendarDateMs(v.uploadedAt))||strictCalendarDateMs(v.uploadedAt)>Date.now()||
     v.legalReuseRightsVerified!==false||
     v.independentlyProfessionallyReviewed!==false||
     v.releaseAuthorized!==false||v.storageAdapterSecurityVerified!==false)
   throw Error('EVIDENCE_ENVELOPE_METADATA_INVALID');
  try{
   const iv=decodeCanonical(v.iv,12,12),tag=decodeCanonical(v.tag,16,16),encrypted=decodeCanonical(v.ciphertext,MAX_BYTES);
   const key=await readKey(tenantId,v);
   let bytes;
   try{const dec=crypto.createDecipheriv('aes-256-gcm',key,iv);dec.setAAD(authenticatedEnvelopeMetadata(v));dec.setAuthTag(tag);bytes=Buffer.concat([dec.update(encrypted),dec.final()]);}
   finally{key.fill(0);}
   if(digest(bytes)!==v.sha256)throw Error('EVIDENCE_BYTES_DIGEST_TAMPERED');
   return {found:true,sourceBytes:bytes,sha256:v.sha256,caseRef:v.caseRef,
    releaseAuthorized:false,professionalReviewVerified:false};
  }catch(e){if(e.message==='EVIDENCE_BYTES_DIGEST_TAMPERED')throw e;
   throw Error('EVIDENCE_DECRYPTION_OR_INTEGRITY_FAILED');}
 }
 // Verify a restored adapter against an inventory from a separately supplied
 // trusted server provider, not against a manifest submitted by the requester.
 async function verifyRestoredInventory({actor,tenantId,caseRef,inventoryRef}={}){
  privateRef(tenantId,'TENANT');privateRef(caseRef,'CASE');privateRef(inventoryRef,'INVENTORY');
  await role(actor,tenantId,caseRef,['DATA_ADMIN','AUDITOR'],authorizeActor,'APPRAISAL_EVIDENCE_RESTORE_VERIFY');
  const held=(reason)=>Object.freeze({status:'HOLD_RESTORE_VERIFICATION',reason,verifiedCount:0,expectedCount:null,independentBackupAuthenticityEstablished:false,productionRecoveryVerified:false,releaseAuthorized:false});
  if(!restoreInventoryProvider)return held('TRUSTED_RESTORE_INVENTORY_PROVIDER_REQUIRED');
  let inventory;try{inventory=await restoreInventoryProvider({tenantId,caseRef,inventoryRef});}catch{return held('RESTORE_INVENTORY_UNAVAILABLE');}
  if(!isPlainJson(inventory)||!inventory||inventory.tenantId!==tenantId||inventory.caseRef!==caseRef||inventory.inventoryRef!==inventoryRef||!Array.isArray(inventory.entries)||!inventory.entries.length||inventory.entries.length>500)return held('RESTORE_INVENTORY_INVALID');
  const seen=new Set();
  for(const e of inventory.entries){
   if(!e||typeof e.evidenceRef!=='string'||!REF.test(e.evidenceRef)||typeof e.sha256!=='string'||!SHA.test(e.sha256)||seen.has(e.evidenceRef))return held('RESTORE_INVENTORY_ENTRY_INVALID');
   seen.add(e.evidenceRef);
  }
  const entries=inventory.entries.map(e=>({evidenceRef:e.evidenceRef,sha256:e.sha256.toLowerCase()})).sort((a,b)=>a.evidenceRef<b.evidenceRef?-1:a.evidenceRef>b.evidenceRef?1:0);
  let verified=0;
  for(const e of entries){
   try{const result=await read({actor,tenantId,caseRef,evidenceRef:e.evidenceRef});try{if(result.found&&result.sha256===e.sha256)verified++;}finally{if(Buffer.isBuffer(result.sourceBytes))result.sourceBytes.fill(0);}}
   catch{/* Do not disclose individual storage or authorization failure details. */}
  }
  return Object.freeze({status:verified===entries.length?'RESTORED_EXPECTED_INVENTORY_MATCHED':'HOLD_RESTORE_VERIFICATION',reason:verified===entries.length?null:'RESTORE_INVENTORY_MISMATCH_OR_ACCESS_DENIED',verifiedCount:verified,expectedCount:entries.length,inventoryBindingSha256:digest(Buffer.from(JSON.stringify([tenantId,caseRef,inventoryRef,entries]))),independentBackupAuthenticityEstablished:false,productionRecoveryVerified:false,releaseAuthorized:false});
 }
 return Object.freeze({put,read,verifyRestoredInventory,version:VERSION,institutionalDeploymentVerified:false});
}
module.exports={VERSION,ENVELOPE_AUTH_VERSION,VERSIONED_KEY_ENVELOPE_AUTH_VERSION,makePrivateAppraisalVault};
