'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {makePostgresCustodyStore}=require('../../src/market/postgres-custody-store');
const {VERSION,custodyEventBytes,custodyEventHash}=require('../../src/market/signed-evidence-custody');
const {privateKey}=crypto.generateKeyPairSync('ed25519');
const scope={tenantId:'TENANT-A',caseRef:'CASE-A',evidenceRef:'EVID-A',sha256:'a'.repeat(64)};
function next(l){const prev=l?.events.at(-1),event={sequence:(l?.events.length??0)+1,kind:prev?'RECHECKED':'SEALED',actorRef:'ACTOR-A',observedAt:prev?'2026-09-02':'2026-09-01',signerKeyRef:'SIGNER-A',previousHashSha256:prev?custodyEventHash(scope,prev.event,prev.signature):null};return {version:VERSION,scope,events:[...(l?.events??[]),{event,signature:crypto.sign(null,custodyEventBytes(scope,event),privateKey).toString('base64')}]};}
let rows=new Map(),bypass=false,commitFail=false,discarded=0;
const pool={connect:async()=>({query:async(sql,p=[])=>{
 if(sql==='BEGIN'||sql==='ROLLBACK')return {command:sql};
 if(sql==='COMMIT'){if(commitFail)throw Error('private internal error');return {command:sql};}
 if(sql.startsWith('SELECT current_user'))return {rowCount:1,rows:[{role_name:'custody_runtime',database_name:'synthetic_db',rolsuper:false,rolbypassrls:bypass,relrowsecurity:true,relforcerowsecurity:true,owner_member:false}]};
 if(sql.startsWith('SELECT set_config'))return {rowCount:1,rows:[{tenant_id:p[0],case_ref:p[1]}]};
 const k=JSON.stringify(p.slice(0,3)),row=rows.get(k);
 if(sql.startsWith('SELECT content_sha256'))return {rowCount:row?1:0,rows:row?[row]:[]};
 if(sql.startsWith('INSERT')||sql.startsWith('UPDATE')){
  const l=JSON.parse(p[6]);if(sql.startsWith('INSERT')?!!row:!row||row.content_sha256!==p[3]||row.revision!==p[7]||row.head_sha256!==p[8]||JSON.stringify(row.ledger.events)!==JSON.stringify(l.events.slice(0,-1)))return {rowCount:0,rows:[]};
  rows.set(k,{content_sha256:p[3],revision:p[4],head_sha256:p[5],ledger:l});return {rowCount:1,rows:[{revision:p[4]}]};
 }
 throw Error('unexpected query');
},release:x=>{if(x)discarded++;}})};
const store=makePostgresCustodyStore({pool,expectedRole:'custody_runtime',expectedDatabase:'synthetic_db'});
async function main(){
 const one=next(null),two=next(one),h=custodyEventHash(scope,one.events[0].event,one.events[0].signature);
 assert.equal(await store.loadLedger(scope),null);
 assert.equal(await store.compareAndAppend({scope,expectedRevision:0,expectedHeadHashSha256:null,candidate:one}),true);
 assert.equal(await store.compareAndAppend({scope,expectedRevision:0,expectedHeadHashSha256:null,candidate:one}),false);
 assert.deepEqual(await store.loadLedger(scope),one);
 assert.equal(await store.compareAndAppend({scope,expectedRevision:1,expectedHeadHashSha256:h,candidate:two}),true);
 assert.equal(await store.compareAndAppend({scope,expectedRevision:1,expectedHeadHashSha256:h,candidate:two}),false);
 assert.equal(await store.loadLedger({...scope,caseRef:'CASE-B'}),null);
 await assert.rejects(()=>store.loadLedger({...scope,sha256:'b'.repeat(64)}),/TRANSACTION_FAILED/);
 bypass=true;await assert.rejects(()=>store.loadLedger(scope),/TRANSACTION_FAILED/);bypass=false;
 commitFail=true;await assert.rejects(()=>store.loadLedger(scope),/TRANSACTION_FAILED/);
 assert.ok(discarded>=3);assert.equal(store.productionPersistenceVerified,false);
 console.log('POSTGRES_CUSTODY_STORE_CONTRACT=PASS synthetic_pool=true production=false');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
