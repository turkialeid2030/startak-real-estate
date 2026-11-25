'use strict';
const assert=require('node:assert/strict');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const {evaluateLocalSectorOperations,STATUS}=require('../../src/specialized-assets/local-sector-operating-research');
const {restoreStudyFile}=require('../../src/specialized-assets/local-sector-operating-archive');
const {sha256Hex}=require('../../src/crypto/sha256');
const {UNITS,STATUS:DCF_STATUS,evaluateSectorPropertyDcf}=require('../../src/specialized-assets/sector-property-dcf');
const {restoreDcfStudy}=require('../../src/specialized-assets/sector-property-dcf-archive');
const {STATUS:RISK_STATUS,evaluateSectorFinancingRisk}=require('../../src/specialized-assets/sector-financing-risk-research');
const {restoreRiskFile,createRiskReport}=require('../../src/specialized-assets/sector-financing-risk-archive');
const hotel={availableRoomNights:36500,occupiedRoomNights:25550,roomsRevenueSar:12775000,foodBeverageRevenueSar:2000000,otherOperatingRevenueSar:225000,departmentalExpensesSar:4000000,undistributedOperatingExpensesSar:3000000,managementAndFranchiseFeesSar:500000,ffeReserveSar:500000};
const industrial={assetId:'SYNTH-01',subtype:'WAREHOUSE',landAreaSqm:2000,builtAreaSqm:1500,netLeasableAreaSqm:1200,clearHeightMeters:10,powerCapacityKva:400,leaseStructure:'GROSS',internalInspectionStatus:'NOT_INSPECTED',buildingPermitStatus:'PROVIDED_UNVERIFIED',annualRentSar:600000,landlordExpensesSar:120000};
const cap={capacity:100,usedCapacity:80,annualOperatingRevenueSar:1000000,annualOperatingExpensesSar:700000};
const special={propertyRightRef:'SYNTH-RIGHT',landValueSar:2000000,replacementCostSar:1000000,physicalLossSar:100000,functionalLossSar:50000,externalLossSar:50000,lossCausesDistinct:true,businessAssetsExcluded:true};
const mixed={totalLeasableAreaSqm:1500,commonExpensesSar:50000,sharedExpensesAllocatedOnce:true,segments:[{id:'office',areaSqm:1000,annualPropertyRevenueSar:1000000,annualDirectExpensesSar:100000,propertyIncomeOnly:true},{id:'retail',areaSqm:500,annualPropertyRevenueSar:500000,annualDirectExpensesSar:50000,propertyIncomeOnly:true}]};
const fuel={annualLitres:1000000,sellingPricePerLitre:2,purchaseCostPerLitre:1.8,annualNonFuelRevenueSar:500000,annualNonFuelDirectCostSar:300000,annualOperatingExpensesSar:100000,annualPropertyRentSar:120000,annualEnvironmentalReserveSar:20000,nonFuelSeparated:true,propertyRentSeparated:true,environmentalReviewDeclared:true};
const cases=[['HOSPITALITY',hotel,'revParSar','availableRoomNights','sar'],['INDUSTRIAL_LOGISTICS',industrial,'annualRentPerLeasableSqm','netLeasableAreaSqm','sar'],...['HEALTHCARE','EDUCATION','PARKING','DATA_CENTER'].map(c=>[c,cap,'utilizationRate','capacity','pct']),['MIXED_USE',mixed,'declaredNetPropertyIncomeSar','totalLeasableAreaSqm','sar'],['SPECIAL_PURPOSE',special,'remainingImprovementCostSar','replacementCostSar','sar'],['FUEL_STATION',fuel,'operatingSurplusSar','sellingPricePerLitre','sar']];
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium';
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 let checks=0,scenarios=0;
 try{
 for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const ar=locale==='ar-SA',ctx=await browser.newContext({viewport:{width,height:900},locale,acceptDownloads:true});
  try{
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   const url=new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('LOCAL_PREVIEW_REQUIRED');
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url.origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
   await page.goto(url.href);
   const select=page.getByTestId('personal-asset-universe-select');
   const choose=async cls=>{await select.selectOption(cls==='FUEL_STATION'?'SPECIAL_PURPOSE':cls);if(cls==='FUEL_STATION'||cls==='SPECIAL_PURPOSE')await page.getByTestId('special-purpose-subtype').selectOption(cls);};
   await expect(select).toBeVisible();
   for(const [assetClass,inputs,metric,invalidField,kind] of cases){
    await choose(assetClass);const panel=page.getByTestId(assetClass==='FUEL_STATION'?'fuel-station-operating-research':'local-sector-operating-research');await expect(panel).toBeVisible();
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    const calc=panel.getByTestId('specialist-calculate');
    const exportReport=panel.getByTestId('specialist-export-report'),exportInputs=panel.getByTestId('specialist-export-inputs');
    await expect(exportReport).toBeDisabled();
    await calc.click();await expect(panel.getByTestId('specialist-result')).toHaveAttribute('data-status',STATUS.HOLD);
    const fill=async(obj,prefix='')=>{
     for(const [key,value] of Object.entries(obj)){
      if(key==='segments')continue;
      const el=panel.getByTestId('specialist-'+prefix+key);
      if(typeof value==='boolean')await el.setChecked(value);
      else if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(String(value));
      else await el.fill(String(value));
     }
    };
    await fill(inputs);
    if(inputs.segments)for(let i=0;i<inputs.segments.length;i++)await fill(inputs.segments[i],'segment-'+i+'-');
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    await calc.click();await expect(panel.getByTestId('specialist-result')).toHaveAttribute('data-status',STATUS.READY);
    const expected=evaluateLocalSectorOperations({assetClass,inputs}).metrics[metric];
    const formatted=new Intl.NumberFormat(ar?'ar-SA':'en-SA',kind==='pct'?{style:'percent',maximumFractionDigits:2}:{maximumFractionDigits:2}).format(expected)+(kind==='sar'?(ar?' ر.س':' SAR'):'');
    await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveText(formatted);
    await expect(panel.getByTestId('specialist-authority-hold')).toBeVisible();
    await expect(exportReport).toBeEnabled();
    const download=async button=>{const pending=page.waitForEvent('download');await button.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));};
    const importFile=async file=>panel.getByTestId('specialist-import-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
    const archive=await download(exportInputs),report=await download(exportReport);
    assert.equal(Object.hasOwn(archive,'result'),false);
    assert.equal(report.result.propertyValueSar,null);
    assert.equal(report.professionalValuationCertified,false);
    assert.equal(report.transactionAuthorized,false);
    assert.equal(restoreStudyFile(report,{expectedAssetClass:assetClass}).resultsRestored,false);
    const forged=JSON.parse(JSON.stringify(report));forged.result.propertyValueSar=123456789;
    const {sha256,...body}=forged;forged.sha256=sha256Hex(JSON.stringify(body));
    await importFile(forged);
    await expect(panel.getByTestId('specialist-file-notice')).toContainText(ar?'تعذر التحقق':'validation failed');
    await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveText(formatted);
    await importFile(archive);
    await expect(panel.getByTestId('specialist-file-notice')).toContainText(ar?'استُعيدت المدخلات فقط':'Inputs restored only');
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    await expect(exportReport).toBeDisabled();
    await calc.click();
    await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveText(formatted);
    await importFile(report);
    await expect(panel.getByTestId('specialist-file-notice')).toContainText(ar?'طابقت إعادة الحساب':'Report recomputation matched');
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    await expect(exportReport).toBeDisabled();
    await calc.click();await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveText(formatted);
    checks+=18;
    await panel.getByTestId('specialist-'+invalidField).fill('0');
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    await calc.click();await expect(panel.getByTestId('specialist-result')).toHaveAttribute('data-status',STATUS.HOLD);
    await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveCount(0);
    await expect(exportReport).toBeDisabled();
    checks+=12;scenarios++;
   }
   for(const [assetClass,unit] of Object.entries(UNITS)){
    await choose(assetClass);
    const panel=page.getByTestId('sector-property-dcf');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('sector-dcf-result')).toHaveCount(0);
    const calc=panel.getByTestId('sector-dcf-calculate'),reportButton=panel.getByTestId('sector-dcf-export-report');
    await expect(reportButton).toBeDisabled();
    await calc.click();await expect(panel.getByTestId('sector-dcf-result')).toHaveAttribute('data-status',DCF_STATUS.HOLD);
    const quantity=unit==='WHOLE_PROPERTY'?1:10;
    const input={propertyRight:'FREEHOLD',propertyRef:'SYNTH-PROPERTY',leaseAssumptionRef:'SYNTH-LEASE',valuationDate:'2026-11-25',years:5,quantity,annualRentPerUnitSar:1000000/quantity,leasedFraction:.9,collectionFraction:.95,annualOwnerExpensesSar:100000,annualSustainingCapexSar:20000,rentGrowth:0,expenseGrowth:0,purchasePriceSar:3000000,acquisitionCostsSar:100000,discountRate:.1,terminalMode:'EXPLICIT_NET_SALE',terminalNetSaleSar:3000000,terminalEvidenceRef:'SYNTH-NET-SALE',stressRevenueReduction:.2,stressExpenseIncrease:.1,stressDiscountIncrease:.02,propertyIncomeOnly:true,businessAssetsExcluded:true,...(assetClass==='MIXED_USE'?{mixedAllocationConfirmed:true}:{}),...(assetClass==='FUEL_STATION'?{environmentalObligationsReviewed:true}:{})};
    for(const [key,v] of Object.entries(input)){
     const el=panel.getByTestId('sector-dcf-'+key);
     if(typeof v==='boolean')await el.setChecked(v);
     else if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(String(v));
     else await el.fill(String(v));
    }
    await expect(panel.getByTestId('sector-dcf-result')).toHaveCount(0);
    await calc.click();await expect(panel.getByTestId('sector-dcf-result')).toHaveAttribute('data-status',DCF_STATUS.READY);
    const expected=evaluateSectorPropertyDcf({assetClass,...input});
    for(const [id,value] of [['npv',expected.investmentNpvSar],['irr',expected.irr],['stress',expected.scenarios.downside.npvSar]]){
     const formatted=new Intl.NumberFormat(ar?'ar-SA':'en-SA',id==='irr'?{style:'percent',maximumFractionDigits:2}:{maximumFractionDigits:2}).format(value);
     await expect(panel.getByTestId('sector-dcf-metric-'+id)).toHaveText(formatted);
    }
    const riskPanel=panel.getByTestId('sector-financing-risk');
    await expect(riskPanel).toBeVisible();
    await riskPanel.getByTestId('sector-risk-calculate').click();
    await expect(riskPanel.getByTestId('sector-risk-result')).toHaveAttribute('data-status',RISK_STATUS.HOLD);
    const financing={mode:'FIXED_RATE_AMORTIZING_PROXY',financingAssumptionRef:'SYNTH-FINANCE',taxCashflowAssumptionRef:'SYNTH-TAX',principalSar:1200000,upfrontFinanceFeeSar:10000,annualRate:0,tenorYears:10,equityDiscountRate:.1,annualAdditionalTaxSar:5000,exitAdditionalTaxSar:25000,additionalTaxCashflowsConfirmed:true,noDuplicateCostsConfirmed:true};
    const risk={assumptionRef:'SYNTH-RISK',seed:123456,samples:64,rentVariation:.2,expenseVariation:.1,saleVariation:.2};
    await riskPanel.getByTestId('sector-risk-mode').selectOption(financing.mode);
    for(const [prefix,values] of [['f-',financing],['r-',risk]])for(const [k,v] of Object.entries(values)){
     if(k==='mode')continue;
     const el=riskPanel.getByTestId('sector-risk-'+prefix+k);
     if(typeof v==='boolean')await el.setChecked(v);else await el.fill(String(v));
    }
    await riskPanel.getByTestId('sector-risk-calculate').click();
    await expect(riskPanel.getByTestId('sector-risk-result')).toHaveAttribute('data-status',RISK_STATUS.READY);
    const raw=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,typeof v==='boolean'?v:String(v)]));
    const riskExpected=evaluateSectorFinancingRisk({study:{assetClass,raw},financing,risk});
    assert.equal(riskExpected.status,RISK_STATUS.READY);
    for(const [id,value] of [['equity',riskExpected.initialEquitySar],['npv',riskExpected.equityNpvSar],['p10',riskExpected.simulation.p10NpvSar],['p50',riskExpected.simulation.p50NpvSar],['p90',riskExpected.simulation.p90NpvSar]]){
     const formatted=new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(value);
     await expect(riskPanel.getByTestId('sector-risk-metric-'+id)).toHaveText(formatted);
    }
    const riskReportButton=riskPanel.getByTestId('sector-risk-export-report');
    await expect(riskReportButton).toBeEnabled();
    const riskDownload=async button=>{const pending=page.waitForEvent('download');await button.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));};
    const riskImport=async file=>riskPanel.getByTestId('sector-risk-import-file').setInputFiles({name:'synthetic-risk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
    const riskArchive=await riskDownload(riskPanel.getByTestId('sector-risk-export-inputs')),riskReport=await riskDownload(riskReportButton);
    assert.equal(Object.hasOwn(riskArchive,'result'),false);
    assert.equal(riskReport.result.equityNpvSar,riskExpected.equityNpvSar);
    assert.equal(riskReport.financeApproved,false);
    assert.equal(restoreRiskFile(riskReport,{assetClass,raw}).baseInputsRestored,false);
    const riskForged=JSON.parse(JSON.stringify(riskReport));riskForged.result.equityNpvSar=999999999;
    const {sha256:riskDigest,...riskBody}=riskForged;riskForged.sha256=sha256Hex(JSON.stringify(riskBody));
    const otherProperty=createRiskReport({assetClass,raw:{...raw,propertyRef:'OTHER-PROPERTY'}},riskArchive.overlayInputs,{createdAt:riskReport.createdAt});
    for(const file of [riskForged,otherProperty]){
     await riskImport(file);await expect(riskPanel.getByTestId('sector-risk-file-notice')).toContainText(ar?'رُفض الملف':'File rejected');
     await expect(riskPanel.getByTestId('sector-risk-result')).toHaveAttribute('data-status',RISK_STATUS.READY);
    }
    for(const file of [riskArchive,riskReport]){
     await riskImport(file);await expect(riskPanel.getByTestId('sector-risk-file-notice')).toContainText(ar?'استُعيدت مدخلات التمويل':'Overlay inputs only restored');
     await expect(riskPanel.getByTestId('sector-risk-result')).toHaveCount(0);await expect(riskReportButton).toBeDisabled();
     await riskPanel.getByTestId('sector-risk-calculate').click();
     await expect(riskPanel.getByTestId('sector-risk-result')).toHaveAttribute('data-status',RISK_STATUS.READY);
     await expect(riskPanel.getByTestId('sector-risk-metric-npv')).toHaveText(new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(riskExpected.equityNpvSar));
    }
    await expect(panel.getByTestId('sector-dcf-metric-npv')).toHaveText(new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(expected.investmentNpvSar));
    checks+=20;
    await riskPanel.getByTestId('sector-risk-r-seed').fill('0');
    await expect(riskPanel.getByTestId('sector-risk-result')).toHaveCount(0);
    await riskPanel.getByTestId('sector-risk-calculate').click();
    await expect(riskPanel.getByTestId('sector-risk-result')).toHaveAttribute('data-status',RISK_STATUS.HOLD);
    await expect(riskPanel.getByTestId('sector-risk-metric-npv')).toHaveCount(0);
    await expect(riskReportButton).toBeDisabled();
    checks+=13;
    await expect(reportButton).toBeEnabled();
    const download=async button=>{const pending=page.waitForEvent('download');await button.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));};
    const importFile=async file=>panel.getByTestId('sector-dcf-import-file').setInputFiles({name:'synthetic-dcf.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});
    const archive=await download(panel.getByTestId('sector-dcf-export-inputs')),report=await download(reportButton);
    assert.equal(Object.hasOwn(archive,'result'),false);
    assert.equal(report.result.investmentNpvSar,expected.investmentNpvSar);
    assert.equal(report.transactionAuthorized,false);
    assert.equal(restoreDcfStudy(report,{expectedAssetClass:assetClass}).resultsRestored,false);
    const forged=JSON.parse(JSON.stringify(report));forged.result.investmentNpvSar=999999999;
    const {sha256,...body}=forged;forged.sha256=sha256Hex(JSON.stringify(body));
    await importFile(forged);await expect(panel.getByTestId('sector-dcf-file-notice')).toContainText(ar?'رُفض الملف':'File rejected');
    await expect(panel.getByTestId('sector-dcf-result')).toHaveAttribute('data-status',DCF_STATUS.READY);
    for(const file of [archive,report]){
     await importFile(file);await expect(panel.getByTestId('sector-dcf-file-notice')).toContainText(ar?'استُعيدت المدخلات فقط':'Inputs restored only');
     await expect(panel.getByTestId('sector-dcf-result')).toHaveCount(0);await expect(reportButton).toBeDisabled();
     await calc.click();await expect(panel.getByTestId('sector-dcf-result')).toHaveAttribute('data-status',DCF_STATUS.READY);
     const formatted=new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(expected.investmentNpvSar);
     await expect(panel.getByTestId('sector-dcf-metric-npv')).toHaveText(formatted);
    }
    await panel.getByTestId('sector-dcf-propertyIncomeOnly').uncheck();
    await expect(panel.getByTestId('sector-financing-risk')).toHaveCount(0);checks++;
    await expect(panel.getByTestId('sector-dcf-result')).toHaveCount(0);
    await calc.click();await expect(panel.getByTestId('sector-dcf-result')).toHaveAttribute('data-status',DCF_STATUS.HOLD);
    await expect(panel.getByTestId('sector-dcf-metric-npv')).toHaveCount(0);
    await expect(reportButton).toBeDisabled();
    checks+=30;scenarios++;
   }
   await select.selectOption('OTHER');await expect(page.getByTestId('local-sector-operating-research')).toHaveCount(0);await expect(page.getByTestId('fuel-station-operating-research')).toHaveCount(0);await expect(page.getByTestId('sector-property-dcf')).toHaveCount(0);checks+=3;
   assert.deepEqual(errors,[]);checks++;
   const dir=path.join('runtime-evidence','sector-operating-browser',browserName);
   await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,locale+'-'+width+'.png'),fullPage:false});
   console.log('SECTOR_OPERATING_BROWSER_CONFIGURATION=PASS browser='+browserName+' locale='+locale+' width='+width);
  }finally{await ctx.close();}
 }
 }finally{await browser.close();}
 console.log('SECTOR_OPERATING_BROWSER=PASS scenarios='+scenarios+' checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
