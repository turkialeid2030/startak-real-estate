'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium, expect } = require('@playwright/test');
const gold = require('../reference/RE-GOLD-baseline.json');
const ar = require('../../src/i18n/locales/ar-SA');
const { verifyPersonalFinancialStudy } = require('../../src/app/personal-financial-study');
const BASE = process.env.STARTAK_E2E_URL || 'http://127.0.0.1:4173';
const NAME = 'AUDIT ONLY 20261010 OFFICE / عقار';
const PROJECT = 'DRAFT-F06-NOT-APPLIED';
const namespace = require('../../src/storage/browser-local-storage-provider').NAMESPACE;
const EVIDENCE_DIR = 'runtime-evidence/remaining-audit';
// This suite uses a new isolated browser context and synthetic records only.
// Do not reuse this evidence collector against an authenticated user session.
async function capturePageState(page) {
  return page.evaluate(() => ({
    url: location.origin + location.pathname,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    title: document.title,
    documentSourceCommit: document.querySelector('meta[name="startak-source-commit"]')?.content || null,
    studyVisible: Boolean(document.querySelector('[data-testid="c75-personal-research-workspace"]')),
    headerButtons: [...document.querySelectorAll('header button')].map(button => ({
      title: button.getAttribute('title'), label: button.getAttribute('aria-label'),
      text: button.textContent.slice(0,200), disabled: button.disabled,
    })),
    scripts: [...document.scripts].map(script => script.getAttribute('src')).filter(Boolean),
  }));
}
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
async function download(page, locator) {
  const pending = page.waitForEvent('download');
  await locator.click();
  const file = await pending;
  return fs.readFile(await file.path(), 'utf8');
}
async function openDeals(page) {
  await page.getByTitle(ar.actions.savedDeals, { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: ar.savedDeals.panelTitle });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function loadSaved(page) {
  const dialog = await openDeals(page);
  await dialog.getByRole('button', { name: NAME, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function jsonReport(page) {
  return JSON.parse(await download(page, page.getByTestId('c75-export-personal-json')));
}
async function openPurchaseInputs(page) {
  const section=page.getByRole('button',{name:ar.inputBuilding.sec2,exact:false});
  if(await section.getAttribute('aria-expanded')!=='true')await section.click();
  await expect(section).toHaveAttribute('aria-expanded','true');
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 1366, height: 960 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'ar-SA', acceptDownloads: true });
      const page = await context.newPage();
      const errors = [];
      const diagnostics={expectedSourceCommit:process.env.STARTAK_SOURCE_COMMIT||null,viewport,consoleErrors:[],failedRequests:[],responses:[],states:[]};
      page.on('pageerror', error => errors.push(error.message));
      const safeUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return 'INVALID_URL';}};
      page.on('console',message=>{if(message.type()==='error'&&diagnostics.consoleErrors.length<30)diagnostics.consoleErrors.push(message.text().slice(0,1000));});
      page.on('requestfailed',request=>{if(diagnostics.failedRequests.length<30)diagnostics.failedRequests.push({url:safeUrl(request.url()),error:request.failure()?.errorText});});
      page.on('response',response=>{
        if(['document','script'].includes(response.request().resourceType())&&diagnostics.responses.length<50){
          const headers=response.headers();
          diagnostics.responses.push({url:safeUrl(response.url()),status:response.status(),cacheStatus:headers['cf-cache-status']||null,age:headers.age||null,contentType:headers['content-type']||null});
        }
      });
      try {
        const seed = { id: 'audit-f03-f07', name: NAME, mode: 'building',
          savedAt: '2026-10-10T00:00:00Z', inputs: gold['RE-GOLD-002_existing_building'].inputs };
        await context.addInitScript(({ namespace, seed }) => {
          // Seed once through the actual local saved-deal format; UI still validates and loads it.
          if (!window.localStorage.getItem(namespace + 'audit-seeded')) {
            window.localStorage.setItem(namespace + 'deal:' + seed.id, JSON.stringify(seed));
            window.localStorage.setItem(namespace + 'deals-index', JSON.stringify([{ id: seed.id, name: seed.name, mode: seed.mode, savedAt: seed.savedAt }]));
            window.localStorage.setItem(namespace + 'audit-seeded', 'true');
          }
        }, { namespace, seed });
        const navigation = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (process.env.STARTAK_SOURCE_COMMIT) {
          const documentCommit = await page.locator('meta[name="startak-source-commit"]').getAttribute('content');
          ok(documentCommit === process.env.STARTAK_SOURCE_COMMIT, 'entry HTML matches reviewed source before study interaction');
        }
        if (BASE.startsWith('https://')) {
          ok(/(?:^|,)\s*no-store\s*(?:,|$)/i.test(navigation.headers()['cache-control'] || ''), 'public entry document forbids storage');
        }
        await expect(page.getByTestId('c75-personal-research-workspace')).toBeVisible({ timeout: 25000 });
        diagnostics.states.push({stage:'before-saved-deals',...await capturePageState(page)});
        await loadSaved(page);
        await expect(page.locator('header [data-user-content]')).toContainText(NAME);
        checks++;
        const first = await jsonReport(page);
        if(process.env.STARTAK_SOURCE_COMMIT)ok(first.sourceBuild.sourceCommit===process.env.STARTAK_SOURCE_COMMIT,'loaded application source matches the accepted commit, not only the separately fetched manifest');
        ok(verifyPersonalFinancialStudy(first), 'browser export fingerprint verifies in independent Node runtime');
        ok(first.version === 'PERSONAL_FINANCIAL_STUDY_V2' && first.dealName === NAME, 'full financial report preserves original name');
        ok(first.financial.results.NOI > 0 && first.financial.annualCashflows.length === 6, 'real UI exports financial engine and all study years');
        ok(first.financial.experiments.sensitivity.length === 3, 'browser export includes calculated sensitivities');
        await expect(page.getByTestId('methodology-criteria-count')).toContainText(String(first.financial.results.totalCriteria));
        checks++;
        ok(first.financial.payback.cumulativeOperatingWithinStudyYears === null && first.financial.payback.cumulativeWithTerminalSaleYears === 5,
          'sale-dependent recovery does not claim operating recovery');
        await expect(page.getByTestId('payback-disclosure')).toContainText('استرداد بسيط');
        await expect(page.getByTestId('payback-disclosure')).toContainText('غير متحقق');
        checks += 2;

        // Re-audit N01/N02: drive actual controlled inputs and downloaded
        // current-input reports, not only the standalone numeric helper.
        const rentInput = page.getByLabel(new RegExp(ar.inputBuilding.rentPerSqm)).first();
        if (!await rentInput.isVisible()) await page.getByRole('button', { name: new RegExp(ar.inputBuilding.sec3) }).click();
        for (const raw of ['1800.5', '١٨٠٠٫٥', '۱٬۸۰۰٫۵']) {
          await rentInput.fill(raw);
          await expect(rentInput).toHaveValue(raw); checks++;
          const numeric = await jsonReport(page);
          ok(numeric.financial.inputs.rentPerSqm === 1800.5 && numeric.financial.results !== null,
            'English, Arabic and Persian rent decimals retain identical value');
        }
        for (const raw of ['1e3', '١٨٠٠٫٥٫٢', '1,80']) {
          await rentInput.fill(raw);
          await expect(rentInput).toHaveValue(raw);
          await expect(rentInput).toHaveAttribute('aria-invalid', 'true'); checks += 2;
          await expect(page.getByTestId('current-calculation-unavailable').first()).toBeVisible();
          await expect(page.getByTestId('building-price-boundary')).toHaveCount(0);
          await expect(page.getByTestId('building-price-alternative-value')).toHaveCount(0);
          await expect(page.getByTestId('building-price-review-invalid')).toHaveCount(0); checks += 4;
          await expect(page.getByTestId('building-price-certificate-value')).toHaveCount(0);checks++;
          const invalidNumeric = await jsonReport(page);
          ok(invalidNumeric.financial.status === 'INPUTS_INVALID' && invalidNumeric.financial.results === null
            && invalidNumeric.financial.inputs.rentPerSqm === raw && invalidNumeric.financial.annualCashflows.length === 0,
            'malformed raw input is retained and cannot export stale valid calculations');
        }
        await rentInput.fill(String(seed.inputs.rentPerSqm));
        await openPurchaseInputs(page);
        const boundaryInput = page.getByLabel(/قيمة شراء المبنى/).first();
        await boundaryInput.fill(String(first.financial.results.maxJustifiedPrice));
        const atBoundary = await jsonReport(page);
        ok(atBoundary.financial.results.c1 && atBoundary.financial.results.c2,
          'UI purchase boundary meets exactly the advertised yield and cumulative-payback constraints');
        await expect(page.getByTestId('building-price-constraint')).toContainText('شرطي العائد الصافي والاسترداد فقط'); checks++;
        await boundaryInput.fill(String(first.financial.results.maxJustifiedPrice + 1));
        const aboveBoundary = await jsonReport(page);
        ok(!aboveBoundary.financial.results.c1 || !aboveBoundary.financial.results.c2,
          'one riyal above UI boundary fails at least one advertised purchase constraint');
        await boundaryInput.fill(String(seed.inputs.buildingPrice));

        await page.getByTestId('valuation-v1-configure').click();
        const project = page.getByPlaceholder('أدخل معرّف المشروع', { exact: true });
        await project.fill(PROJECT);
        await project.fill('X'.repeat(32001));
        await expect(project).toHaveValue(PROJECT);
        await expect(page.getByTestId('valuation-draft-edit-error')).toContainText('INVALID_VALUATION_EDITOR_DRAFT');
        checks += 2;
        await project.fill(PROJECT + '-RECOVERED');
        await expect(page.getByTestId('valuation-draft-edit-error')).not.toBeVisible();
        await project.fill(PROJECT);
        checks++;
        await page.getByTestId('valuation-v1-apply').click();
        await expect(page.getByTestId('valuation-v1-panel').locator('[data-diagnostic-content]')).toContainText('INVALID_ENUM');
        await expect(page.getByTestId('valuation-v1-panel')).toContainText('اختر قيمة مدعومة');
        checks += 2;
        await page.getByRole('button', { name: ar.mode.land, exact: true }).click();
        await expect(page.getByTestId('building-valuation-draft-container')).toBeHidden();
        const land = await jsonReport(page);
        ok(land.financial.mode === 'land' && verifyPersonalFinancialStudy(land), 'land mode also exports current-input financial report');
        await expect(page.getByTestId('methodology-criteria-count')).toContainText(String(land.financial.results.totalCriteria));
        checks++;
        const landName = 'AUDIT F06 LAND DELETE';
        let landDialog = await openDeals(page);
        await landDialog.getByPlaceholder(ar.savedDeals.namePlaceholder, { exact: true }).fill(landName);
        await landDialog.getByRole('button', { name: ar.savedDeals.saveButton, exact: true }).click();
        const landButton = landDialog.getByRole('button', { name: landName, exact: true });
        await expect(landButton).toBeVisible();
        const buildingRecordBefore = await page.evaluate(namespace => localStorage.getItem(namespace + 'deal:audit-f03-f07'), namespace);
        await landButton.locator('..').getByRole('button', { name: ar.globalApp.deleteDeal, exact: true }).click();
        await expect(landButton).not.toBeVisible();
        const buildingRecordAfter = await page.evaluate(namespace => localStorage.getItem(namespace + 'deal:audit-f03-f07'), namespace);
        ok(buildingRecordBefore === buildingRecordAfter, 'deleting an active land deal does not write or delete the building record');
        await landDialog.getByRole('button', { name: ar.globalApp.closePanel, exact: true }).click();
        await page.getByRole('button', { name: ar.mode.building, exact: true }).click();
        await expect(project).toHaveValue(PROJECT);
        await expect(page.locator('header [data-user-content]')).toContainText(NAME);
        checks += 2;

        let dialog = await openDeals(page);
        await dialog.getByRole('button', { name: ar.savedDeals.updateButton, exact: true }).click();
        const backupText = await download(page, dialog.getByRole('button', { name: ar.savedDeals.exportBackup, exact: true }));
        const backup = JSON.parse(backupText);
        ok(backup.deals[0].valuationEditorDraft.base.projectId === PROJECT && backup.deals[0].valuationEditorDraft.status === 'UNAPPLIED_NOT_VERIFIED',
          'actual saved-deal backup contains unapplied partial draft without promoting it');
        ok(backup.deals[0].name === NAME, 'actual downloaded backup preserves mixed-language name exactly');
        await dialog.getByRole('button', { name: ar.globalApp.closePanel, exact: true }).click();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('c75-personal-research-workspace')).toBeVisible();
        await loadSaved(page);
        await page.getByTestId('valuation-v1-configure').click();
        await expect(project).toHaveValue(PROJECT);
        checks++;
        // Restore the downloaded file into cleared application storage through the actual file input.
        await page.evaluate(namespace => {
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith(namespace) && key !== namespace + 'audit-seeded') window.localStorage.removeItem(key);
          }
        }, namespace);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('c75-personal-research-workspace')).toBeVisible();
        dialog = await openDeals(page);
        await dialog.locator('input[type="file"]').setInputFiles({ name: 'restored-f06.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
        await expect(dialog).toContainText(ar.savedDeals.importSuccess);
        await dialog.getByRole('button', { name: NAME, exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByTestId('valuation-v1-configure').click();
        await expect(project).toHaveValue(PROJECT);
        checks++;
        const restored = await jsonReport(page);
        ok(restored.valuationEditorDraft.base.projectId === PROJECT && restored.valuationReport.preliminaryValue === null,
          'restored editor data is exported as an unapplied draft, never a computed valuation');
        const html = await download(page, page.getByTestId('c75-export-personal-html'));
        ok(html.includes('التدفقات السنوية') && html.includes('الحساسية') && html.includes(NAME) && html.includes('dir="rtl"'),
          'standalone financial HTML contains name, cashflows, sensitivity and Arabic direction');

        await openPurchaseInputs(page);
        const price = page.getByLabel(/قيمة شراء المبنى/).first();
        await price.fill('-1');
        await expect(page.getByTestId('personal-financial-input-hold')).toBeVisible();
        const invalid = await jsonReport(page);
        ok(invalid.financial.inputs.buildingPrice === -1 && invalid.financial.results === null && invalid.financial.annualCashflows.length === 0,
          'invalid current price cannot export previously valid results');
        ok(verifyPersonalFinancialStudy(invalid), 'invalid-input draft is still an internally consistent report');
        ok(errors.length === 0, 'no React/browser page exception');
        console.log('AUDIT_F03_F07_CHROMIUM_VIEWPORT=PASS width=' + viewport.width);
      } catch(error) {
        diagnostics.failure=String(error.stack||error).slice(0,8000);
        try {
          diagnostics.states.push({stage:'failure',...await capturePageState(page)});
          await fs.mkdir(EVIDENCE_DIR,{recursive:true});
          await page.screenshot({path:`${EVIDENCE_DIR}/owner-study-failure-${viewport.width}.png`,fullPage:false,timeout:5000});
        } catch(captureError) { diagnostics.captureError=String(captureError.message||captureError).slice(0,1000); }
        throw error; // Evidence failure must never replace or suppress the test failure.
      } finally {
        try {
          await fs.mkdir(EVIDENCE_DIR,{recursive:true});
          await fs.writeFile(`${EVIDENCE_DIR}/owner-study-diagnostics-${viewport.width}.json`,JSON.stringify({...diagnostics,pageErrors:errors},null,2));
        } catch(e) { console.error('OWNER_STUDY_DIAGNOSTICS_WRITE_FAILED',e.message); }
        await context.close();
      }
    }
    // Reproduce the observed production MIME failure in isolated synthetic
    // sessions. Normal acceptance above still requires zero page errors.
    for (const width of [1366, 390]) {
      for (const target of [
        { chunk: 'CanonicalCaseWorkspacePanel', surface: 'canonical', healthy: 'local-document-evidence-workspace', recovered: 'canonical-case-workspace-panel' },
        { chunk: 'LocalDocumentEvidenceWorkspace', surface: 'documents', healthy: 'canonical-case-workspace-panel', recovered: 'local-document-evidence-workspace' },
      ]) {
        const context = await browser.newContext({ viewport: { width, height: 960 }, locale: 'ar-SA', acceptDownloads: true });
        try {
          let intercepted = 0;
          const pattern = `**/assets/${target.chunk}-*.js`;
          await context.route(pattern, route => {
            intercepted++;
            return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Asset unavailable</title>' });
          });
          const page = await context.newPage();
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          const warning = page.getByTestId(`workspace-unavailable-${target.surface}`);
          await expect(warning).toBeVisible({ timeout: 25000 }); checks++;
          ok(intercepted > 0, 'actual module request received simulated HTML');
          await expect(page.getByTestId(target.healthy)).toBeVisible(); checks++;
          const dialog = await openDeals(page);
          await dialog.getByRole('button', { name: ar.globalApp.closePanel, exact: true }).click(); checks++;
          await openPurchaseInputs(page);
          const price = page.getByLabel(/قيمة شراء المبنى/).first();
          await price.fill('1234567');
          await expect(price).toHaveValue('1234567'); checks++;
          const report = await jsonReport(page);
          ok(report.financial.inputs.buildingPrice === 1234567 && verifyPersonalFinancialStudy(report), 'study input and verified export survive sibling module failure');
          await expect(warning).toContainText('احفظ عملك'); checks++;
          // Recovery is explicit and only after exporting the edited work.
          await context.unroute(pattern);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId(target.recovered)).toBeVisible({ timeout: 25000 });
          await expect(warning).not.toBeVisible(); checks++;
          console.log(`WORKSPACE_MIME_ISOLATION=PASS surface=${target.surface} width=${width}`);
        } finally { await context.close(); }
      }
    }
    console.log('AUDIT_F03_F07_REAL_CHROMIUM=PASS checks=' + checks);
  } finally { await browser.close(); }
})().catch(error => { console.error('AUDIT_F03_F07_REAL_CHROMIUM=FAIL', error); process.exitCode = 1; });
