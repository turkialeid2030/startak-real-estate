import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/e2e';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const CAPTURE_STYLE_PROPS = ['display','position','zIndex','overflow','overflowX','overflowY','transform','translate','scale','contain','isolation','opacity','visibility','pointerEvents','clipPath','willChange','gridTemplateRows','transitionProperty','transitionDuration','animationName'];

let previewServer, browser;
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);

  // ===== Section 4: ancestor chain capture =====
  const ancestorChain = await page.evaluate((props) => {
    const btn = document.querySelector('.flex.items-center.justify-between.py-2.mb-2 button.relative.shrink-0') ||
      [...document.querySelectorAll('button')].find(b => b.parentElement?.previousElementSibling === null && b.previousElementSibling?.textContent === 'تفعيل الرافعة المالية');
    // Robust find: locate by exact preceding sibling text
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => {
      const row = b.closest('.flex.items-center.justify-between');
      return row && row.textContent.includes('تفعيل الرافعة المالية');
    });
    if (!target) return { error: 'toggle button not found' };
    const chain = [];
    let cur = target;
    let depth = 0;
    while (cur && cur !== document.body && depth < 12) {
      const r = cur.getBoundingClientRect();
      const cs = getComputedStyle(cur);
      const styleSnapshot = {};
      for (const p of props) styleSnapshot[p] = cs[p];
      chain.push({
        depth, tag: cur.tagName, className: cur.className?.toString().slice(0,100), id: cur.id || null, role: cur.getAttribute('role'),
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        computed: styleSnapshot,
      });
      cur = cur.parentElement;
      depth++;
    }
    return { chain };
  }, CAPTURE_STYLE_PROPS);
  fs.writeFileSync(`${EVIDENCE_DIR}/financing-ancestor-style-trace.json`, JSON.stringify(ancestorChain, null, 2));
  console.log('ANCESTOR_CHAIN_CAPTURED depth=' + (ancestorChain.chain?.length ?? 'ERROR'));
  if (ancestorChain.error) console.log('ERROR: ' + ancestorChain.error);

  // ===== Section 5: toggle button itself =====
  const buttonSelf = await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    if (!target) return { error: 'not found' };
    const r = target.getBoundingClientRect();
    const cs = getComputedStyle(target);
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      offsetParentTag: target.offsetParent?.tagName || null,
      pointerEvents: cs.pointerEvents, visibility: cs.visibility, opacity: cs.opacity,
      disabled: target.disabled, tabIndex: target.tabIndex,
      children: [...target.children].map(c => ({ tag: c.tagName, cls: c.className?.toString() })),
    };
  });
  console.log('FINANCING_BUTTON_RECT=' + JSON.stringify(buttonSelf.rect));
  console.log('FINANCING_BUTTON_POINTER_EVENTS=' + buttonSelf.pointerEvents);

  // ===== Section 6+7: geometry timeline + hit test at every sample =====
  const toggle = page.locator('div.flex.items-center.justify-between', { hasText: 'تفعيل الرافعة المالية' }).locator('button');

  async function sample(label) {
    return page.evaluate((label) => {
      const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
      const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
      if (!target) return { label, error: 'not found' };
      const r = target.getBoundingClientRect();
      const accordionBody = target.closest('.rf-accordion-body');
      const accordionHeader = accordionBody?.previousElementSibling; // the <button> header per Section source
      const bodyRect = accordionBody?.getBoundingClientRect();
      const headerRect = accordionHeader?.getBoundingClientRect();
      const cs = accordionBody ? getComputedStyle(accordionBody) : null;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const elAtPoint = document.elementFromPoint(cx, cy);
      const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map(e => ({ tag: e.tagName, cls: e.className?.toString().slice(0, 60) }));
      return {
        label, scrollY: window.scrollY,
        buttonRect: { x: r.x, y: r.y, w: r.width, h: r.height },
        accordionBodyRect: bodyRect ? { x: bodyRect.x, y: bodyRect.y, w: bodyRect.width, h: bodyRect.height } : null,
        accordionHeaderRect: headerRect ? { x: headerRect.x, y: headerRect.y, w: headerRect.width, h: headerRect.height } : null,
        gridTemplateRows: cs?.gridTemplateRows,
        transitionProperty: cs?.transitionProperty,
        hitTestTag: elAtPoint?.tagName, hitTestCls: elAtPoint?.className?.toString().slice(0, 60),
        hitTestIsButtonItself: elAtPoint === target,
        elementsFromPointStack: stack,
      };
    }, label);
  }

  const timeline = [];
  timeline.push(await sample('T0_before_scroll'));
  await toggle.scrollIntoViewIfNeeded();
  timeline.push(await sample('T1_immediately_after_scroll'));
  await page.waitForTimeout(50); timeline.push(await sample('T2_+50ms'));
  await page.waitForTimeout(50); timeline.push(await sample('T3_+100ms_total'));
  await page.waitForTimeout(150); timeline.push(await sample('T4_+250ms_total'));
  await page.waitForTimeout(150); timeline.push(await sample('T5_+400ms_total'));
  await page.waitForTimeout(350); timeline.push(await sample('T6_+750ms_total'));

  fs.writeFileSync(`${EVIDENCE_DIR}/financing-hit-test-timeline.json`, JSON.stringify(timeline, null, 2));
  timeline.forEach(t => console.log(`${t.label}: hitTest=${t.hitTestTag}.${t.hitTestCls} isButton=${t.hitTestIsButtonItself} gridRows=${t.gridTemplateRows} buttonY=${t.buttonRect?.y}`));

  // ===== Section 8: viewport relation =====
  const last = timeline[timeline.length - 1];
  const insideViewport = last.buttonRect && last.buttonRect.y >= 0 && (last.buttonRect.y + last.buttonRect.h) <= 1200;
  console.log('TOGGLE_FULLY_INSIDE_VIEWPORT=' + insideViewport);

  // ===== Section 9: grid transition instrumentation =====
  await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    const body = target?.closest('.rf-accordion-body');
    window.__transitionEvents = [];
    if (body) {
      for (const evt of ['transitionstart','transitionrun','transitionend','transitioncancel']) {
        body.addEventListener(evt, (e) => window.__transitionEvents.push({ type: evt, propertyName: e.propertyName, t: performance.now() }));
      }
    }
  });
  await toggle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const transitionEvents = await page.evaluate(() => window.__transitionEvents);
  console.log('GRID_TRANSITION_EVENTS=' + JSON.stringify(transitionEvents));
  const gridActive = transitionEvents.some(e => e.type === 'transitionrun' || e.type === 'transitionstart');
  const gridEndEvt = transitionEvents.find(e => e.type === 'transitionend');
  console.log('GRID_TRANSITION_ACTIVE_DURING_SCROLL=' + gridActive);
  console.log('GRID_TRANSITION_END_TIME_MS=' + (gridEndEvt ? gridEndEvt.t : 'no_transitionend_observed'));

  // ===== Section 10: does scroll itself change accordion state? =====
  const stateBeforeScroll = await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    return target?.closest('.rf-accordion-body')?.classList.contains('open');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('مبنى قائم', { exact: true }).click();
  await page.waitForTimeout(300);
  const stateAfterFreshLoad = await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    return target?.closest('.rf-accordion-body')?.classList.contains('open');
  });
  const toggle2 = page.locator('div.flex.items-center.justify-between', { hasText: 'تفعيل الرافعة المالية' }).locator('button');
  await toggle2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(750);
  const stateAfterScrollAndWait = await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    return target?.closest('.rf-accordion-body')?.classList.contains('open');
  });
  console.log(`ACCORDION_STATE: freshLoad=${stateAfterFreshLoad} afterScroll750ms=${stateAfterScrollAndWait}`);
  console.log('SCROLL_CHANGED_ACCORDION_STATE=' + (stateAfterFreshLoad !== stateAfterScrollAndWait));

  // ===== Section 11: trial click =====
  let trialResult = 'UNKNOWN', trialError = null;
  try {
    await toggle2.click({ trial: true, timeout: 3000 });
    trialResult = 'PASS';
  } catch (e) {
    trialResult = 'FAIL';
    trialError = e.message.split('\n').slice(0, 3).join(' | ');
  }
  console.log('PLAYWRIGHT_TRIAL_CLICK=' + trialResult);
  console.log('TRIAL_CLICK_FAILURE_REASON=' + trialError);

  // ===== Section 13: event trace =====
  await page.evaluate(() => {
    const allBtns = [...document.querySelectorAll('div.flex.items-center.justify-between button')];
    const target = allBtns.find(b => b.closest('.flex.items-center.justify-between')?.textContent.includes('تفعيل الرافعة المالية'));
    window.__eventTrace = [];
    for (const evt of ['pointerdown','mousedown','pointerup','mouseup','click']) {
      target.addEventListener(evt, (e) => window.__eventTrace.push({ evt, x: e.clientX, y: e.clientY, t: performance.now(), targetIsButton: e.target === target }));
      document.body.addEventListener(evt, (e) => window.__eventTrace.push({ evt: evt + '_bodyLevel', targetTag: e.target.tagName, targetCls: e.target.className?.toString().slice(0,40), t: performance.now() }), true);
    }
  });
  // attempt one normal click for tracing purposes (per Section 12/13 -- diagnostic, not workaround)
  let normalClickError = null;
  try { await toggle2.click({ timeout: 2500 }); } catch (e) { normalClickError = e.message.split('\n')[0]; }
  const eventTrace = await page.evaluate(() => window.__eventTrace);
  fs.writeFileSync(`${EVIDENCE_DIR}/financing-pointer-event-trace.json`, JSON.stringify(eventTrace, null, 2));
  console.log('EVENT_TRACE=' + JSON.stringify(eventTrace));
  const pointerdownReached = eventTrace.some(e => e.evt === 'pointerdown' && e.targetIsButton);
  const clickReached = eventTrace.some(e => e.evt === 'click' && e.targetIsButton);
  console.log('POINTERDOWN_REACHED_TOGGLE=' + pointerdownReached);
  console.log('CLICK_REACHED_TOGGLE=' + clickReached);
  console.log('NORMAL_CLICK_ERROR=' + normalClickError);

} catch (e) {
  console.log('FATAL: ' + e.message);
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise((r) => previewServer.httpServer.close(() => r()));
  console.log('DONE');
}
