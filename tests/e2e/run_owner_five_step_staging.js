'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
(async()=>{
 const root=path.resolve('runtime-evidence/owner-five-step');
 fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let assertions=0;
 try{
  for(const [width,height] of [[390,844],[768,1024],[1440,900]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,locale:'ar-SA'});
   const events=[];page.on('pageerror',err=>events.push(String(err)));
   await page.goto(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
   await expect(page.getByTestId('startak-owner-wizard')).toBeVisible();assertions++;
   await expect(page.getByTestId('owner-current-step')).toContainText('الغرض');assertions++;
   await expect(page.getByTestId('owner-missing-list')).toBeVisible();assertions++;
   const button=page.getByTestId('owner-advanced-mode');
   await expect(button).toBeVisible();assertions++;
   for(let step=0;step<5;step++){
    await page.getByTestId('owner-step-'+step).click();
    await expect(page.getByTestId('owner-current-step')).toContainText('('+(step+1)+'/5)');assertions++;
    await page.screenshot({path:path.join(root,'owner-step-'+(step+1)+'-'+width+'.png'),fullPage:false});
   }
   await page.getByTestId('owner-step-1').click();
   const title=page.getByTestId('owner-projectTitle');
   await title.fill('STAR-OWNER-CASE-'+width);
   await expect(title).toHaveValue('STAR-OWNER-CASE-'+width);assertions++;
   await button.click();
   await expect(page.getByTestId('owner-simple-mode')).toBeVisible();assertions++;
   await page.getByTestId('owner-simple-mode').click();
   await expect(page.getByTestId('owner-projectTitle')).toHaveValue('STAR-OWNER-CASE-'+width);assertions++;
   // Same canonical value remains after repeated view changes.
   await page.getByTestId('owner-step-3').click();
   const purchase=page.getByTestId('owner-buildingPrice');
   const purchaseOriginal=await purchase.inputValue();
   await purchase.fill('140000001');
   await page.getByTestId('owner-advanced-mode').click();
   await page.getByTestId('owner-simple-mode').click();
   await expect(page.getByTestId('owner-buildingPrice')).toHaveValue('140000001');assertions++;
   await purchase.fill(purchaseOriginal);
   await page.getByTestId('owner-step-4').click();
   await expect(page.getByTestId('owner-results')).toBeVisible();assertions++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   if(overflow>2)throw new Error('OWNER_WIZARD_HORIZONTAL_OVERFLOW_'+width+'_'+overflow);
   assertions++;
   if(events.length)throw new Error('OWNER_WIZARD_BROWSER_ERROR '+JSON.stringify(events));
   console.log('OWNER_WIZARD_VIEWPORT=PASS width='+width+' screenshots=5');
   await page.close();
  }
  console.log('OWNER_WIZARD_CHROMIUM=PASS assertions='+assertions);
 }finally{await browser.close();}
})().catch(e=>{console.error('OWNER_WIZARD_CHROMIUM=FAIL',e.stack||e);process.exitCode=1;});