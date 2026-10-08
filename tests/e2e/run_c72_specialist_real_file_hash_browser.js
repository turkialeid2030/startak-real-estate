'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium,expect}=require('@playwright/test');

const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const ASSETS=[
 {cls:'HOSPITALITY',subtype:'HOTEL_FULL_SERVICE',name:'أدلة فندق ٧٢'},
 {cls:'INDUSTRIAL_LOGISTICS',subtype:'WAREHOUSE',name:'أدلة مستودع ٧٢'},
];
const pdfA=Buffer.from('%PDF-1.4\n1 0 obj\nC72_PRIVATE_CONTENT_ALPHA\nendobj\n');
const pdfB=Buffer.from('%PDF-1.4\n1 0 obj\nC72_PRIVATE_CONTENT_BRAVO\nendobj\n');
function sha(b){return createHash('sha256').update(b).digest('hex');}
async function configure(page,asset){
 const panel=page.getByTestId('valuation-v1-panel');
 await expect(panel).toBeVisible({timeout:26000});
 await panel.getByTestId('valuation-v1-configure').click();
 await panel.getByLabel('معرّف المشروع',{exact:true}).fill('C72-REAL-'+asset.cls);
 await panel.getByLabel('فئة الأصل',{exact:true}).selectOption(asset.cls);
 await panel.getByLabel('مرحلة دورة الحياة',{exact:true}).selectOption('STABILIZED');
 await panel.getByLabel('الاستراتيجية الاستثمارية',{exact:true}).selectOption('CORE_INCOME');
 await panel.getByLabel('نموذج الدخل',{exact:true}).selectOption('LEASE_INCOME');
 await panel.getByLabel('معالجة المصروفات التشغيلية',{exact:true}).selectOption('MARKET_ESTIMATE');
 await panel.getByLabel('أساس القيمة',{exact:true}).selectOption('MARKET_VALUE');
 await panel.getByLabel('العملة',{exact:true}).fill('SAR');
 await panel.getByLabel('تاريخ التقييم',{exact:true}).fill('2026-09-05');
 await panel.getByTestId('valuation-v1-apply').click();
 const intake=page.getByTestId('specialist-intake-panel');
 await expect(intake).toBeVisible();
 await intake.getByTestId('specialist-intake-subtype').selectOption(asset.subtype);
 await intake.getByTestId('specialist-intake-property-ref').fill('العقار المتخصص ٧٢');
 await intake.getByTestId('specialist-intake-as-of').fill('2026-10-08');
 await intake.getByTestId('specialist-intake-evidence-inspection').fill('مرجع معاينة ٧٢');
 await intake.getByTestId('specialist-intake-evidence-zoning').fill('مرجع تخطيط ٧٢');
 await intake.getByTestId('specialist-intake-save').click();
 await expect(intake.getByTestId('specialist-intake-count')).toContainText('2 / 9');
}
async function realFileScenario(browser,asset){
 const ctx=await browser.newContext({locale:'ar-SA',viewport:{width:1440,height:1150}});
 const page=await ctx.newPage(),errors=[],uploads=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',request=>{
  if(!['GET','HEAD','OPTIONS'].includes(request.method()))uploads.push(request.method()+' '+request.url());
 });
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:35000});
  await configure(page,asset);
  const doc=page.getByTestId('specialist-doc-hash-panel');
  await expect(doc).toBeVisible();
  await expect(doc.getByTestId('specialist-doc-hash-count')).toContainText('0 / 9');
  await expect(doc.getByTestId('specialist-doc-file-fireLifeSafety')).toBeDisabled();
  await doc.getByTestId('specialist-doc-file-inspection').setInputFiles({
   name:'C72_PRIVATE_FILENAME_ALPHA.pdf',mimeType:'application/pdf',buffer:pdfA,
  });
  await expect(doc.getByTestId('specialist-doc-fingerprint-inspection')).toContainText(sha(pdfA));
  await expect(doc.getByTestId('specialist-doc-hash-count')).toContainText('1 / 9');
  await expect(doc.getByTestId('specialist-doc-governance')).toHaveAttribute('data-c72-status','HOLD_LOCAL_HASH_NOT_PROVENANCE');
  // Same filename, different BYTES; replace digest, never retain old artifact.
  await doc.getByTestId('specialist-doc-file-inspection').setInputFiles({
   name:'C72_PRIVATE_FILENAME_ALPHA.pdf',mimeType:'application/pdf',buffer:pdfB,
  });
  await expect(doc.getByTestId('specialist-doc-fingerprint-inspection')).toContainText(sha(pdfB));
  await expect(doc.getByTestId('specialist-doc-fingerprint-inspection')).not.toContainText(sha(pdfA));
  await expect(doc.getByTestId('specialist-doc-hash-count')).toContainText('1 / 9');
  // A .pdf extension and PDF MIME must not be enough to permit invalid bytes.
  await doc.getByTestId('specialist-doc-file-zoning').setInputFiles({
   name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('NOT_A_VALID_PDF_HEADER'),
  });
  await expect(doc.getByTestId('specialist-doc-error')).toBeVisible();
  await expect(doc.getByTestId('specialist-doc-hash-count')).toContainText('1 / 9');
  await doc.getByTestId('specialist-doc-file-zoning').setInputFiles({
   name:'zoning.pdf',mimeType:'application/pdf',buffer:pdfA,
  });
  await expect(doc.getByTestId('specialist-doc-fingerprint-zoning')).toContainText(sha(pdfA));
  await expect(doc.getByTestId('specialist-doc-hash-count')).toContainText('2 / 9');
  await expect(page.getByTestId('valuation-institutional-hold')).toHaveAttribute(
   'data-c62-status','HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY');
  await expect(page.getByTestId('specialist-intake-c61-status')).toHaveAttribute(
   'data-c61-status','HOLD_SPECIALIZED_ASSET_EVIDENCE');

  await page.locator('button[title="الصفقات المحفوظة"]').click();
  const dlg=page.getByRole('dialog',{name:'الصفقات'});
  await expect(dlg).toBeVisible();
  await dlg.getByPlaceholder('اسم الصفقة...').fill(asset.name);
  await dlg.getByRole('button',{name:'حفظ',exact:true}).click();
  await expect(dlg.getByRole('button',{name:asset.name})).toBeVisible({timeout:15000});
  const saved=await page.evaluate(()=>Object.entries(localStorage).map(([key,value])=>({key,value}))
    .filter(item=>item.key.includes('deal:')).map(item=>JSON.parse(item.value))
    .find(item=>item.name===assetName),asset.name);
  assert(saved?.valuationCase?.institutionalEvidence?.specialistDocumentManifest,
   'real saved record must contain C72 manifest');
  const record=saved.valuationCase.institutionalEvidence.specialistDocumentManifest;
  assert.equal(record.entries.length,2);
  assert.equal(record.entries.find(e=>e.evidenceType==='inspection').sha256Hex,sha(pdfB));
  assert.equal(record.entries.find(e=>e.evidenceType==='zoning').sha256Hex,sha(pdfA));
  const raw=JSON.stringify(saved);
  assert(!raw.includes('C72_PRIVATE_FILENAME_ALPHA'));
  assert(!raw.includes('C72_PRIVATE_CONTENT_ALPHA'));
  assert(!raw.includes('C72_PRIVATE_CONTENT_BRAVO'));
  assert.deepEqual(uploads,[],'C72 file selection must NOT upload any bytes to network');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('button[title="الصفقات المحفوظة"]').click();
  await page.getByRole('dialog',{name:'الصفقات'}).getByRole('button',{name:asset.name}).click();
  const restored=page.getByTestId('specialist-doc-hash-panel');
  await expect(restored.getByTestId('specialist-doc-hash-count')).toContainText('2 / 9');
  await expect(restored.getByTestId('specialist-doc-fingerprint-inspection')).toContainText(sha(pdfB));
  await expect(restored.getByTestId('specialist-doc-fingerprint-zoning')).toContainText(sha(pdfA));
  await expect(restored.getByTestId('specialist-doc-governance')).toHaveAttribute('data-c72-status','HOLD_LOCAL_HASH_NOT_PROVENANCE');
  await expect(page.getByTestId('valuation-specialist-financial-result'))
   .toContainText('لا توجد قيمة عقارية متخصصة محسوبة أو معتمدة');
  assert.deepEqual(errors,[],'uncaught browser errors');
  console.log('C72_REAL_CHROMIUM_BYTE_HASH_PERSISTENCE_'+asset.cls+'=PASS');
  console.log('C72_FILE_CONTENT_SENT_TO_SERVER_'+asset.cls+'=FALSE');
 }catch(err){
  const state=await page.evaluate(()=>({
   doc:document.querySelector('[data-testid="specialist-doc-hash-panel"]')?.innerText.slice(0,1200),
   intake:document.querySelector('[data-testid="specialist-intake-panel"]')?.innerText.slice(0,700),
   errors:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent).slice(-6),
  })).catch(e=>({introspectionError:String(e)}));
  console.error('C72_BROWSER_DIAGNOSTIC='+JSON.stringify({asset:asset.cls,state,errors,uploads,error:String(err)}));
  throw err;
 }finally{await ctx.close();}
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const asset of ASSETS)await realFileScenario(browser,asset);
 console.log('C72_REAL_SAUDI_SOURCE_AUTHENTICATION=FALSE');
 console.log('C72_REAL_DOCUMENT_UPLOADED_AND_STORED=FALSE');
 console.log('C72_REAL_INDEPENDENT_VALUER_UAT=FALSE');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
