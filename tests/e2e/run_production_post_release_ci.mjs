import { chromium, request } from 'playwright';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://startak-real-estate.pages.dev';
const EXPECTED_DEPLOYED_SHA = process.env.EXPECTED_DEPLOYED_SHA || null;
const EVIDENCE_DIR = 'runtime-evidence/post-release-production';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const MISSING_EXIT_CAP_AR = 'معدل رسملة الخروج مطلوب في إصدار الافتراضات V2. لا تُحتسب مؤشرات العائد المعتمدة على الخروج حتى إدخاله صراحةً.';
const SAFE_ANALYTICAL_VERDICT_RE = /حالة تحليلية مواتية|حالة تحليلية مشروطة|مخاطر تحليلية مرتفعة|تعليق التحليل لحين استكمال الأدلة|يتطلب مراجعة مختص مرخص/;
const LEGACY_IMPERATIVE_VERDICT_RE = /يوصى بالشراء|لا يوصى بالشراء/;

const report = {
  schemaVersion: 1,
  suite: 'POST_RELEASE_PRODUCTION_VALIDATION_V1',
  baseUrl: BASE_URL,
  expectedDeployedSha: EXPECTED_DEPLOYED_SHA,
  checks: [],
  startedAt: new Date().toISOString(),
};

let failed = false;
let browser = null;
let api = null;

function record(name, passed, detail = null) {
  report.checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) failed = true;
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}${detail ? ` -- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

async function openValuationAssumptions(page) {
  const sectionButton = page.getByRole('button', { name: /افتراضات التقييم والاستثمار/ }).first();
  if ((await sectionButton.count()) === 0) throw new Error('valuation assumptions section was not discoverable');
  const section = sectionButton.locator('xpath=ancestor::div[contains(@class,"rounded-2xl") and contains(@class,"overflow-hidden")][1]');
  const sectionBody = section.locator('.rf-accordion-body').first();
  if ((await sectionBody.count()) === 0) throw new Error('valuation assumptions accordion body was not discoverable');
  const classes = ((await sectionBody.getAttribute('class')) || '').split(/\s+/);
  if (!classes.includes('open')) {
    await sectionButton.click();
    await page.waitForTimeout(220);
  }
  return section;
}

async function resolveExitCapInput(page) {
  await openValuationAssumptions(page);
  const label = page.getByText('معدل رسملة الخروج', { exact: true }).first();
  if ((await label.count()) === 0) throw new Error('explicit exit-cap label was not discoverable');
  const input = label.locator('xpath=ancestor::label[1]').locator('input').first();
  if ((await input.count()) === 0) throw new Error('explicit exit-cap input was not discoverable');
  return input;
}

try {
  api = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'user-agent': 'STARTAK-Post-Release-Production-Verify/1.0',
    },
  });

  const shellResponse = await api.get('/');
  const shellBody = await shellResponse.text();
  record('PROD_HTTP_200', shellResponse.status() === 200, `status=${shellResponse.status()}`);
  const shellHasDocument = /<!doctype html|<html/i.test(shellBody);
  const shellHasRoot = /id=["']root["']/i.test(shellBody);
  record(
    'PROD_HTML_SHELL',
    shellHasDocument && shellHasRoot && shellBody.length > 200,
    { htmlLength: shellBody.length, shellHasDocument, shellHasRoot }
  );

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) failedResponses.push({ status: response.status(), url: response.url() });
  });

  const navigation = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.waitForTimeout(500);

  const rootText = await page.locator('#root').innerText();
  const dir = await page.locator('html').getAttribute('dir');
  const lang = await page.locator('html').getAttribute('lang');
  record('PROD_BROWSER_HTTP_200', navigation?.status() === 200, `status=${navigation?.status()}`);
  record('PROD_APP_BOOT', rootText.trim().length > 1000, `rootTextLength=${rootText.trim().length}`);
  record('PROD_ARABIC_RTL_DEFAULT', dir === 'rtl' && lang === 'ar-SA', { dir, lang });

  await page.getByText('مبنى قائم', { exact: true }).first().click();
  await page.waitForTimeout(250);

  const initialBody = await page.locator('body').innerText();
  record('PROD_WAVE2_V2_BADGE', initialBody.includes('إصدار الافتراضات V2'));
  record('PROD_WAVE2_EXIT_CAP_MISSING_SOURCE', initialBody.includes('MISSING_REQUIRED'));
  record('PROD_WAVE2_FAIL_CLOSED_NOTICE', initialBody.includes(MISSING_EXIT_CAP_AR));
  record('PROD_WAVE2_NO_LEGACY_IMPERATIVE', !LEGACY_IMPERATIVE_VERDICT_RE.test(initialBody));

  const exitCapInput = await resolveExitCapInput(page);
  const initialExitCapValue = await exitCapInput.inputValue();
  record('PROD_WAVE2_FRESH_EXIT_CAP_BLANK', initialExitCapValue.trim() === '', `value=${JSON.stringify(initialExitCapValue)}`);

  await page.getByText('تحليل الحساسية', { exact: true }).first().click();
  await page.waitForTimeout(300);
  const sensitivityHold = await page.locator('body').innerText();
  record('PROD_WAVE2_SENSITIVITY_FAIL_CLOSED', sensitivityHold.includes(MISSING_EXIT_CAP_AR) && !/NaN|undefined/.test(sensitivityHold));

  await page.getByText('مبنى قائم', { exact: true }).first().click();
  await page.waitForTimeout(220);
  const exitCapInputAfterReturn = await resolveExitCapInput(page);
  await exitCapInputAfterReturn.fill('8.5');
  await exitCapInputAfterReturn.blur();
  await page.waitForTimeout(400);

  const explicitBody = await page.locator('body').innerText();
  record('PROD_WAVE2_EXPLICIT_EXIT_CAP_PERSISTS', (await exitCapInputAfterReturn.inputValue()) === '8.5', `value=${await exitCapInputAfterReturn.inputValue()}`);
  record('PROD_WAVE2_EXIT_CAP_EXPLICIT_SOURCE', explicitBody.includes('EXPLICIT'));
  record('PROD_WAVE2_MISSING_NOTICE_CLEARS', !explicitBody.includes(MISSING_EXIT_CAP_AR));

  await page.getByText('لوحة المؤشرات', { exact: true }).first().click();
  await page.waitForTimeout(300);
  const dashboard = await page.locator('body').innerText();
  const safeVerdict = SAFE_ANALYTICAL_VERDICT_RE.test(dashboard);
  const legacyImperative = LEGACY_IMPERATIVE_VERDICT_RE.test(dashboard);
  record('PROD_WAVE2_DETERMINISTIC_ANALYTICAL_STATE', safeVerdict && !legacyImperative, { safeVerdict, legacyImperative });
  record('PROD_WAVE2_DASHBOARD_V2_DISCLOSURE', dashboard.includes('إصدار الافتراضات V2') && dashboard.includes('EXPLICIT'));

  await page.getByText('تحليل الحساسية', { exact: true }).first().click();
  await page.waitForTimeout(350);
  const sensitivityReady = await page.locator('body').innerText();
  record('PROD_WAVE2_SENSITIVITY_RECOVERS', !sensitivityReady.includes(MISSING_EXIT_CAP_AR) && !/NaN|undefined/.test(sensitivityReady));

  const englishButton = page.getByRole('button', { name: 'EN' }).first();
  record('PROD_LANGUAGE_SWITCH_DISCOVERABLE', (await englishButton.count()) > 0);
  if ((await englishButton.count()) > 0) {
    await englishButton.click();
    await page.waitForTimeout(250);
    const enDir = await page.locator('html').getAttribute('dir');
    const enLang = await page.locator('html').getAttribute('lang');
    const enBody = await page.locator('body').innerText();
    record('PROD_ENGLISH_LTR', enDir === 'ltr' && enLang === 'en', { dir: enDir, lang: enLang });
    record('PROD_ENGLISH_V2_DISCLOSURE', enBody.includes('Assumption Model V2'));

    const arabicButton = page.getByTitle('التبديل إلى العربية').first();
    if ((await arabicButton.count()) > 0) {
      await arabicButton.click();
      await page.waitForTimeout(220);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const mobile = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record('PROD_MOBILE_390_NO_HORIZONTAL_OVERFLOW', mobile.scrollWidth <= mobile.clientWidth + 5, mobile);

  record('PROD_NO_PAGE_ERRORS', pageErrors.length === 0, pageErrors.slice(0, 5));
  record('PROD_NO_CONSOLE_ERRORS', consoleErrors.length === 0, consoleErrors.slice(0, 5));
  record('PROD_NO_HTTP_5XX', failedResponses.length === 0, failedResponses.slice(0, 5));

  await context.close();
} catch (error) {
  failed = true;
  report.fatalError = {
    name: error.name,
    message: error.message,
  };
  console.error('POST_RELEASE_PRODUCTION_VALIDATION_FATAL', error);
} finally {
  if (browser) await browser.close();
  if (api) await api.dispose();
  report.completedAt = new Date().toISOString();
  report.totalChecks = report.checks.length;
  report.passedChecks = report.checks.filter((check) => check.status === 'PASS').length;
  report.failedChecks = report.checks.filter((check) => check.status === 'FAIL').length;
  report.result = failed || report.failedChecks > 0 ? 'FAIL' : 'PASS';
  report.caveats = [
    'This is an external production smoke/contract validation, not a substitute for moderated user testing.',
    'The workflow-run path relies on the preceding Cloudflare Control Plane Verify to establish exact deployed-SHA correlation before this suite executes.',
    'No transaction authorization is performed; the browser session is isolated and does not intentionally persist server-side deal state.',
  ];
  fs.writeFileSync(`${EVIDENCE_DIR}/post-release-production-result.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
