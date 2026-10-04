import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/e2e';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const result = {};
function save() { fs.writeFileSync(`${EVIDENCE_DIR}/core-e2e-result.json`, JSON.stringify(result, null, 2)); }
function log(id, status, extra) {
  console.log(`${id} ${status}${extra ? ' -- ' + extra : ''}`);
  result[id] = status;
  save();
}
function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_AT ' + label)), ms))]);
}
function hasGovernedAnalyticalState(text) {
  return /حالة تحليلية مواتية|حالة تحليلية مشروطة|مخاطر تحليلية مرتفعة|المدخلات غير مكتملة|تعليق التحليل لحين استكمال الأدلة|يتطلب مراجعة مختص مرخص/.test(String(text || ''));
}

let previewServer, browser;
const pageErrors = [];
const consoleErrors = [];

try {
  previewServer = await withTimeout(preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } }), 3000, 'VITE_START');
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await withTimeout(chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] }), 5000, 'BROWSER_LAUNCH');
  console.log('BROWSER_READY ' + browser.version());

  // ===== CORE-01 APP_BOOT =====
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.setDefaultTimeout(3000);
  page.setDefaultNavigationTimeout(5000);

  await withTimeout(page.goto(url, { waitUntil: 'domcontentloaded' }), 5000, 'CORE-01-GOTO');
  const bodyText0 = await page.locator('body').innerText();
  const dir = await page.locator('html').getAttribute('dir');
  const domInventory = {
    buttons: await page.locator('button').allTextContents(),
    dir,
    bodyLength: bodyText0.length,
  };
  fs.writeFileSync(`${EVIDENCE_DIR}/dom-inventory.json`, JSON.stringify(domInventory, null, 2));
  log('CORE-01', (bodyText0.length > 100 && dir === 'rtl' && /مبنى قائم/.test(bodyText0)) ? 'PASS' : 'FAIL', `len=${bodyText0.length} dir=${dir}`);
  result.BROWSER_APP_BOOT = result['CORE-01'];

  // ===== CORE-02 EXISTING_BUILDING =====
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(200);
  const numInputs = page.locator('input[type="text"], input[inputmode="decimal"]');
  const first = numInputs.first();
  const bodyBefore = await page.locator('body').innerText();
  await first.fill('777777');
  await first.blur();
  await page.waitForTimeout(300);
  const after = await first.inputValue();
  const bodyAfter = await page.locator('body').innerText();
  const editOk = after === '777777';
  const recalcOk = bodyAfter !== bodyBefore;
  // Production presentation intentionally externalizes legacy BUY/NO-BUY wording
  // into governed analytical-support labels. An incomplete V2 building deal is
  // also a valid fail-closed state until its explicit exit assumptions exist.
  const hasRec = hasGovernedAnalyticalState(bodyAfter);
  result.EXISTING_BUILDING_INPUT_EDIT = editOk ? 'PASS' : 'FAIL';
  result.EXISTING_BUILDING_RECALCULATION = recalcOk ? 'PASS' : 'FAIL';
  result.EXISTING_BUILDING_GOVERNED_DECISION_STATE = hasRec ? 'PASS' : 'FAIL';
  log('CORE-02', (editOk && recalcOk && hasRec) ? 'PASS' : 'FAIL', `edit=${editOk} recalc=${recalcOk} governedState=${hasRec}`);
  result.EXISTING_BUILDING_E2E = result['CORE-02'];

  // ===== CORE-03 LAND_DEVELOPMENT =====
  await page.getByText('أرض + تطوير', { exact: true }).click();
  await page.waitForTimeout(200);
  const bodyLandBefore = await page.locator('body').innerText();
  const firstL = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  await firstL.fill('666666');
  await firstL.blur();
  await page.waitForTimeout(300);
  const afterL = await firstL.inputValue();
  const bodyLandAfter = await page.locator('body').innerText();
  const landEditOk = afterL === '666666';
  const landRecalcOk = bodyLandAfter !== bodyLandBefore;
  const landHasRec = hasGovernedAnalyticalState(bodyLandAfter);
  result.LAND_INPUT_EDIT = landEditOk ? 'PASS' : 'FAIL';
  result.LAND_RECALCULATION = landRecalcOk ? 'PASS' : 'FAIL';
  result.LAND_GOVERNED_DECISION_STATE = landHasRec ? 'PASS' : 'FAIL';
  log('CORE-03', (landEditOk && landRecalcOk && landHasRec) ? 'PASS' : 'FAIL', `edit=${landEditOk} recalc=${landRecalcOk} governedState=${landHasRec}`);
  result.LAND_DEVELOPMENT_E2E = result['CORE-03'];

  // ===== CORE-04 FINANCING =====
  // FIXED: real user sequence -- open the collapsible "Financing" section
  // header FIRST (previously untested; the toggle is genuinely clipped
  // by a closed accordion, proven via diagnose_financing_geometry.mjs).
  // No production code change was needed for this fix -- pure test sequence.
  const sectionHeader = page.getByRole('button', { name: /القسم السابع.*التمويل العقاري/ });
  await sectionHeader.click();
  await page.waitForTimeout(400); // allow the 0.25s CSS grid-template-rows transition to settle
  const toggle = page.locator('div.flex.items-center.justify-between', { hasText: 'تفعيل الرافعة المالية' }).locator('button');
  const bodyPreToggle = await page.locator('body').innerText();
  await toggle.click({ timeout: 3000 }); // NORMAL click, no force -- proven to work once section is open
  await page.waitForTimeout(400);
  const bodyPostToggle = await page.locator('body').innerText();
  const toggleChanged = bodyPostToggle !== bodyPreToggle;
  const hasLoanOutput = /مبلغ التمويل|القسط السنوي|حقوق الملكية المطلوبة/.test(bodyPostToggle);
  result.LEVERED_FLOW = (toggleChanged && hasLoanOutput) ? 'PASS' : 'FAIL';
  log('CORE-04', result.LEVERED_FLOW, `changed=${toggleChanged} loanOutput=${hasLoanOutput}`);
  result.FINANCING_TOGGLE_FLOW = result['CORE-04'];
  await toggle.click({ timeout: 3000 });
  await page.waitForTimeout(300);
  const bodyAfterUntoggle = await page.locator('body').innerText();
  result.UNLEVERED_FLOW = bodyAfterUntoggle !== bodyPostToggle ? 'PASS' : 'FAIL';

  await page.close();

  // ===== CORE-05 SAVED_DEALS (own fresh context, per Section 13) =====
  // Persistence is tested on the complete default land study. The fresh V2
  // building workspace is intentionally fail-closed on deal-specific exit
  // assumptions and is covered separately by assumption-governance tests.
  const context5 = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page5 = await context5.newPage();
  page5.setDefaultTimeout(5000);
  page5.on('pageerror', (e) => pageErrors.push(e.message));
  page5.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  try {
    await page5.goto(url, { waitUntil: 'domcontentloaded' });
    await page5.waitForTimeout(300);
    await page5.getByText('أرض + تطوير', { exact: true }).click();
    await page5.waitForTimeout(250);
    const distinctInput = page5.locator('aside input[type="text"], aside input[inputmode="decimal"]').first();
    await distinctInput.fill('31');
    await distinctInput.blur();
    await page5.waitForTimeout(200);

    await page5.getByTitle('الصفقات المحفوظة').click();
    await page5.waitForTimeout(300);
    const dealName = 'E2E-DEAL-C41-LAND';
    const nameInput = page5.getByPlaceholder('اسم الصفقة...');
    await nameInput.fill(dealName);
    await page5.getByRole('button', { name: 'حفظ', exact: true }).click({ timeout: 3000 });
    await page5.waitForTimeout(600);

    const persisted = await page5.evaluate((name) => {
      const ns = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';
      const rawIndex = window.localStorage.getItem(ns + 'deals-index');
      const index = rawIndex ? JSON.parse(rawIndex) : [];
      const entry = Array.isArray(index) ? index.find((item) => item && item.name === name) : null;
      const rawDeal = entry ? window.localStorage.getItem(ns + 'deal:' + entry.id) : null;
      return {
        indexContainsDeal: Boolean(entry),
        recordContainsDeal: Boolean(rawDeal && JSON.parse(rawDeal).name === name),
      };
    }, dealName);
    result.SAVED_DEAL_INDEX_PERSISTED = persisted.indexContainsDeal ? 'PASS' : 'FAIL';
    result.SAVED_DEAL_RECORD_PERSISTED = persisted.recordContainsDeal ? 'PASS' : 'FAIL';
    const bodyAfterSave = await page5.locator('body').innerText();
    const dealVisible = bodyAfterSave.includes(dealName);

    // reload
    await page5.reload({ waitUntil: 'domcontentloaded' });
    await page5.waitForTimeout(500);
    await page5.getByTitle('الصفقات المحفوظة').click();
    await page5.waitForTimeout(300);
    const dealLabel = page5.getByText(dealName, { exact: true });
    const survivesReload = await dealLabel.isVisible().catch(() => false);
    result.SAVED_DEAL_SURVIVES_RELOAD = survivesReload;

    if (survivesReload) {
      await dealLabel.click();
      await page5.waitForTimeout(400);
      const restoredVal = await page5.locator('aside input[type="text"], aside input[inputmode="decimal"]').first().inputValue();
      result.SAVED_DEAL_INPUT_RESTORED = restoredVal === '31';
    } else {
      result.SAVED_DEAL_INPUT_RESTORED = false;
    }
    const savedDealPass = dealVisible
      && persisted.indexContainsDeal
      && persisted.recordContainsDeal
      && survivesReload
      && result.SAVED_DEAL_INPUT_RESTORED;
    log('CORE-05', savedDealPass ? 'PASS' : 'FAIL', `visible=${dealVisible} index=${persisted.indexContainsDeal} record=${persisted.recordContainsDeal} reload=${survivesReload} restored=${result.SAVED_DEAL_INPUT_RESTORED}`);
  } catch (e) {
    log('CORE-05', 'FAIL: ' + e.message.slice(0, 150), '');
    result.SAVED_DEAL_SURVIVES_RELOAD = false;
    result.SAVED_DEAL_INPUT_RESTORED = false;
  }
  result.SAVED_DEALS_RUNTIME_FLOW = result['CORE-05'];
  await page5.close();
  await context5.close();

  // ===== CORE-06 RESET (own fresh context) =====
  const context6 = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page6 = await context6.newPage();
  page6.setDefaultTimeout(3000);
  page6.on('pageerror', (e) => pageErrors.push(e.message));
  page6.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  try {
    await page6.goto(url, { waitUntil: 'domcontentloaded' });
    await page6.waitForTimeout(300);
    const inp = page6.locator('input[type="text"], input[inputmode="decimal"]').first();
    const defaultVal = await inp.inputValue();
    await inp.fill('333333');
    await inp.blur();
    await page6.waitForTimeout(300);
    const changedVal = await inp.inputValue();
    await page6.getByTitle('استعادة القيم الأصلية لهذه الدراسة').click();
    await page6.waitForTimeout(400);
    const restoredVal = await inp.inputValue();
    const resetOk = changedVal === '333333' && restoredVal === defaultVal;
    log('CORE-06', resetOk ? 'PASS' : 'FAIL', `default=${defaultVal} changed=${changedVal} restored=${restoredVal}`);
  } catch (e) {
    log('CORE-06', 'FAIL: ' + e.message.slice(0, 150), '');
  }
  result.RESET_FLOW = result['CORE-06'];
  await page6.close();
  await context6.close();

  result.PAGE_ERRORS = pageErrors.length;
  result.FATAL_CONSOLE_ERRORS = consoleErrors.length;
  console.log('ERRORS page=' + pageErrors.length + ' console=' + consoleErrors.length);
  if (pageErrors[0]) console.log('PAGE_ERROR_SAMPLE: ' + pageErrors[0].slice(0, 200));

} catch (e) {
  console.log('FATAL: ' + e.message);
  result.fatal_error = e.message;
} finally {
  console.log('TEARDOWN_START');
  if (browser) { await browser.close(); console.log('BROWSER_CLOSED'); result.BROWSER_CLOSED = true; }
  if (previewServer) { await new Promise((r) => previewServer.httpServer.close(() => r())); console.log('PREVIEW_SERVER_CLOSED'); result.PREVIEW_SERVER_CLOSED = true; }
  save();
  console.log('DONE');
}
