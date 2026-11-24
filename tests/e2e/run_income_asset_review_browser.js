'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,caseId,propertyRef,asOfDate,evaluate,S}=require('../fixtures/synthetic-income-asset');
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 const input=args(),expected=evaluate(input);let checks=0;
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const panel=page.getByTestId('local-income-review'),file=page.getByTestId('income-review-file');
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   await expect(file).toBeDisabled();checks++;
   await page.getByTestId('income-review-case').fill(caseId);
   await page.getByTestId('income-review-property').fill(propertyRef);
   await page.getByTestId('income-review-date').fill(asOfDate);
   await expect(file).toBeEnabled();checks++;
   const load=data=>file.setInputFiles({name:'synthetic-income.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await load({...input,report:{transactionAuthorized:true}});
   await expect(page.getByTestId('income-review-result')).toBeVisible();checks++;
   await expect(page.getByTestId('income-review-risks')).toContainText('TOP_TENANT_RENT_SHARE_ABOVE_POLICY_MAXIMUM');checks++;
   const pending=page.waitForEvent('download');
   await page.getByTestId('income-review-report').click();
   const report=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
   for(const key of ['metrics','tenants','expiryConcentration','riskFlags']){assert.deepEqual(report[key],expected[key]);checks++;}
   assert.equal(report.transactionAuthorized,false);checks++;
   await page.getByTestId('income-review-property').fill('OTHER');
   await expect(page.getByTestId('income-review-result')).toHaveCount(0);checks++;
   await load(input);
   await expect(page.getByTestId('income-review-status')).toHaveAttribute('data-status','HOLD_LOCAL_INCOME_REVIEW');checks++;
   await expect(page.getByTestId('income-review-report')).toHaveCount(0);checks++;
   await page.getByTestId('income-review-property').fill(propertyRef);
   await load({...input,leaseRecords:[{...input.leaseRecords[0],areaSqm:1},...input.leaseRecords.slice(1)]});
   await expect(page.getByTestId('income-review-status')).toHaveAttribute('data-status',S.HOLD_INTEGRITY);checks++;
   await expect(page.getByTestId('income-review-result')).toHaveCount(0);checks++;
   await page.getByTestId('income-review-reset').click();
   await load(input);await expect(page.getByTestId('income-review-result')).toBeVisible();checks++;
   await page.getByTestId('income-review-date').fill('2026-10-30');
   await expect(page.getByTestId('income-review-result')).toHaveCount(0);checks++;
   await load(input);await expect(page.getByTestId('income-review-status')).toHaveAttribute('data-status','HOLD_LOCAL_INCOME_REVIEW');checks++;
   if(locale==='ar-SA'){
    const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
    const ar=require('../../src/i18n/locales/ar-SA');
    const gold=require('../reference/RE-GOLD-baseline.json');
    const seed={id:caseId,name:'SYNTH-C11-ENCRYPTED',mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'};
    await page.evaluate(({namespace,seed})=>{
     localStorage.setItem(namespace+'deal:'+seed.id,JSON.stringify(seed));
     localStorage.setItem(namespace+'deals-index',JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));
    },{namespace:NAMESPACE,seed});
    async function bind(){
     await page.reload();
     await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
     await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
     await expect(page.getByTestId('income-review-local-custody')).toBeVisible();
     await expect(page.getByTestId('income-review-case')).toHaveValue(caseId);
     await page.getByTestId('income-review-property').fill(propertyRef);
     await page.getByTestId('income-review-date').fill(asOfDate);
    }
    await bind();checks++;
    await load(input);await expect(page.getByTestId('income-review-result')).toBeVisible();checks++;
    const canonical=()=>page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'deal:'+id),{namespace:NAMESPACE,id:caseId});
    const before=await canonical();
    await page.getByTestId('income-review-passphrase').fill('synthetic-browser-income-42');
    await expect(page.getByTestId('income-review-encrypted-save')).toBeDisabled();checks++;
    await page.getByTestId('income-review-consent').check();
    await page.getByTestId('income-review-encrypted-save').click();
    await expect(page.getByTestId('income-review-storage-notice')).toContainText('تم التحقق من الحفظ المحلي المشفر',{timeout:15000});checks++;
    const raw=await page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'c11-encrypted-draft:v1:'+id),{namespace:NAMESPACE,id:caseId});
    assert.ok(raw&&!raw.includes(propertyRef)&&!raw.includes('leaseRecords'));checks++;
    assert.equal(await canonical(),before);checks++;
    await bind();checks++;
    await page.getByTestId('income-review-passphrase').fill('incorrect-browser-passphrase');
    await expect(page.getByTestId('income-review-encrypted-load')).toBeEnabled();
    await page.getByTestId('income-review-encrypted-load').click();
    await expect(page.getByTestId('income-review-storage-notice')).toContainText('تعذر الحفظ أو فتح المسودة',{timeout:15000});checks++;
    await expect(page.getByTestId('income-review-result')).toHaveCount(0);checks++;
    await page.getByTestId('income-review-passphrase').fill('synthetic-browser-income-42');
    await page.getByTestId('income-review-encrypted-load').click();
    await expect(page.getByTestId('income-review-result')).toBeVisible({timeout:15000});checks++;
    const pendingRestore=page.waitForEvent('download');
    await page.getByTestId('income-review-report').click();
    const restored=JSON.parse(await fs.readFile(await (await pendingRestore).path(),'utf8'));
    assert.deepEqual(restored.metrics,expected.metrics);checks++;
    assert.equal(restored.transactionAuthorized,false);checks++;
    assert.equal(await canonical(),before);checks++;
   }
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C11_ACTUAL_BROWSER_REVIEW=PASS browser='+browserName+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
