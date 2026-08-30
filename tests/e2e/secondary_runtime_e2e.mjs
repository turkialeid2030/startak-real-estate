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
function log(id, status, extra) { console.log(`${id} ${status}${extra ? ' -- ' + extra : ''}`); result[id] = status; }

let previewServer, browser;
const pageErrors = [];
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);

  // SEC-01 SENSITIVITY
  await page.getByText('تحليل الحساسية', { exact: true }).click();
  await page.waitForTimeout(500);
  const svgInfo = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    return svgs.map(s => { const r = s.getBoundingClientRect(); return { w: r.width, h: r.height }; }).filter(r => r.w > 0 && r.h > 0);
  });
  log('SEC-01', svgInfo.length > 0 ? 'PASS' : 'FAIL', `nonZeroSvgCount=${svgInfo.length}`);
  result.SENSITIVITY_RUNTIME_FLOW = result['SEC-01'];

  // SEC-02 CASH_FLOW
  await page.getByText('التدفقات النقدية', { exact: true }).click();
  await page.waitForTimeout(400);
  const cashFlowText = await page.locator('body').innerText();
  const hasCashFlowContent = cashFlowText.length > 500 && /ريال|السنة/.test(cashFlowText);
  log('SEC-02', hasCashFlowContent ? 'PASS' : 'FAIL', `bodyLen=${cashFlowText.length}`);
  result.CASH_FLOW_RUNTIME_FLOW = result['SEC-02'];

  // SEC-03 RECOMMENDATION
  await page.getByText('لوحة المؤشرات', { exact: true }).click();
  await page.waitForTimeout(300);
  const bodyBefore = await page.locator('body').innerText();
  const recBefore = /يوصى بالشراء|لا يوصى بالشراء/.test(bodyBefore);
  const input = page.locator('input[type="text"], input[inputmode="decimal"]').first();
  await input.fill('850000');
  await input.blur();
  await page.waitForTimeout(400);
  const bodyAfter = await page.locator('body').innerText();
  const recAfter = /يوصى بالشراء|لا يوصى بالشراء/.test(bodyAfter);
  log('SEC-03', (recBefore && recAfter) ? 'PASS' : 'FAIL', `before=${recBefore} after=${recAfter}`);
  result.RECOMMENDATION_RUNTIME_FLOW = result['SEC-03'];

  // SEC-04/05/06 RESPONSIVE
  for (const [id, name, w, h] of [['SEC-04', 'MOBILE', 390, 844], ['SEC-05', 'TABLET', 768, 1024], ['SEC-06', 'DESKTOP', 1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const geom = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    const overflow = geom.scrollWidth > geom.clientWidth + 5;
    const bodyText = await page.locator('body').innerText();
    const coreReachable = /مبنى قائم/.test(bodyText) && /يوصى بالشراء|لا يوصى بالشراء/.test(bodyText);
    log(id, (!overflow && coreReachable) ? 'PASS' : 'FAIL', `scrollW=${geom.scrollWidth} clientW=${geom.clientWidth} coreReachable=${coreReachable}`);
    result[`${name}_SMOKE`] = result[id];
    await page.screenshot({ path: `${EVIDENCE_DIR}/${name.toLowerCase()}.png` }).catch(() => {});
  }
  result.RESPONSIVE_VIEWPORTS_TESTED = 3;
  result.RESPONSIVE_SMOKE_TEST = ['MOBILE_SMOKE', 'TABLET_SMOKE', 'DESKTOP_SMOKE'].every((k) => result[k] === 'PASS') ? 'PASS' : 'FAIL';

  // SEC-07 ARABIC RTL
  await page.setViewportSize({ width: 1440, height: 1200 });
  const dir = await page.locator('html').getAttribute('dir');
  const bodyTextFinal = await page.locator('body').innerText();
  const hasArabic = /[\u0600-\u06FF]/.test(bodyTextFinal);
  const noMojibake = !/�/.test(bodyTextFinal);
  log('SEC-07', (dir === 'rtl' && hasArabic && noMojibake) ? 'PASS' : 'FAIL', `dir=${dir} hasArabic=${hasArabic} noMojibake=${noMojibake}`);
  result.AR_SA_RUNTIME = result['SEC-07'];

  result.PAGE_ERRORS = pageErrors.length;
  console.log('PAGE_ERRORS=' + pageErrors.length);
  if (pageErrors[0]) console.log('SAMPLE: ' + pageErrors[0].slice(0, 150));

  const secTotal = ['SEC-01','SEC-02','SEC-03','SEC-04','SEC-05','SEC-06','SEC-07'];
  const secPassed = secTotal.filter((k) => result[k] === 'PASS').length;
  console.log('');
  console.log(`SECONDARY_E2E_TESTS_TOTAL=${secTotal.length}`);
  console.log(`SECONDARY_E2E_TESTS_PASSED=${secPassed}`);
  console.log(`SECONDARY_E2E_TESTS_FAILED=${secTotal.length - secPassed}`);
  console.log(`SECONDARY_E2E=${secPassed === secTotal.length ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(`${EVIDENCE_DIR}/secondary-e2e-result.json`, JSON.stringify(result, null, 2));
} catch (e) {
  console.log('FATAL: ' + e.message);
} finally {
  if (browser) { await browser.close(); console.log('BROWSER_CLOSED'); }
  if (previewServer) { await new Promise((r) => previewServer.httpServer.close(() => r())); console.log('PREVIEW_SERVER_CLOSED'); }
  console.log('DONE');
}
