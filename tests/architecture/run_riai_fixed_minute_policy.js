'use strict';
// Deterministic fixed-minute policy and daily atomic ceiling contract for #769.
// Calls the real reservation implementation with a transactional synthetic store.
// No Date.now(), provider traffic, environment secrets, or production changes.
const assert = require('node:assert/strict');
(async () => {
 const {reserveQuota}=await import('../../workers/riai-quota/quota.mjs');
 function fixture(){
   const state={data:new Map(),tail:Promise.resolve()};
   const storage={transaction(fn){
     const work=state.tail.then(async()=>{
       const copy=structuredClone(state.data);
       const result=await fn({get:async k=>copy.get(k),put:async(k,v)=>copy.set(k,v)});
       state.data=copy;
       return result;
     });
     state.tail=work.catch(()=>{});
     return work;
   }};
   return {state,storage};
 }
 const currentMinute=Date.UTC(2026,10,4,12,30,0);
 const lastMs=currentMinute+59999;
 const firstMs=currentMinute+60000;
 const subjectHash='f'.repeat(64);
 function input(i,now,{globalDay=100,usdLimit=100}={}){
   return {
     id:'riai-policy-case-'+String(i).padStart(8,'0'),
     subjectHash,now,tokens:10,
     limits:{minute:1,subjectDay:100,globalDay,tokensDay:1000},
     money:{reservedUsdMicros:10,limitUsdMicros:usdLimit,model:'test-model'}
   };
 }
 function admitted(responses){return responses.filter(x=>x.allowed===true&&x.replayed===false).length;}
 const calendar=fixture();
 const across=await Promise.all([
   reserveQuota(calendar.storage,input(1,lastMs)),
   reserveQuota(calendar.storage,input(2,firstMs))
 ]);
 assert.equal(admitted(across),2);
 assert.equal(across[0].allowed,true);
 assert.equal(across[1].allowed,true);
 const day=Math.floor(lastMs/86400000);
 assert.equal(calendar.state.data.get('global:'+day),2);
 assert.equal(calendar.state.data.get('usd-micros:'+day),20);

 const same=fixture();
 const simultaneous=await Promise.all(Array.from({length:50},(_,i)=>
   reserveQuota(same.storage,input(i+100,firstMs))));
 assert.equal(admitted(simultaneous),1);
 assert.equal(simultaneous.filter(x=>x.code==='MINUTE_LIMIT').length,49);
 assert.equal(same.state.data.get('global:'+day),1);

 const global=fixture();
 const globalResults=await Promise.all([
   reserveQuota(global.storage,input(300,lastMs,{globalDay:1})),
   reserveQuota(global.storage,input(301,firstMs,{globalDay:1}))
 ]);
 assert.equal(admitted(globalResults),1);
 assert.equal(globalResults[1].code,'GLOBAL_DAY_LIMIT');
 assert.equal(global.state.data.get('global:'+day),1);

 const money=fixture();
 const moneyResults=await Promise.all([
   reserveQuota(money.storage,input(400,lastMs,{usdLimit:10})),
   reserveQuota(money.storage,input(401,firstMs,{usdLimit:10}))
 ]);
 assert.equal(admitted(moneyResults),1);
 assert.equal(moneyResults[1].code,'MONETARY_DAY_LIMIT');
 assert.equal(money.state.data.get('usd-micros:'+day),10);

 console.log('RIAI_FIXED_MINUTE_POLICY=PASS adjacentMsAllowed='+admitted(across)+
   ' sameMinute50Allowed='+admitted(simultaneous)+
   ' globalDayLimitAllowed='+admitted(globalResults)+
   ' monetaryDayLimitAllowed='+admitted(moneyResults)+
   ' policy=FIXED_CALENDAR_MINUTE atomicDailyCeilings=true');
})().catch(error=>{console.error(error);process.exitCode=1;});
