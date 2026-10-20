'use strict';
const queues=new WeakMap();
const LOCK_NAME='STARTAK_REAL_ESTATE:SAVED_DEALS:OPERATIONS';
// All cooperating saved-deal writers use the same origin-scoped Web Lock.
// A runtime queue still prevents overlap when that browser API is unavailable.
function withSavedDealsLock(provider,operation){
 const previous=queues.get(provider)||Promise.resolve();
 const current=previous.catch(()=>{}).then(()=>{
  const locks=typeof window!=='undefined'?window.navigator?.locks:null;
  return locks?.request?locks.request(LOCK_NAME,{mode:'exclusive'},operation):operation();
 });
 const settled=current.catch(()=>{});queues.set(provider,settled);
 void settled.then(()=>{if(queues.get(provider)===settled)queues.delete(provider);});
 return current;
}
module.exports={withSavedDealsLock,LOCK_NAME};
