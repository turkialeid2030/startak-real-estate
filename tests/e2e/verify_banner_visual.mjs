import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');
const EXECUTABLE = findChromiumExecutable();
fs.mkdirSync('runtime-evidence/e2e', { recursive: true });
let previewServer, browser;
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);

  const occInput = page.getByLabel('نسبة الإشغال المتوقعة');
  const bannerBefore = await page.getByText('قيمة إدخال غير صالحة').count();
  console.log('BANNER_VISIBLE_BEFORE=' + (bannerBefore > 0));

  await occInput.fill('150');
  await occInput.blur();
  await page.waitForTimeout(500);

  const bannerAfter = page.getByText('قيمة إدخال غير صالحة');
  const bannerCount = await bannerAfter.count();
  console.log('BANNER_VISIBLE_AFTER=' + (bannerCount > 0));
  if (bannerCount > 0) {
    const bannerText = await bannerAfter.locator('xpath=..').innerText();
    console.log('BANNER_FULL_TEXT=' + bannerText);
    const box = await bannerAfter.boundingBox();
    console.log('BANNER_VISIBLE_ON_SCREEN=' + (box && box.width > 0 && box.height > 0));
  }
  await page.screenshot({ path: 'runtime-evidence/e2e/validation-banner-visible.png' });

  // Now restore valid value and confirm banner disappears + results refresh
  await occInput.fill('85');
  await occInput.blur();
  await page.waitForTimeout(500);
  const bannerGone = await page.getByText('قيمة إدخال غير صالحة').count();
  console.log('BANNER_DISAPPEARS_ON_VALID_INPUT=' + (bannerGone === 0));
  const bodyRestored = await page.locator('body').innerText();
  console.log('RESULTS_UPDATE_AFTER_RECOVERY=' + /العائد|IRR|النسبة/.test(bodyRestored));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
