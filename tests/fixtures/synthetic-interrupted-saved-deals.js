'use strict';
const {syntheticBackupDeals}=require('./synthetic-backup-deals');
const {CAPABILITY,JOURNAL_KEY}=require('../../src/storage/saved-deals-recovery');
const {saveNewSavedDeal,updateSavedDealRecord,removeSavedDealRecord,restoreBackupPayload}=require('../../src/storage/saved-deals-backup');

function mapProvider(initial,{capability=true,onWrite=()=>{}}={}){
 const data=new Map(initial),events=[];
 const provider={data,events,get:async key=>data.has(key)?data.get(key):null,
  set:async(key,value)=>{await onWrite({op:'set',key,value,data,events,before:true});data.set(key,value);events.push({op:'set',key,value});await onWrite({op:'set',key,value,data,events,before:false});},
  delete:async key=>{await onWrite({op:'delete',key,data,events,before:true});data.delete(key);events.push({op:'delete',key});await onWrite({op:'delete',key,data,events,before:false});},
 };
 if(capability)provider.savedDealsRecovery=CAPABILITY;return provider;
}
function coordinatedWindow(){return {navigator:{locks:{request:async(_name,_options,operation)=>operation()}}};}
function baseline(){
 const deals=syntheticBackupDeals();return new Map([
  ['deals-index',JSON.stringify(deals.map(({id,name,mode,savedAt})=>({id,name,mode,savedAt})),null,2)],
  ...deals.map(d=>['deal:'+d.id,JSON.stringify(d,null,2)]),
  ['deal:synthetic-unindexed','retain exact unindexed bytes'],
 ]);
}
function operation(kind,provider){
 const source=syntheticBackupDeals()[0],id=source.id;
 if(kind==='save')return saveNewSavedDeal({...source,id:'synthetic-new',name:'حفظ تجريبي / synthetic new'},provider);
 if(kind==='update')return updateSavedDealRecord(id,r=>({...r,name:'تعديل تجريبي / synthetic revised'}),provider);
 if(kind==='delete')return removeSavedDealRecord(id,provider);
 if(kind==='restore')return restoreBackupPayload({format:'STARTAK_SAVED_DEALS_BACKUP',backupVersion:1,deals:[{...source,id:'synthetic-import-one'},{...source,id:'synthetic-import-two'}]},provider);
 throw Error('Unknown synthetic operation');
}
function prefix(initial,events,count){const data=new Map(initial);for(const event of events.slice(0,count)){if(event.op==='set')data.set(event.key,event.value);else data.delete(event.key);}return data;}
async function interruptedFixtures(){
 const old=global.window;global.window=coordinatedWindow();
 try{
  const fixtures=[];
  for(const kind of ['save','update','delete','restore']){
   const before=baseline(),provider=mapProvider(before);await operation(kind,provider);
   fixtures.push({kind,before:[...before],after:[...provider.data],events:provider.events,
    prefixes:provider.events.map((_event,i)=>({cut:i+1,entries:[...prefix(before,provider.events,i+1)],pending:prefix(before,provider.events,i+1).has(JOURNAL_KEY)}))});
  }
  return fixtures;
 }finally{if(old===undefined)delete global.window;else global.window=old;}
}
module.exports={mapProvider,coordinatedWindow,baseline,operation,prefix,interruptedFixtures};
