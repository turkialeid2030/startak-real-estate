'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let assertions=0;
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},locale:'ar-SA',acceptDownloads:true});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
   await page.getByTestId('owner-advanced-mode').click();
   const exportReport=async()=>{
    const promise=page.waitForEvent('download');
    await page.getByTestId('c75-export-personal-json').click();
    return JSON.parse(await fs.readFile(await (await promise).path(),'utf8'));
   };
   const baseline=await exportReport();
   const panel=page.getByTestId('optional-indicators-775');
   await expect(panel).toBeVisible();assertions++;
   await panel.locator('summary').click();
   await expect(page.getByTestId('optional-uncertified-notice')).toBeVisible();assertions++;
   await expect(page.getByTestId('optional-source-ref')).toHaveAttribute('placeholder','رقم المستند أو مرجعه');assertions++;
   await page.getByTestId('optional-calculate').click();
   await expect(page.getByTestId('optional-result')).toHaveAttribute('data-status','HOLD_INVALID_OR_INCOMPLETE');assertions++;
   await expect(page.getByTestId('optional-result')).toContainText('SOURCE_REFERENCE_REQUIRED');assertions++;
   await page.getByTestId('optional-grossAnnualRentSar').fill('120000');
   await page.getByTestId('optional-purchasePriceSar').fill('2000000');
   await page.getByTestId('optional-source-ref').fill('DOC-SYNTH-775');
   await page.getByTestId('optional-source-date').fill('2025-11-01');
   await page.getByTestId('optional-user-attested').check();
   await page.getByTestId('optional-calculate').click();
   await expect(page.getByTestId('optional-result')).toHaveAttribute('data-status','CALCULATED_UNVERIFIED');assertions++;
   await expect(page.getByTestId('optional-result')).toHaveAttribute('data-value','0.06');assertions++;
   await expect(page.getByTestId('optional-result')).toContainText('غير موثق استقلاليًا');assertions++;
   await page.getByTestId('optional-purchasePriceSar').fill('0');
   await expect(page.getByTestId('optional-result')).toHaveCount(0);assertions++;
   await page.getByTestId('optional-calculate').click();
   await expect(page.getByTestId('optional-result')).toContainText('PURCHASE_PRICE_POSITIVE_REQUIRED');assertions++;
   await page.getByTestId('optional-purchasePriceSar').fill('2000000');
   await page.getByTestId('optional-source-date').fill('2099-01-01');
   await page.getByTestId('optional-calculate').click();
   await expect(page.getByTestId('optional-result')).toContainText('SOURCE_DATE_IN_FUTURE');assertions++;
   // Switching indicator invalidates all prior metadata and results.
   await page.getByTestId('optional-metric').selectOption('MIRR');
   await expect(page.getByTestId('optional-source-ref')).toHaveValue('');assertions++;
   await expect(page.getByTestId('optional-user-attested')).not.toBeChecked();assertions++;
   await expect(page.getByTestId('optional-result')).toHaveCount(0);assertions++;
   // Test a terminal sale in the final year: recovery must be at year 2,
   // not fictional interpolation during the last year.
   await page.getByTestId('optional-metric').selectOption('DISCOUNTED_PAYBACK');
   await page.getByTestId('optional-source-ref').fill('DOC-TEST-PAYBACK');
   await page.getByTestId('optional-source-date').fill('2025-10-15');
   await page.getByTestId('optional-user-attested').check();
   await page.getByTestId('optional-annualCashflowsSar').fill('-100; 60; 60');
   await page.getByTestId('optional-discountRate').fill('0');
   await page.getByTestId('optional-terminal-sale').selectOption('yes');
   await page.getByTestId('optional-terminalSaleYear').fill('2');
   await page.getByTestId('optional-calculate').click();
   await expect(page.getByTestId('optional-result')).toHaveAttribute('data-value','2');assertions++;
   await expect(page.getByTestId('optional-result')).toHaveAttribute('data-status','CALCULATED_UNVERIFIED');assertions++;
   const after=await exportReport();
   assert.equal(after.inputFingerprintSha256,baseline.inputFingerprintSha256,
    'optional indicator edit must not alter the property study fingerprint');assertions++;
   assert.deepEqual(after.financial.inputs,baseline.financial.inputs,
    'optional indicator input must not overwrite canonical financial inputs');assertions++;
   assert.deepEqual(after.financial.results,baseline.financial.results,
    'optional indicator must not change canonical model results');assertions++;
   assert.equal(JSON.stringify(after).includes('DOC-TEST-PAYBACK'),false,
    'manual source reference must not leak into a canonical study export');assertions++;
   const overflow=await panel.evaluate(node=>node.scrollWidth-node.clientWidth);
   assert.ok(overflow<=2,'optional panel horizontal overflow at width '+width+': '+overflow);assertions++;
   assert.deepEqual(errors,[],'no browser exceptions at viewport '+width);assertions++;
   console.log('OPTIONAL_PROPERTY_INDICATORS_775_BROWSER=PASS width='+width);
   await context.close();
  }
  console.log('OPTIONAL_PROPERTY_INDICATORS_775_BROWSER=PASS assertions='+assertions+' canonical_unchanged=true professional_approval=false');
 }finally{await browser.close();}
})().catch(e=>{console.error('OPTIONAL_PROPERTY_INDICATORS_775_BROWSER=FAIL',e.stack||e);process.exitCode=1;});
