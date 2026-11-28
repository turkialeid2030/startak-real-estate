'use strict';
const assert = require('node:assert/strict');
(async () => {
  const {reserveQuota,settleQuota}=await import('../../workers/riai-quota/quota.mjs');
  const fixture={id:'synthetic-invocation-001',subjectHash:'a'.repeat(64),now:1800000000000,tokens:10,limits:{minute:10,subjectDay:20,globalDay:100,tokensDay:1000}};
  function storage(){
    const data=new Map();
    return {data,transaction:async fn=>{
      const copy=structuredClone(data);
      const result=await fn({get:async key=>copy.get(key),put:async(key,value)=>copy.set(key,value)});
      data.clear();for(const [key,value] of copy)data.set(key,value);
      return result;
    }};
  }
  let checks=0;
  for(const patch of [{id:[fixture.id]},{id:1234567890123456},{id:{}},{subjectHash:[fixture.subjectHash]},{subjectHash:{}},{subjectHash:123}]){
    const s=storage();
    assert.deepEqual(await reserveQuota(s,{...fixture,...patch}),{allowed:false,code:'INVALID_QUOTA_INPUT'});
    assert.equal(s.data.size,0);
    checks++;
  }
  for(const id of [[fixture.id],1234567890123456,{}]){
    const s=storage();assert.equal((await reserveQuota(s,fixture)).allowed,true);
    const before=structuredClone(s.data);
    assert.deepEqual(await settleQuota(s,{id,actualTokens:0}),{settled:false,code:'INVALID_USAGE'});
    assert.deepEqual(s.data,before);
    checks++;
  }
  for(const patch of [{state:'UNKNOWN'},{day:-1},{day:'20833'},{tokens:0},{tokens:'10'},{id:'different-reservation'}]){
    const s=storage();assert.equal((await reserveQuota(s,fixture)).allowed,true);
    const key='reservation:'+fixture.id;
    s.data.set(key,{...s.data.get(key),...patch});
    const before=structuredClone(s.data);
    assert.deepEqual(await settleQuota(s,{id:fixture.id,actualTokens:0}),{settled:false,code:'CORRUPT_RESERVATION_STATE'});
    assert.deepEqual(s.data,before);
    checks++;
  }
  const s=storage();
  assert.equal((await reserveQuota(s,fixture)).allowed,true);checks++;
  assert.deepEqual(await settleQuota(s,{id:fixture.id,actualTokens:5}),{settled:true,replayed:false,overage:false});checks++;
  const before=structuredClone(s.data);
  assert.deepEqual(await settleQuota(s,{id:fixture.id,actualTokens:5}),{settled:true,replayed:true,overage:false});
  assert.deepEqual(s.data,before);checks++;
  // Persisted null is corruption, not an absent counter or reservation.
  const day=Math.floor(fixture.now/86400000),minute=Math.floor(fixture.now/60000);
  for(const key of ['minute:'+minute+':'+fixture.subjectHash,'subject:'+day+':'+fixture.subjectHash,'global:'+day,'tokens:'+day]){
    for(const value of [null,-1,'0',0.5]){
      const t=storage();t.data.set(key,value);const snapshot=structuredClone(t.data);
      assert.deepEqual(await reserveQuota(t,fixture),{allowed:false,code:'QUOTA_STORAGE_FAILED'});
      assert.deepEqual(t.data,snapshot);checks++;
    }
  }
  for(const value of [null,0,'false',{},[]]){
    const t=storage();t.data.set('blocked:'+day,value);const snapshot=structuredClone(t.data);
    assert.deepEqual(await reserveQuota(t,fixture),{allowed:false,code:'CORRUPT_QUOTA_STATE'});
    assert.deepEqual(t.data,snapshot);checks++;
  }
  for(const value of [null,false,0,[],{id:fixture.id}]){
    const t=storage();t.data.set('reservation:'+fixture.id,value);const snapshot=structuredClone(t.data);
    assert.deepEqual(await reserveQuota(t,fixture),{allowed:false,code:'CORRUPT_RESERVATION_STATE'});
    assert.deepEqual(await settleQuota(t,{id:fixture.id,actualTokens:0}),{settled:false,code:'CORRUPT_RESERVATION_STATE'});
    assert.deepEqual(t.data,snapshot);checks++;
  }
  for(const patch of [{subjectHash:null},{state:'SETTLED',actualTokens:null},{state:'SETTLED'},{actualTokens:0},{reservedUsdMicros:null},{priceModel:'model'},{reservedUsdMicros:5,priceModel:' '} ]){
    const t=storage();assert.equal((await reserveQuota(t,fixture)).allowed,true);
    const key='reservation:'+fixture.id;t.data.set(key,{...t.data.get(key),...patch});
    const snapshot=structuredClone(t.data);
    assert.deepEqual(await reserveQuota(t,fixture),{allowed:false,code:'CORRUPT_RESERVATION_STATE'});
    assert.deepEqual(await settleQuota(t,{id:fixture.id,actualTokens:0}),{settled:false,code:'CORRUPT_RESERVATION_STATE'});
    assert.deepEqual(t.data,snapshot);checks++;
  }
  const t=storage();t.data.set('blocked:'+day,false);
  assert.equal((await reserveQuota(t,fixture)).allowed,true);checks++;
  t.data.set('tokens:'+day,null);const corruptSnapshot=structuredClone(t.data);
  assert.deepEqual(await settleQuota(t,{id:fixture.id,actualTokens:0}),{settled:false,code:'QUOTA_STORAGE_FAILED'});
  assert.deepEqual(t.data,corruptSnapshot);checks++;
  console.log('V7_AI_QUOTA_STATE_BOUNDARY=PASS checks='+checks+' synthetic_storage=true');
})().catch(error=>{console.error(error);process.exit(1);});
