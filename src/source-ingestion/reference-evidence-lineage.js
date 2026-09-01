'use strict';

const LINEAGE_STATUS = Object.freeze({
  LINKED: 'LINKED',
  HOLD_REFERENCE_RECORD: 'HOLD_REFERENCE_RECORD',
  HOLD_SNAPSHOT: 'HOLD_SNAPSHOT',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_SCOPE: 'HOLD_SCOPE',
});

const CHANGE_REVIEW_STATUS = Object.freeze({
  NO_CHANGE: 'NO_CHANGE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  ACKNOWLEDGED_PENDING_REANALYSIS: 'ACKNOWLEDGED_PENDING_REANALYSIS',
  CLEARED_FOR_REANALYSIS: 'CLEARED_FOR_REANALYSIS',
});

const IMPACT_DOMAIN = Object.freeze({
  REGULATORY: 'REGULATORY',
  LEGAL: 'LEGAL',
  VALUATION: 'VALUATION',
  FINANCIAL: 'FINANCIAL',
  MARKET: 'MARKET',
  PROPERTY: 'PROPERTY',
  TENANT: 'TENANT',
  OTHER: 'OTHER',
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function assertNonEmpty(value, name) {
  if (!clean(value)) throw new TypeError(`${name} must be a non-empty string`);
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}

function linkReferenceSnapshotToEvidence({
  caseId,
  projectId,
  referenceRecord,
  snapshot,
  evidenceId,
  evidenceDomain,
  evidenceRefs = [],
  linkedAt,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(projectId, 'projectId');
  assertNonEmpty(evidenceId, 'evidenceId');
  assertNonEmpty(evidenceDomain, 'evidenceDomain');
  assertNonEmpty(linkedAt, 'linkedAt');
  assertArray(evidenceRefs, 'evidenceRefs');

  if (!referenceRecord || referenceRecord.status !== 'ACCEPTED_REFERENCE') {
    return Object.freeze({ status: LINEAGE_STATUS.HOLD_REFERENCE_RECORD, transactionAuthorized: false });
  }
  if (!snapshot || !['SNAPSHOT_ACCEPTED', 'SNAPSHOT_CHANGED', 'SNAPSHOT_UNCHANGED'].includes(snapshot.status)) {
    return Object.freeze({ status: LINEAGE_STATUS.HOLD_SNAPSHOT, transactionAuthorized: false });
  }
  if (referenceRecord.sourceId !== snapshot.sourceId) {
    return Object.freeze({ status: LINEAGE_STATUS.HOLD_SCOPE, reasonCode: 'SOURCE_ID_MISMATCH', transactionAuthorized: false });
  }
  if (!clean(snapshot.contentHash)) {
    return Object.freeze({ status: LINEAGE_STATUS.HOLD_SNAPSHOT, reasonCode: 'SNAPSHOT_HASH_REQUIRED', transactionAuthorized: false });
  }

  return Object.freeze({
    schemaVersion: 1,
    status: LINEAGE_STATUS.LINKED,
    caseId: clean(caseId),
    projectId: clean(projectId),
    sourceId: referenceRecord.sourceId,
    sourceName: referenceRecord.sourceName,
    authorityClass: referenceRecord.authorityClass || 'UNCLASSIFIED_REFERENCE',
    snapshotHash: clean(snapshot.contentHash),
    previousSnapshotHash: clean(snapshot.previousContentHash) || null,
    retrievedAt: snapshot.retrievedAt,
    effectiveDate: referenceRecord.effectiveDate || null,
    lastVerifiedDate: referenceRecord.lastVerifiedDate || null,
    evidenceId: clean(evidenceId),
    evidenceDomain: clean(evidenceDomain),
    evidenceRefs: Object.freeze(evidenceRefs.map(String)),
    linkedAt: clean(linkedAt),
    liveConnected: false,
    officialApiUsed: false,
    transactionAuthorized: false,
  });
}

function createReferenceChangeQueueItem({
  lineage,
  snapshot,
  impactDomains = [],
  reviewerRequired = true,
  createdAt,
} = {}) {
  if (!lineage || lineage.status !== LINEAGE_STATUS.LINKED) {
    throw new Error('LINKED_LINEAGE_REQUIRED');
  }
  if (!snapshot || !['SNAPSHOT_ACCEPTED', 'SNAPSHOT_CHANGED', 'SNAPSHOT_UNCHANGED'].includes(snapshot.status)) {
    throw new Error('VALID_REFERENCE_SNAPSHOT_REQUIRED');
  }
  assertNonEmpty(createdAt, 'createdAt');
  assertArray(impactDomains, 'impactDomains');
  for (const domain of impactDomains) {
    if (!Object.values(IMPACT_DOMAIN).includes(domain)) throw new TypeError(`Unsupported impact domain: ${domain}`);
  }
  if (lineage.sourceId !== snapshot.sourceId) throw new Error('SOURCE_SCOPE_MISMATCH');

  const changed = Boolean(snapshot.changed);
  const requiresReview = changed && Boolean(reviewerRequired);

  return Object.freeze({
    schemaVersion: 1,
    queueItemId: `${lineage.evidenceId}:${snapshot.contentHash}`,
    caseId: lineage.caseId,
    projectId: lineage.projectId,
    sourceId: lineage.sourceId,
    evidenceId: lineage.evidenceId,
    previousSnapshotHash: snapshot.previousContentHash || lineage.snapshotHash || null,
    currentSnapshotHash: snapshot.contentHash,
    changed,
    impactDomains: Object.freeze([...impactDomains]),
    status: !changed
      ? CHANGE_REVIEW_STATUS.NO_CHANGE
      : requiresReview
        ? CHANGE_REVIEW_STATUS.REVIEW_REQUIRED
        : CHANGE_REVIEW_STATUS.CLEARED_FOR_REANALYSIS,
    reviewerRequired: requiresReview,
    reviewerAcknowledged: false,
    reviewerId: null,
    reviewedAt: null,
    approvedReferenceReplacement: false,
    mayUpdateRegulatedOrLegalConclusion: false,
    mayUpdateValuationConclusion: false,
    reanalysisRequired: changed,
    createdAt: clean(createdAt),
    transactionAuthorized: false,
    semantics: 'A changed reference snapshot is queued for explicit review. It does not silently replace approved evidence, facts, assumptions, legal/regulatory conclusions, or valuation conclusions. Human acknowledgment is required where configured before downstream re-analysis may consume the changed reference.',
  });
}

function acknowledgeReferenceChange({ queueItem, reviewerId, reviewedAt, approveForReanalysis = false } = {}) {
  if (!queueItem || queueItem.status !== CHANGE_REVIEW_STATUS.REVIEW_REQUIRED) {
    throw new Error('REVIEW_REQUIRED_QUEUE_ITEM_REQUIRED');
  }
  assertNonEmpty(reviewerId, 'reviewerId');
  assertNonEmpty(reviewedAt, 'reviewedAt');

  const cleared = Boolean(approveForReanalysis);
  return Object.freeze({
    ...queueItem,
    status: cleared
      ? CHANGE_REVIEW_STATUS.CLEARED_FOR_REANALYSIS
      : CHANGE_REVIEW_STATUS.ACKNOWLEDGED_PENDING_REANALYSIS,
    reviewerAcknowledged: true,
    reviewerId: clean(reviewerId),
    reviewedAt: clean(reviewedAt),
    approvedReferenceReplacement: false,
    mayUpdateRegulatedOrLegalConclusion: false,
    mayUpdateValuationConclusion: false,
    reanalysisRequired: true,
    clearedForReanalysis: cleared,
    transactionAuthorized: false,
  });
}

module.exports = {
  LINEAGE_STATUS,
  CHANGE_REVIEW_STATUS,
  IMPACT_DOMAIN,
  linkReferenceSnapshotToEvidence,
  createReferenceChangeQueueItem,
  acknowledgeReferenceChange,
};
