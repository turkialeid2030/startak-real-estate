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
let previewServer = null;
let browser = null;
let failed = false;

function record(id, passed, detail = null) {
  result[id] = passed ? 'PASS' : 'FAIL';
  if (detail !== null) result[`${id}_DETAIL`] = detail;
  if (!passed) failed = true;
  console.log(`${id} ${result[id]}${detail ? ` -- ${detail}` : ''}`);
}

try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  result.preview_url = url;

  const httpCheck = await fetch(url);
  record('E2E-00-HTTP', httpCheck.status === 200, `status=${httpCheck.status}`);

  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);

  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  const rootHtml = await page.locator('#root').innerHTML();
  const dir = await page.locator('html').getAttribute('dir');
  record('E2E-01-BOOT', rootHtml.length > 100 && dir === 'rtl', `htmlLen=${rootHtml.length} dir=${dir}`);

  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(200);
  const firstB = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const bodyBeforeB = await page.locator('body').innerText();
  await firstB.fill('777777');
  await firstB.blur();
  await page.waitForTimeout(300);
  const bodyAfterB = await page.locator('body').innerText();
  record('E2E-02-BUILDING', (await firstB.inputValue()) === '777777' && bodyAfterB !== bodyBeforeB && /يوصى بالشراء|لا يوصى بالشراء/.test(bodyAfterB));

  await page.getByText('أرض + تطوير', { exact: true }).click();
  await page.waitForTimeout(200);
  const firstL = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const bodyBeforeL = await page.locator('body').innerText();
  await firstL.fill('666666');
  await firstL.blur();
  await page.waitForTimeout(300);
  const bodyAfterL = await page.locator('body').innerText();
  record('E2E-03-LAND', (await firstL.inputValue()) === '666666' && bodyAfterL !== bodyBeforeL && /يوصى بالشراء|لا يوصى بالشراء/.test(bodyAfterL));

  // The leverage switch lives inside a collapsed accordion. Locate it by its
  // accessible name, open its owning Section through the Section header, then
  // exercise the actual switch state and downstream financing output.
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(250);
  const leverageButton = page.getByRole('switch', { name: 'تفعيل الرافعة المالية', exact: true });
  const leverageCount = await leverageButton.count();
  const financingSection = leverageButton.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const sectionHeader = financingSection.locator(':scope > button').first();
  await sectionHeader.click();
  await page.waitForTimeout(300);
  const checkedBefore = await leverageButton.getAttribute('aria-checked');
  await leverageButton.click();
  await page.waitForTimeout(400);
  const checkedAfter = await leverageButton.getAttribute('aria-checked');
  const equityLabels = page.getByText('حقوق الملكية المطلوبة', { exact: true });
  let visibleFinanceOutput = false;
  for (let i = 0; i < await equityLabels.count(); i++) {
    if (await equityLabels.nth(i).isVisible()) { visibleFinanceOutput = true; break; }
  }
  await leverageButton.click();
  await page.waitForTimeout(300);
  const checkedFinal = await leverageButton.getAttribute('aria-checked');
  const stateChanged = checkedBefore !== checkedAfter;
  const roundTrip = checkedFinal === checkedBefore;
  record('E2E-04-FINANCING', leverageCount === 1 && stateChanged && roundTrip && visibleFinanceOutput, `count=${leverageCount} ${checkedBefore}->${checkedAfter}->${checkedFinal} visibleOutput=${visibleFinanceOutput}`);

  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(250);
  const dealName = `E2E-TEST-DEAL-${Date.now()}`;
  await page.getByPlaceholder('اسم الصفقة...').fill(dealName);
  await page.getByRole('button', { name: /^حفظ$/ }).click();
  await page.waitForTimeout(500);
  const panelText = await page.locator('.fixed.inset-0.z-50').innerText();
  record('E2E-05-SAVED-DEALS', panelText.includes(dealName), `deal=${dealName}`);

  const overlay = page.locator('.fixed.inset-0.z-50');
  const innerPanel = overlay.locator('> div');
  await innerPanel.locator('button').first().click();
  await page.waitForTimeout(200);
  record('E2E-05B-DEALS-PANEL-CLOSE', (await overlay.count()) === 0);

  const resetButton = page.getByTitle(/استعادة القيم الأصلية لهذه الدراسة|التراجع عن التعديلات غير المحفوظة/);
  await resetButton.click();
  await page.waitForTimeout(300);
  const resetBody = await page.locator('body').innerText();
  record('E2E-06-RESET', !resetBody.includes('777777'));

  result.PAGE_ERRORS = pageErrors.length;
  result.FATAL_CONSOLE_ERRORS = consoleErrors.length;
  result.CORE_RUNTIME_NETWORK_FAILURES = httpErrors.length;
  result.HTTP_ERROR_RESPONSES = httpErrors;
  result.CONSOLE_ERROR_SAMPLES = consoleErrors.slice(0, 5);
  record('E2E-07-NO-PAGE-ERRORS', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));
  record('E2E-08-NO-CONSOLE-ERRORS', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));
  record('E2E-09-NO-HTTP-ERRORS', httpErrors.length === 0, JSON.stringify(httpErrors.slice(0, 3)));
} catch (error) {
  result.fatal_error = error.message;
  failed = true;
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  fs.writeFileSync(`${EVIDENCE_DIR}/core-e2e-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (failed) process.exitCode = 1;
}
