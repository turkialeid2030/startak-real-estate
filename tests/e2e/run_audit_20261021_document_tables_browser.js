'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createHash}=require('node:crypto');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {nativeTablePdfFixture}=require('../fixtures/document-table');
let BASE=(process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const DIR='runtime-evidence/remaining-audit';let checks=0,closePreview;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
async function download(page,button){const pending=page.waitForEvent('download');await button.click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
(async()=>{
  await fs.mkdir(DIR,{recursive:true});
  const preview=await require('./local-tls-preview').localTlsPreview(BASE);BASE=preview.url;closePreview=preview.close;
  const policy=(await fs.readFile('public/_headers','utf8')).split('\n').find(l=>l.includes('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
  const results=[];
  for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
    const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
    try{for(const width of [1366,390]){
      const start=checks,context=await browser.newContext({viewport:{width,height:960},locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce',ignoreHTTPSErrors:preview.local});
      await context.addInitScript(()=>localStorage.setItem('startak.locale','ar-SA'));
      const page=await context.newPage(),errors=[],external=[],violations=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(!r.url().startsWith(BASE)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push({url:r.url(),method:r.method()});});
      page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to|wasm/i.test(m.text()))violations.push(m.text());});
      // Apply the actual production CSP to local preview, never relax an
      // existing policy on the public site.
      await context.route(BASE+'/',async route=>{const response=await route.fetch({ignoreHTTPSErrors:preview.local}),headers=response.headers();if(!headers['content-security-policy'])headers['content-security-policy']=policy;await route.fulfill({response,headers});});
      await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
      await expect(page.getByTestId('local-document-evidence-intake')).toBeVisible({timeout:30000});
      const caseId=`SYNTHETIC-TABLE-${name}-${width}`;
      await page.getByTestId('document-case-id').fill(caseId);
      const bytes=nativeTablePdfFixture({pages:2}),digest=createHash('sha256').update(bytes).digest('hex');
      const upload=async(buffer=bytes)=>{
        await page.getByTestId('local-document-file-input').setInputFiles({name:'synthetic-table.pdf',mimeType:'application/pdf',buffer});
        await expect(page.getByTestId('table-page')).toBeVisible({timeout:20000});
      };
      const fillGrid=async()=>{
        await page.getByTestId('table-direction').selectOption('ltr');
        await page.getByTestId('table-rows').fill('١٢٫٥; ٢٢٫٥; ٣٢٫٥; ٤٢٫٥');
        await page.getByTestId('table-columns').fill('0; 36.6666666667; 66.6666666667; 100');
        await page.getByTestId('table-build').click();
      };
      const restore=payload=>page.getByTestId('table-restore-file').setInputFiles({name:'synthetic-grid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
      await upload();await page.getByTestId('table-page').selectOption('2');await fillGrid();
      await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','REVIEW_REQUIRED');checks++;
      await expect(page.getByTestId('table-cell-1-1')).toHaveText('Item');checks++;
      await expect(page.getByTestId('table-cell-2-2')).toHaveText('1234.50');checks++;
      await expect(page.getByTestId('table-cell-2-3')).toHaveAttribute('data-cell-status','EMPTY');checks++;
      await expect(page.getByTestId('table-cell-3-2')).toHaveText('-50.00');checks++;
      const exported=await download(page,page.getByTestId('table-export'));
      ok(exported.table.sourceDigestSha256===digest&&exported.table.caseId===caseId&&exported.table.page===2,'table is bound to actual file, case and selected page');
      ok(!exported.table.financialInputEligible&&!exported.table.sourceAuthenticated&&!exported.table.independentlyVerified,'table export preserves authority and financial boundaries');
      ok(exported.table.cells[5].rawValue===null,'empty source cell is never filled with zero');
      ok(exported.table.cells.flatMap(c=>c.sourceFragments).every(f=>f.sourceAtomId&&f.bounds),'every populated cell has original item coordinates');
      await page.getByTestId('table-preview').click();await expect(page.getByTestId('table-source-preview').locator('svg image')).toHaveCount(1,{timeout:15000});checks++;
      await page.getByTestId('table-cell-2-2').getByRole('button').focus();await page.keyboard.press('Enter');
      await expect(page.getByTestId('selected-atom-preview')).toHaveText('1234.50');checks++;
      ok((await page.getByTestId('evidence-atom-select').inputValue()).includes(':table:'),'keyboard selection chooses the exact table atom in semantic mapping');
      await page.getByTestId('semantic-key-input').fill('synthetic.source.amount');await page.getByTestId('evidence-value-type').selectOption('NUMBER');
      await page.getByTestId('source-reference-input').fill('Synthetic table page 2');await page.getByTestId('reviewer-reference-input').fill('SYNTHETIC-REVIEWER');await page.getByTestId('reviewer-note-input').fill('Source grid checked locally; no independent authority review');
      await page.getByTestId('create-evidence-candidate').click();await expect(page.getByTestId('candidate-truth-status')).toBeVisible();checks++;
      await page.getByTestId('save-evidence-journal').click();await expect(page.getByTestId('saved-evidence-journal')).toBeVisible();
      const journal=await download(page,page.getByTestId('export-evidence-journal')),fact=journal.payload.candidate.fact;
      ok(fact.normalizedValue===1234.50&&fact.rawValue==='1234.50','numeric interpretation is explicit and retains the original string');
      ok(fact.sourceLocator.page===2&&fact.sourceLocator.row===2&&fact.sourceLocator.column===2&&fact.sourceLocator.tableHashSha256===exported.table.tableHashSha256,'saved source journal retains the exact cell and grid');
      ok(fact.truthStatus==='EXTRACTED_EVIDENCE'&&fact.verification.status==='NOT_VERIFIED'&&!journal.payload.candidate.financialEngineEligible,'selected table value remains unverified and outside financial engine');
      await page.getByTestId('document-tables').screenshot({path:`${DIR}/${name}-${width}-document-table.png`});
      await fs.writeFile(`${DIR}/${name}-${width}-document-table.json`,JSON.stringify(exported,null,2));
      await fs.writeFile(`${DIR}/${name}-${width}-document-table-journal.json`,JSON.stringify(journal,null,2));
      await page.getByTestId('table-direction').selectOption('rtl');await expect(page.getByTestId('evidence-candidate-result')).toHaveCount(0);checks++;
      await expect(page.getByTestId('evidence-atom-select')).toHaveValue('');checks++;
      await page.getByTestId('table-build').click();await expect(page.getByTestId('table-cell-1-1')).toHaveText('Note');checks++;
      await restore(exported);await expect(page.getByTestId('table-direction')).toHaveValue('ltr');checks++;
      const restored=await download(page,page.getByTestId('table-export'));ok(JSON.stringify(restored)===JSON.stringify(exported),'source-bound export/restore round trip is exact');
      const forged=JSON.parse(JSON.stringify(exported));forged.table.cells[4].rawValue='999999';await restore(forged);
      await expect(page.getByTestId('table-error')).toHaveAttribute('data-code','TABLE_SOURCE_OR_GRID_MISMATCH');checks++;
      await expect(page.getByTestId('document-table-result')).toHaveCount(0);checks++;
      await restore(exported);await page.getByTestId('table-columns').fill('0; 41.6666666667; 66.6666666667; 100');await page.getByTestId('table-build').click();
      await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','AMBIGUOUS');checks++;
      await expect(page.getByTestId('table-cell-2-2').getByRole('button')).toBeDisabled();checks++;
      await page.getByTestId('table-rows').fill('90; 10');await page.getByTestId('table-build').click();await expect(page.getByTestId('table-error')).toHaveAttribute('data-code','TABLE_GRID_INVALID');checks++;
      await restore(exported);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByTestId('document-tables')).toHaveCount(0);checks++;
      await expect(page.getByTestId('document-case-id')).toBeVisible({timeout:15000});await page.getByTestId('document-case-id').fill(caseId);await upload();
      await expect(page.getByTestId('saved-evidence-journal')).toBeVisible();checks++;
      const reopened=await download(page,page.getByTestId('export-evidence-journal'));ok(reopened.recordHashSha256===journal.recordHashSha256,'selected cell source record survives browser page reload');
      await restore(exported);await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','REVIEW_REQUIRED');checks++;
      await page.getByTestId('document-case-id').fill(caseId+'-OTHER');await expect(page.getByTestId('document-tables')).toHaveCount(0);checks++;
      await upload();await restore(exported);await expect(page.getByTestId('table-error')).toHaveAttribute('data-code','TABLE_SOURCE_OR_GRID_MISMATCH');checks++;
      await upload(nativeTablePdfFixture({merged:true}));await fillGrid();await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','AMBIGUOUS');checks++;
      await upload();await page.getByTestId('table-direction').selectOption('ltr');await page.getByTestId('table-propose').click();
      await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','REVIEW_REQUIRED');checks++;
      const proposed=await download(page,page.getByTestId('table-export'));ok(proposed.table.rowCount===3&&proposed.table.columnCount===3,'actual native text produces a proposed 3-by-3 alignment grid');
      // Actual raster OCR with separated columns; no injected worker result or
      // hidden text layer. All source pixels and expected strings are synthetic.
      const png=Buffer.from(await page.evaluate(()=>{
        const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=450;
        const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1200,450);c.fillStyle='black';c.font='56px Arial';
        [['RENT','1234.50','SAR'],['COST','50.25','SAR'],['TOTAL','1284.75','SAR']].forEach((row,r)=>row.forEach((text,col)=>c.fillText(text,50+col*400,110+r*150)));
        return canvas.toDataURL('image/png').split(',')[1];
      }),'base64');
      await page.getByTestId('local-document-file-input').setInputFiles({name:'synthetic-table.png',mimeType:'image/png',buffer:png});
      await expect(page.getByTestId('local-ocr-start')).toBeVisible();await page.getByTestId('local-ocr-start').click();
      await expect(page.getByTestId('table-page')).toBeVisible({timeout:65000});
      const ocrExtract=await download(page,page.getByTestId('local-ocr-export'));
      await fs.writeFile(`${DIR}/${name}-${width}-table-ocr-raw.json`,JSON.stringify(ocrExtract,null,2));
      await fs.writeFile(`${DIR}/${name}-${width}-table-ocr-source.png`,png);
      await page.getByTestId('table-direction').selectOption('ltr');await page.getByTestId('table-rows').fill('0; 33.3333333333; 66.6666666667; 100');await page.getByTestId('table-columns').fill('0; 33.3333333333; 66.6666666667; 100');await page.getByTestId('table-build').click();
      await expect(page.getByTestId('document-table-result')).toHaveAttribute('data-status','REVIEW_REQUIRED');checks++;
      const ocrTable=await download(page,page.getByTestId('table-export'));
      await fs.writeFile(`${DIR}/${name}-${width}-table-ocr.json`,JSON.stringify(ocrTable,null,2));
      ok(JSON.stringify(ocrTable.table.cells.map(c=>c.rawValue))===JSON.stringify(['RENT','1234.50','SAR','COST','50.25','SAR','TOTAL','1284.75','SAR']),'actual OCR words retain exact synthetic decimal columns');
      ok(ocrTable.table.units==='PIXEL'&&ocrTable.table.cells.flatMap(c=>c.sourceFragments).every(f=>f.granularity==='WORD'&&Number.isFinite(f.confidence)),'table cells preserve actual OCR word boxes and confidence values');
      await page.getByTestId('table-cell-1-2').getByRole('button').click();await expect(page.getByTestId('selected-atom-preview')).toHaveText('1234.50');checks++;
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'table controls, source preview and cell grid fit viewport');
      ok(errors.length===0,'no runtime errors: '+errors.join(' | '));ok(external.length===0,'no external document requests or uploads');ok(violations.length===0,'table workflows preserve production CSP');
      results.push({engine:name,width,checks:checks-start,errors,externalRequests:external,policyViolations:violations,physicalDevice:false});
      await context.close();
    }}finally{await browser.close();}
  }
  await fs.writeFile(DIR+'/document-tables-acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,contexts:results,
    independentExtractionAccuracyQualified:false,sourceAuthenticationQualified:false,financialAdoptionAuthorized:false},null,2));
  console.log(`DOCUMENT_TABLES_BROWSER=PASS checks=${checks}`);
})().catch(async error=>{console.error(error);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/document-tables-failure.json',JSON.stringify({checksCompleted:checks,error:error.message},null,2));process.exitCode=1;}).finally(async()=>{await closePreview?.();});
