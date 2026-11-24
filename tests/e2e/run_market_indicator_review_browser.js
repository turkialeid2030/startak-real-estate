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
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C10_ACTUAL_BROWSER_REVIEW=PASS browser='+name+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
