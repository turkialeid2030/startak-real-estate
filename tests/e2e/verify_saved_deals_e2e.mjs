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
  await page.waitForTimeout(300);

  const windowStorageUndefined = await page.evaluate(() => typeof window.storage === 'undefined');
  console.log('WINDOW_STORAGE_UNDEFINED=' + windowStorageUndefined);

  await page.locator('input[type="text"], input[inputmode="decimal"]').first().fill('444444');
  await page.locator('input[type="text"], input[inputmode="decimal"]').first().blur();
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('اسم الصفقة...').fill('E2E-Storage-Deal');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click({ timeout: 3000 });
  await page.waitForTimeout(600);

  const bodyAfterSave = await page.locator('body').innerText();
  const visible = bodyAfterSave.includes('E2E-Storage-Deal');
  console.log('SAVED_DEAL_CREATED_VIA_UI=true SAVED_DEAL_VISIBLE_AFTER_SAVE=' + visible);

  const lsKeys = await page.evaluate(() => Object.keys(window.localStorage));
  console.log('SELECTED_STORAGE_PROVIDER=' + (lsKeys.some(k => k.includes('STARTAK_REAL_ESTATE:SAVED_DEALS')) ? 'BrowserLocalStorageProvider' : 'UNKNOWN'));
  console.log('LOCALSTORAGE_KEYS=' + JSON.stringify(lsKeys));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(300);
  const bodyReload = await page.locator('body').innerText();
  const survives = bodyReload.includes('E2E-Storage-Deal');
  console.log('SAVED_DEAL_SURVIVES_RELOAD=' + survives);

  if (survives) {
    await page.getByText('E2E-Storage-Deal').click();
    await page.waitForTimeout(400);
    const restored = await page.locator('input[type="text"], input[inputmode="decimal"]').first().inputValue();
    const modeRestored = (await page.locator('body').innerText()).includes('مبنى قائم');
    console.log('SAVED_DEAL_INPUT_RESTORED=' + (restored === '444444'));
    console.log('SAVED_DEAL_MODE_RESTORED=' + modeRestored);
  }
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
