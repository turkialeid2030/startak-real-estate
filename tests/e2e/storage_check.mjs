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
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const windowStorageExists = await page.evaluate(() => typeof window.storage);
  console.log('typeof window.storage = ' + windowStorageExists);

  // Try clicking save directly and capture the resulting error
  await page.locator('input[type="text"], input[inputmode="decimal"]').first().fill('444444');
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('اسم الصفقة...').fill('storage-test');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.waitForTimeout(800);

  console.log('CONSOLE_ERRORS: ' + JSON.stringify(errors, null, 2));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
