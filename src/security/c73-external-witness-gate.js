'use strict';
// C73.3C server-only independent witness receipt verifier and fail-closed gate.
// Separate witness availability, issuer trust and durable WORM storage are
// deployment obligations: this module itself DOES NOT provision those services.
const {createPublicKey,verify:verifySignature,timingSafeEqual}=require('node:crypto');
const DOMAIN='STARTAK:C73.3C:EXTERNAL-WITNESS:V1\n';
const RECEIPT_FIELDS=['version','tenantId','documentId','revision','headTag','issuedAt'];
const HASH=/^[a-f0-9]{64}$/;
const SIGNATURE=/^[A-Za-z0-9_-]{86}$/;
function fail(code){const e=new Error(code);e.code=code;return e;}
function identity(x){
 return typeof x==='string'&&x.length>=1&&x.length<=180&&
  !/[\u0000-\u001f\u007f]/.test(x);
}
function fixed(a,b){
 return typeof a==='string'&&typeof b==='string'&&HASH.test(a)&&HASH.test(b)&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function canonical(payload){
 return Object.fromEntries(RECEIPT_FIELDS.map(key=>[key,payload[key]]));
}
function validate(receipt,key,now,maxAgeMs){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
   Object.keys(receipt).length!==2||
   !Object.hasOwn(receipt,'payload')||!Object.hasOwn(receipt,'signature'))
  throw fail('C73_WITNESS_RECEIPT_STRUCTURE_HOLD');
 const p=receipt.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).length!==RECEIPT_FIELDS.length||
  RECEIPT_FIELDS.some(k=>!Object.hasOwn(p,k))||
  p.version!==1||!identity(p.tenantId)||!identity(p.documentId)||
  !Number.isSafeInteger(p.revision)||p.revision<1||p.revision>1000||
  typeof p.headTag!=='string'||!HASH.test(p.headTag)||
  typeof p.issuedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.issuedAt))
  throw fail('C73_WITNESS_RECEIPT_FIELDS_HOLD');
 const observed=Date.parse(p.issuedAt);
 if(!Number.isFinite(observed)||new Date(observed).toISOString()!==p.issuedAt||
  observed>now+5000||observed<now-maxAgeMs)
  throw fail('C73_WITNESS_STALE_OR_FUTURE_HOLD');
 if(typeof receipt.signature!=='string'||!SIGNATURE.test(receipt.signature)||
  Buffer.from(receipt.signature,'base64url').length!==64)
  throw fail('C73_WITNESS_SIGNATURE_HOLD');
 const body=Buffer.from(DOMAIN+JSON.stringify(canonical(p)),'utf8');
 if(!verifySignature(null,body,key,Buffer.from(receipt.signature,'base64url')))
  throw fail('C73_WITNESS_SIGNATURE_HOLD');
 return p;
}
function createWitnessedCustodyGate({custodyService,witness,publicKey,clock,maxReceiptAgeSeconds=300}={}){
 if(!custodyService||!['observe','get','recheck','revoke'].every(x=>typeof custodyService[x]==='function')||
  !witness||typeof witness.readCheckpoint!=='function'||typeof witness.advanceCheckpoint!=='function'||
  typeof clock!=='function'||!Number.isSafeInteger(maxReceiptAgeSeconds)||
  maxReceiptAgeSeconds<1||maxReceiptAgeSeconds>3600)
  throw fail('C73_WITNESS_DEPENDENCIES_REQUIRED');
 let key;
 try{key=createPublicKey(publicKey);}catch{throw fail('C73_WITNESS_TRUSTED_PUBLIC_KEY_REQUIRED');}
 if(key.asymmetricKeyType!=='ed25519')throw fail('C73_WITNESS_ED25519_REQUIRED');
 function now(){
  const v=clock();
  if(!(v instanceof Date)||!Number.isFinite(v.getTime()))
   throw fail('C73_WITNESS_TRUSTED_CLOCK_REQUIRED');
  return v.getTime();
 }
 function verifyReceipt(receipt,tenantId,documentId,revision,headTag){
  const p=validate(receipt,key,now(),maxReceiptAgeSeconds*1000);
  if(p.tenantId!==tenantId||p.documentId!==documentId||
     p.revision!==revision||!fixed(p.headTag,headTag))
   throw fail('C73_WITNESS_DB_DIVERGENCE_HOLD');
  return p;
 }
 async function readVerified(ledger){
  const s=ledger?.scope;
  if(!s||!identity(s.tenantId)||!identity(s.documentId)||
     !Array.isArray(ledger.events)||ledger.events.length<1||
     !HASH.test(ledger.headTag||''))
   throw fail('C73_WITNESS_DB_SCOPE_HOLD');
  let signed;
  try{signed=await witness.readCheckpoint({tenantId:s.tenantId,documentId:s.documentId});}
  catch{throw fail('C73_WITNESS_READ_UNAVAILABLE_HOLD');}
  if(!signed)throw fail('C73_WITNESS_CHECKPOINT_MISSING_HOLD');
  verifyReceipt(signed,s.tenantId,s.documentId,ledger.events.length,ledger.headTag);
  return {revision:ledger.events.length,headTag:ledger.headTag,
   tenantId:s.tenantId,documentId:s.documentId};
 }
 async function advance(ledger,previous){
  const s=ledger.scope;
  const claimed={tenantId:s.tenantId,documentId:s.documentId,
    expectedRevision:previous?.revision||null,expectedHeadTag:previous?.headTag||null,
    revision:ledger.events.length,headTag:ledger.headTag};
  let signed;
  try{signed=await witness.advanceCheckpoint(claimed);}
  catch{throw fail('C73_WITNESS_COMMIT_UNAVAILABLE_HOLD');}
  if(!signed)throw fail('C73_WITNESS_COMMIT_UNAVAILABLE_HOLD');
  verifyReceipt(signed,s.tenantId,s.documentId,ledger.events.length,ledger.headTag);
 }
 async function observe(x){
  const created=await custodyService.observe(x);
  // Failure after DB+vault commit is a HOLD. Do NOT expose an active record or
  // attempt a fabricated witness receipt. Operational reconciliation required.
  await advance(created.ledger,null);
  return {...created,witness:{status:'EXTERNAL_RECEIPT_MATCHED_UNVERIFIED',
    professionalReportAuthorized:false,productionAuthorized:false}};
 }
 async function get(x){
  const record=await custodyService.get(x);
  await readVerified(record.ledger);
  return {...record,witness:{status:'EXTERNAL_RECEIPT_MATCHED_UNVERIFIED',
   professionalReportAuthorized:false,productionAuthorized:false}};
 }
 async function recheck(x){
  const previous=await get({request:x?.request,documentId:x?.documentId});
  const before={revision:previous.ledger.events.length,headTag:previous.ledger.headTag};
  const updated=await custodyService.recheck(x);
  await advance(updated.ledger,before);
  return updated;
 }
 async function revoke(x){
  const previous=await get({request:x?.request,documentId:x?.documentId});
  const before={revision:previous.ledger.events.length,headTag:previous.ledger.headTag};
  const updated=await custodyService.revoke(x);
  await advance(updated.ledger,before);
  return updated;
 }
 return Object.freeze({observe,get,recheck,revoke,
  productionTrustedWitnessReady:false,professionalReportAuthorized:false,
  independentWitnessInfrastructureProvisioned:false});
}
module.exports={createWitnessedCustodyGate,DOMAIN};
