'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium,expect}=require('@playwright/test');
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
let checks=0;
function ok(x,msg){assert.ok(x,msg);checks++;}
async function download(page,selector){
 const pending=page.waitForEvent('download');
 await page.getByTestId(selector).click();
 const file=await pending;
 const downloaded=await file.path();
 const content=await fs.readFile(downloaded,'utf8');
 return {file,content};
}
async function configure(page,asset){
 const panel=page.getByTestId('valuation-v1-panel');
 await panel.getByTestId('valuation-v1-configure').click();
 await panel.getByLabel('معرّف المشروع',{exact:true}).fill('PERSONAL-C75-'+asset);
 await panel.getByLabel('فئة الأصل',{exact:true}).selectOption(asset);
 await panel.getByLabel('مرحلة دورة الحياة',{exact:true}).selectOption('STABILIZED');
 await panel.getByLabel('الاستراتيجية الاستثمارية',{exact:true}).selectOption('CORE_INCOME');
 await panel.getByLabel('نموذج الدخل',{exact:true}).selectOption('LEASE_INCOME');
 await panel.getByLabel('معالجة المصروفات التشغيلية',{exact:true}).selectOption('MARKET_ESTIMATE');
 await panel.getByLabel('أساس القيمة',{exact:true}).selectOption('MARKET_VALUE');
 await panel.getByLabel('العملة',{exact:true}).fill('SAR');
 await panel.getByLabel('تاريخ التقييم',{exact:true}).fill('2026-10-09');
 await panel.getByTestId('valuation-v1-apply').click();
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1366,height:960},locale:'ar-SA',acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  const panel=page.getByTestId('c75-personal-research-workspace');
  await expect(panel).toBeVisible({timeout:25000});
  await expect(panel).toHaveAttribute('dir','rtl');
  ok((await panel.getByTestId('c75-personal-status').innerText()).includes('INPUTS_REQUIRED'),
   'preconfiguration personal study can be created');
  const initial=await download(page,'c75-export-personal-json');
  const first=JSON.parse(initial.content);
  ok(first.purpose==='PERSONAL_INVESTMENT_RESEARCH','real browser exported personal-purpose draft');
  ok(first.preliminaryValue===null,'no calculator output is invented');
  ok(first.professionalAppraisalClaim===false&&first.transactionAuthorityClaim===false,
   'no official appraisal/transaction claim');
  ok(initial.file.suggestedFilename().endsWith('.json'),'JSON actually downloaded locally');
  const initialHtml=await download(page,'c75-export-personal-html');
  ok(initialHtml.file.suggestedFilename().endsWith('.html'),'HTML actually downloaded locally');
  ok(initialHtml.content.includes('dir="rtl"')&&initialHtml.content.includes('دراسة استثمار عقاري شخصية'),
   'downloaded HTML is Arabic RTL');
  ok(!initialHtml.content.includes('<script'),'download has no active script');
  await configure(page,'OFFICE');
  await expect(panel).toBeVisible();
  const office=await download(page,'c75-export-personal-json');
  const parsed=JSON.parse(office.content);
  ok(parsed.assetClass==='OFFICE'&&parsed.projectId==='PERSONAL-C75-OFFICE',
   'office user input flows to personal report');
  ok(parsed.externalGoLiveGateRequiredForPersonalExport===false,
   'enterprise gate does not block personal export');
  ok(parsed.professionalAppraisalClaim===false,'office report not labelled official');
  ok(!!parsed.reportHashSha256,'report contains SHA diagnostic checksum');
  ok(errors.length===0,'no React page exceptions occurred');
  console.log('C75_REAL_CHROMIUM_PERSONAL_EXPORT=PASS checks='+checks);
  console.log('C75_DOCUMENTS_DOWNLOADED_JSON_AND_ARABIC_HTML=TRUE');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('C75_REAL_CHROMIUM_PERSONAL_EXPORT=FAIL',e);process.exitCode=1;});
