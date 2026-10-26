'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {ALL_SECTORS}=require('../../src/governance/personal-asset-universe');
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({locale:'ar-SA',viewport:{width:1366,height:960}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  const universe=page.getByTestId('personal-asset-universe-panel');
  await expect(universe).toBeVisible({timeout:30000});
  await expect(universe).toHaveAttribute('dir','rtl');
  const independent=universe.getByTestId('external-three-gates-readiness');
  await expect(independent).toBeVisible();
  await expect(independent).toHaveAttribute('dir','rtl');
  for(const field of ['market','ai','compliance']){
   await expect(independent.getByTestId('external-gate-'+field)).toContainText('معلّق');
  }
  await expect(independent.getByTestId('external-three-gates-authority')).toContainText('لا اعتماد');

  const selector=page.getByTestId('personal-asset-universe-select');
  const classes=Object.keys(ALL_SECTORS);
  assert.equal(classes.length,13,'13 canonical asset classes required for classification smoke');
  assert.equal(await selector.locator('option').count(),classes.length);
  let verified=0;
  for(const assetClass of classes){
   await selector.selectOption(assetClass);
   await expect(selector).toHaveValue(assetClass);
   await expect(universe.getByTestId('personal-asset-route-status')).not.toBeEmpty();
   await expect(universe.getByTestId('personal-asset-sector-evidence')).not.toBeEmpty();
   const workbench=universe.getByTestId('personal-sector-workbench');
   await expect(workbench).toBeVisible();
   await expect(workbench).toHaveAttribute('dir','rtl');
   // Deliberately blank sector input must not produce a fictitious value.
   await workbench.getByTestId('personal-sector-calculate').click();
   await expect(workbench.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
   await expect(workbench.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
   await expect(workbench.getByTestId('personal-sector-reasons')).not.toBeEmpty();
   if(assetClass==='LAND'){
    await expect(universe.getByTestId('personal-phased-development-dcf')).toBeVisible();
   }else{
    await expect(universe.getByTestId('personal-phased-development-dcf')).toHaveCount(0);
   }
   verified++;
  }
  // The switched sector remounts an empty research case; old HOLD and input must not leak.
  await selector.selectOption('OFFICE');
  await expect(universe.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await expect(universe.getByTestId('personal-limited-interest-dcf')).toBeVisible();
  // P0: live interface must never invent an EXECUTED_SALE from arbitrary
  // owner-entered comparable rows. All other fields are complete to isolate status.
  const marketCase=universe.getByTestId('personal-sector-workbench');
  await marketCase.getByLabel('المدينة',{exact:true}).fill('الرياض');
  await marketCase.getByLabel('الحي العقاري',{exact:true}).fill('الملقا');
  await marketCase.getByLabel('نوع العقار التفصيلي (مثلاً: فندق 4 نجوم)').fill('مكاتب');
  await marketCase.getByLabel('مساحة العقار (م²)').fill('١٬٠٠٠');
  await marketCase.getByLabel('تاريخ الدراسة').fill('2026-10-25');
  await marketCase.getByLabel('الحق العقاري محل التقييم').selectOption('FREEHOLD');
  await marketCase.getByLabel('صفقات مماثلة منفذة').check();
  await marketCase.getByLabel('وحدة المقارنة المناسبة للقطاع').selectOption('SQM');
  for(let i=0;i<3;i++){
   const comp=marketCase.getByTestId('personal-sector-comparable-'+i);
   await comp.getByLabel('رقم الصفقة').fill('SALE'+(i+1));
   await comp.getByLabel('مدينة الصفقة').fill('الرياض');
   await comp.getByLabel('حي الصفقة').fill('الملقا');
   await comp.getByLabel('النوع التفصيلي للصفقة').fill('مكاتب');
   await comp.getByLabel('تاريخ البيع').fill('2026-09-0'+(i+1));
   await comp.getByLabel('السعر لكل وحدة مقارنة مختارة (ريال)').fill('١٠٬٠٠٠');
   await comp.getByLabel('مرجع الصفقة المصدرية').fill('DOC-'+(i+1));
   await comp.getByLabel('وحدة المقارنة في الصفقة').selectOption('SQM');
   await comp.getByLabel('الحق المنقول في الصفقة').selectOption('FREEHOLD');
   if(i<2)await comp.getByTestId('personal-sector-sale-status-'+i).selectOption('EXECUTED_SALE');
  }
  const calculate=marketCase.getByTestId('personal-sector-calculate');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(marketCase.getByTestId('personal-sector-reasons')).toContainText('الصفقات غير متطابقة');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  const status=marketCase.getByTestId('personal-sector-sale-status-2');
  await status.selectOption('ASKING_SALE');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  await status.selectOption('EXECUTED_SALE');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('مؤشرات طرق منفصلة');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('MARKET_COMPARABLE');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('لم يتم التحقق منها رسميًا');
  assert.deepEqual(errors,[],'no React browser runtime exceptions across 13 asset classes');
  console.log('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=PASS sectors='+verified);
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=FAIL',e);process.exitCode=1;});
