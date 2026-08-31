'use strict';
const assert = require('assert');
const {
  SYNC_MODE,
  SYNC_STATUS,
  createReferenceSyncPlan,
  assessRefreshDue,
  recordReferenceSnapshot,
} = require('../../src/source-ingestion/reference-synchronization');

let checks = 0;
function check(fn) { fn(); checks++; }

const plan = createReferenceSyncPlan({
  sourceId: 'SRC-SA-REGA',
  sourceName: 'Real Estate General Authority',
  sourceUrl: 'https://rega.gov.sa/',
  mode: SYNC_MODE.USER_APPROVED_REFERENCE_URL,
  refreshEveryDays: 7,
  userApprovedRetrieval: true,
  automatedRetrievalAllowed: true,
  createdAt: '2026-09-01',
  lastRetrievedAt: '2026-09-01',
});
check(() => assert.strictEqual(plan.status, 'SYNC_PLAN_ACCEPTED'));
check(() => assert.strictEqual(plan.liveConnected, false));
check(() => assert.strictEqual(plan.officialApiUsed, false));
check(() => assert.strictEqual(plan.claimBoundary.isOfficialIntegration, false));
check(() => assert.strictEqual(plan.claimBoundary.isReferenceSynchronization, true));

const notDue = assessRefreshDue({ plan, asOfDate: '2026-09-05' });
check(() => assert.strictEqual(notDue.status, SYNC_STATUS.NOT_DUE));
check(() => assert.strictEqual(notDue.due, false));
check(() => assert.strictEqual(notDue.dueDate, '2026-09-08'));

const due = assessRefreshDue({ plan, asOfDate: '2026-09-08' });
check(() => assert.strictEqual(due.status, SYNC_STATUS.READY_TO_REFRESH));
check(() => assert.strictEqual(due.due, true));

const first = recordReferenceSnapshot({ plan, retrievedAt: '2026-09-08', contentHash: 'sha256:first' });
check(() => assert.strictEqual(first.status, SYNC_STATUS.SNAPSHOT_ACCEPTED));
check(() => assert.strictEqual(first.changed, false));
check(() => assert.strictEqual(first.liveConnected, false));

const changed = recordReferenceSnapshot({
  plan, retrievedAt: '2026-09-15', contentHash: 'sha256:second', previousContentHash: 'sha256:first', sourceHttpStatus: 200,
});
check(() => assert.strictEqual(changed.status, SYNC_STATUS.SNAPSHOT_CHANGED));
check(() => assert.strictEqual(changed.changed, true));
check(() => assert.strictEqual(changed.sourceHttpStatus, 200));

const unchanged = recordReferenceSnapshot({
  plan, retrievedAt: '2026-09-22', contentHash: 'sha256:second', previousContentHash: 'sha256:second',
});
check(() => assert.strictEqual(unchanged.status, SYNC_STATUS.SNAPSHOT_UNCHANGED));
check(() => assert.strictEqual(unchanged.changed, false));

const noPermission = createReferenceSyncPlan({
  sourceId: 'SRC-X', sourceName: 'X', sourceUrl: 'https://example.com',
  mode: SYNC_MODE.USER_APPROVED_REFERENCE_URL, refreshEveryDays: 3,
  userApprovedRetrieval: false, createdAt: '2026-09-01',
});
check(() => assert.strictEqual(noPermission.status, SYNC_STATUS.HOLD_PERMISSION));

const missingUrl = createReferenceSyncPlan({
  sourceId: 'SRC-X', sourceName: 'X', mode: SYNC_MODE.PUBLIC_REFERENCE_SNAPSHOT,
  refreshEveryDays: 3, createdAt: '2026-09-01',
});
check(() => assert.strictEqual(missingUrl.status, SYNC_STATUS.HOLD_SOURCE_URL));

const manualUpload = createReferenceSyncPlan({
  sourceId: 'SRC-UPLOAD', sourceName: 'Uploaded source', mode: SYNC_MODE.MANUAL_UPLOAD_REFRESH,
  refreshEveryDays: 30, createdAt: '2026-09-01',
});
check(() => assert.strictEqual(manualUpload.status, 'SYNC_PLAN_ACCEPTED'));

console.log(`REFERENCE_SYNCHRONIZATION_V1: PASS (${checks} checks)`);
