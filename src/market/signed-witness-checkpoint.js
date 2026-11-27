'use strict';
// Authenticate witness responses, including absence, against a fresh request
// challenge. This is a trusted-server client contract, NOT witness persistence.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {VERSION:CUSTODY_VERSION}=require('./signed-evidence-custody');
const VERSION='STARTAK_WITNESS_RECEIPT_V1';
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,HASH=/^[a-f0-9]{64}$/;
const exact=(v,keys)=>isPlainJson(v)&&!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const isRef=x=>typeof x==='string'&&REF.test(x),isHash=x=>typeof x==='string'&&HASH.test(x);
function canonicalScope(s){
 if(!exact(s,['tenantId','caseRef','evidenceRef','sha256'])||![s.tenantId,s.caseRef,s.evidenceRef].every(isRef)||!isHash(s.sha256))throw Error('WITNESS_SCOPE_INVALID');
 return {tenantId:s.tenantId,caseRef:s.caseRef,evidenceRef:s.evidenceRef,sha256:s.sha256};
}
function canonicalReceipt(r){
 if(!exact(r,['version','scope','challenge','revision','headHashSha256','observedAt','signerKeyRef'])||r.version!==VERSION||!isHash(r.challenge)||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000||(r.revision===0?r.headHashSha256!==null:!isHash(r.headHashSha256))||!isRef(r.signerKeyRef))throw Error('WITNESS_RECEIPT_INVALID');
 const at=strictCalendarDateMs(r.observedAt);
 if(!Number.isFinite(at))throw Error('WITNESS_RECEIPT_TIME_INVALID');
 return {version:VERSION,scope:canonicalScope(r.scope),challenge:r.challenge,revision:r.revision,headHashSha256:r.headHashSha256,observedAt:new Date(at).toISOString(),signerKeyRef:r.signerKeyRef};
}
function witnessReceiptBytes(r){return Buffer.from('STARTAK:WITNESS-RECEIPT:ED25519:V1\n'+JSON.stringify(canonicalReceipt(r)));}
function makeVerifiedWitnessCheckpointProvider({loadReceipt,resolveWitnessSigner,clock=()=>new Date(),maxAgeSeconds=30}={}){
 if(![loadReceipt,resolveWitnessSigner,clock].every(x=>typeof x==='function')||!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<1||maxAgeSeconds>300)throw Error('WITNESS_TRUST_CONFIGURATION_INVALID');
 async function loadCheckpoint(scope){
  const s=Object.freeze(canonicalScope(scope)),challenge=crypto.randomBytes(32).toString('hex');
  const started=strictCalendarDateMs(clock().toISOString());
  if(!Number.isFinite(started)||started>Date.now())throw Error('WITNESS_CLOCK_INVALID');
  const response=await loadReceipt(Object.freeze({scope:s,challenge}));
  if(!exact(response,['receipt','signature'])||typeof response.signature!=='string'||response.signature.length!==88)throw Error('WITNESS_RECEIPT_REQUIRED');
  const receipt=canonicalReceipt(response.receipt),signature=Buffer.from(response.signature,'base64');
  if(signature.length!==64||signature.toString('base64')!==response.signature||receipt.challenge!==challenge||JSON.stringify(receipt.scope)!==JSON.stringify(s))throw Error('WITNESS_RECEIPT_BINDING_INVALID');
  const signer=await resolveWitnessSigner(Object.freeze({tenantId:s.tenantId,signerKeyRef:receipt.signerKeyRef}));
  const observed=strictCalendarDateMs(receipt.observedAt),now=strictCalendarDateMs(clock().toISOString());
  if(!Number.isFinite(now)||now>Date.now()||now<started||now-started>maxAgeSeconds*1000||observed<started||observed>now)throw Error('WITNESS_RECEIPT_STALE');
  if(!signer||signer.tenantId!==s.tenantId||signer.signerKeyRef!==receipt.signerKeyRef||signer.purpose!=='EVIDENCE_WITNESS_SIGNING'||signer.revoked!==false||!(signer.publicKey instanceof crypto.KeyObject)||signer.publicKey.type!=='public'||signer.publicKey.asymmetricKeyType!=='ed25519')throw Error('WITNESS_SIGNER_NOT_TRUSTED');
  const from=strictCalendarDateMs(signer.validFrom),until=strictCalendarDateMs(signer.validUntil);
  if(!Number.isFinite(from)||!Number.isFinite(until)||from>observed||until<now||!crypto.verify(null,witnessReceiptBytes(receipt),signer.publicKey,signature))throw Error('WITNESS_SIGNATURE_OR_WINDOW_INVALID');
  // Null is possible only after a valid signed absence response. Transport
  // errors, malformed or unsigned responses throw and are never absence.
  return receipt.revision===0?null:Object.freeze({version:CUSTODY_VERSION,scope:s,revision:receipt.revision,headHashSha256:receipt.headHashSha256});
 }
 return Object.freeze({loadCheckpoint,productionWitnessVerified:false});
}
module.exports={VERSION,witnessReceiptBytes,makeVerifiedWitnessCheckpointProvider};
