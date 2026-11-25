'use strict';
const assert=require('node:assert/strict');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const {evaluateLocalSectorOperations,STATUS}=require('../../src/specialized-assets/local-sector-operating-research');
const hotel={availableRoomNights:36500,occupiedRoomNights:25550,roomsRevenueSar:12775000,foodBeverageRevenueSar:2000000,otherOperatingRevenueSar:225000,departmentalExpensesSar:4000000,undistributedOperatingExpensesSar:3000000,managementAndFranchiseFeesSar:500000,ffeReserveSar:500000};
const industrial={assetId:'SYNTH-01',subtype:'WAREHOUSE',landAreaSqm:2000,builtAreaSqm:1500,netLeasableAreaSqm:1200,clearHeightMeters:10,powerCapacityKva:400,leaseStructure:'GROSS',internalInspectionStatus:'NOT_INSPECTED',buildingPermitStatus:'PROVIDED_UNVERIFIED',annualRentSar:600000,landlordExpensesSar:120000};
const cap={capacity:100,usedCapacity:80,annualOperatingRevenueSar:1000000,annualOperatingExpensesSar:700000};
const special={propertyRightRef:'SYNTH-RIGHT',landValueSar:2000000,replacementCostSar:1000000,physicalLossSar:100000,functionalLossSar:50000,externalLossSar:50000,lossCausesDistinct:true,businessAssetsExcluded:true};
const mixed={totalLeasableAreaSqm:1500,commonExpensesSar:50000,sharedExpensesAllocatedOnce:true,segments:[{id:'office',areaSqm:1000,annualPropertyRevenueSar:1000000,annualDirectExpensesSar:100000,propertyIncomeOnly:true},{id:'retail',areaSqm:500,annualPropertyRevenueSar:500000,annualDirectExpensesSar:50000,propertyIncomeOnly:true}]};
const cases=[['HOSPITALITY',hotel,'revParSar','availableRoomNights','sar'],['INDUSTRIAL_LOGISTICS',industrial,'annualRentPerLeasableSqm','netLeasableAreaSqm','sar'],...['HEALTHCARE','EDUCATION','PARKING','DATA_CENTER'].map(c=>[c,cap,'utilizationRate','capacity','pct']),['MIXED_USE',mixed,'declaredNetPropertyIncomeSar','totalLeasableAreaSqm','sar'],['SPECIAL_PURPOSE',special,'remainingImprovementCostSar','replacementCostSar','sar']];
(async()=>{
 const browserName=process.env.STARTAK_BROWSER||'chromium';
 const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true});
 let checks=0,scenarios=0;
 try{
 for(const width of [390,768,1366])for(const locale of ['ar-SA','en']){
  const ar=locale==='ar-SA',ctx=await browser.newContext({viewport:{width,height:900},locale});
  try{
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(l=>localStorage.setItem('startak.presentation.locale',l),locale);
   const url=new URL('/?ownerView=advanced',process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173');
   if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('LOCAL_PREVIEW_REQUIRED');
   await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===url.origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
   await page.goto(url.href);
   const select=page.getByTestId('personal-asset-universe-select'),panel=page.getByTestId('local-sector-operating-research');
   await expect(select).toBeVisible();
   for(const [assetClass,inputs,metric,invalidField,kind] of cases){
    await select.selectOption(assetClass);await expect(panel).toBeVisible();
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    const calc=panel.getByTestId('specialist-calculate');
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
    await panel.getByTestId('specialist-'+invalidField).fill('0');
    await expect(panel.getByTestId('specialist-result')).toHaveCount(0);
    await calc.click();await expect(panel.getByTestId('specialist-result')).toHaveAttribute('data-status',STATUS.HOLD);
    await expect(panel.getByTestId('specialist-metric-'+metric)).toHaveCount(0);
    checks+=10;scenarios++;
   }
   await select.selectOption('OTHER');await expect(panel).toHaveCount(0);checks++;
   assert.deepEqual(errors,[]);checks++;
   const dir=path.join('runtime-evidence','sector-operating-browser',browserName);
   await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,locale+'-'+width+'.png'),fullPage:false});
   console.log('SECTOR_OPERATING_BROWSER_CONFIGURATION=PASS browser='+browserName+' locale='+locale+' width='+width);
  }finally{await ctx.close();}
 }
 }finally{await browser.close();}
 console.log('SECTOR_OPERATING_BROWSER=PASS scenarios='+scenarios+' checks='+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
