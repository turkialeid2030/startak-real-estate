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
  await toggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const diag = await page.evaluate(() => {
    const btn = document.querySelector('button[role="switch"]');
    const rect = btn.getBoundingClientRect();
    const cx = rect.x + rect.width/2, cy = rect.y + rect.height/2;
    const el = document.elementFromPoint(cx, cy);
    // Get the FULL text content of the intercepting element to identify WHICH section it belongs to
    const path = [];
    let cur = el;
    while (cur && cur !== document.body) {
      path.push({ tag: cur.tagName, cls: cur.className?.toString().slice(0,60), text: cur.textContent?.trim().slice(0,50) });
      cur = cur.parentElement;
    }
    return {
      toggleRect: rect,
      viewportHeight: window.innerHeight,
      elAtPoint_fullText: el?.textContent?.trim().slice(0, 100),
      elAtPoint_tag: el?.tagName,
      ancestorPath: path.slice(0, 5),
    };
  });
  console.log(JSON.stringify(diag, null, 2));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
