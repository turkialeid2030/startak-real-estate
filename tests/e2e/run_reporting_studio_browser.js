'use strict';
const assert=require('node:assert/strict');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const fixture={reportRef:'SYNTHETIC-ONLY',valuationDate:'2026-01-01',landAreaSqm:1000,comparables:[{id:'C1',date:'2025-12-01',areaSqm:900,rawRateSar:1000,firstAdjustment:-.1,secondAdjustment:-.2,weight:.5,transactionStatus:'EXECUTED',page:1},{id:'C2',date:'2025-12-01',areaSqm:1000,rawRateSar:1200,firstAdjustment:0,secondAdjustment:0,weight:.5,transactionStatus:'EXECUTED',page:1}],adoptedLandRateSar:960,roundingReason:'',components:[{id:'B1',kind:'FLOOR',quantity:500,unit:'SQM',unitCostSar:1000,page:2},{id:'B2',kind:'WALL',quantity:100,unit:'LINEAR_M',unitCostSar:100,page:2}],declaredBuildingCostSar:510000,effectiveAge:10,economicLife:50,declaredPhysicalRate:.2,declaredDepreciationSar:102000,declaredFinalValueSar:1368000,sourcePage:3,identityConflict:true,incomeEvidenceAvailable:false};
(async()=>{
 const engine=process.env.STARTAK_BROWSER||'chromium',browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true});
 let configs=0;
 try{for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const ctx=await browser.newContext({viewport:{width,height:900},locale,acceptDownloads:true});
  try{
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   const url=new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('LOCAL_PREVIEW_REQUIRED');
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url.origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
   await page.goto(url.href);
   const panel=page.getByTestId('professional-reporting-studio');
   await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');
   const download=async button=>{const pending=page.waitForEvent('download');await button.click();const file=await pending;return fs.readFile(await file.path(),'utf8');};
   for(const mode of ['OWNER','TECHNICAL']){
    await panel.getByTestId('studio-mode').selectOption(mode);
    const html=await download(panel.getByTestId('studio-export'));
    assert.ok(html.includes('STARTAK REAL ESTATE'));assert.ok(html.includes('default-src'));assert.ok(!html.includes('<script>'));assert.ok(html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));
   }
   const input=panel.getByTestId('studio-external-input'),audit=panel.getByTestId('studio-audit'),exp=panel.getByTestId('studio-audit-export');
   await expect(exp).toBeDisabled();
   await input.fill(JSON.stringify({...fixture,reportRef:'<script>alert(1)</script>'}));await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('1368000');
   await expect(exp).toBeEnabled();
   const html=await download(exp);
   assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('SHA-256'));
   const land={version:'VACANT_LAND_REPORT_REVIEW_V1',reportRef:'SYNTH-LAND',valuationDate:'2026-01-05',inspectionDate:'2026-01-04',issueDate:'2026-01-06',worksheetDate:'2026-01-06',limitationsDate:'2026-01-05',landAreaSqm:1000,adoptedLandRateSar:1100,roundingReason:'SYNTH',declaredFinalValueSar:1100000,planningEvidence:'CLIENT_ASSUMPTION',planningRef:'SYNTH',assumedFloors:3,uncertaintyFraction:.1,uncertaintyRef:'SYNTH',comparables:[{id:'C1',date:'2026-01-06',observedDate:null,areaSqm:100,rawRateSar:1000,weight:1,transactionStatus:'ASKING',sourceRef:'SYNTH',page:1,adjustments:[{category:'FRONTAGES',stage:2,fraction:.1,evidenceRef:'SYNTH'}]}],sourcePage:2};
   await input.fill(JSON.stringify(land));await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('1100000');
   await expect(panel.getByTestId('studio-audit-result')).toContainText('990000');
   await expect(exp).toBeEnabled();
   const landHtml=await download(exp);assert.ok(landHtml.includes(locale==='en'?'Vacant land report review':'مراجعة تقرير أرض فضاء'));assert.ok(!landHtml.includes('<script>'));
   const before={reportRef:'SYNTH-A',propertyRef:'SYNTH-P',valuationDate:'2025-01-01',issueDate:'2025-01-02',landAreaSqm:1000,state:'IMPROVED',basis:'FAIR_VALUE',purpose:'FINANCIAL_REPORTING',propertyRight:'FREEHOLD',method:'COST',reportedValueSar:900000,landValueSar:null,improvementValueSar:null,sourcePage:1};
   const history={version:'PROPERTY_LIFECYCLE_REVIEW_V1',propertyRef:'SYNTH-P',identityEvidenceRef:'SYNTH-ID',identityMatchDeclared:true,transitionEvidenceRef:'SYNTH-TRANSITION',before,after:{...before,reportRef:'SYNTH-B',valuationDate:'2026-01-05',issueDate:'2026-01-06',state:'VACANT_LAND',basis:'MARKET_VALUE',purpose:'SALE',method:'MARKET',reportedValueSar:1000000,landValueSar:1000000,improvementValueSar:0}};
   await input.fill(JSON.stringify(history));await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('100000');
   await expect(panel.getByTestId('studio-audit-result')).toContainText(locale==='en'?'Reported difference is not market growth':'لا يمثل فرق القيمة نمو السوق');
   const historyHtml=await download(exp);assert.ok(historyHtml.includes(locale==='en'?'Property report history comparison':'مقارنة تقارير الأصل عبر الزمن'));
   const row=(year,patch={})=>({year,propertyRentSar:0,ownerOpexSar:0,sustainingCapexSar:0,demolitionSar:0,constructionSar:0,otherDevelopmentSar:0,netExitSar:0,...patch});
   const development={version:'OWNER_REDEVELOPMENT_RESEARCH_V1',propertyRef:'SYNTH-P',valuationDate:'2026-01-05',currentState:'IMPROVED',propertyRight:'FREEHOLD',identityRef:'SYNTH-ID',currentNetSaleSar:1000000,saleAssumptionRef:'SYNTH-SALE',years:3,discountRate:0,planningStatus:'ASSUMPTION_ONLY',planningRef:'SYNTH-PLAN',environmentalRef:'SYNTH-ENV',costRef:'SYNTH-COST',incomeRef:'SYNTH-RENT',exitRef:'SYNTH-EXIT',propertyIncomeOnly:true,noDuplicateCosts:true,demolitionYear:0,completionYear:1,retain:[row(0),row(1,{propertyRentSar:100000,ownerOpexSar:20000}),row(2,{propertyRentSar:100000,ownerOpexSar:20000}),row(3,{propertyRentSar:100000,ownerOpexSar:20000,netExitSar:1000000})],redevelop:[row(0,{demolitionSar:50000}),row(1,{constructionSar:400000}),row(2,{propertyRentSar:150000,ownerOpexSar:30000}),row(3,{propertyRentSar:150000,ownerOpexSar:30000,netExitSar:1800000})],stress:{incomeReduction:.1,costIncrease:.1,exitReduction:.1}};
   await input.fill(JSON.stringify(development));await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('1590000');
   await expect(panel.getByTestId('studio-audit-result')).toContainText('590000');
   await expect(exp).toBeEnabled();
   const developmentHtml=await download(exp);assert.ok(developmentHtml.includes(locale==='en'?'Hold, sell and redevelopment feasibility':'جدوى الاحتفاظ والبيع وإعادة التطوير'));assert.ok(!developmentHtml.includes('<script>'));
   await input.fill(JSON.stringify({...development,redevelop:development.redevelop.map((p,i)=>i===1?{...p,propertyRentSar:10000}:p)}));await expect(exp).toBeDisabled();await audit.click();await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-audit-result')).toHaveCount(0);
   const esg={version:'PROPERTY_ESG_SCREENING_V1',propertyRef:'SYNTH-P',valuationDate:'2026-01-05',factors:[{factor:'ENERGY_PERFORMANCE',pillar:'ENVIRONMENTAL',outcome:'MATERIAL',rationale:'SYNTHETIC',sourceClass:'CLIENT_PROVIDED',sourceRef:'SYNTH',sourceDate:'2026-01-01',validTo:null,impactChannels:['OWNER_OPEX']}]};
   await input.fill(JSON.stringify(esg));await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText(locale==='en'?'Unknown factors':'عوامل غير معلومة');
   await expect(panel.getByTestId('studio-audit-result')).toContainText('10');
   await expect(exp).toBeEnabled();
   const esgHtml=await download(exp);assert.ok(esgHtml.includes(locale==='en'?'Property ESG research screening':'الفحص البحثي للعوامل البيئية والاجتماعية والحوكمة'));assert.ok(!esgHtml.includes('<script>'));
   await input.fill(JSON.stringify({...esg,factors:[{...esg.factors[0],sourceRef:null}]}));await audit.click();await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-audit-result')).toHaveCount(0);
   await input.fill('{}');await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-audit-result')).toHaveCount(0);
   await audit.click();await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-notice')).toBeVisible();
   assert.deepEqual(errors,[]);
   const dir=path.join('runtime-evidence','reporting-studio-browser',engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,locale+'-'+width+'.png')});configs++;
  }finally{await ctx.close();}
 }}finally{await browser.close();}
 console.log('REPORTING_STUDIO_BROWSER=PASS configurations='+configs);
})().catch(e=>{console.error(e);process.exitCode=1;});
