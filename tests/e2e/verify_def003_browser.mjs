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
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);

  // DEF-003: type 309+ digits into rentPerSqm-equivalent field
  const rentField = page.getByLabel(/سعر المتر التأجيري|الإيجار السنوي للمتر/).first();
  console.log('RENT_FIELD_COUNT=' + await rentField.count());
  const longDigits = '9'.repeat(320);
  await rentField.fill(longDigits);
  await rentField.blur({ timeout: 5000 });
  await page.waitForTimeout(500);

  const bannerCount = await page.getByText('قيمة إدخال غير صالحة').count();
  console.log('DEF003_BANNER_VISIBLE=' + (bannerCount > 0));
  console.log('DEF003_PAGE_ERRORS=' + pageErrors.length);
  const bodyStill = await page.locator('body').innerText();
  console.log('DEF003_APP_STILL_RESPONSIVE=' + (bodyStill.length > 100));

  if (bannerCount > 0) {
    const bannerText = await page.getByText('قيمة إدخال غير صالحة').locator('xpath=..').innerText();
    console.log('DEF003_BANNER_TEXT=' + bannerText.slice(0, 200));
  }
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
