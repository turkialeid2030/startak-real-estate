'use strict';
const assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const cases=[
 {cls:'HOSPITALITY',subtype:'HOTEL_FULL_SERVICE',title:'ملف فندق مراجعة ٧٠'},
 {cls:'INDUSTRIAL_LOGISTICS',subtype:'WAREHOUSE',title:'ملف مستودع مراجعة ٧٠'},
];
async function trial(browser,test){
 const ctx=await browser.newContext({viewport:{width:1440,height:1050},locale:'ar-SA'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});
  const v=page.getByTestId('valuation-v1-panel');
  await expect(v).toBeVisible({timeout:25000});
  await v.getByTestId('valuation-v1-configure').click();
  await v.getByLabel('معرّف المشروع',{exact:true}).fill('C70-LIVE');
  await v.getByLabel('فئة الأصل',{exact:true}).selectOption(test.cls);
  await v.getByLabel('مرحلة دورة الحياة',{exact:true}).selectOption('STABILIZED');
  await v.getByLabel('الاستراتيجية الاستثمارية',{exact:true}).selectOption('CORE_INCOME');
  await v.getByLabel('نموذج الدخل',{exact:true}).selectOption('LEASE_INCOME');
  await v.getByLabel('معالجة المصروفات التشغيلية',{exact:true}).selectOption('MARKET_ESTIMATE');
  await v.getByLabel('أساس القيمة',{exact:true}).selectOption('MARKET_VALUE');
  await v.getByLabel('العملة',{exact:true}).fill('SAR');
  await v.getByLabel('تاريخ التقييم',{exact:true}).fill('2026-09-05');
  await v.getByTestId('valuation-v1-apply').click();
  const intake=page.getByTestId('specialist-intake-panel');
  await expect(intake).toBeVisible();
  await intake.getByTestId('specialist-intake-subtype').selectOption(test.subtype);
  await intake.getByTestId('specialist-intake-property-ref').fill('مرجع العقار ٧٠');
  await intake.getByTestId('specialist-intake-as-of').fill('2026-10-08');
  for(const [key,label] of [
   ['zoning','مرجع تخطيط ١'],['titleInterest','مرجع صك ٢'],['inspection','مرجع معاينة ٣']
  ])await intake.getByTestId('specialist-intake-evidence-'+key).fill(label);
  await intake.getByTestId('specialist-intake-save').click();
  await expect(intake.getByTestId('specialist-intake-count')).toContainText('3 / 9');
  await expect(intake.getByTestId('specialist-intake-c61-status'))
   .toHaveAttribute('data-c61-status','HOLD_SPECIALIZED_ASSET_EVIDENCE');
  await expect(page.getByTestId('valuation-specialist-hold'))
   .toHaveAttribute('data-specialist-status','HOLD_SPECIALIST_METHOD_NOT_WIRED');
  await expect(page.getByTestId('valuation-institutional-hold'))
   .toHaveAttribute('data-c62-status','HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');

  // Malicious hyperlink-style references never enter the saved draft.
  await intake.getByTestId('specialist-intake-evidence-zoning').fill('https://unsafe.test');
  await intake.getByTestId('specialist-intake-save').click();
  await expect(intake.getByTestId('specialist-intake-error')).toBeVisible();
  await expect(intake.getByTestId('specialist-intake-count')).toContainText('3 / 9');
  await intake.getByTestId('specialist-intake-evidence-zoning').fill('مرجع تخطيط ١');

  await page.locator('button[title="الصفقات المحفوظة"]').click();
  const dlg=page.getByRole('dialog',{name:'الصفقات'});
  await expect(dlg).toBeVisible();
  await dlg.getByPlaceholder('اسم الصفقة...').fill(test.title);
  await dlg.getByRole('button',{name:'حفظ',exact:true}).click();
  await expect(dlg.getByRole('button',{name:test.title})).toBeVisible({timeout:18000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button[title="الصفقات المحفوظة"]').click();
  await page.getByRole('dialog',{name:'الصفقات'}).getByRole('button',{name:test.title}).click();
  const saved=page.getByTestId('specialist-intake-panel');
  await expect(saved).toBeVisible();
  await expect(saved.getByTestId('specialist-intake-subtype')).toHaveValue(test.subtype);
  await expect(saved.getByTestId('specialist-intake-property-ref')).toHaveValue('مرجع العقار ٧٠');
  await expect(saved.getByTestId('specialist-intake-evidence-titleInterest')).toHaveValue('مرجع صك ٢');
  await expect(saved.getByTestId('specialist-intake-count')).toContainText('3 / 9');
  await expect(saved.getByTestId('specialist-intake-c61-status'))
    .toHaveAttribute('data-c61-status','HOLD_SPECIALIZED_ASSET_EVIDENCE');
  await expect(page.getByTestId('valuation-specialist-financial-result'))
    .toContainText('لا توجد قيمة عقارية متخصصة محسوبة أو معتمدة');
  await expect(page.getByTestId('valuation-institutional-hold'))
   .toHaveAttribute('data-c62-status','HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
  assert.deepEqual(errors,[],'uncaught browser errors: '+errors.join(' | '));
  console.log('C70_REAL_CHROMIUM_'+test.cls+'_REFERENCE_SAVE_RESTORE_C61_HOLD=PASS');
 }catch(e){
  const ctxSnapshot=await page.evaluate(()=>({
   html:document.querySelector('[data-testid="specialist-intake-panel"]')?.innerText.slice(0,1200),
   val:document.querySelector('[data-testid="valuation-specialist-hold"]')?.innerText.slice(0,650),
   code:document.querySelector('[data-testid="specialist-intake-c61-status"]')?.getAttribute('data-c61-status'),
  })).catch(x=>({error:String(x)}));
  console.error('C70_BROWSER_DIAGNOSTIC='+JSON.stringify({asset:test.cls,ctxSnapshot,errors,error:String(e)}));throw e;
 }finally{await ctx.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const tc of cases)await trial(browser,tc);
 console.log('C70_DOCUMENT_UPLOAD_ACTUALLY_PERFORMED=FALSE');
 console.log('C70_REAL_PROFESSIONAL_HUMAN_UAT=FALSE');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
