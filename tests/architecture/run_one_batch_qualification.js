'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {REQUIRED,summarize,observeEndpoint,markdown}=await import('../../tools/verify-all-stages.mjs');
 const checks=REQUIRED.map(id=>({id,status:'PASS'})),sha='a'.repeat(40);
 const p=summarize({sha,checks,observations:[{id:'preview',status:'PASS',reason:'EXACT_SOURCE_AND_ASSET_HASHES_VERIFIED'}],requestCount:36});
 assert.equal(p.engineeringStatus,'PASS');assert.equal(p.exitCode,2);assert.equal(p.productionAuthorized,false);
 assert(p.stages.filter(x=>['MARKET_DATA','LIVE_AI','TENANT_ISOLATION','PROFESSIONAL_REVIEW'].includes(x.id)).every(x=>x.status==='BLOCKED'));
 assert.equal(p.independentlyApprovedCount,0);assert.equal(p.requestsSent,0);assert(markdown(p).includes('HOLD / NOT_AUTHORIZED'));
 for(const missing of REQUIRED){const r=summarize({sha,checks:checks.filter(c=>c.id!==missing),observations:[],requestCount:36});assert.equal(r.engineeringStatus,'FAIL');assert.equal(r.exitCode,1);}
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
 console.log('ONE_BATCH_ALL_STAGES_QUALIFICATION=PASS required_checks='+REQUIRED.length);
})().catch(e=>{console.error(e);process.exitCode=1;});
