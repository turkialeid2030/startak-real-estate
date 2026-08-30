import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
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

  const snapshot = await page.evaluate(() => {
    const divs = [...document.querySelectorAll('div')];
    const labelDiv = divs.find(d => d.textContent.trim() === 'تفعيل الرافعة المالية');
    const row = labelDiv.closest('.justify-between');
    const btn = row.querySelector('button');
    const rect = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    const centerX = rect.x + rect.width/2, centerY = rect.y + rect.height/2;
    const elAtCenter = document.elementFromPoint(centerX, centerY);
    let interceptor = null;
    if (elAtCenter && elAtCenter !== btn) {
      interceptor = { tag: elAtCenter.tagName, cls: elAtCenter.className?.toString().slice(0,100), zIndex: getComputedStyle(elAtCenter).zIndex, position: getComputedStyle(elAtCenter).position };
    }
    return {
      outer_row_class: row.className,
      button: { tag: btn.tagName, type: btn.type, boundingBox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        computed: { pointerEvents: cs.pointerEvents, zIndex: cs.zIndex, position: cs.position, backgroundColor: cs.backgroundColor, visibility: cs.visibility },
        checked_proxy_bgcolor: cs.backgroundColor },
      elementFromPointAtCenter: elAtCenter ? { tag: elAtCenter.tagName, cls: elAtCenter.className?.toString().slice(0,100), isButtonItself: elAtCenter === btn } : { tag: null, note: 'elementFromPoint returned null -- center point outside current viewport bounds at capture time' },
      interceptor,
      viewport_note: `center=(${centerX.toFixed(0)},${centerY.toFixed(0)}) vs viewport height 1200`,
    };
  });
  fs.writeFileSync('runtime-evidence/e2e/financing-toggle-dom.json', JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
