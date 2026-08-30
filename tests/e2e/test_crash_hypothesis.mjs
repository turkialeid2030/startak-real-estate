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

  const occInput = page.getByLabel('نسبة الإشغال المتوقعة');
  console.log('OCC_INPUT_COUNT=' + await occInput.count());
  const before = await occInput.inputValue();
  console.log('OCCUPANCY_UI_INITIAL_VALUE=' + before);
  const bodyBefore = await page.locator('body').innerText();
  const irrBefore = /معدل العائد الداخلي\s*\n?\s*([\d.]+)%/.exec(bodyBefore)?.[1];
  console.log('IRR_BEFORE=' + irrBefore);

  await occInput.fill('150');
  await occInput.blur();
  await page.waitForTimeout(500);

  const bodyAfter = await page.locator('body').innerText().catch(() => 'BODY_UNREADABLE');
  console.log('PAGE_ERRORS=' + pageErrors.length);
  console.log('APP_STILL_RENDERS=' + (bodyAfter.length > 100));
  const irrAfter = /معدل العائد الداخلي\s*\n?\s*([\d.]+)%/.exec(bodyAfter)?.[1];
  console.log('IRR_AFTER=' + irrAfter);
  console.log('BODY_SAMPLE=' + bodyAfter.slice(0, 400));
  if (pageErrors[0]) console.log('CRASH_ERROR=' + pageErrors[0].slice(0, 400));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
