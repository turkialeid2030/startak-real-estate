'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {operatingCase}=require('../fixtures/synthetic-collections-case');
const {addDocumentedFutureLease}=require('../../src/residential-income-acquisition/operating-case-editor');
const {verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {localTlsPreview}=require('./local-tls-preview');
const gold=require('../reference/RE-GOLD-baseline.json'),ar=require('../../src/i18n/locales/ar-SA');
const DIR='runtime-evidence/remaining-audit';let checks=0,preview;
const ok=(value,message)=>{assert.ok(value,message);checks++;},eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function download(page,locator){const event=page.waitForEvent('download');await locator.click();const file=await event;return fs.readFile(await file.path(),'utf8');}
async function study(page){const report=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));ok(verifyPersonalFinancialStudy(report),'downloaded financial report verifies');return report;}
async function act(page,action,leaseId,date,index){
 await page.getByTestId('lifecycle-action').selectOption(action);
 if(action!=='REVIEW_DATE')await page.getByTestId('lifecycle-lease').selectOption(leaseId);
 if(['EARLY_END','REVIEW_DATE'].includes(action))await page.getByTestId('lifecycle-date').fill(date);
 await page.getByTestId('lifecycle-source').fill('synthetic-lifecycle-document-'+index);
 await page.getByTestId('lifecycle-review').fill('synthetic-local-review-'+index);
 await page.getByTestId('lifecycle-reason').fill('مراجعة مستند تجريبي / synthetic source review '+index);
 await page.getByTestId('lifecycle-confirm').check();await page.getByTestId('lifecycle-save').click();
 await expect(page.getByTestId('lifecycle-feedback')).toHaveAttribute('data-code','LEASE_LIFECYCLE_SAVED');checks++;
}
(async()=>{
 await fs.mkdir(DIR,{recursive:true});preview=await localTlsPreview((process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,''));const browsers=[];
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{for(const width of [1366,390]){
   const initial=addDocumentedFutureLease(operatingCase(),{previousLeaseId:'LEASE-1',leaseId:'LEASE-NEXT',tenantId:'TENANT-1',startDate:'2027-02-01',endDate:'2028-02-01',baseRent:'1440000',sourceRef:'synthetic-successor',adoptionDecisionRef:'synthetic-successor-review',confirmed:true},{recordedAt:'2026-10-20T00:00:00Z'});
   const seed={id:'synthetic-lease-lifecycle',name:'LEASE LIFECYCLE / العقود التجريبية',mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-20T00:00:00Z',operatingCase:initial};
   const context=await browser.newContext({viewport:{width,height:960},locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce',ignoreHTTPSErrors:preview.local}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(r.method()==='POST'&&!r.url().startsWith(preview.url))external.push(r.url());});
   await context.addInitScript(({ns,seed})=>{
    localStorage.setItem('startak.presentation.locale','ar-SA');
    if(!localStorage.getItem(ns+'lifecycle-fixture-seeded')){localStorage.setItem(ns+'deal:'+seed.id,JSON.stringify(seed));localStorage.setItem(ns+'deals-index',JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));localStorage.setItem(ns+'lifecycle-fixture-seeded','true');}
   },{ns:NAMESPACE,seed});
   const prefix=DIR+'/'+name+'-'+width;
   try{
    await page.goto(preview.url+'/',{waitUntil:'domcontentloaded'});await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
    const before=await study(page);eq(before.operatingReport.contractRunoff.totals.contractRent,1240000);
    const terms=page.getByTestId('riai-rent-roll-collections-workspace').locator('form').first();
    await terms.locator('select').selectOption('LEASE-1');await terms.getByLabel(ar.riai.periodicBaseRent,{exact:true}).fill('١٢٠٠٠٠٠');await terms.getByLabel(ar.riai.leaseEnd,{exact:true}).fill('2027-01-01');
    await terms.getByLabel(ar.riai.sourceRef,{exact:true}).fill('synthetic-terms-correction');await terms.getByLabel(ar.riai.adoptionRef,{exact:true}).fill('synthetic-terms-review');await terms.locator('input[type="checkbox"]').check();await terms.getByRole('button',{name:ar.riai.applyLeaseUpdate,exact:true}).click();
    await expect(page.getByTestId('riai-rent-roll-collections-workspace').getByRole('status')).toContainText(ar.riai.leaseUpdateSuccess);checks++;
    const corrected=await study(page);eq(corrected.operatingReport.sourceSnapshot.leases[0].changeLog[0].kind,'TERMS_REPLACED');
    const toggle=page.getByTestId('lifecycle-open');await toggle.focus();await page.keyboard.press('Enter');await expect(toggle.locator('..')).toHaveAttribute('open','');checks++;
    await act(page,'EARLY_END','LEASE-1','2026-11-16',1);const ended=await study(page);eq(ended.operatingReport.contractRunoff.totals.contractRent,1090000);eq(ended.operatingReport.sourceSnapshot.rentCollections,initial.rentCollections);
    await page.getByTestId('lease-lifecycle-editor').screenshot({path:prefix+'-lease-early-end.png'});
    await act(page,'CANCEL_FUTURE','LEASE-NEXT',null,2);const cancelled=await study(page);eq(cancelled.operatingReport.contractRunoff.totals.contractRent,250000);eq(cancelled.operatingReport.sourceSnapshot.leases[1].lifecycleStatus,'TERMINATED');eq(cancelled.operatingReport.sourceSnapshot.leases.length,2);
    await act(page,'RESTORE_PREVIOUS','LEASE-NEXT',null,3);const futureRestored=await study(page);eq(futureRestored.operatingReport.contractRunoff.totals.contractRent,1090000);
    await act(page,'RESTORE_PREVIOUS','LEASE-1',null,4);const termsRestored=await study(page);eq(termsRestored.operatingReport.contractRunoff.totals.contractRent,1240000);
    await act(page,'REVIEW_DATE',null,'2027-02-01',5);const reviewed=await study(page),snapshot=reviewed.operatingReport.sourceSnapshot;
    eq(snapshot.asOfDate,'2027-02-01');eq(snapshot.leases.map(l=>l.lifecycleStatus),['EXPIRED','ACTIVE']);eq(reviewed.operatingReport.contractRunoff.totals.contractRent,1440000);
    eq(reviewed.financial.inputs,before.financial.inputs);eq(reviewed.financial.results.NOI,before.financial.results.NOI);eq(reviewed.financial.results.irr,before.financial.results.irr);ok(reviewed.operatingReport.sourceFingerprintSha256!==before.operatingReport.sourceFingerprintSha256,'operating identity reflects local change history');eq(snapshot.rentCollections,initial.rentCollections);eq(snapshot.units,initial.units);
    const history=JSON.parse(await download(page,page.getByTestId('lifecycle-export')));eq(history.events.length,7);ok(history.events.every(e=>!e.sourceAuthenticated&&!e.legalEffectEstablished&&!e.externalActionPerformed),'local history never claims external qualification');eq(history.asOfDate,'2027-02-01');
    const shot=await page.getByTestId('lease-lifecycle-editor').screenshot({path:prefix+'-lease-reviewed.png'});
    if(process.env.STARTAK_LEASE_VISUAL_PREVIEW==='1'&&name==='webkit'&&width===390&&shot.length<=200000)console.log('LEASE_VISUAL_PREVIEW_PNG='+shot.toString('base64'));
    const html=await download(page,page.getByTestId('c75-export-personal-html'));ok(html.includes('data-section="lease-change-history"')&&html.includes('synthetic-lifecycle-document-5'),'financial HTML carries local history and references');
    await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:ar.savedDeals.updateButton,exact:true}).click();await expect(dialog).toHaveAttribute('aria-busy','false');await expect(page.getByTestId('saved-deals-error')).toHaveCount(0);checks++;
    const backup=JSON.parse(await download(page,page.getByTestId('saved-backup-export')));eq(backup.deals[0].operatingCase,snapshot);
    await page.reload();await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();const reopened=await study(page);eq(reopened.operatingReport.sourceSnapshot,snapshot);eq(reopened.operatingReport.sourceFingerprintSha256,reviewed.operatingReport.sourceFingerprintSha256);
    const raw=await page.evaluate(key=>localStorage.getItem(key),NAMESPACE+'deal:'+seed.id);
    await page.getByTestId('locale-switch').click();await expect(page.locator('html')).toHaveAttribute('lang','en');checks++;
    await page.getByTestId('lifecycle-open').click();await expect(page.getByTestId('lease-lifecycle-editor')).toContainText('Lease lifecycle and change history');checks++;
    const english=await download(page,page.getByTestId('c75-export-personal-html'));ok(english.includes('Local lease change history')&&english.includes('Recorded early end'),'English report includes translated change kinds');eq(await page.evaluate(key=>localStorage.getItem(key),NAMESPACE+'deal:'+seed.id),raw);
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'lease lifecycle controls fit the viewport');ok(errors.length===0,'no runtime errors: '+errors.join(' | '));ok(external.length===0,'local lifecycle never sends an external POST');
    browsers.push({engine:name,width,physicalDevice:false,checksCompleted:checks,caseHistoryPreserved:true});
   }catch(error){await fs.writeFile(prefix+'-lease-failure.json',JSON.stringify({error:error.message,body:await page.locator('body').innerText()},null,2));await page.screenshot({path:prefix+'-lease-failure.png'});throw error;}
   finally{await context.close();}
  }}finally{await browser.close();}
 }
 await fs.writeFile(DIR+'/lease-lifecycle-acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers,institutionalLifecycleQualified:false,legalExecution:false,sourceAuthenticationQualified:false},null,2));console.log('LEASE_LIFECYCLE_BROWSER=PASS checks='+checks);
})().catch(async error=>{console.error(error);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/lease-lifecycle-failure.json',JSON.stringify({checksCompleted:checks,error:error.message},null,2));process.exitCode=1;}).finally(async()=>{await preview?.close();});
