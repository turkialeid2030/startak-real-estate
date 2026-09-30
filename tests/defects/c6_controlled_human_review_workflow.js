'use strict';

const assert = require('assert');
const { buildC6SavedDeal } = require('../fixtures/c6-governed-saved-deal');
const {
  C6_REVIEW_RECOMMENDATION,
  C6_REVIEW_STATUS,
  C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION,
} = require('../../src/contracts/governed-human-review');
const {
  C6ReviewError,
  buildGovernedHumanReview,
  validateGovernedHumanReview,
  withGovernedHumanReview,
  evaluateControlledHumanReviewState,
  buildGovernedReviewedDecisionExport,
  verifyGovernedReviewedDecisionExport,
} = require('../../src/decision-intelligence/governed-human-review');
const { computeSavedDealStateHash } = require('../../src/app/governed-decision-operational');
const {
  valuationCaseFromSavedDeal,
  withValuationCase,
  governedHumanReviewContextFromValuationCase,
} = require('../../src/app/valuation-saved-deal-bridge');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(code, fn) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

function expectSavedDealReason(reasonCode, value) {
  assert.throws(
    () => validateSavedDealRecord(value),
    (error) => error && error.reasonCode === reasonCode,
    `expected saved-deal reason ${reasonCode}`,
  );
}

(function run() {
  const now = new Date('2026-09-30T10:00:00.000Z');
  const record = buildC6SavedDeal({ now });
  assert.strictEqual(validateSavedDealRecord(record), record);

  const ready = evaluateControlledHumanReviewState({ savedDealRecord: record, asOf: now });
  assert.strictEqual(ready.status, 'READY_FOR_HUMAN_REVIEW');
  assert.strictEqual(ready.canRecordReview, true);
  assert.strictEqual(ready.canExportReviewedOutput, false);
  assert.strictEqual(ready.transactionAuthorized, false);
  assert.strictEqual(ready.approvalAuthorized, false);
  assert.strictEqual(ready.publicAiAuthorized, false);
  assert.strictEqual(ready.commercialGoLive, 'HOLD');

  const review = buildGovernedHumanReview({
    savedDealRecord: record,
    reviewerId: 'investment-reviewer-c6',
    recommendation: C6_REVIEW_RECOMMENDATION.REQUEST_MODIFICATION,
    rationale: 'Request modification before any separate approval process; analytical output remains non-authorizing.',
    reviewedAt: now,
  });
  assert.strictEqual(review.status, C6_REVIEW_STATUS.REVIEW_RECORDED);
  assert.strictEqual(review.approvalStatus, 'NOT_ESTABLISHED');
  assert.strictEqual(review.transactionAuthorized, false);
  assert.strictEqual(review.approvalAuthorized, false);
  assert.strictEqual(review.publicAiAuthorized, false);
  assert.strictEqual(review.commercialGoLive, 'HOLD');
  assert.strictEqual(review.finalValuationConclusionEstablished, false);
  assert.strictEqual(review.certifiedValuationEstablished, false);
  assert(/^[a-f0-9]{64}$/.test(review.reviewHashSha256));
  assert.strictEqual(validateGovernedHumanReview(review, { savedDealRecord: record }), true);

  const reviewedRecord = withGovernedHumanReview(record, review);
  assert.strictEqual(validateSavedDealRecord(reviewedRecord), reviewedRecord);
  // Recording governance metadata must not change the material deal-state hash.
  assert.strictEqual(computeSavedDealStateHash(reviewedRecord), computeSavedDealStateHash(record));

  const recorded = evaluateControlledHumanReviewState({
    savedDealRecord: reviewedRecord,
    asOf: new Date('2026-09-30T10:05:00.000Z'),
  });
  assert.strictEqual(recorded.status, 'REVIEW_RECORDED');
  assert.strictEqual(recorded.canRecordReview, false);
  assert.strictEqual(recorded.canExportReviewedOutput, true);
  assert.strictEqual(recorded.review.recommendation, C6_REVIEW_RECOMMENDATION.REQUEST_MODIFICATION);

  const exportEnvelope = buildGovernedReviewedDecisionExport({
    savedDealRecord: reviewedRecord,
    reportId: 'REPORT-C6-001',
    generatedAt: '2026-09-30T10:05:00.000Z',
  });
  assert.strictEqual(exportEnvelope.schemaVersion, C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION);
  assert.strictEqual(exportEnvelope.classification, 'NON_AUTHORIZING_ANALYTICAL_OUTPUT');
  assert.strictEqual(exportEnvelope.approvalStatus, 'NOT_ESTABLISHED');
  assert.strictEqual(exportEnvelope.transactionAuthorized, false);
  assert.strictEqual(exportEnvelope.approvalAuthorized, false);
  assert.strictEqual(exportEnvelope.publicAiAuthorized, false);
  assert.strictEqual(exportEnvelope.commercialGoLive, 'HOLD');
  assert.strictEqual(exportEnvelope.reviewHashSha256, review.reviewHashSha256);
  assert.strictEqual(exportEnvelope.decisionSnapshotHashSha256, review.decisionSnapshotHashSha256);
  assert.strictEqual(exportEnvelope.savedDealStateHashSha256, review.savedDealStateHashSha256);
  assert(exportEnvelope.disclosures.includes('REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL'));
  assert.strictEqual(verifyGovernedReviewedDecisionExport(exportEnvelope), true);

  const deterministicAgain = buildGovernedReviewedDecisionExport({
    savedDealRecord: clone(reviewedRecord),
    reportId: 'REPORT-C6-001',
    generatedAt: '2026-09-30T10:05:00.000Z',
  });
  assert.strictEqual(deterministicAgain.exportHashSha256, exportEnvelope.exportHashSha256);

  // Missing or unsupported human input fails closed.
  expectCode('C6_REQUIRED_FIELD', () => buildGovernedHumanReview({
    savedDealRecord: record,
    reviewerId: '',
    recommendation: C6_REVIEW_RECOMMENDATION.HOLD_FOR_EVIDENCE,
    rationale: 'Missing reviewer ID should fail.',
    reviewedAt: now,
  }));
  expectCode('C6_RECOMMENDATION_INVALID', () => buildGovernedHumanReview({
    savedDealRecord: record,
    reviewerId: 'reviewer',
    recommendation: 'APPROVE',
    rationale: 'Unsupported approval-like recommendation.',
    reviewedAt: now,
  }));
  expectCode('C6_REQUIRED_FIELD', () => buildGovernedHumanReview({
    savedDealRecord: record,
    reviewerId: 'reviewer',
    recommendation: C6_REVIEW_RECOMMENDATION.HOLD_FOR_EVIDENCE,
    rationale: '',
    reviewedAt: now,
  }));

  // A stale governed decision cannot accept a new review.
  expectCode('C6_REVIEW_BLOCKED', () => buildGovernedHumanReview({
    savedDealRecord: record,
    reviewerId: 'reviewer',
    recommendation: C6_REVIEW_RECOMMENDATION.HOLD_FOR_EVIDENCE,
    rationale: 'Stale context must fail closed.',
    reviewedAt: '2026-10-02T12:00:00.000Z',
  }));

  // Review is immutable: second review cannot replace the first.
  expectCode('C6_REVIEW_ALREADY_RECORDED', () => buildGovernedHumanReview({
    savedDealRecord: reviewedRecord,
    reviewerId: 'another-reviewer',
    recommendation: C6_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE,
    rationale: 'Replacement must be rejected.',
    reviewedAt: '2026-09-30T10:06:00.000Z',
  }));

  // Tamper/binding/authority attacks are rejected.
  const badHash = clone(reviewedRecord);
  badHash.governedHumanReview.rationale += ' tampered';
  expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', badHash);

  const wrongSnapshot = clone(reviewedRecord);
  wrongSnapshot.governedHumanReview.decisionSnapshotHashSha256 = 'f'.repeat(64);
  expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', wrongSnapshot);

  const wrongState = clone(reviewedRecord);
  wrongState.governedHumanReview.savedDealStateHashSha256 = 'e'.repeat(64);
  expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', wrongState);

  for (const mutation of [
    (value) => { value.governedHumanReview.authorityBoundary.approvalAuthorized = true; },
    (value) => { value.governedHumanReview.authorityBoundary.transactionAuthority = true; },
    (value) => { value.governedHumanReview.authorityBoundary.publicAi = true; },
  ]) {
    const forged = clone(reviewedRecord);
    mutation(forged);
    expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', forged);
  }

  const extraApprovalField = clone(reviewedRecord);
  extraApprovalField.governedHumanReview.approved = true;
  expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', extraApprovalField);

  // A material edit invalidates the review binding.
  const changed = clone(reviewedRecord);
  changed.inputs.buildingPrice += 1;
  expectSavedDealReason('INVALID_GOVERNED_HUMAN_REVIEW', changed);

  // Session bridge preserves both C4 and C6 only for an unchanged material state.
  const loadedValuationCase = valuationCaseFromSavedDeal(reviewedRecord);
  const bridgeContext = governedHumanReviewContextFromValuationCase(loadedValuationCase, { asOf: '2026-09-30T10:05:00.000Z' });
  assert(bridgeContext);
  assert.strictEqual(bridgeContext.viewModel.status, 'REVIEW_RECORDED');

  const baseForUnchangedUpdate = clone(reviewedRecord);
  delete baseForUnchangedUpdate.valuationCase;
  delete baseForUnchangedUpdate.governedDealDecision;
  delete baseForUnchangedUpdate.governedHumanReview;
  baseForUnchangedUpdate.savedAt = '2026-09-30T10:10:00.000Z';
  const preserved = withValuationCase(baseForUnchangedUpdate, loadedValuationCase);
  assert(preserved.governedDealDecision);
  assert(preserved.governedHumanReview);
  assert.strictEqual(preserved.governedHumanReview.reviewHashSha256, review.reviewHashSha256);

  const loadedForChangedUpdate = valuationCaseFromSavedDeal(reviewedRecord);
  const changedBase = clone(baseForUnchangedUpdate);
  changedBase.inputs.buildingPrice += 500;
  const invalidated = withValuationCase(changedBase, loadedForChangedUpdate);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(invalidated, 'governedDealDecision'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(invalidated, 'governedHumanReview'), false);
  assert.strictEqual(governedHumanReviewContextFromValuationCase(loadedForChangedUpdate, { asOf: '2026-09-30T10:05:00.000Z' }), null);

  const tamperedExport = clone(exportEnvelope);
  tamperedExport.review.rationale += ' tampered';
  assert.strictEqual(verifyGovernedReviewedDecisionExport(tamperedExport), false);

  console.log('C6 controlled human review workflow: PASS');
})();
