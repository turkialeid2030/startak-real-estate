import {preview} from 'vite';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {findChromiumExecutable}=require('../config/paths');
const {pngTextFixture}=require('../fixtures/local-ocr-page');
let server,browser;
function assert(condition,label){if(!condition)throw Error(label);}
const checks=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};
try {
 server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:false}});
 const url='http://127.0.0.1:'+server.httpServer.address().port+'/';
 browser=await chromium.launch({headless:true,executablePath:findChromiumExecutable(),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage({locale:'ar-SA',viewport:{width:1280,height:900}});
 page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{
  const p='STARTAK_REAL_ESTATE:SAVED_DEALS:';
  localStorage.setItem(p+'deals-index',JSON.stringify([{id:'SYN-CASE-LINK',name:'أصل اختباري'},{id:'SYN-OTHER',name:'أصل مختلف'}]));
  localStorage.setItem(p+'deal:SYN-OTHER',JSON.stringify({id:'SYN-OTHER',name:'أصل مختلف',mode:'building',inputs:{}}));
  localStorage.setItem(p+'deal:SYN-CASE-LINK',JSON.stringify({
   id:'SYN-CASE-LINK',name:'أصل اختباري',mode:'building',inputs:{},
   savedAt:'2026-01-01T00:00:00.000Z'}));
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const work=page.getByTestId('appraisal-assurance-workbench');
 await work.waitFor({state:'visible'});
 await work.getByTestId('appraisal-assurance-toggle').click();
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='REVIEW_REQUIRED','blank status fail-closed');
 pass('Arabic manual workbench mounts with review-only status');
 await work.getByTestId('current-reportId').fill('SYN-001');
 await work.getByTestId('current-valuationDate').fill('2026-01-01');
 await work.getByTestId('current-income-annualNoiSar').fill('٢٬١٠٠٬٠٠٠');
 await work.getByTestId('current-income-capitalizationRatePct').fill('7');
 await work.getByTestId('current-income-indicatedValueSar').fill('55000000');
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='HOLD','arithmetic mismatch must hold');
 assert(await work.getByTestId('appraisal-issues').getByText('INCOME_CAPITALIZATION_MISMATCH').count()>0,'income error not shown');
 assert(!(await work.getByTestId('appraisal-calculated-value').innerText()).includes('—'),'computed value missing');
 pass('Arabic thousands separators compute independent capitalization and detect mismatch');
 await work.getByTestId('current-marketRent-capitalValueBasisSar').fill('7100000');
 await work.getByTestId('current-marketRent-percentOfCapitalValue').fill('5');
 await work.getByLabel('مصدر الإيجار').first().selectOption('CAPITAL_VALUE_PERCENTAGE');
 await work.getByLabel('استُخدم هذا الإيجار نفسه لحساب قيمة أسلوب الدخل').first().check();
 assert(await work.getByTestId('appraisal-issues').getByText('CIRCULAR_VALUATION').count()>0,'circular valuation must be shown');
 pass('circular valuation explicitly blocked');
 await work.getByTestId('current-reported-capitalValueSar').fill('7100000');
 await work.getByTestId('current-reported-marketRentSar').fill('284000');
 await work.getByTestId('appraisal-version-compare').check();
 await work.getByTestId('previous-reportId').fill('SYN-001');
 await work.getByTestId('previous-reported-capitalValueSar').fill('7100000');
 await work.getByTestId('previous-reported-marketRentSar').fill('213000');
 assert(await work.getByTestId('appraisal-version-differences').getByText('DEPENDENT_VALUE_UNCHANGED').count()>0,'version change must be visible');
 pass('same-report version changes detected without value double count');
 const auditSnapshot=()=>work.locator('input,select').evaluateAll(nodes=>nodes.map(x=>({
   id:x.getAttribute('data-testid'),type:x.type,value:x.value,checked:x.checked,
   options:x.tagName==='SELECT'?Array.from(x.options).map(o=>o.value):null,
 })));
 const assertEnglishSystemText=async panel=>assert(await panel.evaluate(node=>{
   const copy=node.cloneNode(true);
   copy.querySelectorAll('[data-user-content],input,textarea,code,script,style').forEach(x=>x.remove());
   return !/[\u0600-\u06ff]/.test(copy.textContent);
 }),'untranslated Arabic system text in English assurance panel');
 const versionSnapshot=await auditSnapshot();
 await page.getByTestId('locale-switch').click();
 assert(await work.getAttribute('dir')==='ltr','audit must use English direction');
 assert((await work.getByTestId('current-reportId').getAttribute('aria-label'))==='Appraisal report ID','accessible audit field label translated');
 assert((await work.getByTestId('appraisal-calculated-value').innerText()).includes('30,000,000 SAR'),'English currency formatting');
 assert(JSON.stringify(await auditSnapshot())===JSON.stringify(versionSnapshot),'language switch changed current/previous report input or evidence choice');
 await assertEnglishSystemText(work);
 const quality=page.getByTestId('valuation-quality-gates');
 assert(await quality.getAttribute('dir')==='ltr','quality gate uses English direction');
 await assertEnglishSystemText(quality);
 assert((await quality.getByTestId('appraisal-report-checklist').innerText()).includes('External review required'),'professional review remains required in English');
 await page.getByTestId('locale-switch').click();
 assert(await work.getAttribute('dir')==='rtl','audit restores Arabic direction');
 assert(JSON.stringify(await auditSnapshot())===JSON.stringify(versionSnapshot),'return to Arabic changed report data');
 pass('D04 current and previous audit inputs, enum values, calculations and HOLD survive AR-EN-AR');
 await work.getByTestId('appraisal-reset').click();
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='REVIEW_REQUIRED','reset should clear material errors');
 assert(await work.getByTestId('current-reportId').inputValue()==='','reset should clear values');
 pass('local data cleared without saving or approving');
 assert((await work.getByText('لا يوجد زر اعتماد أو تصدير تقرير مهني.').count())===1,'professional export boundary absent');
 pass('professional report export unavailable');
 const market=page.getByTestId('location-market-study');
 await market.getByLabel('اسم العقار',{exact:true}).fill('أصل اختباري');
 await market.getByLabel('مساحة الأرض (م²)',{exact:true}).fill('1200.5');
 await market.getByLabel('تاريخ القيمة المطلوب دراستها').fill('2026-01-01');
 await page.getByTestId('local-document-file-input').setInputFiles({
  name:'synthetic-source.png',mimeType:'image/png',buffer:pngTextFixture()
 });
 await page.getByTestId('local-document-digest').waitFor({state:'visible'});
 await work.getByTestId('current-reportId').fill('SYN-LINK-1');
 await work.getByTestId('current-property-name').fill('أصل اختباري');
 await work.getByTestId('current-property-assetType').fill('RESIDENTIAL_COMPOUND');
 await work.getByTestId('current-property-areaSqm').fill('١٬٢٠٠٫٥');
 await work.getByTestId('current-valuationDate').fill('2026-01-01');
 await work.getByTestId('current-income-annualNoiSar').fill('٢٬١٠٠٬٠٠٠');
 await work.getByTestId('current-income-capitalizationRatePct').fill('7');
 await work.getByTestId('current-income-indicatedValueSar').fill('55000000');
 await work.getByTestId('appraisal-confirm-identity').check();
 assert(await work.getByTestId('appraisal-identity-status').getAttribute('data-status')==='MATCHED_USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED','identity should match only by user attestation');
 await work.getByTestId('appraisal-link-to-study').click();
 assert(await market.getByTestId('appraisal-market-link-status').getAttribute('data-status')==='LINKED_AUDIT_HOLD','linked arithmetic HOLD not propagated');
 await market.getByTestId('personal-market-study-export').click();
 await market.getByText(/تم منع تصدير الدراسة/).waitFor({state:'visible'});
 pass('linked source with user-confirmed identical subject blocks research export and value');
 const linkedSnapshot=await auditSnapshot();
 await page.getByTestId('locale-switch').click();
 assert((await work.getByTestId('appraisal-link-message').innerText()).includes('Linked, with value and export held'),'existing linked audit message must translate without relinking');
 assert(await market.getByTestId('appraisal-market-link-status').getAttribute('data-status')==='LINKED_AUDIT_HOLD','English switch cannot clear linked HOLD');
 assert(JSON.stringify(await auditSnapshot())===JSON.stringify(linkedSnapshot),'linked identity declaration changed with language');
 await assertEnglishSystemText(work);
 await page.getByTestId('locale-switch').click();
 assert((await work.getByTestId('appraisal-link-message').innerText()).includes('تم الربط'),'linked message restores Arabic without repeating action');
 pass('D04 linked HOLD, original identity and live action message survive locale changes');
 const personal=page.getByTestId('c75-personal-research-workspace');
 await personal.getByTestId('c75-appraisal-report-hold').waitFor({state:'visible'});
 assert(await personal.getByTestId('c75-export-personal-html').isDisabled(),
   'linked HOLD should disable personal HTML study report');
 assert(await personal.getByTestId('c75-export-personal-json').isDisabled(),
   'linked HOLD should disable personal JSON study report');
 assert((await personal.getByTestId('c75-personal-status').innerText()).includes('HOLD'),
   'a linked audit HOLD should hide report readiness');
 assert((await personal.getByTestId('c75-personal-value').innerText()).trim()==='—',
   'a linked audit HOLD must not display a preliminary report value');
 pass('linked appraisal HOLD quarantines independent HTML and JSON study report UI routes');
 const saved=market.getByTestId('saved-deal-market-study-link');
 await saved.getByRole('button',{name:'تحديث قائمة الصفقات المحفوظة'}).click();
 await saved.getByLabel('اختيار الصفقة لربط دراسة السوق').selectOption('SYN-CASE-LINK');
 await saved.getByLabel('أؤكد أن الدراسة تخص العقار نفسه في الصفقة المختارة (إقرار مستخدم وليس تحققًا من الصك).').check();
 const saveButton=saved.getByRole('button',{name:'حفظ ملحق الدراسة للصفقة المختارة'});
 assert(await saveButton.isDisabled(),'blocked report should disable sidecar save in UI');
 const canonical=await page.evaluate(()=>({
  deal:localStorage.getItem('STARTAK_REAL_ESTATE:SAVED_DEALS:deal:SYN-CASE-LINK'),
  sidecar:localStorage.getItem('STARTAK_REAL_ESTATE:SAVED_DEALS:market-study-sidecar:v1:SYN-CASE-LINK')
 }));
 assert(canonical.sidecar===null&&canonical.deal!==null,'blocked report must not create sidecar or change Saved Deal');
 pass('blocked appraisal prevents local Saved Deal sidecar save and canonical writes');
 await saved.getByLabel('اختيار الصفقة لربط دراسة السوق').selectOption('SYN-OTHER');
 await saved.getByTestId('appraisal-sidecar-name-mismatch').waitFor({state:'visible'});
 assert(await saveButton.isDisabled(),'mismatched Saved Deal name must disable write');
 pass('mismatched Saved Deal cannot be used as alternate target for linked report');
 await saved.getByLabel('اختيار الصفقة لربط دراسة السوق').selectOption('SYN-CASE-LINK');
 await market.getByLabel('مساحة الأرض (م²)',{exact:true}).fill('1200.6');
 await market.locator('[data-testid="appraisal-market-link-status"][data-status="STALE_OR_UNMATCHED_LINK"]').waitFor();
 await market.getByLabel('مساحة الأرض (م²)',{exact:true}).fill('1200.5');
 await market.locator('[data-testid="appraisal-market-link-status"][data-status="STALE_OR_UNMATCHED_LINK"]').waitFor();
 pass('changing subject after linking invalidates link even if amount reverts');
 await work.getByTestId('appraisal-reset').click();
 await market.locator('[data-testid="appraisal-market-link-status"][data-status="NOT_LINKED"]').waitFor();
 pass('explicit reset clears linked audit and no professional certification is granted');
 assert(await personal.getByTestId('c75-export-personal-html').isEnabled(),
   'unlinked legacy personal research export must not stay blocked after reset');
 assert(await personal.getByTestId('c75-export-personal-json').isEnabled(),
   'unlinked legacy personal research JSON should be available after explicit reset');
 pass('reset restores unlinked personal study drafts without professional authorization');
 await work.getByTestId('current-property-assetType').fill('HOTEL');
 await work.getByTestId('appraisal-specialist-fields').waitFor({state:'visible'});
 assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='HOLD',
  'hotel without specialist NOI bridge must remain HOLD');
 assert((await work.getByTestId('appraisal-sector-status').getAttribute('data-status'))==='HOLD_SPECIALIST_EVIDENCE',
  'specialist report status must show missing evidence');
 pass('hotel specialist evidence remains fail-closed without audited inputs');
 for(const type of ['HOTEL','COMMERCIAL_MALL','WAREHOUSE','LOGISTICS_PARK','FUEL_STATION']){
  await work.getByTestId('current-property-assetType').fill(type);
  const sector=work.getByTestId('appraisal-specialist-fields');
  await sector.locator('input[inputmode="decimal"]').first().fill('١٢٣٫٥');
  await sector.getByTestId('sector-specialistReviewRef').fill('مرجع أصلي https://source.invalid/SYNTH-HOLD');
  await sector.locator('input[type="checkbox"]').first().check();
  const before=await auditSnapshot();
  await page.getByTestId('locale-switch').click();
  await assertEnglishSystemText(sector);
  assert(JSON.stringify(await auditSnapshot())===JSON.stringify(before),'specialist field changed on English switch: '+type);
  assert(await work.getByTestId('appraisal-audit-status').getAttribute('data-status')==='HOLD','specialist declaration cannot release HOLD: '+type);
  await page.getByTestId('locale-switch').click();
  assert(JSON.stringify(await auditSnapshot())===JSON.stringify(before),'specialist field changed on Arabic switch: '+type);
 }
 pass('D04 five specialist asset paths retain source references, Arabic amounts, evidence declarations and HOLD');
 console.log('D04_ASSURANCE_REAL_CHROMIUM=PASS source_values_unchanged=true authority_unchanged=true');
 console.log('APPRAISAL_BROWSER_SMOKE=PASS CASES='+checks.length);
} catch(e) {
 console.error('APPRAISAL_BROWSER_SMOKE=FAIL: '+(e.stack||e.message));
 process.exitCode=1;
} finally {
 if(browser)await browser.close();
 if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}
