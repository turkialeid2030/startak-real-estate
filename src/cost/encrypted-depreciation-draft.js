'use strict';
// Separate local encrypted research sidecar. Not a production vault or authenticated custody.
const {readCanonicalDeal}=require('../market/saved-deal-study-sidecar');
const {reviewLocalDepreciation,STATUS,MAX_BYTES}=require('./local-depreciation-review');
const KIND='C59_LOCAL_ENCRYPTED_DRAFT_V1',ITERATIONS=600000;
const PREFIX='c59-encrypted-draft:v1:';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function bytes(v,len){if(typeof v!=='string'||v.length!==len*2||!/^[0-9a-f]+$/.test(v))throw Error('C59_ENVELOPE_INVALID');return Uint8Array.from(v.match(/../g),x=>parseInt(x,16));}
const keyFor=id=>PREFIX+id;
function cryptoApi(){if(!globalThis.crypto?.subtle)throw Error('C59_NATIVE_CRYPTO_REQUIRED');return globalThis.crypto;}
async function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256)throw Error('C59_PASSPHRASE_LENGTH');
 const c=cryptoApi();
 const material=await c.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function scope(storage,dealId,propertyRef){
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 if(deal.mode!=='building'||typeof propertyRef!=='string'||!propertyRef.trim()||propertyRef.length>1024)throw Error('C59_SAVED_DEAL_SCOPE_INVALID');
 return {id,aad:enc.encode(JSON.stringify([KIND,id,deal.name,deal.mode,propertyRef]))};
}
async function verified(text,dealId,propertyRef){
 const result=await reviewLocalDepreciation({text,expectedCaseId:dealId,expectedPropertyRef:propertyRef});
 if(result.status!==STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW)throw Error('C59_DRAFT_REVIEW_HOLD');
 const {packet,allocations,omissionReviews,ageLifeChecks=[]}=JSON.parse(text);
 return {text:JSON.stringify({packet,allocations,omissionReviews,ageLifeChecks}),result};
}
async function saveEncryptedDepreciationDraft({storage,dealId,propertyRef,passphrase,text,confirmed=false,overwrite=false}){
 if(confirmed!==true)throw Error('C59_EXPLICIT_CONFIRMATION_REQUIRED');
 const {id,aad}=await scope(storage,dealId,propertyRef);
 const valid=await verified(text,id,propertyRef);
 const key=keyFor(id);
 if(!overwrite&&await storage.get(key)!=null)throw Error('C59_EXISTING_DRAFT_CONFIRM_OVERWRITE');
 const c=cryptoApi(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
 const secret=await derive(passphrase,salt);
 const cipher=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},secret,enc.encode(valid.text));
 const value=JSON.stringify({kind:KIND,salt:hex(salt),iv:hex(iv),cipher:hex(cipher)});
 await storage.set(key,value);
 if(await storage.get(key)!==value)throw Error('C59_PERSISTENCE_NOT_VERIFIED');
 return {saved:true,localResearchOnly:true,transactionAuthorized:false};
}
async function loadEncryptedDepreciationDraft({storage,dealId,propertyRef,passphrase}){
 const {id,aad}=await scope(storage,dealId,propertyRef),raw=await storage.get(keyFor(id));
 if(raw==null)return {found:false};
 if(typeof raw!=='string'||raw.length>MAX_BYTES*2+1024)throw Error('C59_ENVELOPE_INVALID');
 let text;
 try{
  const e=JSON.parse(raw);
  if(e?.kind!==KIND||Object.keys(e).sort().join(',')!=='cipher,iv,kind,salt'||typeof e.cipher!=='string'||e.cipher.length<32||e.cipher.length%2)throw Error();
  const salt=bytes(e.salt,16),iv=bytes(e.iv,12),cipher=bytes(e.cipher,e.cipher.length/2);
  const secret=await derive(passphrase,salt);
  text=dec.decode(await cryptoApi().subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},secret,cipher));
 }catch{throw Error('C59_DRAFT_UNLOCK_FAILED');}
 const valid=await verified(text,id,propertyRef);
 return {found:true,...valid,localResearchOnly:true,transactionAuthorized:false};
}
module.exports={saveEncryptedDepreciationDraft,loadEncryptedDepreciationDraft};
