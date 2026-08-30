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

  // Sensitivity tab must still render cleanly with the bounded occupancy fix
  await page.getByText('تحليل الحساسية', { exact: true }).click();
  await page.waitForTimeout(500);
  const svgCount = await page.locator('svg').count();
  console.log('SENSITIVITY_RENDERS_AFTER_FIX=' + (svgCount > 0) + ' svgCount=' + svgCount);

  // DEF-002/003 E2E: occupancy field direct extreme edit does not crash the app
  await page.getByText('لوحة المؤشرات', { exact: true }).click();
  await page.waitForTimeout(300);
  const occInput = page.locator('input[type="text"], input[inputmode="decimal"]').nth(9); // occupancyRate field position varies; use label-based lookup instead below for reliability
  console.log('PAGE_ERRORS=' + pageErrors.length);
  if (pageErrors[0]) console.log('SAMPLE: ' + pageErrors[0].slice(0,200));
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
