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
   // Market-purpose controls must write the SAME subject used by the
   // previously existing detailed research panel, never a parallel estimate.
   await page.getByTestId('owner-valuation-purpose').selectOption('RENT_STUDY');
   await page.getByTestId('owner-valuation-date').fill('2026-10-15');
   await page.getByTestId('owner-step-1').click();
   await page.getByTestId('owner-market-name').fill('SYNTHETIC-SUBJECT-'+width);
   await page.getByTestId('owner-market-land-area').fill('1234');
   await page.getByTestId('owner-property-right').selectOption('FULL_OWNERSHIP');
   await page.getByTestId('owner-market-asset-type').selectOption('RESIDENTIAL_BUILDING');
   await page.getByTestId('owner-market-built-area').fill('1640');
   await page.getByTestId('owner-market-rentable-area').fill('1200');
   await page.getByTestId('owner-market-building-count').fill('2');
   await page.getByTestId('owner-market-unit-count').fill('18');
   await button.click();
   const canonicalMarket=page.getByTestId('location-market-study');
   await expect(canonicalMarket.getByLabel('غرض دراسة التقييم')).toHaveValue('RENT_STUDY');assertions++;
   await expect(canonicalMarket.getByLabel('تاريخ القيمة المطلوب دراستها')).toHaveValue('2026-10-15');assertions++;
   await expect(canonicalMarket.getByLabel('اسم العقار',{exact:true})).toHaveValue('SYNTHETIC-SUBJECT-'+width);assertions++;
   await expect(canonicalMarket.getByLabel('مساحة الأرض (م²)')).toHaveValue('1234');assertions++;
   await expect(canonicalMarket.getByLabel('نوع الحق العقاري (يحتاج تحقق)')).toHaveValue('FULL_OWNERSHIP');assertions++;
   await expect(page.getByTestId('market-subject-asset-type')).toHaveValue('RESIDENTIAL_BUILDING');assertions++;
   await expect(canonicalMarket.getByLabel('إجمالي المساحات المبنية لكل المباني (م²)')).toHaveValue('1640');assertions++;
   await expect(canonicalMarket.getByLabel('إجمالي المساحة القابلة للتأجير (م²)')).toHaveValue('1200');assertions++;
   await expect(canonicalMarket.getByLabel('عدد العمائر/المباني')).toHaveValue('2');assertions++;
   await expect(canonicalMarket.getByLabel('عدد الوحدات (شقق/مكاتب/معارض)')).toHaveValue('18');assertions++;
   await canonicalMarket.getByLabel('المدينة',{exact:true}).fill('جدة');
   await canonicalMarket.getByLabel('غرض دراسة التقييم').selectOption('ACQUISITION');
   await page.getByTestId('owner-simple-mode').click();
   await page.getByTestId('owner-step-0').click();
   await expect(page.getByTestId('owner-valuation-purpose')).toHaveValue('ACQUISITION');assertions++;
   await expect(page.getByTestId('owner-valuation-date')).toHaveValue('2026-10-15');assertions++;
   await page.getByTestId('owner-step-1').click();
   await expect(page.getByTestId('owner-market-city')).toHaveValue('جدة');assertions++;
   await expect(page.getByTestId('owner-market-land-area')).toHaveValue('1234');assertions++;
   await expect(page.getByTestId('owner-market-asset-type')).toHaveValue('RESIDENTIAL_BUILDING');assertions++;
   await expect(page.getByTestId('owner-market-built-area')).toHaveValue('1640');assertions++;
   await expect(page.getByTestId('owner-market-rentable-area')).toHaveValue('1200');assertions++;
   await page.getByTestId('owner-step-4').click();
   await expect(page.getByTestId('owner-market-results')).toBeVisible();assertions++;
   await expect(page.getByTestId('owner-market-results').locator('dd')).toHaveCount(2);assertions++;
   // No comparables have been provided; the result is never certified.
   await expect(page.getByTestId('owner-market-results')).toContainText('غير معتمدة مهنيًا');assertions++;
   await page.getByTestId('owner-step-0').click();
   for(let step=0;step<5;step++){
    await page.getByTestId('owner-step-'+step).click();
    await expect(page.getByTestId('owner-current-step')).toContainText('('+(step+1)+'/5)');assertions++;
    await page.screenshot({path:path.join(root,'owner-step-'+(step+1)+'-'+width+'.png'),fullPage:false});
    if(step===2){
     await expect(page.getByTestId('owner-evidence-counts')).toContainText('بيع: 0');assertions++;
     await expect(page.getByTestId('owner-evidence-counts')).toContainText('إيجار: 0');assertions++;
     await page.getByTestId('owner-open-sales').click();
     await expect(page.getByTestId('market-comparables-sale')).toBeFocused();assertions++;
     await page.getByTestId('owner-open-rentals').click();
     await expect(page.getByTestId('market-comparables-rent')).toBeFocused();assertions++;
    }
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