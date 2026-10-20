'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {syntheticBackupDeals}=require('../fixtures/synthetic-backup-deals');
const {verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {localTlsPreview}=require('./local-tls-preview');
const ar=require('../../src/i18n/locales/ar-SA');
const DIR='runtime-evidence/remaining-audit';let checks=0,preview;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
async function download(page,locator){const pending=page.waitForEvent('download');await locator.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
const simple=id=>({id,name:id,mode:'building',inputs:syntheticBackupDeals()[0].inputs,savedAt:'2026-10-20T00:00:00Z'});
const legacy=deals=>({format:'STARTAK_SAVED_DEALS_BACKUP',backupVersion:1,deals});
async function savedSnapshot(page){return page.evaluate(ns=>Object.keys(localStorage).filter(k=>k.startsWith(ns)).sort().map(k=>[k,localStorage.getItem(k)]),NAMESPACE);}
async function panel(page){await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();return page.getByRole('dialog');}
async function importFile(page,value,name='synthetic-backup.json'){
 await page.getByTestId('saved-backup-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value))});
}
async function contextFor(browser,width,seed=[],host=false){
 const context=await browser.newContext({viewport:{width,height:960},locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce',ignoreHTTPSErrors:preview.local});
 await context.addInitScript(({ns,seed,host})=>{
  localStorage.setItem('startak.locale','ar-SA');
  if(seed.length&&!localStorage.getItem(ns+'backup-fixture-seeded')){
   for(const record of seed)localStorage.setItem(ns+'deal:'+record.id,JSON.stringify(record));
   localStorage.setItem(ns+'deals-index',JSON.stringify(seed.map(({id,name,mode,savedAt})=>({id,name,mode,savedAt}))));localStorage.setItem(ns+'backup-fixture-seeded','true');
  }
  const originalSet=Storage.prototype.setItem,originalDelete=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(key,value){
   const failure=window.__crudFailure;if(failure?.op==='set'&&key===ns+failure.key){window.__crudFailure=null;if(failure.after)originalSet.call(this,key,value);throw new DOMException('Synthetic CRUD write failure','QuotaExceededError');}
   if(window.__backupFailure&&key===ns+'deal:io-two'){const mode=window.__backupFailure;window.__backupFailure=null;if(mode==='after')originalSet.call(this,key,value);throw new DOMException('Synthetic quota failure','QuotaExceededError');}return originalSet.call(this,key,value);
  };
  Storage.prototype.removeItem=function(key){
   const failure=window.__crudFailure;if(failure?.op==='delete'&&key===ns+failure.key){window.__crudFailure=null;if(failure.after)originalDelete.call(this,key);throw new DOMException('Synthetic CRUD delete failure','SecurityError');}
   if(window.__backupCleanupFailure&&key===ns+'deal:io-one'||window.__crudCleanupFailure&&key.startsWith(ns+'deal:deal_'))throw new DOMException('Synthetic cleanup failure','SecurityError');return originalDelete.call(this,key);
  };
  if(host){
   window.__backupHostWrites=0;window.__backupFileReads=0;const text=File.prototype.text;File.prototype.text=function(){window.__backupFileReads++;return text.call(this);};
   window.storage={get:async key=>{const value=localStorage.getItem(ns+key);return value===null?null:{value};},set:async(key,value)=>{window.__backupHostWrites++;if(window.__backupHold&&key.startsWith('deal:')){window.__backupHold=false;window.__backupWaiting=true;await new Promise(resolve=>{window.__releaseBackup=resolve;});}localStorage.setItem(ns+key,value);},delete:async key=>localStorage.removeItem(ns+key)};
  }
 },{ns:NAMESPACE,seed,host});
 const header=(await fs.readFile('public/_headers','utf8')).split('\n').find(l=>l.includes('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
 await context.route(preview.url+'/',async route=>{const response=await route.fetch({ignoreHTTPSErrors:preview.local}),headers=response.headers();if(!headers['content-security-policy'])headers['content-security-policy']=header;await route.fulfill({response,headers});});
 return context;
}
async function diagnose(page,label,error){
 await fs.writeFile(`${DIR}/${label}-backup-failure.json`,JSON.stringify({error:error.message,body:await page.locator('body').innerText()},null,2));
 await page.screenshot({path:`${DIR}/${label}-backup-failure.png`});throw error;
}
(async()=>{
 await fs.mkdir(DIR,{recursive:true});preview=await localTlsPreview((process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,''));
 let transfer,sourceStudy;const evidence=[];
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{
   if(name==='chromium'){
    const context=await contextFor(browser,1366,syntheticBackupDeals()),page=await context.newPage();
    try{
     await page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});const dialog=await panel(page);
     await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('TRANSFER UI CREATED / صفقة محفوظة');
     await dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();await expect(dialog.getByRole('button',{name:'TRANSFER UI CREATED / صفقة محفوظة',exact:true})).toBeVisible({timeout:15000});checks++;
     transfer=await download(page,page.getByTestId('saved-backup-export'));ok(transfer.deals.length===3,'real UI creates a deal before exporting the source backup');
     const original=syntheticBackupDeals()[0],stored=transfer.deals.find(d=>d.id===original.id);assert.deepEqual(stored,original);checks++;
     await dialog.getByRole('button',{name:original.name,exact:true}).click();sourceStudy=await download(page,page.getByTestId('c75-export-personal-json'));ok(verifyPersonalFinancialStudy(sourceStudy),'source financial report hash verifies');
     await fs.writeFile(DIR+'/synthetic-backup-source.json',JSON.stringify(transfer,null,2));
    }catch(error){await diagnose(page,'chromium-source',error);}finally{await context.close();}
   }
   for(const width of [1366,390]){
    const context=await contextFor(browser,width),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});let dialog=await panel(page);
     await importFile(page,transfer);await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_RESTORED',{timeout:20000});checks++;
     for(const record of transfer.deals)await expect(dialog.getByRole('button',{name:record.name,exact:true})).toBeVisible();checks+=transfer.deals.length;
     const exported=await download(page,page.getByTestId('saved-backup-export'));assert.deepEqual(exported.deals,transfer.deals);checks++;
     ok(exported.compliance.transactionAuthorized===false&&exported.compliance.certifiedValuation===false,'restore does not grant authority or certification');
     const originalState=await savedSnapshot(page);await importFile(page,transfer);await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_RESTORED');assert.deepEqual(await savedSnapshot(page),originalState);checks++;
     await page.reload();dialog=await panel(page);await dialog.getByRole('button',{name:transfer.deals[0].name,exact:true}).click();
     const study=await download(page,page.getByTestId('c75-export-personal-json'));ok(verifyPersonalFinancialStudy(study),'restored financial report hash verifies');
     assert.deepEqual(study.financial.inputs,sourceStudy.financial.inputs);checks++;
     for(const key of ['NOI','irr','npv']){const actual=study.financial.results[key],expected=sourceStudy.financial.results[key];ok(typeof expected==='number'&&Math.abs(actual-expected)<=Math.max(1e-12,Math.abs(expected)*1e-12),'cross-browser financial equivalence: '+key);}
     assert.deepEqual(study.operatingReport.sourceSnapshot,sourceStudy.operatingReport.sourceSnapshot);checks++;
     ok(study.operatingReport.sourceFingerprintSha256===sourceStudy.operatingReport.sourceFingerprintSha256&&study.operatingReport.propertyIdentityIndependentlyVerified===false,'source operating identity and unverified scope survive transfer');
     dialog=await panel(page);await importFile(page,legacy([simple('duplicate'),{...simple('duplicate'),name:'Other content'}]));
     await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_DUPLICATE_OR_INVALID_ID');assert.deepEqual(await savedSnapshot(page),originalState);checks+=2;
     await importFile(page,Buffer.from('{invalid'));await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_JSON_INVALID');assert.deepEqual(await savedSnapshot(page),originalState);checks+=2;
     if(width===1366){
      await importFile(page,Buffer.alloc(10*1024*1024+1,32),'oversized.json');await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_SIZE_LIMIT');assert.deepEqual(await savedSnapshot(page),originalState);checks+=2;
      // Both real tabs begin from the same old UI list. Cooperative Web Locks
      // and a fresh storage snapshot must retain both concurrent imports.
      ok(await page.evaluate(()=>isSecureContext&&typeof navigator.locks?.request==='function'),'cross-tab test actually has Web Locks');
      const second=await context.newPage();await second.goto(preview.url+'/',{waitUntil:'domcontentloaded'});await panel(second);
      await Promise.all([importFile(page,legacy([simple('parallel-one')])),importFile(second,legacy([simple('parallel-two')]))]);
      await page.waitForFunction(ns=>{const list=JSON.parse(localStorage.getItem(ns+'deals-index'));return list.some(d=>d.id==='parallel-one')&&list.some(d=>d.id==='parallel-two');},NAMESPACE,{timeout:20000});
      await expect(page.getByTestId('saved-backup-export')).toBeEnabled();const both=await download(page,page.getByTestId('saved-backup-export'));ok(both.deals.length===5&&both.deals.some(d=>d.id==='parallel-one')&&both.deals.some(d=>d.id==='parallel-two'),'fresh export retains changes from both tabs');await second.close();
     }
     // Invoke real UI save/update/delete against Storage failures. Each must
     // restore exactly the prior record/index bytes before reporting rollback.
     const beforeCrud=await savedSnapshot(page),recordKey='deal:'+transfer.deals[0].id;
     await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('FAILED UI SAVE / فشل تجريبي');
     await page.evaluate(()=>{window.__crudFailure={op:'set',key:'deals-index',after:true};});
     await dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();
     await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_STORAGE_FAILED_ROLLED_BACK');await expect(page.getByTestId('saved-backup-message')).toHaveCount(0);assert.deepEqual(await savedSnapshot(page),beforeCrud);checks+=3;
     await page.evaluate(key=>{window.__crudFailure={op:'set',key,after:true};},recordKey);
     await dialog.getByRole('button',{name:ar.savedDeals.updateButton,exact:true}).click();
     await expect(dialog).toHaveAttribute('aria-busy','false');await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_STORAGE_FAILED_ROLLED_BACK');assert.deepEqual(await savedSnapshot(page),beforeCrud);checks+=2;
     await page.evaluate(key=>{window.__crudFailure={op:'delete',key,after:true};},recordKey);
     await dialog.getByRole('button',{name:transfer.deals[0].name,exact:true}).locator('..').getByRole('button',{name:ar.globalApp.deleteDeal,exact:true}).click();
     await expect(dialog).toHaveAttribute('aria-busy','false');await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_STORAGE_FAILED_ROLLED_BACK');assert.deepEqual(await savedSnapshot(page),beforeCrud);checks+=2;
     await dialog.screenshot({path:`${DIR}/${name}-${width}-crud-rollback.png`});
     await dialog.getByRole('button',{name:ar.savedDeals.updateButton,exact:true}).click();await expect(dialog).toHaveAttribute('aria-busy','false');await expect(page.getByTestId('saved-deals-error')).toHaveCount(0);checks++;
     const afterUpdate=await download(page,page.getByTestId('saved-backup-export')),updated=afterUpdate.deals.find(d=>d.id===transfer.deals[0].id);
     assert.deepEqual(updated.assumptionRegistry,transfer.deals[0].assumptionRegistry);assert.deepEqual(updated.assumptionRegistryVersion,transfer.deals[0].assumptionRegistryVersion);assert.deepEqual(updated.operatingCase,transfer.deals[0].operatingCase);checks+=3;
     const beforeFailure=await savedSnapshot(page);await page.evaluate(()=>{window.__backupFailure='after';});
     await importFile(page,legacy([simple('io-one'),simple('io-two')]));await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','RESTORE_STORAGE_FAILED_ROLLED_BACK');await expect(page.getByTestId('saved-deals-error')).toHaveCount(0);assert.deepEqual(await savedSnapshot(page),beforeFailure);checks+=3;
     await dialog.screenshot({path:`${DIR}/${name}-${width}-backup-rollback.png`});
     if(width===390){
      await page.evaluate(()=>{window.__backupFailure='before';window.__backupCleanupFailure=true;});await importFile(page,legacy([simple('io-one'),simple('io-two')]));
      await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','RESTORE_RECOVERY_REQUIRED');await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();await expect(dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true})).toBeDisabled();await expect(page.getByTestId('saved-backup-export')).toBeEnabled();checks+=4;
      await dialog.screenshot({path:`${DIR}/${name}-${width}-backup-recovery.png`});
      const rescue=await download(page,page.getByTestId('saved-backup-export'));ok(rescue.deals.length===3,'recovery export contains the current indexed deals');await expect(page.getByTestId('saved-deals-recovery')).toBeVisible();await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();checks+=2;
     }
     ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'backup controls fit desktop/mobile viewport');ok(errors.length===0,'no browser runtime errors: '+errors.join(' | '));
     evidence.push({engine:name,width,crossBrowserTransfer:true,physicalDevice:false,checksCompleted:checks});
    }catch(error){await diagnose(page,`${name}-${width}`,error);}finally{await context.close();}
   }
   if(name==='chromium'){
    const context=await contextFor(browser,390,[],true),page=await context.newPage();
    try{
     await page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});const dialog=await panel(page);await page.evaluate(()=>{window.__backupHold=true;});
     // Two change events in the same tick exercise the real handler's guard.
     await page.getByTestId('saved-backup-file').evaluate((input,backup)=>{for(let i=0;i<2;i++){const d=new DataTransfer();d.items.add(new File([JSON.stringify(backup)],'synthetic-double.json',{type:'application/json'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));}},transfer);
     await page.waitForFunction(()=>window.__backupWaiting===true);await expect(dialog).toHaveAttribute('aria-busy','true');await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();await expect(page.getByTestId('saved-backup-export')).toBeDisabled();checks+=3;
     ok(await page.evaluate(()=>window.__backupFileReads===1),'same-tick duplicate import reads the file only once');await page.evaluate(()=>window.__releaseBackup());
     await expect(page.getByTestId('saved-backup-message')).toHaveAttribute('data-backup-code','BACKUP_RESTORED');ok(await page.evaluate(()=>window.__backupHostWrites)===transfer.deals.length+1,'exactly one restore reaches the asynchronous host provider');
     await dialog.getByPlaceholder(ar.savedDeals.namePlaceholder).fill('HOST RECOVERY / استرجاع تجريبي');
     await page.evaluate(()=>{window.__crudFailure={op:'set',key:'deals-index',after:true};window.__crudCleanupFailure=true;});
     await dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true}).click();
     await expect(page.getByTestId('saved-deals-error')).toHaveAttribute('data-storage-code','RESTORE_RECOVERY_REQUIRED');await expect(page.getByTestId('saved-backup-message')).toHaveCount(0);await expect(dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true})).toBeDisabled();await expect(page.getByTestId('saved-backup-import-button')).toBeDisabled();await expect(page.getByTestId('saved-backup-export')).toBeEnabled();checks+=5;
     await dialog.screenshot({path:DIR+'/chromium-host-crud-recovery.png'});
     const rescue=await download(page,page.getByTestId('saved-backup-export'));ok(rescue.deals.length===transfer.deals.length,'host recovery export does not turn staged unindexed data into saved deals');await expect(page.getByTestId('saved-deals-recovery')).toBeVisible();await expect(dialog.getByRole('button',{name:ar.savedDeals.saveButton,exact:true})).toBeDisabled();checks+=2;
     await dialog.screenshot({path:DIR+'/chromium-host-recovery-export.png'});
    }catch(error){await diagnose(page,'chromium-host',error);}finally{await context.close();}
   }
  }finally{await browser.close();}
 }
 await fs.writeFile(DIR+'/backup-acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers:evidence,institutionalRestoreQualified:false,sourceAuthenticationQualified:false},null,2));console.log(`BACKUP_BROWSER=PASS checks=${checks}`);
})().catch(async error=>{console.error(error);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/backup-failure.json',JSON.stringify({checksCompleted:checks,error:error.message},null,2));process.exitCode=1;}).finally(async()=>{await preview?.close();});
