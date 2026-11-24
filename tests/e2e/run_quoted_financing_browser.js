'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,caseId,propertyRef,asOfDate,evaluate,S}=require('../fixtures/synthetic-quoted-financing');
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium';
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 const input=args(),expected=evaluate(input);
 let checks=0;
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const panel=page.getByTestId('local-financing-review'),file=page.getByTestId('financing-file');
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   await expect(file).toBeDisabled();checks++;
   await page.getByTestId('financing-case').fill(caseId);
   await page.getByTestId('financing-property').fill(propertyRef);
   await page.getByTestId('financing-date').fill(asOfDate);
   await expect(file).toBeEnabled();checks++;
   async function load(data){await file.setInputFiles({name:'synthetic-quotes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});}
   await load({...input,report:{transactionAuthorized:true}});
   await expect(page.getByTestId('financing-result')).toBeVisible();checks++;
   await expect(page.getByTestId('financing-risk-flags')).toContainText('REVIEW_THRESHOLD');checks++;
   const pending=page.waitForEvent('download');
   await page.getByTestId('financing-report').click();
   const report=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
   assert.deepEqual(report.offers,expected.offers);checks++;
   assert.deepEqual(report.analyticalOrdering,expected.analyticalOrdering);checks++;
   assert.deepEqual(report.riskFlags,expected.riskFlags);checks++;
   assert.equal(report.transactionAuthorized,false);checks++;
   assert.equal(report.nominalCostIsAnnualPercentageRate,false);checks++;
   await page.getByTestId('financing-property').fill('OTHER');
   await expect(page.getByTestId('financing-result')).toHaveCount(0);checks++;
   await load(input);
   await expect(page.getByTestId('financing-status')).toHaveAttribute('data-status','HOLD_LOCAL_FINANCING_REVIEW');checks++;
   await expect(page.getByTestId('financing-report')).toHaveCount(0);checks++;
   await page.getByTestId('financing-property').fill(propertyRef);
   await load({...input,financingOffers:[input.financingOffers[0],{...input.financingOffers[1],upfrontFeesSar:1}]});
   await expect(page.getByTestId('financing-status')).toHaveAttribute('data-status',S.HOLD_INTEGRITY);checks++;
   await expect(page.getByTestId('financing-result')).toHaveCount(0);checks++;
   await page.getByTestId('financing-reset').click();
   await load(input);
   await expect(page.getByTestId('financing-result')).toBeVisible();checks++;
   await page.getByTestId('financing-date').fill('2026-10-29');
   await expect(page.getByTestId('financing-result')).toHaveCount(0);checks++;
   await load(input);
   await expect(page.getByTestId('financing-status')).toHaveAttribute('data-status','HOLD_LOCAL_FINANCING_REVIEW');checks++;
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C14_ACTUAL_BROWSER_REVIEW=PASS browser='+browserName+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
