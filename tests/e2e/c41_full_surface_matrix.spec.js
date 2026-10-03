'use strict';

const { test, expect } = require('@playwright/test');

test.setTimeout(90_000);

function captureDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error?.stack || error?.message || String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function boot(page, { locale, viewport }) {
  await page.setViewportSize(viewport);
  await page.addInitScript((requestedLocale) => {
    window.localStorage.clear();
    window.localStorage.setItem('startak.presentation.locale', requestedLocale);
  }, locale);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rf-root')).toBeVisible();
}

async function assertRuntimeClean(page, label) {
  const text = await page.locator('body').innerText();
  expect(text, `${label}: NaN leaked to rendered UI`).not.toMatch(/\bNaN\b/);
  expect(text, `${label}: Infinity leaked to rendered UI`).not.toMatch(/\bInfinity\b/);
  expect(text, `${label}: object string leaked to rendered UI`).not.toContain('[object Object]');
  expect(text, `${label}: undefined leaked to rendered UI`).not.toMatch(/\bundefined\b/);
}

async function expandAllPrimaryInputSections(page) {
  const bodies = page.locator('aside .rf-accordion-body');
  const count = await bodies.count();
  for (let index = 0; index < count; index += 1) {
    const body = bodies.nth(index);
    const className = await body.getAttribute('class');
    if (!String(className).split(/\s+/).includes('open')) {
      const button = body.locator('xpath=preceding-sibling::button[1]');
      await button.click();
      await page.waitForTimeout(275);
    }
  }
  return count;
}

async function exercisePrimaryFormWiring(page, label) {
  const scope = page.locator('aside');
  const controls = scope.locator('input:visible, select:visible, textarea:visible');
  const count = await controls.count();
  let scalarEdits = 0;
  let selectCycles = 0;

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (await control.isDisabled()) continue;
    const tag = await control.evaluate((element) => element.tagName.toLowerCase());
    if (tag === 'select') {
      const current = await control.inputValue();
      const options = await control.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value));
      const alternate = options.find((value) => value !== current);
      if (alternate !== undefined) {
        await control.selectOption(alternate);
        await page.waitForTimeout(20);
        await control.selectOption(current);
        selectCycles += 1;
      }
      continue;
    }

    const type = (await control.getAttribute('type')) || '';
    if (['hidden', 'file', 'checkbox', 'radio', 'button', 'submit'].includes(type)) continue;
    const current = await control.inputValue();
    if (current === '') continue;
    await control.focus();
    await control.fill(current);
    await control.press('Tab');
    scalarEdits += 1;
  }

  const switches = scope.locator('button[role="switch"]:visible');
  const switchCount = await switches.count();
  let switchCycles = 0;
  for (let index = 0; index < switchCount; index += 1) {
    const button = switches.nth(index);
    if (await button.isDisabled()) continue;
    const before = await button.getAttribute('aria-checked');
    await button.click();
    await page.waitForTimeout(30);
    const changed = await button.getAttribute('aria-checked');
    expect(changed, `${label}: switch ${index} did not change`).not.toBe(before);
    await button.click();
    await page.waitForTimeout(30);
    expect(await button.getAttribute('aria-checked'), `${label}: switch ${index} did not restore`).toBe(before);
    switchCycles += 1;
  }

  expect(count, `${label}: no primary controls found`).toBeGreaterThan(10);
  expect(scalarEdits, `${label}: too few scalar controls exercised`).toBeGreaterThan(5);
  expect(selectCycles, `${label}: select controls were not exercised`).toBeGreaterThan(0);
  expect(switchCycles, `${label}: switch controls were not exercised`).toBeGreaterThan(0);
  await assertRuntimeClean(page, `${label}: after primary form exercise`);

  return { count, scalarEdits, selectCycles, switchCycles };
}

async function auditAccessibleNames(page, label) {
  const unlabeledControls = await page.locator('input:visible, select:visible, textarea:visible').evaluateAll((elements) => {
    const failures = [];
    elements.forEach((element, index) => {
      if (element.type === 'hidden') return;
      const explicit = element.getAttribute('aria-label') || element.getAttribute('title') || '';
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelled = labelledBy
        ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim()
        : '';
      const wrapping = element.closest('label')?.textContent?.trim() || '';
      const id = element.getAttribute('id');
      const external = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() || '' : '';
      const placeholder = element.getAttribute('placeholder') || '';
      if (!(explicit || labelled || wrapping || external || placeholder)) failures.push(index);
    });
    return failures;
  });
  expect(unlabeledControls, `${label}: unlabeled visible form controls ${unlabeledControls.join(',')}`).toEqual([]);

  const unnamedButtons = await page.locator('button:visible, [role="button"]:visible, [role="tab"]:visible').evaluateAll((elements) => {
    const failures = [];
    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      const aria = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || '';
      const title = element.getAttribute('title') || '';
      if (!(text || aria || title)) failures.push(index);
    });
    return failures;
  });
  expect(unnamedButtons, `${label}: unnamed visible buttons ${unnamedButtons.join(',')}`).toEqual([]);

  const unnamedLinks = await page.locator('a[href]:visible').evaluateAll((elements) => {
    const failures = [];
    elements.forEach((element, index) => {
      const text = element.textContent?.trim() || '';
      const aria = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || '';
      const title = element.getAttribute('title') || '';
      if (!(text || aria || title)) failures.push(index);
    });
    return failures;
  });
  expect(unnamedLinks, `${label}: unnamed visible links ${unnamedLinks.join(',')}`).toEqual([]);

  const iconAudit = await page.locator('svg').evaluateAll((elements) => {
    const failures = [];
    let visible = 0;
    elements.forEach((element, index) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible = style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0
        && rect.width > 0
        && rect.height > 0;
      if (!isVisible) return;
      visible += 1;
      if (element.getAttribute('aria-hidden') === 'true') return;
      const control = element.closest('button, [role="button"], [role="tab"], a[href]');
      if (!control) return;
      const name = control.textContent?.trim()
        || control.getAttribute('aria-label')
        || control.getAttribute('aria-labelledby')
        || control.getAttribute('title')
        || '';
      if (!name) failures.push(index);
    });
    return { failures, visible };
  });
  expect(iconAudit.failures, `${label}: icon-only interactive controls without name ${iconAudit.failures.join(',')}`).toEqual([]);
  return iconAudit.visible;
}

async function selectMode(page, modeIndex) {
  const modeButtons = page.locator('header div.inline-flex.p-1.rounded-xl > button');
  await expect(modeButtons).toHaveCount(2);
  await modeButtons.nth(modeIndex).click();
  await page.waitForTimeout(80);
}

async function traverseTabs(page, label) {
  const tabs = page.locator('main > div.flex.gap-1.mb-4.p-1.rounded-xl > button');
  await expect(tabs).toHaveCount(3);
  const snapshots = [];
  for (let index = 0; index < 3; index += 1) {
    await tabs.nth(index).click();
    await page.waitForTimeout(50);
    await assertRuntimeClean(page, `${label}: tab ${index}`);
    const text = await page.locator('main').innerText();
    expect(text.length, `${label}: tab ${index} rendered too little content`).toBeGreaterThan(100);
    snapshots.push(text);
  }
  expect(new Set(snapshots).size, `${label}: tab content did not change across all tabs`).toBeGreaterThan(1);
  return snapshots.length;
}

const surfaces = [
  { name: 'desktop-ar', locale: 'ar-SA', viewport: { width: 1440, height: 1200 }, expectedDir: 'rtl' },
  { name: 'desktop-en', locale: 'en', viewport: { width: 1440, height: 1200 }, expectedDir: 'ltr' },
  { name: 'mobile-ar', locale: 'ar-SA', viewport: { width: 390, height: 844 }, expectedDir: 'rtl' },
  { name: 'mobile-en', locale: 'en', viewport: { width: 390, height: 844 }, expectedDir: 'ltr' },
];

for (const surface of surfaces) {
  test(`C41 full surface traversal ${surface.name}`, async ({ page }) => {
    const diagnostics = captureDiagnostics(page);
    await boot(page, surface);
    await expect(page.locator('.rf-root')).toHaveAttribute('dir', surface.expectedDir);

    let totalAccordionSections = 0;
    let totalTabs = 0;
    let totalVisibleIcons = 0;
    let totalScalarEdits = 0;
    let totalSelectCycles = 0;
    let totalSwitchCycles = 0;

    for (let modeIndex = 0; modeIndex < 2; modeIndex += 1) {
      await selectMode(page, modeIndex);
      const modeLabel = `${surface.name}:mode-${modeIndex}`;
      totalAccordionSections += await expandAllPrimaryInputSections(page);
      const exercised = await exercisePrimaryFormWiring(page, modeLabel);
      totalScalarEdits += exercised.scalarEdits;
      totalSelectCycles += exercised.selectCycles;
      totalSwitchCycles += exercised.switchCycles;
      totalTabs += await traverseTabs(page, modeLabel);
      totalVisibleIcons += await auditAccessibleNames(page, modeLabel);
    }

    expect(totalAccordionSections).toBeGreaterThanOrEqual(16);
    expect(totalTabs).toBe(6);
    expect(totalScalarEdits).toBeGreaterThan(20);
    expect(totalSelectCycles).toBeGreaterThan(2);
    expect(totalSwitchCycles).toBeGreaterThan(5);
    expect(totalVisibleIcons).toBeGreaterThan(20);
    expect(diagnostics.pageErrors, `${surface.name}: page errors`).toEqual([]);
    expect(diagnostics.consoleErrors, `${surface.name}: console errors`).toEqual([]);

    console.log(`C41_SURFACE_${surface.name.toUpperCase().replace(/-/g, '_')}=PASS`);
    console.log(`C41_${surface.name}_ACCORDIONS=${totalAccordionSections}`);
    console.log(`C41_${surface.name}_TABS=${totalTabs}`);
    console.log(`C41_${surface.name}_SCALAR_EDITS=${totalScalarEdits}`);
    console.log(`C41_${surface.name}_SELECT_CYCLES=${totalSelectCycles}`);
    console.log(`C41_${surface.name}_SWITCH_CYCLES=${totalSwitchCycles}`);
    console.log(`C41_${surface.name}_VISIBLE_ICONS_AUDITED=${totalVisibleIcons}`);
  });
}

test('C41 saved-deal persistence, reset, delete and locale-toggle lifecycle', async ({ page }) => {
  const diagnostics = captureDiagnostics(page);
  await boot(page, { locale: 'ar-SA', viewport: { width: 1440, height: 1200 } });

  const firstScalar = page.locator('aside input[inputmode="decimal"]:visible').first();
  const original = await firstScalar.inputValue();
  const distinct = original === '77' ? '78' : '77';
  await firstScalar.fill(distinct);
  await firstScalar.press('Tab');
  await page.waitForTimeout(100);
  expect(await firstScalar.inputValue()).toBe(distinct);

  const savedDealsButton = page.locator('button:has(svg.lucide-bookmark)').first();
  await savedDealsButton.click();
  await page.waitForTimeout(100);
  const dealName = `C41-E2E-${Date.now()}`;
  const nameInput = page.locator('input[placeholder="اسم الصفقة..."], input[placeholder="Deal name..."]').first();
  await expect(nameInput).toBeVisible();
  await nameInput.fill(dealName);
  const panel = nameInput.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  const saveButton = panel.getByRole('button', { name: /^(حفظ|Save)$/ }).first();
  await saveButton.click();
  await page.waitForTimeout(250);

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button:has(svg.lucide-bookmark)').first().click();
  await page.waitForTimeout(100);
  await expect(page.getByText(dealName, { exact: true })).toBeVisible();
  await page.getByText(dealName, { exact: true }).click();
  await page.waitForTimeout(150);
  expect(await page.locator('aside input[inputmode="decimal"]:visible').first().inputValue()).toBe(distinct);

  const resetButton = page.locator('button:has(svg.lucide-rotate-ccw)').first();
  await resetButton.click();
  await page.waitForTimeout(150);
  expect(await page.locator('aside input[inputmode="decimal"]:visible').first().inputValue()).toBe(distinct);

  await page.locator('button:has(svg.lucide-bookmark)').first().click();
  await page.waitForTimeout(100);
  const dealRow = page.getByText(dealName, { exact: true }).locator('xpath=ancestor::*[.//button//*[contains(@class,"lucide-trash-2")]][1]');
  const deleteButton = dealRow.locator('button:has(svg.lucide-trash-2)').first();
  await deleteButton.click();
  await page.waitForTimeout(150);
  await expect(page.getByText(dealName, { exact: true })).toHaveCount(0);

  const closeCandidate = page.locator('button:has(svg.lucide-x)').filter({ visible: true }).first();
  if (await closeCandidate.count()) await closeCandidate.click().catch(() => {});

  const localeButton = page.locator('header button').filter({ hasText: /^(EN|ع)$/ }).first();
  await localeButton.click();
  await page.waitForTimeout(100);
  await expect(page.locator('.rf-root')).toHaveAttribute('dir', 'ltr');
  await localeButton.click();
  await page.waitForTimeout(100);
  await expect(page.locator('.rf-root')).toHaveAttribute('dir', 'rtl');

  await assertRuntimeClean(page, 'C41 lifecycle');
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
  console.log('C41_SAVED_DEAL_LIFECYCLE=PASS');
  console.log('C41_RESET_ACTIVE_DEAL_RELOAD=PASS');
  console.log('C41_DELETE_DEAL=PASS');
  console.log('C41_LOCALE_TOGGLE=PASS');
});
