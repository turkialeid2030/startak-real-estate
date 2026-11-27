'use strict';
const assert = require('node:assert/strict');

(async () => {
  const { reserveGatewayQuota } = await import('../../functions/api/riai/_quota-client.mjs');
  const { verifyTurnstile, TURNSTILE_ACTION } = await import('../../functions/api/riai/_public-ai-security.mjs');
  const quotaInput = {id:'synthetic-quota-invocation',tokens:100};
  const binding = payload => ({
    idFromName: name => name,
    get: () => ({fetch: async () => Response.json(payload)}),
  });
  let checks = 0;
  const validCodes = {
    MINUTE_LIMIT:'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE',
    SUBJECT_DAY_LIMIT:'AI_RATE_LIMIT_EXCEEDED_PER_DAY',
    GLOBAL_DAY_LIMIT:'AI_SPEND_BUDGET_EXHAUSTED',
    TOKEN_DAY_LIMIT:'AI_TOKEN_BUDGET_EXCEEDED',
    MONETARY_DAY_LIMIT:'AI_MONETARY_BUDGET_EXCEEDED',
  };
  for (const [code, expected] of Object.entries(validCodes)) {
    assert.deepEqual(await reserveGatewayQuota(binding({allowed:false,code}),quotaInput),
      {allowed:false,status:429,code:expected});
    checks++;
  }
  for (const code of ['constructor','toString','__proto__','hasOwnProperty','UNKNOWN',['MINUTE_LIMIT'],{},null,1]) {
    assert.deepEqual(await reserveGatewayQuota(binding({allowed:false,code}),quotaInput),
      {allowed:false,status:503,code:'AI_ATOMIC_QUOTA_REJECTED'});
    checks++;
  }
  const allowed = await reserveGatewayQuota(binding({allowed:true,replayed:false,id:quotaInput.id,reservedTokens:100}),quotaInput);
  assert.equal(allowed.allowed,true);
  assert.equal(allowed.status,200);
  checks++;
  const request = new Request('https://synthetic.example.test/api/riai/ai-assist');
  const env = {RIAI_TURNSTILE_SECRET_KEY:'synthetic-placeholder'};
  const args = {request,env,token:'synthetic-token'};
  const good = {success:true,action:TURNSTILE_ACTION,hostname:'synthetic.example.test'};
  assert.equal((await verifyTurnstile({...args,fetchImpl:async()=>Response.json(good)})).ok,true);
  checks++;
  for (const [patch,code] of [[{action:'OTHER'},'AI_TURNSTILE_ACTION_INVALID'],[{hostname:'other.example.test'},'AI_TURNSTILE_HOSTNAME_INVALID']]) {
    const result=await verifyTurnstile({...args,fetchImpl:async()=>Response.json({...good,...patch})});
    assert.equal(result.ok,false);assert.equal(result.code,code);checks++;
  }
  let resolveLate, signal, watchdog;
  const stalled = verifyTurnstile({...args,fetchImpl:(_url,options)=>{
    signal=options.signal;
    return new Promise(resolve=>{resolveLate=resolve;});
  }});
  let result;
  try {
    result=await Promise.race([stalled,new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(new Error('TURNSTILE_TEST_WATCHDOG')),8000);})]);
  } finally {clearTimeout(watchdog);}
  assert.deepEqual(result,{ok:false,status:503,code:'AI_TURNSTILE_UNAVAILABLE'});checks++;
  assert.equal(signal.aborted,true);checks++;
  let cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  resolveLate(new Response(body));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(cancelled,true);checks++;
  console.log('V7_AI_QUOTA_TURNSTILE_BOUNDARY=PASS checks='+checks+' synthetic_network=true');
})().catch(error=>{console.error(error);process.exit(1);});
