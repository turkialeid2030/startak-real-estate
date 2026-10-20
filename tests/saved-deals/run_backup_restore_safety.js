'use strict';
const assert=require('node:assert/strict');
const {planRestore,commitRestore,restoreBackupPayload,buildCurrentExportPayload,buildExportPayload,parseBackupText,serializeBackup,MAX_BACKUP_BYTES,MAX_DEALS}=require('../../src/storage/saved-deals-backup');
const {withSavedDealsLock}=require('../../src/storage/saved-deals-operation-lock');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const gold=require('../reference/RE-GOLD-baseline.json');
const {syntheticBackupDeals}=require('../fixtures/synthetic-backup-deals');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rejects=async(fn,code)=>{await assert.rejects(fn,e=>e.reasonCode===code);checks++;};
const deal=(id,name=id)=>({id,name,mode:'building',inputs:{...gold['RE-GOLD-002_existing_building'].inputs},savedAt:'2026-10-20T00:00:00Z'});
const payload=deals=>({format:'STARTAK_SAVED_DEALS_BACKUP',backupVersion:1,deals});
function memory(initial={}){const store=new Map(Object.entries(initial));let writes=0;return {store,get:async k=>store.get(k)??null,set:async(k,v)=>{writes++;store.set(k,v);},delete:async k=>{writes++;store.delete(k);},writes:()=>writes};}
const snapshot=p=>[...p.store].sort(([a],[b])=>a.localeCompare(b));
(async()=>{
 for(const ids of [['same','same'],['','x'],[undefined,'x'],['\u0000','x'],['__proto__','x']]){
  const p=memory();await rejects(()=>restoreBackupPayload(JSON.parse(JSON.stringify(payload(ids.map(id=>deal(id))))),p),'BACKUP_DUPLICATE_OR_INVALID_ID');eq(p.writes(),0);
 }
 const exact=deal('same'),p=memory({'deal:same':JSON.stringify(exact),'deals-index':JSON.stringify([{id:'same',name:'same',mode:'building',savedAt:exact.savedAt}])});
 const before=snapshot(p),duplicate=await restoreBackupPayload(payload([exact]),p);eq(duplicate.added,0);eq(duplicate.skipped,1);eq(snapshot(p),before);eq(p.writes(),0);
 const incoming=[deal('same','Incoming'),deal('same~restored-1','Reserved incoming ID')];
 const restored=await restoreBackupPayload(payload(incoming),p);eq(restored.renamed,1);eq(restored.added,2);eq(restored.index.map(x=>x.id),['same','same~restored-2','same~restored-1']);eq(await p.get('deal:same'),JSON.stringify(exact));
 eq(JSON.parse(await p.get('deal:same~restored-2')).name,'Incoming');
 const resultBefore=calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:exact.inputs,leverageEnabled:false});
 const exported=await buildCurrentExportPayload(p),destination=memory();await restoreBackupPayload(parseBackupText(serializeBackup(exported)),destination);
 eq(JSON.parse(await destination.get('deal:same')).inputs,exact.inputs);
 const resultAfter=calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:JSON.parse(await destination.get('deal:same')).inputs,leverageEnabled:false});eq(resultAfter.cashflows,resultBefore.cashflows);eq(resultAfter.irr,resultBefore.irr);eq(resultAfter.NOI,resultBefore.NOI);
 const invalids=[payload(Array.from({length:MAX_DEALS+1},(_,i)=>deal('d'+i))),JSON.parse('{"format":"STARTAK_SAVED_DEALS_BACKUP","backupVersion":1,"deals":[],"__proto__":{"polluted":true}}')];
 for(const [i,v]of invalids.entries()){const q=memory();await rejects(()=>restoreBackupPayload(v,q),i?'BACKUP_KEY_INVALID':'BACKUP_DEAL_LIMIT');eq(q.writes(),0);}
 assert.throws(()=>parseBackupText(' '.repeat(MAX_BACKUP_BYTES+1)),e=>e.reasonCode==='BACKUP_SIZE_LIMIT');checks++;
 assert.throws(()=>parseBackupText('"'+'أ'.repeat(MAX_BACKUP_BYTES/2)+'"'),e=>e.reasonCode==='BACKUP_SIZE_LIMIT');checks++;
 assert.throws(()=>parseBackupText('['.repeat(34)+'0'+']'.repeat(34)),e=>e.reasonCode==='BACKUP_STRUCTURE_LIMIT');checks++;
 const mismatch=memory({'deal:key':JSON.stringify(deal('different'))});await rejects(()=>buildExportPayload([{id:'key'}],mismatch),'BACKUP_RECORD_ID_MISMATCH');
 const duplicateIndex=memory({'deals-index':'[{"id":"same"},{"id":"same"}]'});await rejects(()=>restoreBackupPayload(payload([]),duplicateIndex),'BACKUP_INDEX_INVALID');
 // A plan is immutable, detached from the file and tied to the observed state.
 const q=memory(),input=payload([deal('frozen')]),plan=planRestore(input,[],new Map());input.deals[0].name='MUTATED';eq(plan.toWrite[0].record.name,'frozen');eq(Object.isFrozen(plan.toWrite[0].record.inputs),true);
 await commitRestore(plan,q);await rejects(()=>commitRestore(plan,q),'RESTORE_PLAN_INVALID_OR_USED');await rejects(()=>commitRestore({toWrite:[],newIndexEntries:[]},q),'RESTORE_PLAN_INVALID_OR_USED');
 const stale=memory(),stalePlan=planRestore(payload([deal('stale')]),[],new Map());stale.store.set('deals-index','[{"id":"other"}]');await rejects(()=>commitRestore(stalePlan,stale),'RESTORE_STORAGE_CHANGED');eq(stale.writes(),0);
 const orphan=memory({'deal:orphan':'do not overwrite'});await rejects(()=>restoreBackupPayload(payload([deal('orphan')]),orphan),'RESTORE_TARGET_OCCUPIED');eq(orphan.writes(),0);
 // Every possible failing write, including a write-then-reject acknowledgment,
 // returns the exact pre-operation bytes and removes staged records.
 for(const initialIndex of [null,'[]'])for(const failAt of [1,2,3])for(const afterWrite of [false,true]){
  const m=memory(initialIndex===null?{}:{'deals-index':initialIndex}),original=snapshot(m),set=m.set;let attempts=0;
  m.set=async(k,v)=>{if(++attempts===failAt){if(afterWrite)await set(k,v);throw Error('synthetic I/O failure');}await set(k,v);};
  await rejects(()=>restoreBackupPayload(payload([deal('one'),deal('two')]),m),'RESTORE_STORAGE_FAILED_ROLLED_BACK');eq(snapshot(m),original);
 }
 const failedCleanup=memory(),set=failedCleanup.set;let attempt=0;
 failedCleanup.set=async(k,v)=>{if(++attempt===2)throw Error('quota');await set(k,v);};failedCleanup.delete=async()=>{throw Error('storage unavailable');};
 await rejects(()=>restoreBackupPayload(payload([deal('one'),deal('two')]),failedCleanup),'RESTORE_RECOVERY_REQUIRED');eq(failedCleanup.store.has('deal:one'),true);
 const foreign=memory(),write=foreign.set;foreign.set=async(k,v)=>{await write(k,v);if(k==='deal:one')foreign.store.set('deals-index','[{"id":"foreign"}]');};
 await rejects(()=>restoreBackupPayload(payload([deal('one')]),foreign),'RESTORE_RECOVERY_REQUIRED');eq(await foreign.get('deals-index'),'[{"id":"foreign"}]');
 // Fresh snapshots under the shared lock preserve both concurrent imports.
 const concurrent=memory();await Promise.all([restoreBackupPayload(payload([deal('parallel-one')]),concurrent),restoreBackupPayload(payload([deal('parallel-two')]),concurrent)]);eq(JSON.parse(await concurrent.get('deals-index')).map(x=>x.id),['parallel-one','parallel-two']);
 const order=[];await Promise.all([withSavedDealsLock(concurrent,async()=>{order.push('first-start');await Promise.resolve();order.push('first-end');}),withSavedDealsLock(concurrent,()=>order.push('second'))]);eq(order,['first-start','first-end','second']);
 const rich=syntheticBackupDeals(),richStore=memory(Object.fromEntries(rich.map(record=>['deal:'+record.id,JSON.stringify(record)])));
 const richExport=await buildExportPayload(rich.map(record=>({id:record.id})),richStore);eq(richExport.deals,rich);
 const richDestination=memory();await restoreBackupPayload(richExport,richDestination);eq(JSON.parse(await richDestination.get('deal:'+rich[0].id)),rich[0]);
 for(const backupVersion of [1,2,3]){const old=memory();await restoreBackupPayload({...payload([deal('legacy')]),backupVersion},old);eq(JSON.parse(await old.get('deal:legacy')),deal('legacy'));}
 const minimal={id:'minimal-legacy',mode:'building',inputs:{}},minimalStore=memory({'deal:minimal-legacy':JSON.stringify(minimal)});
 const minimalExport=await buildExportPayload([{id:minimal.id}],minimalStore);eq(minimalExport.deals,[minimal]);
 const minimalDestination=memory();await restoreBackupPayload(minimalExport,minimalDestination);eq(JSON.parse(await minimalDestination.get('deal:minimal-legacy')),minimal);
 console.log(`BACKUP_RESTORE_SAFETY=PASS checks=${checks}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
