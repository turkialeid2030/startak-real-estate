'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {pdfFixture}=require('../fixtures/bounded-pdf');
const gold=require('../reference/RE-GOLD-baseline.json');
const ar=require('../../src/i18n/locales/ar-SA');
const {sanitizeArabicUiText}=require('../../src/i18n/strict-arabic-presentation');
const {getDecisionMetricLabelOverride}=require('../../src/i18n/decision-metric-semantics');
const {operatingCase,verified}=require('../fixtures/synthetic-collections-case');
const {createOperatingExpense,createCapexItem}=require('../../src/residential-income-acquisition');
const {buildResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition');
const {verifyPersonalFinancialStudy}=require('../../src/app/personal-financial-study');
const {readLocalReviewJournal}=require('../../src/storage/local-review-journal');
const namespace=require('../../src/storage/browser-local-storage-provider').NAMESPACE;
const BASE=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173';
const DIR='runtime-evidence/remaining-audit';let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
async function download(page,locator){const pending=page.waitForEvent('download');await locator.click();const file=await pending;return fs.readFile(await file.path(),'utf8');}
async function captureDocument(page,prefix){
 const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
 const tiles=[];
 // WebKit rejects images above 32767 physical pixels. Preserve all content
 // with bounded CSS-pixel tiles rather than skipping or truncating evidence.
 for(let y=0;y<size.height;y+=8000){
  const path=`${prefix}-${tiles.length+1}.png`,height=Math.min(8000,size.height-y);
  await page.screenshot({path,fullPage:true,scale:'css',clip:{x:0,y,width:size.width,height}});
  tiles.push({path,y,height});
 }
 await fs.writeFile(prefix+'-tiles.json',JSON.stringify({...size,tiles},null,2));
}
async function textContrast(locator){return locator.evaluate(el=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
 const foreground=rgb(getComputedStyle(el).color);let background;
 for(let node=el;node;node=node.parentElement){const color=rgb(getComputedStyle(node).backgroundColor);if(color[3]===255){background=color;break;}}
 if(!background)throw new Error('Opaque text background required for contrast check');
 const luminance=channels=>channels.slice(0,3).map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[0.2126,0.7152,0.0722][i],0);
 const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 });}
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
   await expect(page.getByText('نص يحتاج استكمال التعريب؛ الأصل:',{exact:false})).toHaveCount(0);checks++;
   await expect(page.getByText('تحليل الاستحواذ على العقارات السكنية المدرة للدخل',{exact:true})).toBeVisible();checks++;
   await expect(documentPanel).toContainText('مستند وورد');checks++;
   const basis=page.getByTestId('capitalization-basis-select');
   await expect(basis).toHaveValue('');checks++;
   await basis.selectOption('BEFORE_RESERVE');
   await expect(basis).toHaveValue('BEFORE_RESERVE');checks++;
   const basisReport=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(basisReport.financial.results.incomeCapBasis.basis==='BEFORE_RESERVE','basis selection reaches financial export');
   ok(verifyPersonalFinancialStudy(basisReport),'basis report digest verifies');
   await basis.selectOption('AFTER_RESERVE');
   const inputOptions=await page.getByTestId('provenance-field').locator('option').allTextContents();
   ok(inputOptions.includes('اسم الدراسة')&&inputOptions.includes('تفعيل الرافعة المالية')&&inputOptions.includes('معدل الربح السنوي'),'input source picker names study and financing fields in Arabic');
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
   // Full-engine lower-price evidence must match the current exported inputs
   // on all three browsers, including the explicit-zero-debt case.
   const hurdle=page.getByLabel(sanitizeArabicUiText(ar.inputBuilding.discountRate),{exact:false}).first();
   if(!await hurdle.isVisible())await page.getByRole('button',{name:new RegExp(ar.inputBuilding.sec5)}).click();
   await hurdle.fill('50');
   const lowerReport=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   const lower=lowerReport.financial.purchaseAlternative;
   ok(lower.status==='VERIFIED_LOWER_PRICE'&&lower.qualification.criteria.every(c=>c.met===true),'lower candidate passes every canonical criterion');
   ok(JSON.stringify(lower)===JSON.stringify(lowerReport.financial.results.purchaseAlternative)&&lower.globalMaximumEstablished===false,'export aliases current review without global-maximality claim');
   await expect(page.getByTestId('building-price-alternative-value')).toContainText(lower.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));checks++;
   await expect(page.getByTestId('building-price-alternative-status')).toContainText('ليس إثباتًا لأعلى سعر ممكن');checks++;
   await hurdle.fill('8');
   await expect(page.getByTestId('building-price-alternative')).toHaveCount(0);checks++;
   const debtSwitch=page.getByRole('switch',{name:ar.financing.toggle,exact:true});
   if(!await debtSwitch.isVisible())await page.getByRole('button',{name:ar.financingInput.section,exact:false}).click();
   const debtRatio=page.getByLabel(sanitizeArabicUiText(getDecisionMetricLabelOverride('ar-SA','financingInput.ltvLabelBuilding')),{exact:false}).first();
   await debtRatio.fill('0');
   if(await debtSwitch.getAttribute('aria-checked')!=='true')await debtSwitch.click();
   const zeroDebt=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(zeroDebt.financial.inputs.leverageEnabled===true&&zeroDebt.financial.inputs.ltv===0,'real controls request financing with zero debt');
   ok(zeroDebt.financial.results.purchasePriceQualification.status==='ALL_CRITERIA_VERIFIED_AT_BOUNDARY'&&zeroDebt.financial.results.purchasePriceQualification.criteria.length===6,'zero debt qualifies through six economically unlevered criteria');
   await expect(page.getByTestId('building-price-unqualified')).toHaveCount(0);checks++;
   await expect(page.getByTestId('building-price-boundary')).not.toHaveText('—');checks++;
   if((await debtSwitch.getAttribute('aria-checked')==='true')!==seed.inputs.leverageEnabled)await debtSwitch.click();
   await debtRatio.fill(String(seed.inputs.ltv*100));await hurdle.fill(String(seed.inputs.discountRate*100));
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
   for(const surface of ['decision-intelligence-workspace','investment-committee-dossier','post-decision-governance-panel']){await expect(page.getByTestId(surface).locator('[data-user-content]').filter({hasText:'CASE-LOCAL-AUDIT'}).first()).toHaveText('CASE-LOCAL-AUDIT');checks++;}
   console.log(`AUDIT_REMAINING_VIEWPORT=PASS engine=${name} width=${viewport.width} checks=${checks}`);
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,testId:el.getAttribute('data-testid'),classes:typeof el.className==='string'?el.className:'',text:(el.innerText||'').slice(0,100),left:r.left,right:r.right,width:r.width};}).filter(r=>r.width>0&&(r.left < -1||r.right>innerWidth+1)).slice(-35)}));
   if(layout.scrollWidth>layout.width+1){await fs.writeFile(`${DIR}/${name}-${viewport.width}-overflow.json`,JSON.stringify(layout,null,2));await captureDocument(page,`${DIR}/${name}-${viewport.width}-overflow`);}
   ok(layout.scrollWidth<=layout.width+1,'no page-level overflow at tested viewport');
   if(name==='chromium'&&viewport.width===1366){
    const html=await download(page,page.getByTestId('c75-export-personal-html'));const htmlHash=html.match(/[a-f0-9]{64}/g)?.at(-1);const print=await context.newPage();await print.setContent(html,{waitUntil:'load'});await print.setViewportSize({width:794,height:1123});await print.emulateMedia({media:'print'});
    ok(await print.evaluate(()=>[...document.querySelectorAll('table')].every(t=>t.scrollWidth<=document.documentElement.clientWidth+1)),'print tables fit page viewport');
    await print.pdf({path:DIR+'/personal-study-A4.pdf',format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font-size:9px;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{top:'14mm',bottom:'18mm',left:'14mm',right:'14mm'}});const {readPdfText}=await import('../../src/document-intelligence/parsers/pdf-text-reader.mjs');const printed=await readPdfText(await fs.readFile(DIR+'/personal-study-A4.pdf'));ok(printed.pageCount>1&&printed.lines.some(line=>line.text.includes(htmlHash)),'generated print PDF has multiple pages and retains report fingerprint');await print.close();
   }
   // A real operating-case import, edit and export; all data are synthetic.
   const envelope=buildResidentialIncomeOperatingCaseEnvelope(operatingCase({collections:[]}));
   const importOperating=async payload=>page.getByTestId('riai-operating-case-file-input').setInputFiles({name:'synthetic-operating-case.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
   await importOperating(envelope);
   const operating=page.getByTestId('riai-rent-roll-collections-workspace');await expect(operating).toBeVisible();checks++;
   await expect(page.getByTestId('lease-calendar-uncovered')).toHaveText('243');checks++;
   const leaseCalendarInitial=JSON.parse(await download(page,page.getByTestId('lease-calendar-export')));
   ok(leaseCalendarInitial.result.status==='DERIVED_DOCUMENTED_CALENDAR'&&leaseCalendarInitial.result.leaseRows[0].daysToEnd===122&&!leaseCalendarInitial.result.noticesSent,'case-date calendar derives dates without sending notices');
   const collection=page.getByTestId('riai-collection-editor');
   await expect(collection.getByLabel(ar.riai.concessions,{exact:true})).toHaveValue('');checks++;
   await collection.getByLabel(ar.riai.unitAndLease,{exact:true}).selectOption('UNIT-1');
   for(const[key,value]of Object.entries({collectionId:'COLL-BROWSER',periodStart:'2026-01-01',periodEnd:'2026-09-01',contractualRentDue:'100',rentCollected:'120',potentialGrossRent:'120',concessions:'0',sourceRef:'synthetic source',adoptionRef:'synthetic adoption'}))await collection.getByLabel(ar.riai[key],{exact:true}).fill(value);
   const confirmed=collection.getByRole('checkbox');await confirmed.check();
   await collection.getByLabel(ar.riai.rentCollected,{exact:true}).fill('121');
   await expect(confirmed).not.toBeChecked();checks++;
   await collection.getByRole('button',{name:ar.riai.addCollectionRecord,exact:true}).click();
   await expect(operating).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await confirmed.check();await collection.getByRole('button',{name:ar.riai.addCollectionRecord,exact:true}).click();
   await expect(operating).toContainText(ar.riai.collectionAddSuccess);checks++;
   const exportedOperating=JSON.parse(await download(page,page.getByRole('button',{name:ar.riai.exportOperatingCase,exact:true})));
   ok(exportedOperating.operatingCase.rentCollections.length===1&&exportedOperating.operatingCase.rentCollections[0].collectedRent.value===121,'operating export contains the accepted actual collection');
   const runoff=page.getByTestId('contract-runoff-panel');await expect(runoff).toBeVisible();checks++;
   await expect(page.getByTestId('runoff-total-net')).toHaveText('—');checks++;
   const runoffExport=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(runoffExport.result.rows.length===12&&runoffExport.result.totals.contractRent===400000&&runoffExport.result.totals.contractNetBeforeCapex===null,'monthly lease run-off stops at expiry and missing costs block net');
   ok(runoffExport.sourceOperatingCase.rentCollections[0].collectedRent.value===121&&runoffExport.result.historicalCollections.totals.rentCollected===121&&runoffExport.result.collectionForecast===null,'export retains inputs and separates collected cash from projection');
   await collection.getByLabel(ar.riai.collectionId,{exact:true}).fill('UNSAVED-CASE-ONE');await confirmed.check();
   const other=JSON.parse(JSON.stringify(envelope).replaceAll('CASE-COLLECTIONS-1','CASE-COLLECTIONS-SECOND'));
   other.operatingCase.operatingExpenses=[createOperatingExpense({caseId:'CASE-COLLECTIONS-SECOND',expenseId:'EXP-1',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis:'NORMALIZED',annualAmount:verified('opex.maintenance',12000,'SAR/year','evidence://lease/rent')})];
   other.operatingCase.operatingExpenses.push(createOperatingExpense({caseId:'CASE-COLLECTIONS-SECOND',expenseId:'BUDGET-1',propertyId:'PROPERTY-1',category:'MAINTENANCE',basis:'BUDGET',annualAmount:verified('opex.budget',5000,'SAR/year','evidence://lease/rent')}));
   other.operatingCase.capexItems=[createCapexItem({caseId:'CASE-COLLECTIONS-SECOND',capexItemId:'CAP-1',propertyId:'PROPERTY-1',category:'OTHER',severity:'LOW',estimatedCost:verified('capex.cost',12000,'SAR','evidence://lease/rent')})];
   await importOperating(other);
   await expect(collection.getByLabel(ar.riai.collectionId,{exact:true})).toHaveValue('');checks++;
   await expect(collection.getByRole('checkbox')).not.toBeChecked();checks++;
   await expect(page.getByTestId('runoff-total-net')).not.toHaveText('—');checks++;
   const withCosts=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(withCosts.result.caseId==='CASE-COLLECTIONS-SECOND'&&withCosts.result.totals.normalizedOpex===12000&&withCosts.result.totals.contractNetBeforeCapex===388000,'new case recalculates normalized OPEX without carrying prior collections');
   const comparison=page.getByTestId('operating-financial-comparison');await comparison.locator('summary').click();
   await expect(comparison.getByRole('status')).toContainText('المقارنة غير متاحة');checks++;
   await page.getByTestId('rental-calendar').locator('summary').click();await page.getByTestId('rental-start-date').fill('2026-09-01');
   await page.getByTestId('rental-location').selectOption('OTHER');await page.getByTestId('rental-category').selectOption('RESIDENTIAL');await page.getByTestId('save-rental-calendar').click();
   await expect(page.getByTestId('operating-financial-comparison-status')).toContainText('اكتملت التسوية الحسابية');checks++;
   const comparedReport=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   const sourceYear=comparedReport.operatingReport.horizonReconciliation.years[0];
   await expect(comparison.getByRole('table').first().locator('tbody tr').first()).toContainText(sourceYear.contractRent.toLocaleString('ar-SA',{maximumFractionDigits:2}));checks++;
   ok(sourceYear.contractRent===400000&&sourceYear.netBeforeReserveAndCapex===388000,'screen comparison uses the same source-linked annual values as the exported study');
   await page.getByTestId('schedule-lease').selectOption('LEASE-1');
   await page.getByTestId('schedule-date-0').fill('2026-09-16');await page.getByTestId('schedule-rent-0').fill('0');
   await page.getByTestId('schedule-add-row').click();await page.getByTestId('schedule-date-1').fill('2026-10-01');await page.getByTestId('schedule-rent-1').fill('١٬٤٠٠٬٠٠٠');
   await page.getByTestId('schedule-source').fill('Synthetic schedule clause');await page.getByTestId('schedule-adoption').fill('Synthetic local review');
   await page.getByTestId('schedule-confirm').check();await page.getByTestId('schedule-rent-1').fill('۱٬۴۴۰٬۰۰۰');
   await expect(page.getByTestId('schedule-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('schedule-save').click();await expect(page.getByTestId('schedule-feedback')).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await page.getByTestId('schedule-date-1').fill('2026-09-16');await page.getByTestId('schedule-confirm').check();await page.getByTestId('schedule-save').click();
   await expect(page.getByTestId('schedule-feedback')).toContainText('LEASE_SCHEDULE_DATES_NOT_INCREASING');checks++;
   await page.getByTestId('schedule-date-1').fill('2026-10-01');await page.getByTestId('schedule-confirm').check();await page.getByTestId('schedule-save').click();
   await expect(page.getByTestId('schedule-feedback')).toHaveText('تم حفظ جدول الإيجار.');checks++;
   const scheduled=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(scheduled.result.totals.contractRent===410000&&scheduled.result.totals.contractNetBeforeCapex===398000&&scheduled.result.rows[0].leaseRows[0].segments[1].periodicRent===0,'UI schedule applies rent-free days and explicit restart at monthly boundaries');
   const scheduleCase=JSON.parse(await download(page,page.getByRole('button',{name:ar.riai.exportOperatingCase,exact:true})));
   ok(scheduleCase.operatingCase.leases[0].escalation.schedule.length===2&&scheduleCase.operatingCase.leases[0].escalation.schedule[1].rent.value===1440000,'operating snapshot retains the accepted schedule');
   await page.getByTestId('capital-open').click();
   await page.getByTestId('capital-add').click();await page.getByTestId('capital-item-0').selectOption('CAP-1');
   await page.getByTestId('capital-date-0').fill('2026-09-10');await page.getByTestId('capital-amount-0').fill('12001');
   await page.getByTestId('capital-source').fill('Synthetic plan');await page.getByTestId('capital-review').fill('Synthetic plan review');
   await page.getByTestId('capital-confirm').check();await page.getByTestId('capital-save').click();
   await expect(page.getByTestId('capital-feedback')).toContainText('CAPITAL_PLAN_COST_MISMATCH');checks++;
   await page.getByTestId('capital-amount-0').fill('١٢٬٠٠٠');await expect(page.getByTestId('capital-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('capital-confirm').check();await page.getByTestId('capital-save').click();
   await expect(page.getByTestId('capital-feedback')).toHaveText('تم حفظ خطة الدفع.');checks++;
   const planned=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(planned.result.totals.scheduledCapex===12000&&planned.result.totals.contractNetAfterScheduledCapex===386000&&planned.result.rows[0].scheduledCapex===12000,'capital timing affects only explicit analytical net and retains before-CAPEX amount');
   await page.getByTestId('operating-open').click();await page.getByTestId('operating-add').click();
   await expect(page.getByTestId('operating-item-0').locator('option')).toHaveCount(2);checks++;
   await page.getByTestId('operating-item-0').selectOption('BUDGET-1');await page.getByTestId('operating-date-0').fill('2026-08-31');await page.getByTestId('operating-amount-0').fill('٣٬٠٠٠');
   await page.getByTestId('operating-source').fill('Synthetic operating payment plan');await page.getByTestId('operating-review').fill('Synthetic operating review');
   await page.getByTestId('operating-confirm').check();await page.getByTestId('operating-save').click();await expect(page.getByTestId('operating-feedback')).toContainText('OPERATING_PLAN_PAST_DATE');checks++;
   await page.getByTestId('operating-date-0').fill('2026-09-15');await expect(page.getByTestId('operating-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('operating-save').click();await expect(page.getByTestId('operating-feedback')).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await page.getByTestId('operating-confirm').check();await page.getByTestId('operating-save').click();await expect(page.getByTestId('operating-feedback')).toHaveText('تم حفظ خطة الدفع.');checks++;
   const operatingPlan=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(operatingPlan.result.operatingPaymentPlan.total===3000&&operatingPlan.result.operatingPaymentPlan.rows[0].amount===3000&&operatingPlan.result.operatingPaymentPlan.coverageComplete===false,'explicit operating payments remain partial and are not inferred from annual budget');
   ok(JSON.stringify(operatingPlan.result.totals)===JSON.stringify(planned.result.totals),'planned payments do not double count normalized OPEX or change existing net');
   await page.getByTestId('operating-budget-enabled').check();
   await page.getByTestId('operating-budget-start').fill('2026-09-01');await page.getByTestId('operating-budget-end').fill('2027-09-01');
   await page.getByTestId('operating-budget-amount-0').fill('3001');
   await page.getByTestId('operating-source').fill('Synthetic period budget and payment plan');await page.getByTestId('operating-review').fill('Synthetic period budget review');
   await page.getByTestId('operating-confirm').check();await page.getByTestId('operating-save').click();await expect(page.getByTestId('operating-feedback')).toContainText('OPERATING_BUDGET_AMOUNT_MISMATCH');checks++;
   await page.getByTestId('operating-budget-amount-0').fill('۳٬۰۰۰');await expect(page.getByTestId('operating-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('operating-confirm').check();await page.getByTestId('operating-save').click();await expect(page.getByTestId('operating-feedback')).toContainText('تم حفظ');checks++;
   const budgetPlan=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(budgetPlan.result.operatingPaymentPlan.budgetReconciliation.status==='MATCHED_ENTERED_BUDGET'&&budgetPlan.result.operatingPaymentPlan.budgetReconciliation.rows[0].differenceMinor===0,'period budget reconciles exactly per item');
   ok(JSON.stringify(budgetPlan.result.totals)===JSON.stringify(planned.result.totals)&&budgetPlan.result.operatingPaymentPlan.coverageComplete===false,'matched entered budget does not promote cash coverage or change NOI');

   await page.getByTestId('cash-open').click();
   await page.getByTestId('cash-opening').fill('1000');await page.getByTestId('cash-add').click();
   await page.getByTestId('cash-lease-0').selectOption('LEASE-1');await page.getByTestId('cash-receipt-date-0').fill('2026-08-31');
   await page.getByTestId('cash-amount-0').fill('٢٠٬٠٠٠٫٢٥');await page.getByTestId('cash-reference-0').fill('Synthetic future receipt');
   await page.getByTestId('cash-source').fill('Synthetic opening and receipts');await page.getByTestId('cash-review').fill('Synthetic cash review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toContainText('CASH_RECEIPT_OUTSIDE_HORIZON');checks++;
   await page.getByTestId('cash-receipt-date-0').fill('2026-10-01');await expect(page.getByTestId('cash-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toHaveText('تم حفظ السيناريو.');checks++;
   const cash=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(cash.result.cashScenario.status==='PARTIAL_SCENARIO'&&cash.result.cashScenario.rows[0].closingMinor===-1400000&&cash.result.cashScenario.closingMinor===600025,'cash scenario uses dated receipts and both payment plans without accrual conversion');
   ok(JSON.stringify(cash.result.totals)===JSON.stringify(planned.result.totals)&&cash.result.cashScenario.coverageComplete===false,'cash scenario does not alter analytical NOI or assert complete coverage');

   ok(cash.result.cashScenario.liquidity.minimumMinor===-1400000&&cash.result.cashScenario.liquidity.firstShortfallDate==='2026-09-10'&&cash.result.cashScenario.liquidity.additionalOpeningRequiredMinor===1400000,'dated check includes CAPEX and OPEX before later receipt despite positive horizon balance');
   await page.getByTestId('cash-results').locator('summary').first().click();
   await expect(page.getByTestId('cash-liquidity-minimum')).toHaveText('-14000.00');checks++;
   await expect(page.getByTestId('cash-liquidity-first-shortfall')).toHaveText('2026-09-10');checks++;
   await expect(page.getByTestId('cash-liquidity-required')).toHaveText('14000.00');checks++;

   await expect(page.getByTestId('cash-other-review-status')).toContainText('غير مكتملة');checks++;
   const otherRows=[
    {category:'FINANCING',direction:'INFLOW',date:'2026-09-09',amount:'20000',reference:'Synthetic future receipt',description:'Synthetic loan draw'},
    {category:'TAX',direction:'OUTFLOW',date:'2026-09-15',amount:'100.25',reference:'Synthetic tax',description:'Synthetic entered tax payment'},
    {category:'DEPOSIT',direction:'INFLOW',date:'2026-09-15',amount:'250',reference:'Synthetic deposit receipt',description:'Synthetic deposit held'},
    {category:'DEPOSIT',direction:'OUTFLOW',date:'2026-10-02',amount:'250',reference:'Synthetic deposit return',description:'Synthetic deposit repayment'},
   ];
   for(const [i,row]of otherRows.entries()){
    await page.getByTestId('cash-other-add').click();
    for(const [key,value]of Object.entries(row)){
     const input=page.getByTestId(`cash-other-${key}-${i}`);
     if(['category','direction'].includes(key))await input.selectOption(value);else await input.fill(value);
    }
    await page.getByTestId(`cash-other-source-${i}`).fill('Synthetic documented assumption');
   }
   await page.getByTestId('cash-source').fill('Synthetic full entered cash plan');await page.getByTestId('cash-review').fill('Synthetic other flows review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toContainText('CASH_UNIQUE_REFERENCE_REQUIRED');checks++;
   await page.getByTestId('cash-other-reference-0').fill('Synthetic financing draw');await expect(page.getByTestId('cash-confirm')).not.toBeChecked();checks++;
   for(const category of ['FINANCING','DEPOSIT'])await page.getByTestId(`cash-category-review-${category}`).selectOption('ENTERED');
   for(const category of ['TAX','FEES','OTHER'])await page.getByTestId(`cash-category-review-${category}`).selectOption('NONE_EXPECTED');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toContainText('CASH_CATEGORY_REVIEW_CONFLICT');checks++;
   await page.getByTestId('cash-category-review-TAX').selectOption('ENTERED');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-other-amount-1').fill('100.26');
   await expect(page.getByTestId('cash-confirm')).not.toBeChecked();checks++;
   await expect(page.getByTestId('cash-category-review-TAX')).toHaveValue('NOT_REVIEWED');checks++;
   await page.getByTestId('cash-other-amount-1').fill('100.25');
   await page.getByTestId('cash-category-review-TAX').selectOption('ENTERED');await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toHaveText('تم حفظ السيناريو.');checks++;
   const otherCash=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(otherCash.result.cashScenario.closingMinor===2590000&&otherCash.result.cashScenario.rows[0].closingMinor===614975,'financing, tax and deposits affect only dated entered cash flows');
   ok(otherCash.result.cashScenario.otherFlowCoverage.status==='REVIEW_DECLARED'&&otherCash.result.cashScenario.coverageComplete===false,'declared category review does not verify complete cash coverage');
   ok(JSON.stringify(otherCash.result.totals)===JSON.stringify(cash.result.totals)&&otherCash.sourceOperatingCase.cashScenario.otherFlows.entries.length===4,'additional flows retain source inputs without changing analytical rental NOI');
   await expect(page.getByTestId('cash-closing')).toHaveText('25900.00');checks++;
   await expect(page.getByTestId('cash-liquidity-minimum')).toHaveText('1000.00');checks++;
   await expect(page.getByTestId('cash-other-review-status')).toContainText('(5/5)');checks++;
   const cashLayout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   ok(cashLayout.scrollWidth<=cashLayout.width+1,'additional cash controls and tables retain viewport width');
   ok(await textContrast(page.getByTestId('cash-other-amount-0'))>=4.5,'cash amount text has readable contrast against its dark control');
   ok(await textContrast(page.getByTestId('cash-other-review-status'))>=4.5,'cash review text has readable contrast against its panel');
   const moneyGap=await page.getByTestId('cash-other-coverage').locator('tbody tr').first().evaluate(row=>{
    const rect=cell=>{const range=document.createRange();range.selectNodeContents(cell);return range.getBoundingClientRect();};
    const a=rect(row.cells[3]),b=rect(row.cells[4]);return Math.max(a.left,b.left)-Math.min(a.right,b.right);
   });
   ok(moneyGap>=12,'inflow and outflow amounts have distinct readable columns on mobile and desktop');
   await page.getByTestId('cash-other-coverage').evaluate(el=>{el.scrollIntoView({block:'center'});window.scrollBy(0,-120);});
   await page.getByTestId('cash-other-coverage').screenshot({path:`${DIR}/${name}-${viewport.width}-cash-coverage.png`});
   await page.getByTestId('cash-other-add').locator('..').screenshot({path:`${DIR}/${name}-${viewport.width}-cash-editor.png`});
   // A plan change after beginning another cash review invalidates the draft.
   await page.getByTestId('cash-other-amount-1').fill('100.26');
   await page.getByTestId('capital-date-0').fill('2026-09-11');
   await page.getByTestId('capital-source').fill('Synthetic revised payment date');await page.getByTestId('capital-review').fill('Synthetic revised date review');
   await page.getByTestId('capital-confirm').check();await page.getByTestId('capital-save').click();await expect(page.getByTestId('capital-feedback')).toHaveText('تم حفظ خطة الدفع.');checks++;
   await page.getByTestId('cash-source').fill('Synthetic stale draft source');await page.getByTestId('cash-review').fill('Synthetic stale draft review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toContainText('CASH_DRAFT_STALE');checks++;
   await page.getByTestId('cash-reload').click();await expect(page.getByTestId('cash-other-amount-1')).toHaveValue('100.25');checks++;
   await expect(page.getByTestId('cash-confirm')).not.toBeChecked();checks++;

   // Source-dated property returns use explicit acquisition/exit inputs and
   // the actual payment dates, excluding financing, deposits and opening cash.
   await page.getByTestId('cash-return-editor').locator('summary').click();await page.getByTestId('cash-return-enabled').check();
   for(const[key,value]of Object.entries({acquisitionAmount:'١٠٠٬٠٠٠',acquisitionSourceRef:'Synthetic acquisition assumption',discountPercent:'۱۰',discountSourceRef:'Synthetic discount assumption',reviewRef:'Synthetic investment return review'}))await page.getByTestId(`cash-return-${key}`).fill(value);
   await page.getByTestId('cash-return-exitTreatment').selectOption('EXPLICIT_SALE');
   for(const[key,value]of Object.entries({saleDate:'2027-08-31',netSaleAmount:'١١٠٬٠٠٠',saleSourceRef:'Synthetic net sale assumption'}))await page.getByTestId(`cash-return-${key}`).fill(value);
   await page.getByTestId('cash-source').fill('Synthetic cash with acquisition and sale');await page.getByTestId('cash-review').fill('Synthetic cash return review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toHaveText('تم حفظ السيناريو.');checks++;
   const returnExport=JSON.parse(await download(page,page.getByTestId('export-contract-runoff'))),sourceReturn=returnExport.result.cashScenario.investmentReturns;
   const expectedNpv=-100000+20000.25/1.1**(30/365.2425)-3000/1.1**(14/365.2425)-12000/1.1**(10/365.2425)-100.25/1.1**(14/365.2425)+110000/1.1**(364/365.2425);
   ok(sourceReturn.status==='CALCULATED_ENTERED_SCENARIO'&&Math.abs(sourceReturn.npvSar-expectedNpv)<1e-7&&sourceReturn.flows.length===6,'dated property NPV matches independent cash arithmetic, excluding loan, deposits and opening cash');
   ok(returnExport.result.cashScenario.closingMinor===3590000&&returnExport.result.cashScenario.liquidity.minimumMinor===-9900000,'asset purchase and sale enter liquidity exactly once');
   const returnPanel=page.getByTestId('cash-investment-returns');await returnPanel.locator('summary').click();
   await expect(page.getByTestId('cash-return-npv')).toHaveText(sourceReturn.npvSar.toLocaleString('ar-SA',{maximumFractionDigits:2}));checks++;
   const returnStudy=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(verifyPersonalFinancialStudy(returnStudy)&&returnStudy.operatingReport.contractRunoff.cashScenario.investmentReturns.npvSar===sourceReturn.npvSar,'current financial report hash binds the same source return');
   const returnHtml=await download(page,page.getByTestId('c75-export-personal-html'));
   ok(returnHtml.includes('عائد مؤرخ من التدفقات النقدية المدخلة')&&returnHtml.includes('Synthetic net sale assumption'),'HTML includes source-dated return and its source reference');
   await page.getByTestId('cash-horizon-end').fill('2028-09-01');await page.getByTestId('cash-source').fill('Synthetic expanded horizon');await page.getByTestId('cash-review').fill('Synthetic expanded review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toHaveText('تم حفظ السيناريو.');checks++;
   const expanded=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(expanded.result.cashScenario.investmentReturns.status==='NEEDS_REVIEW'&&expanded.result.cashScenario.investmentReturns.npvSar===null,'extending the cash horizon cannot reuse a shorter operating budget or its prior return');
   await page.getByTestId('cash-horizon-end').fill('2027-09-01');await page.getByTestId('cash-return-enabled').uncheck();
   await page.getByTestId('cash-source').fill('Synthetic original horizon without return');await page.getByTestId('cash-review').fill('Synthetic restored scope review');
   await page.getByTestId('cash-confirm').check();await page.getByTestId('cash-save').click();await expect(page.getByTestId('cash-feedback')).toHaveText('تم حفظ السيناريو.');checks++;
   await expect(page.getByTestId('cash-investment-returns')).toHaveCount(0);await expect(page.getByTestId('cash-closing')).toHaveText('25900.00');checks+=2;

   const ledgerFill=async(type,values)=>{
    await page.getByTestId('ledger-type').selectOption(type);
    for(const[key,value]of Object.entries(values)){
     const field=page.getByTestId(`ledger-${key}`);
     if(['leaseId','chargeId','receiptId','targetId'].includes(key))await field.selectOption(value);else await field.fill(value);
    }
    await page.getByTestId('ledger-sourceRef').fill('Synthetic source');await page.getByTestId('ledger-reviewRef').fill('Synthetic review');
   };
   const ledgerSave=async()=>{await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toHaveText('تم حفظ القيد.');checks++;};
   await page.getByTestId('ledger-open').click();
   await ledgerFill('CHARGE',{id:'C1',date:'2026-08-01',leaseId:'LEASE-1',reference:'INV-1',periodStart:'2026-08-01',periodEndExclusive:'2026-09-01',dueDate:'2026-08-01',amount:'100.25'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-amount').fill('100.26');
   await expect(page.getByTestId('ledger-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await page.getByTestId('ledger-amount').fill('100.25');await ledgerSave();
   await ledgerFill('RECEIPT',{id:'R1',date:'2026-08-01',leaseId:'LEASE-1',reference:'BANK-1',amount:'120.50'});await ledgerSave();
   await ledgerFill('ALLOCATION',{id:'A1',date:'2026-08-01',chargeId:'C1',receiptId:'R1',amount:'100.26'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_OVERALLOCATION');checks++;
   await page.getByTestId('ledger-amount').fill('60.10');await ledgerSave();
   const ledgerExport=JSON.parse(await download(page,page.getByTestId('ledger-export')));
   ok(ledgerExport.result.totalsMinor.outstanding===4015&&ledgerExport.result.totalsMinor.unallocated===6040&&ledgerExport.result.agingMinor.days31to60===4015,'integer allocation and aging match documents');
   ok(ledgerExport.sourceOperatingCase.receivablesLedger.events.length===3&&ledgerExport.sourceOperatingCase.rentCollections.length===0,'ledger remains separate from period aggregate collections');
   await ledgerFill('REVERSAL',{id:'X1',date:'2026-08-01',targetId:'R1',reason:'Synthetic correction'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_REVERSE_ALLOCATIONS_FIRST');checks++;
   await page.getByTestId('ledger-targetId').selectOption('A1');await ledgerSave();
   const corrected=JSON.parse(await download(page,page.getByTestId('ledger-export')));
   ok(corrected.result.totalsMinor.outstanding===10025&&corrected.result.totalsMinor.unallocated===12050&&corrected.sourceOperatingCase.receivablesLedger.events.length===4,'allocation reversal preserves original events and restores balances');
   await ledgerFill('REFUND',{id:'F1',date:'2026-08-02',receiptId:'R1',reference:'REFUND-1',reason:'Synthetic completed return',amount:'120.51'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_OVERREFUND');checks++;
   await page.getByTestId('ledger-amount').fill('20.25');await expect(page.getByTestId('ledger-confirm')).not.toBeChecked();checks++;await ledgerSave();
   const returned=JSON.parse(await download(page,page.getByTestId('ledger-export')));
   ok(returned.result.totalsMinor.refunded===2025&&returned.result.totalsMinor.netReceived===10025&&returned.result.totalsMinor.received===12050&&returned.result.totalsMinor.unallocated===10025,'refund conserves gross, net and available receipt amounts');
   await ledgerFill('REVERSAL',{id:'X2',date:'2026-08-02',targetId:'R1',reason:'Synthetic correction'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_REVERSE_REFUNDS_FIRST');checks++;
   await page.getByTestId('ledger-targetId').selectOption('F1');await ledgerSave();
   await ledgerFill('REFUND',{id:'F2',date:'2026-08-03',receiptId:'R1',reference:'REFUND-2',reason:'Synthetic corrected return',amount:'20.25'});await ledgerSave();
   await ledgerFill('CREDIT',{id:'K1',date:'2026-08-04',chargeId:'C1',reference:'CREDIT-1',reason:'Synthetic documented reduction',amount:'100.26'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_OVERCREDIT');checks++;
   await page.getByTestId('ledger-amount').fill('10.00');await expect(page.getByTestId('ledger-confirm')).not.toBeChecked();checks++;await ledgerSave();
   const reduced=JSON.parse(await download(page,page.getByTestId('ledger-export')));
   ok(reduced.result.totalsMinor.charged===10025&&reduced.result.totalsMinor.credited===1000&&reduced.result.totalsMinor.netCharged===9025&&reduced.result.totalsMinor.outstanding===9025&&reduced.result.totalsMinor.netReceived===10025&&reduced.result.agingMinor.days31to60===9025,'reduction changes debt and aging without changing cash');
   await ledgerFill('REVERSAL',{id:'X3',date:'2026-08-05',targetId:'C1',reason:'Synthetic correction'});
   await page.getByTestId('ledger-confirm').check();await page.getByTestId('ledger-save').click();await expect(page.getByTestId('ledger-feedback')).toContainText('LEDGER_REVERSE_CREDITS_FIRST');checks++;
   await page.getByTestId('ledger-targetId').selectOption('K1');await ledgerSave();
   await ledgerFill('CREDIT',{id:'K2',date:'2026-08-06',chargeId:'C1',reference:'CREDIT-2',reason:'Synthetic corrected reduction',amount:'10.00'});await ledgerSave();
   await page.getByTestId('bank-open').click();
   await page.getByTestId('bank-periodStart').fill('2026-08-01');await page.getByTestId('bank-periodEndExclusive').fill('2026-09-01');
   await page.getByTestId('bank-accountRef').fill('Synthetic rent account');await page.getByTestId('bank-sourceRef').fill('Synthetic statement');await page.getByTestId('bank-reviewRef').fill('Synthetic statement review');
   for(const [i,id,reference,date,amount,direction,link] of [[0,'BC','credit-source','2026-08-01','120.51','CREDIT','R1'],[1,'BD','debit-source','2026-08-03','20.25','DEBIT','F2']]){
    await page.getByTestId('bank-add').click();
    for(const [key,value] of Object.entries({id,reference,date,amount}))await page.getByTestId(`bank-${key}-${i}`).fill(value);
    await page.getByTestId(`bank-direction-${i}`).selectOption(direction);await page.getByTestId(`bank-link-${i}`).selectOption(link);
   }
   await page.getByTestId('bank-confirm').check();await page.getByTestId('bank-save').click();await expect(page.getByTestId('bank-feedback')).toHaveText('تم حفظ الكشف وإعادة المطابقة.');checks++;
   await expect(page.getByTestId('bank-status')).toHaveText('فروق أو حركات تحتاج مراجعة');checks++;
   const mismatchedBank=JSON.parse(await download(page,page.getByTestId('bank-export')));
   ok(mismatchedBank.result.rows[0].status==='AMOUNT_MISMATCH'&&mismatchedBank.result.unmatchedLedgerIds.includes('R1'),'one halala difference blocks matching');
   await page.getByTestId('bank-amount-0').fill('120.50');await expect(page.getByTestId('bank-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('bank-sourceRef').fill('Synthetic corrected statement');await page.getByTestId('bank-reviewRef').fill('Synthetic corrected review');
   await page.getByTestId('bank-save').click();await expect(page.getByTestId('bank-feedback')).toContainText('EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED');checks++;
   await page.getByTestId('bank-confirm').check();await page.getByTestId('bank-save').click();await expect(page.getByTestId('bank-status')).toHaveText('مطابقة الحركات الإيجارية المدخلة فقط');checks++;
   const bankMatched=JSON.parse(await download(page,page.getByTestId('bank-export')));
   ok(bankMatched.result.status==='MATCHED_ENTERED_RENT_MOVEMENTS'&&bankMatched.result.totalsMinor.creditDifference===0&&bankMatched.result.totalsMinor.debitDifference===0&&!bankMatched.result.actualBankBalance&&!bankMatched.result.coverageComplete,'receipt and refund match exactly without claiming bank balance or completeness');
   await expect(page.getByTestId('bank-balance-status')).toHaveText('الأرصدة غير مدخلة — لم تُجر مطابقتها');checks++;
   await page.getByTestId('bank-balance-control').check();await page.getByTestId('bank-openingAmount').fill('100.00');await page.getByTestId('bank-closingAmount').fill('200.26');
   await page.getByTestId('bank-sourceRef').fill('Synthetic opening and closing statement');await page.getByTestId('bank-reviewRef').fill('Synthetic balance review');
   await page.getByTestId('bank-confirm').check();await page.getByTestId('bank-save').click();await expect(page.getByTestId('bank-balance-status')).toHaveText('فرق في مطابقة الأرصدة المدخلة');checks++;
   await expect(page.getByTestId('bank-balance-difference')).toHaveText('0.01');checks++;
   await expect(page.getByTestId('bank-status')).toHaveText('فروق أو حركات تحتاج مراجعة');checks++;
   await page.getByTestId('bank-closingAmount').fill('200.25');await expect(page.getByTestId('bank-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('bank-sourceRef').fill('Synthetic corrected balance statement');await page.getByTestId('bank-reviewRef').fill('Synthetic corrected balance review');
   await page.getByTestId('bank-confirm').check();await page.getByTestId('bank-save').click();await expect(page.getByTestId('bank-balance-status')).toHaveText('الأرصدة المدخلة متطابقة حسابيًا فقط');checks++;
   const bankBalanced=JSON.parse(await download(page,page.getByTestId('bank-export')));
   ok(bankBalanced.result.balanceReconciliation.calculatedClosingMinor===20025&&bankBalanced.result.balanceReconciliation.differenceMinor===0&&!bankBalanced.result.actualBankBalance,'statement balance arithmetic matches without authenticating actual bank balance');
   const ledgerCase=JSON.parse(await download(page,page.getByRole('button',{name:ar.riai.exportOperatingCase,exact:true})));
   await importOperating(ledgerCase);
   if(await page.getByTestId('bank-open').locator('..').getAttribute('open')===null)await page.getByTestId('bank-open').click();
   const bankRestored=JSON.parse(await download(page,page.getByTestId('bank-export')));
   ok(bankRestored.result.status==='MATCHED_ENTERED_RENT_MOVEMENTS'&&bankRestored.sourceOperatingCase.bankRentStatement.entries.length===2,'snapshot round trip preserves bank statement and recomputes matching');
   ok(bankRestored.sourceOperatingCase.bankRentStatement.balances.closingMinor===20025&&bankRestored.result.balanceReconciliation.status==='MATCHED_ENTERED_BALANCES','snapshot preserves explicit balances and recomputes arithmetic');
   const restored=JSON.parse(await download(page,page.getByTestId('ledger-export')));
   ok(restored.result.totalsMinor.outstanding===9025&&restored.sourceOperatingCase.capitalPaymentPlan.entries[0].amountMinor===1200000,'snapshot round trip preserves ledger and capital payment plan');
   ok(restored.result.totalsMinor.credited===1000&&restored.result.creditRows[0].id==='K2'&&restored.result.reversedIds.includes('K1'),'documented reduction and correction survive snapshot round trip');
   ok(restored.sourceOperatingCase.cashScenario.openingMinor===100000&&restored.sourceOperatingCase.cashScenario.entries[0].amountMinor===2000025,'cash assumptions survive ledger updates and snapshot import');
   ok(restored.sourceOperatingCase.cashScenario.otherFlows.entries.length===4&&restored.sourceOperatingCase.cashScenario.otherFlows.categoryReviews.every(r=>r.status!=='NOT_REVIEWED'),'additional sourced flows and explicit category reviews survive ledger updates and snapshot replay');
   const restoredOtherCash=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(restoredOtherCash.result.cashScenario.closingMinor===2590000&&restoredOtherCash.result.cashScenario.liquidity.minimumMinor===100000,'replayed snapshot recomputes monthly and daily balances including additional flows');
   ok(restored.sourceOperatingCase.operatingPaymentPlan.entries[0].amountMinor===300000,'operating payment plan survives ledger changes and import/export');
   ok(restored.sourceOperatingCase.operatingPaymentPlan.budgetControl.periodStart==='2026-09-01'&&restored.sourceOperatingCase.operatingPaymentPlan.budgetControl.items[0].amountMinor===300000,'period budget survives ledger changes and snapshot replay');
   ok(restored.result.totalsMinor.refunded===2025&&restored.result.refundRows[0].id==='F2'&&restored.result.reversedIds.includes('F1'),'refund and correction survive snapshot round trip');
   await page.getByTestId('future-open').click();
   await page.getByTestId('future-previous').selectOption('LEASE-1');await page.getByTestId('future-tenant').selectOption('TENANT-1');
   for(const[key,value]of Object.entries({leaseId:'LEASE-NEXT',startDate:'2026-12-01',endDate:'2028-02-01',baseRent:'١٬٤٤٠٬٠٠٠',sourceRef:'Synthetic signed successor',adoptionDecisionRef:'Synthetic successor review'}))await page.getByTestId(`future-${key}`).fill(value);
   await page.getByTestId('future-confirm').check();await page.getByTestId('future-save').click();await expect(page.getByTestId('future-feedback')).toContainText('FUTURE_LEASE_DATES_INVALID');checks++;
   await page.getByTestId('future-startDate').fill('2027-02-01');await expect(page.getByTestId('future-confirm')).not.toBeChecked();checks++;
   await page.getByTestId('future-confirm').check();await page.getByTestId('future-save').click();await expect(page.getByTestId('future-feedback')).toHaveText('تم حفظ العقد اللاحق.');checks++;
   const successor=JSON.parse(await download(page,page.getByTestId('export-contract-runoff')));
   ok(successor.result.rows[4].contractRent===0&&successor.result.rows[5].contractRent===120000&&successor.result.totals.contractRent===1250000,'documented successor contributes only after its start, retaining the vacancy gap');
   ok(successor.sourceOperatingCase.receivablesLedger.events.length===10&&successor.sourceOperatingCase.capitalPaymentPlan.entries.length===1&&successor.sourceOperatingCase.leases.length===2,'successor save preserves ledger and capital plan');
   await expect(page.getByTestId('lease-calendar-uncovered')).toHaveText('31');checks++;
   const leaseCalendarSuccessor=JSON.parse(await download(page,page.getByTestId('lease-calendar-export')));
   ok(leaseCalendarSuccessor.result.unitRows[0].gaps[0].start==='2027-01-01'&&leaseCalendarSuccessor.result.unitRows[0].gaps[0].endExclusive==='2027-02-01'&&!leaseCalendarSuccessor.result.actualVacancyEstablished,'documented successor closes coverage only from its start date');
   await page.getByTestId('future-leaseId').fill('UNSAVED-NEXT');await page.getByTestId('future-confirm').check();
   await page.getByTestId('ledger-id').fill('UNSAVED-LEDGER');await page.getByTestId('ledger-confirm').check();
   await page.getByTestId('operating-budget-start').fill('2026-10-01');await page.getByTestId('operating-source').fill('UNSAVED-OPERATING');await page.getByTestId('operating-confirm').check();
   await importOperating(envelope);await expect(page.getByTestId('schedule-lease')).toHaveValue('');checks++;
   await expect(page.getByTestId('ledger-id')).toHaveValue('');checks++;await expect(page.getByTestId('ledger-confirm')).not.toBeChecked();checks++;
   await expect(page.getByTestId('operating-source')).toHaveValue('');checks++;await expect(page.getByTestId('operating-budget-enabled')).not.toBeChecked();checks++;await expect(page.getByTestId('operating-confirm')).not.toBeChecked();checks++;
   await expect(page.getByTestId('capital-source')).toHaveValue('');checks++;await expect(page.getByTestId('capital-confirm')).not.toBeChecked();checks++;
   await expect(page.getByTestId('future-leaseId')).toHaveValue('');checks++;await expect(page.getByTestId('future-confirm')).not.toBeChecked();checks++;
   await expect(page.getByTestId('schedule-confirm')).not.toBeChecked();checks++;
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'operating workspace has no page-level overflow');
   const zakat=page.getByTestId('zakat-annual-amount');
   await zakat.fill('١٬٨٠٠٫٥');await page.getByTestId('zakat-amount-source').selectOption('ACCOUNTANT');
   const zakatReport=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(zakatReport.financial.zakat.layer.annualZakatAmount===1800.5,'Arabic decimal reaches the current zakat layer without destructive stripping');
   await zakat.fill('1e3');await zakat.blur();
   await expect(zakat).toHaveValue('1e3');await expect(zakat).toHaveAttribute('aria-invalid','true');checks+=2;
   const invalidZakat=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(invalidZakat.financial.zakat.status==='ZAKAT_INPUTS_INVALID'&&invalidZakat.financial.zakat.layer===null,'invalid current zakat never exports the previous valid zakat layer');
   await zakat.fill('۰');await page.getByTestId('zakat-amount-source').selectOption('ACCOUNTANT');
   const zeroZakat=JSON.parse(await download(page,page.getByTestId('c75-export-personal-json')));
   ok(zeroZakat.financial.zakat.layer.annualZakatAmount===0,'explicit Persian zero is preserved');
   await captureDocument(page,`${DIR}/${name}-${viewport.width}`);
   ok(errors.length===0,`${name} pageerrors: ${errors.join(' | ')}`);ok(external.length===0,'document module sends no external POST uploads');
   evidence.push({engine:name,viewport,checksCompleted:checks,pageErrors:errors.length,externalPosts:external.length,physicalDevice:false});await context.close();
  }}finally{await browser.close();}
 }
 await fs.writeFile(DIR+'/acceptance.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checks,browsers:evidence,physicalDevicesTested:false,screenReaderTested:false,marketDataVerified:false},null,2));
 console.log(`AUDIT_REMAINING_BROWSER=PASS checks=${checks}`);
})().catch(async e=>{console.error(e);await fs.mkdir(DIR,{recursive:true});await fs.writeFile(DIR+'/failure.json',JSON.stringify({sourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,checksCompleted:checks,error:e.message},null,2));process.exit(1);});
