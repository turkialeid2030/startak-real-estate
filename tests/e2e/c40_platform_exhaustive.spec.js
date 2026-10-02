'use strict';

const { test, expect } = require('@playwright/test');

function captureDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error?.stack || error?.message || String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function visibleLocators(locator) {
  const result = [];
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible()) result.push(item);
  }
  return result;
}

test('C40 production UI structural, accessibility and safe-interaction audit', async ({ page }) => {
  const diagnostics = captureDiagnostics(page);
  await page.addInitScript(() => window.localStorage.setItem('startak.presentation.locale', 'ar'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const body = page.locator('body');
  await expect(body).toBeVisible();
  const bodyText = await body.innerText();
  expect(bodyText).not.toMatch(/\bNaN\b/);
  expect(bodyText).not.toMatch(/\bInfinity\b/);
  expect(bodyText).not.toContain('[object Object]');
  expect(bodyText).not.toMatch(/\bundefined\b/);

  const inputs = await visibleLocators(page.locator('input, select, textarea'));
  const buttons = await visibleLocators(page.locator('button, [role="button"], [role="tab"]'));
  const links = await visibleLocators(page.locator('a[href]'));
  const svgs = await visibleLocators(page.locator('svg'));

  expect(inputs.length).toBeGreaterThan(10);
  expect(buttons.length).toBeGreaterThan(2);

  const unlabeledControls = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const control = inputs[index];
    const descriptor = await control.evaluate((element) => {
      const explicit = element.getAttribute('aria-label') || element.getAttribute('title') || '';
      const labelledBy = element.getAttribute('aria-labelledby');
      let labelledText = '';
      if (labelledBy) {
        labelledText = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      }
      const wrapping = element.closest('label')?.textContent?.trim() || '';
      const id = element.getAttribute('id');
      const external = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() || '' : '';
      return { type: element.getAttribute('type') || element.tagName.toLowerCase(), name: explicit || labelledText || wrapping || external };
    });
    if (!descriptor.name && descriptor.type !== 'hidden') unlabeledControls.push({ index, ...descriptor });
  }
  expect(unlabeledControls, `Unlabeled visible form controls: ${JSON.stringify(unlabeledControls)}`).toEqual([]);

  const unnamedButtons = [];
  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    const descriptor = await button.evaluate((element) => ({
      text: element.textContent?.trim() || '',
      aria: element.getAttribute('aria-label') || '',
      title: element.getAttribute('title') || '',
    }));
    if (!(descriptor.text || descriptor.aria || descriptor.title)) unnamedButtons.push({ index, ...descriptor });
  }
  expect(unnamedButtons, `Unnamed visible buttons: ${JSON.stringify(unnamedButtons)}`).toEqual([]);

  // Exercise editable scalar fields without changing economic meaning: focus,
  // select and re-enter their current value. This verifies event wiring while
  // preserving the seeded case and avoids manufacturing a release decision.
  let exercisedInputs = 0;
  for (const input of inputs) {
    const tag = await input.evaluate((element) => element.tagName.toLowerCase());
    const type = (await input.getAttribute('type')) || '';
    const disabled = await input.isDisabled();
    if (disabled || tag !== 'input' || ['file', 'checkbox', 'radio', 'button', 'submit'].includes(type)) continue;
    const current = await input.inputValue();
    if (current === '') continue;
    await input.focus();
    await input.fill(current);
    await input.press('Tab');
    exercisedInputs += 1;
    if (exercisedInputs >= 40) break;
  }
  expect(exercisedInputs).toBeGreaterThan(5);

  // Safe navigation/accordion actions only. Mutating actions such as save,
  // delete, import/export, approval and execution remain outside this generic
  // traversal and have dedicated governed tests elsewhere in the suite.
  const unsafeAction = /حذف|مسح|حفظ|استعادة|استيراد|تصدير|اعتماد|تنفيذ|delete|remove|save|restore|import|export|approve|execute|record/i;
  let exercisedButtons = 0;
  for (const button of buttons) {
    if (await button.isDisabled()) continue;
    const label = `${await button.innerText().catch(() => '')} ${await button.getAttribute('aria-label') || ''} ${await button.getAttribute('title') || ''}`.trim();
    if (!label || unsafeAction.test(label)) continue;
    await button.click();
    await page.waitForTimeout(30);
    const after = await body.innerText();
    expect(after).not.toMatch(/\bNaN\b|\bInfinity\b|\[object Object\]|\bundefined\b/);
    exercisedButtons += 1;
    if (exercisedButtons >= 20) break;
  }

  // Every visible SVG icon must either be decorative or live inside a named
  // interactive control. This catches icon-only controls with no accessible name.
  const problematicIcons = [];
  for (let index = 0; index < svgs.length; index += 1) {
    const svg = svgs[index];
    const state = await svg.evaluate((element) => {
      if (element.getAttribute('aria-hidden') === 'true') return { ok: true };
      const control = element.closest('button, [role="button"], [role="tab"], a[href]');
      if (!control) return { ok: true }; // presentational chart/iconography
      const name = control.textContent?.trim() || control.getAttribute('aria-label') || control.getAttribute('title') || '';
      return { ok: Boolean(name), name };
    });
    if (!state.ok) problematicIcons.push(index);
  }
  expect(problematicIcons, `Icon-only controls without names at SVG indexes ${problematicIcons.join(', ')}`).toEqual([]);

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);

  console.log(`C40_UI_VISIBLE_FORM_CONTROLS=${inputs.length}`);
  console.log(`C40_UI_VISIBLE_BUTTONS_TABS=${buttons.length}`);
  console.log(`C40_UI_VISIBLE_LINKS=${links.length}`);
  console.log(`C40_UI_VISIBLE_SVGS=${svgs.length}`);
  console.log(`C40_UI_EXERCISED_INPUTS=${exercisedInputs}`);
  console.log(`C40_UI_EXERCISED_SAFE_BUTTONS=${exercisedButtons}`);
  console.log('C40_UI_RUNTIME_CORRUPTION_SCAN=PASS');
  console.log('C40_UI_ACCESSIBILITY_NAME_AUDIT=PASS');
});
