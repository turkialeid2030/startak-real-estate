'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
const src=fs.readFileSync('src/components/ValuationIntelligencePanel.jsx','utf8');
assert(src.includes("import DataFreshnessPanel from './DataFreshnessPanel.jsx';"));
assert(src.includes('<DataFreshnessPanel locale={locale} valuationCase={valuationCase} />'));
assert(!src.includes('<GovernedReportExportPanel')); // export must remain unauthorised
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},locale:'ar-SA'});
   const page=await ctx.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err)));
   await page.goto(process.env.STARTAK_FRESHNESS_HARNESS_URL||
     'http://127.0.0.1:4175/tests/e2e/fixtures/startak-re-freshness.html',
     {waitUntil:'networkidle'});
   const panel=page.getByTestId('valuation-data-freshness');
   await expect(panel).toBeVisible({timeout:25000});checks++;
   await expect(panel).toHaveAttribute('data-freshness-status','CURRENT');checks++;
   await expect(panel).toContainText('حداثة مصادر الأدلة');checks++;
   await expect(panel).toContainText('حديث');checks++;
   await page.getByTestId('test-stale').click();
   await expect(panel).toHaveAttribute('data-freshness-status','STALE');checks++;
   await expect(panel).toContainText('قديم');checks++;
   await expect(panel).toContainText('تحديث المصدر');checks++;
   await page.getByTestId('test-future').click();
   await expect(panel).toHaveAttribute('data-freshness-status','UNKNOWN');checks++;
   await expect(panel).toContainText('مستقبلي');checks++;
   await page.getByTestId('test-missing').click();
   await expect(panel).toHaveAttribute('data-freshness-status','UNKNOWN');checks++;
   await page.getByTestId('test-english').click();
   await expect(panel).toContainText('Evidence Source Freshness');checks++;
   await expect(panel).toContainText('invalid or future date');checks++;
   await page.getByTestId('test-stale').click();
   await expect(panel).toContainText('needs renewal');checks++;
   assert.equal(await panel.locator('button').count(),0,'read-only panel must not introduce approvals or exports');checks++;
   assert.deepEqual(errors,[],'no uncaught browser errors');checks++;
   await ctx.close();
  }
  console.log('STARTAK_RE_FRESHNESS_VISIBLE_BROWSER=PASS checks='+checks);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
