'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,scope}=require('../fixtures/synthetic-component-depreciation');
const {assessCostDepreciationAttribution}=require('../../src/cost/component-depreciation-review');
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium';
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 let checks=0;
 const expected=assessCostDepreciationAttribution(args);
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const panel=page.getByTestId('local-depreciation-review');
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   const file=page.getByTestId('depreciation-file');
   await expect(file).toBeDisabled();checks++;
   await page.getByTestId('depreciation-case').fill(scope.caseId);
   await page.getByTestId('depreciation-property').fill(scope.propertyRef);
   async function load(data){await file.setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});}
   await load({...args,report:{costApproachValueIndicationSar:1,transactionAuthorized:true}});
   await expect(page.getByTestId('depreciation-result')).toBeVisible();checks++;
   const download=async id=>{const pending=page.waitForEvent('download');await page.getByTestId(id).click();const f=await pending;return JSON.parse(await fs.readFile(await f.path(),'utf8'));};
   const report=await download('depreciation-report');
   assert.equal(report.costApproachValueIndicationSar,expected.costApproachValueIndicationSar);checks++;
   assert.equal(report.resultHashSha256,expected.resultHashSha256);checks++;
   assert.equal(report.canonicalCostResultHashSha256,expected.canonicalCostResultHashSha256);checks++;
   assert.equal(report.transactionAuthorized,false);checks++;
   const saved=await download('depreciation-save');assert.equal(saved.report,undefined);checks++;
   await page.getByTestId('depreciation-reset').click();
   await expect(page.getByTestId('depreciation-result')).toHaveCount(0);checks++;
   await load(saved);
   await expect(page.getByTestId('depreciation-result')).toBeVisible();checks++;
   await page.getByTestId('depreciation-property').fill('OTHER');
   await expect(page.getByTestId('depreciation-result')).toHaveCount(0);checks++;
   await load(saved);
   await expect(page.getByTestId('depreciation-status')).toHaveAttribute('data-status','HOLD_DEPRECIATION_CAUSES_OR_EVIDENCE');checks++;
   await expect(page.getByTestId('depreciation-report')).toHaveCount(0);checks++;
   await page.getByTestId('depreciation-property').fill(scope.propertyRef);
   await load({...saved,packet:{...saved.packet,landValueInput:{...saved.packet.landValueInput,valueSar:1}}});
   await expect(page.getByTestId('depreciation-status')).toHaveAttribute('data-status','HOLD_DEPRECIATION_CAUSES_OR_EVIDENCE');checks++;
   await expect(page.getByTestId('depreciation-result')).toHaveCount(0);checks++;
   if(locale==='ar-SA'){
    const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
    const ar=require('../../src/i18n/locales/ar-SA');
    const gold=require('../reference/RE-GOLD-baseline.json');
    const seed={id:scope.caseId,name:'SYNTH-C59-ENCRYPTED',mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'};
    await page.evaluate(({namespace,seed})=>{
     localStorage.setItem(namespace+'deal:'+seed.id,JSON.stringify(seed));
     localStorage.setItem(namespace+'deals-index',JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));
    },{namespace:NAMESPACE,seed});
    await page.reload();
    await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
    await expect(page.getByTestId('depreciation-local-custody')).toBeVisible();checks++;
    await expect(page.getByTestId('depreciation-case')).toHaveValue(scope.caseId);checks++;
    await page.getByTestId('depreciation-property').fill(scope.propertyRef);
    await load(args);await expect(page.getByTestId('depreciation-result')).toBeVisible();checks++;
    const before=await page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'deal:'+id),{namespace:NAMESPACE,id:seed.id});
    await page.getByTestId('depreciation-passphrase').fill('synthetic-browser-passphrase-42');
    await expect(page.getByTestId('depreciation-encrypted-save')).toBeDisabled();checks++;
    await page.getByTestId('depreciation-consent').check();
    await page.getByTestId('depreciation-encrypted-save').click();
    await expect(page.getByTestId('depreciation-storage-notice')).toContainText('تم التحقق من الحفظ المحلي المشفر',{timeout:15000});checks++;
    const stored=await page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'c59-encrypted-draft:v1:'+id),{namespace:NAMESPACE,id:seed.id});
    assert.ok(stored&&!stored.includes(scope.propertyRef)&&!stored.includes('allocations'));checks++;
    assert.equal(await page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'deal:'+id),{namespace:NAMESPACE,id:seed.id}),before);checks++;
    await page.reload();
    await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
    await page.getByTestId('depreciation-property').fill(scope.propertyRef);
    await page.getByTestId('depreciation-passphrase').fill('incorrect-browser-passphrase');
    await page.getByTestId('depreciation-encrypted-load').click();
    await expect(page.getByTestId('depreciation-storage-notice')).toContainText('تعذر الحفظ أو فتح المسودة',{timeout:15000});checks++;
    await expect(page.getByTestId('depreciation-result')).toHaveCount(0);checks++;
    await page.getByTestId('depreciation-passphrase').fill('synthetic-browser-passphrase-42');
    await page.getByTestId('depreciation-encrypted-load').click();
    await expect(page.getByTestId('depreciation-result')).toBeVisible({timeout:15000});checks++;
    const restoredReport=await download('depreciation-report');assert.equal(restoredReport.costApproachValueIndicationSar,expected.costApproachValueIndicationSar);checks++;
   }
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C59_ACTUAL_BROWSER_ROUNDTRIP=PASS browser='+browserName+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
