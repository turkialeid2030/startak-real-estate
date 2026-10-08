'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const ORIGIN=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const CASES=[
 {classId:'HOSPITALITY',name:'فندق اختبار ٦٩',unique:'فصل قيمة العقار عن الشهرة'},
 {classId:'INDUSTRIAL_LOGISTICS',name:'مستودع اختبار ٦٩',unique:'تحمل الأرضية الصناعية'},
];
async function caseTest(browser,item){
 const ctx=await browser.newContext({locale:'ar-SA',viewport:{width:1440,height:1000}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(ORIGIN,{waitUntil:'domcontentloaded',timeout:45000});
  const panel=page.getByTestId('valuation-v1-panel');
  await expect(panel).toBeVisible({timeout:22000});
  await panel.getByTestId('valuation-v1-configure').click();
  await panel.getByLabel('معرّف المشروع',{exact:true}).fill('C69-SPECIALIST-'+item.classId);
  await panel.getByLabel('فئة الأصل',{exact:true}).selectOption(item.classId);
  await panel.getByLabel('مرحلة دورة الحياة',{exact:true}).selectOption('STABILIZED');
  await panel.getByLabel('الاستراتيجية الاستثمارية',{exact:true}).selectOption('CORE_INCOME');
  await panel.getByLabel('نموذج الدخل',{exact:true}).selectOption('LEASE_INCOME');
  await panel.getByLabel('معالجة المصروفات التشغيلية',{exact:true}).selectOption('MARKET_ESTIMATE');
  await panel.getByLabel('أساس القيمة',{exact:true}).selectOption('MARKET_VALUE');
  await panel.getByLabel('العملة',{exact:true}).fill('SAR');
  await panel.getByLabel('تاريخ التقييم',{exact:true}).fill('2026-09-05');
  await panel.getByTestId('valuation-v1-apply').click();
  await expect(panel.getByTestId('valuation-specialist-hold')).toHaveAttribute('data-specialist-asset',item.classId);
  await expect(panel.getByTestId('valuation-specialist-hold')).toHaveAttribute('data-specialist-status','HOLD_SPECIALIST_METHOD_NOT_WIRED');
  await expect(panel.getByTestId('valuation-specialist-financial-result')).toContainText('لا توجد قيمة عقارية متخصصة محسوبة أو معتمدة');
  await expect(panel.getByTestId('institutional-hold-count')).toContainText('عدد متطلبات التعليق: 6');
  await expect(panel.getByTestId('institutional-hold-reasons')).toContainText(item.unique);
  await expect(panel.getByTestId('valuation-institutional-hold')).toHaveAttribute('data-c62-status','HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
  await expect(panel.getByTestId('institutional-hold-reasons').locator('li')).toHaveCount(6);

  await page.locator('button[title="الصفقات المحفوظة"]').click();
  const dialog=page.getByRole('dialog',{name:'الصفقات'});
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('اسم الصفقة...').fill(item.name);
  await dialog.getByRole('button',{name:'حفظ',exact:true}).click();
  await expect(dialog.getByRole('button',{name:item.name})).toBeVisible({timeout:15000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button[title="الصفقات المحفوظة"]').click();
  await page.getByRole('dialog',{name:'الصفقات'}).getByRole('button',{name:item.name}).click();
  await expect(page.getByTestId('valuation-specialist-hold')).toHaveAttribute('data-specialist-asset',item.classId);
  await expect(page.getByTestId('valuation-institutional-hold')).toHaveAttribute('data-c62-status','HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
  await expect(page.getByTestId('valuation-specialist-financial-result')).toContainText('لا توجد قيمة عقارية متخصصة محسوبة أو معتمدة');
  assert.deepEqual(errors,[],'browser errors: '+errors.join('; '));
  console.log('C69_REAL_CHROMIUM_SPECIALIST_'+item.classId+'_SAVED_HOLD=PASS');
 }catch(e){
  const d=await page.evaluate(()=>({
   val:document.querySelector('[data-testid="valuation-v1-panel"]')?.innerText.slice(0,1200),
   special:document.querySelector('[data-testid="valuation-specialist-hold"]')?.outerHTML.slice(0,1100),
   html:document.documentElement.lang,
  })).catch(x=>({error:String(x)}));
  console.error('C69_BROWSER_FAILURE='+JSON.stringify({asset:item.classId,d,errors,reason:String(e)}));
  throw e;
 }finally{await ctx.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const item of CASES)await caseTest(browser,item);
 console.log('C69_REAL_CHROMIUM_HOTEL_AND_INDUSTRIAL_UAT_SCOPE=AUTOMATED_INTAKE_ONLY');
 console.log('C69_INDEPENDENT_SPECIALIST_HUMAN_UAT=FALSE');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
