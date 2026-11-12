'use strict';
// Real modern STARTAK Real Estate App e2e. All data synthetic and isolated.
// The historical freshness UI is reached through a *loaded Saved Deal*;
// this does not assert professional appraisal, external data or release GO.
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const gold=require('../reference/RE-GOLD-baseline.json');
const ar=require('../../src/i18n/locales/ar-SA');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {emptyValuationCaseDraft,buildValuationCaseFromDraft}=
 require('../../src/app/valuation-case-draft');
const {ASSET_CLASS,LIFECYCLE_STAGE,INVESTMENT_STRATEGY,INCOME_MODEL}=
 require('../../src/project-model/project-profile');
const {EXPENSE_TREATMENT}=require('../../src/valuation-intelligence/income-capitalization');
const {BASIS_OF_VALUE}=require('../../src/valuation-intelligence');
const {validateSavedDealRecord}=require('../../src/validation/saved-deal-schema');
const NAME='SYNTHETIC RE EVIDENCE FRESHNESS 20261112';
const ID='synthetic-re-freshness-20261112';
const BASE=new URL(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/');
BASE.searchParams.set('ownerView','advanced');
function isoDays(offset){
 return new Date(Date.now()+offset*86400000).toISOString();
}
function fixture(observedAt){
 const d=emptyValuationCaseDraft();
 d.projectId='SYNTHETIC-PROPERTY-CASE-ONLY';
 d.classification={
  assetClass:Object.values(ASSET_CLASS)[0],
  lifecycleStage:Object.values(LIFECYCLE_STAGE)[0],
  investmentStrategy:Object.values(INVESTMENT_STRATEGY)[0],
  incomeModel:Object.values(INCOME_MODEL)[0]
 };
 d.incomePolicy={
  expenseTreatment:Object.values(EXPENSE_TREATMENT)[0],
  basis:Object.values(BASIS_OF_VALUE)[0],
  currency:'SAR',
  valuationDate:null
 };
 const valuationCase=buildValuationCaseFromDraft(d);
 valuationCase.evidence={
  sourceAgeTest:{
   sourceType:'SYNTHETIC_TEST_SOURCE_NOT_VERIFIED',
   sourceRef:'TEST-ONLY-NO_EXTERNAL_PROVIDER_OR_TITLE_DATA',
   observedAt,
   grade:'B',
   status:'UNVERIFIED'
  }
 };
 const record={
  id:ID,name:NAME,mode:'building',
  savedAt:new Date().toISOString(),
  inputs:gold['RE-GOLD-002_existing_building'].inputs,
  valuationCase
 };
 validateSavedDealRecord(record);
 return record;
}
async function seedAndLoad(page,record){
 await page.goto(BASE.href,{waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(({namespace,record})=>{
  window.localStorage.setItem(namespace+'deal:'+record.id,JSON.stringify(record));
  window.localStorage.setItem(namespace+'deals-index',JSON.stringify([{
   id:record.id,name:record.name,mode:record.mode,savedAt:record.savedAt
  }]));
 },{namespace:NAMESPACE,record});
 await page.reload({waitUntil:'domcontentloaded',timeout:45000});
 await expect(page.getByTestId('c75-personal-research-workspace')).toBeVisible({timeout:35000});
 await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
 const dialog=page.getByRole('dialog',{name:ar.savedDeals.panelTitle});
 await expect(dialog).toBeVisible({timeout:15000});
 await dialog.getByRole('button',{name:NAME,exact:true}).click();
 await expect(dialog).not.toBeVisible();
}
(async()=>{
 let checks=0;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({locale:'ar-SA',viewport:{width,height:900}});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   for(const {name,days,status,warning} of [
    {name:'fresh',days:-1,status:'CURRENT',warning:'حديث'},
    {name:'aging',days:-45,status:'AGING',warning:'متقادم نسبيًا'},
    {name:'stale',days:-400,status:'STALE',warning:'تحديث المصدر'},
    {name:'future',days:60,status:'UNKNOWN',warning:'مستقبلي'},
    {name:'missing',days:null,status:'UNKNOWN',warning:'غير صالح'},
   ]){
    const record=fixture(days === null ? null : isoDays(days));
    await seedAndLoad(page,record);
    const panel=page.getByTestId('valuation-data-freshness');
    try{
     await expect(panel).toBeVisible({timeout:30000});
    }catch(e){
     console.error('STARTAK_RE_REAL_APP_FRESHNESS_DIAGNOSTIC',JSON.stringify({
      width,name,url:page.url(),errors,
      visibleBody:(await page.locator('body').innerText().catch(()=>'' )).slice(0,3500)
     }));
     throw e;
    }
    checks++;
    await expect(panel).toHaveAttribute('data-freshness-status',status);checks++;
    await expect(panel).toContainText(warning);checks++;
    assert.equal(await panel.locator('button').count(),0,
      'read-only freshness report must not contain trade/approval/export buttons');checks++;
    assert.equal((await page.getByTestId('governed-report-export').count()),0,
      'legacy governed export not authorized in modern UI');checks++;
    assert.deepEqual(errors,[],name+' must not crash current App');checks++;
    // Change locale only after the final saved-deal reload in this viewport.
    if(name==='missing'){
     // The actual owner workflow may return to simple mode after a saved
     // case is loaded; the language control is only displayed in advanced.
     const switcher=page.getByTestId('locale-switch');
     if(!(await switcher.isVisible())){
       const advanced=page.getByTestId('owner-advanced-mode');
       await expect(advanced).toBeVisible({timeout:12000});
       await advanced.click();
     }
     await expect(switcher).toBeVisible({timeout:12000});
     if((await page.locator('html').getAttribute('lang'))!=='en'){
       await switcher.click();
     }
     await expect(panel).toContainText('Evidence Source Freshness');checks++;
     await expect(panel).toContainText('invalid or future date');checks++;
    }
   }
   await ctx.close();
  }
  console.log('STARTAK_RE_REAL_APP_SAVED_DEAL_FRESHNESS=PASS checks='+checks);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
