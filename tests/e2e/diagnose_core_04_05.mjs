import { preview } from 'vite';
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');

const EXECUTABLE = findChromiumExecutable();
const EVIDENCE_DIR = 'runtime-evidence/e2e';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const result = {};
function log(id, status, extra) { console.log(`${id} ${status}${extra ? ' -- ' + extra : ''}`); result[id] = status; }

let previewServer, browser;
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox', '--disable-gpu'] });

  // ========== FINANCING DIAGNOSIS ==========
  const pageF = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await pageF.goto(url, { waitUntil: 'domcontentloaded' });
  await pageF.getByText('مبنى قائم', { exact: true }).click();
  await pageF.waitForTimeout(300);

  // Full inventory of financing-related controls
  const finInventory = await pageF.evaluate(() => {
    const keywords = ['تمويل', 'تمويلي', 'رافعة', 'قرض', 'Levered', 'Unlevered', 'DSCR'];
    const all = [...document.querySelectorAll('button, [role="switch"], [role="checkbox"], input[type="checkbox"], label')];
    return all.filter(el => keywords.some(k => (el.textContent || '').includes(k)))
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName, role: el.getAttribute('role'), type: el.getAttribute('type'),
          text: (el.textContent || '').trim().slice(0, 80),
          ariaLabel: el.getAttribute('aria-label'), checked: el.checked,
          ariaChecked: el.getAttribute('aria-checked'), disabled: el.disabled,
          box: { x: r.x, y: r.y, w: r.width, h: r.height }, visible: r.width > 0 && r.height > 0,
        };
      });
  });
  fs.writeFileSync(`${EVIDENCE_DIR}/financing-dom-inventory.json`, JSON.stringify(finInventory, null, 2));
  log('FIN-01-DOM_INVENTORY', finInventory.length > 0 ? 'PASS' : 'FAIL', `found=${finInventory.length}`);
  console.log(JSON.stringify(finInventory, null, 2));

  // The actual Toggle component: find the checkbox-like element (line ~1187:
  // <Toggle label="تفعيل الرافعة المالية" checked={inputs.leverageEnabled} .../>)
  // Toggle likely renders as a clickable div/button with a visual switch, not
  // a native <input type=checkbox>. Find the precise clickable ancestor.
  const toggleLabel = pageF.getByText('تفعيل الرافعة المالية', { exact: true });
  const labelBox = await toggleLabel.boundingBox();
  log('FIN-02-TARGET_FOUND', labelBox ? 'PASS' : 'FAIL', JSON.stringify(labelBox));

  // Determine actual pre-click state via a real indicator: does a DSCR VALUE
  // (not just the label) exist? Search for the specific metric row.
  const bodyBeforeF = await pageF.locator('body').innerText();
  const dscrValueBefore = /نسبة تغطية خدمة الدين[\s\S]{0,50}?([\d.,]+)/.exec(bodyBeforeF)?.[1] || 'NOT_FOUND';
  result.FINANCING_INITIAL_STATE = dscrValueBefore !== 'NOT_FOUND' ? 'LEVERED' : 'UNLEVERED';
  console.log('DSCR_VALUE_BEFORE=' + dscrValueBefore + ' -> initial=' + result.FINANCING_INITIAL_STATE);

  // scrollIntoViewIfNeeded then hit-test at the toggle's own switch element
  // (likely a sibling/child within the Toggle component -- inspect the actual
  // clickable element by walking up from the text to find onClick handler owner)
  await toggleLabel.scrollIntoViewIfNeeded();
  await pageF.waitForTimeout(200);
  const boxAfterScroll = await toggleLabel.boundingBox();
  const hitTest = await pageF.evaluate(({x,y}) => {
    const el = document.elementFromPoint(x,y);
    return el ? { tag: el.tagName, cls: el.className?.toString().slice(0,80), text: (el.textContent||'').slice(0,60) } : null;
  }, { x: boxAfterScroll.x + boxAfterScroll.width/2, y: boxAfterScroll.y + boxAfterScroll.height/2 });
  result.FINANCING_TARGET_IN_VIEWPORT = boxAfterScroll.y >= 0 && boxAfterScroll.y < 1200;
  result.FINANCING_TARGET_HIT_TEST = JSON.stringify(hitTest);
  console.log('IN_VIEWPORT=' + result.FINANCING_TARGET_IN_VIEWPORT + ' HIT_TEST=' + result.FINANCING_TARGET_HIT_TEST);

  // Click via the actual Toggle's clickable wrapper -- try clicking the
  // parent element (the whole Toggle row is typically the click target based
  // on the source: <Toggle> wraps checked/onChange around a full-row button/div)
  const clickableAncestor = toggleLabel.locator('xpath=ancestor::*[self::button or self::div][1]');
  let clickWorked = false;
  try {
    await clickableAncestor.click({ timeout: 2500 });
    clickWorked = true;
  } catch (e) {
    console.log('ANCESTOR_CLICK_FAILED: ' + e.message.slice(0,150));
  }
  await pageF.waitForTimeout(400);
  const bodyAfterF = await pageF.locator('body').innerText();
  const dscrValueAfter = /نسبة تغطية خدمة الدين[\s\S]{0,50}?([\d.,]+)/.exec(bodyAfterF)?.[1] || 'NOT_FOUND';
  const stateChanged = dscrValueBefore !== dscrValueAfter;
  console.log('DSCR_VALUE_AFTER=' + dscrValueAfter + ' clickWorked=' + clickWorked + ' stateChanged=' + stateChanged);
  log('FIN-03-STATE_CHANGE', stateChanged ? 'PASS' : 'FAIL', `before=${dscrValueBefore} after=${dscrValueAfter}`);
  result.FINANCING_CONTROL_STATE_CHANGED = stateChanged;

  if (stateChanged) {
    log('FIN-04-LEVERED', 'PASS', '');
    // toggle back
    await clickableAncestor.click({ timeout: 2500 }).catch(() => {});
    await pageF.waitForTimeout(400);
    const bodyFinal = await pageF.locator('body').innerText();
    const dscrFinal = /نسبة تغطية خدمة الدين[\s\S]{0,50}?([\d.,]+)/.exec(bodyFinal)?.[1] || 'NOT_FOUND';
    log('FIN-05-UNLEVERED', dscrFinal !== dscrValueAfter ? 'PASS' : 'FAIL', `after2=${dscrFinal}`);
    result.LEVERED_FLOW = 'PASS';
    result.UNLEVERED_FLOW = (dscrFinal !== dscrValueAfter) ? 'PASS' : 'FAIL';
  } else {
    log('FIN-04-LEVERED', 'FAIL', 'classification=' + (clickWorked ? 'APPLICATION_STATE_NOT_CHANGING' : 'CONTROL_NOT_INTERACTIVE'));
    log('FIN-05-UNLEVERED', 'SKIPPED', '');
    result.LEVERED_FLOW = 'FAIL';
    result.UNLEVERED_FLOW = 'SKIPPED';
  }
  result.FINANCING_TOGGLE_FLOW = (result.LEVERED_FLOW === 'PASS' && result.UNLEVERED_FLOW === 'PASS') ? 'PASS' : 'FAIL';
  await pageF.close();

  // ========== SAVED DEALS DIAGNOSIS ==========
  const context5 = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page5 = await context5.newPage();
  await page5.goto(url, { waitUntil: 'domcontentloaded' });
  await page5.waitForTimeout(300);
  await page5.getByTitle('الصفقات المحفوظة').click();
  await page5.waitForTimeout(300);

  const saveInventory = await page5.evaluate(() => {
    const texts = ['حفظ', 'الصفقات المحفوظة', 'صفقة', 'اسم', 'تحميل', 'فتح', 'حذف'];
    const buttons = [...document.querySelectorAll('button')].map(b => ({ text: (b.textContent||'').trim().slice(0,60), visible: b.getClientRects().length>0 }));
    const inputs = [...document.querySelectorAll('input')].map((i,idx) => ({ idx, type: i.type, placeholder: i.placeholder, value: i.value, visible: i.getClientRects().length>0 }));
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => (h.textContent||'').trim());
    return { buttons, inputs, headings };
  });
  fs.writeFileSync(`${EVIDENCE_DIR}/saved-deals-dom-inventory.json`, JSON.stringify(saveInventory, null, 2));
  log('SAVE-01-DOM_INVENTORY', 'PASS', `buttons=${saveInventory.buttons.length} inputs=${saveInventory.inputs.length}`);
  console.log(JSON.stringify(saveInventory, null, 2));

  // Determine workflow from inventory: is there a visible text input with a
  // placeholder suggesting deal name, present NOW (panel open)?
  const nameFieldCandidate = saveInventory.inputs.find(i => i.visible && i.type === 'text');
  result.SAVED_DEAL_WORKFLOW_TYPE = nameFieldCandidate ? 'A_NAME_THEN_SAVE_BUTTON' : 'UNKNOWN_NO_VISIBLE_TEXT_INPUT';
  log('SAVE-02-WORKFLOW_IDENTIFIED', nameFieldCandidate ? 'PASS' : 'FAIL', result.SAVED_DEAL_WORKFLOW_TYPE);

  if (nameFieldCandidate) {
    // First set a distinctive value on the actual study input (must close panel? inspect if panel blocks main inputs)
    await page5.locator('input[type="text"], input[inputmode="decimal"]').first().fill('444444').catch(()=>{});
    // Re-open panel if it closed, then fill name using the discovered input index
    await page5.getByTitle('الصفقات المحفوظة').click().catch(()=>{});
    await page5.waitForTimeout(200);
    const allTextInputs = page5.locator('input[type="text"]');
    const nameInput = allTextInputs.nth(nameFieldCandidate.idx > 0 ? await allTextInputs.count() - 1 : 0);
    // Fallback: use the visible input inside the deals panel specifically (last one is usually the name field per original source structure)
    const panelNameInput = page5.locator('input[type="text"]').last();
    await panelNameInput.fill('E2E Saved Deal');
    const saveBtn = page5.getByText('حفظ', { exact: true });
    let saveClicked = false;
    try { await saveBtn.click({ timeout: 2500 }); saveClicked = true; } catch (e) { console.log('SAVE_CLICK_FAILED: ' + e.message.slice(0,150)); }
    await page5.waitForTimeout(600);
    const bodyAfterSave = await page5.locator('body').innerText();
    const visible = bodyAfterSave.includes('E2E Saved Deal');
    result.SAVED_DEAL_CREATED_VIA_UI = saveClicked;
    result.SAVED_DEAL_VISIBLE_AFTER_SAVE = visible;
    log('SAVE-03-CREATED', visible ? 'PASS' : 'FAIL', `saveClicked=${saveClicked} visible=${visible}`);

    // Check localStorage as supporting evidence
    const storageKeys = await page5.evaluate(() => Object.keys(window.localStorage || {}));
    result.SAVED_DEAL_PERSISTED_IN_BROWSER_STORAGE = storageKeys.length > 0;
    console.log('LOCALSTORAGE_KEYS=' + JSON.stringify(storageKeys));

    if (visible) {
      await page5.reload({ waitUntil: 'domcontentloaded' });
      await page5.waitForTimeout(400);
      await page5.getByTitle('الصفقات المحفوظة').click();
      await page5.waitForTimeout(300);
      const bodyReload = await page5.locator('body').innerText();
      const survives = bodyReload.includes('E2E Saved Deal');
      result.SAVED_DEAL_SURVIVES_RELOAD = survives;
      log('SAVE-04-RELOAD', survives ? 'PASS' : 'FAIL', '');

      if (survives) {
        await page5.getByText('E2E Saved Deal').click();
        await page5.waitForTimeout(400);
        const restored = await page5.locator('input[type="text"], input[inputmode="decimal"]').first().inputValue();
        const modeRestored = (await page5.locator('body').innerText()).includes('مبنى قائم');
        result.SAVED_DEAL_INPUT_RESTORED = restored === '444444';
        result.SAVED_DEAL_MODE_RESTORED = modeRestored;
        log('SAVE-05-RESTORE', (result.SAVED_DEAL_INPUT_RESTORED) ? 'PASS' : 'FAIL', `restored=${restored}`);
      } else { log('SAVE-05-RESTORE', 'SKIPPED', ''); }
    } else {
      log('SAVE-04-RELOAD', 'SKIPPED', '');
      log('SAVE-05-RESTORE', 'SKIPPED', '');
    }
  }
  result.SAVED_DEALS_RUNTIME_FLOW = (result.SAVED_DEAL_INPUT_RESTORED === true) ? 'PASS' : 'FAIL';
  await page5.close();
  await context5.close();

  fs.writeFileSync(`${EVIDENCE_DIR}/diagnose-04-05-result.json`, JSON.stringify(result, null, 2));

} catch (e) {
  console.log('FATAL: ' + e.message + '\n' + e.stack?.split('\n').slice(0,3).join('\n'));
} finally {
  if (browser) { await browser.close(); console.log('BROWSER_CLOSED'); }
  if (previewServer) { await new Promise((r) => previewServer.httpServer.close(() => r())); console.log('PREVIEW_SERVER_CLOSED'); }
  console.log('DONE');
}
