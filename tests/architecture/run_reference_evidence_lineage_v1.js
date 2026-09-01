'use strict';

const assert = require('assert');
const {
  LINEAGE_STATUS,
  CHANGE_REVIEW_STATUS,
  IMPACT_DOMAIN,
  linkReferenceSnapshotToEvidence,
  createReferenceChangeQueueItem,
  acknowledgeReferenceChange,
} = require('../../src/source-ingestion/reference-evidence-lineage');

function record(overrides = {}) {
  return {
    status: 'ACCEPTED_REFERENCE',
    sourceId: 'SRC-001',
    sourceName: 'Synthetic Reference',
    authorityClass: 'PUBLIC_REFERENCE',
    effectiveDate: '2026-08-01',
    lastVerifiedDate: '2026-08-30',
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    status: 'SNAPSHOT_CHANGED',
    sourceId: 'SRC-001',
    retrievedAt: '2026-09-01',
    contentHash: 'hash-v2',
    previousContentHash: 'hash-v1',
    changed: true,
    ...overrides,
  };
}

(function testLineageLinksSnapshotToEvidence() {
  const out = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: record(),
    snapshot: snapshot(),
    evidenceId: 'EVID-1',
    evidenceDomain: 'REGULATORY',
    evidenceRefs: ['REF-1'],
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  assert.strictEqual(out.status, LINEAGE_STATUS.LINKED);
  assert.strictEqual(out.snapshotHash, 'hash-v2');
  assert.strictEqual(out.previousSnapshotHash, 'hash-v1');
  assert.strictEqual(out.transactionAuthorized, false);
  assert.strictEqual(out.liveConnected, false);
  assert.strictEqual(out.officialApiUsed, false);
})();

(function testScopeMismatchFailsClosed() {
  const out = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: record(),
    snapshot: snapshot({ sourceId: 'SRC-OTHER' }),
    evidenceId: 'EVID-1',
    evidenceDomain: 'LEGAL',
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  assert.strictEqual(out.status, LINEAGE_STATUS.HOLD_SCOPE);
  assert.strictEqual(out.transactionAuthorized, false);
})();

(function testChangedSnapshotRequiresReview() {
  const lineage = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: record(),
    snapshot: snapshot(),
    evidenceId: 'EVID-1',
    evidenceDomain: 'REGULATORY',
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  const item = createReferenceChangeQueueItem({
    lineage,
    snapshot: snapshot(),
    impactDomains: [IMPACT_DOMAIN.REGULATORY, IMPACT_DOMAIN.VALUATION],
    reviewerRequired: true,
    createdAt: '2026-09-01T10:01:00+03:00',
  });
  assert.strictEqual(item.status, CHANGE_REVIEW_STATUS.REVIEW_REQUIRED);
  assert.strictEqual(item.reanalysisRequired, true);
  assert.strictEqual(item.approvedReferenceReplacement, false);
  assert.strictEqual(item.mayUpdateRegulatedOrLegalConclusion, false);
  assert.strictEqual(item.mayUpdateValuationConclusion, false);
})();

(function testUnchangedSnapshotDoesNotCreateReviewWork() {
  const snap = snapshot({
    status: 'SNAPSHOT_UNCHANGED',
    contentHash: 'hash-v1',
    previousContentHash: 'hash-v1',
    changed: false,
  });
  const lineage = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: record(),
    snapshot: snap,
    evidenceId: 'EVID-1',
    evidenceDomain: 'MARKET',
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  const item = createReferenceChangeQueueItem({
    lineage,
    snapshot: snap,
    impactDomains: [IMPACT_DOMAIN.MARKET],
    createdAt: '2026-09-01T10:01:00+03:00',
  });
  assert.strictEqual(item.status, CHANGE_REVIEW_STATUS.NO_CHANGE);
  assert.strictEqual(item.reanalysisRequired, false);
})();

(function testAcknowledgmentNeverSilentlyReplacesApprovedConclusion() {
  const lineage = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: record(),
    snapshot: snapshot(),
    evidenceId: 'EVID-1',
    evidenceDomain: 'LEGAL',
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  const item = createReferenceChangeQueueItem({
    lineage,
    snapshot: snapshot(),
    impactDomains: [IMPACT_DOMAIN.LEGAL],
    reviewerRequired: true,
    createdAt: '2026-09-01T10:01:00+03:00',
  });
  const reviewed = acknowledgeReferenceChange({
    queueItem: item,
    reviewerId: 'HUMAN-REVIEWER-1',
    reviewedAt: '2026-09-01T10:05:00+03:00',
    approveForReanalysis: true,
  });
  assert.strictEqual(reviewed.status, CHANGE_REVIEW_STATUS.CLEARED_FOR_REANALYSIS);
  assert.strictEqual(reviewed.reviewerAcknowledged, true);
  assert.strictEqual(reviewed.clearedForReanalysis, true);
  assert.strictEqual(reviewed.approvedReferenceReplacement, false);
  assert.strictEqual(reviewed.mayUpdateRegulatedOrLegalConclusion, false);
  assert.strictEqual(reviewed.transactionAuthorized, false);
})();

(function testInvalidReferenceRecordFailsClosed() {
  const out = linkReferenceSnapshotToEvidence({
    caseId: 'CASE-1',
    projectId: 'PROJECT-1',
    referenceRecord: { status: 'HOLD_PROVENANCE' },
    snapshot: snapshot(),
    evidenceId: 'EVID-1',
    evidenceDomain: 'OTHER',
    linkedAt: '2026-09-01T10:00:00+03:00',
  });
  assert.strictEqual(out.status, LINEAGE_STATUS.HOLD_REFERENCE_RECORD);
})();

console.log('REFERENCE_EVIDENCE_LINEAGE_CHANGE_QUEUE_V1=PASS');
