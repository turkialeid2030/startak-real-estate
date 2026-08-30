import { preview } from 'vite';
import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');
const EXECUTABLE = findChromiumExecutable();
let previewServer, browser;
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);

  // Toggle structure: <div flex justify-between><div>label</div><button onClick.../></div>
  // Target: the sibling <button> of the label-containing div, within the same parent row.
  const labelDiv = page.locator('div', { hasText: 'تفعيل الرافعة المالية' }).last();
  const row = labelDiv.locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
  const toggleButton = row.locator('button');
  console.log('TOGGLE_BUTTON_COUNT=' + await toggleButton.count());

  // Check real background color before (checked=false -> hairline color, checked=true -> brass)
  const bgBefore = await toggleButton.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('BG_BEFORE=' + bgBefore);

  const irrBefore = await page.locator('body').innerText();
  const equityBefore = /رأس المال المستثمر|حقوق الملكية المطلوبة/.test(irrBefore);

  await toggleButton.click({ timeout: 3000 });
  await page.waitForTimeout(400);

  const bgAfter = await toggleButton.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('BG_AFTER=' + bgAfter);
  const stateChanged = bgBefore !== bgAfter;
  console.log('STATE_CHANGED=' + stateChanged);

  const bodyAfter = await page.locator('body').innerText();
  const hasDscrValue = /نسبة تغطية خدمة الدين الفعلية|DSCR الفعلي/.test(bodyAfter) || /الرصيد المتبقي|القسط السنوي/.test(bodyAfter);
  console.log('HAS_LOAN_OUTPUT_AFTER=' + hasDscrValue);

  // round trip
  await toggleButton.click({ timeout: 3000 });
  await page.waitForTimeout(400);
  const bgFinal = await toggleButton.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('BG_FINAL=' + bgFinal + ' roundTrip=' + (bgFinal === bgBefore));

} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
