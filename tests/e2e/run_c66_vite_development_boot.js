'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const url=process.env.STARTAK_DEV_E2E_URL||'http://127.0.0.1:4174';
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1440,height:1000}});
 const pageErrors=[],failedRequests=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 page.on('requestfailed',r=>failedRequests.push(r.url()+' '+r.failure()?.errorText));
 try {
  const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  assert(res?.ok(),'dev server failed to return page');
  await expect(page.getByTestId('compliance-boundary-notice')).toBeVisible({timeout:45000});
  await expect(page.getByTestId('valuation-v1-panel')).toBeVisible({timeout:45000});
  await page.getByTestId('startak-mode-land').click();
  await expect(page.getByTestId('land-development-institutional-hold')).toBeVisible({timeout:15000});
  await expect(page.getByTestId('land-development-institutional-hold')).toHaveAttribute(
    'data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
  const meta=await page.evaluate(()=>({
   title:document.title,lang:document.documentElement.lang,dir:document.documentElement.dir,
   notice:document.querySelector('[data-testid="compliance-short-notice"]')?.textContent,
   metadata:window.__STARTAK_RUNTIME_METADATA__,
  }));
  assert.equal(meta.lang,'ar-SA');assert.equal(meta.dir,'rtl');
  assert(meta.notice.includes('غير مرخص'));
  assert.equal(meta.metadata?.productionDeploymentAuthorized,false);
  assert.deepEqual(pageErrors,[],pageErrors.join('; '));
  assert.deepEqual(failedRequests,[],failedRequests.join('; '));
  console.log('C66_REAL_VITE_DEVELOPMENT_CHROMIUM_REACT_BOOT=PASS');
  console.log('C66_REAL_VITE_DEVELOPMENT_LAND_HOLD=PASS');
  console.log('C66_REAL_VITE_DEVELOPMENT_NO_GLOBAL_REQUIRE_INJECTION=TRUE');
  console.log('C66_C55_PROFESSIONAL_SAUDI_VALUATION=FALSE');
 } catch(e){
  const state=await page.evaluate(()=>({
   body:document.body?.innerText.slice(0,2800),
   html:document.body?.innerHTML.slice(0,700),
   scripts:[...document.scripts].map(s=>s.src),
   language:document.documentElement.lang,
  })).catch(x=>({inspectFailure:String(x)}));
  console.error('C66_DEV_BROWSER_DIAGNOSTIC='+JSON.stringify({state,pageErrors,failedRequests,error:String(e)}));
  throw e;
 } finally {await page.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
