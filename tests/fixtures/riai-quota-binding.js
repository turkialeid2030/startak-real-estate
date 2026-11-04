// In-process transaction double, exclusively for synthetic tests.
// The optional fixedNow is injected by a test only. Production quota logic is untouched.
module.exports = function quotaBinding({fixedNow} = {}) {
  if (fixedNow !== undefined && (!Number.isSafeInteger(fixedNow) || fixedNow < 0))
    throw new Error('INVALID_TEST_QUOTA_CLOCK');
  const state={data:new Map(),tail:Promise.resolve()};
  const storage={transaction(fn){const work=state.tail.then(async()=>{const copy=structuredClone(state.data);const out=await fn({get:async k=>copy.get(k),put:async(k,v)=>copy.set(k,v)});state.data=copy;return out;});state.tail=work.catch(()=>{});return work;}};
  return {state,idFromName(name){if(name!=='riai-global-quota-v1')throw new Error('wrong global actor');return name;},get(){return {async fetch(url,options){
    // Default path retains the full quota worker entry point and its real clock.
    if(fixedNow === undefined){
      const {RiaiQuota}=await import('../../workers/riai-quota/index.mjs');
      return new RiaiQuota({storage}).fetch(new Request(url,options));
    }
    // The worker entry point reads Date.now() directly. For the isolated fixed-time
    // test, invoke its *actual* quota functions with injected time, without global
    // Date monkeypatching or any changes to production code.
    const {reserveQuota,settleQuota}=await import('../../workers/riai-quota/quota.mjs');
    const request=new Request(url,options);
    if(request.method!=='POST')return new Response(null,{status:405});
    try{
      const {readBoundedText}=await import('../../functions/api/riai/_bounded-body.mjs');
      const input=JSON.parse(await readBoundedText(request,{maxBytes:4096,timeoutMs:3000}));
      const route=new URL(request.url).pathname;
      const result=route==='/reserve'?await reserveQuota(storage,{...input,now:fixedNow})
        :route==='/settle'?await settleQuota(storage,input):null;
      return result?Response.json(result):new Response(null,{status:404});
    }catch(_){
      return Response.json({allowed:false,code:'INVALID_QUOTA_REQUEST'},{status:400});
    }
  }};}};
};
