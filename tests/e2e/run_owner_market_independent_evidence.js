'use strict';
// Real browser, original market engine and shared owner market-study subject.
// All data below are deliberately synthetic; NO private licensed fixture or
// real transaction has been included in this public test.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'ar-SA'});
 const base=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/';
 const money=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(x);
 const ownerCap=page.getByTestId('owner-market-capital-indication');
 const ownerRent=page.getByTestId('owner-market-rent-indication');
 let checks=0;
 const eq=async(locator,value)=>{await expect(locator).toHaveText(value);checks++};
 try{
  await page.goto(base,{waitUntil:'networkidle'});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.getByTestId('owner-valuation-purpose').selectOption('ACQUISITION');
  await page.getByTestId('owner-valuation-date').fill('2026-10-15');
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-market-name').fill('SYNTHETIC-RESEARCH-OWNER');
  await page.getByTestId('owner-market-city').fill('جدة');
  await page.getByTestId('owner-market-district').fill('حي افتراضي');
  await page.getByTestId('owner-market-location').fill('21.500,39.200');
  await page.getByTestId('owner-market-land-area').fill('1234');
  await page.getByTestId('owner-property-right').selectOption('FULL_OWNERSHIP');
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  await page.getByTestId('owner-advanced-mode').click();
  const panel=page.getByTestId('location-market-study');
  await expect(panel).toBeVisible();
  const fillField=async(label,value)=>panel.getByLabel(label,{exact:true}).fill(value);
  await fillField('إجمالي المساحات المبنية لكل المباني (م²)','1000');
  await fillField('إجمالي المساحة القابلة للتأجير (م²)','800');
  await fillField('عدد العمائر/المباني','1');
  await fillField('عدد الوحدات (شقق/مكاتب/معارض)','10');
  const setup=async(kind,index,amount,status='EXECUTED')=>{
   const row=page.getByTestId('market-comparable-'+kind+'-'+index);
   await row.locator('select').nth(0).selectOption('RESIDENTIAL_COMPOUND');
   await row.locator('select').nth(1).selectOption(status);
   const inputs=row.locator('input');
   await inputs.nth(0).fill('SYNTH-'+kind+'-'+index);
   await inputs.nth(1).fill(String(amount));
   await inputs.nth(2).fill(kind==='sale'?'1000':'800');
   await inputs.nth(3).fill('2026-10-01');
   await inputs.nth(4).fill('21.500,39.200');
   await inputs.nth(5).fill('https://example.org/synthetic-'+kind+'-'+index);
  };
  for(let i=0;i<3;i++){
   await setup('sale',i,[4500000,5000000,5500000][i],i===0?'ASKING':'EXECUTED');
   await setup('rent',i,[500000,520000,540000][i]);
  }
  // An asking listing must not be promoted into an executed sale.
  await eq(page.getByTestId('market-canonical-capital-indication'),'غير قابل للحساب');
  await eq(page.getByTestId('market-canonical-rent-indication'),money(520000)+' ر.س');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');
  await eq(ownerRent,money(520000));
  await expect(page.getByTestId('owner-market-results')).toContainText('بيع: 2');
  checks++;
  // With a third executed sale the separate sale and income estimates agree
  // within the existing 20% method-reconciliation gate; no synthetic result
  // becomes professionally certified.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-sale-0').locator('select').nth(1).selectOption('EXECUTED');
  const independentValue=4996000;
  await eq(page.getByTestId('market-canonical-capital-indication'),money(independentValue)+' ر.س');
  await eq(page.getByTestId('market-canonical-rent-indication'),money(520000)+' ر.س');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));
  await eq(ownerRent,money(520000));
  await expect(page.getByTestId('owner-market-results')).toContainText('بيع: 3');
  checks++;
  // Removing a valid lease suppresses rental indication independently;
  // capital indication must not be transformed into a fictional rent.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-rent-0').locator('select').nth(1).selectOption('ASKING');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(5000000));
  await eq(ownerRent,'—');
  // Restoring the lease restores the original pair.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-rent-0').locator('select').nth(1).selectOption('EXECUTED');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));
  await eq(ownerRent,money(520000));
  // Stale market values are quarantined immediately after the shared subject
  // changes, and missing coordinates cancel comparable eligibility.
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-market-location').fill('NO_VALID_COORDINATES');
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  assert.equal(pageErrors.length,0,'browser runtime errors '+pageErrors.join(';'));checks++;
  console.log('OWNER_MARKET_INDEPENDENT_EVIDENCE=PASS assertions='+checks+' synthetic_only=true professional_approval=false');
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error('OWNER_MARKET_INDEPENDENT_EVIDENCE=FAIL',e.stack||e);process.exitCode=1;});
