'use strict';
// Local encrypted research only; no institutional or authenticated custody.
const {readCanonicalDeal}=require('./saved-deal-study-sidecar');
const {reviewLocalPolicyShock,MAX_BYTES}=require('./local-policy-shock-review');
const KIND='C19_LOCAL_ENCRYPTED_DRAFT_V1',PREFIX='c19-encrypted-draft:v1:',READY='READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function bytes(v,n){if(typeof v!=='string'||v.length!==n*2||!/^[0-9a-f]+$/.test(v))throw Error('C19_ENVELOPE_INVALID');return Uint8Array.from(v.match(/../g),x=>parseInt(x,16));}
function native(){if(!globalThis.crypto?.subtle)throw Error('C19_NATIVE_CRYPTO_REQUIRED');return globalThis.crypto;}
async function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256)throw Error('C19_PASSPHRASE_LENGTH');
 const c=native(),material=await c.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function scope({storage,dealId,marketScopeRef,assetType,city,transactionType,asOfDate}){
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 if(![marketScopeRef,assetType,city].every(v=>typeof v==='string'&&v.trim()&&v.length<=160)||!['SALE','RENT'].includes(transactionType)||typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(Date.parse(asOfDate))||new Date(asOfDate).toISOString().slice(0,10)!==asOfDate)throw Error('C19_SAVED_DEAL_SCOPE_INVALID');
 const identity=JSON.stringify([KIND,id,deal.name,deal.mode,marketScopeRef,assetType,city,transactionType,asOfDate]);
 return {id,identity,aad:enc.encode(identity),key:PREFIX+id};
}
async function verified(text,id,marketScopeRef,assetType,city,transactionType,asOfDate){
 const result=await reviewLocalPolicyShock({text,expectedCaseId:id,expectedMarketScopeRef:marketScopeRef,expectedAssetType:assetType,expectedCity:city,expectedTransactionType:transactionType,asOfDate});
 if(result.status!==READY)throw Error('C19_DRAFT_REVIEW_HOLD');
 const {asOf,comparables,shockEvidence,impacts,reviewPolicy}=JSON.parse(text);
 const sanitized=JSON.stringify({asOf,comparables,shockEvidence,impacts,reviewPolicy});
 if(enc.encode(sanitized).length>MAX_BYTES)throw Error('C19_FILE_LIMIT');
 return {text:sanitized,result};
}
async function saveEncryptedPolicyShockDraft(options){
 const {storage,marketScopeRef,assetType,city,transactionType,asOfDate,passphrase,text,confirmed=false,overwrite=false,isCurrent=()=>true}=options;
 if(confirmed!==true)throw Error('C19_EXPLICIT_CONFIRMATION_REQUIRED');
 const s=await scope(options),valid=await verified(text,s.id,marketScopeRef,assetType,city,transactionType,asOfDate);
 const previous=await storage.get(s.key);
 if(previous!=null&&overwrite!==true)throw Error('C19_EXISTING_DRAFT_CONFIRM_OVERWRITE');
 const c=native(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12)),secret=await derive(passphrase,salt);
 const cipher=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,enc.encode(valid.text));
 const value=JSON.stringify({kind:KIND,salt:hex(salt),iv:hex(iv),cipher:hex(cipher)});
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==previous||!isCurrent())throw Error('C19_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 await storage.set(s.key,value);
 if(await storage.get(s.key)!==value)throw Error('C19_PERSISTENCE_NOT_VERIFIED');
 return {saved:true,localResearchOnly:true,transactionAuthorized:false};
}
async function loadEncryptedPolicyShockDraft(options){
 const {storage,marketScopeRef,assetType,city,transactionType,asOfDate,passphrase}=options,s=await scope(options),raw=await storage.get(s.key);
 if(raw==null)return {found:false};
 if(typeof raw!=='string'||raw.length>MAX_BYTES*2+1024)throw Error('C19_ENVELOPE_INVALID');
 let text;
 try{
  const e=JSON.parse(raw);
  if(e?.kind!==KIND||Object.keys(e).sort().join(',')!=='cipher,iv,kind,salt'||typeof e.cipher!=='string'||e.cipher.length<32||e.cipher.length%2)throw Error();
  const salt=bytes(e.salt,16),iv=bytes(e.iv,12),cipher=bytes(e.cipher,e.cipher.length/2),secret=await derive(passphrase,salt);
  text=dec.decode(await native().subtle.decrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,cipher));
 }catch{throw Error('C19_DRAFT_UNLOCK_FAILED');}
 const valid=await verified(text,s.id,marketScopeRef,assetType,city,transactionType,asOfDate);
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==raw)throw Error('C19_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 return {found:true,...valid,localResearchOnly:true,transactionAuthorized:false};
}
module.exports={saveEncryptedPolicyShockDraft,loadEncryptedPolicyShockDraft};
