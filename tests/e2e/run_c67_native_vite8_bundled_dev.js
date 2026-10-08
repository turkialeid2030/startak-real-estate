'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');

const BASE=process.env.STARTAK_C67_URL||'http://127.0.0.1:4175';
async function main(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:960},locale:'ar-SA'});
  const page=await context.newPage();
  const errors=[],failed=[],csp=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',req=>failed.push(req.url()+':'+req.failure()?.errorText));
  page.on('console',msg=>{if(msg.type()==='error')csp.push(msg.text());});
  try{
    const response=await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});
    assert(response?.ok(),'Native dev server did not return a successful index page');
    await expect(page.getByTestId('compliance-boundary-notice')).toBeVisible({timeout:45000});
    await expect(page.getByTestId('valuation-v1-panel')).toBeVisible({timeout:45000});
    await expect(page.getByTestId('compliance-short-notice')).toContainText('غير مرخص');
    await expect(page.locator('html')).toHaveAttribute('lang','ar-SA');
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await page.getByTestId('startak-mode-land').click();
    const land=page.getByTestId('land-development-institutional-hold');
    await expect(land).toHaveAttribute('data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
    await expect(land.locator('li')).toHaveCount(4);
    const runtime=await page.evaluate(()=>({
      metadata:window.__STARTAK_RUNTIME_METADATA__,
      scripts:[...document.scripts].map(s=>s.src),
      rootChildren:document.querySelector('#root')?.childElementCount||0,
      hasInjectedWindowRequire:Object.prototype.hasOwnProperty.call(window,'require'),
    }));
    assert(runtime.rootChildren>0,'React root is empty in actual native bundled dev');
    assert(!runtime.metadata?.productionDeploymentAuthorized,'Source dev must not authorize production');
    assert.equal(runtime.hasInjectedWindowRequire,false,'Global require shim is forbidden');
    assert(runtime.scripts.some(s=>s.includes('/bundledDevClient.mjs')),'Native Vite 8 bundledDev must serve its real development client, not production preview');
    assert.deepEqual(errors,[],'Browser errors: '+errors.join('; '));
    assert.deepEqual(failed,[],'Network failures: '+failed.join('; '));
    assert(!csp.some(s=>/require is not defined|Could not resolve|Unhandled/i.test(s)),
      'Bundled dev emitted require/resolution errors: '+csp.join('; '));
    console.log('C67_REAL_NATIVE_VITE8_BUNDLED_DEV_REACT_BOOT=PASS');
    console.log('C67_REAL_NATIVE_BUNDLED_DEV_C64_LAND_AUTHORITY_HOLD=PASS');
    console.log('C67_NO_BROWSER_REQUIRE_SHIM=TRUE');
    console.log('C67_HMR_EDIT_CYCLE_INDEPENDENTLY_QUALIFIED=FALSE');
    console.log('C67_INDEPENDENT_SAUDI_SOURCE_AND_LICENSE_VERIFIED=FALSE');
  }catch(e){
    const snapshot=await page.evaluate(()=>({
      title:document.title,root:document.querySelector('#root')?.innerHTML.slice(0,1200),
      text:document.body?.innerText.slice(0,2100),
      scripts:[...document.scripts].map(s=>s.src),
    })).catch(x=>({introspectionError:String(x)}));
    console.error('C67_NATIVE_BUNDLED_DEV_DIAGNOSTIC='+JSON.stringify({snapshot,errors,failed,csp,error:String(e)}));
    throw e;
  }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
