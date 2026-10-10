'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {pdfFixture}=require('../fixtures/bounded-pdf');
const gold=require('../reference/RE-GOLD-baseline.json');
const ar=require('../../src/i18n/locales/ar-SA');
const {verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {readLocalReviewJournal}=require('../../src/storage/local-review-journal');
const namespace=require('../../src/storage/browser-local-storage-provider').NAMESPACE;
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const DIR='runtime-evidence/remaining-audit';let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
async function download(page,locator){const pending=page.waitForEvent('download');await locator.click();const file=await pending;return fs.readFile(await file.path(),'utf8');}
(async()=>{
 await fs.mkdir(DIR,{recursive:true});const evidence=[];
 for(const[name,engine]of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}: {})});
  try{for(const viewport of [{width:1366,height:960},{width:390,height:844}]){
   const context=await browser.newContext({viewport,locale:'ar-SA',acceptDownloads:true,reducedMotion:'reduce'});const page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&!r.url().startsWith(BASE))external.push(r.url());});
   const seed={id:'audit-remaining',name:'SOURCE TEST / العقار',mode:'building',inputs:gold['RE-GOLD-002_existing_building'].inputs,savedAt:'2026-10-10T00:00:00Z'};
   await context.addInitScript(({namespace,seed})=>{localStorage.setItem('startak.locale','ar-SA');if(!localStorage.getItem(namespace+'remaining-seeded')){localStorage.setItem(namespace+'deal:'+seed.id,JSON.stringify(seed));localStorage.setItem(namespace+'deals-index',JSON.stringify([{id:seed.id,name:seed.name,mode:seed.mode,savedAt:seed.savedAt}]));localStorage.setItem(namespace+'remaining-seeded','true');}}, {namespace,seed});
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   const documentPanel=page.getByTestId('local-document-evidence-intake');await expect(documentPanel).toBeVisible({timeout:30000});
   const support=page.getByTestId('asset-support-matrix').first();await support.locator('summary').click();await expect(support.getByRole('row')).toHaveCount(14);checks++;
   // Actual keyboard activation, rather than a source-only accessibility claim.
   const chooser=documentPanel.getByRole('button',{name:'اختيار ملف',exact:true});await page.keyboard.press('Tab');await chooser.focus();await expect(chooser).toBeFocused();checks++;
   const focus=await chooser.evaluate(el=>getComputedStyle(el).outlineStyle);ok(focus!=='none','keyboard focus has a visible outline');
   await page.getByTestId('document-case-id').fill('CASE-LOCAL-AUDIT');
   await page.getByTestId('local-document-file-input').setInputFiles({name:'English source - عقار.pdf',mimeType:'application/pdf',buffer:pdfFixture()});
   await expect(page.getByTestId('local-document-parser-status')).toHaveAttribute('data-parser-status','PARSED',{timeout:25000});checks++;
   await expect(documentPanel.locator('[data-user-content]').filter({hasText:'English source - عقار.pdf'})).toBeVisible();checks++;
   await expect(documentPanel).toContainText('1500.00');checks++;
   await documentPanel.getByTestId('manual-transcription').locator('summary').click();
   await page.getByTestId('manual-text').fill('1500');await page.getByTestId('manual-page').fill('1');await page.getByTestId('manual-reviewerRef').fill('TRANSCRIBER');await page.getByTestId('manual-note').fill('Rent column page 1');await page.getByTestId('apply-manual-transcription').click();
   await expect(documentPanel).toContainText('MANUAL_TRANSCRIPTION_UNVERIFIED');checks++;
   const qualification=page.getByTestId('local-evidence-qualification');await page.getByTestId('evidence-atom-select').selectOption({index:1});
   // Existing qualification controls use stable test IDs.
   await page.getByTestId('semantic-key-input').fill('market.rent');
   await page.getByTestId('evidence-value-type').selectOption('NUMBER');
   await page.getByTestId('evidence-unit').fill('SAR/sqm/year');
   await page.getByTestId('source-reference-input').fill('Synthetic source page 1');
   await page.getByTestId('reviewer-reference-input').fill('REVIEWER');
   await page.getByTestId('reviewer-note-input').fill('Compared against page 1');
   await page.getByTestId('create-evidence-candidate').click();
   await expect(page.getByTestId('candidate-truth-status')).toBeVisible();checks++;
   await page.getByTestId('save-evidence-journal').click();await expect(page.getByTestId('saved-evidence-journal')).toBeVisible();checks++;
   const journal=JSON.parse(await download(page,page.getByTestId('export-evidence-journal')));
   ok(readLocalReviewJournal(JSON.stringify(journal),{caseId:'CASE-LOCAL-AUDIT',projectId:null,kind:'EVIDENCE'}).payload.candidate.fact.normalizedValue===1500,'exported source journal preserves value and scope');
   await page.reload();await page.getByTestId('document-case-id').fill('CASE-LOCAL-AUDIT');await page.getByTestId('local-document-file-input').setInputFiles({name:'English source - عقار.pdf',mimeType:'application/pdf',buffer:pdfFixture()});
   await expect(page.getByTestId('saved-evidence-journal')).toBeVisible({timeout:25000});checks++;
   await expect(page.getByTestId('local-evidence-workflow-status')).toHaveAttribute('data-verification-status','VERIFICATION_NOT_COMPLETE');checks++;
   await expect(page.getByTestId('local-evidence-workflow-status')).toHaveText('التحقق غير مكتمل');checks++;
   await page.getByTitle(ar.actions.savedDeals,{exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:seed.name,exact:true}).click();
   const provenance=page.getByTestId('input-provenance');await provenance.locator('summary').click();
   for(const[key,value]of Object.entries({field:'buildingPrice',unit:'SAR',sourceReference:'USER ESTIMATE / source',sourceDate:'2026-10-01',location:'Riyadh',reviewerRef:'OWNER'})) {const control=page.getByTestId('provenance-'+key);if(key==='field')await control.selectOption(value);else await control.fill(value);}
   await page.getByTestId('save-input-provenance').click();await expect(provenance).toContainText('USER_SUPPLIED_UNVERIFIED');checks++;
   const report=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));ok(verifyPersonalFinancialStudy(report)&&report.financial.inputProvenance.buildingPrice.sourceReference==='USER ESTIMATE / source','actual UI financial export includes input provenance');
   const canonical=page.getByTestId('canonical-case-workspace-panel');
   for(const[label,value]of [['معرّف مساحة العمل','WS-LOCAL-AUDIT'],['معرّف المشروع','PROJECT-LOCAL-AUDIT'],['معرّف الحالة','CASE-LOCAL-AUDIT'],['معرّف المحلل / المستخدم','OWNER']]) await canonical.getByRole('textbox',{name:label,exact:true}).fill(value);
   await canonical.getByRole('button',{name:'تجميع الحالة المعيارية',exact:true}).click();const gap=page.getByTestId('case-gap-actions');await expect(gap).toBeVisible();
   await page.getByTestId('case-action-gap').selectOption('documents');
   await page.getByTestId('case-action-ownerId').fill('OWNER');await page.getByTestId('case-action-actorId').fill('RECORDER');await page.getByTestId('case-action-dueDate').fill('2026-10-11');await page.getByTestId('create-case-action').click();
   await expect(page.getByTestId('case-actions-count')).toContainText('1');checks++;
   await page.getByTestId('case-action-IN_PROGRESS').click();await page.getByTestId('case-action-evidenceRef').fill('Synthetic journal page 1');await page.getByTestId('case-action-SATISFIED_PENDING_REVIEW').click();await page.getByTestId('case-action-actorId').fill('REVIEWER');await page.getByTestId('case-action-reviewNote').fill('Reviewed source reference');await page.getByTestId('case-action-CLOSED').click();
   await expect(page.getByTestId('case-actions-count')).toContainText('0');checks++;
   await expect(page.getByTestId('investment-committee-dossier')).toHaveAttribute('data-dossier-status','HOLD_WORKSPACE');checks++;
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,testId:el.getAttribute('data-testid'),classes:typeof el.className==='string'?el.className:'',text:(el.innerText||'').slice(0,100),left:r.left,right:r.right,width:r.width};}).filter(r=>r.width>0&&(r.left < -1||r.right>innerWidth+1)).slice(-35)}));
   if(layout.scrollWidth>layout.width+1){await fs.writeFile(`${DIR}/${name}-${viewport.width}-overflow.json`,JSON.stringify(layout,null,2));await page.screenshot({path:`${DIR}/${name}-${viewport.width}-overflow.png`,fullPage:true});}
   ok(layout.scrollWidth<=layout.width+1,'no page-level overflow at tested viewport');
   if(name==='chromium'&&viewport.width===1366){
    const html=await download(page,page.getByTestId('c75-export-personal-html'));const htmlHash=html.match(/[a-f0-9]{64}/g)?.at(-1);const print=await context.newPage();await print.setContent(html,{waitUntil:'load'});await print.setViewportSize({width:794,height:1123});await print.emulateMedia({media:'print'});
    ok(await print.evaluate(()=>[...document.querySelectorAll('table')].every(t=>t.scrollWidth<=document.documentElement.clientWidth+1)),'print tables fit page viewport');
    await print.pdf({path:DIR+'/personal-study-A4.pdf',format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font-size:9px;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{top:'14mm',bottom:'18mm',left:'14mm',right:'14mm'}});const {readPdfText}=await import('../../src/document-intelligence/parsers/pdf-text-reader.mjs');const printed=await readPdfText(await fs.readFile(DIR+'/personal-study-A4.pdf'));ok(printed.pageCount>1&&printed.lines.some(line=>line.text.includes(htmlHash)),'generated print PDF has multiple pages and retains report fingerprint');await print.close();
   }
   await page.screenshot({path:`${DIR}/${name}-${viewport.width}.png`,fullPage:true});
   ok(errors.length===0,`${name} pageerrors: ${errors.join(' | ')}`);ok(external.length===0,'document module sends no external POST uploads');
   evidence.push({engine:name,viewport,checksCompleted:checks,pageErrors:errors.length,externalPosts:external.length,physicalDevice:false});await context.close();
  }}finally{await browser.close();}
 }
 await fs.writeFile(DIR+'/acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers:evidence,physicalDevicesTested:false,screenReaderTested:false,marketDataVerified:false},null,2));
 console.log(`AUDIT_REMAINING_BROWSER=PASS checks=${checks}`);
})().catch(async e=>{console.error(e);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/failure.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checksCompleted:checks,error:e.message},null,2));process.exit(1);});
