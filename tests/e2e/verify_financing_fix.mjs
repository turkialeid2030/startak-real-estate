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

  const toggle = page.getByRole('switch', { name: 'تفعيل الرافعة المالية' });
  console.log('SWITCH_COUNT=' + await toggle.count());
  const stateBefore = await toggle.getAttribute('aria-checked');
  console.log('STATE_BEFORE=' + stateBefore);

  await toggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350); // allow the 0.25s grid-template-rows transition to fully settle

  await toggle.click({ timeout: 3000 }); // NORMAL click, no force
  await page.waitForTimeout(300);
  const stateAfter = await toggle.getAttribute('aria-checked');
  console.log('STATE_AFTER=' + stateAfter);
  const changed1 = stateBefore !== stateAfter;
  console.log('NORMAL_CLICK_1_CHANGED=' + changed1);

  await toggle.click({ timeout: 3000 });
  await page.waitForTimeout(300);
  const stateFinal = await toggle.getAttribute('aria-checked');
  console.log('STATE_FINAL=' + stateFinal);
  const roundTrip = stateFinal === stateBefore;
  console.log('ROUND_TRIP=' + roundTrip);

  console.log('FINANCING_NORMAL_BROWSER_CLICK=' + (changed1 && roundTrip ? 'PASS' : 'FAIL'));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
