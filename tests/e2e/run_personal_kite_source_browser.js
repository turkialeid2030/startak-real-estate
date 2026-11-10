'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},locale:'ar-SA'});
   const page=await ctx.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(String(e)));
   const owner='synthetic-owner-secret-'+'Z'.repeat(40);
   let rejectMode=false;
   await page.route('**/api/personal-data/kite-transactions?*',async(route)=>{
    requests.push({url:route.request().url(),authorization:route.request().headers().authorization});
    if(rejectMode)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'PERSONAL_SOURCE_CONNECTOR_NOT_CONFIGURED'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     ok:true,provider:'KITE',dataset:'MOJ_QUARTERLY_OPEN_NOTARY_SALES',
     version:'STARTAK_KITE_MOJ_MONTHLY_RESEARCH_V1',
     retrievedAt:'2026-11-10T12:00:00.000Z',
     records:[{id:'opaque-monthly-001',month:'2026-04',sourceQuarter:'2026-Q2',
      city:'riyadh',cityNameAr:'الرياض',districtNameAr:'الملقا',landUse:'residential',
      priceSar:1500000,areaSqm:500,pricePerSqmSar:3000,propertyCount:1,
      dayKnown:false,professionalAppraisal:false}],
     attribution:{source:'MOJ open data',license:'ODC Attribution'},
     nextCursor:null,caveats:['MONTH_ONLY_NOT_EXACT_TRANSACTION_DAY'],
     independentEvidenceVerified:false,professionalValuationAuthorized:false,
    })});
   });
   await page.goto(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle'});
   await page.getByTestId('owner-advanced-mode').click();
   const panel=page.getByTestId('kite-personal-transactions');
   await expect(panel).toBeVisible({timeout:30000});checks++;
   await expect(page.getByTestId('kite-coverage-warning')).toContainText('18 مايو 2026');checks++;
   await expect(page.getByTestId('kite-search')).toBeDisabled();checks++;
   await page.getByTestId('kite-owner-token').fill(owner);
   await expect(page.getByTestId('kite-search')).toBeEnabled();checks++;
   await page.getByTestId('kite-search').click();
   await expect(page.getByTestId('kite-status')).toHaveAttribute('data-status','LIVE_OPEN_DATA_RESEARCH_NOT_VERIFIED');checks++;
   await expect(page.getByTestId('kite-results')).toContainText('الملقا');checks++;
   await expect(page.getByTestId('kite-attribution')).toBeVisible();checks++;
   // Open-government-data licence must be visible, not just screen-reader JSON.
   await expect(page.getByTestId('kite-attribution-visible')).toBeVisible();checks++;
   await expect(page.getByTestId('kite-attribution-visible')).toContainText('MOJ open data');checks++;
   await expect(page.getByTestId('kite-attribution-visible')).toContainText('ODC Attribution');checks++;
   await expect(page.getByTestId('national-summary')).toContainText('الصفوف المستوردة: 1');checks++;
   await expect(page.getByTestId('national-source-filter')).toHaveValue('KITE_MOJ_QUARTERLY');checks++;
   assert.equal(requests.length,1,'one authenticated source call');checks++;
   assert.equal(requests[0].authorization,'Bearer '+owner,'owner token only to same-origin gateway');checks++;
   assert.equal(new URL(requests[0].url).searchParams.get('city'),'riyadh');checks++;
   assert.ok(!JSON.stringify(await page.evaluate(()=>Object.values(localStorage))).includes(owner),'token not persisted in localStorage');checks++;
   await page.getByTestId('kite-land-use').selectOption('commercial');
   await expect(page.getByTestId('kite-results')).toHaveCount(0);checks++;
   rejectMode=true;
   await page.getByTestId('kite-search').click();
   await expect(page.getByTestId('kite-error')).toBeVisible();checks++;
   await expect(page.getByTestId('kite-status')).toHaveAttribute('data-status','NOT_CONNECTED');checks++;
   assert.deepEqual(errors,[],'no browser errors');checks++;
   const overflow=await panel.evaluate(el=>el.scrollWidth-el.clientWidth);
   assert.ok(overflow<=2,'no horizontal overflow on '+width+': '+overflow);checks++;
   await ctx.close();
   console.log('STARTAK_KITE_PERSONAL_BROWSER=PASS width='+width);
  }
  console.log('STARTAK_KITE_PERSONAL_BROWSER=PASS checks='+checks+' mock_only=true provider_live_not_proven=true');
 }finally{await browser.close()}
})().catch(e=>{console.error('STARTAK_KITE_PERSONAL_BROWSER=FAIL',e.stack||e);process.exitCode=1});
