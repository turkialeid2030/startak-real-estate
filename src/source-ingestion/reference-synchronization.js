'use strict';

const SYNC_MODE = Object.freeze({
  PUBLIC_REFERENCE_SNAPSHOT: 'PUBLIC_REFERENCE_SNAPSHOT',
  USER_APPROVED_REFERENCE_URL: 'USER_APPROVED_REFERENCE_URL',
  MANUAL_UPLOAD_REFRESH: 'MANUAL_UPLOAD_REFRESH',
});

const SYNC_STATUS = Object.freeze({
  READY_TO_REFRESH: 'READY_TO_REFRESH',
  NOT_DUE: 'NOT_DUE',
  HOLD_SOURCE_URL: 'HOLD_SOURCE_URL',
  HOLD_PERMISSION: 'HOLD_PERMISSION',
  HOLD_SCHEDULE: 'HOLD_SCHEDULE',
  SNAPSHOT_ACCEPTED: 'SNAPSHOT_ACCEPTED',
  SNAPSHOT_CHANGED: 'SNAPSHOT_CHANGED',
  SNAPSHOT_UNCHANGED: 'SNAPSHOT_UNCHANGED',
});

function clean(v) { return typeof v === 'string' ? v.trim() : v; }
function isoDateOnly(v) {
  const s = clean(v);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function createReferenceSyncPlan({
  sourceId,
  sourceName,
  sourceUrl = null,
  mode = SYNC_MODE.USER_APPROVED_REFERENCE_URL,
  refreshEveryDays = 7,
  userApprovedRetrieval = false,
  automatedRetrievalAllowed = false,
  createdAt,
  lastRetrievedAt = null,
} = {}) {
  if (!Object.values(SYNC_MODE).includes(mode)) throw new Error(`UNSUPPORTED_SYNC_MODE: ${mode}`);
  if (!clean(sourceId) || !clean(sourceName)) throw new Error('SYNC_SOURCE_METADATA_REQUIRED');
  if (!Number.isInteger(refreshEveryDays) || refreshEveryDays < 1 || refreshEveryDays > 365) {
    return Object.freeze({ status: SYNC_STATUS.HOLD_SCHEDULE, sourceId: clean(sourceId), liveConnected: false, officialApiUsed: false });
  }
  if (mode !== SYNC_MODE.MANUAL_UPLOAD_REFRESH && !clean(sourceUrl)) {
    return Object.freeze({ status: SYNC_STATUS.HOLD_SOURCE_URL, sourceId: clean(sourceId), liveConnected: false, officialApiUsed: false });
  }
  if (mode === SYNC_MODE.USER_APPROVED_REFERENCE_URL && !userApprovedRetrieval) {
    return Object.freeze({ status: SYNC_STATUS.HOLD_PERMISSION, sourceId: clean(sourceId), liveConnected: false, officialApiUsed: false });
  }

  return Object.freeze({
    status: 'SYNC_PLAN_ACCEPTED',
    sourceId: clean(sourceId),
    sourceName: clean(sourceName),
    sourceUrl: clean(sourceUrl) || null,
    mode,
    refreshEveryDays,
    userApprovedRetrieval: Boolean(userApprovedRetrieval),
    automatedRetrievalAllowed: Boolean(automatedRetrievalAllowed),
    createdAt: isoDateOnly(createdAt),
    lastRetrievedAt: isoDateOnly(lastRetrievedAt),
    liveConnected: false,
    officialApiUsed: false,
    claimBoundary: Object.freeze({
      isOfficialIntegration: false,
      isOfficialApi: false,
      isReferenceSynchronization: true,
      mayRetrieveOnlyPublicOrUserAuthorizedMaterial: true,
      mustRespectSourceTermsAndAccessControls: true,
    }),
  });
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function assessRefreshDue({ plan, asOfDate } = {}) {
  if (!plan || plan.status !== 'SYNC_PLAN_ACCEPTED') {
    return Object.freeze({ status: 'HOLD_SYNC_PLAN', due: false });
  }
  const asOf = isoDateOnly(asOfDate);
  if (!asOf) return Object.freeze({ status: SYNC_STATUS.HOLD_SCHEDULE, due: false });
  if (!plan.lastRetrievedAt) return Object.freeze({ status: SYNC_STATUS.READY_TO_REFRESH, due: true, dueDate: asOf });
  const dueDate = addDays(plan.lastRetrievedAt, plan.refreshEveryDays);
  return Object.freeze({
    status: asOf >= dueDate ? SYNC_STATUS.READY_TO_REFRESH : SYNC_STATUS.NOT_DUE,
    due: asOf >= dueDate,
    dueDate,
  });
}

function recordReferenceSnapshot({
  plan,
  retrievedAt,
  contentHash,
  previousContentHash = null,
  retrievalMethod = 'CALLER_PROVIDED_FETCHER',
  sourceHttpStatus = null,
} = {}) {
  if (!plan || plan.status !== 'SYNC_PLAN_ACCEPTED') throw new Error('VALID_SYNC_PLAN_REQUIRED');
  if (!isoDateOnly(retrievedAt)) throw new Error('RETRIEVED_AT_REQUIRED');
  if (!clean(contentHash)) throw new Error('CONTENT_HASH_REQUIRED');

  const changed = Boolean(clean(previousContentHash)) && clean(previousContentHash) !== clean(contentHash);
  const status = !clean(previousContentHash)
    ? SYNC_STATUS.SNAPSHOT_ACCEPTED
    : changed ? SYNC_STATUS.SNAPSHOT_CHANGED : SYNC_STATUS.SNAPSHOT_UNCHANGED;

  return Object.freeze({
    status,
    sourceId: plan.sourceId,
    sourceUrl: plan.sourceUrl,
    retrievedAt,
    contentHash: clean(contentHash),
    previousContentHash: clean(previousContentHash) || null,
    changed,
    retrievalMethod,
    sourceHttpStatus,
    liveConnected: false,
    officialApiUsed: false,
    provenanceRequired: true,
    transactionAuthorized: false,
  });
}

module.exports = {
  SYNC_MODE,
  SYNC_STATUS,
  createReferenceSyncPlan,
  assessRefreshDue,
  recordReferenceSnapshot,
};
