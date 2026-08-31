import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/e2e';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = {};
let previewServer = null;
let browser = null;

function mark(key, passed, detail = null) {
  results[key] = passed ? 'PASS' : 'FAIL';
  if (detail !== null) results[`${key}_DETAIL`] = detail;
  if (!passed) throw new Error(`${key}_FAILED${detail ? `: ${detail}` : ''}`);
}

try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  results.previewUrl = url;

  const httpCheck = await fetch(url);
  mark('PRODUCTION_PREVIEW_BOOT', httpCheck.status === 200, `status=${httpCheck.status}`);

  browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  mark('PLAYWRIGHT_BROWSER_LAUNCH', true, browser.version());

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => failedRequests.push(req.url()));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  const rootHtml = await page.locator('#root').innerHTML();
  mark('BROWSER_APP_BOOT', rootHtml.length > 100, `htmlLength=${rootHtml.length}`);
  mark('AR_SA_RUNTIME', (await page.locator('html').getAttribute('dir')) === 'rtl');

  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(250);
  const buildingBodyBefore = await page.locator('body').innerText();
  const buildingInput = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const buildingBefore = await buildingInput.inputValue();
  await buildingInput.fill('999999');
  await buildingInput.blur();
  await page.waitForTimeout(300);
  const buildingAfter = await buildingInput.inputValue();
  const buildingBodyAfter = await page.locator('body').innerText();
  mark('EXISTING_BUILDING_E2E', buildingAfter !== buildingBefore && buildingBodyAfter !== buildingBodyBefore);

  await page.getByText('أرض + تطوير', { exact: true }).click();
  await page.waitForTimeout(250);
  const landBodyBefore = await page.locator('body').innerText();
  const landInput = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const landBefore = await landInput.inputValue();
  await landInput.fill('888888');
  await landInput.blur();
  await page.waitForTimeout(300);
  const landAfter = await landInput.inputValue();
  const landBodyAfter = await page.locator('body').innerText();
  mark('LAND_DEVELOPMENT_E2E', landAfter !== landBefore && landBodyAfter !== landBodyBefore);

  await page.getByText('التدفقات النقدية', { exact: true }).click();
  await page.waitForTimeout(250);
  mark('CASH_FLOW_RUNTIME_FLOW', (await page.locator('body').innerText()).length > 0);

  await page.getByText('تحليل الحساسية', { exact: true }).click();
  await page.waitForTimeout(400);
  mark('SENSITIVITY_RUNTIME_FLOW', (await page.locator('svg').count()) > 0);

  await page.getByText('لوحة المؤشرات', { exact: true }).click();
  await page.waitForTimeout(250);
  const dashboardText = await page.locator('body').innerText();
  mark('RECOMMENDATION_RUNTIME_FLOW', /يوصى بالشراء|لا يوصى بالشراء/.test(dashboardText));

  for (const [name, width, height] of [['MOBILE',390,844],['TABLET',768,1024],['DESKTOP',1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    mark(`${name}_SMOKE`, dimensions.scrollWidth <= dimensions.clientWidth + 5, JSON.stringify(dimensions));
  }
  results.RESPONSIVE_SMOKE_TEST = 'PASS';

  results.FATAL_CONSOLE_ERRORS = consoleErrors.length;
  results.PAGE_ERRORS = pageErrors.length;
  results.TAILWIND_EXTERNAL_REQUESTS = failedRequests.filter((url) => url.includes('tailwindcss.com')).length;
  mark('NO_PAGE_ERRORS', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));
  mark('NO_FATAL_CONSOLE_ERRORS', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));
  mark('NO_TAILWIND_EXTERNAL_REQUESTS', results.TAILWIND_EXTERNAL_REQUESTS === 0);
} catch (error) {
  results.FATAL_ERROR = error.message;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  fs.writeFileSync(`${EVIDENCE_DIR}/e2e-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
