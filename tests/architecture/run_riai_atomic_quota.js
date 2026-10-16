const assert = require('node:assert/strict');
// Transactional test double only. This is not a production distributed lock.
class TransactionStore {
  constructor() { this.data = new Map(); this.tail = Promise.resolve(); this.fail = false; }
  transaction(fn) {
    const run = this.tail.then(async () => {
      const copy = structuredClone(this.data);
      const result = await fn({ get: async k => copy.get(k), put: async (k,v) => { if(this.fail) throw new Error('storage failure'); copy.set(k,v); } });
      this.data = copy;
      return result;
    });
    this.tail = run.catch(() => {});
    return run;
  }
}
(async () => {
  const { reserveQuota, settleQuota } = await import('../../workers/riai-quota/quota.mjs');
  const base = { id:'reservation-00000001', subjectHash:'a'.repeat(64), now:172800000, tokens:60, limits:{minute:1,subjectDay:100,globalDay:100,tokensDay:100} };
  const input = i => ({...base,id:`reservation-${String(i).padStart(8,'0')}`});
  let store = new TransactionStore();
  let outcomes = await Promise.all(Array.from({length:20},(_,i)=>reserveQuota(store,input(i))));
  assert.equal(outcomes.filter(r=>r.allowed).length,1);
  assert.equal(store.data.get('tokens:2'),60);
  store = new TransactionStore();
  outcomes = await Promise.all([reserveQuota(store,input(1)),reserveQuota(store,{...input(2),subjectHash:'b'.repeat(64)})]);
  assert.equal(outcomes.filter(r=>r.allowed).length,1); // 120 cannot fit under 100.
  assert.equal(store.data.get('global:2'),1); // denied reservation changes no counter.
  assert.equal((await reserveQuota(store,input(1))).replayed,true);
  assert.equal((await reserveQuota(store,{...input(1),tokens:61})).code,'RESERVATION_CONFLICT');
  assert.equal((await settleQuota(store,{id:input(1).id,actualTokens:20})).settled,true);
  assert.equal(store.data.get('tokens:2'),20);
  assert.equal((await settleQuota(store,{id:input(1).id,actualTokens:20})).replayed,true);
  assert.equal((await settleQuota(store,{id:input(1).id,actualTokens:0})).code,'SETTLEMENT_CONFLICT');
  assert.equal((await reserveQuota(store,{...input(2),subjectHash:'b'.repeat(64)})).allowed,true);
  assert.equal((await settleQuota(store,{id:input(2).id,actualTokens:70})).overage,true);
  assert.equal((await reserveQuota(store,{...input(3),subjectHash:'c'.repeat(64)})).code,'QUOTA_RECONCILIATION_REQUIRED');
  assert.equal((await reserveQuota(store,{...input(3),now:259200000})).allowed,true);
  assert.equal((await settleQuota(store,{id:input(3).id,actualTokens:null})).code,'INVALID_USAGE');
  assert.equal(store.data.get('tokens:3'),60); // uncertain usage stays reserved.
  assert.equal((await reserveQuota({},base)).code,'ATOMIC_STORE_REQUIRED');
  assert.equal((await reserveQuota(store,{...base,tokens:NaN})).code,'INVALID_QUOTA_INPUT');
  store = new TransactionStore(); store.fail=true;
  assert.equal((await reserveQuota(store,base)).code,'QUOTA_STORAGE_FAILED'); assert.equal(store.data.size,0);
  store.fail=false; store.data.set('tokens:2','corrupt');
  assert.equal((await reserveQuota(store,base)).code,'QUOTA_STORAGE_FAILED');
  const worker=await import('../../workers/riai-quota/index.mjs');
  assert.equal(worker.default.fetch().status,403);
  const actor=new worker.RiaiQuota({storage:new TransactionStore()});
  assert.equal((await actor.fetch(new Request('https://quota/reserve'))).status,405);
  console.log('RIAI_ATOMIC_QUOTA=PASS (synthetic transactional store; production binding not qualified)');
})().catch(e=>{console.error(e);process.exitCode=1;});
