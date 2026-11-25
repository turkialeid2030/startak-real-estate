'use strict';
const assert=require('node:assert/strict');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixture={reportRef:'SYNTHETIC-ONLY',valuationDate:'2026-01-01',landAreaSqm:1000,comparables:[{id:'C1',date:'2025-12-01',areaSqm:900,rawRateSar:1000,firstAdjustment:-.1,secondAdjustment:-.2,weight:.5,transactionStatus:'EXECUTED',page:1},{id:'C2',date:'2025-12-01',areaSqm:1000,rawRateSar:1200,firstAdjustment:0,secondAdjustment:0,weight:.5,transactionStatus:'EXECUTED',page:1}],adoptedLandRateSar:960,roundingReason:'',components:[{id:'B1',kind:'FLOOR',quantity:500,unit:'SQM',unitCostSar:1000,page:2},{id:'B2',kind:'WALL',quantity:100,unit:'LINEAR_M',unitCostSar:100,page:2}],declaredBuildingCostSar:510000,effectiveAge:10,economicLife:50,declaredPhysicalRate:.2,declaredDepreciationSar:102000,declaredFinalValueSar:1368000,sourcePage:3,identityConflict:true,incomeEvidenceAvailable:false};
(async()=>{
 const engine=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true});
 let configs=0;
 try{for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const ctx=await browser.newContext({viewport:{width,height:900},locale,acceptDownloads:true});
  try{
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   const url=new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('LOCAL_PREVIEW_REQUIRED');
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url.origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
   await page.goto(url.href);
   const panel=page.getByTestId('professional-reporting-studio');
   await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');
   const download=async button=>{const pending=page.waitForEvent('download');await button.click();const file=await pending;return fs.readFile(await file.path(),'utf8');};
   for(const mode of ['OWNER','TECHNICAL']){
    await panel.getByTestId('studio-mode').selectOption(mode);
    const html=await download(panel.getByTestId('studio-export'));
    assert.ok(html.includes('STARTAK REAL ESTATE'));assert.ok(html.includes('default-src'));assert.ok(!html.includes('<script>'));assert.ok(html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));
   }
   const input=panel.getByTestId('studio-external-input'),audit=panel.getByTestId('studio-audit'),exp=panel.getByTestId('studio-audit-export');
   await expect(exp).toBeDisabled();
   await input.fill(JSON.stringify({...fixture,reportRef:'<script>alert(1)</script>'}));await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('1368000');
   await expect(exp).toBeEnabled();
   const html=await download(exp);
   assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('SHA-256'));
   await input.fill('{}');await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-audit-result')).toHaveCount(0);
   await audit.click();await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-notice')).toBeVisible();
   assert.deepEqual(errors,[]);
   const dir=path.join('runtime-evidence','reporting-studio-browser',engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,locale+'-'+width+'.png')});configs++;
  }finally{await ctx.close();}
 }}finally{await browser.close();}
 console.log('REPORTING_STUDIO_BROWSER=PASS configurations='+configs);
})().catch(e=>{console.error(e);process.exitCode=1;});
