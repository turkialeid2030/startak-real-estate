'use strict';

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { buildC6SavedDeal } = require('../fixtures/c6-governed-saved-deal');

const NAMESPACE = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';

async function preloadDeal(page, record) {
  const index = [{ id: record.id, name: record.name, mode: record.mode, savedAt: record.savedAt }];
  await page.addInitScript(({ namespace, deal, dealIndex }) => {
    window.localStorage.setItem(`${namespace}deal:${deal.id}`, JSON.stringify(deal));
    window.localStorage.setItem(`${namespace}deals-index`, JSON.stringify(dealIndex));
  }, { namespace: NAMESPACE, deal: record, dealIndex: index });
}

async function loadSavedDeal(page, name) {
  await page.getByTitle('الصفقات المحفوظة').click();
  await expect(page.getByRole('button', { name })).toBeVisible();
  await page.getByRole('button', { name }).click();
}

async function persistedRecord(page, id) {
  return page.evaluate(({ namespace, dealId }) => {
    const raw = window.localStorage.getItem(`${namespace}deal:${dealId}`);
    return raw ? JSON.parse(raw) : null;
  }, { namespace: NAMESPACE, dealId: id });
}

test('records, reloads and exports a non-authorizing governed human review', async ({ page }) => {
  const record = buildC6SavedDeal({ now: new Date() });
  await preloadDeal(page, record);
  await page.goto('/');
  await loadSavedDeal(page, record.name);

  await expect(page.getByTestId('governed-decision-operations')).toBeVisible();
  await expect(page.getByTestId('c6-human-review-workflow')).toBeVisible();
  await expect(page.getByTestId('c6-review-status')).toHaveText('READY_FOR_HUMAN_REVIEW');
  await expect(page.getByTestId('c6-reviewed-export')).toBeDisabled();

  await page.getByTestId('c6-reviewer-id').fill('browser-reviewer-c6');
  await page.getByTestId('c6-review-recommendation').selectOption('HOLD_FOR_EVIDENCE');
  await page.getByTestId('c6-review-rationale').fill('استكمال الشواهد قبل أي مسار موافقة مستقل. هذه توصية غير مخولة بالتنفيذ.');
  await page.getByTestId('c6-record-review').click();

  await expect(page.getByTestId('c6-review-status')).toHaveText('REVIEW_RECORDED');
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
  await loadSavedDeal(page, record.name);
  await expect(page.getByTestId('c6-review-status')).toHaveText('REVIEW_RECORDED');
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
  const staleBase = new Date(Date.now() - (72 * 60 * 60 * 1000));
  const record = buildC6SavedDeal({ now: staleBase, id: 'DEAL-C6-STALE' });
  record.name = 'C6 stale governed browser deal';
  await preloadDeal(page, record);
  await page.goto('/');
  await loadSavedDeal(page, record.name);

  const c5Panel = page.getByTestId('governed-decision-operations');
  await expect(c5Panel).toBeVisible();
  await expect(c5Panel.getByText('C5_RECONCILIATION_STALE_NOW')).toBeVisible();
  await expect(c5Panel.getByRole('button', { name: 'تصدير المخرج التحليلي المحكوم' })).toBeDisabled();
  await expect(page.getByTestId('c6-review-status')).toHaveText('HOLD');
  await expect(page.getByTestId('c6-review-hold-reasons')).toContainText('C5_RECONCILIATION_STALE_NOW');
  await expect(page.getByTestId('c6-reviewer-id')).toBeDisabled();
  await expect(page.getByTestId('c6-record-review')).toBeDisabled();
  await expect(page.getByTestId('c6-reviewed-export')).toBeDisabled();
});
