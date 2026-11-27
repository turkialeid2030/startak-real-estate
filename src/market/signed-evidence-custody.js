'use strict';
// A verifier for externally signed custody events and an independently supplied
// monotonic checkpoint. No key issuance, persistence, witness, or legal approval.
const crypto=require('node:crypto');
const {assertPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const VERSION='STARTAK_PRIVATE_EVIDENCE_CUSTODY_V1';
const REF=/^[A-Za-z0-9_.:-]{2,128}$/,SHA=/^[a-f0-9]{64}$/;
const KINDS=Object.freeze(['SEALED','RECHECKED','REVOKED']);
const ref=x=>typeof x==='string'&&REF.test(x);
const digest=x=>typeof x==='string'&&SHA.test(x);
const exact=(x,fields)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
function plain(x){try{assertPlainJson(x,{maxNodes:50000});return true;}catch{return false;}}
function scope(x){
 if(!plain(x)||!exact(x,['tenantId','caseRef','evidenceRef','sha256'])||![x.tenantId,x.caseRef,x.evidenceRef].every(ref)||!digest(x.sha256))throw Error('CUSTODY_SCOPE_INVALID');
 return {tenantId:x.tenantId,caseRef:x.caseRef,evidenceRef:x.evidenceRef,sha256:x.sha256};
}
function event(x){
 if(!plain(x)||!exact(x,['sequence','kind','actorRef','observedAt','signerKeyRef','previousHashSha256'])||!Number.isSafeInteger(x.sequence)||x.sequence<1||x.sequence>1000||!KINDS.includes(x.kind)||![x.actorRef,x.signerKeyRef].every(ref)||(x.sequence===1?x.previousHashSha256!==null:!digest(x.previousHashSha256)))throw Error('CUSTODY_EVENT_INVALID');
 const ms=strictCalendarDateMs(x.observedAt);
 if(!Number.isFinite(ms))throw Error('CUSTODY_TIME_INVALID');
 return {sequence:x.sequence,kind:x.kind,actorRef:x.actorRef,observedAt:new Date(ms).toISOString(),signerKeyRef:x.signerKeyRef,previousHashSha256:x.previousHashSha256};
}
function custodyEventBytes(s,e){return Buffer.from('STARTAK:CUSTODY:ED25519:V1\n'+JSON.stringify({version:VERSION,scope:scope(s),event:event(e)}));}
function signatureBytes(s){if(typeof s!=='string'||s.length!==88)throw Error('CUSTODY_SIGNATURE_INVALID');const b=Buffer.from(s,'base64');if(b.length!==64||b.toString('base64')!==s)throw Error('CUSTODY_SIGNATURE_INVALID');return b;}
function custodyEventHash(s,e,signature){return crypto.createHash('sha256').update(custodyEventBytes(s,e)).update(signatureBytes(signature)).digest('hex');}
async function verifyCustodyChain(ledger,{expectedScope,checkpoint,resolveSigner,now=new Date(),maxAgeSeconds}={}){
 const held=reason=>Object.freeze({status:'HOLD_CUSTODY',reason,integrityVerified:false,revision:null,headHashSha256:null,independentSourceAuthenticityEstablished:false,productionVaultReady:false,releaseAuthorized:false});
 try{
  const expected=scope(expectedScope);
  if(!plain(ledger)||!exact(ledger,['version','scope','events'])||ledger.version!==VERSION||!Array.isArray(ledger.events)||!ledger.events.length||ledger.events.length>1000)return held('CUSTODY_LEDGER_INVALID');
  const actual=scope(ledger.scope);
  if(JSON.stringify(actual)!==JSON.stringify(expected))return held('CUSTODY_SCOPE_MISMATCH');
  if(!plain(checkpoint)||!exact(checkpoint,['version','scope','revision','headHashSha256'])||checkpoint.version!==VERSION||JSON.stringify(scope(checkpoint.scope))!==JSON.stringify(expected)||checkpoint.revision!==ledger.events.length||!digest(checkpoint.headHashSha256)||typeof resolveSigner!=='function')return held('CUSTODY_TRUSTED_CHECKPOINT_REQUIRED');
  const current=now instanceof Date?Date.prototype.getTime.call(now):strictCalendarDateMs(now);
  if(!Number.isFinite(current)||current>Date.now()||!Number.isSafeInteger(maxAgeSeconds)||maxAgeSeconds<1||maxAgeSeconds>31536000)return held('CUSTODY_VERIFICATION_WINDOW_INVALID');
  // Normalize and snapshot the untrusted ledger before asynchronous registry access.
  const records=ledger.events.map(x=>{if(!exact(x,['event','signature']))throw Error('CUSTODY_EVENT_ENVELOPE_INVALID');signatureBytes(x.signature);return {event:event(x.event),signature:x.signature};});
  const trustedHead=checkpoint.headHashSha256;
  let previous=null,last=-Infinity,revoked=false;
  for(let i=0;i<records.length;i++){
   const {event:e,signature}=records[i],time=strictCalendarDateMs(e.observedAt);
   if(e.sequence!==i+1||e.previousHashSha256!==previous||time<=last||time>current||revoked||(i===0?e.kind!=='SEALED':e.kind==='SEALED'))return held('CUSTODY_SEQUENCE_OR_CHRONOLOGY_INVALID');
   const signer=await resolveSigner({tenantId:actual.tenantId,signerKeyRef:e.signerKeyRef});
   if(!signer||signer.tenantId!==actual.tenantId||signer.signerKeyRef!==e.signerKeyRef||signer.purpose!=='EVIDENCE_CUSTODY_SIGNING'||signer.revoked!==false||!(signer.publicKey instanceof crypto.KeyObject)||signer.publicKey.type!=='public'||signer.publicKey.asymmetricKeyType!=='ed25519')return held('CUSTODY_SIGNER_NOT_TRUSTED');
   const from=strictCalendarDateMs(signer.validFrom),until=strictCalendarDateMs(signer.validUntil);
   // Historical keys can expire after valid signing, but revoked keys never qualify.
   if(!Number.isFinite(from)||!Number.isFinite(until)||from>time||time>until)return held('CUSTODY_SIGNER_WINDOW_INVALID');
   if(!crypto.verify(null,custodyEventBytes(actual,e),signer.publicKey,signatureBytes(signature)))return held('CUSTODY_SIGNATURE_INVALID');
   previous=custodyEventHash(actual,e,signature);last=time;revoked=e.kind==='REVOKED';
  }
  if(previous!==trustedHead)return held('CUSTODY_CHECKPOINT_MISMATCH');
  if(revoked)return held('CUSTODY_REVOKED');
  if(current-last>maxAgeSeconds*1000)return held('CUSTODY_STALE');
  return Object.freeze({status:'CUSTODY_INTEGRITY_MATCHED',reason:null,integrityVerified:true,revision:records.length,headHashSha256:previous,independentSourceAuthenticityEstablished:false,productionVaultReady:false,releaseAuthorized:false});
 }catch{return held('CUSTODY_VERIFICATION_FAILED');}
}
module.exports={VERSION,custodyEventBytes,custodyEventHash,verifyCustodyChain};
