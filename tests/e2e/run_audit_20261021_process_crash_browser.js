'use strict';

// This test owns every process/profile it touches. SIGKILL targets only the
// process group created below, never a user's browser or a shared profile.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const {chromium,expect}=require('@playwright/test');
const {baseline,interruptedFixtures}=require('../fixtures/synthetic-interrupted-saved-deals');
const {syntheticBackupDeals}=require('../fixtures/synthetic-backup-deals');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {JOURNAL_KEY}=require('../../src/storage/saved-deals-recovery');
const {localTlsPreview}=require('./local-tls-preview');
const ar=require('../../src/i18n/locales/ar-SA');
const DIR='runtime-evidence/remaining-audit',active=new Set();
let checks=0,killCount=0,preview,root;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const sorted=entries=>entries.slice().sort(([a],[b])=>a.localeCompare(b));
const hash=entries=>createHash('sha256').update(JSON.stringify(sorted(entries))).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(timer);}}
async function snapshot(page){return sorted(await page.evaluate(ns=>Object.keys(localStorage).filter(k=>k.startsWith(ns)).map(k=>[k.slice(ns.length),localStorage.getItem(k)]),NAMESPACE));}
async function panel(page){await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();const d=page.getByRole('dialog');await expect(d).toHaveAttribute('aria-busy','false');return d;}

async function launch(profile){
 await fs.rm(path.join(profile,'DevToolsActivePort'),{force:true});
 const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-default-apps','--password-store=basic','--use-mock-keychain','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'];
 if(preview.local)args.push('--ignore-certificate-errors');
 const child=spawn(chromium.executablePath(),args,{detached:true,stdio:['ignore','ignore','pipe']});
 let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-4000);});
 const exit=once(child,'exit').then(([code,signal])=>({code,signal}));
 // Attach an error handler immediately; a missing browser must fail, not skip.
 const spawned=once(child,'spawn');exit.catch(()=>{});await spawned;
 const owned={child,exit,browser:null};active.add(owned);
 try{
  let port;
  for(let n=0;n<300;n++){
   if(child.exitCode!==null||child.signalCode!==null)throw Error('Owned Chromium exited during launch: '+stderr);
   try{const text=await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8');port=Number(text.split('\n')[0]);if(Number.isInteger(port)&&port>0)break;}catch(e){if(e.code!=='ENOENT')throw e;}
   await delay(50);
  }
  if(!port)throw Error('Owned Chromium CDP endpoint unavailable: '+stderr);
  owned.browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:15000});
  const context=owned.browser.contexts()[0];assert.ok(context,'Persistent default context required');
  context.setDefaultTimeout(15000);const page=context.pages()[0]||await context.newPage();await page.setViewportSize({width:1366,height:960});
  return {...owned,context,page};
 }catch(e){await kill(owned);throw e;}
}
async function close(owned){
 const cdp=await owned.browser.newBrowserCDPSession();
 await cdp.send('Browser.close').catch(()=>{});
 const receipt=await bounded(owned.exit,10000,'Owned browser did not close');
 await owned.browser.close().catch(()=>{});
 active.forEach(x=>{if(x.child===owned.child)active.delete(x);});return receipt;
}
async function kill(owned){
 if(owned.child.exitCode===null&&owned.child.signalCode===null)process.kill(-owned.child.pid,'SIGKILL');
 const receipt=await bounded(owned.exit,10000,'SIGKILL exit receipt missing');
 active.forEach(x=>{if(x.child===owned.child)active.delete(x);});return receipt;
}

// Only pause AFTER the real native storage call. No exception, seeded dirty
// state, rollback replacement, graceful browser close or forced storage flush.
function installBarrier({ns,cut,captureStartup=false}){
 const nativeSet=Storage.prototype.setItem,nativeDelete=Storage.prototype.removeItem;
 const entries=()=>Object.keys(localStorage).filter(k=>k.startsWith(ns)).map(k=>[k.slice(ns.length),localStorage.getItem(k)]);
 window.__startakCrashProbe={cut,writes:[],startup:captureStartup?entries():null,atBarrier:null};
 function after(storage,op,key,value){
  if(storage!==localStorage||!String(key).startsWith(ns))return;
  const probe=window.__startakCrashProbe;probe.writes.push({op,key:String(key).slice(ns.length),...(op==='set'?{value:String(value)}:{})});
  if(probe.writes.length===cut){probe.atBarrier=entries();debugger;}
 }
 Storage.prototype.setItem=function(key,value){const result=nativeSet.call(this,key,value);after(this,'set',key,value);return result;};
 Storage.prototype.removeItem=function(key){const result=nativeDelete.call(this,key);after(this,'delete',key);return result;};
}
async function armed(owned,cut,{startup=false}={}){
 const cdp=await owned.context.newCDPSession(owned.page);await cdp.send('Debugger.enable');
 const paused=bounded(new Promise(resolve=>cdp.once('Debugger.paused',resolve)),20000,'Native storage barrier was not reached');paused.catch(()=>{});
 if(startup)await owned.page.addInitScript(installBarrier,{ns:NAMESPACE,cut,captureStartup:true});
 else await owned.page.evaluate(installBarrier,{ns:NAMESPACE,cut});
 return {cdp,paused};
}
async function readBarrier(probe,cut){
 const pause=await probe.paused;
 const value=await probe.cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:pause.callFrames[0].callFrameId,expression:'JSON.stringify(window.__startakCrashProbe)',returnByValue:true});
 ok(!value.exceptionDetails,'Barrier snapshot can be read while paused');
 const state=JSON.parse(value.result.value);eq(state.writes.length,cut);ok(Array.isArray(state.atBarrier),'Actual native write completed before pausing');return state;
}
async function openApp(owned){
 const errors=[];owned.page.on('pageerror',e=>errors.push(e.message));
 await owned.page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});
 const source=await owned.page.locator('meta[name="startak-source-commit"]').getAttribute('content');
 eq(source,process.env.STARTAK_SOURCE_COMMIT,'Process-crash browser is testing the exact CI/public source');
 const dialog=await panel(owned.page);ok(await owned.page.evaluate(()=>isSecureContext&&typeof navigator.locks?.request==='function'),'Real secure-context Web Locks required');
 return {dialog,errors};
}
async function invoke(owned,kind,dialog){
 const record=syntheticBackupDeals()[0];
 if(kind==='save')return dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();
 if(kind==='update')return dialog.getByRole('button',{name:ar.savedDeals.updateButton,exact:true}).click();
 if(kind==='delete')return dialog.getByRole('button',{name:record.name,exact:true}).locator('..').getByRole('button',{name:ar.globalApp.deleteDeal,exact:true}).click();
 if(kind==='restore')return owned.page.getByTestId('saved-backup-file').setInputFiles({name:'synthetic-crash-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'STARTAK_SAVED_DEALS_BACKUP',backupVersion:1,deals:[{...record,id:'synthetic-import-one'},{...record,id:'synthetic-import-two'}]}))});
 throw Error('Unknown crash scenario');
}
async function verifyReopen(profile,previous,completed,label){
 const owned=await launch(profile);
 try{
  await owned.page.addInitScript(ns=>{window.__startakRawStartup=Object.keys(localStorage).filter(k=>k.startsWith(ns)).map(k=>[k.slice(ns.length),localStorage.getItem(k)]);},NAMESPACE);
  const {dialog,errors}=await openApp(owned),startup=sorted(await owned.page.evaluate(()=>window.__startakRawStartup));
  const pending=new Map(startup).has(JOURNAL_KEY),state=await snapshot(owned.page);
  let outcome;
  if(pending){eq(state,previous,'Retained real journal must restore exact prior bytes');outcome='JOURNAL_RECOVERED';await expect(owned.page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','INTERRUPTED_OPERATION_RECOVERED');checks++;}
  else if(hash(startup)===hash(previous)){eq(state,previous);outcome='PREVIOUS_STATE_PERSISTED';}
  else{ok(completed!==null,'Unjournaled partial state is never accepted');eq(startup,completed,'Only the observed committed snapshot may survive without a journal');eq(state,completed);outcome='COMMITTED_STATE_PERSISTED';}
  eq(new Map(state).get(JOURNAL_KEY),undefined);await expect(owned.page.getByTestId('saved-deals-error')).toHaveCount(0);await expect(owned.page.getByTestId('saved-backup-import-button')).toBeEnabled();checks+=2;
  await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('SAVE IS AVAILABLE AFTER ACTUAL CRASH');await expect(dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true})).toBeEnabled();checks++;
  await owned.page.reload();await panel(owned.page);eq(await snapshot(owned.page),state,'Second reopening is idempotent');eq(errors,[]);
  if(label==='restore-4-settled'||label==='recovery-4')await owned.page.getByRole('dialog').screenshot({path:DIR+'/chromium-'+label+'-process-crash.png'});
  return {outcome,startupFingerprintSha256:hash(startup),resultFingerprintSha256:hash(state),journalObservedAfterCrash:pending};
 }finally{await close(owned);}
}

(async()=>{
 assert.equal(process.platform,'linux','Process-group crash acceptance requires Linux; no silent skip');
 assert.match(process.env.STARTAK_SOURCE_COMMIT||'',/^[a-f0-9]{40}$/,'Exact tested source is required');
 await fs.mkdir(DIR,{recursive:true});preview=await localTlsPreview((process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,''));
 root=await fs.mkdtemp(path.join(os.tmpdir(),'startak-owned-process-crash-'));
 const baselineProfile=path.join(root,'baseline'),previous=sorted([...baseline()]),cases=[];
 await fs.mkdir(baselineProfile);let owned=await launch(baselineProfile);
 try{
  await openApp(owned);
  await owned.page.evaluate(({ns,entries})=>{for(const k of Object.keys(localStorage))if(k.startsWith(ns))localStorage.removeItem(k);for(const[k,v]of entries)localStorage.setItem(ns+k,v);localStorage.setItem('startak.presentation.locale','ar-SA');},{ns:NAMESPACE,entries:previous});
  eq(await snapshot(owned.page),previous);
 }finally{await close(owned);}
 const fixtures=await interruptedFixtures();
 const plans=fixtures.flatMap(f=>f.events.flatMap((_event,i)=>['immediate','settled'].map(timing=>({kind:f.kind,cut:i+1,timing}))));
 // A multi-record import recovers through: prior index, two staged removals,
 // journal cleanup. Each native recovery boundary also receives an actual kill.
 plans.push(...[1,2,3,4].map(recoveryCut=>({kind:'restore',cut:4,timing:'settled',recoveryCut})));
 for(const plan of plans){
  const label=plan.recoveryCut?'recovery-'+plan.recoveryCut:`${plan.kind}-${plan.cut}-${plan.timing}`,profile=path.join(root,label);
  await fs.cp(baselineProfile,profile,{recursive:true});owned=await launch(profile);
  let barrier,completed=null,firstReceipt,secondReceipt;
  try{
   let {dialog}=await openApp(owned);eq(await snapshot(owned.page),previous,'Clean baseline actually survived a normal browser restart');
   if(plan.kind==='update'){await dialog.getByRole('button',{name:syntheticBackupDeals()[0].name,exact:true}).click();dialog=await panel(owned.page);}
   if(plan.kind==='save')await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('SYNTHETIC ACTUAL PROCESS CRASH / حفظ تجريبي');
   const probe=await armed(owned,plan.cut),operation=invoke(owned,plan.kind,dialog);operation.catch(()=>{});
   barrier=await readBarrier(probe,plan.cut);
   eq(barrier.writes[0].key,JOURNAL_KEY,'Actual production mutation prepares the journal first');
   const pausedEntries=sorted(barrier.atBarrier);if(!new Map(pausedEntries).has(JOURNAL_KEY))completed=pausedEntries;
   if(plan.timing==='settled')await delay(6500);
   firstReceipt=await kill(owned);killCount++;eq(firstReceipt,{code:null,signal:'SIGKILL'});await operation.catch(()=>{});
   if(plan.recoveryCut){
    owned=await launch(profile);const recoveryProbe=await armed(owned,plan.recoveryCut,{startup:true});
    const navigation=owned.page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});navigation.catch(()=>{});
    const recovery=await readBarrier(recoveryProbe,plan.recoveryCut);
    ok(new Map(recovery.startup).has(JOURNAL_KEY),'Recovery kill requires a real persisted pending journal');
    await delay(6500);secondReceipt=await kill(owned);killCount++;eq(secondReceipt,{code:null,signal:'SIGKILL'});await navigation.catch(()=>{});
   }
  }finally{for(const live of [...active])if(live.child===owned.child)await kill(live);}
  const reopened=await verifyReopen(profile,previous,completed,label);
  cases.push({...plan,actualProcessKilled:true,pausedIntervalMs:plan.timing==='settled'?6500:0,firstReceipt,...(secondReceipt?{secondReceipt}:{}),pausedFingerprintSha256:hash(barrier.atBarrier),...reopened});
  console.log('ACTUAL_PROCESS_CRASH_CASE=PASS '+label+' outcome='+reopened.outcome);
  await fs.rm(profile,{recursive:true,force:true});
 }
 eq(cases.length,38);eq(killCount,42);ok(cases.some(c=>c.outcome==='JOURNAL_RECOVERED'),'Actual retained journal recovery was observed');ok(cases.some(c=>c.outcome==='COMMITTED_STATE_PERSISTED'),'Actual committed state persistence was observed');
 const report={sourceCommit:process.env.STARTAK_SOURCE_COMMIT,checks,engine:'chromium',browserVersion:await chromium.launch({headless:true,args:['--no-sandbox']}).then(async b=>{const v=b.version();await b.close();return v;}),platform:process.platform,architecture:process.arch,cases,killCount,signal:'SIGKILL',actualProcessCrashTested:true,isolatedProfiles:true,instrumentedNativeCallBarriers:true,forcedDiskFlush:false,physicalDeviceTested:false,osCrashTested:false,powerLossTested:false,evictionTested:false,diskDurabilityQualified:false,institutionalRestoreQualified:false,sourceAuthenticationQualified:false};
 await fs.writeFile(DIR+'/actual-process-crash-acceptance.json',JSON.stringify(report,null,2));console.log('ACTUAL_PROCESS_CRASH_BROWSER=PASS checks='+checks+' cases='+cases.length+' kills='+killCount);
})().catch(async e=>{console.error(e);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/actual-process-crash-failure.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,killCount,error:e.stack},null,2));process.exitCode=1;}).finally(async()=>{for(const owned of [...active])await kill(owned).catch(()=>{});await preview?.close();if(root)await fs.rm(root,{recursive:true,force:true});});
