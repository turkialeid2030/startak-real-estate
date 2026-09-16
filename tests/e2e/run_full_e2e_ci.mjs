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
let activePage = null;
const LEGACY_VERDICT_RE = /يوصى بالشراء|لا يوصى بالشراء/;

function mark(key, passed, detail = null) {
  results[key] = passed ? 'PASS' : 'FAIL';
  if (detail !== null) results[`${key}_DETAIL`] = detail;
  if (!passed) throw new Error(`${key}_FAILED${detail ? `: ${detail}` : ''}`);
}
async function loadReferenceDeal(page, nameRe) {
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: nameRe }).first().click();
  await page.waitForTimeout(300);
}

async function configureMinimalBuildingValuation(page) {
  const titleCount = await page.getByText('ذكاء التقييم العقاري', { exact: true }).count();
  const configureTextCount = await page.getByText('تهيئة Valuation V1', { exact: true }).count();
  const incompleteCount = await page.getByTestId('analysis-incomplete').count();
  const configRoleCount = await page.getByRole('button', { name: 'تهيئة Valuation V1' }).count();
  mark(
    'VALUATION_CONFIGURATION_DISCOVERABLE',
    titleCount === 1 && configureTextCount === 1 && configRoleCount === 1 && incompleteCount === 0,
    JSON.stringify({ titleCount, configureTextCount, configRoleCount, incompleteCount }),
  );
  await page.getByRole('button', { name: 'تهيئة Valuation V1' }).click();
  await page.getByLabel('معرّف المشروع').fill('E2E-VALUATION-1');
  await page.getByLabel('فئة الأصل').selectOption({ label: 'مكاتب' });
  await page.getByLabel('مرحلة دورة الحياة').selectOption({ label: 'قائم ومشغّل' });
  await page.getByLabel('الاستراتيجية الاستثمارية').selectOption({ label: 'استحواذ واحتفاظ' });
  await page.getByLabel('نموذج الدخل').selectOption({ label: 'دخل إيجاري' });
  await page.getByLabel('معالجة المصروفات التشغيلية').selectOption({ label: 'مصروفات فعلية على المالك' });
  await page.getByLabel('أساس القيمة').selectOption({ label: 'القيمة السوقية' });
  await page.getByLabel('العملة').fill('SAR');
  await page.getByRole('button', { name: 'تطبيق الإعدادات' }).click();
  await page.waitForTimeout(350);
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
  activePage = page;
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

  const initialBody = await page.locator('body').innerText();
  mark(
    'GOVERNED_METHODOLOGY_NOTICE_VISIBLE',
    initialBody.includes('هذه النتيجة تحليل مالي داعم للقرار') && initialBody.includes('لا تمثل اعتمادًا قانونيًا أو نظاميًا'),
  );

  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(250);
  const newDealBody = await page.locator('body').innerText();
  mark('NEW_DEAL_FAIL_CLOSED', !LEGACY_VERDICT_RE.test(newDealBody), `legacyVerdict=${LEGACY_VERDICT_RE.test(newDealBody)}`);

  await loadReferenceDeal(page, /مبنى أبو بكر الصديق/);

  await configureMinimalBuildingValuation(page);
  const guidedPanel = page.getByTestId('guided-decision-status');
  const freshnessPanel = page.getByTestId('valuation-data-freshness');
  const reportPanel = page.getByTestId('governed-report-export');
  mark('GUIDED_DECISION_PANEL_LIVE', (await guidedPanel.count()) === 1 && (await guidedPanel.innerText()).includes('لا يُعرض قرار شراء/رفض'));
  mark('DATA_FRESHNESS_PANEL_LIVE', (await freshnessPanel.count()) === 1 && (await freshnessPanel.innerText()).includes('لا توجد أدلة مصدرية مؤرخة'));
  const governedExportButton = reportPanel.getByRole('button', { name: 'تصدير التقرير المحكوم' });
  mark(
    'GOVERNED_REPORT_EXPORT_FAIL_CLOSED',
    (await reportPanel.count()) === 1 && (await governedExportButton.isDisabled()) && (await reportPanel.innerText()).includes('يلزم إدخال أدلة مصدرية قبل التصدير'),
  );

  const buildingBodyBefore = await page.locator('body').innerText();
  const buildingInput = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const buildingBefore = await buildingInput.inputValue();
  await buildingInput.focus();
  await buildingInput.fill('');
  await page.waitForTimeout(80);
  mark('NUMERIC_TEMP_EMPTY_VISIBLE_WHILE_EDITING', (await buildingInput.inputValue()) === '');
  await buildingInput.blur();
  await page.waitForTimeout(100);
  mark('NUMERIC_TEMP_EMPTY_RESTORES_ON_BLUR', (await buildingInput.inputValue()) === buildingBefore, `before=${buildingBefore} after=${await buildingInput.inputValue()}`);

  await buildingInput.fill('120');
  await buildingInput.blur();
  await page.waitForTimeout(300);
  const buildingAfter = await buildingInput.inputValue();
  const buildingBodyAfter = await page.locator('body').innerText();
  mark('EXISTING_BUILDING_E2E', buildingAfter !== buildingBefore && buildingBodyAfter !== buildingBodyBefore);

  await loadReferenceDeal(page, /أرض الوادي/);
  const landBodyBefore = await page.locator('body').innerText();
  const landInput = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  const landBefore = await landInput.inputValue();
  await landInput.fill('35');
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
  const safeVerdictVisible = /حالة تحليلية مواتية|حالة تحليلية مشروطة|مخاطر تحليلية مرتفعة|تعليق التحليل لحين استكمال الأدلة|يتطلب مراجعة مختص مرخص/.test(dashboardText);
  const legacyVerdictVisible = LEGACY_VERDICT_RE.test(dashboardText);
  mark('RECOMMENDATION_RUNTIME_FLOW', safeVerdictVisible && !legacyVerdictVisible, `safeVerdict=${safeVerdictVisible} legacyVerdict=${legacyVerdictVisible}`);

  for (const [name, width, height] of [['MOBILE',390,844],['TABLET',768,1024],['DESKTOP',1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    mark(`${name}_SMOKE`, dimensions.scrollWidth <= dimensions.clientWidth + 5, JSON.stringify(dimensions));
  }
  results.RESPONSIVE_SMOKE_TEST = 'PASS';

  results.FATAL_CONSOLE_ERRORS = consoleErrors.length;
  results.PAGE_ERRORS = pageErrors.length;
  results.TAILWIND_EXTERNAL_REQUESTS = failedRequests.filter((requestUrl) => requestUrl.includes('tailwindcss.com')).length;
  mark('NO_PAGE_ERRORS', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));
  mark('NO_FATAL_CONSOLE_ERRORS', consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 3)));
  mark('NO_TAILWIND_EXTERNAL_REQUESTS', results.TAILWIND_EXTERNAL_REQUESTS === 0);
} catch (error) {
  results.FATAL_ERROR = error.message;
  if (activePage) {
    try {
      const bodyText = await activePage.locator('body').innerText();
      results.FAILURE_BODY_SAMPLE = bodyText.slice(0, 8000);
      results.FAILURE_BUTTON_TEXTS = (await activePage.locator('button').allTextContents()).slice(-40);
      await activePage.screenshot({ path: `${EVIDENCE_DIR}/full-e2e-failure.png`, fullPage: true });
    } catch (diagnosticError) {
      results.FAILURE_DIAGNOSTIC_ERROR = diagnosticError.message;
    }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  fs.writeFileSync(`${EVIDENCE_DIR}/e2e-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}