import { chromium } from '@playwright/test';
import fs from 'fs';

const LIVE_URL = process.env.LIVE_URL || 'https://startak-real-estate.pages.dev/';
const EVIDENCE_DIR = 'runtime-evidence/production-live';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = { liveUrl: LIVE_URL, startedAt: new Date().toISOString(), checks: {} };
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const allRequests = [];
const failures = [];

function check(name, ok, detail = undefined, blocking = true) {
  results.checks[name] = { status: ok ? 'PASS' : 'FAIL', ...(detail !== undefined ? { detail } : {}) };
  if (!ok && blocking) failures.push(name);
}
function info(name, detail) { results.checks[name] = { status: 'INFO', detail }; }
function norm(s) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }

async function metricCardText(page, label) {
  const labelNode = page.getByText(label, { exact: true }).first();
  await labelNode.waitFor({ state: 'visible', timeout: 5000 });
  return norm(await labelNode.locator('xpath=../..').innerText());
}

async function fieldInput(page, label) {
  const field = page.locator('label').filter({ hasText: label }).first();
  await field.waitFor({ state: 'visible', timeout: 5000 });
  return field.locator('input[type="text"], input[inputmode="decimal"]').first();
}

async function main() {
  const t0 = Date.now();
  const response = await fetch(LIVE_URL, { redirect: 'follow' });
  const html = await response.text();
  const responseMs = Date.now() - t0;
  const headers = Object.fromEntries(response.headers.entries());
  results.http = { status: response.status, finalUrl: response.url, responseMs, headers };
  check('HTTP_200', response.status === 200, { status: response.status, finalUrl: response.url });
  check('HTTPS_ONLY', response.url.startsWith('https://'), response.url);
  check('HTML_CONTENT_TYPE', (headers['content-type'] || '').includes('text/html'), headers['content-type']);
  check('HTML_HAS_ROOT', /id=["']root["']/.test(html), `htmlBytes=${Buffer.byteLength(html)}`);
  info('HTTP_RESPONSE_MS', responseMs);

  const csp = headers['content-security-policy'] || '';
  check('HEADER_CSP_PRESENT', !!csp, csp || 'missing');
  if (csp) {
    check('CSP_DEFAULT_SELF', /default-src\s+'self'/.test(csp), csp);
    check('CSP_FRAME_ANCESTORS_NONE', /frame-ancestors\s+'none'/.test(csp), csp);
    check('CSP_NO_UNSAFE_EVAL', !csp.includes("'unsafe-eval'"), csp);
  }
  check('HEADER_X_CONTENT_TYPE_OPTIONS', (headers['x-content-type-options'] || '').toLowerCase() === 'nosniff', headers['x-content-type-options'] || 'missing');
  check('HEADER_REFERRER_POLICY', (headers['referrer-policy'] || '').toLowerCase().includes('strict-origin-when-cross-origin'), headers['referrer-policy'] || 'missing');
  check('HEADER_PERMISSIONS_POLICY', !!headers['permissions-policy'], headers['permissions-policy'] || 'missing');
  check('HEADER_HSTS', !!headers['strict-transport-security'], headers['strict-transport-security'] || 'missing', false);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('request', (req) => allRequests.push(req.url()));
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), reason: req.failure()?.errorText || 'unknown' }));

  const navStart = Date.now();
  const navResp = await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const navMs = Date.now() - navStart;
  info('BROWSER_NAVIGATION_MS', navMs);
  check('BROWSER_NAVIGATION_HTTP_OK', !!navResp && navResp.ok(), navResp ? `${navResp.status()} ${navResp.url()}` : 'no response');

  const rootHtml = await page.locator('#root').innerHTML();
  check('APP_ROOT_RENDERED', rootHtml.length > 1000, `rootHtmlLength=${rootHtml.length}`);
  check('DOCUMENT_TITLE', (await page.title()) === 'STARTAK Real Estate', await page.title());
  check('DEFAULT_LANG_AR_SA', (await page.locator('html').getAttribute('lang')) === 'ar-SA', await page.locator('html').getAttribute('lang'));
  check('DEFAULT_DIR_RTL', (await page.locator('html').getAttribute('dir')) === 'rtl', await page.locator('html').getAttribute('dir'));
  check('AR_ENGINE_TITLE_VISIBLE', await page.getByText('محرك التقييم الاستثماري العقاري', { exact: true }).isVisible().catch(() => false));

  const body0 = await page.locator('body').innerText();
  check('NO_NAN_INITIAL', !/\bNaN\b/.test(body0));
  check('NO_INFINITY_INITIAL', !/\bInfinity\b/.test(body0));

  const kpiLabels = ['صافي الدخل التشغيلي', 'العائد الصافي على السعر', 'صافي القيمة الحالية', 'معدل العائد الداخلي', 'فترة الاسترداد'];
  const kpiBefore = {};
  for (const label of kpiLabels) kpiBefore[label] = await metricCardText(page, label);
  results.kpiBefore = kpiBefore;
  check('BUILDING_KPIS_PRESENT', Object.values(kpiBefore).every(Boolean), kpiBefore);
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-ar-building-initial.png`, fullPage: true });

  const priceInput = await fieldInput(page, 'قيمة شراء المبنى');
  const originalPrice = await priceInput.inputValue();
  check('BUILDING_PRICE_DEFAULT', Number(originalPrice) === 140000000, originalPrice, false);
  await priceInput.fill('154000000');
  await priceInput.blur();
  await page.waitForTimeout(500);
  const kpiAfterPrice = {};
  for (const label of kpiLabels) kpiAfterPrice[label] = await metricCardText(page, label);
  results.kpiAfterBuildingPricePlus10Pct = kpiAfterPrice;
  check('BUILDING_PRICE_INPUT_ACCEPTED', Number(await priceInput.inputValue()) === 154000000, await priceInput.inputValue());
  check('NOI_INVARIANT_TO_PURCHASE_PRICE', kpiAfterPrice['صافي الدخل التشغيلي'] === kpiBefore['صافي الدخل التشغيلي'], { before: kpiBefore['صافي الدخل التشغيلي'], after: kpiAfterPrice['صافي الدخل التشغيلي'] });
  for (const label of ['العائد الصافي على السعر', 'صافي القيمة الحالية', 'معدل العائد الداخلي', 'فترة الاسترداد']) {
    check(`RECALC_${label}`, kpiAfterPrice[label] !== kpiBefore[label], { before: kpiBefore[label], after: kpiAfterPrice[label] });
  }
  check('NO_NAN_AFTER_RECALC', !/\bNaN\b|\bInfinity\b/.test(await page.locator('body').innerText()));

  await page.getByTitle('استعادة القيم الأصلية لهذه الدراسة').click();
  await page.waitForTimeout(400);
  const resetPriceInput = await fieldInput(page, 'قيمة شراء المبنى');
  check('RESET_RESTORES_BUILDING_PRICE', Number(await resetPriceInput.inputValue()) === 140000000, await resetPriceInput.inputValue());
  const kpiAfterReset = {};
  for (const label of kpiLabels) kpiAfterReset[label] = await metricCardText(page, label);
  check('RESET_RESTORES_KPIS', kpiLabels.every((label) => kpiAfterReset[label] === kpiBefore[label]), { before: kpiBefore, after: kpiAfterReset });

  const occInput = await fieldInput(page, 'نسبة الإشغال المتوقعة');
  await occInput.fill('200');
  await occInput.blur();
  await page.waitForTimeout(500);
  check('INVALID_OCCUPANCY_DISCLOSURE', await page.getByText('قيمة إدخال غير صالحة', { exact: true }).isVisible().catch(() => false));
  const invalidBody = await page.locator('body').innerText();
  check('INVALID_OCCUPANCY_NO_NAN_INFINITY', !/\bNaN\b|\bInfinity\b/.test(invalidBody));
  await occInput.fill('95');
  await occInput.blur();
  await page.waitForTimeout(400);
  check('VALIDATION_RECOVERY', !(await page.getByText('قيمة إدخال غير صالحة', { exact: true }).isVisible().catch(() => false)));

  await page.getByText('EN', { exact: true }).click();
  await page.waitForTimeout(300);
  check('EN_LANG', (await page.locator('html').getAttribute('lang')) === 'en', await page.locator('html').getAttribute('lang'));
  check('EN_DIR_LTR', (await page.locator('html').getAttribute('dir')) === 'ltr', await page.locator('html').getAttribute('dir'));
  check('EN_ENGINE_TITLE_VISIBLE', await page.getByText('Real Estate Investment Valuation Engine', { exact: true }).isVisible().catch(() => false));
  check('EN_KPI_LABEL_VISIBLE', await page.getByText('Internal Rate of Return', { exact: true }).isVisible().catch(() => false));
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-en-building.png`, fullPage: true });
  await page.getByText('ع', { exact: true }).click();
  await page.waitForTimeout(250);
  check('AR_RETURN_DIR_RTL', (await page.locator('html').getAttribute('dir')) === 'rtl');

  await page.getByText('التدفقات النقدية', { exact: true }).click();
  await page.waitForTimeout(350);
  check('CASHFLOW_TAB_RUNTIME', (await page.locator('body').innerText()).includes('تحليل التدفقات النقدية'));
  await page.getByText('تحليل الحساسية', { exact: true }).click();
  await page.waitForTimeout(500);
  check('SENSITIVITY_TAB_RUNTIME', (await page.locator('svg').count()) > 0, `svgCount=${await page.locator('svg').count()}`);
  await page.getByText('لوحة المؤشرات', { exact: true }).click();
  await page.waitForTimeout(250);

  await page.getByText('أرض + تطوير', { exact: true }).click();
  await page.waitForTimeout(400);
  check('LAND_MODE_VISIBLE', await page.getByText('أرض + تطوير', { exact: true }).isVisible().catch(() => false));
  check('LAND_PROJECT_TITLE_VISIBLE', (await page.locator('body').innerText()).includes('أرض للتطوير'));
  const landPrice = await fieldInput(page, 'سعر المتر المربع (سعر السوق)');
  const landBodyBefore = await page.locator('body').innerText();
  await landPrice.fill('22000');
  await landPrice.blur();
  await page.waitForTimeout(500);
  const landBodyAfter = await page.locator('body').innerText();
  check('LAND_INPUT_ACCEPTED', Number(await landPrice.inputValue()) === 22000, await landPrice.inputValue());
  check('LAND_RECALCULATION', landBodyAfter !== landBodyBefore);
  check('LAND_NO_NAN_INFINITY', !/\bNaN\b|\bInfinity\b/.test(landBodyAfter));
  await page.screenshot({ path: `${EVIDENCE_DIR}/03-ar-land.png`, fullPage: true });

  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(250);
  check('SAVED_DEALS_DIALOG_ROLE', await page.getByRole('dialog').isVisible().catch(() => false));
  const qaDeal = `QA Production ${Date.now()}`;
  await page.getByPlaceholder('اسم الصفقة...').fill(qaDeal);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.waitForTimeout(400);
  check('SAVED_DEAL_CREATED', (await dialog.innerText()).includes(qaDeal));
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await dialog.getByRole('button', { name: 'تصدير نسخة احتياطية', exact: true }).click();
  const download = await downloadPromise;
  check('BACKUP_EXPORT_JSON', download.suggestedFilename().endsWith('.json'), download.suggestedFilename());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('DEALS_ESCAPE_CLOSES', !(await page.getByRole('dialog').isVisible().catch(() => false)));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(250);
  const dialog2 = page.getByRole('dialog');
  check('SAVED_DEAL_PERSISTS_RELOAD', (await dialog2.innerText()).includes(qaDeal));
  const row = dialog2.locator('div').filter({ hasText: qaDeal }).filter({ has: page.getByLabel('حذف') }).first();
  await row.getByLabel('حذف').click();
  await page.waitForTimeout(300);
  check('SAVED_DEAL_DELETE', !(await dialog2.innerText()).includes(qaDeal));
  await page.keyboard.press('Escape');

  for (const [name, width, height] of [['MOBILE',390,844],['TABLET',768,1024],['DESKTOP',1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const dims = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    check(`${name}_NO_HORIZONTAL_OVERFLOW`, dims.scrollWidth <= dims.clientWidth + 5, dims);
    await page.screenshot({ path: `${EVIDENCE_DIR}/viewport-${name.toLowerCase()}.png`, fullPage: true });
  }

  const origin = new URL(LIVE_URL).origin;
  const uniqueRequests = [...new Set(allRequests)];
  const externalRequests = uniqueRequests.filter((u) => { try { return new URL(u).origin !== origin; } catch { return true; } });
  const insecureRequests = uniqueRequests.filter((u) => u.startsWith('http:'));
  results.network = { requestCount: uniqueRequests.length, externalRequests, insecureRequests, failedRequests };
  check('NO_EXTERNAL_RUNTIME_REQUESTS', externalRequests.length === 0, externalRequests);
  check('NO_MIXED_CONTENT_REQUESTS', insecureRequests.length === 0, insecureRequests);
  check('NO_FAILED_REQUESTS', failedRequests.length === 0, failedRequests);
  check('NO_PAGE_ERRORS', pageErrors.length === 0, pageErrors);
  check('NO_CONSOLE_ERRORS', consoleErrors.length === 0, consoleErrors);

  const unnamedButtons = await page.locator('button').evaluateAll((buttons) => buttons.map((b, i) => ({ i, text: (b.innerText || '').trim(), title: b.getAttribute('title'), aria: b.getAttribute('aria-label') })).filter((b) => !b.text && !b.title && !b.aria));
  check('BUTTONS_HAVE_BASIC_ACCESSIBLE_NAME', unnamedButtons.length === 0, unnamedButtons, false);

  results.consoleErrors = consoleErrors;
  results.pageErrors = pageErrors;
  results.failedRequests = failedRequests;
  results.completedAt = new Date().toISOString();
  results.blockingFailures = failures;
  results.summary = { pass: Object.values(results.checks).filter((x) => x.status === 'PASS').length, fail: Object.values(results.checks).filter((x) => x.status === 'FAIL').length, info: Object.values(results.checks).filter((x) => x.status === 'INFO').length, blockingFailures: failures.length };

  await browser.close();
  fs.writeFileSync(`${EVIDENCE_DIR}/production-live-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  results.fatalError = `${err?.message || err}\n${err?.stack || ''}`;
  results.completedAt = new Date().toISOString();
  fs.writeFileSync(`${EVIDENCE_DIR}/production-live-results.json`, JSON.stringify(results, null, 2));
  console.error(results.fatalError);
  process.exit(1);
});
