'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {qualifyLiveModel}=await import('../../tools/qualify-riai-live-model.mjs');
 const now=Date.parse('2026-11-24T00:00:00Z');
 const env={RIAI_AI_MODEL:'gpt-6.2-sol',RIAI_AI_PROVIDER_KEY:'synthetic-not-a-real-key',RIAI_AI_MODEL_POLICY_VERSION:'GPT6_20261124',RIAI_AI_REASONING_EFFORT:'low',RIAI_AI_PRICE_BOUND_MODEL:'gpt-6.2-sol',RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'10',RIAI_AI_FIXED_USD_MICROS_PER_REQUEST:'0',RIAI_AI_GLOBAL_USD_MICROS_PER_DAY:'1000000',RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2026-12-01T00:00:00Z',RIAI_AI_INPUT_TOKEN_UPPER_BOUND:'2048',RIAI_LIVE_CANARY_MAX_USD_MICROS:'50000',RIAI_LIVE_CANARY_CONFIRM:'ONE_SYNTHETIC_BILLABLE_REQUEST'};
 const good={status:'completed',model:env.RIAI_AI_MODEL,usage:{input_tokens:100,output_tokens:20,total_tokens:120},output:[{type:'message',content:[{type:'output_text',text:'{"status":"ok","synthetic":true}'}]}]};
 let calls=0;
 const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,256);assert.equal(body.input[0].role,'developer');assert.equal(options.redirect,'error');return new Response(JSON.stringify(good));};
 const ok=await qualifyLiveModel({env,now,fetchImpl});assert.equal(ok.ok,true);assert.equal(ok.productionAuthorized,false);assert.equal(ok.totalTokens,120);assert.equal(ok.reservedUsdMicros,23040);assert.equal(calls,1);assert.ok(!JSON.stringify(ok).includes(env.RIAI_AI_PROVIDER_KEY));
 for(const patch of [{RIAI_LIVE_CANARY_CONFIRM:''},{RIAI_AI_PROVIDER_KEY:''},{RIAI_AI_MODEL:'unreviewed'},{RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'NaN'},{RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'10.1'},{RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'1'},{RIAI_AI_INPUT_TOKEN_UPPER_BOUND:'5'},{RIAI_LIVE_CANARY_MAX_USD_MICROS:'1'},{RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2026-11-01T00:00:00Z'},{RIAI_AI_PRICE_BOUND_MODEL:'wrong'}]){
  const x=await qualifyLiveModel({env:{...env,...patch},now,fetchImpl});assert.equal(x.ok,false);assert.equal(x.providerRequestAttempted,false);
 }
 assert.equal(calls,1);
 for(const data of [{...good,model:'wrong'},{...good,status:'incomplete'},{...good,usage:{input_tokens:10,output_tokens:20,total_tokens:31}},{...good,usage:{input_tokens:2049,output_tokens:20,total_tokens:2069}},{...good,output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},{...good,output:[{type:'message',content:[{type:'output_text',text:'{"status":"ok","synthetic":false}'}]}]}]){
  let n=0;const x=await qualifyLiveModel({env,now,fetchImpl:async()=>{n++;return new Response(JSON.stringify(data));}});assert.equal(x.ok,false);assert.equal(x.providerRequestAttempted,true);assert.equal(n,1);
 }
 const http=await qualifyLiveModel({env,now,fetchImpl:async()=>new Response('private provider error',{status:429})});assert.equal(http.httpStatus,429);assert.ok(!JSON.stringify(http).includes('private provider error'));
 console.log('RIAI_LIVE_CANARY_CONTRACT=PASS mocked_provider_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
