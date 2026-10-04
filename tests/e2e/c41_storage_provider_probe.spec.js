'use strict';

const { test } = require('@playwright/test');

test('C41 storage provider lifecycle diagnostics', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const providerShape = await page.evaluate(() => {
    const s = window.storage;
    const shape = {
      exists: s !== undefined && s !== null,
      type: typeof s,
      constructor: s && s.constructor ? s.constructor.name : null,
      getType: s ? typeof s.get : null,
      setType: s ? typeof s.set : null,
      deleteType: s ? typeof s.delete : null,
      getLength: s && typeof s.get === 'function' ? s.get.length : null,
      setLength: s && typeof s.set === 'function' ? s.set.length : null,
      deleteLength: s && typeof s.delete === 'function' ? s.delete.length : null,
      localStorageAvailable: false,
    };
    try {
      const k = '__c41_probe__';
      window.localStorage.setItem(k, '1');
      shape.localStorageAvailable = window.localStorage.getItem(k) === '1';
      window.localStorage.removeItem(k);
    } catch (_) {}
    return shape;
  });
  console.log('C41_STORAGE_PROVIDER_SHAPE=' + JSON.stringify(providerShape));

  const modeButtons = page.locator('header div.inline-flex.p-1.rounded-xl > button');
  await modeButtons.nth(1).click();
  await page.waitForTimeout(100);

  const input = page.locator('aside input[inputmode="decimal"]:visible').first();
  await input.fill('31');
  await input.press('Tab');

  await page.locator('button:has(svg.lucide-bookmark)').first().click();
  await page.waitForTimeout(100);
  console.log('C41_STORAGE_PANEL_BEFORE=' + JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 1000)));

  const name = `C41-PROBE-${Date.now()}`;
  const nameInput = page.locator('input[placeholder="اسم الصفقة..."], input[placeholder="Deal name..."]').first();
  await nameInput.fill(name);
  const panel = nameInput.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await panel.getByRole('button', { name: /^(حفظ|Save)$/ }).first().click();
  await page.waitForTimeout(500);

  const storageAfterSave = await page.evaluate((dealName) => {
    const ns = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';
    const rawIndex = window.localStorage.getItem(ns + 'deals-index');
    const index = rawIndex ? JSON.parse(rawIndex) : [];
    const entry = Array.isArray(index) ? index.find((item) => item && item.name === dealName) : null;
    return {
      rawIndex,
      entry,
      keys: Object.keys(window.localStorage).filter((k) => k.startsWith(ns)),
    };
  }, name);
  console.log('C41_STORAGE_AFTER_SAVE=' + JSON.stringify(storageAfterSave));
  console.log('C41_STORAGE_PANEL_AFTER=' + JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 1500)));

  await page.reload({ waitUntil: 'networkidle' });
  const providerShapeAfterReload = await page.evaluate(() => {
    const s = window.storage;
    return {
      exists: s !== undefined && s !== null,
      type: typeof s,
      constructor: s && s.constructor ? s.constructor.name : null,
      getType: s ? typeof s.get : null,
      setType: s ? typeof s.set : null,
      deleteType: s ? typeof s.delete : null,
      getLength: s && typeof s.get === 'function' ? s.get.length : null,
      setLength: s && typeof s.set === 'function' ? s.set.length : null,
      deleteLength: s && typeof s.delete === 'function' ? s.delete.length : null,
    };
  });
  console.log('C41_STORAGE_PROVIDER_SHAPE_AFTER_RELOAD=' + JSON.stringify(providerShapeAfterReload));
  await page.locator('button:has(svg.lucide-bookmark)').first().click();
  await page.waitForTimeout(500);
  console.log('C41_STORAGE_PANEL_RELOAD=' + JSON.stringify((await page.locator('[role="dialog"]').innerText()).slice(0, 1500)));

  console.log('C41_STORAGE_PROVIDER_PROBE=PASS');
});
