'use strict';
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',acceptDownloads:true});
 const page=await context.newPage();
 let checked=0;
 const exportReport=async()=>{
  const requested=page.waitForEvent('download');
  await page.getByTestId('c75-export-personal-json').click();
  const file=await requested;
  return JSON.parse(await fs.readFile(await file.path(),'utf8'));
 };
 const parity=(a,b,label)=>{
  assert.equal(JSON.stringify(a.financial.inputs),JSON.stringify(b.financial.inputs),label+': canonical inputs must be identical');
  assert.equal(JSON.stringify(a.financial.results),JSON.stringify(b.financial.results),label+': canonical results must be identical');
  assert.equal(a.inputFingerprintSha256,b.inputFingerprintSha256,label+': input fingerprint must remain identical');
  checked+=3;
 };
 try{
  await page.goto(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  const scenarios=[['default',null,null],['purchase-price','buildingPrice','140000001'],['site-length','landLength','101'],['occupancy','occupancyRate','97'],['explicit-exit-cost','exitTransferFeeRate','3']];
  for(const [label,key,value] of scenarios){
   if(key!==null){
    await page.getByTestId('owner-step-'+(key==='landLength'?1:3)).click();
    await page.getByTestId('owner-'+key).fill(value);
    if(key==='exitTransferFeeRate')await page.getByTestId('owner-'+key).press('Tab');
   }
   await page.getByTestId('owner-advanced-mode').click();
   await expect(page.getByTestId('owner-simple-mode')).toBeVisible();
   const first=await exportReport();
   await page.getByTestId('owner-simple-mode').click();
   if(key!==null)await expect(page.getByTestId('owner-'+key)).toHaveValue(value);
   await page.getByTestId('owner-advanced-mode').click();
   const second=await exportReport();
   parity(first,second,label);
   console.log('OWNER_CANONICAL_MODE_PARITY=PASS scenario='+label);
   await page.getByTestId('owner-simple-mode').click();
  }
  console.log('OWNER_CANONICAL_MODE_PARITY=PASS assertions='+checked+' scenarios='+scenarios.length);
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error('OWNER_CANONICAL_MODE_PARITY=FAIL',error.stack||error);process.exitCode=1;});