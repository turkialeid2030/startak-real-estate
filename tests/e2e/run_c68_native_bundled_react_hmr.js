'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');

const url=process.env.STARTAK_C68_URL||'http://127.0.0.1:4176';
const filename=path.join(__dirname,'../../src/components/LandDevelopmentInstitutionalNotice.jsx');
const oldTitle="status:'التقييم المؤسسي للأرض والتطوير: معلّق.',";
const newTitle="status:'التقييم المؤسسي للأرض والتطوير: معلّق — اختبار تحديث حي.',";

async function main(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({locale:'ar-SA',viewport:{width:1440,height:970}});
  const page=await context.newPage();
  let loads=0;
  const pageErrors=[];
  page.on('load',()=>loads++);
  page.on('pageerror',e=>pageErrors.push(String(e)));
  let edited=false;
  const original=fs.readFileSync(filename,'utf8');
  assert(original.includes(oldTitle),'C68 cannot locate the production Valuation V1 title anchor');
  assert(!original.includes(newTitle),'C68 editable fixture must be clean before testing');
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    await expect(page.getByTestId('valuation-v1-panel')).toBeVisible({timeout:45000});
    await page.getByTestId('startak-mode-land').click();
    await expect(page.getByTestId('land-development-institutional-hold')).toHaveAttribute(
      'data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
    const initialLoadCount=loads;
    assert(initialLoadCount>=1,'Browser did not record an initial navigation');
    fs.writeFileSync(filename,original.replace(oldTitle,newTitle),'utf8');
    edited=true;
    await expect(page.getByTestId('land-development-institutional-hold'))
      .toContainText('التقييم المؤسسي للأرض والتطوير: معلّق — اختبار تحديث حي.',{timeout:45000});
    assert.equal(loads,initialLoadCount,
      'React title changed through full page reload instead of hot module replacement');
    await expect(page.getByTestId('land-development-institutional-hold')).toHaveAttribute(
      'data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
    assert.deepEqual(pageErrors,[],'Source HMR caused browser page errors');
    console.log('C68_REAL_NATIVE_VITE_BUNDLED_REACT_HMR_WITHOUT_RELOAD=PASS');
    console.log('C68_LAND_AUTHORITY_HOLD_PERSISTS_AFTER_HMR=PASS');
  }catch(e){
    const diagnostic=await page.evaluate(()=>({
      html:document.querySelector('[data-testid="land-development-institutional-hold"]')?.innerText.slice(0,650),
      land:document.querySelector('[data-testid="land-development-institutional-hold"]')?.getAttribute('data-c64-status'),
      nav:performance.getEntriesByType('navigation').map(n=>n.type),
    })).catch(x=>({introspection:String(x)}));
    console.error('C68_NATIVE_REACT_HMR_DIAGNOSTIC='+JSON.stringify({
      loads,pageErrors,diagnostic,error:String(e),
    }));
    throw e;
  }finally{
    if(edited)fs.writeFileSync(filename,original,'utf8');
    await context.close();await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
