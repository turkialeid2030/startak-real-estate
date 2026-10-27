const assert=require('node:assert/strict');
(async()=>{
 const {reserveGatewayQuota,settleGatewayQuota,verifiedUsage}=await import('../../functions/api/riai/_quota-client.mjs');
 assert.equal((await reserveGatewayQuota(null,{})).code,'AI_ATOMIC_QUOTA_UNAVAILABLE');
 const stalled={idFromName:()=>'',get:()=>({fetch:()=>new Promise(()=>{})})};
 assert.equal((await reserveGatewayQuota(stalled,{})).code,'AI_ATOMIC_QUOTA_UNAVAILABLE');
 const malformed={idFromName:()=>'',get:()=>({fetch:async()=>new Response('not json')})};
 assert.equal((await settleGatewayQuota(malformed,{})).ok,false);
 assert.equal(verifiedUsage({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}},'CHAT_COMPLETIONS'),30);
 assert.equal(verifiedUsage({usage:{input_tokens:10,output_tokens:20,total_tokens:30}},'OPENAI_RESPONSES'),30);
 for(const protocol of ['',undefined,'UNKNOWN','OPENAI_RESPONSES_V2','chat_completions'])
   assert.equal(verifiedUsage({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}},protocol),null);
 for(const usage of [undefined,{prompt_tokens:10,completion_tokens:20,total_tokens:29},{prompt_tokens:'10',completion_tokens:20,total_tokens:30},{prompt_tokens:0,completion_tokens:-1,total_tokens:-1}]) assert.equal(verifiedUsage({usage},'CHAT_COMPLETIONS'),null);
 console.log('RIAI_QUOTA_CLIENT=PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
