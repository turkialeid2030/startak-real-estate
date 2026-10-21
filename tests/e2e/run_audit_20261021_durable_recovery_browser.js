'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {interruptedFixtures}=require('../fixtures/synthetic-interrupted-saved-deals');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {JOURNAL_KEY}=require('../../src/storage/saved-deals-recovery');
const {verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {localTlsPreview}=require('./local-tls-preview');
const ar=require('../../src/i18n/locales/ar-SA');
const DIR='runtime-evidence/remaining-audit';let checks=0,preview;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
const sorted=entries=>entries.slice().sort(([a],[b])=>a.localeCompare(b));
async function snapshot(page){return page.evaluate(ns=>Object.keys(localStorage).filter(k=>k.startsWith(ns)).map(k=>[k.slice(ns.length),localStorage.getItem(k)]),NAMESPACE);}
async function panel(page){await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();return page.getByRole('dialog');}
async function download(page,locator){const pending=page.waitForEvent('download');await locator.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
async function seedContext(browser,width,entries,{noLocks=false}={}){
 const context=await browser.newContext({viewport:{width,height:960},locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce',ignoreHTTPSErrors:preview.local});
 await context.addInitScript(({ns,entries,noLocks})=>{
  localStorage.setItem('startak.presentation.locale','ar-SA');
  if(!localStorage.getItem('startak.synthetic-recovery-seeded')){for(const[key,value]of entries)localStorage.setItem(ns+key,value);localStorage.setItem('startak.synthetic-recovery-seeded','true');}
  if(noLocks)Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
 },{ns:NAMESPACE,entries,noLocks});return context;
}
(async()=>{
 await fs.mkdir(DIR,{recursive:true});preview=await localTlsPreview((process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,''));
 const fixtures=await interruptedFixtures(),browsers=[];
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{
   for(const width of [1366,390]){
    const scenarios=fixtures.map(f=>({kind:f.kind,entries:f.prefixes.filter(s=>s.pending).at(-1).entries,expected:f.before,recovered:true}));
    const update=fixtures.find(f=>f.kind==='update');scenarios.push({kind:'committed',entries:update.after,expected:update.after,recovered:false});
    const foreign=new Map(scenarios.find(s=>s.kind==='update').entries);foreign.set(JOURNAL_KEY,foreign.get(JOURNAL_KEY)+'x');scenarios.push({kind:'blocked',entries:[...foreign],blocked:true});
    for(const scenario of scenarios){
     const context=await seedContext(browser,width,scenario.entries),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
     try{
      await page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});let dialog=await panel(page);await expect(dialog).toHaveAttribute('aria-busy','false');
      if(scenario.blocked){
       await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_RECOVERY_REQUIRED');await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();checks+=2;
       await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('MUST NOT SAVE / محجوب');await expect(dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true})).toBeDisabled();checks++;
       eq(sorted(await snapshot(page)),sorted(scenario.entries));
       const rescue=await download(page,page.getByTestId('saved-backup-export'));ok(rescue.deals.length===2,'read-only export remains available for indexed valid records');
       await page.reload();dialog=await panel(page);await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_RECOVERY_REQUIRED');await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();checks+=2;
       eq(sorted(await snapshot(page)),sorted(scenario.entries));await dialog.screenshot({path:`${DIR}/${name}-${width}-durable-block.png`});
      }else{
       await expect(page.getByTestId('saved-deals-error')).toHaveCount(0);checks++;
       if(scenario.recovered){await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','INTERRUPTED_OPERATION_RECOVERED');checks++;}
       else{await expect(page.getByTestId('saved-backup-message')).toHaveCount(0);checks++;}
       eq(sorted(await snapshot(page)),sorted(scenario.expected));
       await page.reload();dialog=await panel(page);eq(sorted(await snapshot(page)),sorted(scenario.expected));await expect(page.getByTestId('saved-deals-error')).toHaveCount(0);checks++;
       if(scenario.kind==='update'){
        await dialog.screenshot({path:`${DIR}/${name}-${width}-durable-recovered.png`});
        const original=JSON.parse(new Map(scenario.expected).get('deals-index'))[0];await dialog.getByRole('button',{name:original.name,exact:true}).click();
        const study=await download(page,page.getByTestId('c75-export-personal-json'));ok(verifyPersonalFinancialStudy(study),'recovered current financial report verifies');
        const originalInputs=JSON.parse(new Map(scenario.expected).get('deal:'+original.id)).inputs;
        eq(Object.fromEntries(Object.keys(originalInputs).map(key=>[key,study.financial.inputs[key]])),originalInputs);
        dialog=await panel(page);await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('AFTER VERIFIED RECOVERY / بعد الاسترداد');await dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();await expect(dialog.getByRole('button',{name:'AFTER VERIFIED RECOVERY / بعد الاسترداد',exact:true})).toBeVisible();checks++;
        eq(await page.evaluate(key=>localStorage.getItem(key),NAMESPACE+JOURNAL_KEY),null);
       }
      }
      ok(errors.length===0,'no recovery runtime errors: '+errors.join('|'));ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'recovery feedback fits the viewport');
     }catch(error){await fs.writeFile(`${DIR}/${name}-${width}-${scenario.kind}-durable-failure.json`,JSON.stringify({error:error.message,body:await page.locator('body').innerText()},null,2));await page.screenshot({path:`${DIR}/${name}-${width}-${scenario.kind}-durable-failure.png`});throw error;}
     finally{await context.close();}
    }
    browsers.push({engine:name,width,persistedPrefixReplay:true,actualProcessKilled:false,physicalDevice:false,checksCompleted:checks});
   }
   // Two newly opened documents must serialize recovery and preserve the same
   // original bytes; the second must not roll back a completed recovery again.
   const dirty=fixtures.find(f=>f.kind==='restore').prefixes.filter(s=>s.pending).at(-1).entries;
   const context=await seedContext(browser,1366,[]),page=await context.newPage();
   try{
    await page.goto(preview.url+'/');await panel(page);
    await page.evaluate(({ns,entries})=>{for(const k of Object.keys(localStorage))if(k.startsWith(ns))localStorage.removeItem(k);for(const[k,v]of entries)localStorage.setItem(ns+k,v);},{ns:NAMESPACE,entries:dirty});
    await page.goto('about:blank');const second=await context.newPage();await Promise.all([page.goto(preview.url+'/'),second.goto(preview.url+'/')]);
    await Promise.all([panel(page),panel(second)]);eq(sorted(await snapshot(page)),sorted(fixtures.find(f=>f.kind==='restore').before));eq(sorted(await snapshot(second)),sorted(fixtures.find(f=>f.kind==='restore').before));
    ok(await page.evaluate(()=>typeof navigator.locks?.request==='function'),'concurrent recovery actually has Web Locks');
   }finally{await context.close();}
   if(name==='chromium'){
    const context=await seedContext(browser,390,fixtures[0].before,{noLocks:true}),page=await context.newPage();
    try{
     await page.goto(preview.url+'/');const dialog=await panel(page);await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('BLOCKED WITHOUT COORDINATION');await dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();
     await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','STORAGE_COORDINATION_REQUIRED');checks++;eq(sorted(await snapshot(page)),sorted(fixtures[0].before));
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
 const report={sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers,actualProcessCrashTested:false,physicalDeviceTested:false,diskDurabilityQualified:false,institutionalRestoreQualified:false,sourceAuthenticationQualified:false};
 await fs.writeFile(DIR+'/durable-recovery-acceptance.json',JSON.stringify(report,null,2));console.log('DURABLE_RECOVERY_BROWSER=PASS checks='+checks);
})().catch(async e=>{console.error(e);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/durable-recovery-failure.json',JSON.stringify({checks,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await preview?.close();});
