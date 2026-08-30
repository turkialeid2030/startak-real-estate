import { preview } from 'vite';
import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_AT ' + label)), ms)),
  ]);
}

let previewServer, browser;
try {
  previewServer = await withTimeout(
    preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } }),
    3000, 'VITE_START'
  );
  console.log('PROBE-01 VITE_START PASS');

  const addr = previewServer.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  const res = await withTimeout(fetch(url), 3000, 'HTTP_200');
  console.log('PROBE-02 HTTP_200 ' + (res.status === 200 ? 'PASS' : 'FAIL status=' + res.status));

  browser = await withTimeout(
    chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] }),
    5000, 'BROWSER_LAUNCH'
  );
  console.log('PROBE-03 BROWSER_LAUNCH PASS ' + browser.version());

  const page = await browser.newPage();
  await withTimeout(page.goto(url, { waitUntil: 'domcontentloaded' }), 5000, 'PAGE_GOTO');
  console.log('PROBE-04 PAGE_GOTO PASS');

  const title = await withTimeout(page.title(), 2500, 'DOM_READ_TITLE');
  const bodyText = await withTimeout(page.locator('body').innerText(), 2500, 'DOM_READ_BODY');
  console.log('PROBE-05 DOM_READ PASS title=' + title + ' body200=' + bodyText.slice(0, 200).replace(/\n/g, ' '));

  await withTimeout(browser.close(), 3000, 'BROWSER_CLOSE');
  browser = null;
  console.log('PROBE-06 BROWSER_CLOSE PASS');

  await withTimeout(new Promise((resolve) => previewServer.httpServer.close(() => resolve())), 3000, 'SERVER_CLOSE');
  previewServer = null;
  console.log('PROBE-07 SERVER_CLOSE PASS');

  process.exitCode = 0;
} catch (e) {
  console.log('PROBE_FAILURE: ' + e.message);
  process.exitCode = 1;
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  if (previewServer) { try { await new Promise((r) => previewServer.httpServer.close(() => r())); } catch {} }
  console.log('PROBE_DONE');
}
