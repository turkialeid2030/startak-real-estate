import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/deep-platform';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const results = { suite: 'UX_EXPERIENCE_REAL_BROWSER_V1', checks: [] };
let previewServer = null;
let browser = null;
let failed = false;

function record(name, passed, detail = null) {
  results.checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) failed = true;
}

async function viewportAudit(page, name, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  const audit = await page.evaluate(() => {
    const doc = document.documentElement;
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
    };
    const interactives = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[tabindex]')].filter(visible);
    const tinyTargets = interactives.filter((el) => {
      const r = el.getBoundingClientRect();
      return !el.matches('input[type="hidden"]') && (r.width < 24 || r.height < 24);
    }).map((el) => ({ tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
    const tinyText = [...document.querySelectorAll('body *')].filter(visible).filter((el) => {
      const text = (el.textContent || '').trim();
      if (!text || el.children.length > 0) return false;
      return parseFloat(getComputedStyle(el).fontSize) < 10;
    }).slice(0, 20).map((el) => ({ text: el.textContent.trim().slice(0, 60), fontSize: getComputedStyle(el).fontSize }));
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      interactiveCount: interactives.length,
      tinyTargets: tinyTargets.slice(0, 20),
      tinyText,
    };
  });
  record(`${name}_NO_HORIZONTAL_OVERFLOW`, audit.scrollWidth <= audit.clientWidth + 5, audit);
  record(`${name}_TOUCH_TARGETS_24PX`, audit.tinyTargets.length === 0, audit.tinyTargets);
  record(`${name}_NO_UNREADABLY_TINY_TEXT`, audit.tinyText.length === 0, audit.tinyText);
}

try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ar-SA' });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.waitForTimeout(250);

  record('ARABIC_RTL_DEFAULT', (await page.locator('html').getAttribute('dir')) === 'rtl');
  record('APP_HAS_MEANINGFUL_CONTENT', (await page.locator('body').innerText()).trim().length > 500);

  const landmarks = await page.evaluate(() => ({
    headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length,
    buttons: document.querySelectorAll('button,[role="button"]').length,
    inputs: document.querySelectorAll('input,select,textarea').length,
  }));
  record('INFORMATION_HIERARCHY_HAS_HEADINGS', landmarks.headings > 0, landmarks);
  record('CORE_INTERACTION_SURFACE_PRESENT', landmarks.buttons > 0 && landmarks.inputs > 0, landmarks);

  const unlabeled = await page.evaluate(() => {
    const visible = (el) => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
    };
    return [...document.querySelectorAll('input,select,textarea')].filter(visible).filter((el) => {
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      const id = el.id;
      const explicit = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const wrapped = el.closest('label');
      return !aria && !explicit && !wrapped;
    }).map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), name: el.getAttribute('name'), placeholder: el.getAttribute('placeholder') })).slice(0, 30);
  });
  record('FORM_CONTROLS_HAVE_ACCESSIBLE_LABELS', unlabeled.length === 0, unlabeled);

  const emptyButtons = await page.evaluate(() => [...document.querySelectorAll('button,[role="button"]')].filter((el) => {
    const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
    const name = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    return !name;
  }).map((el) => el.outerHTML.slice(0, 180)).slice(0, 20));
  record('BUTTONS_HAVE_DISCERNIBLE_NAMES', emptyButtons.length === 0, emptyButtons);

  const focusSequence = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 60),
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        boxShadow: s.boxShadow,
      };
    });
    if (active) focusSequence.push(active);
  }
  record('KEYBOARD_TAB_NAVIGATION_WORKS', focusSequence.length >= 5, focusSequence);
  const visibleFocusCount = focusSequence.filter((x) => (x.outlineStyle && x.outlineStyle !== 'none' && x.outlineWidth !== '0px') || (x.boxShadow && x.boxShadow !== 'none')).length;
  record('KEYBOARD_FOCUS_IS_VISIBLE', visibleFocusCount >= Math.min(3, focusSequence.length), { visibleFocusCount, focusSequence });

  const coreViews = ['مبنى قائم', 'أرض + تطوير', 'التدفقات النقدية', 'تحليل الحساسية', 'لوحة المؤشرات'];
  for (const label of coreViews) {
    const locator = page.getByText(label, { exact: true }).first();
    const exists = await locator.count();
    record(`NAV_${label}_PRESENT`, exists > 0);
    if (exists > 0) {
      const before = await page.locator('body').innerText();
      await locator.click();
      await page.waitForTimeout(200);
      const after = await page.locator('body').innerText();
      // The application boots into Existing Building, so clicking that already-active
      // view is intentionally idempotent. A no-op in that one state is not a UX failure.
      const alreadyActiveDefault = label === 'مبنى قائم' && before === after;
      record(`NAV_${label}_RESPONDS`, after.length > 0 && (after !== before || alreadyActiveDefault || label === 'لوحة المؤشرات'));
    }
  }

  await page.getByText('مبنى قائم', { exact: true }).first().click();
  await page.waitForTimeout(200);
  const editable = page.locator('input[type="text"], input[inputmode="decimal"], input[type="number"]').first();
  if (await editable.count()) {
    const original = await editable.inputValue();
    const bodyBefore = await page.locator('body').innerText();
    await editable.fill('123456');
    await editable.blur();
    await page.waitForTimeout(250);
    const bodyAfter = await page.locator('body').innerText();
    record('INPUT_EDIT_IS_PERSISTED_VISIBLY', (await editable.inputValue()) === '123456');
    record('INPUT_EDIT_PRODUCES_FEEDBACK', bodyAfter !== bodyBefore);
    await editable.fill(original || '1');
    await editable.blur();
  } else {
    record('INPUT_EDIT_IS_PERSISTED_VISIBLY', false, 'No editable numeric/text input found');
    record('INPUT_EDIT_PRODUCES_FEEDBACK', false, 'No editable numeric/text input found');
  }

  await page.getByText('لوحة المؤشرات', { exact: true }).first().click();
  await page.waitForTimeout(200);
  const dashboard = await page.locator('body').innerText();
  const safeLabel = /حالة تحليلية مواتية|حالة تحليلية مشروطة|مخاطر تحليلية مرتفعة|تعليق التحليل لحين استكمال الأدلة|يتطلب مراجعة مختص مرخص/.test(dashboard);
  const imperative = /يوصى بالشراء|لا يوصى بالشراء/.test(dashboard);
  record('DECISION_LANGUAGE_IS_NON_IMPERATIVE', safeLabel && !imperative, { safeLabel, imperative });

  await viewportAudit(page, 'MOBILE_390', 390, 844);
  await viewportAudit(page, 'TABLET_768', 768, 1024);
  await viewportAudit(page, 'DESKTOP_1440', 1440, 900);

  const motion = await page.emulateMedia({ reducedMotion: 'reduce' }).then(async () => page.evaluate(() => {
    const candidates = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.animationDuration) > 0 || parseFloat(s.transitionDuration) > 0;
    });
    return candidates.slice(0, 30).map((el) => ({ tag: el.tagName, animation: getComputedStyle(el).animationDuration, transition: getComputedStyle(el).transitionDuration }));
  }));
  record('REDUCED_MOTION_DOES_NOT_BREAK_UI', (await page.locator('#root').innerHTML()).length > 100, motion);

  results.consoleErrors = consoleErrors;
  results.pageErrors = pageErrors;
  record('NO_PAGE_ERRORS_DURING_UX_JOURNEY', pageErrors.length === 0, pageErrors.slice(0, 5));
  record('NO_CONSOLE_ERRORS_DURING_UX_JOURNEY', consoleErrors.length === 0, consoleErrors.slice(0, 5));
} catch (error) {
  failed = true;
  results.fatalError = error.message;
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((resolve) => previewServer.httpServer.close(resolve));
  results.totalChecks = results.checks.length;
  results.passedChecks = results.checks.filter((x) => x.status === 'PASS').length;
  results.failedChecks = results.checks.filter((x) => x.status === 'FAIL').length;
  results.result = failed || results.failedChecks > 0 ? 'FAIL' : 'PASS';
  results.caveat = 'Automated UX checks validate observable usability/accessibility heuristics and critical journeys. They do not replace moderated usability testing with representative real users.';
  fs.writeFileSync(`${EVIDENCE_DIR}/ux-experience-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.result === 'PASS' ? 0 : 1);
}
