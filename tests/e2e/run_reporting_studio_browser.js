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
   let downloadIndex=0;
   const download=async button=>{
    const label=engine+':'+locale+':'+width+':'+(++downloadIndex)+':'+await button.getAttribute('data-testid');
    console.log('REPORT_DOWNLOAD_START '+label);
    // Attach handlers concurrently: a failed click or download must fail the test.
    const before=await page.evaluate(()=>document.querySelectorAll('a[data-startak-local-download]').length);
    let file;
    try{
      [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
    }catch(error){
      // Synthetic test only: capture state, never URL/content or customer data.
      const state=await page.evaluate(()=>{
        const anchors=[...document.querySelectorAll('a[data-startak-local-download]')];
        return {anchorCount:anchors.length,lastAnchorConnected:anchors.at(-1)?.isConnected===true,
          lastAnchorDisplay:anchors.length?getComputedStyle(anchors.at(-1)).display:null,
          lastAnchorHasDownload:anchors.at(-1)?.hasAttribute('download')===true,
          studioNoticeVisible:!!document.querySelector('[data-testid="studio-notice"]'),
          studioNotice:document.querySelector('[data-testid="studio-notice"]')?.textContent||null,
          visibility:document.visibilityState,
          userActivationActive:navigator.userActivation?.isActive??null};
      }).catch(()=>({diagnosticsUnavailable:true}));
      console.error('REPORT_DOWNLOAD_FAILURE '+label+' '+JSON.stringify({before,...state}));
      const failureDir=path.join('runtime-evidence','reporting-studio-browser',engine);
      await fs.mkdir(failureDir,{recursive:true});
      await page.screenshot({path:path.join(failureDir,'failure-'+locale+'-'+width+'-'+downloadIndex+'.png')}).catch(()=>{});
      throw error;
    }
    assert.equal(await file.failure(),null,'Download failed '+label);
    assert.match(file.suggestedFilename(),/^startak-[a-z-]+\.html$/i,'Unexpected download filename '+label);
    const html=await fs.readFile(await file.path(),'utf8');
    assert.ok(html.length>0,'Empty download '+label);
    console.log('REPORT_DOWNLOAD_PASS '+label);
    return html;
   };
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
   const rentalButton=panel.getByTestId('studio-load-rental-example');
   await rentalButton.locator('xpath=ancestor::details[1]/summary').click();await rentalButton.click();await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText('110000');await expect(panel.getByTestId('studio-audit-result')).toContainText('97020');await expect(exp).toBeEnabled();
   const rentHtml=await download(exp);assert.ok(rentHtml.includes(locale==='en'?'Independent rental research indication':'تقدير بحثي مستقل للقيمة الإيجارية'));assert.ok(!rentHtml.includes('<script>'));
   const rentFixture=JSON.parse(await input.inputValue());await input.fill(JSON.stringify({...rentFixture,comparables:rentFixture.comparables.map(c=>({...c,status:'ASKING'}))}));await expect(exp).toBeDisabled();await audit.click();
   await expect(panel.getByTestId('studio-audit-result')).toContainText(locale==='en'?'No aggregate estimate due to insufficient or conflicting evidence':'لا يوجد تقدير إجمالي بسبب نقص الأدلة أو تعارضها');
   const holdHtml=await download(exp);assert.ok(holdHtml.includes(locale==='en'?'Held for insufficient or conflicting evidence':'معلق لعدم كفاية الأدلة أو تعارضها'));
   await input.fill('{}');await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-audit-result')).toHaveCount(0);
   await audit.click();await expect(exp).toBeDisabled();await expect(panel.getByTestId('studio-notice')).toBeVisible();
   const ws=page.getByTestId('rental-workspace');
   await expect(ws).toBeVisible();await expect(ws).toHaveAttribute('dir',locale==='en'?'ltr':'rtl');
   const fill=(k,v)=>ws.getByTestId(k).fill(v),select=(k,v)=>ws.getByTestId(k).selectOption(v);
   const calc=ws.getByTestId('rental-calculate'),rentExport=ws.getByTestId('rental-export'),rentResult=ws.getByTestId('rental-result');
   await expect(rentExport).toBeDisabled();await calc.click();await expect(ws.getByTestId('rental-error')).toBeVisible();
   for(const [k,v] of Object.entries({'rental-property':'SYNTH-P','rental-date':'2026-01-05','rental-city':'SYNTH-CITY','rental-district':'SYNTH-DISTRICT'}))await fill(k,v);
   await ws.getByTestId('rental-disjoint').check();
   for(const [k,v] of Object.entries({id:'S1',subtype:'GRADE-A',areaPerUnitSqm:'100',unitCount:'10',occupancy:'90',collection:'98'}))await fill('rental-seg-0-'+k,v);
   await select('rental-seg-0-kind','OFFICE');await select('rental-seg-0-areaBasis','NLA');
   await calc.click();await expect(rentResult).toContainText(locale==='en'?'Held: insufficient or conflicting evidence':'معلق: أدلة غير كافية أو متعارضة');
   const indicator={version:'SAUDI_RENT_INDICATOR_SNAPSHOT_V1',sourceId:'REGA',sourceUrl:'https://rei.rega.gov.sa/en/advanced-search/rental-market',sourceRef:'SYNTH',attribution:'SYNTHETIC ONLY',city:'SYNTH-CITY',district:'SYNTH-DISTRICT',kind:'OFFICE',subtype:'GRADE-A',areaBasis:'NLA',periodStart:'2025-10-01',periodEnd:'2025-12-31',publishedDate:'2026-01-02',observedDate:'2026-01-03',priceSource:'REGISTERED',metric:'MEAN_ANNUAL_SAR_PER_SQM',valueSar:115,sampleCount:20,vatBasis:'INCLUDED',declaredVatRate:.15,vatRef:'SYNTH-VAT'};
   await fill('rental-indicator-input',JSON.stringify(indicator));await ws.getByTestId('rental-indicator-review').click();
   await ws.getByTestId('rental-history-add').click();await ws.getByTestId('rental-history-add').click();
   await expect(ws.getByTestId('rental-history-count')).toContainText('1');
   const offlineFields=Object.keys(indicator).filter(k=>k!=='version');const offlineCsv=offlineFields.join(',')+'\n'+offlineFields.map(k=>JSON.stringify(String(indicator[k]??''))).join(',');
   await fill('rental-offline-raw',offlineCsv);await expect(ws.getByTestId('rental-offline-preview')).toBeDisabled();await ws.getByTestId('rental-offline-authorized').check();await ws.getByTestId('rental-offline-preview').click();await expect(ws.getByTestId('rental-offline-result')).toBeVisible();await ws.getByTestId('rental-offline-commit').click();await expect(ws.getByTestId('rental-history-count')).toContainText('1');
   await ws.getByTestId('rental-history-review').click();await expect(ws.getByTestId('rental-history-result')).toContainText(locale==='en'?'REGA':'الهيئة العامة للعقار');
   await expect(ws.getByTestId('rental-indicator-result')).toContainText('SYNTHETIC ONLY');await expect(ws.getByTestId('rental-indicator-result')).toContainText(locale==='en'?'Not a property rental estimate':'لا يمثل هذا المؤشر قيمة إيجارية للعقار');
   await expect(rentResult).toContainText(locale==='en'?'Held: insufficient or conflicting evidence':'معلق: أدلة غير كافية أو متعارضة');
   for(let i=0;i<3;i++){
    await ws.getByTestId('rental-add-comparable').click();const prefix='rental-comp-'+i+'-';
    for(const [k,v] of Object.entries({sourceUrl:'https://example.com/synthetic',sourceRecordId:'R'+i,contractRef:'C'+i,subtype:'GRADE-A',city:'SYNTH-CITY',district:'SYNTH-DISTRICT',areaSqm:'100',date:'2026-01-01',observedDate:'2026-01-02',rentAmountSar:String(10000+i*1000)}))await fill(prefix+k,v);
    for(const [k,v] of Object.entries({status:'EXECUTED',kind:'OFFICE',areaBasis:'NLA',periodMonths:'12',vatBasis:'EXCLUDED'}))await select(prefix+k,v);
    await ws.getByTestId(prefix+'rentOnly').check();await ws.getByTestId(prefix+'usageRightsDeclared').check();
   }
   await expect(ws.getByTestId('rental-history-result')).toHaveCount(0);await expect(ws.getByTestId('rental-history-count')).toContainText('1');
   await expect(ws.getByTestId('rental-indicator-result')).toHaveCount(0);await expect(rentExport).toBeDisabled();await calc.click();
   const fmt=n=>n.toLocaleString(locale==='en'?'en-US':'ar-SA',{maximumFractionDigits:2});
   await expect(rentResult).toContainText(fmt(110000));await expect(rentResult).toContainText(fmt(97020));await expect(rentExport).toBeEnabled();
   const rentalWorkspaceHtml=await download(rentExport);assert.ok(rentalWorkspaceHtml.includes('SHA-256'));assert.ok(!rentalWorkspaceHtml.includes('<script>'));
   await select('rental-comp-2-status','ASKING');await expect(rentExport).toBeDisabled();await expect(rentResult).toHaveCount(0);await calc.click();await expect(rentResult).toContainText(locale==='en'?'Held: insufficient or conflicting evidence':'معلق: أدلة غير كافية أو متعارضة');
   assert.deepEqual(errors,[]);
   const dir=path.join('runtime-evidence','reporting-studio-browser',engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,locale+'-'+width+'.png')});configs++;
  }finally{await ctx.close();}
 }}finally{await browser.close();}
 console.log('REPORTING_STUDIO_BROWSER=PASS configurations='+configs);
})().catch(e=>{console.error(e);process.exitCode=1;});
