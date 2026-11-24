'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,caseId,marketScopeRef,asOf,evaluate,S}=require('../fixtures/synthetic-policy-shock');
(async()=>{
 const name=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[name]).launch({headless:true});
 const input=args(),expected=evaluate(input);let checks=0;
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const panel=page.getByTestId('local-policy-shock-review'),file=page.getByTestId('policy-shock-file');
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   await expect(file).toBeDisabled();checks++;
   for(const [field,value] of [['case',caseId],['scope',marketScopeRef],['asset','OFFICE'],['city','SYNTH-CITY'],['date',asOf]])await page.getByTestId('policy-shock-'+field).fill(value);
   await page.getByTestId('policy-shock-transaction').selectOption('SALE');
   await expect(file).toBeEnabled();checks++;
   const load=data=>file.setInputFiles({name:'synthetic-policy-shock.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await load({...input,report:{transactionAuthorized:true}});
   await expect(page.getByTestId('policy-shock-result')).toBeVisible();checks++;
   await expect(panel.locator('tbody tr')).toHaveCount(4);checks++;
   const pending=page.waitForEvent('download');
   await page.getByTestId('policy-shock-report').click();
   const report=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
   assert.deepEqual(report.scenarioImpacts,expected.scenarioImpacts);checks++;
   assert.equal(report.transactionAuthorized,false);checks++;
   assert.equal(report.automaticValuationAdjustment,false);checks++;
   await page.getByTestId('policy-shock-city').fill('OTHER');
   await expect(page.getByTestId('policy-shock-result')).toHaveCount(0);checks++;
   await load(input);
   await expect(page.getByTestId('policy-shock-status')).toHaveAttribute('data-status','HOLD_LOCAL_POLICY_SHOCK_REVIEW');checks++;
   await expect(page.getByTestId('policy-shock-report')).toHaveCount(0);checks++;
   await page.getByTestId('policy-shock-city').fill('SYNTH-CITY');
   const tampered=JSON.parse(JSON.stringify(input));tampered.impacts[0].adjustmentMagnitude=.99;
   await load(tampered);
   await expect(page.getByTestId('policy-shock-status')).not.toHaveAttribute('data-status',S.READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW);checks++;
   await expect(page.getByTestId('policy-shock-result')).toHaveCount(0);checks++;
   await page.getByTestId('policy-shock-reset').click();
   await load(input);await expect(page.getByTestId('policy-shock-result')).toBeVisible();checks++;
   await page.getByTestId('policy-shock-date').fill('2026-10-30');
   await expect(page.getByTestId('policy-shock-result')).toHaveCount(0);checks++;
   await load(input);
   await expect(page.getByTestId('policy-shock-status')).toHaveAttribute('data-status','HOLD_LOCAL_POLICY_SHOCK_REVIEW');checks++;
   assert.equal(errors.length,0,errors.join(';'));checks++;
   await page.close();
  }
  console.log('C19_ACTUAL_BROWSER_REVIEW=PASS browser='+name+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
