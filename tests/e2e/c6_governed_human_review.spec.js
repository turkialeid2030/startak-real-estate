'use strict';

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { buildC6SavedDeal } = require('../fixtures/c6-governed-saved-deal');

const NAMESPACE = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';

function attachBrowserDiagnostics(page) {
  page.on('pageerror', (error) => {
    console.log('C6_PAGE_ERROR', error?.stack || error?.message || String(error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('C6_BROWSER_CONSOLE_ERROR', message.text());
  });
}

async function preloadDeal(page, record) {
  const index = [{ id: record.id, name: record.name, mode: record.mode, savedAt: record.savedAt }];
  await page.addInitScript(({ namespace, deal, dealIndex }) => {
    const dealKey = `${namespace}deal:${deal.id}`;
    const indexKey = `${namespace}deals-index`;
    // addInitScript runs on every navigation/reload. Seed only when absent so
    // the E2E fixture cannot overwrite a review that the application itself
    // persisted during the test. This preserves real browser durability.
    if (window.localStorage.getItem(dealKey) === null) {
      window.localStorage.setItem(dealKey, JSON.stringify(deal));
    }
    if (window.localStorage.getItem(indexKey) === null) {
      window.localStorage.setItem(indexKey, JSON.stringify(dealIndex));
    }
  }, { namespace: NAMESPACE, deal: record, dealIndex: index });
}

async function dumpBrowserSurface(page, reason) {
  console.log('C6_DIAGNOSTIC_REASON', reason);
  console.log('C6_URL', page.url());
  try {
    console.log('C6_BODY_TEXT', (await page.locator('body').innerText()).slice(0, 5000));
  } catch (error) {
    console.log('C6_BODY_TEXT_ERROR', error?.message || String(error));
  }
  try {
    console.log('C6_BUTTON_COUNT', await page.locator('button').count());
    console.log('C6_BUTTON_TITLES', JSON.stringify(await page.locator('button').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title')))));
    console.log('C6_BUTTON_TEXTS', JSON.stringify(await page.locator('button').allTextContents()));
  } catch (error) {
    console.log('C6_BUTTON_DIAGNOSTIC_ERROR', error?.message || String(error));
  }
  try {
    console.log('C6_STORAGE_KEYS', JSON.stringify(await page.evaluate(() => Object.keys(window.localStorage))));
  } catch (error) {
    console.log('C6_STORAGE_DIAGNOSTIC_ERROR', error?.message || String(error));
  }
  try {
    console.log('C6_HTML', (await page.content()).slice(0, 8000));
  } catch (error) {
    console.log('C6_HTML_ERROR', error?.message || String(error));
  }
}

async function loadSavedDeal(page) {
  const savedDealsButton = page.locator('button:has(svg.lucide-bookmark)').first();
  if (await savedDealsButton.count() === 0) {
    await dumpBrowserSurface(page, 'SAVED_DEALS_BUTTON_NOT_FOUND');
  }
  await expect(savedDealsButton).toBeVisible();
  await savedDealsButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const savedBuildingDealButton = dialog.locator('button:has(svg.lucide-building-2)').nth(1);
  if (await dialog.locator('button:has(svg.lucide-building-2)').count() < 2) {
    await dumpBrowserSurface(page, 'PRELOADED_SAVED_DEAL_NOT_RENDERED');
  }
  await expect(savedBuildingDealButton).toBeVisible();
  await savedBuildingDealButton.click();
}

async function persistedRecord(page, id) {
  return page.evaluate(({ namespace, dealId }) => {
    const raw = window.localStorage.getItem(`${namespace}deal:${dealId}`);
    return raw ? JSON.parse(raw) : null;
  }, { namespace: NAMESPACE, dealId: id });
}

async function persistedIndex(page) {
  return page.evaluate((namespace) => {
    const raw = window.localStorage.getItem(`${namespace}deals-index`);
    return raw ? JSON.parse(raw) : null;
  }, NAMESPACE);
}

test('records, reloads and exports a non-authorizing governed human review', async ({ page }) => {
  attachBrowserDiagnostics(page);
  const record = buildC6SavedDeal({ now: new Date() });
  await preloadDeal(page, record);
  await page.goto('/');
  expect(await persistedRecord(page, record.id)).toBeTruthy();
  expect(await persistedIndex(page)).toEqual(expect.arrayContaining([expect.objectContaining({ id: record.id })]));
  await loadSavedDeal(page);

  await expect(page.getByTestId('governed-decision-operations')).toBeVisible();
  await expect(page.getByTestId('c6-human-review-workflow')).toBeVisible();
  // The strict Arabic presentation layer intentionally translates domain
  // status codes. Browser E2E validates the rendered customer surface; exact
  // internal status/reason codes remain covered by the Node C6 regression.
  await expect(page.getByTestId('c6-review-status')).toHaveText('جاهز للمراجعة البشرية');
  await expect(page.getByTestId('c6-reviewed-export')).toBeDisabled();

  await page.getByTestId('c6-reviewer-id').fill('browser-reviewer-c6');
  await page.getByTestId('c6-review-recommendation').selectOption('HOLD_FOR_EVIDENCE');
  await page.getByTestId('c6-review-rationale').fill('استكمال الشواهد قبل أي مسار موافقة مستقل. هذه توصية غير مخولة بالتنفيذ.');
  await page.getByTestId('c6-record-review').click();

  await expect(page.getByText('browser-reviewer-c6')).toBeVisible();
  await expect(page.getByTestId('c6-reviewed-export')).toBeEnabled();
  await expect(page.getByTestId('c6-review-message')).toContainText('لا تمثل موافقة');

  const stored = await persistedRecord(page, record.id);
  expect(stored).toBeTruthy();
  expect(stored.governedHumanReview).toBeTruthy();
  expect(stored.governedHumanReview.reviewerId).toBe('browser-reviewer-c6');
  expect(stored.governedHumanReview.recommendation).toBe('HOLD_FOR_EVIDENCE');
  expect(stored.governedHumanReview.approvalStatus).toBe('NOT_ESTABLISHED');
  expect(stored.governedHumanReview.transactionAuthorized).toBe(false);
  expect(stored.governedHumanReview.approvalAuthorized).toBe(false);
  expect(stored.governedHumanReview.publicAiAuthorized).toBe(false);
  expect(stored.governedHumanReview.commercialGoLive).toBe('HOLD');
  expect(stored.governedHumanReview.authorityBoundary.transactionAuthority).toBe(false);
  expect(stored.governedHumanReview.authorityBoundary.publicAi).toBe(false);
  expect(stored.governedHumanReview.authorityBoundary.canonicalBaselineActivationAuthorized).toBe(false);
  expect(stored.governedHumanReview.reviewHashSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(stored.governedHumanReview.decisionSnapshotHashSha256).toBe(stored.governedDealDecision.snapshotHashSha256);

  await page.reload();
  // Prove browser persistence survived the reload before relying on UI
  // hydration. This prevents the fixture itself from masking a durability bug.
  const reloadedStored = await persistedRecord(page, record.id);
  expect(reloadedStored?.governedHumanReview?.reviewerId).toBe('browser-reviewer-c6');
  expect(reloadedStored?.governedHumanReview?.reviewHashSha256).toBe(stored.governedHumanReview.reviewHashSha256);
  await loadSavedDeal(page);
  await expect(page.getByText('browser-reviewer-c6')).toBeVisible();
  await expect(page.getByTestId('c6-reviewed-export')).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('c6-reviewed-export').click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const envelope = JSON.parse(fs.readFileSync(downloadedPath, 'utf8'));
  expect(envelope.schemaVersion).toBe('C6_GOVERNED_REVIEW_EXPORT_V1');
  expect(envelope.classification).toBe('NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  expect(envelope.review.recommendation).toBe('HOLD_FOR_EVIDENCE');
  expect(envelope.approvalStatus).toBe('NOT_ESTABLISHED');
  expect(envelope.transactionAuthorized).toBe(false);
  expect(envelope.approvalAuthorized).toBe(false);
  expect(envelope.publicAiAuthorized).toBe(false);
  expect(envelope.commercialGoLive).toBe('HOLD');
  expect(envelope.finalValuationConclusionEstablished).toBe(false);
  expect(envelope.certifiedValuationEstablished).toBe(false);
  expect(envelope.c5Export.classification).toBe('NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  expect(envelope.c5Export.transactionAuthorized).toBe(false);
  expect(envelope.reviewHashSha256).toBe(envelope.review.reviewHashSha256);
  expect(envelope.decisionSnapshotHashSha256).toBe(envelope.review.decisionSnapshotHashSha256);
  expect(envelope.savedDealStateHashSha256).toBe(envelope.review.savedDealStateHashSha256);
  expect(envelope.exportHashSha256).toMatch(/^[a-f0-9]{64}$/);
});

test('holds stale governed context and disables review/export in Chromium', async ({ page }) => {
  attachBrowserDiagnostics(page);
  const staleBase = new Date(Date.now() - (72 * 60 * 60 * 1000));
  const record = buildC6SavedDeal({ now: staleBase, id: 'DEAL-C6-STALE' });
  record.name = 'C6 stale governed browser deal';
  await preloadDeal(page, record);
  await page.goto('/');
  expect(await persistedRecord(page, record.id)).toBeTruthy();
  expect(await persistedIndex(page)).toEqual(expect.arrayContaining([expect.objectContaining({ id: record.id })]));
  await loadSavedDeal(page);

  const c5Panel = page.getByTestId('governed-decision-operations');
  await expect(c5Panel).toBeVisible();
  // Exact internal reason `C5_RECONCILIATION_STALE_NOW` is asserted in the
  // C5/C6 defect regressions. The browser surface is Arabic and must prove the
  // fail-closed behavior rather than expose an untranslated internal code.
  await expect(c5Panel.getByRole('button').last()).toBeDisabled();
  await expect(page.getByTestId('c6-review-status')).toHaveText('معلّق');
  await expect(page.getByTestId('c6-review-hold-reasons')).toBeVisible();
  await expect(page.getByTestId('c6-reviewer-id')).toBeDisabled();
  await expect(page.getByTestId('c6-record-review')).toBeDisabled();
  await expect(page.getByTestId('c6-reviewed-export')).toBeDisabled();
});
