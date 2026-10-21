'use strict';

const {sha256Hex}=require('../crypto/sha256');
const {MAX_BACKUP_BYTES,MAX_DEALS,checkText,checkIndex,validId}=require('./saved-deals-backup-limits');
const JOURNAL_KEY='transaction-journal-v1';
const CAPABILITY='BROWSER_LOCAL_JOURNAL_V1';
const fail=()=>{throw Object.assign(new Error('Saved deal recovery requires review'),{reasonCode:'RESTORE_RECOVERY_REQUIRED'});};
function coordinated(){return typeof window!=='undefined'&&typeof window.navigator?.locks?.request==='function';}
function supported(provider){return provider?.savedDealsRecovery===CAPABILITY;}
function parseIndex(raw){if(raw===null)return [];if(typeof raw!=='string')fail();checkText(raw);const entries=JSON.parse(raw);checkIndex(entries);return entries;}
function exactKeys(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');}

// The checksum detects accidental changes, not an authenticated writer. Every
// recovery key is also restricted to the saved-deal namespace and index delta.
function decode(text){
 try{
  if(typeof text!=='string'||text.length>3*MAX_BACKUP_BYTES||new TextEncoder().encode(text).byteLength>3*MAX_BACKUP_BYTES)fail();
  const j=JSON.parse(text);
  if(!exactKeys(j,['schemaVersion','beforeIndexRaw','afterIndexRaw','changes','unchanged','checksumSha256'])||j.schemaVersion!==1)fail();
  const {checksumSha256,...core}=j;
  if(!/^[a-f0-9]{64}$/.test(checksumSha256)||sha256Hex(JSON.stringify(core))!==checksumSha256)fail();
  const before=parseIndex(j.beforeIndexRaw),after=parseIndex(j.afterIndexRaw);
  if(typeof j.afterIndexRaw!=='string'||!Array.isArray(j.changes)||!j.changes.length||j.changes.length>MAX_DEALS||!Array.isArray(j.unchanged))fail();
  const old=new Map(before.map(e=>[e.id,e])),next=new Map(after.map(e=>[e.id,e])),ids=new Set();
  let rawBytes=0;
  for(const c of j.changes){
   if(!exactKeys(c,['key','beforeRaw','afterRaw'])||typeof c.key!=='string'||!c.key.startsWith('deal:'))fail();
   const id=c.key.slice(5);if(!validId(id)||ids.has(id)||!old.has(id)&&!next.has(id))fail();ids.add(id);
   for(const raw of [c.beforeRaw,c.afterRaw])if(raw!==null){checkText(raw);rawBytes+=new TextEncoder().encode(raw).byteLength;}
   if((c.beforeRaw!==null)!==old.has(id)||(c.afterRaw!==null)!==next.has(id))fail();
  }
  if(rawBytes>2*MAX_BACKUP_BYTES)fail();
  for(const id of new Set([...old.keys(),...next.keys()]))if(!ids.has(id)&&JSON.stringify(old.get(id))!==JSON.stringify(next.get(id)))fail();
  const untouched=before.filter(e=>!ids.has(e.id)).map(e=>'deal:'+e.id).sort();
  if(j.unchanged.length!==untouched.length)fail();
  const keys=[];
  for(const c of j.unchanged){if(!exactKeys(c,['key','sha256'])||!/^[a-f0-9]{64}$/.test(c.sha256)||typeof c.key!=='string')fail();keys.push(c.key);}
  if(JSON.stringify(keys.slice().sort())!==JSON.stringify(untouched))fail();
  return j;
 }catch{fail();}
}
async function checkState(provider,j,target=null){
 const index=await provider.get('deals-index');
 if(target?index!==j[target+'IndexRaw']:index!==j.beforeIndexRaw&&index!==j.afterIndexRaw)fail();
 for(const c of j.changes){const raw=await provider.get(c.key);if(target?raw!==c[target+'Raw']:raw!==c.beforeRaw&&raw!==c.afterRaw)fail();}
 for(const c of j.unchanged){const raw=await provider.get(c.key);if(typeof raw!=='string'||sha256Hex(raw)!==c.sha256)fail();}
}
async function owned(provider,token){if(await provider.get(JOURNAL_KEY)!==token.text)fail();}
async function clear(provider,token){
 await owned(provider,token);
 try{await provider.delete(JOURNAL_KEY);}catch{/* A delete-then-reject must be decided by readback. */}
 if(await provider.get(JOURNAL_KEY)!==null)fail();
}
async function beginSavedDealTransaction(provider,beforeIndexRaw,afterIndexRaw,changes){
 if(!supported(provider))return null;
 if(!coordinated())throw Object.assign(new Error('Cross-tab storage coordination is unavailable'),{reasonCode:'STORAGE_COORDINATION_REQUIRED'});
 if(await provider.get(JOURNAL_KEY)!==null)fail();
 const changed=new Set(changes.map(c=>c.key)),unchanged=[];
 for(const e of parseIndex(beforeIndexRaw))if(!changed.has('deal:'+e.id)){
  const raw=await provider.get('deal:'+e.id);if(typeof raw!=='string')fail();checkText(raw);unchanged.push({key:'deal:'+e.id,sha256:sha256Hex(raw)});
 }
 const core={schemaVersion:1,beforeIndexRaw,afterIndexRaw,changes:changes.map(({key,beforeRaw,afterRaw})=>({key,beforeRaw,afterRaw})),unchanged};
 const text=JSON.stringify({...core,checksumSha256:sha256Hex(JSON.stringify(core))}),token=Object.freeze({text});
 const j=decode(text);await checkState(provider,j,'before');
 try{await provider.set(JOURNAL_KEY,text);await owned(provider,token);}
 catch(cause){
  // No deal/index write has started. Remove only our own confirmed journal.
  try{const raw=await provider.get(JOURNAL_KEY);if(raw!==null){if(raw!==text)fail();await clear(provider,token);}}catch{fail();}
  throw cause;
 }
 return token;
}
async function finishSavedDealTransaction(provider,token,target){
 if(!token)return;
 try{await owned(provider,token);await checkState(provider,decode(token.text),target);await clear(provider,token);}catch{fail();}
}
async function recoverSavedDeals(provider){
 if(!supported(provider))return {status:'NOT_SUPPORTED',recovered:false};
 const text=await provider.get(JOURNAL_KEY);if(text===null)return {status:'NO_PENDING_OPERATION',recovered:false};
 if(!coordinated())fail();
 try{
  const j=decode(text),token={text};await checkState(provider,j);await owned(provider,token);
  const indexOwned=async()=>{await owned(provider,token);const raw=await provider.get('deals-index');if(raw!==j.beforeIndexRaw&&raw!==j.afterIndexRaw)fail();};
  const restore=async(c)=>{
   await indexOwned();const raw=await provider.get(c.key);if(raw===c.beforeRaw)return;if(raw!==c.afterRaw)fail();
   if(c.beforeRaw===null)await provider.delete(c.key);else await provider.set(c.key,c.beforeRaw);
   if(await provider.get(c.key)!==c.beforeRaw)fail();
  };
  // Republish the prior index only after its deleted/updated records exist.
  for(const c of j.changes.filter(c=>c.beforeRaw!==null))await restore(c);
  await indexOwned();
  for(const c of j.unchanged){const raw=await provider.get(c.key);if(typeof raw!=='string'||sha256Hex(raw)!==c.sha256)fail();}
  if(await provider.get('deals-index')!==j.beforeIndexRaw){if(j.beforeIndexRaw===null)await provider.delete('deals-index');else await provider.set('deals-index',j.beforeIndexRaw);}
  if(await provider.get('deals-index')!==j.beforeIndexRaw)fail();
  for(const c of j.changes.filter(c=>c.beforeRaw===null).reverse())await restore(c);
  await finishSavedDealTransaction(provider,token,'before');
  return {status:'ROLLED_BACK_INTERRUPTED_OPERATION',recovered:true,changedRecords:j.changes.length};
 }catch{fail();}
}
module.exports={JOURNAL_KEY,CAPABILITY,supported,beginSavedDealTransaction,finishSavedDealTransaction,recoverSavedDeals};
