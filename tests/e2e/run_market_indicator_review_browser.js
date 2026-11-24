'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,scope,evaluate,S}=require('../fixtures/synthetic-market-indicators');
(async()=>{
 const name=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[name]).launch({headless:true});
 const input=args(),expected=evaluate(input);let checks=0;
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const panel=page.getByTestId('local-market-indicator-review'),file=page.getByTestId('market-indicator-file');
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   await expect(file).toBeDisabled();checks++;
   await page.getByTestId('market-indicator-context').fill(scope.marketContextId);
   await page.getByTestId('market-indicator-geography').fill(scope.geographyKey);
   await page.getByTestId('market-indicator-asset').fill(scope.assetType);
   await page.getByTestId('market-indicator-date').fill('2026-10-31');
   await expect(file).toBeEnabled();checks++;
   const load=data=>file.setInputFiles({name:'synthetic-market.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await load({...input,report:{transactionAuthorized:true}});
   await expect(page.getByTestId('market-indicator-result')).toBeVisible();checks++;
   await expect(panel.locator('tbody tr')).toHaveCount(3);checks++;
   const pending=page.waitForEvent('download');
   await page.getByTestId('market-indicator-report').click();
   const report=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
   assert.deepEqual(report.interpretations,expected.interpretations);checks++;
   assert.equal(report.marketEvidenceHash,expected.marketEvidenceHash);checks++;
   assert.equal(report.transactionAuthorized,false);checks++;
   assert.equal(report.liveMarketDataFetched,false);checks++;
   await page.getByTestId('market-indicator-geography').fill('OTHER');
   await expect(page.getByTestId('market-indicator-result')).toHaveCount(0);checks++;
   await load(input);await expect(page.getByTestId('market-indicator-status')).toHaveAttribute('data-status','HOLD_LOCAL_MARKET_REVIEW');checks++;
   await expect(page.getByTestId('market-indicator-report')).toHaveCount(0);checks++;
   await page.getByTestId('market-indicator-geography').fill(scope.geographyKey);
   const tampered=JSON.parse(JSON.stringify(input));tampered.marketEvidenceInput.evidenceRecords[0].normalizedValue.days=1;
   await load(tampered);await expect(page.getByTestId('market-indicator-status')).toHaveAttribute('data-status',S.HOLD_INTEGRITY);checks++;
   await expect(page.getByTestId('market-indicator-result')).toHaveCount(0);checks++;
   await page.getByTestId('market-indicator-reset').click();await load(input);
   await expect(page.getByTestId('market-indicator-result')).toBeVisible();checks++;
   await page.getByTestId('market-indicator-date').fill('2026-10-30');
   await expect(page.getByTestId('market-indicator-result')).toHaveCount(0);checks++;
   await load(input);await expect(page.getByTestId('market-indicator-status')).toHaveAttribute('data-status','HOLD_LOCAL_MARKET_REVIEW');checks++;
   if(locale==='ar-SA'){
    const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
    const ar=require('../../src/i18n/locales/ar-SA');
    const gold=require('../reference/RE-GOLD-baseline.json');
    const seed={id:'SYNTH-C10-DEAL',name:'SYNTH-C10-ENCRYPTED',mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'};
    await page.evaluate(({namespace,seed})=>{
     localStorage.setItem(namespace+'deal:'+seed.id,JSON.stringify(seed));
     localStorage.setItem(namespace+'deals-index',JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));
    },{namespace:NAMESPACE,seed});
    async function bind(){
     await page.reload();
     await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
     await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
     await expect(page.getByTestId('market-indicator-local-custody')).toBeVisible();
     await expect(page.getByTestId('market-indicator-linked-deal')).toHaveText(seed.name);
     await page.getByTestId('market-indicator-context').fill(scope.marketContextId);
     await page.getByTestId('market-indicator-geography').fill(scope.geographyKey);
     await page.getByTestId('market-indicator-asset').fill(scope.assetType);
     await page.getByTestId('market-indicator-date').fill('2026-10-31');
    }
    await bind();checks++;
    await load(input);await expect(page.getByTestId('market-indicator-result')).toBeVisible();checks++;
    const canonical=()=>page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'deal:'+id),{namespace:NAMESPACE,id:seed.id});
    const before=await canonical();
    await page.getByTestId('market-indicator-passphrase').fill('synthetic-browser-market-42');
    await expect(page.getByTestId('market-indicator-encrypted-save')).toBeDisabled();checks++;
    await page.getByTestId('market-indicator-consent').check();
    await page.getByTestId('market-indicator-encrypted-save').click();
    await expect(page.getByTestId('market-indicator-storage-notice')).toContainText('تم التحقق من الحفظ المحلي المشفر',{timeout:15000});checks++;
    const raw=await page.evaluate(({namespace,id})=>localStorage.getItem(namespace+'c10-encrypted-draft:v1:'+id),{namespace:NAMESPACE,id:seed.id});
    assert.ok(raw&&!raw.includes(scope.geographyKey)&&!raw.includes('marketEvidenceInput'));checks++;
    assert.equal(await canonical(),before);checks++;
    await bind();checks++;
    await page.getByTestId('market-indicator-passphrase').fill('incorrect-browser-passphrase');
    await expect(page.getByTestId('market-indicator-encrypted-load')).toBeEnabled();
    await page.getByTestId('market-indicator-encrypted-load').click();
    await expect(page.getByTestId('market-indicator-storage-notice')).toContainText('تعذر الحفظ أو فتح المسودة',{timeout:15000});checks++;
    await expect(page.getByTestId('market-indicator-result')).toHaveCount(0);checks++;
    await page.getByTestId('market-indicator-passphrase').fill('synthetic-browser-market-42');
    await page.getByTestId('market-indicator-encrypted-load').click();
    await expect(page.getByTestId('market-indicator-result')).toBeVisible({timeout:15000});checks++;
    const pendingRestore=page.waitForEvent('download');
    await page.getByTestId('market-indicator-report').click();
    const restored=JSON.parse(await fs.readFile(await (await pendingRestore).path(),'utf8'));
    assert.deepEqual(restored.interpretations,expected.interpretations);checks++;
    assert.equal(restored.transactionAuthorized,false);checks++;
    assert.equal(await canonical(),before);checks++;
   }
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C10_ACTUAL_BROWSER_REVIEW=PASS browser='+name+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
