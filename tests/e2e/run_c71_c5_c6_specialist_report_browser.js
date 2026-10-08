'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {buildC6SavedDeal}=require('../fixtures/c6-governed-saved-deal');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {EVIDENCE_TYPES,emptySpecialistReferenceIntake}=require('../../src/app/specialist-reference-intake');

const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const NS='STARTAK_REAL_ESTATE:SAVED_DEALS:';
function recordFor(asset){
 const deal=buildC6SavedDeal({now:new Date(),id:'DEAL-C71-'+(asset||'BUILDING')});
 deal.name=asset?({
  HOSPITALITY:'تقرير فندق محكوم ٧١',
  INDUSTRIAL_LOGISTICS:'تقرير مستودع محكوم ٧١',
  MIXED_USE:'تقرير مختلط محكوم ٧١',
 })[asset]:'تقرير مبنى محكوم ٧١';
 if(asset){
  deal.valuationCase.classification={assetClass:asset};
  if(asset!==ASSET_CLASS.MIXED_USE){
   const intake=emptySpecialistReferenceIntake(asset);
   intake.assetSubtype=asset===ASSET_CLASS.HOSPITALITY?'HOTEL_FULL_SERVICE':'WAREHOUSE';
   intake.propertyRef='مرجع غير متحقق ٧١';
   intake.asOf=new Date().toISOString().slice(0,10);
   for(const key of EVIDENCE_TYPES)intake.evidenceRefs[key]='مرجع ملف ٧١';
   deal.valuationCase.institutionalEvidence={specialistIntake:intake,
    professionalValuationApproved:true,sourceRightsIndependentlyVerified:true};
  }
 }
 return deal;
}
async function seed(page,record){
 await page.addInitScript(({record,namespace})=>{
  const key=namespace+'deal:'+record.id;
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(record));
  const idx=namespace+'deals-index';
  if(localStorage.getItem(idx)===null)localStorage.setItem(idx,JSON.stringify([{
   id:record.id,name:record.name,mode:record.mode,savedAt:record.savedAt,
  }]));
 },{record,namespace:NS});
}
async function load(page,record){
 await page.locator('button[title="الصفقات المحفوظة"]').click();
 const dialog=page.getByRole('dialog',{name:'الصفقات'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:record.name}).click();
}
async function downloadJson(page,testId){
 const promise=page.waitForEvent('download');
 await page.getByTestId(testId).click();
 const item=await promise;
 const path=await item.path();
 return {fileName:item.suggestedFilename(),payload:JSON.parse(fs.readFileSync(path,'utf8'))};
}
async function runScenario(browser,asset){
 const ctx=await browser.newContext({locale:'ar-SA',viewport:{width:1440,height:1050},acceptDownloads:true});
 const page=await ctx.newPage(),errors=[],downloads=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('download',item=>downloads.push(item.suggestedFilename()));
 const record=recordFor(asset);
 try{
  await seed(page,record);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:35000});
  await load(page,record);
  const c5=page.getByTestId('governed-decision-operations');
  const c6=page.getByTestId('c6-human-review-workflow');
  await expect(c5).toBeVisible();
  await expect(c6).toBeVisible();
  if(asset){
   await expect(c5.getByTestId('c71-specialist-export-hold')).toBeVisible();
   await expect(c6.getByTestId('c71-specialist-export-hold')).toBeVisible();
   await expect(c5.getByTestId('c5-governed-analytical-export')).toBeDisabled();
   await expect(c6.getByTestId('c6-reviewer-id')).toBeDisabled();
   await expect(c6.getByTestId('c6-record-review')).toBeDisabled();
   await expect(c6.getByTestId('c6-reviewed-export')).toBeDisabled();
   // A forged valid C4 numerical snapshot, nine reference IDs, and
   // user-declared professional authority must not resurrect exports.
   await page.reload({waitUntil:'domcontentloaded'});
   await load(page,record);
   await expect(page.getByTestId('c5-governed-analytical-export')).toBeDisabled();
   await expect(page.getByTestId('c6-reviewed-export')).toBeDisabled();
   await page.getByTestId('c5-governed-analytical-export').evaluate(btn=>btn.click());
   await page.getByTestId('c6-reviewed-export').evaluate(btn=>btn.click());
   assert.deepEqual(downloads,[],'forged specialist reports downloaded');
   assert.deepEqual(errors,[],'browser errors');
   console.log('C71_REAL_CHROMIUM_SPECIALIST_C5_C6_HOLD_'+asset+'=PASS');
   return;
  }
  await expect(c5.getByTestId('c5-governed-analytical-export')).toBeEnabled();
  await expect(c6.getByTestId('c6-reviewed-export')).toBeDisabled();
  const c5out=await downloadJson(page,'c5-governed-analytical-export');
  assert(c5out.fileName.endsWith('.json'));
  assert.equal(c5out.payload.classification,'NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  assert.equal(c5out.payload.transactionAuthorized,false);
  assert.equal(c5out.payload.approvalAuthorized,false);
  assert.equal(c5out.payload.certifiedValuationEstablished,false);
  assert.equal(c5out.payload.finalValuationConclusionEstablished,false);
  assert.match(c5out.payload.exportHashSha256,/^[a-f0-9]{64}$/);
  console.log('C71_REAL_CHROMIUM_C5_TRUE_ANALYTICAL_JSON_DOWNLOAD=PASS');

  await c6.getByTestId('c6-reviewer-id').fill('case-reviewer-71');
  await c6.getByTestId('c6-review-recommendation').selectOption('HOLD_FOR_EVIDENCE');
  await c6.getByTestId('c6-review-rationale').fill('هذه توصية مراجعة محكومة فقط ولا تتيح تقرير تقييم رسمي أو معاملة.');
  await c6.getByTestId('c6-record-review').click();
  await expect(c6.getByTestId('c6-reviewed-export')).toBeEnabled();
  await page.reload({waitUntil:'domcontentloaded'});
  await load(page,record);
  await expect(page.getByTestId('c6-reviewed-export')).toBeEnabled();
  const c6out=await downloadJson(page,'c6-reviewed-export');
  assert(c6out.fileName.endsWith('.json'));
  assert.equal(c6out.payload.classification,'NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  assert.equal(c6out.payload.approvalStatus,'NOT_ESTABLISHED');
  assert.equal(c6out.payload.review.recommendation,'HOLD_FOR_EVIDENCE');
  assert.equal(c6out.payload.transactionAuthorized,false);
  assert.equal(c6out.payload.certifiedValuationEstablished,false);
  assert.equal(c6out.payload.c5Export.classification,'NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  assert.equal(c6out.payload.reviewHashSha256,c6out.payload.review.reviewHashSha256);
  assert.match(c6out.payload.exportHashSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(errors,[],'browser errors');
  console.log('C71_REAL_CHROMIUM_C6_TRUE_REVIEWED_JSON_DOWNLOAD=PASS');
 }catch(error){
  const state=await page.evaluate(()=>({
   c5:document.querySelector('[data-testid="governed-decision-operations"]')?.innerText.slice(0,1000),
   c6:document.querySelector('[data-testid="c6-human-review-workflow"]')?.innerText.slice(0,1000),
   buttons:[...document.querySelectorAll('button')].filter(b=>b.getAttribute('data-testid')?.startsWith('c')).map(b=>({id:b.getAttribute('data-testid'),disabled:b.disabled})),
  })).catch(e=>({error:String(e)}));
  console.error('C71_BROWSER_DIAGNOSTIC='+JSON.stringify({asset:asset||'BUILDING',state,errors,downloads,error:String(error)}));
  throw error;
 }finally{await ctx.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await runScenario(browser,null);
  for(const cls of [ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS,ASSET_CLASS.MIXED_USE])await runScenario(browser,cls);
  console.log('C71_REAL_LICENSED_SAUDI_APPRAISAL_REPORT=FALSE');
  console.log('C71_REAL_INDEPENDENT_HUMAN_PROFESSIONAL_UAT=FALSE');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
