'use strict';
const assert=require('node:assert/strict');
const {sha256Hex}=require('../../src/crypto/sha256');
const {JOURNAL_KEY}=require('../../src/storage/saved-deals-recovery');
const {initializeSavedDealsStorage,buildCurrentExportPayload}=require('../../src/storage/saved-deals-backup');
const {mapProvider,coordinatedWindow,operation,interruptedFixtures,prefix}=require('../fixtures/synthetic-interrupted-saved-deals');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert.ok(v);checks++;};
const rows=map=>[...map].sort(([a],[b])=>a.localeCompare(b));
async function rejected(fn,reason){await assert.rejects(fn,e=>e.reasonCode===reason);checks++;}
function altered(text,change){const j=JSON.parse(text);change(j);delete j.checksumSha256;j.checksumSha256=sha256Hex(JSON.stringify(j));return JSON.stringify(j);}
(async()=>{
 const fixtures=await interruptedFixtures();global.window=coordinatedWindow();
 for(const fixture of fixtures){
  const before=new Map(fixture.before),after=new Map(fixture.after);
  // Independent expected state: every prefix before journal deletion returns
  // byte-for-byte to the original map; a completed commit remains completed.
  for(const stage of [{entries:fixture.before,pending:false},...fixture.prefixes]){
   const p=mapProvider(stage.entries),r=await initializeSavedDealsStorage(p);
   eq(r.recovered,stage.pending);eq(rows(p.data),rows(stage.pending?before:new Map(stage.entries)));
   eq((await initializeSavedDealsStorage(p)).recovered,false);
   eq(rows(p.data),rows(stage.pending?before:new Map(stage.entries)));
   if(stage.pending){
    const recovery=mapProvider(stage.entries);await initializeSavedDealsStorage(recovery);
    for(let cut=0;cut<=recovery.events.length;cut++){
     const restarted=mapProvider(prefix(stage.entries,recovery.events,cut));await initializeSavedDealsStorage(restarted);eq(rows(restarted.data),rows(before));
    }
   }
  }
  eq(fixture.events.at(-1).key,JOURNAL_KEY);eq(fixture.events.at(-1).op,'delete');ok(!after.has(JOURNAL_KEY));
  // Failure before/after every mutation, including journal preparation and
  // removal. A rejected operation is never accepted as a partial success.
  for(let position=1;position<=fixture.events.length;position++)for(const afterWrite of [false,true]){
   let seen=0,failed=false;
   const p=mapProvider(before,{onWrite:async event=>{if(event.before)seen++;if(!failed&&seen===position&&event.before===!afterWrite){failed=true;throw Error('Synthetic I/O interruption');}}});
   let error;try{await operation(fixture.kind,p);}catch(e){error=e;}
   if(position===1){ok(error);eq(error.reasonCode,undefined);}
   else if(position===fixture.events.length){if(afterWrite)eq(error,undefined);else eq(error?.reasonCode,'RESTORE_RECOVERY_REQUIRED');}
   else eq(error?.reasonCode,'RESTORE_STORAGE_FAILED_ROLLED_BACK');
   const restarted=mapProvider(p.data);await initializeSavedDealsStorage(restarted);
   eq(rows(restarted.data),rows(error?before:after));ok(failed);
  }
  const dirty=fixture.prefixes.find(s=>s.pending&&JSON.stringify(rows(new Map(s.entries)))!==JSON.stringify(rows(before))&&new Map(s.entries).get('deals-index')!==before.get('deals-index'))||fixture.prefixes.find(s=>s.pending);
  const dirtyMap=new Map(dirty.entries),journal=dirtyMap.get(JOURNAL_KEY);
  const recoveryTrace=mapProvider(dirtyMap);await initializeSavedDealsStorage(recoveryTrace);
  for(let position=1;position<=recoveryTrace.events.length;position++)for(const afterWrite of [false,true]){
   let seen=0,failed=false;
   const p=mapProvider(dirtyMap,{onWrite:async e=>{if(e.before)seen++;if(!failed&&seen===position&&e.before===!afterWrite){failed=true;throw Error('Synthetic recovery I/O failure');}}});
   let error;try{await initializeSavedDealsStorage(p);}catch(e){error=e;}
   if(error)eq(error.reasonCode,'RESTORE_RECOVERY_REQUIRED');
   const restarted=mapProvider(p.data);await initializeSavedDealsStorage(restarted);eq(rows(restarted.data),rows(before));ok(failed);
  }
  const mutations=[
   data=>data.set(JOURNAL_KEY,journal+'x'),
   data=>data.set(JOURNAL_KEY,altered(journal,j=>j.changes[0].key='outside:unsafe')),
   data=>data.set(JOURNAL_KEY,altered(journal,j=>j.changes.push(j.changes[0]))),
   data=>data.set(JOURNAL_KEY,altered(journal,j=>j.schemaVersion=2)),
   data=>data.set('deals-index',JSON.stringify([{id:'foreign'}])),
   data=>data.set(JSON.parse(journal).changes[0].key,'foreign record bytes'),
   data=>{const unchanged=JSON.parse(journal).unchanged[0];if(unchanged)data.set(unchanged.key,'foreign unchanged bytes');else data.set(JOURNAL_KEY,altered(journal,j=>j.unchanged.push({key:'deal:foreign',sha256:'a'.repeat(64)})));},
  ];
  for(const mutation of mutations){const data=new Map(dirtyMap);mutation(data);const p=mapProvider(data);await rejected(()=>initializeSavedDealsStorage(p),'RESTORE_RECOVERY_REQUIRED');eq(rows(p.data),rows(data));eq(p.events.length,0);await rejected(()=>initializeSavedDealsStorage(p),'RESTORE_RECOVERY_REQUIRED');}
  // Failed cleanup remains durable and recoverable after a fresh initialization.
  const p=mapProvider(dirtyMap,{onWrite:async e=>{if(e.before&&e.key===JOURNAL_KEY&&e.op==='delete')throw Error('Cleanup unavailable');}});
  await rejected(()=>initializeSavedDealsStorage(p),'RESTORE_RECOVERY_REQUIRED');ok(p.data.has(JOURNAL_KEY));const restarted=mapProvider(p.data);await initializeSavedDealsStorage(restarted);eq(rows(restarted.data),rows(before));
  const exportOnly=mapProvider(dirtyMap);const rescue=await buildCurrentExportPayload(exportOnly);ok(Array.isArray(rescue.deals));eq(exportOnly.events.length,0);ok(exportOnly.data.has(JOURNAL_KEY));
 }
 const p=mapProvider(fixtures[0].before);delete global.window.navigator.locks;await rejected(()=>operation('save',p),'STORAGE_COORDINATION_REQUIRED');eq(p.events.length,0);
 const dirty=fixtures[0].prefixes.find(s=>s.pending),blocked=mapProvider(dirty.entries);await rejected(()=>initializeSavedDealsStorage(blocked),'RESTORE_RECOVERY_REQUIRED');eq(blocked.events.length,0);
 global.window=coordinatedWindow();const legacy=mapProvider(fixtures[0].before,{capability:false});eq((await initializeSavedDealsStorage(legacy)).status,'NOT_SUPPORTED');await operation('save',legacy);ok(!legacy.data.has(JOURNAL_KEY));
 console.log('DURABLE_LOCAL_RECOVERY=PASS checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{delete global.window;});
