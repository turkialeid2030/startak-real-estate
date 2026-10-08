'use strict';

const assert=require('node:assert/strict');
const { chromium, expect }=require('@playwright/test');

const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const ASSETS=['OFFICE','RETAIL','RESIDENTIAL'];
const SELECTORS=Object.freeze({
  caseTitle:'ذكاء التقييم العقاري',
  configure:'تهيئة Valuation V1',
  apply:'تطبيق الإعدادات',
  saved:'الصفقات المحفوظة',
  warning:'الاعتماد الاستثماري والتقييم المهني والتصدير الرسمي: معلّق.',
  preliminary:'مؤشر القيمة الحسابي الأولي (غير معتمد)',
  blocked:'حساب أولي — اعتماد مؤسسي معلّق',
});

async function configure(page,assetClass){
  await page.getByRole('button',{name:SELECTORS.configure}).click();
  await page.getByLabel('معرّف المشروع',{exact:true}).fill('C63-'+assetClass+'-BROWSER');
  await page.getByLabel('فئة الأصل',{exact:true}).selectOption(assetClass);
  await page.getByLabel('مرحلة دورة الحياة',{exact:true}).selectOption('STABILIZED');
  await page.getByLabel('الاستراتيجية الاستثمارية',{exact:true}).selectOption('CORE_INCOME');
  await page.getByLabel('نموذج الدخل',{exact:true}).selectOption('LEASE_INCOME');
  await page.getByLabel('معالجة المصروفات التشغيلية',{exact:true}).selectOption('MARKET_ESTIMATE');
  await page.getByLabel('أساس القيمة',{exact:true}).selectOption('MARKET_VALUE');
  await page.getByLabel('العملة',{exact:true}).fill('SAR');
  await page.getByLabel('تاريخ التقييم',{exact:true}).fill('2026-09-05');
  await page.getByRole('button',{name:SELECTORS.apply}).click();
}

async function checkRuntime(page){
  await expect(page.getByText(SELECTORS.warning,{exact:false})).toBeVisible();
  await expect(page.getByText(SELECTORS.preliminary,{exact:true})).toBeVisible();
  await expect(page.getByText(SELECTORS.blocked,{exact:true})).toBeVisible();
  await expect(page.getByText('HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY',{exact:false})).toBeVisible();
  await expect(page.getByText('Valuation V1',{exact:true})).toBeVisible();
}

async function doSavedDealRoundtrip(page,assetClass){
  await page.locator('button[title="'+SELECTORS.saved+'"]').click();
  const dialog=page.getByRole('dialog',{name:'الصفقات'});
  await expect(dialog).toBeVisible();
  const name='C63-PW-'+assetClass;
  await dialog.getByPlaceholder('اسم الصفقة...').fill(name);
  await dialog.getByRole('button',{name:'حفظ',exact:true}).click();
  const saved=dialog.getByRole('button',{name});
  await expect(saved).toBeVisible({timeout:10000});
  // Reload is a real new browser document; no in-memory React state may satisfy it.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button[title="'+SELECTORS.saved+'"]').click();
  const restoredDialog=page.getByRole('dialog',{name:'الصفقات'});
  await restoredDialog.getByRole('button',{name}).click();
  await checkRuntime(page);
  // Saved case carries draft evidence, never independent appraisal authority.
  await expect(page.getByText(SELECTORS.warning,{exact:false})).toBeVisible();
  console.log('C63_REAL_CHROMIUM_SAVE_RELOAD_'+assetClass+'=PASS');
}

async function scenario(browser,assetClass){
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ar-SA'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  try{
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await expect(page.getByText(SELECTORS.caseTitle,{exact:true})).toBeVisible({timeout:25000});
    await expect(page.getByText('المسار الحالي فقط',{exact:true})).toBeVisible();
    await configure(page,assetClass);
    await checkRuntime(page);
    await doSavedDealRoundtrip(page,assetClass);
    assert.deepEqual(errors,[],'uncaught browser errors: '+errors.join(' | '));
    console.log('C63_REAL_CHROMIUM_UI_'+assetClass+'=PASS');
  }catch(error){
    console.error('C63_REAL_CHROMIUM_UI_'+assetClass+'=FAIL: '+error.stack);
    try{await page.screenshot({path:'/tmp/c63-failure-'+assetClass.toLowerCase()+'.png',fullPage:true});}catch{}
    throw error;
  }finally{await context.close();}
}

async function main(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const asset of ASSETS)await scenario(browser,asset);
    console.log('C63_REAL_CHROMIUM_BROWSER_EXECUTED=TRUE');
    console.log('C63_REAL_CHROMIUM_EXISTING_BUILDING_CLASSES=3');
    console.log('C63_LAND_HOTEL_INDUSTRIAL_MIXED_USE_BROWSER_VALIDATED=FALSE');
    console.log('C63_REAL_HUMAN_UAT_COMPLETED=FALSE');
    console.log('C63_INDEPENDENT_SAUDI_MARKET_ACCURACY=FALSE');
  }finally{await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
