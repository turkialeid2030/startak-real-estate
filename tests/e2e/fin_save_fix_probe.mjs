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

  // === FINANCING: click toggleLabel directly, no ancestor, after real scrollIntoViewIfNeeded ===
  const pageF = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await pageF.goto(url, { waitUntil: 'domcontentloaded' });
  await pageF.getByText('مبنى قائم', { exact: true }).click();
  await pageF.waitForTimeout(300);

  const toggleLabel = pageF.getByText('تفعيل الرافعة المالية', { exact: true });
  await toggleLabel.scrollIntoViewIfNeeded();
  await pageF.waitForTimeout(200);
  const bodyBefore = await pageF.locator('body').innerText();
  const hasDscrBefore = /نسبة تغطية خدمة الدين/.test(bodyBefore);
  console.log('BEFORE: hasDscrLabel=' + hasDscrBefore);

  let normalClickWorked = false;
  try { await toggleLabel.click({ timeout: 2000 }); normalClickWorked = true; }
  catch (e) { console.log('NORMAL_CLICK_FAILED: ' + e.message.slice(0,120)); }

  if (!normalClickWorked) {
    console.log('FALLBACK_TO_FORCE_ON_SAME_ELEMENT');
    await toggleLabel.click({ force: true, position: { x: 5, y: 5 } });
  }
  await pageF.waitForTimeout(400);
  const bodyAfter = await pageF.locator('body').innerText();
  const hasDscrAfter = /نسبة تغطية خدمة الدين/.test(bodyAfter);
  const changed = bodyBefore !== bodyAfter;
  console.log('AFTER: hasDscrLabel=' + hasDscrAfter + ' changed=' + changed + ' normalClickWorked=' + normalClickWorked);
  console.log('FINANCING_RESULT=' + (changed ? 'PASS' : 'FAIL'));

  await pageF.close();

  // === SAVED DEALS: use getByPlaceholder, idx=0 confirmed ===
  const context5 = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page5 = await context5.newPage();
  await page5.goto(url, { waitUntil: 'domcontentloaded' });
  await page5.waitForTimeout(300);
  await page5.locator('input[type="text"], input[inputmode="decimal"]').first().fill('444444');
  await page5.locator('input[type="text"], input[inputmode="decimal"]').first().blur();
  await page5.waitForTimeout(200);

  await page5.getByTitle('الصفقات المحفوظة').click();
  await page5.waitForTimeout(300);
  const nameField = page5.getByPlaceholder('اسم الصفقة...');
  console.log('NAME_FIELD_COUNT=' + await nameField.count());
  await nameField.fill('E2E-Core-05-Saved-Deal');
  await page5.getByRole('button', { name: 'حفظ', exact: true }).click({ timeout: 2500 });
  await page5.waitForTimeout(600);
  const bodyAfterSave = await page5.locator('body').innerText();
  const visible = bodyAfterSave.includes('E2E-Core-05-Saved-Deal');
  console.log('SAVED_DEAL_VISIBLE=' + visible);

  const storageKeys = await page5.evaluate(() => Object.keys(window.localStorage || {}));
  console.log('LOCALSTORAGE_KEYS=' + JSON.stringify(storageKeys));

  await page5.close();
  await context5.close();
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
