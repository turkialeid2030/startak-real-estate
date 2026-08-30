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

  const sectionHeader = page.getByRole('button', { name: /القسم السابع.*التمويل العقاري/ });
  console.log('FINANCING_SECTION_HEADER_COUNT=' + await sectionHeader.count());

  const gridBefore = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const t = btns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    return t?.closest('.rf-accordion-body') ? getComputedStyle(t.closest('.rf-accordion-body')).gridTemplateRows : 'NOT_FOUND';
  });
  console.log('FINANCING_SECTION_INITIAL_STATE=' + (gridBefore === '0px' ? 'CLOSED' : 'OPEN') + ' (grid=' + gridBefore + ')');

  await sectionHeader.click();
  await page.waitForTimeout(400); // allow 0.25s CSS transition to fully settle

  const gridAfter = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const t = btns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    return t?.closest('.rf-accordion-body') ? getComputedStyle(t.closest('.rf-accordion-body')).gridTemplateRows : 'NOT_FOUND';
  });
  console.log('FINANCING_SECTION_OPEN=' + (gridAfter !== '0px') + ' (grid=' + gridAfter + ')');

  const toggle = page.locator('div.flex.items-center.justify-between', { hasText: 'تفعيل الرافعة المالية' }).locator('button');
  const hitTestAfterOpen = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const t = btns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    const r = t.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    return { isButton: el === t, tag: el?.tagName, cls: el?.className?.toString().slice(0,60) };
  });
  console.log('TOGGLE_HIT_TEST_AFTER_OPEN=' + JSON.stringify(hitTestAfterOpen));
  console.log('TOGGLE_CLIPPED_AFTER_SECTION_OPEN=' + !hitTestAfterOpen.isButton);

  // Real financing output: equity investment / loan amount (present only under leverageEnabled)
  const bodyBefore = await page.locator('body').innerText();
  const hasLoanOutputBefore = /مبلغ التمويل|القسط السنوي|حقوق الملكية المطلوبة/.test(bodyBefore);
  console.log('HAS_LOAN_OUTPUT_BEFORE=' + hasLoanOutputBefore);

  await toggle.click({ timeout: 3000 });
  await page.waitForTimeout(400);
  const bodyAfter = await page.locator('body').innerText();
  const hasLoanOutputAfter = /مبلغ التمويل|القسط السنوي|حقوق الملكية المطلوبة/.test(bodyAfter);
  console.log('FINANCING_NORMAL_BROWSER_CLICK=PASS');
  console.log('FINANCING_CONTROL_STATE_CHANGED=' + (bodyBefore !== bodyAfter));
  console.log('HAS_LOAN_OUTPUT_AFTER=' + hasLoanOutputAfter);
  console.log('FINANCING_RESULT_STATE_CHANGED=' + (hasLoanOutputAfter && !hasLoanOutputBefore));

  await toggle.click({ timeout: 3000 });
  await page.waitForTimeout(400);
  const bodyFinal = await page.locator('body').innerText();
  const hasLoanOutputFinal = /مبلغ التمويل|القسط السنوي|حقوق الملكية المطلوبة/.test(bodyFinal);
  console.log('FINANCING_ROUND_TRIP=' + (hasLoanOutputFinal === hasLoanOutputBefore ? 'PASS' : 'FAIL'));

} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
