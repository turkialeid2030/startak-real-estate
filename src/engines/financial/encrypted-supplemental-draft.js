'use strict';
// Local encrypted research only; no institutional or authenticated custody.
const {readCanonicalDeal}=require('../../market/saved-deal-study-sidecar');
const {reviewSupplementalText,MAX_BYTES,METHODS}=require('./supplemental-research-input');
const {strictCalendarDateMs}=require('../../validation/strict-calendar-instant');
const {validateOpeningPortfolioSnapshot,assertOpeningReturnMatch}=require('../../portfolio/opening-return-snapshot');
const KIND='SUPPLEMENTAL_LOCAL_ENCRYPTED_DRAFT_V1',PREFIX='supplemental-encrypted-draft:v1:';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function bytes(v,n){if(typeof v!=='string'||v.length!==n*2||!/^[0-9a-f]+$/.test(v))throw Error('SUPPLEMENTAL_ENVELOPE_INVALID');return Uint8Array.from(v.match(/../g),x=>parseInt(x,16));}
function native(){if(!globalThis.crypto?.subtle)throw Error('SUPPLEMENTAL_NATIVE_CRYPTO_REQUIRED');return globalThis.crypto;}
async function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256)throw Error('SUPPLEMENTAL_PASSPHRASE_LENGTH');
 const c=native(),material=await c.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function scope({storage,dealId,propertyRef,asOfDate,method,portfolioId,assetIds,snapshotText}){
 if(method==='portfolio'){
  if(!storage||typeof storage.get!=='function')throw Error('STORAGE_PROVIDER_REQUIRED');
  const opening=validateOpeningPortfolioSnapshot(snapshotText,{portfolioId,asOfDate,assetIds});
  const identity=JSON.stringify([KIND,'PORTFOLIO',opening.portfolioId,opening.snapshotHashSha256,opening.asOfDate]);
  return {id:opening.portfolioId,identity,aad:enc.encode(identity),key:'supplemental-portfolio-encrypted-draft:v1:'+opening.portfolioId,opening};
 }
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 if(!Object.hasOwn(METHODS,method)||method==='portfolio'||typeof propertyRef!=='string'||propertyRef.trim()!==propertyRef||!propertyRef||propertyRef.length>160||typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(strictCalendarDateMs(asOfDate)))throw Error('SUPPLEMENTAL_SAVED_DEAL_SCOPE_INVALID');
 const identity=JSON.stringify([KIND,id,deal.name,deal.mode,propertyRef,asOfDate,method]);
 return {id,identity,aad:enc.encode(identity),key:PREFIX+id+':'+method};
}
const fields={
 annual:{cashflows:['timing','basis','values'],discountRate:['unit','value']},
 gross:{price:['unit','basis','value'],annualGrossRent:['unit','basis','periodStart','periodEndExclusive','value']},
 wacc:{capital:['basis','unit','taxShieldBasis','debt','equity','costOfDebt','costOfEquity','effectiveTaxShieldRate']},
 breakEven:{activity:['basis','unit','periodStart','periodEndExclusive','fixedCost','unitPrice','variableCostPerUnit','units','unitName']},
 holding:{holding:['basis','unit','periodStart','periodEnd','openingValue','closingValue','cashDistributions','externalCapitalFlows'],inflation:['unit','periodStart','periodEnd','value']}
};
async function verified(text,id,propertyRef,asOfDate,method,opening){
 const expected=opening?{portfolioId:id,asOfDate,assetIds:opening.assetIds}:{caseId:id,propertyRef,asOfDate};
 const result=reviewSupplementalText({method,text,expected});
 if(result.status!=='ANALYTICAL_ONLY'||!result.metrics.some(m=>Number.isFinite(m.value)))throw Error('SUPPLEMENTAL_DRAFT_REVIEW_HOLD');
 const input=JSON.parse(text);
 let clean;
 if(opening){
  assertOpeningReturnMatch(input,opening);
  clean={portfolioId:id,asOfDate,scope:'PORTFOLIO',currency:'SAR',periodStart:input.periodStart,periodEnd:input.periodEnd,members:input.members.map(m=>Object.fromEntries(['assetId','portfolioId','currency','sourceRef','sourceDate',...fields.holding.holding].map(k=>[k,m[k]])))};
 }else{
 clean={...expected,scope:'PROPERTY',currency:'SAR'};
 for(const [key,keys] of Object.entries(fields[method])){
  if(key==='inflation'&&input[key]==null){clean[key]=null;continue;}
  const record=input[key];
  clean[key]=Object.fromEntries(['caseId','propertyRef','sourceRef','sourceDate',...keys].map(k=>[k,record[k]]));
 }
 }
 const sanitized=JSON.stringify(clean);
 if(enc.encode(sanitized).length>MAX_BYTES)throw Error('SUPPLEMENTAL_FILE_LIMIT');
 const checked=reviewSupplementalText({method,text:sanitized,expected});
 if(JSON.stringify(checked)!==JSON.stringify(result))throw Error('SUPPLEMENTAL_SANITIZATION_CHANGED_RESULT');
 return {text:sanitized,result:checked};
}
// Serialize this module's mutations; Web Locks also serialize cooperative tabs.
const queues=new Map();
async function exclusive(id,task){
 const key=PREFIX+id;
 if(globalThis.navigator?.locks?.request)return globalThis.navigator.locks.request(key,{mode:'exclusive'},task);
 if(typeof window!=='undefined')throw Error('SUPPLEMENTAL_CROSS_TAB_LOCK_UNAVAILABLE');
 const previous=queues.get(key)||Promise.resolve();
 const current=previous.catch(()=>{}).then(task);queues.set(key,current);
 try{return await current;}finally{if(queues.get(key)===current)queues.delete(key);}
}
async function saveEncryptedSupplementalDraft(options){
 return exclusive(options.method==='portfolio'?'portfolio:'+options.portfolioId:options.dealId,()=>saveUnlocked(options));
}
async function saveUnlocked(options){
 const {storage,propertyRef,asOfDate,method,passphrase,text,confirmed=false,overwrite=false,isCurrent=()=>true}=options;
 if(confirmed!==true)throw Error('SUPPLEMENTAL_EXPLICIT_CONFIRMATION_REQUIRED');
 const s=await scope(options),valid=await verified(text,s.id,propertyRef,asOfDate,method,s.opening);
 const previous=await storage.get(s.key);
 if(previous!=null&&overwrite!==true)throw Error('SUPPLEMENTAL_EXISTING_DRAFT_CONFIRM_OVERWRITE');
 const c=native(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12)),secret=await derive(passphrase,salt);
 const cipher=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,enc.encode(valid.text));
 const value=JSON.stringify({kind:KIND,salt:hex(salt),iv:hex(iv),cipher:hex(cipher)});
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==previous||!isCurrent())throw Error('SUPPLEMENTAL_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 await storage.set(s.key,value);
 if(await storage.get(s.key)!==value)throw Error('SUPPLEMENTAL_PERSISTENCE_NOT_VERIFIED');
 return {saved:true,localResearchOnly:true,transactionAuthorized:false};
}
async function loadEncryptedSupplementalDraft(options){
 const {storage,propertyRef,asOfDate,method,passphrase}=options,s=await scope(options),raw=await storage.get(s.key);
 if(raw==null)return {found:false};
 if(typeof raw!=='string'||raw.length>MAX_BYTES*2+1024)throw Error('SUPPLEMENTAL_ENVELOPE_INVALID');
 let text;
 try{
  const e=JSON.parse(raw);
  if(e?.kind!==KIND||Object.keys(e).sort().join(',')!=='cipher,iv,kind,salt'||typeof e.cipher!=='string'||e.cipher.length<32||e.cipher.length%2)throw Error();
  const salt=bytes(e.salt,16),iv=bytes(e.iv,12),cipher=bytes(e.cipher,e.cipher.length/2),secret=await derive(passphrase,salt);
  text=dec.decode(await native().subtle.decrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,cipher));
 }catch{throw Error('SUPPLEMENTAL_DRAFT_UNLOCK_FAILED');}
 const valid=await verified(text,s.id,propertyRef,asOfDate,method,s.opening);
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==raw)throw Error('SUPPLEMENTAL_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 return {found:true,...valid,localResearchOnly:true,transactionAuthorized:false};
}
async function deleteEncryptedSupplementalDraft(options){
 if(options.confirmDelete!==true)throw Error('SUPPLEMENTAL_DELETE_CONFIRMATION_REQUIRED');
 return exclusive(options.method==='portfolio'?'portfolio:'+options.portfolioId:options.dealId,async()=>{
  const s=await scope(options),raw=await options.storage.get(s.key);
  if(raw==null)return {deleted:false};
  const unlocked=await loadEncryptedSupplementalDraft(options);
  if(!unlocked.found||(await scope(options)).identity!==s.identity||await options.storage.get(s.key)!==raw||(options.isCurrent&&!options.isCurrent()))throw Error('SUPPLEMENTAL_DRAFT_SCOPE_OR_STORAGE_CHANGED');
  if(typeof options.storage.delete!=='function')throw Error('SUPPLEMENTAL_DELETE_UNAVAILABLE');
  await options.storage.delete(s.key);
  if(await options.storage.get(s.key)!=null)throw Error('SUPPLEMENTAL_DELETE_NOT_VERIFIED');
  return {deleted:true,localResearchOnly:true,transactionAuthorized:false};
 });
}
module.exports={saveEncryptedSupplementalDraft,loadEncryptedSupplementalDraft,deleteEncryptedSupplementalDraft};
