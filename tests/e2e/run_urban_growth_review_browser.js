'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {args,scope,asOf,evaluate,S}=require('../fixtures/synthetic-urban-growth');
const shock=require('../fixtures/synthetic-policy-shock');
(async()=>{
 const name=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[name]).launch({headless:true});
 const input=args(),expected=evaluate(input);let checks=0;
 try{
  for(const locale of ['ar-SA','en']){
   const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,locale});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
   const el=id=>page.getByTestId(id),panel=el('local-urban-growth-review'),file=el('urban-growth-file');
   const fill=async(prefix,fields)=>{for(const [field,value] of fields)await el(prefix+'-'+field).fill(value);};
   const load=(data,target=file)=>target.setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await expect(panel).toBeVisible();checks++;
   await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks++;
   await expect(file).toBeDisabled();checks++;
   await fill('urban-growth',[['case',scope.caseId],['property',scope.propertyRef],['scope',scope.marketScopeRef],['date',asOf]]);
   await expect(file).toBeEnabled();checks++;
   await load({...input,report:{transactionAuthorized:true}});
   await expect(el('urban-growth-result')).toBeVisible();checks++;
   await expect(panel.locator('tbody tr')).toHaveCount(3);checks++;
   await expect(el('urban-growth-planned').locator('li')).toHaveCount(1);checks++;
   const pending=page.waitForEvent('download');await el('urban-growth-report').click();
   const report=JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));
   assert.deepEqual(report.review,expected.review);checks++;
   assert.equal(report.transactionAuthorized,false);checks++;
   await el('urban-growth-property').fill('OTHER');await expect(el('urban-growth-result')).toHaveCount(0);checks++;
   await load(input);await expect(el('urban-growth-status')).toHaveAttribute('data-status','HOLD_LOCAL_URBAN_GROWTH_REVIEW');checks++;
   await expect(el('urban-growth-report')).toHaveCount(0);checks++;
   await el('urban-growth-property').fill(scope.propertyRef);
   const tampered=JSON.parse(JSON.stringify(input));tampered.evidence[0].metricValue=1;
   await load(tampered);await expect(el('urban-growth-status')).not.toHaveAttribute('data-status',S.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW);checks++;
   await expect(el('urban-growth-result')).toHaveCount(0);checks++;
   await el('urban-growth-reset').click();await load(input);await expect(el('urban-growth-result')).toBeVisible();checks++;
   await el('urban-growth-date').fill('2026-10-30');await expect(el('urban-growth-result')).toHaveCount(0);checks++;
   await load(input);await expect(el('urban-growth-status')).toHaveAttribute('data-status','HOLD_LOCAL_URBAN_GROWTH_REVIEW');checks++;
   if(locale==='ar-SA'){
    const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider');
    const ar=require('../../src/i18n/locales/ar-SA'),gold=require('../reference/RE-GOLD-baseline.json');
    const seeds=[{id:scope.caseId,name:'SYNTH-C20-LINKED'},{id:shock.caseId,name:'SYNTH-C19-LINKED'}].map(s=>({...s,mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'}));
    await page.evaluate(({namespace,seeds})=>{
     for(const s of seeds)localStorage.setItem(namespace+'deal:'+s.id,JSON.stringify(s));
     localStorage.setItem(namespace+'deals-index',JSON.stringify(seeds.map(({inputs,...s})=>s)));
    },{namespace:NAMESPACE,seeds});
    await page.reload();
    const bind=async seed=>{
     await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();
     await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
     await expect(el('urban-growth-case')).toHaveValue(seed.id);
     await expect(el('policy-shock-case')).toHaveValue(seed.id);
    };
    const canonical=()=>page.evaluate(({namespace,seeds})=>seeds.map(s=>localStorage.getItem(namespace+'deal:'+s.id)),{namespace:NAMESPACE,seeds});
    await bind(seeds[0]);const before=await canonical();checks++;
    await fill('urban-growth',[['property',scope.propertyRef],['scope',scope.marketScopeRef],['date',asOf]]);
    await load(input);await expect(el('urban-growth-result')).toBeVisible();checks++;
    await el('urban-growth-share-scope').click();await expect(el('policy-shock-apply-scope')).toBeEnabled();checks++;
    await el('policy-shock-apply-scope').click();await expect(el('policy-shock-scope')).toHaveValue(scope.marketScopeRef);await expect(el('policy-shock-date')).toHaveValue(asOf);checks++;
    await expect(el('policy-shock-result')).toHaveCount(0);checks++;
    await bind(seeds[1]);await expect(el('urban-growth-result')).toHaveCount(0);await expect(el('policy-shock-apply-scope')).toBeDisabled();await expect(el('urban-growth-apply-scope')).toBeDisabled();checks++;
    await fill('policy-shock',[['scope',shock.marketScopeRef],['asset','OFFICE'],['city','SYNTH-CITY'],['date',shock.asOf]]);
    await el('policy-shock-transaction').selectOption('SALE');await load(shock.args(),el('policy-shock-file'));
    await expect(el('policy-shock-result')).toBeVisible();checks++;
    await el('policy-shock-share-scope').click();await el('urban-growth-apply-scope').click();
    await expect(el('urban-growth-scope')).toHaveValue(shock.marketScopeRef);await expect(el('urban-growth-date')).toHaveValue(shock.asOf);checks++;
    await el('urban-growth-property').fill(scope.propertyRef);await load(input);
    await expect(el('urban-growth-status')).toHaveAttribute('data-status','HOLD_LOCAL_URBAN_GROWTH_REVIEW');checks++;
    await bind(seeds[0]);await expect(el('policy-shock-result')).toHaveCount(0);await expect(el('urban-growth-apply-scope')).toBeDisabled();checks++;
    assert.deepEqual(await canonical(),before);checks++;
   }
   assert.equal(errors.length,0,errors.join(';'));checks++;await page.close();
  }
  console.log('C20_ACTUAL_BROWSER_REVIEW_AND_CROSS_TOOL_SCOPE=PASS browser='+name+' checks='+checks+' synthetic_only=true');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
