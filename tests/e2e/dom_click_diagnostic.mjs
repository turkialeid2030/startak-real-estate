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

  const bgBefore = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')];
    const labelDiv = divs.find(d => d.textContent.trim() === 'تفعيل الرافعة المالية');
    const row = labelDiv.closest('.justify-between');
    const btn = row.querySelector('button');
    return getComputedStyle(btn).backgroundColor;
  });
  console.log('BG_BEFORE=' + bgBefore);

  // DIAGNOSTIC ONLY: real DOM .click() inside browser context, bypassing Playwright's actionability/hit-testing checks entirely
  const domClickResult = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')];
    const labelDiv = divs.find(d => d.textContent.trim() === 'تفعيل الرافعة المالية');
    const row = labelDiv.closest('.justify-between');
    const btn = row.querySelector('button');
    const rect = btn.getBoundingClientRect();
    const elAtPoint = document.elementFromPoint(rect.x + rect.width/2, rect.y + rect.height/2);
    btn.click(); // native DOM click -- fires the real onClick React handler directly
    return { fired: true, elementFromPointWasButton: elAtPoint === btn, elementFromPointTag: elAtPoint?.tagName, elementFromPointClass: elAtPoint?.className?.toString().slice(0,60) };
  });
  console.log('DOM_CLICK_DIAGNOSTIC=' + JSON.stringify(domClickResult));
  await page.waitForTimeout(400);

  const bgAfter = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')];
    const labelDiv = divs.find(d => d.textContent.trim() === 'تفعيل الرافعة المالية');
    const row = labelDiv.closest('.justify-between');
    const btn = row.querySelector('button');
    return getComputedStyle(btn).backgroundColor;
  });
  console.log('BG_AFTER=' + bgAfter);
  console.log('DOM_CLICK_STATE_CHANGED=' + (bgBefore !== bgAfter));

} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
