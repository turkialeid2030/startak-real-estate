'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const url=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({locale:'ar-SA',viewport:{width:1360,height:1000}});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await expect(page.getByTestId('compliance-boundary-notice')).toBeVisible({timeout:18000});
  await page.getByTestId('startak-mode-land').click();
  const hold=page.getByTestId('land-development-institutional-hold');
  await expect(hold).toBeVisible();
  await expect(hold).toHaveAttribute('data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
  await expect(hold).toContainText('التقييم المؤسسي للأرض والتطوير: معلّق.');
  await expect(hold).toContainText('تقديرات مالية أولية');
  await expect(hold.locator('li')).toHaveCount(4);
  assert(!(await hold.innerText()).includes('محتوى واجهة غير معرّب'));
  console.log('C64_REAL_CHROMIUM_LAND_MODE_HOLD=PASS');

  await page.locator('button[title="الصفقات المحفوظة"]').click();
  const dialog=page.getByRole('dialog',{name:'الصفقات'});
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('اسم الصفقة...').fill('أرض اختبار متصفح ٦٤');
  await dialog.getByRole('button',{name:'حفظ',exact:true}).click();
  const saved=dialog.getByRole('button',{name:'أرض اختبار متصفح ٦٤'});
  try{await expect(saved).toBeVisible({timeout:15000});}
  catch(e){
   console.error('C64_LAND_SAVE_DIAGNOSTIC='+JSON.stringify({
    dialogText:await dialog.innerText(),
    localIndex:await page.evaluate(()=>localStorage.getItem('deals-index')),
   }));throw e;
  }
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button[title="الصفقات المحفوظة"]').click();
  const restored=page.getByRole('dialog',{name:'الصفقات'});
  await restored.getByRole('button',{name:'أرض اختبار متصفح ٦٤'}).click();
  await expect(page.getByTestId('startak-mode-land')).toBeVisible();
  const post=page.getByTestId('land-development-institutional-hold');
  await expect(post).toBeVisible();
  await expect(post).toHaveAttribute('data-c64-status','HOLD_LAND_DEVELOPMENT_INSTITUTIONAL_EVIDENCE');
  await expect(post).toContainText('التحقق المستقل من صفقات بيع أراضٍ سعودية');
  assert.deepEqual(errors,[],'uncaught browser errors: '+errors.join(' | '));
  console.log('C64_REAL_CHROMIUM_LAND_SAVED_RELOADED_WITH_HOLD=PASS');
  console.log('C64_REAL_HUMAN_UAT_AND_OFFICIAL_REPORT=FALSE');
 }catch(err){
  const info=await page.evaluate(()=>({bodyText:document.body?.innerText.slice(-2500),lang:document.documentElement.lang,mode:document.querySelector('[data-testid="land-development-institutional-hold"]')?.getAttribute('data-c64-status')})).catch(()=>({}));
  console.error('C64_BROWSER_FAILURE='+JSON.stringify({info,errors,error:String(err)}));
  throw err;
 }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
