'use strict';
const assert=require('node:assert/strict');
(async()=>{
 const {monetaryReservation}=await import('../../functions/api/riai/_money-budget.mjs');
 const {reserveGatewayQuota,settleGatewayQuota}=await import('../../functions/api/riai/_quota-client.mjs');
 const config=require('../fixtures/riai-money-bound')('test-model');
 const now=Date.parse('2026-10-19T00:00:00Z');
 assert.equal(monetaryReservation(config,'test-model',60,now).money.reservedUsdMicros,60);
 assert.equal(monetaryReservation({...config,RIAI_AI_FIXED_USD_MICROS_PER_REQUEST:'5'},'test-model',60,now).money.reservedUsdMicros,65);
 for(const change of [{RIAI_AI_PRICE_BOUND_MODEL:'different'},{RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2026-10-18T00:00:00Z'},{RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2027-02-30T00:00:00Z'},{RIAI_AI_FIXED_USD_MICROS_PER_REQUEST:''},{RIAI_AI_FIXED_USD_MICROS_PER_REQUEST:undefined},{RIAI_AI_GLOBAL_USD_MICROS_PER_DAY:'0'},{RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'-1'}])
  assert.equal(monetaryReservation({...config,...change},'test-model',60,now).ok,false);
 assert.equal(monetaryReservation({...config,RIAI_AI_MAX_USD_MICROS_PER_TOKEN:String(Number.MAX_SAFE_INTEGER)},'test-model',60,now).ok,false);
 const binding=require('../fixtures/riai-quota-binding')();
 const request=i=>({id:`money-reservation-${String(i).padStart(8,'0')}`,subjectHash:'a'.repeat(64),tokens:60,
  limits:{minute:100,subjectDay:100,globalDay:100,tokensDay:10000},money:{reservedUsdMicros:60,limitUsdMicros:120,model:'test-model'}});
 const outcomes=await Promise.all(Array.from({length:10},(_,i)=>reserveGatewayQuota(binding,request(i))));
 assert.equal(outcomes.filter(x=>x.allowed).length,2);
 assert.ok(outcomes.filter(x=>!x.allowed).every(x=>x.code==='AI_MONETARY_BUDGET_EXCEEDED'));
 assert.equal([...binding.state.data.entries()].find(([k])=>k.startsWith('usd-micros:'))[1],120);
 assert.equal([...binding.state.data.entries()].find(([k])=>k.startsWith('global:'))[1],2);
 assert.equal((await settleGatewayQuota(binding,{id:request(0).id,actualTokens:0})).ok,true);
 assert.equal([...binding.state.data.entries()].find(([k])=>k.startsWith('usd-micros:'))[1],120);
 assert.equal((await reserveGatewayQuota(binding,request(20))).allowed,false);
 const legacyBinding={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({allowed:true,replayed:false,id:request(0).id,reservedTokens:60})})};
 assert.equal((await reserveGatewayQuota(legacyBinding,request(0))).allowed,false);
 console.log('RIAI_MONETARY_BUDGET: PASS (synthetic ceilings; retained reservation, concurrent admission, bounds, legacy-worker rejection)');
})().catch(e=>{console.error(e);process.exitCode=1;});
