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

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 1366, height: 960 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'ar-SA', acceptDownloads: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
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
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await expect(page.getByTestId('c75-personal-research-workspace')).toBeVisible({ timeout: 25000 });
        await loadSaved(page);
        await expect(page.locator('header [data-user-content]')).toContainText(NAME);
        checks++;
        const first = await jsonReport(page);
        ok(verifyPersonalFinancialStudy(first), 'browser export fingerprint verifies in independent Node runtime');
        ok(first.version === 'PERSONAL_FINANCIAL_STUDY_V2' && first.dealName === NAME, 'full financial report preserves original name');
        ok(first.financial.results.NOI > 0 && first.financial.annualCashflows.length === 6, 'real UI exports financial engine and all study years');
        ok(first.financial.experiments.sensitivity.length === 3, 'browser export includes calculated sensitivities');
        ok(first.financial.payback.cumulativeOperatingWithinStudyYears === null && first.financial.payback.cumulativeWithTerminalSaleYears === 5,
          'sale-dependent recovery does not claim operating recovery');
        await expect(page.getByTestId('payback-disclosure')).toContainText('استرداد بسيط');
        await expect(page.getByTestId('payback-disclosure')).toContainText('غير متحقق');
        checks += 2;

        await page.getByTestId('valuation-v1-configure').click();
        const project = page.getByPlaceholder('أدخل معرّف المشروع', { exact: true });
        await project.fill(PROJECT);
        await page.getByTestId('valuation-v1-apply').click();
        await expect(page.getByTestId('valuation-v1-panel').locator('[data-diagnostic-content]')).toContainText('INVALID_ENUM');
        await expect(page.getByTestId('valuation-v1-panel')).toContainText('اختر قيمة مدعومة');
        checks += 2;
        await page.getByRole('button', { name: ar.mode.land, exact: true }).click();
        await expect(page.getByTestId('building-valuation-draft-container')).toBeHidden();
        const land = await jsonReport(page);
        ok(land.financial.mode === 'land' && verifyPersonalFinancialStudy(land), 'land mode also exports current-input financial report');
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

        const price = page.getByLabel(/قيمة شراء المبنى/).first();
        await price.fill('-1');
        await expect(page.getByTestId('personal-financial-input-hold')).toBeVisible();
        const invalid = await jsonReport(page);
        ok(invalid.financial.inputs.buildingPrice === -1 && invalid.financial.results === null && invalid.financial.annualCashflows.length === 0,
          'invalid current price cannot export previously valid results');
        ok(verifyPersonalFinancialStudy(invalid), 'invalid-input draft is still an internally consistent report');
        ok(errors.length === 0, 'no React/browser page exception');
        console.log('AUDIT_F03_F07_CHROMIUM_VIEWPORT=PASS width=' + viewport.width);
      } finally { await context.close(); }
    }
    console.log('AUDIT_F03_F07_REAL_CHROMIUM=PASS checks=' + checks);
  } finally { await browser.close(); }
})().catch(error => { console.error('AUDIT_F03_F07_REAL_CHROMIUM=FAIL', error); process.exitCode = 1; });
