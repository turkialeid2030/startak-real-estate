'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const url=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ar-SA'});
 const page=await context.newPage();let checks=0;
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  const price=page.getByLabel(/قيمة شراء المبنى/).first();
  await expect(price).toBeVisible({timeout:25000});
  await price.fill('-1');
  await expect(price).toHaveValue('-1');
  checks++;
  const validation=page.getByText(/الحد الأدنى المسموح/);
  await expect(validation).toBeVisible({timeout:10000});
  checks++;
  assert.ok(!(await page.getByText('10,069.92%').isVisible()),
   'negative price must not create auditor-observed fictitious yield');
  checks++;
  await price.fill('140000000');
  await expect(price).toHaveValue('140000000');
  await expect(validation).not.toBeVisible({timeout:10000});
  checks+=2;
  console.log('AUDIT_F01_REAL_CHROMIUM_NEGATIVE_PURCHASE_PRICE=PASS checks='+checks);
  console.log('F01_NEGATIVE_PRESERVED_WITH_VISIBLE_ERROR_AND_NO_FICTITIOUS_YIELD=TRUE');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('AUDIT_F01_REAL_CHROMIUM_NEGATIVE_PURCHASE_PRICE=FAIL',e);process.exitCode=1;});
