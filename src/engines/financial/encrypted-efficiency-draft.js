'use strict';
// Local encrypted research only; no institutional or authenticated custody.
const {readCanonicalDeal}=require('../../market/saved-deal-study-sidecar');
const {reviewEfficiencyText,GROUPS,MAX_BYTES}=require('./asset-efficiency-review');
const KIND='EFFICIENCY_LOCAL_ENCRYPTED_DRAFT_V1',PREFIX='efficiency-encrypted-draft:v1:';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function bytes(v,n){if(typeof v!=='string'||v.length!==n*2||!/^[0-9a-f]+$/.test(v))throw Error('EFFICIENCY_ENVELOPE_INVALID');return Uint8Array.from(v.match(/../g),x=>parseInt(x,16));}
function native(){if(!globalThis.crypto?.subtle)throw Error('EFFICIENCY_NATIVE_CRYPTO_REQUIRED');return globalThis.crypto;}
async function derive(passphrase,salt){
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>256)throw Error('EFFICIENCY_PASSPHRASE_LENGTH');
 const c=native(),material=await c.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function scope({storage,dealId,propertyRef,marketScopeRef,asOfDate}){
 const {deal,id}=await readCanonicalDeal(storage,dealId);
 if(![propertyRef,marketScopeRef].every(v=>typeof v==='string'&&v.trim()&&v.length<=160)||typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(Date.parse(asOfDate))||new Date(asOfDate).toISOString().slice(0,10)!==asOfDate)throw Error('EFFICIENCY_SAVED_DEAL_SCOPE_INVALID');
 const identity=JSON.stringify([KIND,id,deal.name,deal.mode,propertyRef,marketScopeRef,asOfDate]);
 return {id,identity,aad:enc.encode(identity),key:PREFIX+id};
}
async function verified(text,id,propertyRef,marketScopeRef,asOfDate){
 const result=reviewEfficiencyText({text,caseId:id,propertyRef,marketScopeRef,asOfDate});
 if(!['COMPLETE_RESEARCH_REVIEW','PARTIAL_RESEARCH_REVIEW'].includes(result.status)||!result.coverage?.available)throw Error('EFFICIENCY_DRAFT_REVIEW_HOLD');
 const input=JSON.parse(text);
 const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
 const scopeKeys=['caseId','propertyRef','marketScopeRef','periodStart','periodEnd','measurementBasisRef'];
 const approvalKeys=[...scopeKeys,'sourceRef','approvedAt'];
 const groups=Object.fromEntries(Object.entries(GROUPS).filter(([k])=>input.groups[k]!=null).map(([k,fields])=>{
  const g=input.groups[k];
  return [k,{...pick(g,[...scopeKeys,'sourceRef','reviewedAt']),values:pick(g.values,fields),...(k==='financial'&&g.budget&&['budgetRevenueSar','budgetOperatingExpensesSar'].some(f=>g.values[f]!=null)?{budget:pick(g.budget,approvalKeys)}:{})}];
 }));
 const targets=Object.fromEntries(Object.entries(input.targets||{}).map(([k,v])=>[k,pick(v,[...approvalKeys,'value'])]));
 const sanitized=JSON.stringify({...pick(input,[...scopeKeys,'asOfDate']),groups,targets});
 if(enc.encode(sanitized).length>MAX_BYTES)throw Error('EFFICIENCY_FILE_LIMIT');
 return {text:sanitized,result};
}
// Serialize this module's mutations; Web Locks also serialize cooperative tabs.
const queues=new Map();
async function exclusive(id,task){
 const key=PREFIX+id;
 if(globalThis.navigator?.locks?.request)return globalThis.navigator.locks.request(key,{mode:'exclusive'},task);
 if(typeof window!=='undefined')throw Error('EFFICIENCY_CROSS_TAB_LOCK_UNAVAILABLE');
 const previous=queues.get(key)||Promise.resolve();
 const current=previous.catch(()=>{}).then(task);queues.set(key,current);
 try{return await current;}finally{if(queues.get(key)===current)queues.delete(key);}
}
async function saveEncryptedEfficiencyDraft(options){
 return exclusive(options.dealId,()=>saveUnlocked(options));
}
async function saveUnlocked(options){
 const {storage,propertyRef,marketScopeRef,asOfDate,passphrase,text,confirmed=false,overwrite=false,isCurrent=()=>true}=options;
 if(confirmed!==true)throw Error('EFFICIENCY_EXPLICIT_CONFIRMATION_REQUIRED');
 const s=await scope(options),valid=await verified(text,s.id,propertyRef,marketScopeRef,asOfDate);
 const previous=await storage.get(s.key);
 if(previous!=null&&overwrite!==true)throw Error('EFFICIENCY_EXISTING_DRAFT_CONFIRM_OVERWRITE');
 const c=native(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12)),secret=await derive(passphrase,salt);
 const cipher=await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,enc.encode(valid.text));
 const value=JSON.stringify({kind:KIND,salt:hex(salt),iv:hex(iv),cipher:hex(cipher)});
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==previous||!isCurrent())throw Error('EFFICIENCY_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 await storage.set(s.key,value);
 if(await storage.get(s.key)!==value)throw Error('EFFICIENCY_PERSISTENCE_NOT_VERIFIED');
 return {saved:true,localResearchOnly:true,transactionAuthorized:false};
}
async function loadEncryptedEfficiencyDraft(options){
 const {storage,propertyRef,marketScopeRef,asOfDate,passphrase}=options,s=await scope(options),raw=await storage.get(s.key);
 if(raw==null)return {found:false};
 if(typeof raw!=='string'||raw.length>MAX_BYTES*2+1024)throw Error('EFFICIENCY_ENVELOPE_INVALID');
 let text;
 try{
  const e=JSON.parse(raw);
  if(e?.kind!==KIND||Object.keys(e).sort().join(',')!=='cipher,iv,kind,salt'||typeof e.cipher!=='string'||e.cipher.length<32||e.cipher.length%2)throw Error();
  const salt=bytes(e.salt,16),iv=bytes(e.iv,12),cipher=bytes(e.cipher,e.cipher.length/2),secret=await derive(passphrase,salt);
  text=dec.decode(await native().subtle.decrypt({name:'AES-GCM',iv,additionalData:s.aad},secret,cipher));
 }catch{throw Error('EFFICIENCY_DRAFT_UNLOCK_FAILED');}
 const valid=await verified(text,s.id,propertyRef,marketScopeRef,asOfDate);
 if((await scope(options)).identity!==s.identity||await storage.get(s.key)!==raw)throw Error('EFFICIENCY_DRAFT_SCOPE_OR_STORAGE_CHANGED');
 return {found:true,...valid,localResearchOnly:true,transactionAuthorized:false};
}
async function deleteEncryptedEfficiencyDraft(options){
 if(options.confirmDelete!==true)throw Error('EFFICIENCY_DELETE_CONFIRMATION_REQUIRED');
 return exclusive(options.dealId,async()=>{
  const s=await scope(options),raw=await options.storage.get(s.key);
  if(raw==null)return {deleted:false};
  const unlocked=await loadEncryptedEfficiencyDraft(options);
  if(!unlocked.found||(await scope(options)).identity!==s.identity||await options.storage.get(s.key)!==raw||(options.isCurrent&&!options.isCurrent()))throw Error('EFFICIENCY_DRAFT_SCOPE_OR_STORAGE_CHANGED');
  if(typeof options.storage.delete!=='function')throw Error('EFFICIENCY_DELETE_UNAVAILABLE');
  await options.storage.delete(s.key);
  if(await options.storage.get(s.key)!=null)throw Error('EFFICIENCY_DELETE_NOT_VERIFIED');
  return {deleted:true,localResearchOnly:true,transactionAuthorized:false};
 });
}
module.exports={saveEncryptedEfficiencyDraft,loadEncryptedEfficiencyDraft,deleteEncryptedEfficiencyDraft};
