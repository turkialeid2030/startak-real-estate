'use strict';
const assert = require('assert');
const path = require('path');
class FakeKV { constructor(){ this.map=new Map(); } async get(k){ return this.map.get(k) ?? null; } async put(k,v){ this.map.set(k,v); } }
const SNAPSHOT={schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',asOfDate:'2026-09-03',readinessStatus:'NEEDS_DUE_DILIGENCE',readiness:{blockers:[{code:'TITLE_EVIDENCE_REQUIRED',field:'propertyInterest.title'}]},acquisitionScore:{status:'CALCULATED_WITH_GAPS',redFlags:[{code:'PRICE_HIGH',severity:'HIGH'}]},governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}};
function env(overrides={}){return{RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'placeholder',RIAI_AI_MODEL:'test-model',...require('../fixtures/riai-money-bound')('test-model'),RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY:'100000',RIAI_AI_INPUT_TOKEN_UPPER_BOUND:'20000',RIAI_AI_QUOTA:require('../fixtures/riai-quota-binding')(),RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV(),RIAI_AUDIT_SUBJECT_SALT:'placeholder-salt',...overrides};}
function req(snapshot){return new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:snapshot})});}
function provider(boundary='This output is advisory analysis only and does not constitute an investment or legal recommendation.'){return{choices:[{message:{content:JSON.stringify({executiveObservations:['NOI_WITHIN_RANGE'],riskFlags:[{code:'LEASE_RISK',severity:'MEDIUM',rationale:'CONCENTRATION_RISK'}],evidenceGaps:['MARKET_RENT_MISSING'],dueDiligenceQuestions:['CONFIRM_TITLE'],scenarioChecks:['STRESS_TEST'],earlyWarningIndicators:[{indicator:'DSCR_DECLINING',whyItMatters:'COVERAGE_NARROWING'}],decisionBoundary:boundary})}}]};}
(async()=>{
 const {onRequestPost}=await import(path.join(__dirname,'..','..','functions/api/riai/ai-assist.js'));
 let called=false; global.fetch=async()=>{called=true;return new Response(JSON.stringify(provider()),{status:200});};
 let r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AI_QUOTA:undefined})}); assert.equal(r.status,503); assert.equal(called,false);
 const e=env(); r=await onRequestPost({request:req(SNAPSHOT),env:e}); const b=await r.json(); assert.equal(r.status,200); assert.equal(b.ok,true); assert.equal(e.RIAI_AUDIT_KV.map.size,2);
 const events=Array.from(e.RIAI_AUDIT_KV.map.values()).map(JSON.parse); assert.equal(events[0].invocationId,events[1].invocationId); assert.notEqual(events[0].eventId,events[1].eventId);
 called=false;
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AUDIT_KV:undefined})}); assert.equal(r.status,503); assert.equal(called,false); assert.equal((await r.json()).code,'AI_AUDIT_STORE_UNAVAILABLE');
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AUDIT_KV:{put:async()=>{throw new Error('synthetic failure');}}})}); assert.equal(r.status,503); assert.equal(called,false);
 let writes=0;
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AUDIT_KV:{put:async()=>{if(++writes===2)throw new Error('synthetic terminal failure');}}})});
 const auditFailure=await r.json(); assert.equal(r.status,503); assert.equal(called,true); assert.equal(auditFailure.providerRequestAttempted,true); assert.equal(auditFailure.automaticRetryAllowed,false); assert.equal(auditFailure.result,undefined);
 const spoof=JSON.parse(JSON.stringify(SNAPSHOT)); spoof.readiness.blockers[0].field='Tenant: Ahmed Al-Otaibi, Unit 14B'; called=false; r=await onRequestPost({request:req(spoof),env:env()}); const sb=await r.json(); assert.equal(r.status,400); assert.equal(sb.code,'SNAPSHOT_FREE_TEXT_NOT_PERMITTED'); assert.equal(called,false);
 global.fetch=async()=>new Response('x'.repeat(65537));
 r=await onRequestPost({request:req(SNAPSHOT),env:env()}); assert.equal(r.status,502); assert.equal((await r.json()).code,'AI_PROVIDER_RESPONSE_TOO_LARGE');
 global.fetch=async()=>new Response(new ReadableStream({start(c){c.error(new Error('synthetic stream failure'));}}));
 r=await onRequestPost({request:req(SNAPSHOT),env:env()}); assert.equal(r.status,502); assert.equal((await r.json()).code,'AI_PROVIDER_RESPONSE_READ_FAILED');
 writes=0;
 global.fetch=async()=>new Response('synthetic rejection',{status:500});
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AUDIT_KV:{put:async()=>{if(++writes===2)throw new Error('terminal audit failure');}}})});
 assert.equal(r.status,503); assert.equal((await r.json()).code,'AI_AUDIT_WRITE_FAILED');
 let providerCalls=0;
 global.fetch=async()=>{providerCalls++;return new Response(JSON.stringify({...provider(),usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}));};
 // Freeze only the quota minute for this concurrency assertion (not global Date.now).
 // The previous real-time minute boundary could legitimately admit a second request.
 const fixedMinute = Date.UTC(2026, 10, 4, 12, 30, 0);
 const concurrentEnv=env({RIAI_AI_RATE_PER_MINUTE:'1',
   RIAI_AI_QUOTA:require('../fixtures/riai-quota-binding')({fixedNow:fixedMinute})});
 const responses=await Promise.all(Array.from({length:10},()=>onRequestPost({request:req(SNAPSHOT),env:concurrentEnv})));
 assert.equal(providerCalls,1); assert.equal(responses.filter(response=>response.status===200).length,1); assert.equal(responses.filter(response=>response.status===429).length,9);
 assert.equal(Array.from(concurrentEnv.RIAI_AI_QUOTA.state.data.entries()).find(([key])=>key.startsWith('tokens:'))[1],30);
 providerCalls=0;
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AI_INPUT_TOKEN_UPPER_BOUND:undefined})});assert.equal(r.status,503);assert.equal(providerCalls,0);
 const replayBinding={idFromName:()=>'',get:()=>({fetch:async(url,options)=>{const input=JSON.parse(options.body);return Response.json({allowed:true,replayed:true,id:input.id,reservedTokens:input.tokens});}})};
 r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_AI_QUOTA:replayBinding})});assert.equal(r.status,503);assert.equal(providerCalls,0);
 const settlementEnv=env(); const originalGet=settlementEnv.RIAI_AI_QUOTA.get;
 settlementEnv.RIAI_AI_QUOTA.get=()=>({fetch:async(url,options)=>url.endsWith('/settle')?Response.json({settled:false}):originalGet().fetch(url,options)});
 r=await onRequestPost({request:req(SNAPSHOT),env:settlementEnv});assert.equal(r.status,503);assert.equal((await r.json()).code,'AI_QUOTA_SETTLEMENT_REJECTED');
 for(const field of ['executiveObservations','evidenceGaps','scenarioChecks','dueDiligenceQuestions']) {
   const malicious=provider();const output=JSON.parse(malicious.choices[0].message.content);output[field]=['القيمة السوقية 100 مليون ريال'];malicious.choices[0].message.content=JSON.stringify(output);
   global.fetch=async()=>Response.json(malicious);
   r=await onRequestPost({request:req(SNAPSHOT),env:env()});const blocked=await r.json();assert.equal(r.status,502);assert.equal(blocked.code,'AI_UNSOURCED_NUMERIC_CLAIM');assert.equal(blocked.result,undefined);
 }
 // Once a provider request has been attempted, never represent the failure
 // as safe for automatic retry: the upstream call may already be billable.
 const upstreamFailures=[
   ['AI_PROVIDER_UNREACHABLE',async()=>{throw new Error('synthetic network failure');}],
   ['AI_PROVIDER_TIMEOUT',async()=>{const e=new Error('synthetic abort');e.name='AbortError';throw e;}],
   ['AI_PROVIDER_REJECTED_REQUEST',async()=>new Response('synthetic rejection',{status:502})],
   ['AI_PROVIDER_RESPONSE_TOO_LARGE',async()=>new Response('x'.repeat(65537))],
   ['AI_PROVIDER_RESPONSE_READ_FAILED',async()=>new Response(new ReadableStream({start(c){c.error(new Error('synthetic stream failure'));}}))],
   ['AI_PROVIDER_RESPONSE_INVALID_JSON',async()=>new Response('not-json')],
   ['AI_PROVIDER_RESPONSE_UNSUPPORTED',async()=>Response.json({choices:[]})],
   ['AI_PROVIDER_JSON_INVALID',async()=>Response.json({choices:[{message:{content:'not-json'}}]})],
   ['AUTOMATIC_DECISION_LANGUAGE_PROHIBITED',async()=>Response.json(provider('Advisory only; proceed with the transaction.'))]
 ];
 for(const [code,transport] of upstreamFailures){
   let attempts=0;global.fetch=async()=>{attempts++;return transport();};
   const response=await onRequestPost({request:req(SNAPSHOT),env:env()});
   const payload=await response.json();
   assert.equal(response.status,502,code);assert.equal(payload.code,code);
   assert.equal(payload.providerRequestAttempted,true,code);
   assert.equal(payload.automaticRetryAllowed,false,code);
   assert.equal(payload.aiModelUsed,false,code);assert.equal(payload.result,undefined,code);
   assert.equal(attempts,1,code);
 }
 console.log('RIAI_POST_DISPATCH_FAILURE_CONTRACT=PASS cases='+upstreamFailures.length+' synthetic_only=true');
 let moneyProviderCalls=0;global.fetch=async()=>{moneyProviderCalls++;return Response.json(provider());};
 for(const overrides of [{RIAI_AI_PRICE_BOUND_MODEL:undefined},{RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2020-01-01T00:00:00Z'},{RIAI_AI_GLOBAL_USD_MICROS_PER_DAY:'1'}]) {
   r=await onRequestPost({request:req(SNAPSHOT),env:env(overrides)});
   assert.ok([429,503].includes(r.status));assert.equal(moneyProviderCalls,0);
 }
 // Prove that ordinary pre-dispatch denials cannot be mistaken for a potentially billed request.
 const beforeProvider=[
   {RIAI_AI_PROVIDER_KEY:undefined},
   {RIAI_AI_MODEL:undefined},
   {RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY:undefined},
   {RIAI_AI_INPUT_TOKEN_UPPER_BOUND:undefined},
   {RIAI_AI_PRICE_BOUND_MODEL:undefined},
   {RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2020-01-01T00:00:00Z'},
   {RIAI_AI_GLOBAL_USD_MICROS_PER_DAY:'1'},
   {RIAI_AI_QUOTA:undefined},
   {RIAI_AUDIT_KV:undefined}
 ];
 let deniedCalls=0;global.fetch=async()=>{deniedCalls++;throw Error('unexpected provider call');};
 for(const overrides of beforeProvider){
   const denial=await onRequestPost({request:req(SNAPSHOT),env:env(overrides)});
   const payload=await denial.json();assert.ok([429,503].includes(denial.status),payload.code);
   assert.equal(payload.providerRequestAttempted,false,payload.code);
   assert.equal(payload.automaticRetryAllowed,false,payload.code);assert.equal(payload.result,undefined);
 }
 const invalidBody=await onRequestPost({request:new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:'{bad'}),env:env()});
 assert.equal(invalidBody.status,400);assert.equal((await invalidBody.json()).providerRequestAttempted,false);
 assert.equal(deniedCalls,0);
 console.log('RIAI_PRE_DISPATCH_DENIAL_CONTRACT=PASS scenarios=10 synthetic_only=true');
 // Overrun must fail closed and block a subsequent provider call for the quota day.
 const overrunEnv=env({RIAI_AI_QUOTA:require('../fixtures/riai-quota-binding')({fixedNow:fixedMinute})});
 let overrunCalls=0;
 global.fetch=async()=>{overrunCalls++;return Response.json({...provider(),usage:{prompt_tokens:50000,completion_tokens:10,total_tokens:50010}});};
 const overrun=await onRequestPost({request:req(SNAPSHOT),env:overrunEnv});
 const overrunBody=await overrun.json();
 assert.equal(overrun.status,503);assert.equal(overrunBody.code,'AI_QUOTA_SETTLEMENT_REJECTED');
 assert.equal(overrunBody.providerRequestAttempted,true);assert.equal(overrunBody.automaticRetryAllowed,false);
 const blockedAfterOverrun=await onRequestPost({request:req(SNAPSHOT),env:overrunEnv});
 const blockedAfterOverrunBody=await blockedAfterOverrun.json();
 assert.equal(blockedAfterOverrun.status,503);assert.equal(blockedAfterOverrunBody.providerRequestAttempted,false);
 assert.equal(overrunCalls,1);
 assert.equal(Array.from(overrunEnv.RIAI_AI_QUOTA.state.data.entries()).find(([key])=>key.startsWith('blocked:'))[1],true);
 console.log('RIAI_QUOTA_OVERRUN_FOLLOWUP_DENIAL=PASS synthetic_only=true');
 console.log('RIAI_GATEWAY_INTEGRATION=PASS');
})().catch((e)=>{console.error(e);process.exit(1);});
