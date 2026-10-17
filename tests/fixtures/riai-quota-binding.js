// In-process transaction double, exclusively for synthetic tests.
module.exports = function quotaBinding() {
  const state={data:new Map(),tail:Promise.resolve()};
  const storage={transaction(fn){const work=state.tail.then(async()=>{const copy=structuredClone(state.data);const out=await fn({get:async k=>copy.get(k),put:async(k,v)=>copy.set(k,v)});state.data=copy;return out;});state.tail=work.catch(()=>{});return work;}};
  return {state,idFromName(name){if(name!=='riai-global-quota-v1')throw new Error('wrong global actor');return name;},get(){return {async fetch(url,options){const {RiaiQuota}=await import('../../workers/riai-quota/index.mjs');return new RiaiQuota({storage}).fetch(new Request(url,options));}};}};
};
