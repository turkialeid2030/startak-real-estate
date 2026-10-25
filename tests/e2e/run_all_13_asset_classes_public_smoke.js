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
  assert.deepEqual(errors,[],'no React browser runtime exceptions across 13 asset classes');
  console.log('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=PASS sectors='+verified);
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=FAIL',e);process.exitCode=1;});
