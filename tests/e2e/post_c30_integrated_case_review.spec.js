'use strict';

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { buildPostC30IntegratedReviewBundles } = require('../fixtures/post-c30-integrated-review-bundles');

function captureUnexpectedBrowserErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error?.stack || error?.message || String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function openEnglishProduct(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('startak.presentation.locale', 'en');
  });
  await page.goto('/');
  await expect(page.getByTestId('integrated-case-review-panel')).toBeVisible();
}

async function loadBundle(page, name, bundle) {
  const file = {
    name: `${name}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle), 'utf8'),
  };
  await page.getByTestId('integrated-review-file-input').setInputFiles(file);
}

async function expectUntrusted(page, blocker) {
  const untrusted = page.getByTestId('integrated-review-untrusted');
  await expect(untrusted).toBeVisible();
  await expect(page.getByTestId('integrated-review-trusted')).toHaveCount(0);
  await expect(untrusted).toContainText(blocker);
}

test('reviewer flow preserves HOLD, restricts dispositions, shows grounded AI and exports non-authorizing draft', async ({ page }) => {
  const diagnostics = captureUnexpectedBrowserErrors(page);
  const bundles = await buildPostC30IntegratedReviewBundles();
  await openEnglishProduct(page);

  await loadBundle(page, 'reviewer-valid', bundles.reviewer);
  await expect(page.getByTestId('integrated-review-trusted')).toBeVisible();
  await expect(page.getByText('Hold', { exact: true })).toBeVisible();
  await expect(page.getByText('Grounded browser draft. Human review is still required.', { exact: true })).toBeVisible();
  await expect(page.getByText('DRAFT / HUMAN REVIEW REQUIRED', { exact: true })).toBeVisible();

  const disposition = page.getByTestId('integrated-review-disposition');
  const values = await disposition.locator('option').evaluateAll((options) => options.map((option) => option.value));
  expect(values).toEqual(['', 'ACKNOWLEDGED', 'RETURN_FOR_EVIDENCE', 'REJECT_DRAFT']);
  expect(values).not.toContain('APPROVE');
  expect(values).not.toContain('GO_LIVE');
  expect(values).not.toContain('TRANSACT');

  await disposition.selectOption('RETURN_FOR_EVIDENCE');
  await page.getByTestId('integrated-review-note').fill('Source-rights evidence remains required before any separate approval path.');
  await page.getByTestId('integrated-review-record').click();

  const recorded = page.getByTestId('integrated-review-recorded');
  await expect(recorded).toBeVisible();
  await expect(recorded).toContainText('Hold / Hold');
  await expect(page.getByText('Approval: not established', { exact: true })).toBeVisible();
  await expect(page.getByText('Transaction authority: false', { exact: true })).toBeVisible();
  await expect(page.getByText('Public AI: false', { exact: true })).toBeVisible();
  await expect(page.getByText('Commercial go-live: HOLD', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('integrated-review-export').click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const exported = JSON.parse(fs.readFileSync(downloadedPath, 'utf8'));

  expect(exported.classification).toBe('DRAFT / NOT AN APPROVAL');
  expect(exported.caseId).toBe(bundles.caseResult.caseId);
  expect(exported.caseResultHashSha256).toBe(bundles.caseResult.resultHashSha256);
  expect(exported.reviewRecordHashSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(exported.transactionAuthorized).toBe(false);
  expect(exported.approvalAuthorized).toBe(false);
  expect(exported.publicAiAuthorized).toBe(false);
  expect(exported.productionDeploymentAuthorized).toBe(false);
  expect(exported.commercialGoLive).toBe('HOLD');

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
});

test('viewer can inspect trusted HOLD but cannot review or export', async ({ page }) => {
  const diagnostics = captureUnexpectedBrowserErrors(page);
  const bundles = await buildPostC30IntegratedReviewBundles();
  await openEnglishProduct(page);

  await loadBundle(page, 'viewer-valid', bundles.viewer);
  await expect(page.getByTestId('integrated-review-trusted')).toBeVisible();
  await expect(page.getByText('Hold', { exact: true })).toBeVisible();
  await expect(page.getByTestId('integrated-review-disposition')).toHaveCount(0);
  await expect(page.getByTestId('integrated-review-note')).toHaveCount(0);
  await expect(page.getByTestId('integrated-review-record')).toHaveCount(0);
  await expect(page.getByTestId('integrated-review-export')).toBeDisabled();

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
});

test('tamper, incomplete lineage, expiry and cross-context mismatch all fail closed', async ({ page }) => {
  const diagnostics = captureUnexpectedBrowserErrors(page);
  const bundles = await buildPostC30IntegratedReviewBundles();
  await openEnglishProduct(page);

  await loadBundle(page, 'tampered', bundles.tampered);
  await expectUntrusted(page, 'C26_UI_BUNDLE_INTEGRITY_FAILED');

  await loadBundle(page, 'incomplete-lineage', bundles.incompleteLineage);
  await expectUntrusted(page, 'C26_UI_C24_LINEAGE_INCOMPLETE');

  await loadBundle(page, 'expired', bundles.expired);
  await expectUntrusted(page, 'C26_UI_ACCESS_GRANT_INVALID');

  await loadBundle(page, 'cross-context', bundles.crossContext);
  await expectUntrusted(page, 'C26_UI_ACCESS_CONTEXT_MISMATCH');

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
});
