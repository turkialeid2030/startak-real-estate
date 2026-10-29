'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {chromium,expect}=require('@playwright/test');
const {ALL_SECTORS}=require('../../src/governance/personal-asset-universe');
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({locale:'ar-SA',viewport:{width:1366,height:960},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  const universe=page.getByTestId('personal-asset-universe-panel');
  await expect(universe).toBeVisible({timeout:30000});
  await expect(universe).toHaveAttribute('dir','rtl');
  const independent=universe.getByTestId('external-three-gates-readiness');
  await expect(independent).toBeVisible();
  await expect(independent).toHaveAttribute('dir','rtl');
  for(const field of ['market','ai','compliance']){
   await expect(independent.getByTestId('external-gate-'+field)).toContainText('معلّق');
  }
  await expect(independent.getByTestId('external-three-gates-authority')).toContainText('لا اعتماد');

  const selector=page.getByTestId('personal-asset-universe-select');
  const classes=Object.keys(ALL_SECTORS);
  assert.equal(classes.length,13,'13 canonical asset classes required for classification smoke');
  assert.equal(await selector.locator('option').count(),classes.length);
  let verified=0;
  for(const assetClass of classes){
   await selector.selectOption(assetClass);
   await expect(selector).toHaveValue(assetClass);
   await expect(universe.getByTestId('personal-asset-route-status')).not.toBeEmpty();
   await expect(universe.getByTestId('personal-asset-sector-evidence')).not.toBeEmpty();
   const workbench=universe.getByTestId('personal-sector-workbench');
   await expect(workbench).toBeVisible();
   await expect(workbench).toHaveAttribute('dir','rtl');
   // Deliberately blank sector input must not produce a fictitious value.
   await workbench.getByTestId('personal-sector-calculate').click();
   await expect(workbench.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
   await expect(workbench.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
   await expect(workbench.getByTestId('personal-sector-reasons')).not.toBeEmpty();
   if(assetClass==='LAND'){
    await expect(universe.getByTestId('personal-phased-development-dcf')).toBeVisible();
   }else{
    await expect(universe.getByTestId('personal-phased-development-dcf')).toHaveCount(0);
   }
   const inputSnapshot=()=>workbench.locator('input,select,textarea').evaluateAll(nodes=>nodes.map(x=>({value:x.value,checked:x.checked})));
   const beforeLocale=await inputSnapshot();
   await page.getByTestId('locale-switch').click();
   await expect(workbench).toHaveAttribute('dir','ltr');
   await expect(selector).toHaveValue(assetClass);
   await expect(workbench.getByTestId('personal-sector-scenario-output')).toContainText('Held due to missing evidence');
   assert.deepEqual(await inputSnapshot(),beforeLocale,'Locale cannot change sector inputs: '+assetClass);
   await expect(workbench.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
   await page.getByTestId('locale-switch').click();
   await expect(workbench).toHaveAttribute('dir','rtl');
   assert.deepEqual(await inputSnapshot(),beforeLocale,'Arabic roundtrip preserves sector inputs: '+assetClass);
   verified++;
  }
  console.log('ALL_13_ASSET_CLASSES_BILINGUAL_ROUNDTRIP=PASS sectors='+verified);
  // The switched sector remounts an empty research case; old HOLD and input must not leak.
  await selector.selectOption('OFFICE');
  await expect(universe.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await expect(universe.getByTestId('personal-limited-interest-dcf')).toBeVisible();
  // P0: live interface must never invent an EXECUTED_SALE from arbitrary
  // owner-entered comparable rows. All other fields are complete to isolate status.
  const marketCase=universe.getByTestId('personal-sector-workbench');
  await marketCase.getByLabel('المدينة',{exact:true}).fill('الرياض');
  await marketCase.getByLabel('الحي العقاري',{exact:true}).fill('الملقا');
  await marketCase.getByLabel('نوع العقار التفصيلي (مثلاً: فندق 4 نجوم)').fill('مكاتب');
  await marketCase.getByLabel('مساحة العقار (م²)').fill('١٬٠٠٠');
  await marketCase.getByLabel('تاريخ الدراسة').fill('2026-10-25');
  await marketCase.getByLabel('الحق العقاري محل التقييم').selectOption('FREEHOLD');
  await marketCase.getByLabel('صفقات مماثلة منفذة').check();
  await marketCase.getByLabel('وحدة المقارنة المناسبة للقطاع').selectOption('SQM');
  for(let i=0;i<3;i++){
   const comp=marketCase.getByTestId('personal-sector-comparable-'+i);
   await comp.getByLabel('رقم الصفقة').fill('SALE'+(i+1));
   await comp.getByLabel('مدينة الصفقة').fill('الرياض');
   await comp.getByLabel('حي الصفقة').fill('الملقا');
   await comp.getByLabel('النوع التفصيلي للصفقة').fill('مكاتب');
   await comp.getByLabel('تاريخ البيع').fill('2026-09-0'+(i+1));
   await comp.getByLabel('السعر لكل وحدة مقارنة مختارة (ريال)').fill('١٠٬٠٠٠');
   await comp.getByLabel('مرجع الصفقة المصدرية').fill('DOC-'+(i+1));
   await comp.getByLabel('وحدة المقارنة في الصفقة').selectOption('SQM');
   await comp.getByLabel('الحق المنقول في الصفقة').selectOption('FREEHOLD');
   if(i<2)await comp.getByTestId('personal-sector-sale-status-'+i).selectOption('EXECUTED_SALE');
  }
  const calculate=marketCase.getByTestId('personal-sector-calculate');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(marketCase.getByTestId('personal-sector-reasons')).toContainText('الصفقات غير متطابقة');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  const status=marketCase.getByTestId('personal-sector-sale-status-2');
  await status.selectOption('ASKING_SALE');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  await status.selectOption('EXECUTED_SALE');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('مؤشرات طرق منفصلة');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('المقارنة السوقية');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('لم يتم التحقق منها رسميًا');

  const buttons=marketCase.getByTestId('personal-sector-report-downloads');
  await expect(buttons).toBeVisible();
  const download=async id=>{
   const pending=page.waitForEvent('download');
   await marketCase.getByTestId(id).click();
   const item=await pending;
   return {filename:item.suggestedFilename(),body:await fs.readFile(await item.path(),'utf8')};
  };
  const research=await download('personal-sector-export-report-json');
  assert.ok(research.filename.endsWith('.json'));
  const report=JSON.parse(research.body);
  assert.equal(report.version,'PERSONAL_SECTOR_RESEARCH_REPORT_V1');
  assert.equal(report.purpose,'PERSONAL_NON_CERTIFIED_SECTOR_RESEARCH');
  assert.equal(report.result.status,'INDIVIDUAL_METHOD_SCENARIOS_ONLY');
  assert.equal(report.studyInputs.comparables[2].saleKind,'EXECUTED_SALE');
  assert.equal(report.result.methods[0].method,'MARKET_COMPARABLE');
  assert.equal(report.result.provisionalReconciledAmountSar,null);
  assert.equal(report.professionalAppraisalClaim,false);
  assert.equal(report.independentlyVerified,false);
  assert.match(report.reportHashSha256,/^[a-f0-9]{64}$/);
  const printable=await download('personal-sector-export-report-html');
  assert.ok(printable.filename.endsWith('.html'));
  assert.ok(printable.body.includes('lang="ar" dir="rtl"'));
  assert.ok(printable.body.includes('MOJ')===false);
  assert.ok(printable.body.includes('DOC-3')&&printable.body.includes('EXECUTED_SALE'));
  assert.ok(printable.body.includes('المدينة')&&printable.body.includes('الحي')&&
    printable.body.includes('نوع العقار')&&printable.body.includes('الحق العقاري')&&
    printable.body.includes('وحدة المقارنة')&&printable.body.includes('حالة الصفقة'),
    'Production-visible printable comparables must retain all identity dimensions');
  assert.ok(printable.body.includes('الملقا')&&printable.body.includes('FREEHOLD')&&
    printable.body.includes('SQM')&&printable.body.includes('مكاتب'));
  assert.ok(printable.body.includes('متاح مؤشر طريقة واحدة فقط')&&
    printable.body.includes('SECOND_INDEPENDENT_METHOD_NOT_PROVIDED'),
    'Arabic HOLD explanation and stable audit code both required in printed report');
  assert.ok(printable.body.includes('غير مثبت')&&printable.body.includes('إقرارات ومدخلات المستخدم'),
    'Printable report must disclose unverified valuation basis and owner-entered source');

  assert.ok(printable.body.includes(report.inputFingerprintSha256),
   'printable HTML must preserve the same exact study-input SHA as the downloaded JSON');
  assert.ok(!printable.body.includes('<script'));
  await status.selectOption('ASKING_SALE');
  await expect(buttons).toHaveCount(0);
  await calculate.click();
  const blocked=JSON.parse((await download('personal-sector-export-report-json')).body);
  assert.equal(blocked.result.status,'HOLD_INPUT_OR_SECTOR_POLICY');
  assert.equal(blocked.result.methods.length,0);
  assert.equal(blocked.result.provisionalReconciledAmountSar,null);
  assert.equal(blocked.studyInputs.comparables[2].saleKind,'ASKING_SALE');
  assert.equal(blocked.professionalAppraisalClaim,false);
  console.log('C57_OWNER_RESEARCH_REPORTS_LIVE_JSON_HTML_HOLD=PASS');

  // Verify a downloaded report can restore the research INPUTS only.
  // Neither past calculation results nor licensed valuation authority may be reinstated.
  const importFile=async(fileName,body)=>{
   await marketCase.getByTestId('personal-sector-import-case').setInputFiles({
    name:fileName,mimeType:'application/json',
    buffer:Buffer.from(typeof body==='string'?body:JSON.stringify(body),'utf8'),
   });
   return marketCase.getByTestId('personal-sector-archive-status');
  };
  await importFile(research.filename,research.body);
  await expect(marketCase.getByTestId('personal-sector-archive-status')).toContainText('إعادة حساب النتائج');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await expect(marketCase.getByTestId('personal-sector-comparable-2')
    .getByTestId('personal-sector-sale-status-2')).toHaveValue('EXECUTED_SALE');
  await expect(marketCase.getByLabel('المدينة',{exact:true})).toHaveValue('الرياض');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('مؤشرات طرق منفصلة');
  const reissued=JSON.parse((await download('personal-sector-export-report-json')).body);
  assert.equal(reissued.inputFingerprintSha256,report.inputFingerprintSha256);
  assert.equal(reissued.reportStatus,undefined);
  assert.equal(reissued.professionalAppraisalClaim,false);

  // Actual browser V2 archive roundtrip also cannot revive a previous result.
  const caseV2=await download('personal-sector-export-case');
  const v2=JSON.parse(caseV2.body);
  assert.equal(v2.version,'PERSONAL_SECTOR_CASE_ARCHIVE_V2');
  await importFile(caseV2.filename,caseV2.body);
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await expect(marketCase.getByTestId('personal-sector-comparable-2')
    .getByTestId('personal-sector-sale-status-2')).toHaveValue('EXECUTED_SALE');

  // A verified legacy V1 case is readable without silently promoting
  // its unspecified sale status to executed-sale market evidence.
  const legacyState=structuredClone(v2.state);
  for(const c of legacyState.comparables)delete c.saleKind;
  const legacyBody={version:'PERSONAL_SECTOR_CASE_ARCHIVE_V1',
   createdAt:v2.createdAt,state:legacyState};
  const legacy={...legacyBody,
   sha256:createHash('sha256').update(JSON.stringify(legacyBody)).digest('hex')};
  await importFile('legacy-input-v1.json',legacy);
  await expect(marketCase.getByTestId('personal-sector-archive-status')).toContainText('استُعيدت المدخلات');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  await expect(marketCase.getByTestId('personal-sector-comparable-2')
    .getByTestId('personal-sector-sale-status-2')).toHaveValue('');
  await calculate.click();
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  await expect(marketCase.getByTestId('personal-sector-provisional-value')).toHaveCount(0);

  // A modified report is rejected without touching the current case or result.
  const forgedReport=JSON.parse(research.body);
  forgedReport.studyInputs.subject.city='جدة';
  await importFile('forged-owner-report.json',forgedReport);
  await expect(marketCase.getByTestId('personal-sector-archive-status')).toContainText('رُفض الملف');
  await expect(marketCase.getByLabel('المدينة',{exact:true})).toHaveValue('الرياض');
  await expect(marketCase.getByTestId('personal-sector-comparable-2')
    .getByTestId('personal-sector-sale-status-2')).toHaveValue('');
  await expect(marketCase.getByTestId('personal-sector-scenario-output')).toContainText('الحساب محجوب');
  // Restore-to-other-sector is rejected rather than silently changing asset class.
  await selector.selectOption('RETAIL');
  const retailCase=universe.getByTestId('personal-sector-workbench');
  await retailCase.getByTestId('personal-sector-import-case').setInputFiles({
   name:research.filename,mimeType:'application/json',buffer:Buffer.from(research.body),
  });
  await expect(retailCase.getByTestId('personal-sector-archive-status')).toContainText('رُفض الملف');
  await expect(retailCase.getByLabel('المدينة',{exact:true})).toHaveValue('');
  await expect(retailCase.getByTestId('personal-sector-scenario-output')).toHaveCount(0);
  console.log('C57_REAL_BROWSER_REPORT_TO_V1_V2_INPUT_RESTORATION_AND_TAMPER_HOLD=PASS');

  assert.deepEqual(errors,[],'no React browser runtime exceptions across 13 asset classes');
  console.log('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=PASS sectors='+verified);
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('ALL_13_ASSET_CLASSES_REAL_BROWSER_HOLD=FAIL',e);process.exitCode=1;});
