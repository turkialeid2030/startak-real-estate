'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
const {sidecarKey}=require('../../src/market/saved-deal-study-sidecar');
const gold=require('../reference/RE-GOLD-baseline.json');
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium';
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 let checks=0;
 try{
 for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const en=locale==='en',start=checks;
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},locale,acceptDownloads:true});
  try{
   const page=await ctx.newPage(),errors=[],downloads=[];
   page.on('pageerror',e=>errors.push(String(e)));page.on('download',d=>downloads.push(d));
   const id='synthetic-conflict-deal',name='SYNTH-CONFLICT-PROPERTY',savedAt='2026-10-28T00:00:00.000Z';
   const deal={id,name,mode:'building',savedAt,inputs:gold['RE-GOLD-002_existing_building'].inputs};
   const raw=JSON.stringify(deal),index=JSON.stringify([{id,name,mode:'building',savedAt}]);
   await page.addInitScript(({locale,ns,id,raw,index})=>{
    localStorage.setItem('startak.presentation.locale',locale);
    localStorage.setItem(ns+'deal:'+id,raw);localStorage.setItem(ns+'deals-index',index);
   },{locale,ns:NAMESPACE,id,raw,index});
   const url=new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('LOCAL_PREVIEW_REQUIRED');
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url.origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
   await page.goto(url.href);
   const market=page.getByTestId('location-market-study'),fusion=page.getByTestId('research-evidence-fusion');
   await expect(market).toBeVisible();
   const subject={name,assetType:'RESIDENTIAL_BUILDING',city:'الرياض',district:'SYNTH',location:'24.7,46.7',landArea:1000,builtArea:1000,rentableArea:800,buildingCount:1,unitCount:10,valuationDate:'2026-10-28',propertyRight:'FULL_OWNERSHIP'};
   const rows=Array.from({length:4},(_,i)=>({assetType:subject.assetType,status:'EXECUTED',date:'2026-10-27',sourceUrl:'https://example.org/synthetic/row-'+i,sourceRecordId:'row-'+i,location:subject.location,builtArea:1000,rentableArea:800,price:1000000,annualRent:100000}));
   const clean={kind:'STARTAK_PERSONAL_MARKET_STUDY',subject,assumptions:{occupancy:1,expenseRatio:0.2,capRate:0.08},sales:rows,rentals:rows,projects:[{name:'Synthetic project',status:'OPERATING',location:subject.location,sourceUrl:'https://example.org/synthetic/project',impactPct:0.05}]};
   const bad={...clean,sales:[...rows,{...rows[0],price:3000000}],rentals:[...rows,{...rows[0],annualRent:300000}],report:{todayValueScenarioSar:999999999,certifiedMarketValue:true},valuationReadiness:{preliminaryValueSar:999999999}};
   const restore=async data=>{
    await market.getByTestId('personal-market-study-import').setInputFiles({name:'synthetic-market.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await expect(market.getByTestId('market-study-action-notice')).toContainText(en?'inputs restored locally':'استُعيدت مدخلات الدراسة');
   };
   const noValue=en?'Not calculable':'غير قابل للحساب';
   const verifyHold=async()=>{
    await expect(market.getByTestId('market-canonical-capital-indication')).toHaveText(noValue);
    await expect(market.getByTestId('market-canonical-rent-indication')).toHaveText(noValue);
    await expect(market.getByTestId('market-research-issues')).toContainText(en?'conflicting sale records':'سجلات البيع المتعارضة');
    await expect(fusion.getByTestId('fusion-source-conflict-hold')).toBeVisible();
    await expect(fusion.getByTestId('fusion-export')).toBeDisabled();
    await expect(fusion.getByTestId('fusion-export-html')).toBeDisabled();
    await expect(fusion.getByTestId('fusion-scenario-annex')).toContainText(en?'No complete scenario value':'لا توجد قيمة تصورية مكتملة');
    const before=downloads.length;
    await market.getByTestId('personal-market-study-export').click();
    await expect(market.getByTestId('market-study-action-notice')).toContainText(en?'Results export is blocked by conflicting':'تصدير نتائج الدراسة محجوب بسبب تعارض');
    assert.equal(downloads.length,before);checks+=9;
   };
   await restore(bad);await verifyHold();
   const side=market.getByTestId('saved-deal-market-study-link');
   await side.getByRole('button',{name:en?'Refresh saved deals':'تحديث قائمة الصفقات المحفوظة',exact:true}).click();
   await side.getByRole('combobox').selectOption(id);
   await side.getByRole('checkbox').first().check();
   await side.getByRole('button',{name:en?'Save study sidecar for selected deal':'حفظ ملحق الدراسة للصفقة المختارة',exact:true}).click();
   await expect(market.getByTestId('market-sidecar-action-notice')).toContainText(en?'Research sidecar saved':'تم حفظ ملحق الدراسة');
   const stored=await page.evaluate(({ns,key,id})=>({sidecar:localStorage.getItem(ns+key),deal:localStorage.getItem(ns+'deal:'+id),index:localStorage.getItem(ns+'deals-index')}),{ns:NAMESPACE,key:sidecarKey(id),id});
   const envelope=JSON.parse(stored.sidecar);
   assert.equal(envelope.researchScope,'PERSONAL_UNVERIFIED_INPUTS_ONLY');assert.equal(envelope.certification,'NOT_AUTHORIZED');assert.equal(envelope.studyInputs.sales.length,5);assert.equal(envelope.studyInputs.rentals.length,5);
   assert.equal(Object.hasOwn(envelope.studyInputs,'report'),false);assert.equal(Object.hasOwn(envelope.studyInputs,'valuationReadiness'),false);assert.equal(stored.deal,raw);assert.equal(stored.index,index);checks+=9;
   await restore(clean);
   await expect(market.getByTestId('market-canonical-capital-indication')).not.toHaveText(noValue);
   await expect(market.getByTestId('market-canonical-rent-indication')).not.toHaveText(noValue);
   await expect(fusion.getByTestId('fusion-export')).toBeEnabled();
   await expect(fusion.getByTestId('fusion-export-html')).toBeEnabled();
   const pending=page.waitForEvent('download');await market.getByTestId('personal-market-study-export').click();
   const data=JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));
   assert.equal(data.valuationReadiness.preliminaryValueSar,1000000);
   assert.equal(data.valuationReadiness.newAnnualMarketRentSar,100000);
   assert.equal(data.report.certifiedMarketValue,false);assert.equal(data.report.projectScenarioSar,1050000);checks+=8;
   await side.getByRole('combobox').selectOption(id);
   await side.getByRole('button',{name:en?'Restore linked study sidecar':'استعادة ملحق الدراسة المرتبط',exact:true}).click();
   await expect(market.getByTestId('market-sidecar-action-notice')).toContainText(en?'Inputs restored from the sidecar':'استُعيدت مدخلات الملحق');
   await verifyHold();
   assert.deepEqual(errors,[]);checks++;
   const out=path.join('runtime-evidence','market-conflict-browser',browserName);
   await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,locale+'-'+width+'.png'),fullPage:false});
   console.log('MARKET_CONFLICT_BROWSER_CONFIGURATION=PASS browser='+browserName+' locale='+locale+' width='+width+' checks='+(checks-start));
  }finally{await ctx.close();}
 }
 }finally{await browser.close();}
 console.log('MARKET_CONFLICT_BROWSER=PASS checks='+checks);
})().catch(error=>{console.error(error);process.exitCode=1;});
