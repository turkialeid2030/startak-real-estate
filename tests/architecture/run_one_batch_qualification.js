'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {REQUIRED,summarize,observeEndpoint,markdown,runInitialPreviewStages}=await import('../../tools/verify-all-stages.mjs');
 const checks=REQUIRED.map(id=>({id,status:'PASS'})),sha='a'.repeat(40);
 const p=summarize({sha,checks,observations:[{id:'preview',status:'PASS',reason:'EXACT_SOURCE_AND_ASSET_HASHES_VERIFIED'}],requestCount:36});
 assert.equal(p.stages.find(x=>x.id==='D04').registeredMatrixStatus,'PASS');assert.equal(p.stages.find(x=>x.id==='D04').status,'PARTIAL');
 assert.equal(p.engineeringStatus,'PASS');assert.equal(p.exitCode,2);assert.equal(p.productionAuthorized,false);
 assert(p.stages.filter(x=>['MARKET_DATA','LIVE_AI','TENANT_ISOLATION','PROFESSIONAL_REVIEW'].includes(x.id)).every(x=>x.status==='BLOCKED'));
 assert.equal(p.independentlyApprovedCount,0);assert.equal(p.requestsSent,0);assert(markdown(p).includes('HOLD / NOT_AUTHORIZED'));
 for(const missing of REQUIRED){const r=summarize({sha,checks:checks.filter(c=>c.id!==missing),observations:[],requestCount:36});assert.equal(r.engineeringStatus,'FAIL');assert.equal(r.exitCode,1);if(missing==='locale-browser')assert.equal(r.stages.find(x=>x.id==='D04').registeredMatrixStatus,'NOT_TESTED');}
 assert.throws(()=>summarize({sha,checks:[...checks,checks[0]],observations:[],requestCount:36}));
 assert.throws(()=>summarize({sha:'main',checks,observations:[],requestCount:36}));
 assert.throws(()=>summarize({sha,checks,observations:[],requestCount:35}));
 let cancelled=0;
 for(const status of [200,302,401,403]){
  const r=await observeEndpoint('ai-config','https://synthetic.invalid/',async(_,options)=>{assert.equal(options.redirect,'manual');return {status,body:{cancel:async()=>cancelled++}};});
  assert.equal(r.status,'BLOCKED');assert.equal(r.httpStatus,status);assert(!('body' in r));
 }
 assert.equal(cancelled,4);
 assert.equal((await observeEndpoint('x','https://synthetic.invalid/',async()=>{throw Error('private error');})).reason,'ENDPOINT_NOT_OBSERVABLE');
 const initialIds=['sectors-browser','owner-browser','export-browser'];
 for(const concurrency of [1,2]){
  let active=0,peak=0;const seen=[],ended=[];
  let releaseSectors;
  const ownerStarted=new Promise(resolve=>{releaseSectors=resolve;});
  const rows=await runInitialPreviewStages(async(id,file)=>{
   active++;peak=Math.max(peak,active);seen.push(id);
   assert.ok(file.endsWith('.js'));
   if(concurrency===2&&id==='sectors-browser')await ownerStarted;
   if(id==='owner-browser')releaseSectors();
   await Promise.resolve();ended.push(id);active--;
   if(id==='owner-browser')throw Error('synthetic stage failure');
   return {id,status:'PASS'};
  },concurrency);
  assert.deepEqual(rows.map(r=>r.id),initialIds);
  assert.deepEqual(rows.map(r=>r.status),['PASS','FAIL','PASS']);
  assert.equal(seen.length,3);assert.equal(new Set(seen).size,3);
  assert.equal(peak,concurrency);assert.equal(active,0);
  assert.ok(ended.indexOf('owner-browser')<ended.indexOf('export-browser'));
 }
 const malformed=await runInitialPreviewStages(async id=>({id:'wrong-'+id,status:'PASS'}),2);
 assert.deepEqual(malformed.map(r=>r.status),['FAIL','FAIL','FAIL']);
 await assert.rejects(()=>runInitialPreviewStages(()=>{},3),/INITIAL_LANES_INVALID/);
 console.log('INITIAL_PREVIEW_LANES=PASS bounded_concurrency=1,2 no_skipped_stages=true');
 console.log('ONE_BATCH_ALL_STAGES_QUALIFICATION=PASS required_checks='+REQUIRED.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
