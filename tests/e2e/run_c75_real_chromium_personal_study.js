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
  const displayedInitialStatus=(await panel.getByTestId('c75-personal-status').innerText()).trim();
  ok(displayedInitialStatus.length>0,'personal study shows actual current status');
  console.log('C75_BROWSER_INITIAL_STATUS='+displayedInitialStatus);
  const initial=await download(page,'c75-export-personal-json');
  const first=JSON.parse(initial.content);
  ok(first.purpose==='PERSONAL_INVESTMENT_RESEARCH','real browser exported personal-purpose draft');
  const labels={
   PRELIMINARY_VALUE_CALCULATED:'مؤشر قيمة أولي محسوب',
   METHOD_INDICATIONS_ONLY:'مؤشرات مناهج متاحة للمراجعة',
   SPECIALIST_INPUTS_ONLY:'مسودة بيانات عقار متخصص',
   INPUTS_REQUIRED:'المدخلات غير مكتملة',
  };
  ok(displayedInitialStatus===labels[first.reportStatus],
   'download matches the visible localized research status');
  if(first.reportStatus!=='PRELIMINARY_VALUE_CALCULATED'){
   ok(first.preliminaryValue===null,'no calculator output is invented for incomplete stage');
  }else{
   ok(typeof first.preliminaryValue==='number'&&Number.isFinite(first.preliminaryValue),
    'calculated preliminary value requires a finite numeric result');
  }
  ok(first.professionalAppraisalClaim===false&&first.transactionAuthorityClaim===false,
   'no official appraisal/transaction claim');
  ok(initial.file.suggestedFilename().endsWith('.json'),'JSON actually downloaded locally');
  const initialHtml=await download(page,'c75-export-personal-html');
  ok(initialHtml.file.suggestedFilename().endsWith('.html'),'HTML actually downloaded locally');
  ok(initialHtml.content.includes('dir="rtl"')&&initialHtml.content.includes('دراسة استثمار عقاري شخصية'),
   'downloaded HTML is Arabic RTL');
  ok(!initialHtml.content.includes('<script'),'download has no active script');
  // Mainline's existing valuation editor is covered by its legacy runtime
  // architectural tests. This browser job probes only the NEW personal
  // export surface, without coupling to unrelated workspace form fields.
  await expect(page.getByTestId('valuation-v1-panel')).toBeVisible();
  const again=await download(page,'c75-export-personal-json');
  const second=JSON.parse(again.content);
  ok(second.purpose==='PERSONAL_INVESTMENT_RESEARCH',
   'repeat personal export works without enterprise approval');
  ok(second.preliminaryValue===null,'no fabricated value on repeated personal draft');
  ok(errors.length===0,'no React page exceptions occurred');
  console.log('C75_REAL_CHROMIUM_PERSONAL_EXPORT=PASS checks='+checks);
  console.log('C75_INITIAL_AND_REPEAT_JSON_PLUS_ARABIC_HTML_DOWNLOADED=TRUE');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('C75_REAL_CHROMIUM_PERSONAL_EXPORT=FAIL',e);process.exitCode=1;});
