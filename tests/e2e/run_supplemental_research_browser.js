'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
(async()=>{
 const name=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[name]).launch({headless:true});let checks=0;
 try{for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const startChecks=checks,t=(ar,en)=>locale==='en'?en:ar;
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:true,locale});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
  await page.goto(new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').href);
  const el=id=>page.getByTestId('supplemental-'+id),panel=page.getByTestId('local-supplemental-research');
  await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');checks+=2;
  await expect(el('file')).toBeDisabled();checks++;
  const scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY',asOfDate:'2026-11-25'};
  const evidence={caseId:scope.caseId,propertyRef:scope.propertyRef,sourceRef:'SYNTH-SOURCE',sourceDate:'2026-11-24'};
  const base={...scope,scope:'PROPERTY',currency:'SAR'};
  const fill=async()=>{await el('case').fill(scope.caseId);await el('property').fill(scope.propertyRef);await el('date').fill(scope.asOfDate);};
  const load=data=>el('file').setInputFiles({name:'synthetic-finance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  const download=async id=>{const pending=page.waitForEvent('download');await el(id).click();return JSON.parse(await fs.readFile(await (await pending).path(),'utf8'));};
  const verify=async(method,input,values)=>{
   await el('method').selectOption(method);await load(input);
   await expect(el('status')).toHaveAttribute('data-status','ANALYTICAL_ONLY');checks++;
   await expect(panel.locator('tbody tr')).toHaveCount(Object.keys(values).length);checks++;
   const report=await download('report');
   assert.equal(report.kind,'LOCAL_RESEARCH_DRAFT');assert.equal(report.method,method);assert.equal(report.transactionAuthorized,false);assert.equal(report.valuationChanged,false);checks+=4;
   for(const [id,value] of Object.entries(values)){const m=report.metrics.find(x=>x.id===id);assert.ok(m);if(value===null)assert.equal(m.value,null);else assert.ok(Math.abs(m.value-value)<1e-8);checks++;}
  };
  await fill();const blank=await download('template');assert.equal(blank.caseId,scope.caseId);assert.equal(blank.cashflows.values[0],null);checks+=2;
  await verify('annual',{...base,cashflows:{...evidence,timing:'ANNUAL_END_OF_YEAR',basis:'OPERATING_ONLY',values:[-1000,600,600]},discountRate:{...evidence,unit:'ANNUAL_RATIO',value:0}},{DISCOUNTED_PAYBACK_PERIOD_END:2,PROFITABILITY_INDEX_CONVENTIONAL:1.2,EQUIVALENT_ANNUAL_ANNUITY:100});
  const gross={...base,price:{...evidence,unit:'SAR',basis:'PURCHASE_PRICE',value:2000000},annualGrossRent:{...evidence,unit:'SAR_PER_YEAR',basis:'CONTRACTUAL_GROSS_RENT',periodStart:'2027-01-01',periodEndExclusive:'2028-01-01',value:160000}};
  await verify('gross',gross,{GROSS_RENTAL_YIELD:0.08,GROSS_RENT_MULTIPLIER:12.5});
  const draftAppendix=await download('appendix');assert.equal(draftAppendix.analysis.metrics[0].value,0.08);assert.equal(draftAppendix.reportReference,null);assert.equal(draftAppendix.canonicalReportModified,false);assert.match(draftAppendix.appendixHashSha256,/^[a-f0-9]{64}$/);checks+=4;
  await el('reference-report').setInputFiles({name:'invalid-report.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(el('appendix')).toBeDisabled();checks++;
  await load(gross);await expect(el('result')).toBeVisible();await expect(el('appendix')).toBeEnabled();checks++;

  await el('property').fill('OTHER');await expect(el('result')).toHaveCount(0);await load(gross);await expect(el('status')).toHaveAttribute('data-status','HOLD');await expect(el('report')).toHaveCount(0);checks+=3;
  await fill();
  await verify('wacc',{...base,capital:{...evidence,basis:'MARKET_VALUE_CAPITAL_STRUCTURE',unit:'SAR_AND_ANNUAL_RATIOS',taxShieldBasis:'NO_TAX_SHIELD',debt:400,equity:600,costOfDebt:0.05,costOfEquity:0.12,effectiveTaxShieldRate:0}},{WACC:0.092});
  await verify('breakEven',{...base,activity:{...evidence,basis:'SINGLE_ACTIVITY_LINEAR_COST',unit:'SAR_AND_UNITS',periodStart:'2026-01-01',periodEndExclusive:'2027-01-01',fixedCost:1000,unitPrice:100,variableCostPerUnit:60,units:40,unitName:'synthetic service'}},{PROJECT_BREAK_EVEN_UNITS:25,PROJECT_BREAK_EVEN_REVENUE:2500,MARGIN_OF_SAFETY:0.375});
  const holding={...evidence,periodStart:'2024-11-24',periodEnd:'2026-11-24',basis:'OPENING_CLOSING_VALUE_CASH_DISTRIBUTIONS_NO_EXTERNAL_CAPITAL',unit:'SAR',openingValue:1000,closingValue:1210,cashDistributions:100,externalCapitalFlows:false};
  await verify('holding',{...base,holding,inflation:null},{HOLDING_PERIOD_RETURN:0.31,VALUE_ONLY_CAGR:Math.pow(1.21,365.2425/730)-1,REAL_HOLDING_PERIOD_RETURN:null});
  await el('method').selectOption('portfolio');await el('portfolio').fill('SYNTH-PORTFOLIO');await el('assets').fill('A\nB');
  const member={...holding,portfolioId:'SYNTH-PORTFOLIO',currency:'SAR'};
  const portfolio={scope:'PORTFOLIO',currency:'SAR',portfolioId:'SYNTH-PORTFOLIO',asOfDate:scope.asOfDate,periodStart:holding.periodStart,periodEnd:holding.periodEnd,members:[{...member,assetId:'A'},{...member,assetId:'B',openingValue:3000,closingValue:2700,cashDistributions:0}]};
  await verify('portfolio',portfolio,{PORTFOLIO_HOLDING_PERIOD_RETURN:0.0025});
  {
   await expect(el('local-custody')).toHaveCount(0);
   const {createPortfolioMember,createPortfolioSnapshot}=require('../../src/portfolio/portfolio-concentration');
   const start=holding.periodStart;
   const mk=(assetId,exposureAmount,allocationWeight)=>createPortfolioMember({memberId:'M-'+assetId,assetId,caseId:'CASE-'+assetId,propertyRef:'PROP-'+assetId,assetClass:'building',geography:'synthetic',sector:'synthetic',exposureAmount,currency:'SAR',exposureBasis:'PROFESSIONAL_VALUE_INDICATION',allocationWeight,sourceArtifactId:'ART-'+assetId,sourceArtifactHashSha256:'a'.repeat(64),sourceArtifactClassification:'RESEARCH',sourceAsOfDate:start,membershipRationale:'Synthetic fixture',evidenceRefs:['SYNTH-SOURCE'],preparedBy:'test-preparer',reviewedBy:'test-reviewer',preparedAt:start+'T00:00:00Z',reviewedAt:start+'T01:00:00Z'});
   const snapshot=createPortfolioSnapshot({snapshotId:'SYNTH-OPENING',portfolioId:'SYNTH-PORTFOLIO',portfolioName:'Synthetic portfolio',asOfDate:start,currency:'SAR',weightBasis:'CURRENT_EXPOSURE',maximumSourceAgeDays:0,members:[mk('A',1000,0.25),mk('B',3000,0.75)],createdAt:start+'T02:00:00Z'});
   const importSnapshot=data=>el('opening-snapshot').setInputFiles({name:'synthetic-opening.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
   await importSnapshot({...snapshot,portfolioName:'tampered'});await expect(el('snapshot-status')).toContainText(t('غير صالحة','invalid'));await expect(el('local-custody')).toHaveCount(0);checks+=2;
   await importSnapshot(snapshot);await expect(el('snapshot-status')).toContainText(t('تم التحقق','Opening snapshot consistency verified'));await expect(el('local-custody')).toBeVisible();checks+=2;
   await load(portfolio);await expect(el('result')).toBeVisible();
   await el('passphrase').fill('synthetic-portfolio-passphrase');await el('consent').check();await el('encrypted-save').click();
   await expect(el('storage-notice')).toContainText(t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),{timeout:15000});checks++;
   // Portfolio custody must fail closed without altering the stored ciphertext.
   const {NAMESPACE:portfolioNamespace}=require('../../src/storage/browser-local-storage-provider');
   const portfolioKey=portfolioNamespace+'supplemental-portfolio-encrypted-draft:v1:SYNTH-PORTFOLIO';
   const readPortfolio=()=>page.evaluate(k=>localStorage.getItem(k),portfolioKey);
   const ciphertext=await readPortfolio();
   assert.ok(ciphertext&&!ciphertext.includes('openingValue')&&!ciphertext.includes('cashDistributions'));checks++;
   await el('passphrase').fill('incorrect-portfolio-passphrase');await el('encrypted-load').click();
   await expect(el('storage-notice')).toContainText(t('تعذر الحفظ أو فتح المسودة','Save or unlock failed'),{timeout:15000});checks++;
   await expect(el('result')).toHaveCount(0);checks++;
   assert.equal(await readPortfolio(),ciphertext);checks++;
   await el('passphrase').fill('synthetic-portfolio-passphrase');await el('encrypted-load').click();
   await expect(el('storage-notice')).toContainText(t('استعيدت المدخلات وأعيد الحساب','Inputs restored and recalculated'),{timeout:15000});const savedReturn=await download('report');assert.equal(savedReturn.metrics[0].value,0.0025);checks++;
   await el('passphrase').fill('synthetic-portfolio-passphrase');await expect(el('encrypted-delete')).toBeDisabled();checks++;await el('delete-consent').check();await el('encrypted-delete').click();await expect(el('storage-notice')).toContainText(t('تم التحقق من حذف المسودة','Draft deletion verified'),{timeout:15000});checks++;
   assert.equal(await readPortfolio(),null);checks++;
   await el('passphrase').fill('synthetic-portfolio-passphrase');await el('encrypted-load').click();
   await expect(el('storage-notice')).toContainText(t('لا توجد مسودة محفوظة','No saved draft'),{timeout:15000});checks++;
   await expect(el('result')).toHaveCount(0);checks++;
   await load(portfolio);await expect(el('result')).toBeVisible();
  }
  await el('assets').fill('A\nC');await expect(el('result')).toHaveCount(0);await load(portfolio);await expect(el('status')).toHaveAttribute('data-status','HOLD');checks+=2;
  await page.reload();await expect(panel).toBeVisible();await expect(el('result')).toHaveCount(0);checks++;
  {
   const {NAMESPACE}=require('../../src/storage/browser-local-storage-provider'),messages=locale==='en'?require('../../src/i18n/locales/en'):require('../../src/i18n/locales/ar-SA'),gold=require('../reference/RE-GOLD-baseline.json');
   const seeds=[{id:scope.caseId,name:'SYNTH-FIN-LINKED'},{id:'SYNTH-FIN-OTHER',name:'SYNTH-FIN-OTHER-LINKED'}].map(x=>({...x,mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'}));
   await page.evaluate(({namespace,seeds})=>{for(const s of seeds)localStorage.setItem(namespace+'deal:'+s.id,JSON.stringify(s));localStorage.setItem(namespace+'deals-index',JSON.stringify(seeds.map(({inputs,...s})=>s)));},{namespace:NAMESPACE,seeds});
   await page.reload();
   const bind=async s=>{await page.getByTitle(messages.actions.savedDeals,{exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:s.name,exact:true}).click();await expect(el('case')).toHaveValue(s.id);};
   const records=()=>page.evaluate(({namespace,seeds})=>seeds.map(s=>localStorage.getItem(namespace+'deal:'+s.id)),{namespace:NAMESPACE,seeds});
   await bind(seeds[0]);const before=await records();
   await el('method').selectOption('gross');await el('property').fill(scope.propertyRef);await el('date').fill(scope.asOfDate);await load(gross);await expect(el('result')).toBeVisible();
   await el('passphrase').fill('synthetic-browser-finance-42');await expect(el('encrypted-save')).toBeDisabled();await el('consent').check();await el('encrypted-save').click();
   await expect(el('storage-notice')).toContainText(t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),{timeout:15000});checks+=2;
   const key=NAMESPACE+'supplemental-encrypted-draft:v1:'+scope.caseId+':gross';
   const raw=await page.evaluate(k=>localStorage.getItem(k),key);assert.ok(raw&&!raw.includes(scope.propertyRef)&&!raw.includes('annualGrossRent'));checks++;
   await bind(seeds[1]);await expect(el('result')).toHaveCount(0);checks++;
   // An existing draft for another deal must not be unlocked by the same passphrase.
   await el('method').selectOption('gross');await el('property').fill(scope.propertyRef);await el('date').fill(scope.asOfDate);
   await el('passphrase').fill('synthetic-browser-finance-42');await el('encrypted-load').click();
   await expect(el('storage-notice')).toContainText(t('لا توجد مسودة محفوظة','No saved draft'),{timeout:15000});checks++;
   await expect(el('result')).toHaveCount(0);await expect(el('report')).toHaveCount(0);checks+=2;
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);checks++;
   await page.reload();await bind(seeds[0]);await el('method').selectOption('gross');await el('property').fill(scope.propertyRef);await el('date').fill(scope.asOfDate);
   await el('passphrase').fill('incorrect-browser-passphrase');await el('encrypted-load').click();await expect(el('storage-notice')).toContainText(t('تعذر الحفظ أو فتح المسودة','Save or unlock failed'),{timeout:15000});await expect(el('result')).toHaveCount(0);checks++;
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);checks++;
   await el('passphrase').fill('synthetic-browser-finance-42');await el('encrypted-load').click();await expect(el('result')).toBeVisible({timeout:15000});const restored=await download('report');assert.equal(restored.metrics[0].value,0.08);checks++;
   // A denied availability probe must not leave an earlier result exportable.
   await page.evaluate(()=>{const original=Storage.prototype.setItem;window.__syntheticRestoreStorageProbe=()=>{Storage.prototype.setItem=original;delete window.__syntheticRestoreStorageProbe;};Storage.prototype.setItem=function(k,v){if(String(k).includes('__availability_probe__:'))throw new DOMException('Synthetic storage denial','SecurityError');return original.call(this,k,v);};});
   try{
    await el('passphrase').fill('synthetic-browser-finance-42');await el('encrypted-load').click();
    await expect(el('storage-notice')).toContainText(t('تعذر الحفظ أو فتح المسودة','Save or unlock failed'));checks++;
    await expect(el('result')).toHaveCount(0);await expect(el('report')).toHaveCount(0);await expect(el('passphrase')).toHaveValue('');checks+=3;
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),raw);checks++;
   }finally{await page.evaluate(()=>window.__syntheticRestoreStorageProbe());}
   await el('passphrase').fill('synthetic-browser-finance-42');await el('encrypted-load').click();await expect(el('result')).toBeVisible({timeout:15000});checks++;
   await el('passphrase').fill('synthetic-browser-finance-42');await expect(el('encrypted-delete')).toBeDisabled();await el('delete-consent').check();await el('encrypted-delete').click();await expect(el('storage-notice')).toContainText(t('تم التحقق من حذف المسودة','Draft deletion verified'),{timeout:15000});checks++;
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);assert.deepEqual(await records(),before);checks+=2;
   await el('passphrase').fill('synthetic-browser-finance-42');await el('encrypted-load').click();
   await expect(el('storage-notice')).toContainText(t('لا توجد مسودة محفوظة','No saved draft'),{timeout:15000});checks++;
   await expect(el('result')).toHaveCount(0);await expect(el('report')).toHaveCount(0);checks+=2;
   assert.deepEqual(await records(),before);checks++;
  }
  assert.equal(errors.length,0,errors.join(';'));checks++;
  console.log('SUPPLEMENTAL_RESEARCH_CONFIGURATION=PASS browser='+name+' locale='+locale+' width='+width+' checks='+(checks-startChecks));await page.close();
 }}finally{await browser.close();}
 console.log('SUPPLEMENTAL_RESEARCH_BROWSER=PASS browser='+name+' checks='+checks+' synthetic_only=true');
})().catch(e=>{console.error(e);process.exitCode=1;});
