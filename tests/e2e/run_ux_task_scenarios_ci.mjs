import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/deep-platform';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const report = {
  suite: 'UX_TASK_BASED_SCENARIOS_V1',
  tasks: [],
  browserErrors: [],
  consoleErrors: [],
};
let previewServer = null;
let browser = null;
let failed = false;

async function runTask(name, page, taskFn) {
  const started = Date.now();
  let actions = 0;
  const act = async (fn) => { actions += 1; return fn(); };
  try {
    const details = await taskFn(act);
    report.tasks.push({
      name,
      status: 'PASS',
      actions,
      elapsedMs: Date.now() - started,
      details: details || null,
    });
  } catch (error) {
    failed = true;
    report.tasks.push({
      name,
      status: 'FAIL',
      actions,
      elapsedMs: Date.now() - started,
      error: error.message,
    });
  }
}

async function safeDecisionVisible(page) {
  const text = await page.locator('body').innerText();
  const safe = /حالة تحليلية مواتية|حالة تحليلية مشروطة|مخاطر تحليلية مرتفعة|تعليق التحليل لحين استكمال الأدلة|يتطلب مراجعة مختص مرخص/.test(text);
  const imperative = /يوصى بالشراء|لا يوصى بالشراء/.test(text);
  if (!safe || imperative) throw new Error(`decision language unsafe or unclear: safe=${safe} imperative=${imperative}`);
  return { safe, imperative };
}

try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', (err) => report.browserErrors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.waitForTimeout(250);

  await runTask('NOVICE_EXISTING_BUILDING_REVIEW', page, async (act) => {
    await act(() => page.getByText('مبنى قائم', { exact: true }).first().click());
    const input = page.locator('input[type="text"], input[inputmode="decimal"]').first();
    const original = await input.inputValue();
    await act(() => input.fill('120'));
    await act(() => input.blur());
    await page.waitForTimeout(200);
    if ((await input.inputValue()) !== '120') throw new Error('edited building input did not persist visibly');
    await act(() => page.getByText('لوحة المؤشرات', { exact: true }).first().click());
    await page.waitForTimeout(200);
    const decision = await safeDecisionVisible(page);
    await act(() => page.getByText('التدفقات النقدية', { exact: true }).first().click());
    await page.waitForTimeout(200);
    if ((await page.locator('body').innerText()).length < 500) throw new Error('cash-flow view lacks meaningful visible content');
    await act(() => page.getByText('مبنى قائم', { exact: true }).first().click());
    await input.fill(original || '100');
    await input.blur();
    return { decision, taskGoal: 'edit assumptions, read analytical state, inspect cash flow' };
  });

  await runTask('NOVICE_LAND_DEVELOPMENT_REVIEW', page, async (act) => {
    await act(() => page.getByText('أرض + تطوير', { exact: true }).first().click());
    await page.waitForTimeout(150);
    const inputs = page.locator('input[type="text"], input[inputmode="decimal"]');
    if ((await inputs.count()) < 2) throw new Error('land workflow does not expose enough editable inputs');
    const first = inputs.nth(0); const second = inputs.nth(1);
    const oldFirst = await first.inputValue(); const oldSecond = await second.inputValue();
    await act(() => first.fill('35'));
    await act(() => first.blur());
    await act(() => second.fill('65'));
    await act(() => second.blur());
    await page.waitForTimeout(200);
    await act(() => page.getByText('تحليل الحساسية', { exact: true }).first().click());
    await page.waitForTimeout(300);
    if ((await page.locator('svg').count()) === 0) throw new Error('sensitivity view has no chart/visual output');
    await act(() => page.getByText('لوحة المؤشرات', { exact: true }).first().click());
    await page.waitForTimeout(200);
    const decision = await safeDecisionVisible(page);
    await act(() => page.getByText('أرض + تطوير', { exact: true }).first().click());
    await first.fill(oldFirst || '30'); await first.blur();
    await second.fill(oldSecond || '60'); await second.blur();
    return { decision, taskGoal: 'edit land assumptions, inspect sensitivity, read analytical state' };
  });

  await runTask('FINANCING_DISCOVERY_AND_REVERSIBILITY', page, async (act) => {
    await act(() => page.getByText('مبنى قائم', { exact: true }).first().click());
    await page.waitForTimeout(150);
    const toggle = page.getByRole('switch', { name: 'تفعيل الرافعة المالية' }).first();
    if ((await toggle.count()) === 0) throw new Error('financing toggle cannot be discovered by accessible name');

    // The financing controls live inside a collapsed accordion. Model the real
    // user journey: discover and open that section before interacting with the
    // switch, instead of clicking an element hidden behind the collapsed panel.
    const section = toggle.locator('xpath=ancestor::div[contains(@class,"rounded-2xl") and contains(@class,"overflow-hidden")][1]');
    if ((await section.count()) === 0) throw new Error('financing section container could not be resolved');
    const sectionBody = section.locator('.rf-accordion-body').first();
    if ((await sectionBody.count()) === 0) throw new Error('financing accordion body could not be resolved');
    if (!((await sectionBody.getAttribute('class')) || '').split(/\s+/).includes('open')) {
      await act(() => section.locator(':scope > button').first().click());
      await page.waitForTimeout(220);
    }

    await toggle.scrollIntoViewIfNeeded();
    const before = await toggle.getAttribute('aria-checked');
    await act(() => toggle.click());
    await page.waitForTimeout(180);
    const after = await toggle.getAttribute('aria-checked');
    if (before === after) throw new Error('financing toggle did not communicate state change');
    await act(() => toggle.click());
    await page.waitForTimeout(120);
    const restored = await toggle.getAttribute('aria-checked');
    if (restored !== before) throw new Error('financing toggle was not reversible');
    return { before, after, restored, sectionOpened: true };
  });

  await runTask('MOBILE_CRITICAL_PATH', page, async (act) => {
    await act(() => page.setViewportSize({ width: 390, height: 844 }));
    await act(() => page.getByText('أرض + تطوير', { exact: true }).first().click());
    await act(() => page.getByText('تحليل الحساسية', { exact: true }).first().click());
    await page.waitForTimeout(250);
    await act(() => page.getByText('لوحة المؤشرات', { exact: true }).first().click());
    await page.waitForTimeout(200);
    await safeDecisionVisible(page);
    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (dims.scrollWidth > dims.clientWidth + 5) throw new Error(`mobile horizontal overflow ${JSON.stringify(dims)}`);
    return { ...dims, taskGoal: 'complete critical review path on a phone-sized viewport' };
  });

  await runTask('LANGUAGE_DIRECTION_SWITCH', page, async (act) => {
    await act(() => page.setViewportSize({ width: 1440, height: 900 }));
    const en = page.getByRole('button', { name: 'EN' }).first();
    if ((await en.count()) === 0) throw new Error('English language control not discoverable');
    await act(() => en.click());
    await page.waitForTimeout(220);
    const dirEn = await page.locator('html').getAttribute('dir');
    const langEn = await page.locator('html').getAttribute('lang');
    if (dirEn !== 'ltr') throw new Error(`English mode should be LTR, got ${dirEn}`);
    if (langEn !== 'en') throw new Error(`English mode should set html lang=en, got ${langEn}`);

    // The visible control is Arabic letter "ع" after switching to English;
    // its title is stable and explicit for accessibility/discovery.
    const ar = page.getByTitle('التبديل إلى العربية').first();
    if ((await ar.count()) === 0) throw new Error('Arabic language control not discoverable after switching to English');
    await act(() => ar.click());
    await page.waitForTimeout(220);
    const dirAr = await page.locator('html').getAttribute('dir');
    const langAr = await page.locator('html').getAttribute('lang');
    if (dirAr !== 'rtl') throw new Error(`Arabic mode should restore RTL, got ${dirAr}`);
    if (langAr !== 'ar-SA') throw new Error(`Arabic mode should set html lang=ar-SA, got ${langAr}`);
    return { dirEn, langEn, dirAr, langAr };
  });

  if (report.browserErrors.length) failed = true;
  if (report.consoleErrors.length) failed = true;
} catch (error) {
  failed = true;
  report.fatalError = error.message;
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  report.totalTasks = report.tasks.length;
  report.passedTasks = report.tasks.filter((x) => x.status === 'PASS').length;
  report.failedTasks = report.tasks.filter((x) => x.status === 'FAIL').length;
  report.totalActions = report.tasks.reduce((sum, x) => sum + (x.actions || 0), 0);
  report.result = failed || report.failedTasks > 0 ? 'FAIL' : 'PASS';
  report.interpretation = 'Task-based automation measures observable path completion, discoverability, feedback, reversibility, mobile continuity, and language-direction switching. It does not replace moderated usability sessions with representative users or measure subjective satisfaction.';
  fs.writeFileSync(`${EVIDENCE_DIR}/ux-task-scenarios-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
